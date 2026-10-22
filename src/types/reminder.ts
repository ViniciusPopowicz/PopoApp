// src/types/reminder.ts
import { Prisma } from '@prisma/client';

export type ReminderPriority = 'baixa' | 'media' | 'alta';
export type ReminderStatus = 'pendente' | 'concluido' | 'dispensado';
export type ReminderType = 'parcela_pix' | 'retorno' | 'geral' | 'aniversario' | 'outro';

export interface ReminderDto {
  id: string;
  clientId: string | null;
  pixInstallmentId: string | null;
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

export interface ReminderListQuery {
  status?: ReminderStatus | 'todos' | 'atrasado';
  prioridade?: ReminderPriority;
  tipo?: string;
  clientId?: string;
  pixInstallmentId?: string;
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
