import { z } from 'zod';
import { INVENTORY_MOVEMENT_TYPES } from '@/types/product';

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

export const productTrackingModeSchema = z.enum(['UNIT', 'QUANTITY'], {
  errorMap: () => ({ message: 'Modo de rastreamento inválido. Permitido: UNIT ou QUANTITY' }),
});

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

  trackingMode: productTrackingModeSchema.optional().default('UNIT'),
  estoqueMinimo: z.coerce.number().min(0).optional().default(0),

  isReusable: z.boolean().optional().default(false),
  reutilizavel: z.boolean().optional(),

  isActive: z.boolean().optional().default(true),
  ativo: z.boolean().optional(),

  procedureIds: z.array(z.string().uuid('ID de procedimento inválido')).optional().default([]),
});

export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = z.object({
  nome: z.string().trim().min(2).max(150).optional(),
  categoria: z.string().trim().max(50).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  unidade: z.string().trim().min(1).max(50).optional(),
  trackingMode: productTrackingModeSchema.optional(),
  estoqueMinimo: z.coerce.number().min(0).optional(),
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
  trackingMode: productTrackingModeSchema.optional(),
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

  quantidadeInicial: z.coerce
    .number()
    .min(0, 'A quantidade não pode ser negativa')
    .max(1000000, 'A quantidade inicial excede o limite permitido')
    .optional()
    .default(0),

  quantidadeDisponivel: z.coerce
    .number()
    .min(0, 'A quantidade disponível não pode ser negativa')
    .optional(),

  codigosSeriais: z.array(z.string().trim().min(1)).optional(),
});

export type CreateLotInput = z.input<typeof createLotSchema>;

export const registerUnitsSchema = z
  .object({
    quantidade: z
      .number()
      .int('A quantidade deve ser um número inteiro')
      .min(1, 'A quantidade deve ser de pelo menos 1 unidade')
      .max(500, 'A quantidade máxima para registro único é 500')
      .optional(),

    quantidadePorUnidade: z.coerce
      .number()
      .gt(0, 'A quantidade por unidade deve ser maior que zero')
      .optional()
      .default(1),

    codigosSeriais: z.array(z.string().trim().min(1)).optional(),
  })
  .refine(
    (data) => data.quantidade !== undefined || (data.codigosSeriais && data.codigosSeriais.length > 0),
    {
      message: 'Informe a quantidade de unidades a gerar ou a lista de códigos seriais',
    }
  );

export type RegisterUnitsInput = z.input<typeof registerUnitsSchema>;

export const recordProductUsageSchema = z
  .object({
    stockUnitId: z.string().uuid('ID de unidade inválido').nullable().optional(),
    lotId: z.string().uuid('ID do lote inválido').nullable().optional(),
    productId: z.string().uuid('ID do produto inválido').nullable().optional(),
    quantidade: z.coerce
      .number({ invalid_type_error: 'Quantidade deve ser numérica' })
      .gt(0, 'A quantidade consumida deve ser maior que zero')
      .optional(),
    unidade: z.string().trim().max(50).nullable().optional(),
    attendanceProcedureId: z.string().uuid('ID de procedimento realizado inválido').nullable().optional(),
    observacoes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Boolean(data.stockUnitId || data.lotId || data.productId), {
    message: 'Informe a unidade de estoque (stockUnitId), o lote (lotId) ou o produto (productId)',
  });

export type RecordProductUsageInput = z.infer<typeof recordProductUsageSchema>;

export const reverseProductUsageSchema = z.object({
  motivo: z
    .string({ required_error: 'O motivo do estorno é obrigatório' })
    .trim()
    .min(2, 'O motivo do estorno deve ter pelo menos 2 caracteres')
    .max(500),
});

export type ReverseProductUsageInput = z.infer<typeof reverseProductUsageSchema>;

export const correctProductUsageSchema = z.object({
  novaQuantidade: z.coerce
    .number({ invalid_type_error: 'A nova quantidade deve ser numérica' })
    .gt(0, 'A nova quantidade deve ser maior que zero'),
  motivo: z
    .string({ required_error: 'O motivo da correção é obrigatório' })
    .trim()
    .min(2, 'O motivo da correção deve ter pelo menos 2 caracteres')
    .max(500),
});

export type CorrectProductUsageInput = z.infer<typeof correctProductUsageSchema>;

export const updateStockUnitStatusSchema = z.object({
  status: z.enum(['Disponivel', 'EmUso', 'Esgotado', 'Descartado'], {
    required_error: 'O status da unidade é obrigatório',
  }),
  motivo: z.string().trim().max(500).optional(),
});

export type UpdateStockUnitStatusInput = z.infer<typeof updateStockUnitStatusSchema>;

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid('ID do produto inválido').optional(),
  lotId: z.string().uuid('ID do lote inválido').optional(),
  stockUnitId: z.string().uuid('ID da unidade inválido').optional(),
  tipo: z.enum(['ENTRADA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PERDA_DESCARTE'], {
    errorMap: () => ({
      message: 'Tipo inválido. Use ENTRADA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO ou PERDA_DESCARTE',
    }),
  }),
  quantidade: z.coerce
    .number({ invalid_type_error: 'Quantidade deve ser numérica' })
    .gt(0, 'A quantidade deve ser maior que zero'),
  unidade: z.string().trim().max(50).optional(),
  motivo: z
    .string({ required_error: 'O motivo da movimentação é obrigatório' })
    .trim()
    .min(2, 'O motivo deve ter pelo menos 2 caracteres')
    .max(500),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const inventoryMovementQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  lotId: z.string().uuid().optional(),
  stockUnitId: z.string().uuid().optional(),
  attendanceId: z.string().uuid().optional(),
  tipo: z.union([z.enum(INVENTORY_MOVEMENT_TYPES), z.literal('todos')]).optional().default('todos'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type InventoryMovementQueryInput = z.infer<typeof inventoryMovementQuerySchema>;

export const availableUnitsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export type AvailableUnitsQueryInput = z.infer<typeof availableUnitsQuerySchema>;
