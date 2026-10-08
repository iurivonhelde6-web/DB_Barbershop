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
  checkoutScope,
  newSubscriberIdFor,
  resolvePendingCheckout,
  createCheckoutSessionOnce,
  CHECKOUT_KEY_WINDOW_MS,
  recordInvoicePaymentFailed,
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

describe('buildCheckoutIdempotencyKey — chave estável por escopo, plano, método e janela', () => {
  const params = { mode: 'payment', metadata: { subscriberId: 'stripe_x' } } as any;
  const base = { scope: 'sub:sub_1', planId: 'cs-basic-4', paymentMethod: 'PIX' as const, params, now: 1_000_000 };

  it('mesmos dados na mesma janela → mesma chave (duplo clique)', () => {
    expect(buildCheckoutIdempotencyKey(base)).toBe(buildCheckoutIdempotencyKey({ ...base, now: 1_000_000 + 5_000 }));
  });

  it('escopo, plano, método ou parâmetros diferentes → chave nova', () => {
    const k = buildCheckoutIdempotencyKey(base);
    expect(buildCheckoutIdempotencyKey({ ...base, scope: 'sub:sub_2' })).not.toBe(k);
    expect(buildCheckoutIdempotencyKey({ ...base, planId: 'cs-basic-3' })).not.toBe(k);
    expect(buildCheckoutIdempotencyKey({ ...base, paymentMethod: 'CREDIT_CARD' })).not.toBe(k);
    expect(buildCheckoutIdempotencyKey({ ...base, params: { ...params, metadata: { subscriberId: 'stripe_x', replacesCheckoutSessionId: 'cs_1' } } })).not.toBe(k);
  });

  it('outra janela de tempo → chave nova', () => {
    expect(buildCheckoutIdempotencyKey({ ...base, now: 1_000_000 + CHECKOUT_KEY_WINDOW_MS })).not.toBe(buildCheckoutIdempotencyKey(base));
  });

  it('cabe no limite de 255 caracteres do Stripe, mesmo com o sufixo de recriação', () => {
    expect(`${buildCheckoutIdempotencyKey(base)}:after:cs_test_${'a'.repeat(58)}`.length).toBeLessThan(255);
  });
});

describe('cadastro novo — sem valor volátil nos parâmetros', () => {
  const args = { callerUid: 'uid_1', cpfDigits: '52998224725', planId: 'cs-basic-4', now: 1_000_000 };

  it('newSubscriberIdFor: mesmo id no duplo clique; muda com quem chama, CPF, plano ou janela', () => {
    const id = newSubscriberIdFor(args);
    expect(newSubscriberIdFor({ ...args, now: 1_000_000 + 3_000 })).toBe(id);
    expect(newSubscriberIdFor({ ...args, callerUid: 'uid_2' })).not.toBe(id);
    expect(newSubscriberIdFor({ ...args, cpfDigits: '11144477735' })).not.toBe(id);
    expect(newSubscriberIdFor({ ...args, planId: 'cs-basic-3' })).not.toBe(id);
    expect(newSubscriberIdFor({ ...args, now: 1_000_000 + CHECKOUT_KEY_WINDOW_MS })).not.toBe(id);
    expect(id).toMatch(/^stripe_[0-9a-f]{24}$/);
    expect(id).not.toContain('52998224725');
  });

  it('checkoutScope: assinante na renovação; quem chama + CPF no cadastro novo', () => {
    expect(checkoutScope({ subscriberId: 'sub_1', callerUid: 'u', cpfDigits: '1' })).toBe('sub:sub_1');
    expect(checkoutScope({ subscriberId: '', callerUid: 'u', cpfDigits: '1' })).toBe('new:u:1');
  });

  it('resolveCheckoutTarget não gera mais id com Date.now() no cadastro novo', async () => {
    const { db } = createFakeDb();
    const r = await resolveCheckoutTarget({ db, subscriberId: undefined, callerUid: 'uid_x', isAdmin: async () => false });
    expect(r).toMatchObject({ ok: true, isRenewal: false, subscriberId: '' });
  });
});

/**
 * Stripe falso com a regra real de idempotência: mesma chave + mesmos parâmetros devolve a
 * resposta original (com Idempotent-Replayed); mesma chave + parâmetros diferentes dá erro.
 */
