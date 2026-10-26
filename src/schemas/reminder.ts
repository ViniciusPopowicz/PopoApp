// src/schemas/reminder.ts
import { z } from 'zod';
import { RECURRENCE_FREQUENCIES, RecurrenceFrequency } from '@/types/reminder';

export const reminderPrioritySchema = z.enum(['baixa', 'media', 'alta'], {
  errorMap: () => ({ message: 'Prioridade inválida. Permitido: baixa, media, alta' }),
});

export const reminderStatusSchema = z.enum(['pendente', 'concluido', 'dispensado'], {
  errorMap: () => ({ message: 'Status inválido. Permitido: pendente, concluido, dispensado' }),
});

const FREQUENCY_MAP: Record<string, RecurrenceFrequency> = {
  DIARIA: 'DIARIA',
  diaria: 'DIARIA',
  daily: 'DIARIA',
  DAILY: 'DIARIA',
  SEMANAL: 'SEMANAL',
  semanal: 'SEMANAL',
  weekly: 'SEMANAL',
  WEEKLY: 'SEMANAL',
  MENSAL: 'MENSAL',
  mensal: 'MENSAL',
  monthly: 'MENSAL',
  MONTHLY: 'MENSAL',
  ANUAL: 'ANUAL',
  anual: 'ANUAL',
  yearly: 'ANUAL',
  YEARLY: 'ANUAL',
};

export const recurrenceFrequencySchema = z
  .string()
  .transform((val) => FREQUENCY_MAP[val.trim()] ?? val)
  .pipe(
    z.enum(RECURRENCE_FREQUENCIES, {
      errorMap: () => ({
        message: 'Frequência inválida. Permitido: DIARIA, SEMANAL, MENSAL, ANUAL (ou daily, weekly, monthly, yearly)',
      }),
    })
  );

export const createReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  appointmentId: z.string().uuid('ID do agendamento deve ser um UUID válido').optional().nullable(),
  attendanceId: z.string().uuid('ID do atendimento deve ser um UUID válido').optional().nullable(),
  pixInstallmentId: z.string().uuid('ID da parcela deve ser um UUID válido').optional().nullable(),
  titulo: z.string().min(1, 'O título é obrigatório').max(200, 'O título não pode ter mais de 200 caracteres'),
  descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
  dataVencimento: z.coerce.date({ required_error: 'A data de vencimento é obrigatória' }),
  prioridade: reminderPrioritySchema.default('media'),
  tipo: z.string().min(1).default('geral'),
});

export const updateReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  appointmentId: z.string().uuid('ID do agendamento deve ser um UUID válido').optional().nullable(),
  attendanceId: z.string().uuid('ID do atendimento deve ser um UUID válido').optional().nullable(),
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

export const createReminderRecurrenceSchema = z
  .object({
    clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
    appointmentId: z.string().uuid('ID do agendamento deve ser um UUID válido').optional().nullable(),
    attendanceId: z.string().uuid('ID do atendimento deve ser um UUID válido').optional().nullable(),
    titulo: z.string().min(1, 'O título é obrigatório').max(200, 'O título não pode ter mais de 200 caracteres'),
    descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
    tipo: z.string().min(1).default('retorno'),
    prioridade: reminderPrioritySchema.default('media'),
    frequencia: recurrenceFrequencySchema,
    intervalo: z.coerce
      .number({ invalid_type_error: 'Intervalo deve ser um número inteiro' })
      .int('Intervalo deve ser um número inteiro')
      .min(1, 'O intervalo de recorrência deve ser de no mínimo 1')
      .max(365, 'O intervalo de recorrência não pode exceder 365')
      .default(1),
    dataInicio: z.coerce.date({ required_error: 'Data de início é obrigatória' }),
    dataFim: z.coerce.date().optional().nullable(),
    maxOcorrencias: z.coerce
      .number()
      .int()
      .min(1, 'Número máximo de ocorrências deve ser no mínimo 1')
      .max(1000)
      .optional()
      .nullable(),
    isActive: z.coerce.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.dataFim && data.dataFim < data.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data de término não pode ser anterior à data de início',
        path: ['dataFim'],
      });
    }
  });

export const updateReminderRecurrenceSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).optional().nullable(),
  prioridade: reminderPrioritySchema.optional(),
  frequencia: recurrenceFrequencySchema.optional(),
  intervalo: z.coerce.number().int().min(1).max(365).optional(),
  dataFim: z.coerce.date().optional().nullable(),
  maxOcorrencias: z.coerce.number().int().min(1).max(1000).optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export const reminderQuerySchema = z.object({
  status: z.enum(['pendente', 'concluido', 'dispensado', 'todos', 'atrasado']).optional(),
  prioridade: reminderPrioritySchema.optional(),
  tipo: z.string().optional(),
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  attendanceId: z.string().uuid().optional(),
  pixInstallmentId: z.string().uuid().optional(),
  recurrenceId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  overdueOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  upcomingDays: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateReminderInput = z.input<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusSchema>;
export type CreateReminderRecurrenceInput = z.input<typeof createReminderRecurrenceSchema>;
export type UpdateReminderRecurrenceInput = z.infer<typeof updateReminderRecurrenceSchema>;
export type ReminderQueryParams = z.input<typeof reminderQuerySchema>;
