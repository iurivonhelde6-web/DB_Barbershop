/**
 * Base de cálculo do repasse por atendimento.
 *
 * O relatório de repasses paga `barberSplitPerAtd` a cada check-in, então esses
 * valores precisam fechar com o `totalBarberCommission` do plano — se a tabela
 * for editada de forma inconsistente, o repasse passaria a pagar a mais (ou a
 * menos) sem nenhum sinal na tela.
 */

import { describe, it, expect } from 'vitest';
import { PLANS_LIST } from '../data/barberData';
import {
  getAttendanceValue,
  getBarberCommissionPerAttendance,
  getBarberCommissionRatio,
  getTotalBarberCommission,
  getTotalHouseMargin,
} from '../utils/commission';

describe('Comissão por atendimento', () => {
  it('usa o valor oficial já rateado na tabela de planos', () => {
    const basic3 = PLANS_LIST.find((p) => p.id === 'cs-basic-3')!;
    expect(getAttendanceValue(basic3)).toBe(17.67);
    expect(getBarberCommissionPerAttendance(basic3)).toBe(9.72);
  });

  it('a soma das comissões por atendimento fecha com o total do plano', () => {
    PLANS_LIST.forEach((plan) => {
      const somaDoCiclo = getBarberCommissionPerAttendance(plan) * plan.numAtendimentos;
      // tolerância de 1 centavo por atendimento, do arredondamento do rateio
      expect(
        Math.abs(somaDoCiclo - getTotalBarberCommission(plan)),
        `'${plan.id}': ${somaDoCiclo.toFixed(2)} por atendimento vs ${plan.totalBarberCommission.toFixed(2)} no ciclo`,
      ).toBeLessThanOrEqual(0.06);
    });
  });

  it('comissão do barbeiro nunca excede o valor do atendimento', () => {
    PLANS_LIST.forEach((plan) => {
      expect(
        getBarberCommissionPerAttendance(plan),
        `'${plan.id}' repassaria mais do que o atendimento vale`,
      ).toBeLessThanOrEqual(getAttendanceValue(plan));
    });
  });

  it('cai para o rateio por razão quando o plano não traz barberSplitPerAtd', () => {
    const semRateio = { totalPrice: 100, totalBarberCommission: 60, totalHouseMargin: 40, pricePerAtd: 25 };
    expect(getBarberCommissionPerAttendance(semRateio)).toBeCloseTo(15, 5);
  });
});

describe('Divisão do ciclo completo', () => {
  it('comissão e margem somam o preço do plano', () => {
    PLANS_LIST.forEach((plan) => {
      const soma = getTotalBarberCommission(plan) + getTotalHouseMargin(plan);
      expect(Math.abs(soma - plan.totalPrice), `'${plan.id}'`).toBeLessThanOrEqual(0.02);
    });
  });

  // Os dois fallbacks têm gatilhos diferentes, herdados do código original:
  // a razão só recua para 55% quando não há preço; os totais recuam quando o
  // próprio valor calculado está ausente.
  it('a razão recua para 55% apenas quando o plano não tem preço', () => {
    const semPreco = { totalPrice: 0, totalBarberCommission: 0, totalHouseMargin: 0, pricePerAtd: 0 };
    expect(getBarberCommissionRatio(semPreco)).toBe(0.55);

    const comPreco = { totalPrice: 200, totalBarberCommission: 0, totalHouseMargin: 0, pricePerAtd: 50 };
    expect(getBarberCommissionRatio(comPreco)).toBe(0);
  });

  it('os totais recuam para a divisão 55/45 quando não vêm calculados', () => {
    const vazio = { totalPrice: 200, totalBarberCommission: 0, totalHouseMargin: 0, pricePerAtd: 50 };
    expect(getTotalBarberCommission(vazio)).toBeCloseTo(110, 5);
    expect(getTotalHouseMargin(vazio)).toBeCloseTo(90, 5);
  });
});
