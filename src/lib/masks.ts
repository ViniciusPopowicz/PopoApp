/**
 * Standardized Input Masking & Unmasking Utilities (Phase 2 & IMPROVEMENT-001)
 *
 * Ensures visual masks (BRL Currency, Phone, Date DD/MM/YYYY, CPF) are decoupled
 * from raw persistence payloads (float numbers, raw digit strings, ISO dates).
 */

// ============================================================================
// 1. CURRENCY (BRL: "R$ 1.234,56" <-> float 1234.56)
// ============================================================================

/**
 * Progressive ATM-style BRL currency mask for text inputs.
 * Typing digits "123456" formats as "R$ 1.234,56".
 * Passing "" or non-digit string returns "".
 */
export function maskCurrencyBRL(rawInput: string | number | null | undefined): string {
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return '';
  }

  if (typeof rawInput === 'number') {
    if (isNaN(rawInput)) return '';
    return formatNumberToBRLInput(rawInput);
  }

  const digits = String(rawInput).replace(/\D/g, '');
  if (!digits) return '';

  const cents = parseInt(digits, 10);
  if (isNaN(cents)) return '';

  const floatVal = cents / 100;
  return floatVal
    .toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00a0/g, ' ');
}

/**
 * Formats an existing numeric float (e.g. 150.5 or "150.5") into a masked BRL input string ("R$ 150,50").
 */
export function formatNumberToBRLInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (isNaN(num)) return '';
  return num
    .toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00a0/g, ' ');
}

/**
 * Unmasks a BRL currency string ("R$ 1.234,56", "1.234,56", or "1234.56") into a raw float (1234.56).
 * Returns 0 if empty or invalid.
 */
export function unmaskCurrencyBRL(masked: string | number | null | undefined): number {
  if (masked === null || masked === undefined || masked === '') return 0;
  if (typeof masked === 'number') return isNaN(masked) ? 0 : Number(masked.toFixed(2));

  const str = String(masked).trim();
  if (!str) return 0;

  // If it contains a comma (pt-BR formatted like "R$ 1.234,56" or "1234,56")
  if (str.includes(',')) {
    const cleaned = str
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
  }

  // If it is a plain dot-decimal string (e.g. "1234.56")
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(2));
  }

  // Fallback: extract digits as cents
  const digits = str.replace(/\D/g, '');
  if (!digits) return 0;
  return Number((parseInt(digits, 10) / 100).toFixed(2));
}

// ============================================================================
// 2. PHONE (BR: "(00) 0000-0000" or "(00) 00000-0000" <-> raw digits)
// ============================================================================

/**
 * Formats a Brazilian landline (10 digits) or mobile (11 digits) phone number.
 */
export function maskPhoneBR(value: string | null | undefined): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Strips non-digit characters from a phone string.
 */
export function unmaskPhoneBR(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}

// ============================================================================
// 3. CPF ("000.000.000-00" <-> 11 raw digits)
// ============================================================================

/**
 * Progressive CPF mask: "000.000.000-00".
 */
export function maskCPF(value: string | null | undefined): string {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Strips non-digit characters from a CPF string (max 11 digits).
 */
export function unmaskCPF(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 11);
}

// ============================================================================
// 4. DATE ("DD/MM/YYYY" <-> ISO "YYYY-MM-DD")
// ============================================================================

/**
 * Progressive Date mask: "DD/MM/YYYY".
 * Also converts an incoming ISO date ("YYYY-MM-DD") if passed directly.
 */
export function maskDateBR(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = String(value).trim();

  // If already in ISO YYYY-MM-DD format, convert to DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Validates whether a "DD/MM/YYYY" or "YYYY-MM-DD" string represents a valid calendar date.
 */
export function isValidDateBR(value: string | null | undefined): boolean {
  if (!value) return false;
  const iso = dateBRToISO(value);
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Converts a masked Brazilian date ("DD/MM/YYYY") or ISO string into "YYYY-MM-DD" for API persistence.
 * Returns "" if incomplete or invalid.
 */
export function dateBRToISO(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return '';

  const [, dd, mm, yyyy] = match;
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return '';

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return '';
  }

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts an ISO date ("YYYY-MM-DD" or ISO timestamp) or Date object into "DD/MM/YYYY".
 */
export function isoToDateBR(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  if (iso instanceof Date) {
    if (isNaN(iso.getTime())) return '';
    const dd = String(iso.getUTCDate()).padStart(2, '0');
    const mm = String(iso.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = iso.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  const str = String(iso).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  const isoPrefix = str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
    const [yyyy, mm, dd] = isoPrefix.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return '';
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
