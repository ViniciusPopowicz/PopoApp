// src/types/dashboard.ts

export type DashboardPeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface FinancialMetricDto {
  grossRevenue: number;         // Soma dos valores praticados dos atendimentos realizados
  totalDiscounts: number;       // Descontos explícitos concedidos
  netRevenue: number;           // Faturamento líquido (bruto - descontos)
  receivedRevenue: number;      // Entradas em caixa (pagamentos com status 'Pago' no período)
  outstandingRevenue: number;   // Saldo a receber dos atendimentos realizados no período
}

export interface PaymentMethodBreakdownDto {
  metodo: string;               // 'Dinheiro' | 'Pix' | 'CartaoDebito' | 'CartaoCredito' | 'Boleto' | 'Transferencia' | 'Outro'
  label: string;                // Nome amigável pt-BR
  total: number;                // Valor total recebido no período
  count: number;                // Quantidade de transações
  percentage: number;           // Percentual (0 a 100)
}

export interface AccountsReceivableSummaryDto {
  totalOutstanding: number;     // Saldo total a receber de todos os atendimentos ativos
  attendancesCount: number;     // Quantidade de atendimentos com saldo em aberto
  clientsCount: number;         // Quantidade de clientes distintos com saldo em aberto
  overduePixInstallments: {
    total: number;              // Valor total de parcelas PIX vencidas
    count: number;              // Quantidade de parcelas PIX vencidas
  };
  upcomingPixInstallments: {
    total: number;              // Valor total de parcelas PIX a vencer
    count: number;              // Quantidade de parcelas PIX a vencer
  };
  topDebtors: Array<{
    attendanceId: string;
    clientId: string;
    clientName: string;
    clientPhone: string | null;
    clientCpf: string;
    attendanceDate: string;
    netTotal: number;
    paidTotal: number;
    outstandingBalance: number;
  }>;
}

export interface AppointmentsMetricsDto {
  todayTotal: number;
  byStatus: {
    agendado: number;
    confirmado: number;
    concluido: number;
    cancelado: number;
    naoCompareceu: number;
    reagendado: number;
  };
  upcomingList: Array<{
    id: string;
    clientId: string;
    clientName: string;
    clientPhotoUrl?: string | null;
    dataHora: string;
    status: string;
    duracaoMinutos: number;
    procedimentosPlanejados: string[];
  }>;
}

export interface AttendancesMetricsDto {
  todayTotal: number;
  realizadosCount: number;
  pendentesCount: number;
  canceladosCount: number;
  completionRate: number;       // Taxa de realização hoje (0 a 100)
}

export interface LowStockAlertDto {
  productId: string;
  productName: string;
  marca: string | null;
  categoria: string | null;
  unidade: string;
  isReusable: boolean;
  availableUnits: number;       // Unidades físicas disponíveis
  alertLevel: 'CRITICO' | 'BAIXO'; // 'CRITICO' se 0, 'BAIXO' se 1..5
}

export interface DashboardReminderItemDto {
  id: string;
  titulo: string;
  descricao: string | null;
  dataVencimento: string;
  prioridade: string;           // 'baixa' | 'media' | 'alta'
  status: string;               // 'pendente' | 'concluido' | 'dispensado'
  tipo: string;                 // 'parcela_pix' | 'retorno' | 'geral'
  clientId: string | null;
  clientName: string | null;
  pixInstallmentId: string | null;
  installmentValor: number | null;
  isOverdue: boolean;
}

export interface RemindersWidgetDto {
  summary: {
    totalPending: number;
    overdueCount: number;
    todayCount: number;
    upcomingCount: number;
  };
  items: DashboardReminderItemDto[];
}

export interface BirthdayItemDto {
  id: string;
  nome: string;
  dataNascimento: string;
  dataAniversario: string;      // DD/MM
  diasFaltando: number;
  telefone: string | null;
}

export interface DashboardSummaryResponseDto {
  period: {
    name: DashboardPeriod;
    startDate: string;
    endDate: string;
  };
  financial: {
    currentPeriod: FinancialMetricDto;
    daily: FinancialMetricDto;
    weekly: FinancialMetricDto;
    monthly: FinancialMetricDto;
    cashFlowByMethod: PaymentMethodBreakdownDto[];
    accountsReceivable: AccountsReceivableSummaryDto;
  };
  operations: {
    appointments: AppointmentsMetricsDto;
    attendances: AttendancesMetricsDto;
  };
  alerts: {
    lowStock: LowStockAlertDto[];
    reminders: RemindersWidgetDto;
    birthdays: BirthdayItemDto[];
  };
  legacyCompat: {
    receitasMes: number;
    despesasMes: number;
    saldoMes: number;
  };
}
