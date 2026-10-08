/**
 * Regras do ciclo de 30 dias da assinatura, compartilhadas entre o servidor
 * (stripe-routes.ts — fonte da verdade) e o PaymentModal, para que as datas
 * mostradas ao cliente sejam as mesmas que o servidor aplica.
 *
 * Arquivo sem nenhum import de propósito: é empacotado tanto no bundle do Vite quanto
 * na função serverless da Vercel (mesmo padrão de cpf.ts).
 *
 * Datas são strings 'YYYY-MM-DD', o formato já gravado em startDate/expirationDate.
 */

export const CYCLE_DAYS = 30;

/**
 * Quantos dias antes do vencimento a renovação manual (Pix ou cartão) fica liberada.
 * Antes disso o ciclo atual já está pago e um novo pagamento seria cobrança em dobro.
 */
export const RENEWAL_WINDOW_DAYS = 7;

const SAO_PAULO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** "Hoje" no fuso da barbearia: perto da meia-noite o dia em UTC já seria o seguinte. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return SAO_PAULO_DATE.format(now);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Devolve a data se for 'YYYY-MM-DD' válida; senão ''. */
export function parseDateStr(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? '' : value;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' para mensagens ao usuário. */
export function formatDateBr(dateStr: string): string {
  return dateStr.split('-').reverse().join('/');
}

/**
 * Campos de um novo ciclo pago (Pix ou cartão): zera os atendimentos usados (sobra não
 * acumula) e soma 30 dias ao que for mais tarde entre o vencimento atual e hoje.
 * Vencimento ausente ou inválido conta a partir de hoje.
 */
export function newCycleFields(currentExpiration: unknown, now: Date = new Date()) {
  const today = todayInSaoPaulo(now);
  const current = parseDateStr(currentExpiration);
  const base = current > today ? current : today;
  return { usedSessions: 0, expirationDate: addDays(base, CYCLE_DAYS) };
}

/** Primeiro dia em que a renovação manual fica liberada. */
export function renewalOpensOn(expirationDate: string): string {
  return addDays(expirationDate, -RENEWAL_WINDOW_DAYS);
}

/**
 * Ciclo atual ativo, pago e com mais de RENEWAL_WINDOW_DAYS para vencer: um novo
 * pagamento agora cobraria o mesmo período duas vezes.
 */
export function isCycleAlreadyPaid(
  data: { status?: unknown; paymentStatus?: unknown; expirationDate?: unknown } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (data?.status !== 'ACTIVE' || data?.paymentStatus !== 'PAID') return false;
  const exp = parseDateStr(data?.expirationDate);
  return !!exp && todayInSaoPaulo(now) < renewalOpensOn(exp);
}
