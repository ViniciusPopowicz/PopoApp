// src/types/appointment.ts

export const APPOINTMENT_STATUSES = [
  'Agendado',
  'Confirmado',
  'Concluído',
  'Cancelado',
  'Não compareceu',
  'Reagendado',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PROHIBITED_APPOINTMENT_STATUSES = [
  'Em atendimento',
  'em_atendimento',
  'EM ATENDIMENTO',
] as const;

export interface PlannedProcedureDto {
  id: string;
  appointmentId: string;
  procedureId: string;
  procedureName: string;
  duracaoMinutos: number;
  valorPadrao: number;
  ordem: number;
}

export interface AppointmentSummaryDto {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  dataHora: string;
  status: AppointmentStatus;
  valorEstimado: number;
  observacoes: string | null;
  motivoCancelamento: string | null;
  rescheduledFromId: string | null;
  rescheduledToId: string | null;
  plannedProceduresCount: number;
  attendancesCount: number;
  hasRealizadoAttendance: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentDetailDto extends AppointmentSummaryDto {
  plannedProcedures: PlannedProcedureDto[];
  attendances: {
    id: string;
    status: string;
    dataHora: string;
    completedAt: string | null;
    desconto: number;
  }[];
  rescheduledFrom?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  rescheduledTo?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
}
