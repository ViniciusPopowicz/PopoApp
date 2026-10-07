import { describe, it, expect } from 'vitest';
import { TEST_DATABASE_URL } from '../helpers/db-client';
import { isValidCpf, generateValidCpf } from '../helpers/cpf-validator';

describe('Feature F01: Test Runner & Tooling Infrastructure', () => {
  it('should run in test environment and enforce database isolation', () => {
    expect(TEST_DATABASE_URL).toContain('PopoAppTest');
    expect(TEST_DATABASE_URL).not.toEqual(
      'sqlserver://localhost;database=PopoApp;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLOCALDB'
    );
  });

  it('should have working CPF reference oracle for fixtures', () => {
    const validCpf = generateValidCpf(12345);
    expect(validCpf).toHaveLength(11);
    expect(isValidCpf(validCpf)).toBe(true);
  });

  it('should reject repetitive digit sequences in CPF oracle', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('99999999999')).toBe(false);
  });

  it('should reject invalid CPF lengths', () => {
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('123456789012')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf(null)).toBe(false);
  });

  it('should reject corrupted verification digits in CPF oracle', () => {
    const validCpf = generateValidCpf(42);
    // Corrupt last digit
    const lastChar = validCpf.slice(-1);
    const corruptedChar = lastChar === '9' ? '0' : String(Number(lastChar) + 1);
    const corruptedCpf = validCpf.slice(0, 10) + corruptedChar;
    expect(isValidCpf(corruptedCpf)).toBe(false);
  });
});
