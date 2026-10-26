import { z } from 'zod';

/**
 * Preprocessor to parse incoming numeric strings (e.g. "1500.00" or "1500,50") into valid JS numbers.
 */
const coercePositiveDecimal = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    // Handle Brazilian format (1.500,00 -> 1500.00) or standard decimal (1500.00)
    let cleaned = trimmed;
    if (trimmed.includes(',') && trimmed.includes('.')) {
      cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    } else if (trimmed.includes(',')) {
      cleaned = trimmed.replace(',', '.');
    }
    const num = Number(cleaned);
    return isNaN(num) ? val : num;
  }
  return val;
}, z
  .number({
    required_error: 'O valor padrão é obrigatório',
    invalid_type_error: 'O valor padrão deve ser um número válido',
  })
  .positive('O valor padrão deve ser maior que zero (V06)')
  .max(9999999.99, 'O valor padrão excede o limite permitido')
);

/**
 * Preprocessor to parse duration minutes integers.
 */
const coercePositiveInt = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseInt(val.trim(), 10);
    return isNaN(num) ? val : num;
  }
  return val;
}, z
  .number({
    required_error: 'A duração em minutos é obrigatória',
    invalid_type_error: 'A duração deve ser um número inteiro',
  })
  .int('A duração deve ser um número inteiro de minutos')
  .positive('A duração deve ser maior que zero (V07)')
  .max(1440, 'A duração não pode exceder 24 horas (1440 minutos)')
);

/**
 * Schema for creating a new procedure (V06, V07)
 */
export const createProcedureSchema = z.object({
  nome: z
    .string({ required_error: 'O nome do procedimento é obrigatório' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres'),

  descricao: z
    .string({ required_error: 'A descrição do procedimento é obrigatória (V07)' })
    .trim()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres')
    .max(2000, 'A descrição não pode exceder 2000 caracteres'),

  valorPadrao: coercePositiveDecimal,

  duracaoMinutos: coercePositiveInt,

  categoria: z
    .string({ required_error: 'A categoria do procedimento é obrigatória (V07)' })
    .trim()
    .min(2, 'A categoria deve ter no mínimo 2 caracteres')
    .max(50, 'A categoria não pode exceder 50 caracteres'),

  isActive: z.boolean().optional().default(true),
  ativo: z.boolean().optional(), // alias support

  productIds: z
    .array(z.string().uuid('ID de produto associado inválido'))
    .optional()
    .default([]),
});

export type CreateProcedureInput = z.input<typeof createProcedureSchema>;

/**
 * Schema for updating an existing procedure. All fields are optional,
 * but provided fields must follow the exact validation rules.
 */
export const updateProcedureSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres')
    .optional(),

  descricao: z
    .string()
    .trim()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres')
    .max(2000, 'A descrição não pode exceder 2000 caracteres')
    .optional(),

  valorPadrao: coercePositiveDecimal.optional(),

  duracaoMinutos: coercePositiveInt.optional(),

  categoria: z
    .string()
    .trim()
    .min(2, 'A categoria deve ter no mínimo 2 caracteres')
    .max(50, 'A categoria não pode exceder 50 caracteres')
    .optional(),

  isActive: z.boolean().optional(),
  ativo: z.boolean().optional(),

  productIds: z
    .array(z.string().uuid('ID de produto associado inválido'))
    .optional(),
});

export type UpdateProcedureInput = z.infer<typeof updateProcedureSchema>;

/**
 * Schema for query string parameters when listing procedures
 */
export const procedureQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all')
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined; // 'all' returns undefined for Prisma filter
    }),
  ativo: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export type ProcedureQueryInput = z.infer<typeof procedureQuerySchema>;
