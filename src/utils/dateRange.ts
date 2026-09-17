/**
 * Filtro de período compartilhado entre as telas administrativas.
 *
 * Extraído do AdminDashboard para que o relatório de repasses use exatamente os
 * mesmos limites de período — em especial "Esta Semana", que vai de segunda a
 * domingo e define o fechamento do repasse semanal.
 */

export type DatePreset =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

export interface DateRange {
  rangeStart: Date | null;
  rangeEnd: Date | null;
}

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'ALL', label: 'Todos os Períodos' },
  { id: 'TODAY', label: 'Hoje' },
  { id: 'THIS_WEEK', label: 'Esta Semana' },
  { id: 'THIS_MONTH', label: 'Mês Atual' },
  { id: 'LAST_30_DAYS', label: 'Últimos 30 Dias' },
  { id: 'LAST_90_DAYS', label: 'Últimos 90 Dias' },
  { id: 'CUSTOM', label: 'Personalizado' },
];

/** Aceita os três formatos que circulam no banco: YYYY-MM-DD, DD/MM/YYYY e ISO. */
export function parseDateString(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  if (str.includes('-')) {
    const cleanStr = str.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const dy = parseInt(parts[2], 10);
      if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
        return new Date(yr, mo, dy);
      }
    }
  }

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const dy = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const yr = parseInt(parts[2], 10);
      if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
        return new Date(yr, mo, dy);
      }
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

/** Converte o preset escolhido nos limites concretos do período. */
export function resolveDateRange(
  preset: DatePreset,
  customStartDate?: string,
  customEndDate?: string,
  now: Date = new Date(),
): DateRange {
  if (preset === 'TODAY') {
    return {
      rangeStart: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      rangeEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    };
  }

  if (preset === 'THIS_WEEK') {
    // Semana comercial de segunda a domingo: domingo (getDay() === 0) pertence à
    // semana que começou na segunda anterior, não à que vai começar.
    const dayOfWeek = now.getDay();
    const diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const mon = new Date(now.getFullYear(), now.getMonth(), diffToMon, 0, 0, 0, 0);
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);
    return { rangeStart: mon, rangeEnd: sun };
  }

  if (preset === 'THIS_MONTH') {
    return {
      rangeStart: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
      rangeEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  if (preset === 'LAST_30_DAYS' || preset === 'LAST_90_DAYS') {
    const days = preset === 'LAST_30_DAYS' ? 30 : 90;
    return {
      rangeStart: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 0, 0, 0, 0),
      rangeEnd: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    };
  }

  if (preset === 'CUSTOM') {
    const start = customStartDate ? parseDateString(customStartDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = customEndDate ? parseDateString(customEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return { rangeStart: start, rangeEnd: end };
  }

  return { rangeStart: null, rangeEnd: null };
}

/**
 * Data inválida ou ausente conta como dentro do período: o filtro serve para
 * recortar, não para esconder registro cuja data não deu para interpretar.
 */
export function isDateInRange(
  dateStr: string | undefined | null,
  { rangeStart, rangeEnd }: DateRange,
): boolean {
  if (!rangeStart && !rangeEnd) return true;
  const d = parseDateString(dateStr);
  if (!d) return true;
  if (rangeStart && d < rangeStart) return false;
  if (rangeEnd && d > rangeEnd) return false;
  return true;
}

export function formatBRDate(d: Date | null): string {
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Rótulo do período ativo; null quando nenhum filtro está aplicado. */
export function describeDateRange(
  preset: DatePreset,
  { rangeStart, rangeEnd }: DateRange,
  customStartDate?: string,
  customEndDate?: string,
): string | null {
  if (preset === 'ALL' && !customStartDate && !customEndDate) return null;
  if (preset === 'TODAY') return `Hoje (${formatBRDate(rangeStart)})`;
  if (preset === 'THIS_WEEK') return `Esta Semana (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
  if (preset === 'THIS_MONTH') return `Mês Atual (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
  if (preset === 'LAST_30_DAYS') return `Últimos 30 Dias (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
  if (preset === 'LAST_90_DAYS') return `Últimos 90 Dias (${formatBRDate(rangeStart)} a ${formatBRDate(rangeEnd)})`;
  if (rangeStart || rangeEnd) {
    const s = rangeStart ? formatBRDate(rangeStart) : 'Início';
    const e = rangeEnd ? formatBRDate(rangeEnd) : 'Hoje';
    return `${s} até ${e}`;
  }
  return null;
}
