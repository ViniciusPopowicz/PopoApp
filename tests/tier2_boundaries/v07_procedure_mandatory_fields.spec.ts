import { describe, it, expect } from 'vitest';
import { createProcedureSchema } from '@/schemas/procedure';

describe('Critical Validation V07: Procedure Mandatory Fields (nome, descricao, duracaoMinutos, categoria)', () => {
  const validBase = {
    nome: 'Aplicação de Toxina Botulínica',
    descricao: 'Tratamento estético para rugas e linhas de expressão',
    valorPadrao: 1200.0,
    duracaoMinutos: 45,
    categoria: 'Toxina Botulínica',
  };

  it('should accept completely valid procedure input', () => {
    const result = createProcedureSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('should reject missing or empty nome', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, nome: '' });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, nome: '   ' });
    expect(r2.success).toBe(false);

    const { nome, ...withoutNome } = validBase;
    const r3 = createProcedureSchema.safeParse(withoutNome);
    expect(r3.success).toBe(false);
  });

  it('should reject missing or empty descricao (V07)', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, descricao: '' });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, descricao: '   ' });
    expect(r2.success).toBe(false);

    const { descricao, ...withoutDescricao } = validBase;
    const r3 = createProcedureSchema.safeParse(withoutDescricao);
    expect(r3.success).toBe(false);
  });

  it('should reject non-positive or non-integer duracaoMinutos (V07)', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: 0 });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: -15 });
    expect(r2.success).toBe(false);

    const r3 = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: 45.5 });
    expect(r3.success).toBe(false);

    const { duracaoMinutos, ...withoutDuration } = validBase;
    const r4 = createProcedureSchema.safeParse(withoutDuration);
    expect(r4.success).toBe(false);
  });

  it('should reject missing or empty categoria (V07)', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, categoria: '' });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, categoria: '   ' });
    expect(r2.success).toBe(false);

    const { categoria, ...withoutCategoria } = validBase;
    const r3 = createProcedureSchema.safeParse(withoutCategoria);
    expect(r3.success).toBe(false);
  });
});