function idempotentStripe() {
  const byKey = new Map<string, { body: string; session: any }>();
  const sessions = new Map<string, any>();
  let n = 0;
  const withHeaders = (session: any, replayed: boolean) =>
    Object.defineProperty({ ...session }, 'lastResponse', { value: { headers: replayed ? { 'idempotent-replayed': 'true' } : {} } });
  const create = vi.fn(async (params: any, opts: { idempotencyKey: string }) => {
    const body = JSON.stringify(params);
    const hit = byKey.get(opts.idempotencyKey);
    if (hit) {
      if (hit.body !== body) throw Object.assign(new Error('Keys for idempotent requests can only be used with the same parameters'), { type: 'StripeIdempotencyError' });
      return withHeaders(hit.session, true);
    }
    const session = { id: `cs_test_${++n}`, url: `https://checkout.stripe.test/${n}`, status: 'open', created: Math.floor(Date.now() / 1000), metadata: params.metadata };
    sessions.set(session.id, session);
    byKey.set(opts.idempotencyKey, { body, session: { ...session } });
    return withHeaders(session, false);
  });
  const stripe = {
    checkout: {
      sessions: {
        create,
        retrieve: vi.fn(async (id: string) => ({ ...sessions.get(id), payment_intent: null })),
        expire: vi.fn(async (id: string) => { sessions.get(id).status = 'expired'; }),
      },
    },
    paymentIntents: { cancel: vi.fn(), retrieve: vi.fn() },
  } as any;
  return { stripe, sessions, create };
}

