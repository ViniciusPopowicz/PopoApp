import { z } from 'zod';
import { APPOINTMENT_STATUSES, PROHIBITED_APPOINTMENT_STATUSES } from '@/types/appointment';

export const appointmentStatusSchema = z.string().refine(
  (val): val is (typeof APPOINTMENT_STATUSES)[number] => {
    if (PROHIBITED_APPOINTMENT_STATUSES.includes(val as any)) {
      return false;
    }
    return (APPOINTMENT_STATUSES as readonly string[]).includes(val);
  },
  {
    message: 'Status de agendamento inválido. "Em atendimento" não é permitido.',
  }
);

export const plannedProcedureInputSchema = z.object({
  procedureId: z.string().uuid('ID do procedimento inválido'),
  ordem: z.number().int().min(0).optional().default(0),
});

export const createAppointmentSchema = z.object({
  clientId: z.string().uuid('ID do cliente inválido'),
  dataHora: z.coerce.date({
    errorMap: () => ({ message: 'Data e hora do agendamento inválidas' }),
  }),
  valorEstimado: z.coerce.number().min(0, 'Valor estimado deve ser positivo').optional().nullable(),
  observacoes: z.string().trim().max(4000, 'Observações muito longas').optional().nullable(),
  plannedProcedureIds: z.array(z.string().uuid()).optional().default([]),
  prefillAttendance: z.boolean().optional().default(false),
});

export const updateAppointmentSchema = z.object({
  dataHora: z.coerce.date().optional(),
  valorEstimado: z.coerce.number().min(0).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  status: appointmentStatusSchema.optional(),
});

export const cancelAppointmentSchema = z.object({
  motivoCancelamento: z
    .string({ required_error: 'Motivo do cancelamento é obrigatório' })
    .trim()
    .min(3, 'Motivo do cancelamento é obrigatório (mínimo 3 caracteres)')
    .max(500, 'Motivo do cancelamento muito longo'),
});

export const noShowAppointmentSchema = z.object({
  observacoes: z.string().trim().max(500).optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  novaDataHora: z.coerce.date({
    errorMap: () => ({ message: 'Nova data e hora inválidas' }),
  }),
  motivo: z.string().trim().max(500).optional().nullable(),
  valorEstimado: z.coerce.number().min(0).optional().nullable(),
  plannedProcedureIds: z.array(z.string().uuid()).optional(),
});

export const appointmentListQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  clientId: z.string().uuid().optional(),
  status: z.union([appointmentStatusSchema, z.literal('todos')]).optional().default('todos'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type NoShowAppointmentInput = z.infer<typeof noShowAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
