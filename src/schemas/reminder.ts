// src/schemas/reminder.ts
import { z } from 'zod';

export const reminderPrioritySchema = z.enum(['baixa', 'media', 'alta'], {
  errorMap: () => ({ message: 'Prioridade inválida. Permitido: baixa, media, alta' }),
});

export const reminderStatusSchema = z.enum(['pendente', 'concluido', 'dispensado'], {
  errorMap: () => ({ message: 'Status inválido. Permitido: pendente, concluido, dispensado' }),
});

export const createReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  pixInstallmentId: z.string().uuid('ID da parcela deve ser um UUID válido').optional().nullable(),
  titulo: z.string().min(1, 'O título é obrigatório').max(200, 'O título não pode ter mais de 200 caracteres'),
  descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
  dataVencimento: z.coerce.date({ required_error: 'A data de vencimento é obrigatória' }),
  prioridade: reminderPrioritySchema.default('media'),
  tipo: z.string().min(1).default('geral'),
});

export const updateReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  titulo: z.string().min(1, 'O título não pode ficar vazio').max(200, 'O título não pode ter mais de 200 caracteres').optional(),
  descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
  dataVencimento: z.coerce.date().optional(),
  prioridade: reminderPrioritySchema.optional(),
  status: reminderStatusSchema.optional(),
  tipo: z.string().min(1).optional(),
});

export const updateReminderStatusSchema = z.object({
  status: reminderStatusSchema,
});

export const reminderQuerySchema = z.object({
  status: z.enum(['pendente', 'concluido', 'dispensado', 'todos', 'atrasado']).optional(),
  prioridade: reminderPrioritySchema.optional(),
  tipo: z.string().optional(),
  clientId: z.string().uuid().optional(),
  pixInstallmentId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  overdueOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  upcomingDays: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusSchema>;
export type ReminderQueryParams = z.infer<typeof reminderQuerySchema>;
