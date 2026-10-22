/**
 * Brazilian CPF (Cadastro de Pessoas Físicas) utilities
 * Implements Receita Federal MOD 11 verification, formatting, and normalization.
 */

/**
 * Normalizes CPF by removing all non-digit characters.
 */
export function normalizeCpf(rawCpf: string | null | undefined): string {
  if (!rawCpf) return '';
  return rawCpf.replace(/\D/g, '');
}

/**
 * Formats an 11-digit CPF to canonical Brazilian mask 000.000.000-00.
 */
export function formatCpf(rawCpf: string): string {
  const clean = normalizeCpf(rawCpf);
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Validates Brazilian CPF according to Receita Federal MOD 11 rules.
 */
export function isValidCpf(rawCpf: string | null | undefined): boolean {
  const clean = normalizeCpf(rawCpf);

  if (clean.length !== 11) return false;

  // Rejects sequences of identical digits (000.000.000-00, 111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // First verification digit (D1)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest1 = (sum1 * 10) % 11;
  if (rest1 === 10 || rest1 === 11) rest1 = 0;
  if (rest1 !== parseInt(clean.charAt(9), 10)) return false;

  // Second verification digit (D2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let rest2 = (sum2 * 10) % 11;
  if (rest2 === 10 || rest2 === 11) rest2 = 0;
  if (rest2 !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}
