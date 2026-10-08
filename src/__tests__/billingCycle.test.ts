/**
 * Ciclo de 30 dias: cada ciclo pago zera os atendimentos e soma 30 dias ao que for mais
 * tarde entre o vencimento atual e hoje (no fuso de São Paulo); a renovação manual só é
 * liberada nos RENEWAL_WINDOW_DAYS antes do vencimento.
 */

import { describe, it, expect } from 'vitest';
import {
  RENEWAL_WINDOW_DAYS,
  formatDateBr,
  isCycleAlreadyPaid,
  newCycleFields,
  renewalOpensOn,
  todayInSaoPaulo,
} from '../lib/billingCycle';

const NOW = new Date('2026-10-08T15:00:00Z'); // 12:00 em São Paulo

describe('todayInSaoPaulo', () => {
  it('usa o dia de São Paulo, não o de UTC, perto da meia-noite', () => {
    expect(todayInSaoPaulo(new Date('2026-10-09T02:30:00Z'))).toBe('2026-10-08'); // 23:30 em SP
    expect(todayInSaoPaulo(new Date('2026-10-09T03:30:00Z'))).toBe('2026-10-09'); // 00:30 em SP
  });
});

describe('newCycleFields', () => {
  it('sempre zera os atendimentos usados', () => {
    expect(newCycleFields('2026-10-11', NOW).usedSessions).toBe(0);
    expect(newCycleFields(undefined, NOW).usedSessions).toBe(0);
  });

  it('vencimento já passou ou é hoje: hoje + 30', () => {
    expect(newCycleFields('2026-09-30', NOW).expirationDate).toBe('2026-11-07');
    expect(newCycleFields('2026-10-08', NOW).expirationDate).toBe('2026-11-07');
  });

  it('renovação antecipada: vencimento atual + 30, sem perder os dias restantes', () => {
    expect(newCycleFields('2026-10-11', NOW).expirationDate).toBe('2026-11-10');
  });

  it('vencimento ausente ou inválido: hoje + 30', () => {
    expect(newCycleFields(undefined, NOW).expirationDate).toBe('2026-11-07');
    expect(newCycleFields('', NOW).expirationDate).toBe('2026-11-07');
    expect(newCycleFields('11/10/2026', NOW).expirationDate).toBe('2026-11-07');
    expect(newCycleFields('2026-99-99', NOW).expirationDate).toBe('2026-11-07');
  });

  it('23:30 em São Paulo ainda conta como o mesmo dia (em UTC já seria o seguinte)', () => {
    expect(newCycleFields('2026-10-01', new Date('2026-10-09T02:30:00Z')).expirationDate).toBe('2026-11-07');
  });
});

describe('isCycleAlreadyPaid / renewalOpensOn', () => {
  const paid = (expirationDate: string) => ({ status: 'ACTIVE', paymentStatus: 'PAID', expirationDate });

  it(`janela de ${RENEWAL_WINDOW_DAYS} dias: libera a partir de 7 dias antes do vencimento`, () => {
    expect(RENEWAL_WINDOW_DAYS).toBe(7);
    expect(renewalOpensOn('2026-10-16')).toBe('2026-10-09');
    expect(isCycleAlreadyPaid(paid('2026-10-16'), NOW)).toBe(true);  // libera só amanhã
    expect(isCycleAlreadyPaid(paid('2026-10-15'), NOW)).toBe(false); // libera hoje
    expect(isCycleAlreadyPaid(paid('2026-11-07'), NOW)).toBe(true);
  });

  it('vencido, sem vencimento, não pago ou não ativo: libera', () => {
    expect(isCycleAlreadyPaid(paid('2026-10-01'), NOW)).toBe(false);
    expect(isCycleAlreadyPaid(paid(''), NOW)).toBe(false);
    expect(isCycleAlreadyPaid({ ...paid('2026-11-07'), paymentStatus: 'PENDING' }, NOW)).toBe(false);
    expect(isCycleAlreadyPaid({ ...paid('2026-11-07'), status: 'SUSPENDED' }, NOW)).toBe(false);
    expect(isCycleAlreadyPaid(null, NOW)).toBe(false);
  });

  it('formatDateBr', () => {
    expect(formatDateBr('2026-11-07')).toBe('07/11/2026');
  });
});
