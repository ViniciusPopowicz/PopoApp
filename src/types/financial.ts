// src/types/financial.ts

export const OBLIGATION_TYPES = ['RECEIVABLE', 'PAYABLE'] as const;
export type ObligationType = (typeof OBLIGATION_TYPES)[number];

export const OBLIGATION_STATUSES = [
  'Pendente',
  'Parcial',
  'Pago',
  'Atrasado',
  'Cancelado',
] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const SETTLEMENT_STATUSES = ['Ativo', 'Estornado'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const FINANCIAL_MOVEMENT_TYPES = ['ENTRADA', 'SAIDA'] as const;
export type FinancialMovementType = (typeof FINANCIAL_MOVEMENT_TYPES)[number];

export const FINANCIAL_MOVEMENT_ORIGINS = [
  'ATENDIMENTO',
  'PARCELA_PIX',
  'LIQUIDACAO_RECEBER',
  'LIQUIDACAO_PAGAR',
  'MANUAL',
  'ESTORNO',
] as const;
export type FinancialMovementOrigin = (typeof FINANCIAL_MOVEMENT_ORIGINS)[number];

export const FINANCIAL_MOVEMENT_STATUSES = ['Ativo', 'Estornado'] as const;
export type FinancialMovementStatus = (typeof FINANCIAL_MOVEMENT_STATUSES)[number];

export interface FinancialSettlementDto {
  id: string;
  obligationId: string;
  valor: number;
  dataLiquidacao: string;
  metodo: string;
  observacoes: string | null;
  status: SettlementStatus;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialObligationDto {
  id: string;
  tipo: ObligationType;
  descricao: string;
  categoria: string | null;
  fornecedor: string | null;
  clientId: string | null;
  clientName?: string | null;
  appointmentId: string | null;
  attendanceId: string | null;
  valorOriginal: number;
  paidAmount: number;
  remainingBalance: number;
  dataVencimento: string;
  metodo: string | null;
  status: ObligationStatus;
  isOverdue: boolean;
  observacoes: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  settlements: FinancialSettlementDto[];
  createdAt: string;
  updatedAt: string;
}

export interface FinancialMovementDto {
  id: string;
  tipo: FinancialMovementType;
  origem: FinancialMovementOrigin;
  descricao: string;
  categoria: string | null;
  valor: number;
  dataMovimentacao: string;
  metodo: string;
  status: FinancialMovementStatus;
  clientId: string | null;
  clientName?: string | null;
  appointmentId?: string | null;
  attendanceId: string | null;
  paymentId: string | null;
  pixInstallmentId: string | null;
  obligationId: string | null;
  settlementId: string | null;
  reversedFromId: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashFlowSummaryDto {
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
  pendingReceivables: number;
  overdueReceivables: number;
  pendingPayables: number;
  overduePayables: number;
  inflowsByMethod: {
    metodo: string;
    method: string;
    label: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  outflowsByCategory: {
    categoria: string;
    total: number;
    count: number;
  }[];
}
