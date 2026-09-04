import express from 'express';
import Stripe from 'stripe';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { PLANS_LIST } from './src/data/barberData';

// ─── Inicialização Lazy do Stripe ──────────────────────────────────────────────
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '' || key.includes('sk_live_...') || key.includes('sk_test_...')) return null;
  if (!stripeInstance) {
    try { stripeInstance = new Stripe(key); }
    catch (err) { console.warn('[Stripe] Não foi possível inicializar:', err); return null; }
  }
  return stripeInstance;
}

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

function subscriptionStatusToInvoiceStatus(status: Stripe.Subscription.Status): 'PAID' | 'PENDING' {
  return status === 'active' || status === 'trialing' ? 'PAID' : 'PENDING';
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function createAuthMiddleware(adminAuth: ReturnType<typeof getAdminAuth>) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação obrigatório.' });
      }
      const token = authHeader.slice('Bearer '.length).trim();
      const decoded = await adminAuth.verifyIdToken(token);
      (req as any).firebaseUser = decoded;
      next();
    } catch (err) {
      console.warn('[Stripe Auth] Token inválido:', err instanceof Error ? err.message : err);
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
  };
}

export function registerStripeRoutes(app: express.Application, db: any) {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const publicKey = process.env.VITE_STRIPE_PUBLIC_KEY || '';
  const isStripeConfigured = stripeKey.length > 0 && !stripeKey.includes('sk_live_...') && !stripeKey.includes('sk_test_...');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !isStripeConfigured) {
    console.error('[Stripe] STRIPE_SECRET_KEY não configurada para produção. Checkout bloqueado.');
  }

  console.log('─────────────────────────────────────────────────────────────────');
  console.log('[Stripe Diagnostic] Inicializando Rotas Stripe:');
  console.log(`  - STRIPE_SECRET_KEY: ${stripeKey ? (isStripeConfigured ? `${stripeKey.substring(0, 7)}...` : 'Placeholder/Pendente') : 'NÃO CONFIGURADO'}`);
  console.log(`  - STRIPE_WEBHOOK_SECRET: ${webhookSecret ? (webhookSecret.includes('whsec_...') ? 'Placeholder' : 'Configurado') : 'NÃO CONFIGURADO'}`);
  console.log(`  - VITE_STRIPE_PUBLIC_KEY: ${publicKey ? (publicKey.includes('pk_live_...') ? 'Placeholder' : `${publicKey.substring(0, 7)}...`) : 'NÃO CONFIGURADO'}`);
  console.log(`  - Firestore: ${db ? 'Conectado' : 'Indisponível'}`);
  console.log(`  - Modo: ${isStripeConfigured ? 'PRODUÇÃO' : 'MOCK/DEV'}`);
  console.log('─────────────────────────────────────────────────────────────────');

  // Middleware JSON para rotas comuns do Stripe
  const jsonParser = express.json({ limit: '1mb' });

  // ─── Health Check (público, sem auth) ─────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const stripe = getStripe();
    let stripeStatus = 'unconfigured_mock';
    let stripeDetails: any = { configured: false, mode: 'mock' };

    if (stripe) {
      try {
        await stripe.customers.list({ limit: 1 });
        stripeStatus = 'authenticated';
        stripeDetails = { configured: true, mode: 'live_authenticated' };
      } catch (stripeErr: any) {
        stripeStatus = 'auth_error';
        stripeDetails = { configured: true, mode: 'error', error: stripeErr?.message };
      }
    }

    let firestoreStatus = 'unconfigured';
    if (db) {
      try {
        await getDocs(collection(db, 'subscribers'));
        firestoreStatus = 'authenticated';
      } catch { firestoreStatus = 'connected'; }
    }

    return res.json({
      status: 'ok', timestamp: new Date().toISOString(),
      services: {
        stripe: { status: stripeStatus, ...stripeDetails },
        firestore: { status: firestoreStatus, type: 'Firestore' },
      },
      env: {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Present' : 'Missing',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'Present' : 'Missing',
        VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY ? 'Present' : 'Missing',
      },
    });
  });

  // ─── SetupIntent — Inicialização segura de cartão ─────────────────────────
  app.post('/api/stripe/setup-intent', jsonParser, async (req, res) => {
    try {
      const { clientName, clientCpf, planName } = req.body || {};
      const cleanCpf = typeof clientCpf === 'string' ? clientCpf.replace(/\D/g, '') : '';
      const name = typeof clientName === 'string' && clientName.trim() ? clientName.trim() : 'Cliente Ded Black';
      const stripe = getStripe();

      if (stripe) {
        let stripeCustomerId: string | undefined;

        if (cleanCpf) {
          try {
            const existingCustomers = await stripe.customers.search({ query: `metadata['cpf']:'${cleanCpf}'`, limit: 1 });
            if (existingCustomers.data.length > 0) {
              stripeCustomerId = existingCustomers.data[0].id;
            }
          } catch {
            // Ignora falha de busca por metadata caso a conta seja nova
          }
        }

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            name,
            metadata: { cpf: cleanCpf || 'PENDING', planName: planName || 'DESCONHECIDO' },
          });
          stripeCustomerId = customer.id;
        }

        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          usage: 'off_session',
          metadata: { cpf: cleanCpf, planName: planName || '', clientName: name },
        });

        return res.json({ clientSecret: setupIntent.client_secret, stripeCustomerId });
      }

      if (isProduction) return res.status(503).json({ error: 'Stripe não está configurado para produção.' });

      const mockSecret = `seti_mock_${Date.now().toString(36)}_secret_${Math.random().toString(36).substring(2, 10)}`;
      return res.json({ clientSecret: mockSecret, stripeCustomerId: `cus_mock_${cleanCpf || 'anon'}`, mockMode: true });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar SetupIntent:', err);
      return res.status(500).json({ error: err.message || 'Erro ao inicializar checkout seguro.' });
    }
  });

  // ─── Subscribe — Processamento final da assinatura ───────────────────────
  app.post('/api/stripe/subscribe', jsonParser, async (req, res) => {
    try {
      const { paymentMethodId, clientName, clientCpf, clientPhone, planName, planAmount, subscriberId, cardCode } = req.body || {};

      if (!paymentMethodId || !clientName || !clientCpf || !planAmount) {
        return res.status(400).json({ error: 'Dados obrigatórios ausentes (Método de Pagamento, Nome, CPF ou Valor).' });
      }

      const stripe = getStripe();
      if (isProduction && !stripe) return res.status(503).json({ error: 'Stripe não está configurado para produção.' });

      const cleanCpf = clientCpf.replace(/\D/g, '');
      const amountInCents = Math.round(Number(planAmount) * 100);
      const validPlan = PLANS_LIST.find((p) => p.tierLabel === planName || p.id === planName || p.serviceName === planName);
      if (!validPlan || Math.abs(validPlan.totalPrice - Number(planAmount)) > 0.01) {
        return res.status(400).json({ error: 'Plano ou valor inválido.' });
      }

      let stripeCustomerId = `cus_mock_${cleanCpf || Date.now()}`;
      let stripeSubscriptionId = `sub_mock_${Date.now().toString(36)}`;
      let stripePriceId = `price_mock_${Date.now().toString(36)}`;
      let cardBrand = 'VISA';
      let cardLast4 = '4242';
      let subscriptionStatus: Stripe.Subscription.Status = isProduction ? 'incomplete' : 'active';
      let paymentClientSecret: string | null = null;

      if (stripe) {
        try {
          const existingCustomers = await stripe.customers.search({ query: `metadata['cpf']:'${cleanCpf}'`, limit: 1 });
          if (existingCustomers.data.length > 0) {
            stripeCustomerId = existingCustomers.data[0].id;
            await stripe.customers.update(stripeCustomerId, { invoice_settings: { default_payment_method: paymentMethodId } });
          } else {
            const customer = await stripe.customers.create({ name: clientName, phone: clientPhone || undefined, payment_method: paymentMethodId, invoice_settings: { default_payment_method: paymentMethodId }, metadata: { cpf: cleanCpf, planName, barbershop: 'Ded Black' } });
            stripeCustomerId = customer.id;
          }
        } catch {
          const customer = await stripe.customers.create({ name: clientName, phone: clientPhone || undefined, payment_method: paymentMethodId, invoice_settings: { default_payment_method: paymentMethodId }, metadata: { cpf: cleanCpf, planName, barbershop: 'Ded Black' } });
          stripeCustomerId = customer.id;
        }

        if (paymentMethodId && !paymentMethodId.startsWith('pm_mock')) {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId }).catch(() => {});
        }

        const price = await stripe.prices.create({ unit_amount: amountInCents, currency: 'brl', recurring: { interval: 'month' }, product_data: { name: `Ded Black — ${planName}`, metadata: { barbershop: 'Ded Black' } } });
        stripePriceId = price.id;

        const subscription = await stripe.subscriptions.create({
          customer: stripeCustomerId, items: [{ price: price.id }],
          default_payment_method: paymentMethodId.startsWith('pm_mock') ? undefined : paymentMethodId,
          payment_behavior: 'default_incomplete', payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent', 'default_payment_method'],
          metadata: { cpf: cleanCpf, planName, cardCode: cardCode || '', subscriberId: subscriberId || '', barbershop: 'Ded Black' },
        });
        stripeSubscriptionId = subscription.id;
        subscriptionStatus = subscription.status;

        const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
        const latestPaymentIntent = (latestInvoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | null })?.payment_intent ?? null;
        paymentClientSecret = (latestPaymentIntent?.status === 'requires_payment_method' || latestPaymentIntent?.status === 'requires_action') ? latestPaymentIntent.client_secret : null;

        const pm = subscription.default_payment_method as Stripe.PaymentMethod | null;
        cardBrand = pm?.card?.brand ? pm.card.brand.toUpperCase() : 'VISA';
        cardLast4 = pm?.card?.last4 || '4242';
      }

      const now = new Date();
      const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
      const startDateStr = now.toISOString().split('T')[0];
      const expDateStr = expDate.toISOString().split('T')[0];

      const newInvoice = {
        id: `INV-STRIPE-${Date.now()}`, invoiceCode: `STRIPE-${stripeSubscriptionId.slice(-8).toUpperCase()}`,
        planName, amount: planAmount, paymentMethod: 'CREDIT_CARD' as const,
        paymentDate: now.toLocaleString('pt-BR'), dueDate: startDateStr, period: 'Mensal Recorrente',
        status: subscriptionStatusToInvoiceStatus(subscriptionStatus),
        validationStatus: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'VALIDATED' as const : 'UNDER_REVIEW' as const,
        transactionId: stripeSubscriptionId, notes: `Assinatura Stripe (${cardBrand.toUpperCase()} •••• ${cardLast4})`,
      };

      const targetId = subscriberId || `stripe_${Date.now()}`;
      const subDocRef = doc(db, 'subscribers', targetId);

      try {
        const snap = await getDoc(subDocRef);
        const existing = snap.exists() ? snap.data() : {};
        const history = Array.isArray(existing.paymentHistory) ? existing.paymentHistory : [];
        await setDoc(subDocRef, {
          ...existing, id: targetId,
          cardCode: existing.cardCode || cardCode || `DB-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName, cpf: cleanCpf, phone: clientPhone || existing.phone || '', planName,
          serviceName: existing.serviceName || planName, totalSessions: existing.totalSessions || 4,
          usedSessions: existing.usedSessions || 0, startDate: startDateStr, expirationDate: expDateStr,
          status: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'ACTIVE' : 'PAYMENT_PENDING',
          paymentStatus: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'PAID' : 'PENDING',
          paymentMethod: 'CREDIT_CARD', paymentDate: startDateStr, transactionId: stripeSubscriptionId,
          paidAmount: planAmount, expectedAmount: planAmount, stripeCustomerId, stripeSubscriptionId,
          stripePriceId, cardLast4, cardBrand: cardBrand.toUpperCase(),
          paymentHistory: [newInvoice, ...history], updatedAt: now.toISOString(),
        }, { merge: true });
        console.log(`[Stripe] Assinante ${targetId} ativado — sub: ${stripeSubscriptionId}`);
      } catch (dbErr) { console.error('[Stripe] Erro ao salvar no Firestore:', dbErr); }

      return res.json({
        success: true, subscriptionId: stripeSubscriptionId, paymentClientSecret, subscriptionStatus,
        stripeCustomerId, cardBrand: cardBrand.toUpperCase(), cardLast4,
        status: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? 'ACTIVE' : 'PAYMENT_PENDING',
        expirationDate: expDateStr,
      });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar assinatura:', err);
      return res.status(500).json({ error: err.message || 'Erro ao processar assinatura.' });
    }
  });

  // ─── Webhook Stripe — usa express.raw OBRIGATORIAMENTE ────────────────────
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];

      if (!sig || !STRIPE_WEBHOOK_SECRET) {
        console.warn('[Stripe Webhook] Assinatura ou secret ausente — rejeitando.');
        return res.status(400).json({ error: 'Webhook não autorizado.' });
      }

      const stripe = getStripe();
      if (!stripe) return res.status(400).json({ error: 'Stripe SDK não configurado no servidor.' });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error('[Stripe Webhook] Assinatura inválida:', err.message);
        return res.status(400).json({ error: `Webhook inválido: ${err.message}` });
      }

      console.log(`[Stripe Webhook] Evento: ${event.type}`);

      const findSubscriber = async (subscriptionId?: string, customerId?: string) => {
        try {
          const snap = await getDocs(collection(db, 'subscribers'));
          for (const d of snap.docs) {
            const data = d.data();
            if ((subscriptionId && data.stripeSubscriptionId === subscriptionId) || (customerId && data.stripeCustomerId === customerId)) {
              return { id: d.id, data };
            }
          }
        } catch (e) { console.error('[Stripe Webhook] Erro ao buscar assinante:', e); }
        return null;
      };

      try {
        switch (event.type) {
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
            const subId = typeof subscription === 'string' ? subscription : subscription?.id;
            const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            const match = await findSubscriber(subId || undefined, custId || undefined);
            if (!match) break;

            const now = new Date();
            const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
            const renewalInvoice = {
              id: `INV-STRIPE-RENEW-${Date.now()}`, invoiceCode: `STRIPE-RNW-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
              planName: match.data.planName || 'Assinatura Recorrente', amount: (invoice.amount_paid || 0) / 100,
              paymentMethod: 'CREDIT_CARD' as const, paymentDate: now.toLocaleString('pt-BR'),
              dueDate: now.toISOString().split('T')[0], period: 'Renovação Recorrente',
              status: 'PAID' as const, validationStatus: 'VALIDATED' as const,
              transactionId: invoice.id || `stripe-${Date.now()}`,
              notes: 'Fatura renovada automaticamente via Stripe (invoice.paid)',
            };
            const history = Array.isArray(match.data.paymentHistory) ? match.data.paymentHistory : [];
            await setDoc(doc(db, 'subscribers', match.id), { ...match.data, status: 'ACTIVE', paymentStatus: 'PAID', paymentDate: now.toISOString().split('T')[0], expirationDate: expDate.toISOString().split('T')[0], paymentHistory: [renewalInvoice, ...history], updatedAt: now.toISOString() }, { merge: true });
            console.log(`[Stripe Webhook] invoice.paid — assinante ${match.id} renovado.`);
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
            const subId = typeof subscription === 'string' ? subscription : subscription?.id;
            const custId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
            const match = await findSubscriber(subId || undefined, custId || undefined);
            if (!match) break;

            const failedInvoice = {
              id: `INV-STRIPE-FAIL-${Date.now()}`, invoiceCode: `STRIPE-FAIL-${invoice.id?.slice(-8).toUpperCase() || Date.now()}`,
              planName: match.data.planName || 'Assinatura Recorrente', amount: (invoice.amount_due || 0) / 100,
              paymentMethod: 'CREDIT_CARD' as const, paymentDate: new Date().toLocaleString('pt-BR'),
              period: 'Tentativa de Cobrança', status: 'FAILED' as const, validationStatus: 'EXPIRED' as const,
              transactionId: invoice.id || `stripe-fail-${Date.now()}`,
              notes: 'Falha na cobrança automática via Stripe. Cliente deve atualizar o cartão.',
            };
            const history = Array.isArray(match.data.paymentHistory) ? match.data.paymentHistory : [];
            await setDoc(doc(db, 'subscribers', match.id), { ...match.data, status: 'PAYMENT_PENDING', paymentStatus: 'FAILED', paymentHistory: [failedInvoice, ...history], updatedAt: new Date().toISOString() }, { merge: true });
            console.warn(`[Stripe Webhook] invoice.payment_failed — assinante ${match.id} → PAYMENT_PENDING.`);
            break;
          }

          case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const match = await findSubscriber(sub.id, typeof sub.customer === 'string' ? sub.customer : sub.customer?.id);
            if (!match) break;
            await setDoc(doc(db, 'subscribers', match.id), { status: 'SUSPENDED', updatedAt: new Date().toISOString() }, { merge: true });
            console.log(`[Stripe Webhook] subscription.deleted — assinante ${match.id} suspenso.`);
            break;
          }

          default: break;
        }
      } catch (handlerErr) {
        console.error('[Stripe Webhook] Erro ao processar evento:', handlerErr);
      }

      return res.json({ received: true, event: event.type });
    },
  );
};