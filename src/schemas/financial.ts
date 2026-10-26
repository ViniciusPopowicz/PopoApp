// src/schemas/financial.ts
import { z } from 'zod';
import {
  OBLIGATION_TYPES,
  OBLIGATION_STATUSES,
  FINANCIAL_MOVEMENT_TYPES,
  FINANCIAL_MOVEMENT_STATUSES,
} from '@/types/financial';

export const obligationTypeSchema = z.enum(OBLIGATION_TYPES, {
  errorMap: () => ({ message: 'Tipo de obrigação inválido. Use RECEIVABLE ou PAYABLE' }),
});

export const obligationStatusSchema = z.enum(OBLIGATION_STATUSES, {
  errorMap: () => ({ message: 'Status de obrigação inválido' }),
});

export const createFinancialObligationSchema = z.object({
  tipo: obligationTypeSchema,
  descricao: z
    .string({ required_error: 'Descrição é obrigatória' })
    .trim()
    .min(2, 'Descrição deve ter pelo menos 2 caracteres')
    .max(500, 'Descrição deve ter no máximo 500 caracteres'),
  categoria: z.string().trim().max(150).optional().nullable(),
  fornecedor: z.string().trim().max(255).optional().nullable(),
  clientId: z.string().uuid('ID do cliente inválido').optional().nullable(),
  appointmentId: z.string().uuid('ID do agendamento inválido').optional().nullable(),
  attendanceId: z.string().uuid('ID do atendimento inválido').optional().nullable(),
  valorOriginal: z.coerce
    .number({ invalid_type_error: 'Valor deve ser numérico' })
    .gt(0, 'O valor da obrigação deve ser maior que zero'),
  dataVencimento: z.coerce.date({
    required_error: 'Data de vencimento é obrigatória',
    invalid_type_error: 'Data de vencimento inválida',
  }),
  metodo: z.string().trim().max(50).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const updateFinancialObligationSchema = z.object({
  descricao: z.string().trim().min(2).max(500).optional(),
  categoria: z.string().trim().max(150).optional().nullable(),
  fornecedor: z.string().trim().max(255).optional().nullable(),
  dataVencimento: z.coerce.date().optional(),
  metodo: z.string().trim().max(50).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const settleFinancialObligationSchema = z.object({
  valor: z.coerce
    .number({ invalid_type_error: 'Valor de liquidação deve ser numérico' })
    .gt(0, 'O valor da liquidação deve ser maior que zero'),
  dataLiquidacao: z.coerce.date().optional(),
  metodo: z
    .string({ required_error: 'Método de pagamento é obrigatório' })
    .trim()
    .min(1, 'Método de pagamento é obrigatório')
    .max(50),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const cancelFinancialObligationSchema = z.object({
  motivo: z.string().trim().min(2, 'Motivo do cancelamento é obrigatório').max(1000).optional().default('Cancelamento manual'),
  reverseSettlements: z.coerce.boolean().optional().default(false),
});

export const createManualMovementSchema = z.object({
  tipo: z.enum(FINANCIAL_MOVEMENT_TYPES, {
    errorMap: () => ({ message: 'Tipo de movimentação inválido. Use ENTRADA ou SAIDA' }),
  }),
  descricao: z
    .string({ required_error: 'Descrição é obrigatória' })
    .trim()
    .min(2, 'Descrição deve ter pelo menos 2 caracteres')
    .max(500, 'Descrição deve ter no máximo 500 caracteres'),
  categoria: z.string().trim().max(150).optional().nullable(),
  valor: z.coerce
    .number({ invalid_type_error: 'Valor deve ser numérico' })
    .gt(0, 'O valor da movimentação deve ser maior que zero'),
  dataMovimentacao: z.coerce.date().optional(),
  metodo: z
    .string({ required_error: 'Método é obrigatório' })
    .trim()
    .min(1, 'Método é obrigatório')
    .max(50),
  clientId: z.string().uuid('ID do cliente inválido').optional().nullable(),
  appointmentId: z.string().uuid('ID do agendamento inválido').optional().nullable(),
  attendanceId: z.string().uuid('ID do atendimento inválido').optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export const reverseFinancialRecordSchema = z.object({
  motivo: z
    .string({ required_error: 'Motivo do estorno é obrigatório' })
    .trim()
    .min(2, 'Motivo do estorno deve ter pelo menos 2 caracteres')
    .max(1000),
});

export const obligationListQuerySchema = z.object({
  tipo: z.union([obligationTypeSchema, z.literal('todos')]).optional().default('todos'),
  status: z.union([obligationStatusSchema, z.literal('todos')]).optional().default('todos'),
  clientId: z.string().uuid().optional(),
  attendanceId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  categoria: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  overdueOnly: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const movementListQuerySchema = z.object({
  tipo: z.union([z.enum(FINANCIAL_MOVEMENT_TYPES), z.literal('todos')]).optional().default('todos'),
  status: z.union([z.enum(FINANCIAL_MOVEMENT_STATUSES), z.literal('todos')]).optional().default('todos'),
  origem: z.string().trim().optional(),
  metodo: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  clientId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type CreateFinancialObligationInput = z.infer<typeof createFinancialObligationSchema>;
export type UpdateFinancialObligationInput = z.infer<typeof updateFinancialObligationSchema>;
export type SettleFinancialObligationInput = z.infer<typeof settleFinancialObligationSchema>;
export type CancelFinancialObligationInput = z.infer<typeof cancelFinancialObligationSchema>;
export type CreateManualMovementInput = z.infer<typeof createManualMovementSchema>;
export type ReverseFinancialRecordInput = z.infer<typeof reverseFinancialRecordSchema>;
export type ObligationListQuery = z.infer<typeof obligationListQuerySchema>;
export type MovementListQuery = z.infer<typeof movementListQuerySchema>;
