import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '@/types/attendance';

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES, {
  errorMap: () => ({ message: 'Status de atendimento inválido' }),
});

export const createAttendanceSchema = z.object({
  appointmentId: z.string().uuid('ID do agendamento inválido'),
  clientId: z.string().uuid('ID do cliente inválido'),
  dataHora: z.coerce.date().optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  desconto: z.coerce.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
});

export const updateAttendanceSchema = z.object({
  dataHora: z.coerce.date().optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
});

export const addAttendanceProcedureSchema = z.object({
  procedureId: z.string().uuid('ID do procedimento inválido'),
  practicedValue: z.coerce
    .number({ invalid_type_error: 'Valor praticado deve ser um número' })
    .min(0, 'Valor praticado não pode ser negativo'),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateAttendanceProcedureSchema = z.object({
  practicedValue: z.coerce
    .number({ invalid_type_error: 'Valor praticado deve ser um número' })
    .min(0, 'Valor praticado não pode ser negativo'),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const setDiscountSchema = z.object({
  desconto: z.coerce
    .number({ invalid_type_error: 'Desconto deve ser um número' })
    .min(0, 'Desconto não pode ser negativo'),
});

export const attendanceListQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  status: z.union([attendanceStatusSchema, z.literal('todos')]).optional().default('todos'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AddAttendanceProcedureInput = z.infer<typeof addAttendanceProcedureSchema>;
export type UpdateAttendanceProcedureInput = z.infer<typeof updateAttendanceProcedureSchema>;
export type SetDiscountInput = z.infer<typeof setDiscountSchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
