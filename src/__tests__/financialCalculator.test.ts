/**
 * Testes de validação da lógica do FinancialCalculator.
 *
 * Cobre o cálculo de percentuais de comissão que foi corrigido
 * para derivar dos dados reais do plano (em vez de hardcode por tier).
 */

import { describe, it, expect } from 'vitest';
import { PLANS_LIST } from '../data/barberData';

// ─── Replica da função de formatação do FinancialCalculator ──────────────────

function fmtPct(n: number): string {
  return n % 1 === 0 ? `${n}%` : `${n.toFixed(1).replace('.', ',')}%`;
}

/**
 * Replica exata do cálculo do FinancialCalculator.tsx:
 *   const commissionRatio = plan.totalBarberCommission / plan.totalPrice;
 *   const barberPctNum = Math.round(commissionRatio * 200) / 2;
 * (ratio é 0..1, não 0..100)
 */
function derivePcts(plan: { totalPrice: number; totalBarberCommission: number }) {
  const ratio = plan.totalPrice > 0 ? plan.totalBarberCommission / plan.totalPrice : 0.55;
  const barberNum = Math.round(ratio * 200) / 2; // arredonda para múltiplo de 0,5
  const houseNum = 100 - barberNum;
  return { barberPct: fmtPct(barberNum), housePct: fmtPct(houseNum), barberNum, houseNum };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('FinancialCalculator — derivação de percentuais por plano', () => {
  it('Family 4 exibe "55%" (não "60%")', () => {
    const family4Plans = PLANS_LIST.filter(
      (p) => p.tier === 'family' && p.numAtendimentos === 4,
    );
    expect(family4Plans.length).toBeGreaterThan(0);
    family4Plans.forEach((plan) => {
      const { barberPct, housePct } = derivePcts(plan);
      expect(barberPct, `'${plan.id}' deve exibir "55%"`).toBe('55%');
      expect(housePct, `'${plan.id}' deve exibir "45%"`).toBe('45%');
    });
  });

  it('Family 8 exibe "60%"', () => {
    const family8Plans = PLANS_LIST.filter(
      (p) => p.tier === 'family' && p.numAtendimentos === 8,
    );
    expect(family8Plans.length).toBeGreaterThan(0);
    family8Plans.forEach((plan) => {
      const { barberPct, housePct } = derivePcts(plan);
      expect(barberPct, `'${plan.id}' deve exibir "60%"`).toBe('60%');
      expect(housePct, `'${plan.id}' deve exibir "40%"`).toBe('40%');
    });
  });

  it('Plus 5 e Plus 6 exibem "57,5%"', () => {
    const plusPlans = PLANS_LIST.filter((p) => p.tier === 'plus');
    expect(plusPlans.length).toBeGreaterThan(0);
    plusPlans.forEach((plan) => {
      const { barberPct, housePct } = derivePcts(plan);
      expect(barberPct, `'${plan.id}' deve exibir "57,5%"`).toBe('57,5%');
      expect(housePct, `'${plan.id}' deve exibir "42,5%"`).toBe('42,5%');
    });
  });

  it('Basic 3 e Basic 4 exibem "55%"', () => {
    const basicPlans = PLANS_LIST.filter((p) => p.tier === 'basic');
    expect(basicPlans.length).toBeGreaterThan(0);
    basicPlans.forEach((plan) => {
      const { barberPct, housePct } = derivePcts(plan);
      expect(barberPct, `'${plan.id}' deve exibir "55%"`).toBe('55%');
      expect(housePct, `'${plan.id}' deve exibir "45%"`).toBe('45%');
    });
  });

  it('Select 10 exibe "60%"', () => {
    const selectPlans = PLANS_LIST.filter((p) => p.tier === 'select');
    expect(selectPlans.length).toBeGreaterThan(0);
    selectPlans.forEach((plan) => {
      const { barberPct, housePct } = derivePcts(plan);
      expect(barberPct, `'${plan.id}' deve exibir "60%"`).toBe('60%');
      expect(housePct, `'${plan.id}' deve exibir "40%"`).toBe('40%');
    });
  });

  it('fmtPct formata inteiros sem casas decimais', () => {
    expect(fmtPct(55)).toBe('55%');
    expect(fmtPct(60)).toBe('60%');
    expect(fmtPct(45)).toBe('45%');
    expect(fmtPct(40)).toBe('40%');
  });

  it('fmtPct formata decimais com vírgula (padrão pt-BR)', () => {
    expect(fmtPct(57.5)).toBe('57,5%');
    expect(fmtPct(42.5)).toBe('42,5%');
  });

  it('soma barberNum + houseNum = 100 para todos os planos', () => {
    PLANS_LIST.forEach((plan) => {
      const { barberNum, houseNum } = derivePcts(plan);
      expect(barberNum + houseNum).toBe(100);
    });
  });
});

// ─── Consistência entre barberData.ts e stripe-routes.ts ─────────────────────

describe('PLANS_LIST — valores críticos de totalPrice', () => {
  // Verifica pontos-chave que diferem do arquivo antigo do stripe-routes.ts

  const cases: [string, number][] = [
    ['cs-basic-3',   52.50],
    ['cs-basic-4',   64.00],
    ['cs-plus-5',    75.00],
    ['cs-plus-6',    87.00],
    ['cs-select-10', 140.00],
    ['cs-family-4',  64.00],
    ['cs-family-8',  112.00],
    ['dm-basic-3',   105.00],
    ['dm-basic-4',   128.00],
    ['dm-plus-5',    150.00],
    ['dm-plus-6',    174.00],
    ['dm-select-10', 280.00],
    ['dm-family-4',  128.00],
    ['dm-family-8',  224.00],
    ['bs-basic-3',   65.62],
    ['bs-select-10', 175.00],
    ['bs-family-4',  80.00],
    ['bs-family-8',  140.00],
    ['bm-select-10', 245.00],
    ['bm-family-4',  112.00],
    ['bm-family-8',  196.00],
    ['st-basic-3',   131.25],
    ['st-select-10', 350.00],
    ['st-family-4',  160.00],
    ['st-family-8',  280.00],
  ];

  cases.forEach(([id, expectedPrice]) => {
    it(`'${id}' totalPrice = R$ ${expectedPrice.toFixed(2)}`, () => {
      const plan = PLANS_LIST.find((p) => p.id === id);
      expect(plan, `Plano '${id}' não encontrado`).toBeDefined();
      expect(plan!.totalPrice).toBe(expectedPrice);
    });
  });
});
