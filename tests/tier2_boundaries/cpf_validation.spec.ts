import { describe, it, expect } from 'vitest';
import { isValidCpf, normalizeCpf, formatCpf, generateValidCpf } from '../helpers/cpf-validator';

describe('Tier 2: CPF Validation Boundaries & Algorithms (D4, AC 62)', () => {
  describe('Normalization & Formatting', () => {
    it('should strip punctuation and spaces from raw CPF', () => {
      expect(normalizeCpf('123.456.789-01')).toBe('12345678901');
      expect(normalizeCpf('  123.456.789-01  ')).toBe('12345678901');
      expect(normalizeCpf('123-456.789/01')).toBe('12345678901');
    });

    it('should handle empty or null values gracefully', () => {
      expect(normalizeCpf('')).toBe('');
      expect(normalizeCpf(null)).toBe('');
      expect(normalizeCpf(undefined)).toBe('');
    });

    it('should format 11-digit CPF to canonical Brazilian mask', () => {
      expect(formatCpf('12345678901')).toBe('123.456.789-01');
    });

    it('should return unmasked string if length is not exactly 11', () => {
      expect(formatCpf('12345')).toBe('12345');
    });
  });

  describe('Mathematical MOD 11 Checksum Boundary Tests', () => {
    it('should validate correctly generated CPFs', () => {
      for (let i = 1; i <= 10; i++) {
        const cpf = generateValidCpf(i * 100);
        expect(isValidCpf(cpf)).toBe(true);
      }
    });

    it('should validate valid formatted CPF strings', () => {
      const cpf = generateValidCpf(99);
      const formatted = formatCpf(cpf);
      expect(isValidCpf(formatted)).toBe(true);
    });

    it('should reject all 10 repetitive digit sequences', () => {
      const repetitive = [
        '000.000.000-00',
        '111.111.111-11',
        '222.222.222-22',
        '333.333.333-33',
        '444.444.444-44',
        '555.555.555-55',
        '666.666.666-66',
        '777.777.777-77',
        '888.888.888-88',
        '999.999.999-99',
      ];

      for (const invalid of repetitive) {
        expect(isValidCpf(invalid)).toBe(false);
      }
    });

    it('should reject when first check digit is invalid', () => {
      const valid = generateValidCpf(555);
      // Corrupt digit at index 9 (first check digit)
      const corrupted =
        valid.slice(0, 9) +
        (valid[9] === '9' ? '0' : String(Number(valid[9]) + 1)) +
        valid.slice(10);
      expect(isValidCpf(corrupted)).toBe(false);
    });

    it('should reject when second check digit is invalid', () => {
      const valid = generateValidCpf(777);
      // Corrupt digit at index 10 (second check digit)
      const corrupted =
        valid.slice(0, 10) +
        (valid[10] === '9' ? '0' : String(Number(valid[10]) + 1));
      expect(isValidCpf(corrupted)).toBe(false);
    });

    it('should reject inputs with fewer than 11 digits', () => {
      expect(isValidCpf('1234567890')).toBe(false);
      expect(isValidCpf('1')).toBe(false);
    });

    it('should reject inputs with more than 11 digits', () => {
      expect(isValidCpf('123456789012')).toBe(false);
    });

    it('should reject inputs containing alphabetic or special characters after normalization check', () => {
      expect(isValidCpf('abc.def.ghi-jk')).toBe(false);
    });
  });
});
