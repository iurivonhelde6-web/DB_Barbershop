/**
 * Fonte única da divisão barbeiro × barbearia.
 *
 * O percentual NÃO é uma constante por tier: ele é derivado dos valores reais do
 * plano (`totalBarberCommission / totalPrice`), porque tiers iguais têm divisões
 * diferentes — Family 4 fica em 55% e Family 8 em 60%, por exemplo.
 *
 * Tudo que exibe ou paga comissão precisa passar por aqui: o simulador da
 * calculadora, o registro de atendimento e o relatório de repasses. Uma segunda
 * implementação em qualquer um deles faria o relatório real divergir do que o
 * barbeiro viu no simulador.
 */

import { PlanOption } from '../types';

/** Só o que o cálculo precisa, para o módulo ser testável sem montar um plano inteiro. */
export type CommissionPlan = Pick<
  PlanOption,
  'totalPrice' | 'totalBarberCommission' | 'totalHouseMargin' | 'pricePerAtd' | 'barberSplitPerAtd'
>;

/** Divisão padrão usada quando o plano não traz os valores calculados. */
const DEFAULT_BARBER_RATIO = 0.55;

/** Razão da comissão do barbeiro sobre o valor do plano, de 0 a 1. */
export function getBarberCommissionRatio(plan: CommissionPlan): number {
  return plan.totalPrice > 0 ? plan.totalBarberCommission / plan.totalPrice : DEFAULT_BARBER_RATIO;
}

/** Percentual do barbeiro arredondado para o múltiplo de 0,5 mais próximo (ex.: 57.5). */
export function getBarberPercentage(plan: CommissionPlan): number {
  return Math.round(getBarberCommissionRatio(plan) * 200) / 2;
}

/** Percentual da barbearia, complementar ao do barbeiro. */
export function getHousePercentage(plan: CommissionPlan): number {
  return 100 - getBarberPercentage(plan);
}

/** Formata percentual no padrão pt-BR: 55 → "55%", 57.5 → "57,5%". */
export function formatPercentage(value: number): string {
  return value % 1 === 0 ? `${value}%` : `${value.toFixed(1).replace('.', ',')}%`;
}

/** Comissão do barbeiro no ciclo inteiro do plano. */
export function getTotalBarberCommission(plan: CommissionPlan): number {
  return plan.totalBarberCommission || plan.totalPrice * DEFAULT_BARBER_RATIO;
}

/** Margem da barbearia no ciclo inteiro do plano. */
export function getTotalHouseMargin(plan: CommissionPlan): number {
  return plan.totalHouseMargin || plan.totalPrice * (1 - DEFAULT_BARBER_RATIO);
}

/** Valor de UM atendimento dentro do plano — a base do repasse por check-in. */
export function getAttendanceValue(plan: CommissionPlan): number {
  return plan.pricePerAtd;
}

/**
 * Comissão do barbeiro por UM atendimento.
 *
 * Prefere `barberSplitPerAtd`, que é o valor oficial já rateado na tabela de planos;
 * o cálculo por razão é só o fallback para planos que não o tragam.
 */
export function getBarberCommissionPerAttendance(plan: CommissionPlan): number {
  if (typeof plan.barberSplitPerAtd === 'number') return plan.barberSplitPerAtd;
  return plan.pricePerAtd * getBarberCommissionRatio(plan);
}
