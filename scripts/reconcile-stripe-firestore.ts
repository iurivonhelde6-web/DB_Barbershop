/**
 * Concilia pagamentos aprovados no Stripe com as assinaturas gravadas no Firestore.
 *
 * Rede de segurança contra o cenário de 16/09/2026: pagamentos aprovados de verdade
 * (dinheiro debitado) que nunca viraram assinatura porque o webhook não foi entregue
 * — endpoint ainda não existia / URL errada / deploy fora do ar.
 *
 * É SOMENTE LEITURA: nunca grava no Firestore nem no Stripe. Para cada pagamento órfão
 * ele imprime o comando de reenvio do evento, que refaz a ativação pelo caminho normal
 * do webhook (sem digitar dado de pagamento na mão).
 *
 * Uso:
 *   npm run reconcile                # últimos 7 dias
 *   npm run reconcile -- --days=30   # janela maior
 */
import 'dotenv/config';
import Stripe from 'stripe';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function buildCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return cert(JSON.parse(raw));
    } catch (err) {
      console.error('[reconcile] FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido:', err);
      process.exit(1);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  console.error('[reconcile] Nenhuma credencial do Firebase encontrada (FIREBASE_SERVICE_ACCOUNT_JSON).');
  process.exit(1);
}

const brt = (unix: number) =>
  new Date(unix * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

async function main() {
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? Number(daysArg.split('=')[1]) : 7;
  if (!Number.isFinite(days) || days <= 0) {
    console.error('[reconcile] --days deve ser um número positivo.');
    process.exit(1);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[reconcile] STRIPE_SECRET_KEY não configurada.');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: buildCredential() });
  const db = getFirestore(app);

  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // Índice do que o Firestore já conhece, por qualquer identificador vindo do Stripe.
  const knownIds = new Set<string>();
  const snap = await db.collection('subscribers').get();
  snap.forEach((doc) => {
    const data = doc.data();
    for (const id of [data.stripeSubscriptionId, data.checkoutSessionId, data.transactionId, data.stripeCustomerId]) {
      if (typeof id === 'string' && id) knownIds.add(id);
    }
  });

  const sessions = await stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 });
  const paidSessions = sessions.data.filter((s) => s.payment_status === 'paid');

  // Clientes com estorno no período: uma cobrança devolvida não é pendência de
  // provisionamento, é uma decisão de negócio já tomada.
  const refunds = await stripe.refunds.list({ created: { gte: since }, limit: 100 });
  const refundedCustomers = new Set(
    refunds.data
      .filter((r) => r.status === 'succeeded' && typeof r.customer === 'string')
      .map((r) => r.customer as string),
  );

  const orphans: { session: Stripe.Checkout.Session; subscriptionId?: string }[] = [];
  const resolved: { session: Stripe.Checkout.Session; reason: string }[] = [];

  for (const session of paidSessions) {
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const reconciled =
      knownIds.has(session.id) || (subscriptionId ? knownIds.has(subscriptionId) : false);
    if (reconciled) continue;

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId).catch(() => null)
      : null;

    // Sem assinatura no Firestore E sem cobrança/assinatura ativa no Stripe: nada a fazer.
    if (customerId && refundedCustomers.has(customerId)) {
      resolved.push({ session, reason: 'pagamento estornado' });
      continue;
    }
    if (subscription?.status === 'canceled') {
      resolved.push({ session, reason: 'assinatura cancelada no Stripe' });
      continue;
    }

    orphans.push({ session, subscriptionId });
  }

  console.log('─'.repeat(72));
  console.log(`Conciliação Stripe × Firestore — últimos ${days} dias`);
  console.log(`  sessões de checkout pagas no Stripe: ${paidSessions.length}`);
  console.log(`  documentos em subscribers:           ${snap.size}`);
  console.log(`  estornadas/canceladas (ignoradas):   ${resolved.length}`);
  console.log(`  pagamentos SEM assinatura:           ${orphans.length}`);
  console.log('─'.repeat(72));

  for (const { session, reason } of resolved) {
    console.log(
      `· ${brl(session.amount_total || 0)} — ${session.customer_details?.email || '(sem e-mail)'} — ${reason}, nada a fazer`,
    );
  }

  if (orphans.length === 0) {
    console.log('\n✓ Nenhum pagamento órfão. Stripe e Firestore estão conciliados.');
    return;
  }

  // O evento checkout.session.completed é o que ativa a assinatura; reenviá-lo refaz
  // a ativação pelo caminho normal, com os IDs reais do Stripe.
  const events = await stripe.events.list({
    created: { gte: since },
    types: ['checkout.session.completed'],
    limit: 100,
  });
  const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });

  for (const { session, subscriptionId } of orphans) {
    const event = events.data.find((e) => (e.data.object as Stripe.Checkout.Session).id === session.id);
    console.log(`\n⚠ ${brl(session.amount_total || 0)} — ${session.customer_details?.email || '(sem e-mail)'}`);
    console.log(`   pago em:       ${brt(session.created)} (BRT)`);
    console.log(`   cliente:       ${session.metadata?.clientName || session.customer_details?.name || '(sem nome)'}`);
    console.log(`   plano:         ${session.metadata?.planName || '?'} — ${session.metadata?.serviceName || '?'}`);
    console.log(`   session:       ${session.id}`);
    console.log(`   subscription:  ${subscriptionId || '(sem)'}`);
    console.log(`   evento:        ${event?.id || '(não encontrado — janela de retenção do Stripe é de 30 dias)'}`);
    if (event) {
      const target = endpoints.data[0]?.id;
      console.log(`   corrigir com:  stripe events resend ${event.id}${target ? ` --webhook-endpoint=${target}` : ''}`);
      console.log('                  (ou Dashboard → Developers → Events → o evento → Resend)');
    }
  }

  console.log(
    '\nReenviar o evento é o caminho seguro: a assinatura é criada pelo mesmo handler de\n' +
      'webhook de um pagamento normal, com os IDs reais do Stripe — nada digitado à mão.',
  );
}

main().catch((err) => {
  console.error('[reconcile] Falha:', err);
  process.exit(1);
});
