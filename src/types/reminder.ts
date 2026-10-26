// src/types/reminder.ts

export type ReminderPriority = 'baixa' | 'media' | 'alta';
export type ReminderStatus = 'pendente' | 'concluido' | 'dispensado';
export type ReminderType =
  | 'parcela_pix'
  | 'retorno'
  | 'geral'
  | 'aniversario'
  | 'agendamento'
  | 'atendimento'
  | 'outro';

export const RECURRENCE_FREQUENCIES = ['DIARIA', 'SEMANAL', 'MENSAL', 'ANUAL'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export interface ReminderDto {
  id: string;
  clientId: string | null;
  appointmentId: string | null;
  attendanceId: string | null;
  pixInstallmentId: string | null;
  recurrenceId: string | null;
  occurrenceIndex: number | null;
  titulo: string;
  descricao: string | null;
  dataVencimento: string;
  prioridade: ReminderPriority;
  status: ReminderStatus;
  tipo: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  client?: {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
  } | null;
  appointment?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  attendance?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  pixInstallment?: {
    id: string;
    paymentId: string;
    numeroParcela: number;
    totalParcelas: number;
    valor: number;
    dataVencimento: string;
    status: string;
    payment?: {
      id: string;
      attendanceId: string;
    };
  } | null;
}

export interface ReminderRecurrenceDto {
  id: string;
  clientId: string | null;
  appointmentId: string | null;
  attendanceId: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: ReminderPriority;
  frequencia: RecurrenceFrequency;
  intervalo: number;
  dataInicio: string;
  dataFim: string | null;
  maxOcorrencias: number | null;
  ocorrenciasGeradas: number;
  ultimaGeracaoEm: string | null;
  proximaOcorrenciaEm: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    nome: string;
  } | null;
  appointment?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  attendance?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  occurrences?: ReminderDto[];
}

export interface ReminderListQuery {
  status?: ReminderStatus | 'todos' | 'atrasado';
  prioridade?: ReminderPriority;
  tipo?: string;
  clientId?: string;
  appointmentId?: string;
  attendanceId?: string;
  pixInstallmentId?: string;
  recurrenceId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  overdueOnly?: boolean;
  upcomingDays?: number;
  limit?: number;
  offset?: number;
}

export interface ReminderStatsDto {
  total: number;
  pendentes: number;
  concluidos: number;
  dispensados: number;
  atrasados: number;
}

export interface DashboardPixRemindersDto {
  overdue: ReminderDto[];
  upcoming: ReminderDto[];
}
