/**
 * Limites de período do filtro administrativo.
 *
 * "Esta Semana" define o fechamento do repasse semanal, então a borda de domingo
 * importa: domingo pertence à semana que começou na segunda anterior, e não à que
 * está prestes a começar. Errar isso jogaria os atendimentos de domingo para o
 * repasse da semana seguinte.
 */

import { describe, it, expect } from 'vitest';
import { isDateInRange, parseDateString, resolveDateRange } from '../utils/dateRange';

const at = (iso: string) => new Date(iso);

describe('resolveDateRange — Esta Semana (segunda a domingo)', () => {
  it('numa quarta, abre na segunda e fecha no domingo seguinte', () => {
    // quarta-feira, 16/09/2026
    const { rangeStart, rangeEnd } = resolveDateRange('THIS_WEEK', undefined, undefined, at('2026-09-16T15:00:00'));
    expect(rangeStart!.getDate()).toBe(14); // segunda
    expect(rangeEnd!.getDate()).toBe(20);   // domingo
    expect(rangeStart!.getHours()).toBe(0);
    expect(rangeEnd!.getHours()).toBe(23);
  });

  it('no domingo, ainda pertence à semana que começou na segunda anterior', () => {
    // domingo, 20/09/2026
    const { rangeStart, rangeEnd } = resolveDateRange('THIS_WEEK', undefined, undefined, at('2026-09-20T10:00:00'));
    expect(rangeStart!.getDate()).toBe(14);
    expect(rangeEnd!.getDate()).toBe(20);
  });

  it('na segunda, a semana começa no próprio dia', () => {
    const { rangeStart, rangeEnd } = resolveDateRange('THIS_WEEK', undefined, undefined, at('2026-09-14T08:00:00'));
    expect(rangeStart!.getDate()).toBe(14);
    expect(rangeEnd!.getDate()).toBe(20);
  });
});

describe('resolveDateRange — demais presets', () => {
  it('ALL não impõe limites', () => {
    const r = resolveDateRange('ALL');
    expect(r.rangeStart).toBeNull();
    expect(r.rangeEnd).toBeNull();
  });

  it('TODAY cobre o dia inteiro', () => {
    const { rangeStart, rangeEnd } = resolveDateRange('TODAY', undefined, undefined, at('2026-09-16T15:00:00'));
    expect(rangeStart!.getDate()).toBe(16);
    expect(rangeEnd!.getDate()).toBe(16);
    expect(rangeEnd!.getHours()).toBe(23);
  });

  it('THIS_MONTH vai do dia 1 ao último dia do mês', () => {
    const { rangeStart, rangeEnd } = resolveDateRange('THIS_MONTH', undefined, undefined, at('2026-09-16T12:00:00'));
    expect(rangeStart!.getDate()).toBe(1);
    expect(rangeEnd!.getDate()).toBe(30); // setembro
  });

  it('CUSTOM respeita as datas informadas', () => {
    const { rangeStart, rangeEnd } = resolveDateRange('CUSTOM', '2026-09-01', '2026-09-10');
    expect(rangeStart!.getDate()).toBe(1);
    expect(rangeEnd!.getDate()).toBe(10);
  });
});

describe('parseDateString', () => {
  it('entende YYYY-MM-DD, DD/MM/YYYY e ISO', () => {
    expect(parseDateString('2026-09-16')!.getDate()).toBe(16);
    expect(parseDateString('16/09/2026')!.getDate()).toBe(16);
    expect(parseDateString('2026-09-16T18:30:00.000Z')!.getMonth()).toBe(8);
  });

  it('devolve null para vazio ou inválido', () => {
    expect(parseDateString('')).toBeNull();
    expect(parseDateString(null)).toBeNull();
    expect(parseDateString(undefined)).toBeNull();
    expect(parseDateString('não é data')).toBeNull();
  });
});

describe('isDateInRange', () => {
  const semana = resolveDateRange('THIS_WEEK', undefined, undefined, at('2026-09-16T12:00:00'));

  it('inclui data dentro do período e exclui fora', () => {
    expect(isDateInRange('2026-09-16', semana)).toBe(true);
    expect(isDateInRange('2026-09-14', semana)).toBe(true);
    expect(isDateInRange('2026-09-20', semana)).toBe(true);
    expect(isDateInRange('2026-09-13', semana)).toBe(false);
    expect(isDateInRange('2026-09-21', semana)).toBe(false);
  });

  it('sem período definido, aceita tudo', () => {
    expect(isDateInRange('2020-01-01', resolveDateRange('ALL'))).toBe(true);
  });

  it('data ilegível não é escondida do relatório', () => {
    expect(isDateInRange('data quebrada', semana)).toBe(true);
    expect(isDateInRange(undefined, semana)).toBe(true);
  });
});
