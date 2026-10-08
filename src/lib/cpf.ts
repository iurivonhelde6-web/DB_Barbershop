/**
 * Validação de CPF compartilhada entre o servidor (server.ts, stripe-routes.ts — fonte
 * da verdade) e o formulário do front (PaymentModal), para que a regra seja uma só.
 *
 * Arquivo sem nenhum import de propósito: é empacotado tanto no bundle do Vite quanto
 * na função serverless da Vercel.
 */

/** Remove tudo que não for dígito. */
export function cleanCpf(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

/**
 * CPF real: 11 dígitos, não todos iguais (000.000.000-00, 111.111.111-11... passam no
 * cálculo dos dígitos mas não existem) e com os dois dígitos verificadores corretos.
 */
export function isValidCpf(value: unknown): boolean {
  const cpf = cleanCpf(value);
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

/** Formata 11 dígitos como 000.000.000-00 enquanto o usuário digita. */
export function formatCpf(value: string): string {
  const d = cleanCpf(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}
