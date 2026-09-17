/**
 * Montagem do registro de atendimento — o que vira repasse no fim da semana.
 */

import { describe, it, expect } from 'vitest';
import { PLANS_LIST } from '../data/barberData';
import { buildAttendanceRecord, findSubscriberPlan } from '../utils/attendance';
import { SubscriberCard } from '../types';

const barbeiro = { id: 'barber-02', name: 'Ismael' };

const assinante = (over: Partial<SubscriberCard> = {}): SubscriberCard => ({
  id: 'sub-1', cardCode: 'DB-1234', clientName: 'Cliente Teste', cpf: '00000000000',
  phone: '21900000000', planName: 'BASIC 3 (3 ATD)', serviceName: 'Corte Simples',
  totalSessions: 3, usedSessions: 0, startDate: '2026-09-01', expirationDate: '2026-10-01',
  status: 'ACTIVE', qrCodeValue: '', paymentStatus: 'PAID', userUid: 'uid-cliente',
  ...over,
});

describe('findSubscriberPlan', () => {
  it('exige plano E serviço — o rótulo sozinho é ambíguo', () => {
    // "BASIC 3 (3 ATD)" existe para vários serviços com preços diferentes
    const corte = findSubscriberPlan(PLANS_LIST, 'BASIC 3 (3 ATD)', 'Corte Simples');
    const barba = findSubscriberPlan(PLANS_LIST, 'BASIC 3 (3 ATD)', 'Barba Simples');
    expect(corte!.id).toBe('cs-basic-3');
    expect(barba!.id).toBe('bs-basic-3');
    expect(corte!.pricePerAtd).not.toBe(barba!.pricePerAtd);
  });

  it('devolve undefined quando o plano não existe na tabela', () => {
    expect(findSubscriberPlan(PLANS_LIST, 'PLANO INEXISTENTE', 'Nada')).toBeUndefined();
  });
});

describe('buildAttendanceRecord', () => {
  const now = new Date(2026, 8, 17, 14, 5); // 17/09/2026 14:05 local

  it('congela valor e comissão do plano no momento do check-in', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante(), barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.attendanceValue).toBe(17.5);   // pricePerAtd do cs-basic-3
    expect(rec.barberCommission).toBe(9.63);  // barberSplitPerAtd
    expect(rec.commissionPercentage).toBe(55);
    expect(rec.derivedValues).toBe(false);
  });

  it('identifica barbeiro, cliente e quem registrou', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante(), barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.barberId).toBe('barber-02');
    expect(rec.barberName).toBe('Ismael');
    expect(rec.subscriberId).toBe('sub-1');
    expect(rec.clientName).toBe('Cliente Teste');
    expect(rec.userUid).toBe('uid-cliente');
    expect(rec.registeredBy).toBe('uid-admin');
  });

  it('usa data e hora locais, não UTC — o repasse fecha pelo dia do balcão', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante(), barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.date).toBe('2026-09-17');
    expect(rec.time).toBe('14:05');
  });

  it('cobra o valor do serviço certo quando o rótulo do plano se repete', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante({ serviceName: 'Barba Simples' }),
      barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.attendanceValue).toBe(21.87); // bs-basic-3, não cs-basic-3
  });

  it('rateia o valor pago quando o plano saiu da tabela, marcando como derivado', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante({ planName: 'PLANO ANTIGO', serviceName: 'Descontinuado', paidAmount: 120, totalSessions: 4 }),
      barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.derivedValues).toBe(true);
    expect(rec.attendanceValue).toBe(30);   // 120 / 4
    expect(rec.barberCommission).toBe(16.5); // 55%
  });

  it('não quebra se o assinante não tiver valor pago registrado', () => {
    const rec = buildAttendanceRecord({
      subscriber: assinante({ planName: 'X', serviceName: 'Y', paidAmount: undefined, expectedAmount: undefined, totalSessions: 0 }),
      barber: barbeiro, plans: PLANS_LIST, registeredBy: 'uid-admin', now,
    });
    expect(rec.attendanceValue).toBe(0);
    expect(rec.barberCommission).toBe(0);
  });
});
