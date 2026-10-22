import { z } from 'zod';

const coercePositiveDecimal = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
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
}, z.number({ invalid_type_error: 'Preço de custo deve ser um número válido' })
  .nonnegative('Preço de custo deve ser maior ou igual a zero')
  .max(9999999.99, 'Preço de custo excede o limite permitido')
  .nullable()
  .optional()
);

const coerceDate = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d;
  }
  return val;
}, z.date({ invalid_type_error: 'Data inválida' }).nullable().optional());

export const createProductSchema = z.object({
  nome: z
    .string({ required_error: 'O nome do produto é obrigatório' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres'),

  categoria: z.string().trim().max(50).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),

  unidade: z
    .string({ required_error: 'A unidade de medida é obrigatória' })
    .trim()
    .min(1, 'A unidade de medida é obrigatória')
    .max(50, 'A unidade não pode exceder 50 caracteres'),

  isReusable: z.boolean().optional().default(false),
  reutilizavel: z.boolean().optional(),

  isActive: z.boolean().optional().default(true),
  ativo: z.boolean().optional(),

  procedureIds: z.array(z.string().uuid('ID de procedimento inválido')).optional().default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  nome: z.string().trim().min(2).max(150).optional(),
  categoria: z.string().trim().max(50).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  unidade: z.string().trim().min(1).max(50).optional(),
  isReusable: z.boolean().optional(),
  reutilizavel: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ativo: z.boolean().optional(),
  procedureIds: z.array(z.string().uuid('ID de procedimento inválido')).optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  isReusable: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all')
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export const createLotSchema = z.object({
  numeroLote: z
    .string({ required_error: 'O número do lote é obrigatório' })
    .trim()
    .min(1, 'O número do lote é obrigatório')
    .max(100, 'O número do lote não pode exceder 100 caracteres'),

  dataValidade: coerceDate,
  dataAquisicao: coerceDate,
  precoCusto: coercePositiveDecimal,
  observacoes: z.string().trim().max(1000).nullable().optional(),

  quantidadeInicial: z
    .number()
    .int('A quantidade inicial deve ser um número inteiro')
    .min(0, 'A quantidade não pode ser negativa')
    .max(1000, 'A quantidade máxima para geração automática é 1000')
    .optional()
    .default(0),

  codigosSeriais: z.array(z.string().trim().min(1)).optional(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

export const registerUnitsSchema = z.object({
  quantidade: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade deve ser de pelo menos 1 unidade')
    .max(500, 'A quantidade máxima para registro único é 500')
    .optional(),

  codigosSeriais: z.array(z.string().trim().min(1)).optional(),
}).refine((data) => data.quantidade !== undefined || (data.codigosSeriais && data.codigosSeriais.length > 0), {
  message: 'Informe a quantidade de unidades a gerar ou a lista de códigos seriais',
});

export type RegisterUnitsInput = z.infer<typeof registerUnitsSchema>;

export const recordProductUsageSchema = z.object({
  stockUnitId: z.string({ required_error: 'A unidade de estoque física é obrigatória' }).uuid('ID de unidade inválido'),
  attendanceProcedureId: z.string().uuid('ID de procedimento realizado inválido').nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export type RecordProductUsageInput = z.infer<typeof recordProductUsageSchema>;

export const updateStockUnitStatusSchema = z.object({
  status: z.enum(['Disponivel', 'EmUso', 'Esgotado', 'Descartado'], {
    required_error: 'O status da unidade é obrigatório',
  }),
  motivo: z.string().trim().max(500).optional(),
});

export type UpdateStockUnitStatusInput = z.infer<typeof updateStockUnitStatusSchema>;

export const availableUnitsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export type AvailableUnitsQueryInput = z.infer<typeof availableUnitsQuerySchema>;
