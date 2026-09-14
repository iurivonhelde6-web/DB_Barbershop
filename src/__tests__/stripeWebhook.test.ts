/**
 * Testa o portão que decide quais eventos de webhook do Stripe podem ativar
 * ou renovar uma assinatura no Firestore.
 *
 * A migração para o Stripe Checkout removeu toda ativação de assinatura feita
 * a partir do frontend ou logo após a criação da checkout session — a única
 * fonte de verdade agora é o webhook, depois que o Stripe confirma o pagamento
 * (checkout.session.completed para a ativação inicial, invoice.paid para
 * renovações). Este teste garante que esse contrato não regrida silenciosamente.
 */

import { describe, it, expect } from 'vitest';
import { isPaymentConfirmationEvent } from '../../stripe-routes';

describe('isPaymentConfirmationEvent — portão de ativação de assinatura', () => {
  it('permite checkout.session.completed (ativação inicial via Stripe Checkout)', () => {
    expect(isPaymentConfirmationEvent('checkout.session.completed')).toBe(true);
  });

  it('permite invoice.paid (renovação recorrente)', () => {
    expect(isPaymentConfirmationEvent('invoice.paid')).toBe(true);
  });

  it('rejeita a criação da sessão de checkout como evento de ativação', () => {
    // Nenhum evento existe para "sessão criada" — reforça que criar a sessão
    // de checkout nunca deve, por si só, marcar a assinatura como paga.
    expect(isPaymentConfirmationEvent('checkout.session.created' as any)).toBe(false);
  });

  it('rejeita eventos que não confirmam pagamento', () => {
    expect(isPaymentConfirmationEvent('customer.subscription.created')).toBe(false);
    expect(isPaymentConfirmationEvent('customer.subscription.updated')).toBe(false);
    expect(isPaymentConfirmationEvent('invoice.payment_failed')).toBe(false);
    expect(isPaymentConfirmationEvent('payment_intent.succeeded')).toBe(false);
  });
});
