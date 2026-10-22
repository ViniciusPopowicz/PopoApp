import { describe, it, expect } from 'vitest';
import { createProcedureSchema } from '@/schemas/procedure';

describe('Critical Validation V06: Positive Standard Value (valorPadrao > 0)', () => {
  const validBase = {
    nome: 'Preenchimento Labial',
    descricao: 'Preenchimento labial com ácido hialurônico de alta pureza',
    duracaoMinutos: 60,
    categoria: 'Preenchimento',
  };

  it('should accept strictly positive values', () => {
    const result1 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 500.0 });
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.data.valorPadrao).toBe(500.0);
    }

    const result2 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 0.01 });
    expect(result2.success).toBe(true);

    const result3 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: '1500,50' });
    expect(result3.success).toBe(true);
    if (result3.success) {
      expect(result3.data.valorPadrao).toBe(1500.5);
    }
  });

  it('should reject zero standard value (valorPadrao = 0)', () => {
    const result = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.valorPadrao).toBeDefined();
    }
  });

  it('should reject negative standard value (valorPadrao < 0)', () => {
    const result = createProcedureSchema.safeParse({ ...validBase, valorPadrao: -100.0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.valorPadrao).toBeDefined();
    }
  });

  it('should reject missing standard value', () => {
    const result = createProcedureSchema.safeParse({
      nome: validBase.nome,
      descricao: validBase.descricao,
      duracaoMinutos: validBase.duracaoMinutos,
      categoria: validBase.categoria,
    });
    expect(result.success).toBe(false);
  });
});
