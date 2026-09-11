/**
 * Testes de validação dos dados de planos (barberData.ts)
 *
 * Cobrem:
 * 1. Integridade estrutural — todos os campos obrigatórios presentes
 * 2. Percentuais de comissão corretos por tier/numAtendimentos
 * 3. Consistência aritmética (totalBarberCommission + totalHouseMargin ≈ totalPrice)
 * 4. Derivação de pricePerAtd (totalPrice / numAtendimentos)
 * 5. Valores de defaultCost dos serviços (50% do avulsoPrice)
 */

import { describe, it, expect } from 'vitest';
import { PLANS_LIST, SERVICES_LIST } from '../data/barberData';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Percentual esperado de comissão do barbeiro por tier/atendimentos. */
function expectedCommissionPct(tier: string, numAtendimentos: number): number {
  if (tier === 'basic') return 55;
  if (tier === 'plus') return 57.5;
  if (tier === 'select') return 60;
  if (tier === 'family') return numAtendimentos <= 4 ? 55 : 60; // Family 4 = 55%, Family 8 = 60%
  if (tier === 'flex_premium') return 60;
  return 55;
}

/** Arredonda para 2 casas decimais (evita erro de ponto flutuante). */
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('PLANS_LIST — integridade e aritmética', () => {
  it('deve ter exatamente 43 planos (42 regulares + 1 flex_premium)', () => {
    expect(PLANS_LIST).toHaveLength(43);
  });

  it('todos os planos têm campos obrigatórios preenchidos', () => {
    const required = [
      'id', 'tier', 'tierLabel', 'serviceId', 'serviceName',
      'numAtendimentos', 'totalPrice', 'pricePerAtd', 'costPerAtd',
      'barberSplitPerAtd', 'houseMarginPerAtd',
      'totalBarberCommission', 'totalHouseMargin',
    ] as const;

    PLANS_LIST.forEach((plan) => {
      required.forEach((field) => {
        expect(plan[field], `Campo '${field}' ausente no plano '${plan.id}'`).toBeDefined();
        expect(plan[field], `Campo '${field}' é NaN no plano '${plan.id}'`).not.toBeNaN();
      });
    });
  });

  it('IDs são únicos', () => {
    const ids = PLANS_LIST.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('totalBarberCommission + totalHouseMargin ≈ totalPrice (tolerância R$ 0,50)', () => {
    PLANS_LIST.forEach((plan) => {
      const soma = round2(plan.totalBarberCommission + plan.totalHouseMargin);
      const diff = Math.abs(soma - plan.totalPrice);
      expect(diff, `Soma errada no plano '${plan.id}': ${soma} ≠ ${plan.totalPrice}`).toBeLessThanOrEqual(0.5);
    });
  });

  it('barberSplitPerAtd + houseMarginPerAtd ≈ pricePerAtd (tolerância R$ 0,10)', () => {
    PLANS_LIST.forEach((plan) => {
      const soma = round2((plan.barberSplitPerAtd ?? 0) + (plan.houseMarginPerAtd ?? 0));
      const diff = Math.abs(soma - plan.pricePerAtd);
      expect(diff, `Split por ATD errado no plano '${plan.id}': ${soma} ≠ ${plan.pricePerAtd}`).toBeLessThanOrEqual(0.10);
    });
  });

  it('pricePerAtd ≈ totalPrice / numAtendimentos (tolerância R$ 1,00)', () => {
    PLANS_LIST.forEach((plan) => {
      const expected = round2(plan.totalPrice / plan.numAtendimentos);
      const diff = Math.abs(plan.pricePerAtd - expected);
      expect(diff, `pricePerAtd errado no plano '${plan.id}': ${plan.pricePerAtd} ≠ ${expected}`).toBeLessThanOrEqual(1.0);
    });
  });

  it('percentual de comissão correto por tier/numAtendimentos (tolerância 1%)', () => {
    PLANS_LIST.forEach((plan) => {
      const actualPct = (plan.totalBarberCommission / plan.totalPrice) * 100;
      const expected = expectedCommissionPct(plan.tier, plan.numAtendimentos);
      const diff = Math.abs(actualPct - expected);
      expect(diff, `Comissão errada no plano '${plan.id}': ${actualPct.toFixed(2)}% ≠ ${expected}%`).toBeLessThanOrEqual(1);
    });
  });
});

// ─── Casos críticos específicos ───────────────────────────────────────────────

describe('PLANS_LIST — casos críticos de negócio', () => {
  it('Family 4 tem 55% de comissão (não 60%)', () => {
    const family4Plans = PLANS_LIST.filter(
      (p) => p.tier === 'family' && p.numAtendimentos === 4,
    );
    expect(family4Plans.length).toBeGreaterThan(0);
    family4Plans.forEach((plan) => {
      const pct = (plan.totalBarberCommission / plan.totalPrice) * 100;
      expect(pct, `Family 4 '${plan.id}' deve ter 55%, mas tem ${pct.toFixed(2)}%`).toBeCloseTo(55, 0);
    });
  });

  it('Family 8 tem 60% de comissão', () => {
    const family8Plans = PLANS_LIST.filter(
      (p) => p.tier === 'family' && p.numAtendimentos === 8,
    );
    expect(family8Plans.length).toBeGreaterThan(0);
    family8Plans.forEach((plan) => {
      const pct = (plan.totalBarberCommission / plan.totalPrice) * 100;
      expect(pct, `Family 8 '${plan.id}' deve ter 60%, mas tem ${pct.toFixed(2)}%`).toBeCloseTo(60, 0);
    });
  });

  it('Plus 5 e Plus 6 têm 57,5% de comissão', () => {
    const plusPlans = PLANS_LIST.filter((p) => p.tier === 'plus');
    expect(plusPlans.length).toBeGreaterThan(0);
    plusPlans.forEach((plan) => {
      const pct = (plan.totalBarberCommission / plan.totalPrice) * 100;
      expect(pct, `Plus '${plan.id}' deve ter 57,5%, mas tem ${pct.toFixed(2)}%`).toBeCloseTo(57.5, 0);
    });
  });

  it('Select 10 tem 60% de comissão', () => {
    const selectPlans = PLANS_LIST.filter((p) => p.tier === 'select');
    expect(selectPlans.length).toBeGreaterThan(0);
    selectPlans.forEach((plan) => {
      const pct = (plan.totalBarberCommission / plan.totalPrice) * 100;
      expect(pct, `Select '${plan.id}' deve ter 60%, mas tem ${pct.toFixed(2)}%`).toBeCloseTo(60, 0);
    });
  });

  it('cs-basic-3 tem totalPrice = R$ 52,50', () => {
    const plan = PLANS_LIST.find((p) => p.id === 'cs-basic-3');
    expect(plan).toBeDefined();
    expect(plan!.totalPrice).toBe(52.50);
  });

  it('cs-family-4 tem mesmo totalPrice que cs-basic-4 (R$ 64,00)', () => {
    const basic4 = PLANS_LIST.find((p) => p.id === 'cs-basic-4');
    const family4 = PLANS_LIST.find((p) => p.id === 'cs-family-4');
    expect(basic4).toBeDefined();
    expect(family4).toBeDefined();
    expect(family4!.totalPrice).toBe(basic4!.totalPrice);
  });

  it('cs-select-10 tem totalPrice = R$ 140,00', () => {
    const plan = PLANS_LIST.find((p) => p.id === 'cs-select-10');
    expect(plan).toBeDefined();
    expect(plan!.totalPrice).toBe(140.00);
  });

  it('planos Family têm campo familyMembers definido', () => {
    const familyPlans = PLANS_LIST.filter((p) => p.tier === 'family');
    familyPlans.forEach((plan) => {
      expect(plan.familyMembers, `'${plan.id}' sem familyMembers`).toBeDefined();
      expect(plan.familyMembers).toBeGreaterThan(0);
    });
  });
});

// ─── SERVICES_LIST ────────────────────────────────────────────────────────────

describe('SERVICES_LIST — defaultCost = 50% do avulsoPrice', () => {
  it('todos os serviços têm defaultCost ≈ 50% do avulsoPrice (tolerância R$ 0,01)', () => {
    SERVICES_LIST.forEach((svc) => {
      const expected = round2(svc.avulsoPrice * 0.5);
      const diff = Math.abs(svc.defaultCost - expected);
      expect(diff, `'${svc.name}' defaultCost=${svc.defaultCost} ≠ 50% de ${svc.avulsoPrice}=${expected}`).toBeLessThanOrEqual(0.01);
    });
  });

  it('6 serviços cadastrados', () => {
    expect(SERVICES_LIST).toHaveLength(6);
  });
});