describe('createCheckoutSessionOnce — duplo clique devolve a mesma sessão, sem 500', () => {
  const build = (subscriberId: string) => buildCheckoutSessionParams({
    paymentMethod: 'PIX',
    plan: { id: 'cs-basic-4', tierLabel: 'BASIC 4 (4 ATD)', serviceName: 'Corte Simples', totalPrice: 64 } as any,
    metadata: baseMetadata({ subscriberId }),
    origin: 'https://x.test',
  });
  const keyOf = (params: any) => buildCheckoutIdempotencyKey({ scope: 'new:uid_1:52998224725', planId: 'cs-basic-4', paymentMethod: 'PIX', params });

  it('reprodução do bug antigo: mesma chave com subscriberId `stripe_${Date.now()}` diferente → erro do Stripe', async () => {
    const { stripe } = idempotentStripe();
    const p1 = build('stripe_1700000000001');
    const p2 = build('stripe_1700000000002');
    const sameKey = keyOf({ ...p1, metadata: { ...p1.metadata, subscriberId: '' } });
    await stripe.checkout.sessions.create(p1, { idempotencyKey: sameKey });
    await expect(stripe.checkout.sessions.create(p2, { idempotencyKey: sameKey })).rejects.toThrow(/same parameters/);
  });

  it('agora: dois cliques do cadastro novo geram os mesmos parâmetros e a mesma sessão', async () => {
    const { stripe, create } = idempotentStripe();
    const idA = newSubscriberIdFor({ callerUid: 'uid_1', cpfDigits: '52998224725', planId: 'cs-basic-4' });
    const idB = newSubscriberIdFor({ callerUid: 'uid_1', cpfDigits: '52998224725', planId: 'cs-basic-4' });
    const [a, b] = await Promise.all([
      createCheckoutSessionOnce(stripe, build(idA), keyOf(build(idA))),
      createCheckoutSessionOnce(stripe, build(idB), keyOf(build(idB))),
    ]);
    expect('session' in a && 'session' in b).toBe(true);
    expect((a as any).session.id).toBe((b as any).session.id);
    expect(create).toHaveBeenCalledTimes(2); // o segundo é replay, não sessão nova
  });

  it('replay de uma sessão que já expirou: cria outra (o cliente não cai numa sessão morta)', async () => {
    const { stripe, sessions } = idempotentStripe();
    const params = build('stripe_fixo');
    const first = await createCheckoutSessionOnce(stripe, params, keyOf(params));
    sessions.get((first as any).session.id).status = 'expired';

    const again = await createCheckoutSessionOnce(stripe, params, keyOf(params));
    expect((again as any).session.id).not.toBe((first as any).session.id);
    expect((again as any).session.status).toBe('open');
  });

  it('replay de uma sessão já paga: paid (409), sem criar outra cobrança', async () => {
    const { stripe, sessions, create } = idempotentStripe();
    const params = build('stripe_fixo');
    const first = await createCheckoutSessionOnce(stripe, params, keyOf(params));
    Object.assign(sessions.get((first as any).session.id), { status: 'complete', payment_status: 'paid' });

    expect(await createCheckoutSessionOnce(stripe, params, keyOf(params))).toEqual({ paid: true });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe('resolvePendingCheckout — renovação: reaproveita o mesmo pedido, libera o resto (A4)', () => {
  const stripeWith = (session: any) => ({
    checkout: { sessions: { retrieve: vi.fn().mockResolvedValue(session), expire: vi.fn().mockResolvedValue({}) } },
    paymentIntents: { cancel: vi.fn().mockResolvedValue({}), retrieve: vi.fn() },
  }) as any;

  it('sem pendente, ou pendente já gravado pelo webhook: cria sem substituir nada', async () => {
    const stripe = stripeWith({});
    expect(await resolvePendingCheckout(stripe, {}, 'k')).toEqual({ action: 'new', replacesSessionId: '' });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', checkoutSessionId: 'cs_1' }, 'k'))
      .toEqual({ action: 'new', replacesSessionId: '' });
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it('mesmo pedido (mesma chave) e a sessão ainda aberta: devolve a MESMA, sem expirar', async () => {
    const stripe = stripeWith({ id: 'cs_1', status: 'open', url: 'https://checkout.stripe.test/1' });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', pendingCheckoutKey: 'k' }, 'k'))
      .toEqual({ action: 'reuse', sessionId: 'cs_1', url: 'https://checkout.stripe.test/1' });
    expect(stripe.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it('pedido diferente (ex.: trocou Pix → cartão) com a anterior aberta: expira e substitui (A4 prevalece)', async () => {
    const stripe = stripeWith({ id: 'cs_1', status: 'open', url: 'u' });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', pendingCheckoutKey: 'k_pix' }, 'k_card'))
      .toEqual({ action: 'new', replacesSessionId: 'cs_1' });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith('cs_1');
  });

  it('mesmo pedido, mas o QR code já foi exibido: cancela o Pix e cria outro (não reaproveita sessão completa)', async () => {
    const stripe = stripeWith({ id: 'cs_1', status: 'complete', payment_status: 'unpaid', payment_intent: { id: 'pi_1', status: 'requires_action' } });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', pendingCheckoutKey: 'k' }, 'k'))
      .toEqual({ action: 'new', replacesSessionId: 'cs_1' });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_1');
  });

  it('mesmo pedido, sessão expirada (Pix vencido): cria outra com chave nova', async () => {
    const stripe = stripeWith({ id: 'cs_1', status: 'expired' });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', pendingCheckoutKey: 'k' }, 'k'))
      .toEqual({ action: 'new', replacesSessionId: 'cs_1' });
  });

  it('anterior já paga e o webhook ainda não chegou: paid', async () => {
    const stripe = stripeWith({ id: 'cs_1', status: 'complete', payment_status: 'paid' });
    expect(await resolvePendingCheckout(stripe, { pendingCheckoutSessionId: 'cs_1', pendingCheckoutKey: 'k' }, 'k'))
      .toEqual({ action: 'paid' });
  });
});

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

// ─── invoice.payment_failed ────────────────────────────────────────────────────
describe('recordInvoicePaymentFailed — falha de cobrança do cartão', () => {
  const NOW = new Date('2026-10-08T15:00:00Z');
  const failed = (id = 'in_fail_1') => ({ id, amount_due: 6400 }) as unknown as Stripe.Invoice;

  it('grava os mesmos campos de antes: PAYMENT_PENDING/FAILED e uma linha FAILED no histórico', async () => {
    const { db, store } = createFakeDb({
      sub_1: { userUid: 'uid_1', planName: 'BASIC 4 (4 ATD)', status: 'ACTIVE', paymentStatus: 'PAID', usedSessions: 2, expirationDate: '2026-10-09', paymentHistory: [] },
    });
    expect(await recordInvoicePaymentFailed(db, 'sub_1', failed(), NOW)).toBe('recorded');
    const sub = store.get('sub_1')!;
    expect(sub).toMatchObject({ status: 'PAYMENT_PENDING', paymentStatus: 'FAILED', usedSessions: 2, expirationDate: '2026-10-09' });
    expect(sub.paymentHistory).toHaveLength(1);
    expect(sub.paymentHistory[0]).toMatchObject({
      planName: 'BASIC 4 (4 ATD)', amount: 64, paymentMethod: 'CREDIT_CARD', period: 'Tentativa de Cobrança',
      status: 'FAILED', validationStatus: 'EXPIRED', transactionId: 'in_fail_1', invoiceCode: 'STRIPE-FAIL-N_FAIL_1',
    });
  });

  it('reentrega do mesmo evento: already_processed e o cadastro fica idêntico', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', status: 'ACTIVE', paymentHistory: [] } });
    await recordInvoicePaymentFailed(db, 'sub_1', failed(), NOW);
    store.get('sub_1')!.usedSessions = 1; // check-in feito depois
    const before = structuredClone(store.get('sub_1'));

    expect(await recordInvoicePaymentFailed(db, 'sub_1', failed(), NOW)).toBe('already_processed');
    expect(store.get('sub_1')).toEqual(before);
  });

  it('fatura que falhou e depois foi paga na nova tentativa: o invoice.paid renova (a FAILED não bloqueia)', async () => {
    const { db, store } = createFakeDb({ sub_1: { userUid: 'uid_1', status: 'ACTIVE', usedSessions: 4, expirationDate: '2026-10-09', paymentHistory: [] } });
    await recordInvoicePaymentFailed(db, 'sub_1', failed('in_same'), NOW);
    const paid = { id: 'in_same', amount_paid: 6400 } as unknown as Stripe.Invoice;
    expect(await renewSubscriberFromInvoice(db, 'sub_1', paid, NOW)).toBe('renewed');
    expect(store.get('sub_1')).toMatchObject({ status: 'ACTIVE', paymentStatus: 'PAID', usedSessions: 0, expirationDate: '2026-11-08' });
    // E a reentrega desse invoice.paid continua ignorada.
    expect(await renewSubscriberFromInvoice(db, 'sub_1', paid, NOW)).toBe('already_processed');
  });
});
