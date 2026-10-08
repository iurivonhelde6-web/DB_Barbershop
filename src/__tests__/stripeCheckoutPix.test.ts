/**
 * Pix no Stripe Checkout + correções de segurança das rotas de pagamento:
 * - Pix vira Checkout Session mode 'payment' (cobrança única de um ciclo), cartão continua 'subscription';
 * - renovação (subscriberId) só pelo dono do cadastro ou admin;
 * - o webhook ativa o assinante uma única vez por sessão, mesmo com reentrega do Stripe;
 * - CPF placeholder/inválido é recusado;
 * - renovar quem já tem assinatura de cartão não gera uma segunda cobrança mensal.
 */

import { describe, it, expect, vi } from 'vitest';
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
