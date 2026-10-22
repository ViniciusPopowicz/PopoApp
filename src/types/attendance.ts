// src/types/attendance.ts

export const ATTENDANCE_STATUSES = [
  'Pendente',
  'Realizado',
  'Cancelado',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceFinancialsDto {
  standardTotal: number;
  practicedTotal: number;
  explicitDiscount: number;
  netTotal: number;
  paidTotal: number;
  outstandingBalance: number;
  isFullyPaid: boolean;
}

export interface AttendanceProcedureDto {
  id: string;
  attendanceId: string;
  procedureId: string;
  procedureName: string;
  duracaoMinutos: number;
  standardValueSnapshot: number;
  practicedValue: number;
  observacoes: string | null;
  createdAt: string;
}

export interface AttendanceSummaryDto {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientCpf?: string;
  status: AttendanceStatus;
  dataHora: string;
  completedAt: string | null;
  desconto: number;
  observacoes: string | null;
  financials: AttendanceFinancialsDto;
  proceduresCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDetailDto extends AttendanceSummaryDto {
  procedures: AttendanceProcedureDto[];
  medicalRecord?: {
    id: string;
    queixaPrincipal: string | null;
    avaliacaoClinica: string | null;
    condutaProcedimento: string | null;
    orientacoes: string | null;
    observacoes: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  attachments: {
    id: string;
    nomeOriginal: string;
    mimeType: string;
    tamanhoBytes: number;
    categoria: string | null;
    createdAt: string;
  }[];
  productUsages: {
    id: string;
    stockUnitId: string;
    codigoSerial: string;
    productName: string;
    numeroLote: string;
    dataHora: string;
    observacoes: string | null;
  }[];
  payments: {
    id: string;
    valor: number;
    metodo: string;
    status: string;
    dataPagamento: string | null;
  }[];
}
