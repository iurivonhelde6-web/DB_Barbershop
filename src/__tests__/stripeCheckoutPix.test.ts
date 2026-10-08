/**
 * Pix no Stripe Checkout + correções de segurança das rotas de pagamento:
 * - Pix vira Checkout Session mode 'payment' (cobrança única de um ciclo), cartão continua 'subscription';
 * - renovação (subscriberId) só pelo dono do cadastro ou admin;
 * - o webhook ativa o assinante uma única vez por sessão, mesmo com reentrega do Stripe;
 * - CPF placeholder/inválido é recusado;
 * - renovar quem já tem assinatura de cartão não gera uma segunda cobrança mensal.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type Stripe from 'stripe';
import {
  activateSubscriberFromSession,
  cancelAutoRenewal,
  cancelReplacedSubscription,
  decideExistingSubscription,
  isStaleSubscriptionEvent,
  buildCheckoutIdempotencyKey,
  buildCheckoutSessionParams,
  resolveCheckoutTarget,
  releasePendingCheckout,
  isSessionRecorded,
  clearPendingCheckout,
  renewSubscriberFromInvoice,
  handleInvoicePaid,
} from '../../stripe-routes';
import { isValidCpf, formatCpf } from '../lib/cpf';

// ─── Firestore falso (só o que as funções usam) ────────────────────────────────
function createFakeDb(initial: Record<string, Record<string, any>> = {}) {
  const store = new Map<string, Record<string, any>>(Object.entries(initial));
  const ref = (id: string) => ({
    id,
    get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
    set: async (data: Record<string, any>, opts?: { merge?: boolean }) => {
      store.set(id, opts?.merge ? { ...(store.get(id) || {}), ...data } : data);
    },
  });
  const db = {
    collection: (_name: string) => ({ doc: (id: string) => ref(id) }),
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        get: (r: ReturnType<typeof ref>) => r.get(),
        set: (r: ReturnType<typeof ref>, data: Record<string, any>, opts?: { merge?: boolean }) => {
          store.set(r.id, opts?.merge ? { ...(store.get(r.id) || {}), ...data } : data);
        },
      };
      return fn(tx);
    },
  };
  return { db: db as any, store };
}

const PLAN = { id: 'cs-basic-4', totalPrice: 64 } as const;

function baseMetadata(overrides: Record<string, string> = {}) {
  return {
    subscriberId: 'sub_1', planoId: PLAN.id, planName: 'BASIC 4 (4 ATD)', serviceName: 'Corte Simples',
    clientName: 'Cliente Teste', clientCpf: '52998224725', clientPhone: '', cardCode: '', userUid: 'uid_1',
    barbeiroId: '', paymentMethod: 'PIX', ...overrides,
  };
}

function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_123', payment_status: 'paid', amount_total: 6400, subscription: null,
    customer: null, payment_intent: 'pi_test_abc', metadata: baseMetadata(),
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const noSubscriptions = { subscriptions: { retrieve: vi.fn() } } as any;

// ─── Parâmetros da Checkout Session ────────────────────────────────────────────
describe('buildCheckoutSessionParams', () => {
  const plan = { id: 'cs-basic-4', tierLabel: 'BASIC 4 (4 ATD)', serviceName: 'Corte Simples', totalPrice: 64 } as any;
  const metadata = baseMetadata();

  it('Pix: cobrança única, só pix, sem recurring, metadata no PaymentIntent', () => {
    const p = buildCheckoutSessionParams({ paymentMethod: 'PIX', plan, metadata, origin: 'https://x.test' });
    expect(p.mode).toBe('payment');
    expect(p.payment_method_types).toEqual(['pix']);
    expect(p.payment_method_options?.pix?.expires_after_seconds).toBe(3600);
    expect(p.line_items?.[0].price_data).not.toHaveProperty('recurring');
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(6400);
    expect(p.customer_creation).toBe('if_required');
    expect(p.payment_intent_data?.metadata).toEqual(metadata);
    expect(p).not.toHaveProperty('subscription_data');
  });

  it('Cartão: continua assinatura mensal só com card', () => {
    const p = buildCheckoutSessionParams({ paymentMethod: 'CREDIT_CARD', plan, metadata, origin: 'https://x.test' });
    expect(p.mode).toBe('subscription');
    expect(p.payment_method_types).toEqual(['card']);
    expect(p.line_items?.[0].price_data?.recurring).toEqual({ interval: 'month' });
    expect(p.subscription_data?.metadata).toEqual(metadata);
    expect(p).not.toHaveProperty('payment_intent_data');
    expect(p.success_url).toBe('https://x.test/pagamento-sucesso?session_id={CHECKOUT_SESSION_ID}');
  });
});

describe('buildCheckoutIdempotencyKey', () => {
  const params = { mode: 'payment' } as any;

  it('mesma tentativa + mesmos parâmetros → mesma chave (duplo clique não cria 2 sessões)', () => {
    const a = buildCheckoutIdempotencyKey({ callerUid: 'u', attemptId: 'attempt-1234', params });
    const b = buildCheckoutIdempotencyKey({ callerUid: 'u', attemptId: 'attempt-1234', params });
    expect(a).toBe(b);
  });

  it('trocar o método/parâmetros gera chave nova (Stripe recusa chave reaproveitada com outros params)', () => {
    const a = buildCheckoutIdempotencyKey({ callerUid: 'u', attemptId: 'attempt-1234', params });
    const b = buildCheckoutIdempotencyKey({ callerUid: 'u', attemptId: 'attempt-1234', params: { mode: 'subscription' } as any });
    expect(a).not.toBe(b);
  });

  it('sem attemptId válido, usa balde de 1 minuto', () => {
    const a = buildCheckoutIdempotencyKey({ callerUid: 'u', attemptId: '<script>', params, now: 60_000 });
    const b = buildCheckoutIdempotencyKey({ callerUid: 'u', params, now: 119_999 });
    const c = buildCheckoutIdempotencyKey({ callerUid: 'u', params, now: 120_000 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

// ─── Autorização da renovação ──────────────────────────────────────────────────
describe('resolveCheckoutTarget — quem pode abrir checkout para um assinante', () => {
  const { db } = createFakeDb({ sub_victim: { userUid: 'uid_victim' } });

  it('cadastro novo (sem subscriberId): qualquer usuário autenticado', async () => {
    const r = await resolveCheckoutTarget({ db, subscriberId: undefined, callerUid: 'uid_x', isAdmin: async () => false });
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ isRenewal: false });
  });

  it('dono do cadastro pode renovar', async () => {
    const r = await resolveCheckoutTarget({ db, subscriberId: 'sub_victim', callerUid: 'uid_victim', isAdmin: async () => false });
    expect(r).toMatchObject({ ok: true, subscriberId: 'sub_victim', isRenewal: true, existingUserUid: 'uid_victim' });
  });

  it('outro cliente autenticado NÃO pode renovar/alterar cadastro alheio', async () => {
    const r = await resolveCheckoutTarget({ db, subscriberId: 'sub_victim', callerUid: 'uid_attacker', isAdmin: async () => false });
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it('admin pode renovar qualquer assinante (fluxo de ControlCardValidation)', async () => {
    const r = await resolveCheckoutTarget({ db, subscriberId: 'sub_victim', callerUid: 'uid_admin', isAdmin: async () => true });
    expect(r).toMatchObject({ ok: true, isAdmin: true, existingUserUid: 'uid_victim' });
  });

  it('subscriberId inexistente: 403 para não-admin (não revela quais IDs existem), 404 para admin', async () => {
    expect(await resolveCheckoutTarget({ db, subscriberId: 'nope', callerUid: 'uid_x', isAdmin: async () => false }))
      .toMatchObject({ ok: false, status: 403 });
    expect(await resolveCheckoutTarget({ db, subscriberId: 'nope', callerUid: 'uid_admin', isAdmin: async () => true }))
      .toMatchObject({ ok: false, status: 404 });
  });

  it('rejeita subscriberId com formato inválido (path do Firestore)', async () => {
    const r = await resolveCheckoutTarget({ db, subscriberId: '../users/abc', callerUid: 'uid_admin', isAdmin: async () => true });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });
});

// ─── Ativação pelo webhook ─────────────────────────────────────────────────────
describe('activateSubscriberFromSession', () => {
  it('Pix com completed ainda "unpaid" (só QR code exibido) não ativa nada', async () => {
    const { db, store } = createFakeDb();
    const r = await activateSubscriberFromSession(session({ payment_status: 'unpaid' }), noSubscriptions, db);
    expect(r).toBe('not_paid');
    expect(store.size).toBe(0);
  });

  it('Pix pago (async_payment_succeeded): grava PIX no assinante e no invoice, sem cartão', async () => {
    const { db, store } = createFakeDb();
    const r = await activateSubscriberFromSession(session(), noSubscriptions, db);
    expect(r).toBe('activated');
    expect(noSubscriptions.subscriptions.retrieve).not.toHaveBeenCalled();

    const sub = store.get('sub_1')!;
    expect(sub).toMatchObject({
      status: 'ACTIVE', paymentStatus: 'PAID', paymentMethod: 'PIX',
      cardBrand: 'PIX', cardLast4: '', transactionId: 'pi_test_abc', checkoutSessionId: 'cs_test_123',
      stripeSubscriptionId: '', paidAmount: 64,
    });
    expect(sub.paymentHistory).toHaveLength(1);
    expect(sub.paymentHistory[0].paymentMethod).toBe('PIX');
    expect(sub.paymentHistory[0].notes).not.toMatch(/••••/);
  });

  it('cartão: continua lendo bandeira/final da assinatura e grava CREDIT_CARD', async () => {
    const { db, store } = createFakeDb();
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({ default_payment_method: { card: { brand: 'visa', last4: '4242' } } }),
      },
    } as any;
    const r = await activateSubscriberFromSession(
      session({ subscription: 'sub_stripe_1', payment_intent: null, metadata: baseMetadata({ paymentMethod: 'CREDIT_CARD' }) }),
      stripe,
      db,
    );
    expect(r).toBe('activated');
    expect(store.get('sub_1')).toMatchObject({
      paymentMethod: 'CREDIT_CARD', cardBrand: 'VISA', cardLast4: '4242',
      transactionId: 'sub_stripe_1', stripeSubscriptionId: 'sub_stripe_1',
    });
    expect(store.get('sub_1')!.paymentHistory[0].notes).toBe('Assinatura via Stripe Checkout (VISA •••• 4242)');
  });

  it('metadata antigo sem paymentMethod é tratado como cartão (sessões criadas antes do deploy)', async () => {
    const { db, store } = createFakeDb();
    const md = baseMetadata();
    delete (md as any).paymentMethod;
    await activateSubscriberFromSession(session({ metadata: md }), noSubscriptions, db);
    expect(store.get('sub_1')!.paymentMethod).toBe('CREDIT_CARD');
  });

  it('reentrega do mesmo evento não duplica histórico nem estende o vencimento de novo', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', usedSessions: 2, paymentHistory: [] } });
    expect(await activateSubscriberFromSession(session(), noSubscriptions, db)).toBe('activated');
    const afterFirst = structuredClone(store.get('sub_1'));

    expect(await activateSubscriberFromSession(session(), noSubscriptions, db)).toBe('already_processed');
    expect(store.get('sub_1')).toEqual(afterFirst);
    expect(store.get('sub_1')!.paymentHistory).toHaveLength(1);
  });

  it('renovação com uma sessão NOVA continua funcionando (não confunde com reentrega)', async () => {
    const { db, store } = createFakeDb();
    await activateSubscriberFromSession(session(), noSubscriptions, db);
    const r = await activateSubscriberFromSession(session({ id: 'cs_test_456', payment_intent: 'pi_test_def' }), noSubscriptions, db);
    expect(r).toBe('activated');
    expect(store.get('sub_1')!.paymentHistory).toHaveLength(2);
  });
});

// ─── CPF ───────────────────────────────────────────────────────────────────────
describe('isValidCpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('recusa o placeholder 000.000.000-00 e dígitos repetidos', () => {
    expect(isValidCpf('000.000.000-00')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('recusa dígito verificador errado, tamanho errado e não-string', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf(undefined)).toBe(false);
  });

  it('formatCpf aplica a máscara progressivamente', () => {
    expect(formatCpf('5299822')).toBe('529.982.2');
    expect(formatCpf('52998224725999')).toBe('529.982.247-25');
  });
});

// ─── Cobrança em dobro: assinatura de cartão já existente ──────────────────────
function fakeStripeSubs(statusById: Record<string, string>) {
  const statuses = { ...statusById };
  return {
    statuses,
    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        if (!(id in statuses)) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing' });
        return { id, status: statuses[id] };
      }),
      cancel: vi.fn(async (id: string) => { statuses[id] = 'canceled'; return { id, status: 'canceled' }; }),
    },
  } as any;
}

describe('decideExistingSubscription', () => {
  it('assinatura ativa/trial bloqueia (renovar agora cobraria duas vezes)', async () => {
    const stripe = fakeStripeSubs({ a: 'active', t: 'trialing' });
    expect(await decideExistingSubscription(stripe, 'a')).toEqual({ action: 'block', status: 'active' });
    expect(await decideExistingSubscription(stripe, 't')).toEqual({ action: 'block', status: 'trialing' });
  });

  it('inadimplente permite e marca para substituir', async () => {
    const stripe = fakeStripeSubs({ p: 'past_due', u: 'unpaid' });
    expect(await decideExistingSubscription(stripe, 'p')).toEqual({ action: 'replace', status: 'past_due' });
    expect(await decideExistingSubscription(stripe, 'u')).toEqual({ action: 'replace', status: 'unpaid' });
  });

  it('cancelada, inexistente ou sem assinatura: nada a fazer', async () => {
    const stripe = fakeStripeSubs({ c: 'canceled' });
    expect(await decideExistingSubscription(stripe, 'c')).toEqual({ action: 'none' });
    expect(await decideExistingSubscription(stripe, 'missing')).toEqual({ action: 'none' });
    expect(await decideExistingSubscription(stripe, '')).toEqual({ action: 'none' });
  });

  it('erro do Stripe (fora "não existe") propaga — na dúvida não abre checkout', async () => {
    const stripe = { subscriptions: { retrieve: vi.fn().mockRejectedValue(new Error('rede')) } } as any;
    await expect(decideExistingSubscription(stripe, 'x')).rejects.toThrow('rede');
  });
});

describe('cancelReplacedSubscription', () => {
  it('cancela uma vez; repetir não chama cancel de novo', async () => {
    const stripe = fakeStripeSubs({ old: 'past_due' });
    expect(await cancelReplacedSubscription(stripe, 'old')).toBe('canceled');
    expect(await cancelReplacedSubscription(stripe, 'old')).toBe('already_canceled');
    expect(await cancelReplacedSubscription(stripe, 'nope')).toBe('missing');
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('isStaleSubscriptionEvent', () => {
  it('ignora eventos de assinatura substituída ou que não é a atual', () => {
    expect(isStaleSubscriptionEvent({ stripeSubscriptionId: '', replacedStripeSubscriptionIds: ['old'] }, 'old')).toBe(true);
    expect(isStaleSubscriptionEvent({ stripeSubscriptionId: 'new' }, 'old')).toBe(true);
  });

  it('não ignora a assinatura atual nem eventos sem assinatura', () => {
    expect(isStaleSubscriptionEvent({ stripeSubscriptionId: 'cur' }, 'cur')).toBe(false);
    expect(isStaleSubscriptionEvent({ stripeSubscriptionId: '' }, 'cur')).toBe(false);
    expect(isStaleSubscriptionEvent({ stripeSubscriptionId: 'cur' }, undefined)).toBe(false);
  });
});

describe('activateSubscriberFromSession — substituição da assinatura inadimplente', () => {
  it('Pix pago cancela o cartão antigo e tira ele do assinante (o deleted seguinte é ignorado)', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', stripeSubscriptionId: 'old', stripeCustomerId: 'cus_old' } });
    const stripe = fakeStripeSubs({ old: 'past_due' });

    const r = await activateSubscriberFromSession(
      session({ metadata: baseMetadata({ replacesSubscriptionId: 'old' }) }), stripe, db,
    );
    expect(r).toBe('activated');
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('old');

    const sub = store.get('sub_1')!;
    expect(sub.stripeSubscriptionId).toBe('');
    expect(sub.replacedStripeSubscriptionIds).toEqual(['old']);
    // customer.subscription.deleted da antiga cai no fallback por customer → é ignorado.
    expect(isStaleSubscriptionEvent(sub, 'old')).toBe(true);
  });

  it('cartão novo substitui o antigo e vira a assinatura atual', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', stripeSubscriptionId: 'old' } });
    const stripe = fakeStripeSubs({ old: 'unpaid', new: 'active' });
    stripe.subscriptions.retrieve.mockImplementationOnce(async () => ({ default_payment_method: { card: { brand: 'visa', last4: '4242' } } }));

    await activateSubscriberFromSession(
      session({ subscription: 'new', payment_intent: null, metadata: baseMetadata({ paymentMethod: 'CREDIT_CARD', replacesSubscriptionId: 'old' }) }),
      stripe, db,
    );
    expect(stripe.statuses.old).toBe('canceled');
    expect(store.get('sub_1')).toMatchObject({ stripeSubscriptionId: 'new', replacedStripeSubscriptionIds: ['old'] });
  });

  it('se o cancelamento falhar, propaga (webhook 500) e a reentrega tenta cancelar de novo', async () => {
    const { db } = createFakeDb({ sub_1: { userUid: 'uid_1', stripeSubscriptionId: 'old' } });
    const stripe = fakeStripeSubs({ old: 'past_due' });
    stripe.subscriptions.cancel.mockRejectedValueOnce(new Error('Stripe fora'));
    const s1 = session({ metadata: baseMetadata({ replacesSubscriptionId: 'old' }) });

    await expect(activateSubscriberFromSession(s1, stripe, db)).rejects.toThrow('Stripe fora');
    expect(await activateSubscriberFromSession(s1, stripe, db)).toBe('already_processed');
    expect(stripe.statuses.old).toBe('canceled');
  });
});

describe('cancelAutoRenewal — trocar cartão por Pix', () => {
  it('cancela no Stripe e marca a assinatura como substituída, sem mexer no acesso pago', async () => {
    const { db, store } = createFakeDb({ sub_1: { stripeSubscriptionId: 'card', status: 'ACTIVE', expirationDate: '2026-11-01' } });
    const stripe = fakeStripeSubs({ card: 'active' });

    expect(await cancelAutoRenewal(stripe, db, 'sub_1')).toBe('canceled');
    expect(stripe.statuses.card).toBe('canceled');
    expect(store.get('sub_1')).toMatchObject({
      stripeSubscriptionId: '', replacedStripeSubscriptionIds: ['card'], status: 'ACTIVE', expirationDate: '2026-11-01',
    });
  });

  it('se o Stripe falhar, desfaz a marcação (senão os pagamentos do cartão seriam ignorados)', async () => {
    const { db, store } = createFakeDb({ sub_1: { stripeSubscriptionId: 'card' } });
    const stripe = fakeStripeSubs({ card: 'active' });
    stripe.subscriptions.cancel.mockRejectedValueOnce(new Error('Stripe fora'));

    await expect(cancelAutoRenewal(stripe, db, 'sub_1')).rejects.toThrow('Stripe fora');
    expect(store.get('sub_1')).toMatchObject({ stripeSubscriptionId: 'card', replacedStripeSubscriptionIds: [] });
  });

  it('sem assinatura de cartão: nada a cancelar', async () => {
    const { db } = createFakeDb({ sub_1: { stripeSubscriptionId: '' } });
    expect(await cancelAutoRenewal(fakeStripeSubs({}), db, 'sub_1')).toBe('nothing_to_cancel');
  });
});

// ─── Ciclo novo: atendimentos zerados e vencimento somado ──────────────────────
describe('activateSubscriberFromSession — ciclo novo (Pix e cartão)', () => {
  afterEach(() => { vi.useRealTimers(); });
  const freezeAt = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

  it('Pix de renovação: 4 de 4 usados → 0, e vencimento daqui a 3 dias → antigo + 30', async () => {
    freezeAt('2026-10-08T15:00:00Z');
    const { db, store } = createFakeDb({
      sub_1: { userUid: 'uid_1', usedSessions: 4, totalSessions: 4, startDate: '2026-09-11', expirationDate: '2026-10-11', paymentHistory: [] },
    });
    expect(await activateSubscriberFromSession(session(), noSubscriptions, db)).toBe('activated');
    expect(store.get('sub_1')).toMatchObject({ usedSessions: 0, expirationDate: '2026-11-10', startDate: '2026-09-11' });
  });

  it('cartão: também zera os atendimentos e soma ao vencimento', async () => {
    freezeAt('2026-10-08T15:00:00Z');
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', usedSessions: 3, expirationDate: '2026-10-01', paymentHistory: [] } });
    const stripe = { subscriptions: { retrieve: vi.fn().mockResolvedValue({ default_payment_method: null }) } } as any;
    await activateSubscriberFromSession(
      session({ subscription: 'sub_stripe_1', payment_intent: null, metadata: baseMetadata({ paymentMethod: 'CREDIT_CARD' }) }),
      stripe, db,
    );
    expect(store.get('sub_1')).toMatchObject({ usedSessions: 0, expirationDate: '2026-11-07', paymentMethod: 'CREDIT_CARD' });
  });

  it('limpa o checkout pendente quando é esta a sessão paga; mantém se for outra', async () => {
    const a = createFakeDb({ sub_1: { userUid: 'uid_1', pendingCheckoutSessionId: 'cs_test_123' } });
    await activateSubscriberFromSession(session(), noSubscriptions, a.db);
    expect(a.store.get('sub_1')!.pendingCheckoutSessionId).toBe('');

    const b = createFakeDb({ sub_1: { userUid: 'uid_1', pendingCheckoutSessionId: 'cs_outro' } });
    await activateSubscriberFromSession(session(), noSubscriptions, b.db);
    expect(b.store.get('sub_1')!.pendingCheckoutSessionId).toBe('cs_outro');
  });
});

describe('renewSubscriberFromInvoice — renovação mensal do cartão (invoice.paid)', () => {
  const invoice = (id = 'in_test_renew_1') => ({ id, amount_paid: 6400 }) as unknown as Stripe.Invoice;
  const NOW = new Date('2026-10-08T15:00:00Z');

  it('zera atendimentos, soma 30 dias ao vencimento e registra a fatura, sem apagar o resto do cadastro', async () => {
    const { db, store } = createFakeDb({
      sub_1: { userUid: 'uid_1', cardCode: 'DB-1234', planName: 'BASIC 4 (4 ATD)', usedSessions: 4, totalSessions: 4, expirationDate: '2026-10-09', status: 'ACTIVE', paymentHistory: [] },
    });
    expect(await renewSubscriberFromInvoice(db, 'sub_1', invoice(), NOW)).toBe('renewed');
    const sub = store.get('sub_1')!;
    expect(sub).toMatchObject({
      usedSessions: 0, expirationDate: '2026-11-08', status: 'ACTIVE', paymentStatus: 'PAID', paymentDate: '2026-10-08',
      cardCode: 'DB-1234', totalSessions: 4, userUid: 'uid_1',
    });
    expect(sub.paymentHistory).toHaveLength(1);
    expect(sub.paymentHistory[0]).toMatchObject({ transactionId: 'in_test_renew_1', paymentMethod: 'CREDIT_CARD', amount: 64 });
  });

  it('reentrega da mesma fatura: already_processed e o cadastro fica idêntico', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', usedSessions: 0, expirationDate: '2026-10-09', paymentHistory: [] } });
    await renewSubscriberFromInvoice(db, 'sub_1', invoice(), NOW);
    store.get('sub_1')!.usedSessions = 2; // check-ins feitos depois da renovação
    const before = structuredClone(store.get('sub_1'));

    expect(await renewSubscriberFromInvoice(db, 'sub_1', invoice(), NOW)).toBe('already_processed');
    expect(store.get('sub_1')).toEqual(before);
  });

  it('fatura nova do mês seguinte renova de novo', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', expirationDate: '2026-10-09', paymentHistory: [] } });
    await renewSubscriberFromInvoice(db, 'sub_1', invoice('in_1'), NOW);
    expect(await renewSubscriberFromInvoice(db, 'sub_1', invoice('in_2'), new Date('2026-11-08T15:00:00Z'))).toBe('renewed');
    expect(store.get('sub_1')).toMatchObject({ expirationDate: '2026-12-08' });
    expect(store.get('sub_1')!.paymentHistory).toHaveLength(2);
  });
});

// ─── Checkout anterior ainda pagável ───────────────────────────────────────────
describe('releasePendingCheckout — libera o checkout anterior antes de abrir outro', () => {
  function fakeStripe(session: any, opts: { expire?: any; cancel?: any; piAfter?: any; sessionAfter?: any } = {}) {
    const retrieve = vi.fn().mockResolvedValueOnce(session).mockResolvedValue(opts.sessionAfter ?? session);
    return {
      checkout: { sessions: { retrieve, expire: opts.expire ?? vi.fn().mockResolvedValue({}) } },
      paymentIntents: {
        cancel: opts.cancel ?? vi.fn().mockResolvedValue({}),
        retrieve: vi.fn().mockResolvedValue(opts.piAfter ?? {}),
      },
    } as any;
  }
  const qrShown = (piStatus = 'requires_action') => ({ status: 'complete', payment_status: 'unpaid', payment_intent: { id: 'pi_1', status: piStatus } });

  it('sem checkout pendente: nada a fazer, sem chamar o Stripe', async () => {
    const stripe = fakeStripe({});
    expect(await releasePendingCheckout(stripe, '')).toBe('none');
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('sessão aberta (QR code ainda não gerado): expira', async () => {
    const stripe = fakeStripe({ status: 'open' });
    expect(await releasePendingCheckout(stripe, 'cs_1')).toBe('released');
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_1');
  });

  it('Pix com QR code exibido e não pago: cancela o PaymentIntent (não prende o cliente)', async () => {
    const stripe = fakeStripe(qrShown());
    expect(await releasePendingCheckout(stripe, 'cs_1')).toBe('released');
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');
  });

  it('já pago (webhook ainda não chegou): paid, nada é cancelado', async () => {
    const paidSession = fakeStripe({ status: 'complete', payment_status: 'paid', payment_intent: null });
    expect(await releasePendingCheckout(paidSession, 'cs_1')).toBe('paid');
    const piSucceeded = fakeStripe(qrShown('succeeded'));
    expect(await releasePendingCheckout(piSucceeded, 'cs_1')).toBe('paid');
    expect(piSucceeded.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('cliente pagou entre a leitura e o cancelamento: paid', async () => {
    const stripe = fakeStripe(qrShown(), {
      cancel: vi.fn().mockRejectedValue(new Error('cannot cancel')),
      piAfter: { id: 'pi_1', status: 'succeeded' },
    });
    expect(await releasePendingCheckout(stripe, 'cs_1')).toBe('paid');
  });

  it('cliente concluiu o checkout entre a leitura e o expire: trata como sessão completa', async () => {
    const paidNow = fakeStripe({ status: 'open' }, {
      expire: vi.fn().mockRejectedValue(new Error('not open')),
      sessionAfter: { status: 'complete', payment_status: 'paid' },
    });
    expect(await releasePendingCheckout(paidNow, 'cs_1')).toBe('paid');

    const qrNow = fakeStripe({ status: 'open' }, { expire: vi.fn().mockRejectedValue(new Error('not open')), sessionAfter: qrShown() });
    expect(await releasePendingCheckout(qrNow, 'cs_1')).toBe('released');
    expect(qrNow.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');
  });

  it('payment_intent nulo: nada pagável a cancelar, sem chamar cancel/retrieve', async () => {
    const stripe = fakeStripe({ status: 'complete', payment_status: 'unpaid', payment_intent: null });
    expect(await releasePendingCheckout(stripe, 'cs_1')).toBe('none');
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('payment_intent só como id (sem expand): busca o PaymentIntent antes de decidir', async () => {
    const pending = fakeStripe({ status: 'complete', payment_status: 'unpaid', payment_intent: 'pi_1' }, {
      piAfter: { id: 'pi_1', status: 'requires_action' },
    });
    expect(await releasePendingCheckout(pending, 'cs_1')).toBe('released');
    expect(pending.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1');
    expect(pending.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');

    const paid = fakeStripe({ status: 'complete', payment_status: 'unpaid', payment_intent: 'pi_1' }, {
      piAfter: { id: 'pi_1', status: 'succeeded' },
    });
    expect(await releasePendingCheckout(paid, 'cs_1')).toBe('paid');
    expect(paid.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('expirada, Pix vencido/cancelado ou inexistente: nada a fazer', async () => {
    expect(await releasePendingCheckout(fakeStripe({ status: 'expired' }), 'cs_1')).toBe('none');
    expect(await releasePendingCheckout(fakeStripe(qrShown('canceled')), 'cs_1')).toBe('none');
    const missing = { checkout: { sessions: { retrieve: vi.fn().mockRejectedValue({ code: 'resource_missing' }) } } } as any;
    expect(await releasePendingCheckout(missing, 'cs_1')).toBe('none');
  });

  it('outros erros do Stripe propagam — na dúvida não abre checkout', async () => {
    const down = { checkout: { sessions: { retrieve: vi.fn().mockRejectedValue(new Error('api down')) } } } as any;
    await expect(releasePendingCheckout(down, 'cs_1')).rejects.toThrow('api down');
    const stillOpen = fakeStripe({ status: 'open' }, { expire: vi.fn().mockRejectedValue(new Error('expire failed')) });
    await expect(releasePendingCheckout(stillOpen, 'cs_1')).rejects.toThrow('expire failed');
  });
});

describe('isSessionRecorded / clearPendingCheckout', () => {
  it('isSessionRecorded: sessão já gravada pelo webhook não conta como pendente', () => {
    expect(isSessionRecorded({ checkoutSessionId: 'cs_1' }, 'cs_1')).toBe(true);
    expect(isSessionRecorded({ paymentHistory: [{ checkoutSessionId: 'cs_1' }] }, 'cs_1')).toBe(true);
    expect(isSessionRecorded({ checkoutSessionId: 'cs_2' }, 'cs_1')).toBe(false);
    expect(isSessionRecorded({}, '')).toBe(false);
  });

  it('limpa só se o marcador ainda apontar para a sessão (Pix vencido / checkout expirado)', async () => {
    const { db, store } = createFakeDb({ sub_1: { pendingCheckoutSessionId: 'cs_1' }, sub_2: { pendingCheckoutSessionId: 'cs_novo' } });
    expect(await clearPendingCheckout(db, 'sub_1', 'cs_1')).toBe(true);
    expect(store.get('sub_1')!.pendingCheckoutSessionId).toBe('');
    // Um checkout novo já substituiu o marcador: o expired da sessão antiga não apaga.
    expect(await clearPendingCheckout(db, 'sub_2', 'cs_1')).toBe(false);
    expect(store.get('sub_2')!.pendingCheckoutSessionId).toBe('cs_novo');
    expect(await clearPendingCheckout(db, 'nao_existe', 'cs_1')).toBe(false);
    expect(await clearPendingCheckout(db, '', 'cs_1')).toBe(false);
  });
});

// ─── Cartão: checkout.session.completed + invoice.paid da primeira fatura ──────
describe('cartão novo — completed e invoice.paid (subscription_create) não somam duas vezes', () => {
  afterEach(() => { vi.useRealTimers(); });
  const freeze = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T15:00:00Z')); };

  const cardStripe = () => ({
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ default_payment_method: { card: { brand: 'visa', last4: '4242' } } }) },
  }) as any;
  const cardSession = () => session({
    id: 'cs_card_1', subscription: 'sub_card_1', customer: 'cus_card_1', payment_intent: null,
    metadata: baseMetadata({ subscriberId: 'stripe_novo', paymentMethod: 'CREDIT_CARD' }),
  });
  const firstInvoice = (billing_reason = 'subscription_create') => ({
    id: 'in_first_1', billing_reason, amount_paid: 6400, subscription: 'sub_card_1', customer: 'cus_card_1',
  }) as unknown as Stripe.Invoice;
  /** Mesmo papel do findSubscriber do webhook: acha pelo stripeSubscriptionId gravado. */
  const finder = (store: Map<string, Record<string, any>>) => vi.fn(async (subId?: string) => {
    for (const [id, data] of store) if (subId && data.stripeSubscriptionId === subId) return { id, data };
    return null;
  });

  it('completed → invoice.paid: vencimento hoje + 30, usedSessions 0, uma única fatura', async () => {
    freeze();
    const { db, store } = createFakeDb();
    expect(await activateSubscriberFromSession(cardSession(), cardStripe(), db)).toBe('activated');
    store.get('stripe_novo')!.usedSessions = 1; // check-in feito antes de o invoice.paid chegar

    const find = finder(store);
    expect((await handleInvoicePaid(firstInvoice(), db, find)).outcome).toBe('skipped_initial');
    expect(find).not.toHaveBeenCalled(); // ignorada antes de qualquer leitura

    const sub = store.get('stripe_novo')!;
    expect(sub).toMatchObject({
      expirationDate: '2026-11-07', usedSessions: 1, status: 'ACTIVE', paymentMethod: 'CREDIT_CARD',
      cardBrand: 'VISA', cardLast4: '4242', stripeSubscriptionId: 'sub_card_1',
    });
    expect(sub.paymentHistory).toHaveLength(1);
  });

  it('invoice.paid chega ANTES do completed: mesmo resultado', async () => {
    freeze();
    const { db, store } = createFakeDb();
    expect((await handleInvoicePaid(firstInvoice(), db, finder(store))).outcome).toBe('skipped_initial');
    expect(store.size).toBe(0);

    await activateSubscriberFromSession(cardSession(), cardStripe(), db);
    expect(store.get('stripe_novo')).toMatchObject({ expirationDate: '2026-11-07', usedSessions: 0 });
    expect(store.get('stripe_novo')!.paymentHistory).toHaveLength(1);
  });

  it('contraprova: sem o subscription_create, a mesma fatura somaria +30 (é o guarda que impede)', async () => {
    freeze();
    const { db, store } = createFakeDb();
    await activateSubscriberFromSession(cardSession(), cardStripe(), db);
    expect((await handleInvoicePaid(firstInvoice('subscription_cycle'), db, finder(store))).outcome).toBe('renewed');
    expect(store.get('stripe_novo')!.expirationDate).toBe('2026-12-07');
  });
});
