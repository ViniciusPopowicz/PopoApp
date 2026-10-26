// src/types/payment.ts

export const PAYMENT_METHODS = [
  'CartaoCredito',
  'Pix',
  'Dinheiro',
  'CartaoDebito',
  'Boleto',
  'Transferencia',
  'Outro',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CartaoCredito: 'Cartão de Crédito',
  Pix: 'PIX',
  pix_parcelado: 'PIX Parcelado',
  Dinheiro: 'Dinheiro',
  CartaoDebito: 'Cartão de Débito',
  Boleto: 'Boleto',
  Transferencia: 'Transferência',
  Outro: 'Outro',
};

export const PAYMENT_STATUSES = [
  'Pago',
  'Pendente',
  'Cancelado',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PIX_INSTALLMENT_STATUSES = [
  'Pendente',
  'Pago',
  'Atrasado',
  'Cancelado',
] as const;

export type PixInstallmentStatus = (typeof PIX_INSTALLMENT_STATUSES)[number];

export interface PixInstallmentDto {
  id: string;
  paymentId: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: PixInstallmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDto {
  id: string;
  attendanceId: string;
  valor: number;
  metodo: PaymentMethod;
  status: PaymentStatus;
  dataPagamento: string | null;
  numeroParcelas: number;
  identificadorTransacao: string | null;
  observacoes: string | null;
  pixInstallments?: PixInstallmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendancePaymentSummaryDto {
  attendanceId: string;
  standardTotal: number;
  practicedTotal: number;
  explicitDiscount: number;
  netTotal: number;
  paidTotal: number;
  outstandingBalance: number;
  isFullyPaid: boolean;
  payments: PaymentDto[];
}

export interface PixScheduleItemPreview {
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: string;
}

export interface PixSchedulePreviewDto {
  valorTotal: number;
  numeroParcelas: number;
  parcelas: PixScheduleItemPreview[];
}
