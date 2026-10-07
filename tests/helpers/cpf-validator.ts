/**
 * Reference Oracle for Brazilian CPF (Cadastro de Pessoas Físicas)
 * Derived strictly from Brazilian Federal Revenue (Receita Federal) MOD 11 specification.
 */

export function normalizeCpf(rawCpf: string | null | undefined): string {
  if (!rawCpf) return '';
  return rawCpf.replace(/\D/g, '');
}

export function formatCpf(rawCpf: string): string {
  const clean = normalizeCpf(rawCpf);
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

export function isValidCpf(rawCpf: string | null | undefined): boolean {
  const clean = normalizeCpf(rawCpf);

  // Must have exactly 11 digits
  if (clean.length !== 11) return false;

  // Rejects sequences of all same digits (00000000000, 11111111111, etc.)
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

/**
 * Deterministically generates a mathematically valid CPF for test fixtures.
 * Uses a seed or sequential counter to guarantee unique, repeatable test fixtures.
 */
export function generateValidCpf(seedNumber = 1): string {
  const base = String(seedNumber).padStart(8, '0').slice(-8);
  const prefix = `9${base}`; // 9 digits

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(prefix.charAt(i), 10) * (10 - i);
  }
  let d1 = (sum1 * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;

  const prefixWithD1 = `${prefix}${d1}`;
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(prefixWithD1.charAt(i), 10) * (11 - i);
  }
  let d2 = (sum2 * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;

  return `${prefixWithD1}${d2}`;
}
