# Handoff Report: Milestone 4 Dashboard Metrics, Financial Aggregations & Master Test Architecture (explorer_m4_3)

- **Role**: Teamwork Explorer (`explorer_m4_3`)
- **Working Directory**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_3`
- **Workspace Root**: `c:\Users\Vinicius\PopoApp\PopoApp`
- **Recipient**: Orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`)
- **Status**: COMPLETE (Hard Handoff)
- **Timestamp**: 2026-10-16T03:20:00Z

---

## 1. Observation

### 1.1 Vitest Runner Concurrency Root-Cause & Verification
1. **Inspection of `vitest.config.ts` (lines 21–27)**:
   ```typescript
   18:     env: {
   19:       ...testEnv,
   20:       NODE_ENV: 'test',
   21:     },
   22:     poolOptions: {
   23:       forks: {
   24:         singleFork: true,
   25:       },
   26:     },
   27:   },
   ```
   - **Direct Finding**: `vitest.config.ts` configures `poolOptions.forks.singleFork: true`, but **omits `pool: 'forks'`**.
   - Under Vitest 2.1.9 (`vitest/2.1.9 win32-x64 node-v18.18.2`), the default execution pool is `'threads'`.
   - When `pool` defaults to `'threads'`, `poolOptions.forks` is ignored. Worker threads run tests with file concurrency against a single Microsoft SQL Server LocalDB test database (`PopoAppTest`). Concurrent executions of `cleanTestDatabase()` cause table truncation race conditions, foreign key conflicts, and spurious failures during `npm test`.
2. **Empirical Verification of the Single-Worker Fix (`task-104`)**:
   - Command executed: `npx vitest run --pool=forks`
   - Result: **32 test files passed (100%), 217 tests passed (100%), 0 failures** in 68.87 seconds.
   - Every single test file across Tier 1, Tier 2, Tier 3, Tier 4, and Tier 5 executed cleanly and deterministically against live SQL Server LocalDB without a single failure or timeout.

### 1.2 Database Schema & Domain Models for Financials & Reminders
1. **`prisma/schema.prisma` lines 304–323 (`Payment`)**:
   - `id`: UUID primary key.
   - `attendanceId`: FK to `Attendance` with `onDelete: NoAction`.
   - `valor`: Decimal(10, 2) mandatory.
   - `metodo`: String representing payment method (`'CartaoCredito'`, `'Pix'`, `'Dinheiro'`, `'CartaoDebito'`, `'Boleto'`, `'Transferencia'`).
   - `status`: String default `'Pago'` (`'Pago'`, `'Pendente'`, `'Cancelado'`).
   - `dataPagamento`: DateTime? default `now()`.
   - `numeroParcelas`: Int default 1. Used directly for credit card installment count ($1..12$) without creating sub-records (D5, V21).
   - `pixInstallments`: 1:N relation to `PixInstallment[]`.
2. **`prisma/schema.prisma` lines 325–343 (`PixInstallment`)**:
   - `paymentId`: FK to `Payment` with `onDelete: Cascade`.
   - `numeroParcela`: Int (e.g. 1, 2, 3).
   - `totalParcelas`: Int (e.g. 3).
   - `valor`: Decimal(10, 2).
   - `dataVencimento`: DateTime mandatory due date.
   - `dataPagamento`: DateTime? set when installment is paid.
   - `status`: String default `'Pendente'` (`'Pendente'`, `'Pago'`, `'Atrasado'`, `'Cancelado'`).
   - `reminders`: 1:N relation to `Reminder[]`.
3. **`prisma/schema.prisma` lines 345–366 (`Reminder`)**:
   - `clientId`: FK to `Client` (nullable).
   - `pixInstallmentId`: FK to `PixInstallment` (`onDelete: Cascade`).
   - `titulo`: String.
   - `descricao`: NVarChar(Max) nullable.
   - `dataVencimento`: DateTime.
   - `prioridade`: String default `'media'` (`'baixa'`, `'media'`, `'alta'`).
   - `status`: String default `'pendente'` (`'pendente'`, `'concluido'`, `'dispensado'`).
   - `tipo`: String default `'parcela_pix'` (`'parcela_pix'`, `'retorno'`, `'geral'`).
   - `completedAt`: DateTime? nullable.
4. **`prisma/schema.prisma` lines 194–258 (`Product`, `ProductLot`, `StockUnit`)**:
   - `Product` has 1:N `ProductLot[]`.
   - `ProductLot` has `dataValidade` (expiration date) and 1:N `StockUnit[]`.
   - `StockUnit` has `status` (`'Disponivel'`, `'EmUso'`, `'Esgotado'`, `'Descartado'`).
   - Low stock alert threshold in DISPATCH: $\le 5$ available physical units (`StockUnit.status === 'Disponivel'`).

### 1.3 Existing Dynamic Financial Calculations in `src/services/attendance.service.ts`
- **Lines 18–53 (`AttendanceService.computeFinancials`)**:
  - `standardTotal`: sum of `standardValueSnapshot` across performed procedures.
  - `practicedTotal`: sum of `practicedValue` across performed procedures.
  - `explicitDiscount`: `attendance.desconto` (explicitly set, never auto-computed from standard vs practiced delta per D2/V10).
  - `netTotal`: $\max(0, \text{practicedTotal} - \text{explicitDiscount})$.
  - `paidTotal`: sum of `Payment.valor` where `status === 'Pago'`.
  - `outstandingBalance`: $\max(0, \text{netTotal} - \text{paidTotal})$.
  - `isFullyPaid`: `netTotal > 0 && paidTotal >= netTotal`.
  - Invariant D2 is strictly satisfied: `total` and `outstandingBalance` are computed dynamically on the fly and never stored in database columns.

### 1.4 Frontend Mock Ingestion vs Production Requirements
- **`src/app/(authenticated)/page.tsx` (lines 20–182)**:
  - Renders StatCards: `Receitas`, `Despesas`, `Saldo` (currently importing from `src/data/mock/dashboard`).
  - Renders `Próximos Agendamentos` table (client name, date/time, status badge).
  - Renders `Aniversariantes` card (upcoming birthdays in current month).
  - Renders `Lembretes Pendentes` card (upcoming/overdue reminders).
- **`src/app/(authenticated)/financeiro/page.tsx` (lines 22–72)**:
  - Renders period navigation, revenue/expense/balance stat cards, and transaction table.
- **`src/app/(authenticated)/lembretes/page.tsx` (lines 18–98)**:
  - Renders reminder cards with status filter tabs: `Todos`, `Pendentes`, `Em Andamento`, `Concluídos`, `Atrasados`.

### 1.5 Tier 4 Workflows Observation
- In `tests/tier4_workflows/scenarios_a_through_e.spec.ts` (lines 41–58, 84–100), tests directly invoke `(prismaTest as any).attendance.create({ ... })` because service methods were not yet standardized during early Milestone 1/2. Now that `AttendanceService`, `PaymentService`, and `ReminderService` exist in Milestone 4, Scenarios A through E can be refactored to exercise the real service APIs.

---

## 2. Logic Chain

1. **Vitest Pool Resolution**:
   - Observation 1.1 shows Vitest 2.1.9 ignores `poolOptions.forks` when `pool: 'forks'` is not explicitly declared.
   - Observation 1.1 proves that executing with `--pool=forks` passes 100% of the 32 test files and 217 tests in 68.87 seconds.
   - Therefore, adding `pool: 'forks'` to `vitest.config.ts` immediately enables single-worker deterministic execution for `npm test` without altering package scripts or CLI commands.

2. **Dashboard Financial Metrics & Aggregation Consistency (D2, §25, F27)**:
   - Observation 1.3 establishes that `AttendanceService.computeFinancials` is the domain source of truth for attendance pricing and outstanding balances.
   - To aggregate gross and net revenue across periods (daily, weekly, monthly, custom):
     - Gross revenue must equal the sum of practiced values across completed attendances in the period.
     - Total discounts must equal the sum of explicit `desconto` across completed attendances in the period.
     - Net revenue must equal $\max(0, \text{Gross} - \text{Discounts})$.
     - Realized cash inflow must equal the sum of `Payment.valor` with `status === 'Pago'` whose `dataPagamento` falls within the period.
     - Cash flow by payment method must aggregate paid payments grouped by `metodo`, computing total, transaction count, and relative percentage.
     - Accounts receivable must evaluate all non-cancelled attendances: $\sum \max(0, \text{netTotal} - \text{paidTotal})$.

3. **Operations & Volume Metrics**:
   - Today's appointment volume: count appointments with `dataHora` between `startOfDay` and `endOfDay`, grouped by the 6 valid statuses (`Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`).
   - Today's attendances: count attendances scheduled/created today, computing completion rate as $\frac{\text{realizados}}{\text{realizados} + \text{pendentes}} \times 100$.
   - Next appointments widget: top 5 upcoming appointments ordered by `dataHora ASC` with client and procedure information.

4. **Low Stock Alert Invariant ($\le 5$ physical units)**:
   - Products have physical units represented by `StockUnit` through `ProductLot`.
   - Units are available if `StockUnit.status === 'Disponivel'` and the lot is not expired (`lot.dataValidade === null || lot.dataValidade > new Date()`).
   - Products with $\le 5$ available units are flagged:
     - 0 units available: alert level `'CRITICO'`.
     - 1 to 5 units available: alert level `'BAIXO'`.

5. **In-App Reminders & Decoupling Invariant (D5, V22, V23, AC 68)**:
   - Reminders are strictly in-app (D5).
   - PIX installments generate in-app reminders matching their due dates (V22).
   - Credit card installments do not generate reminders (V21).
   - Resolving or dismissing a reminder (`Reminder.status = 'concluido' | 'dispensado'`) modifies only the `Reminder` row and NEVER modifies `Payment.status`, `PixInstallment.status`, or the dynamic outstanding balance (V23).

6. **Milestone 4 Test Architecture Completeness**:
   - The test plan must cover Tier 1 (features F09, F10, F27), Tier 2 (validations V20, V21, V22, V23), Tier 3 (end-to-end combination test), and Tier 4 (real domain service invocation for Scenarios A–E), ensuring $\ge 5$ tests per feature/validation and 100% pass rate.

---

## 3. Caveats

1. **Frontend Presentation Pages (Phase 16)**: The frontend pages (`/`, `/financeiro`, `/lembretes`) currently consume mock data from `src/data/mock`. Wiring the UI components to the API routes created here is scheduled for Phase 16 (Milestone 5). The API routes designed in this specification return DTOs with both the full domain structure and a `legacyCompat` block, ensuring zero regression when the UI is switched.
2. **Practice Expenses**: PopoApp's database schema currently models clinical revenues, payments, and receivables, but does not have an `Expense` (`Despesa`) entity. For the dashboard StatCards (`Receitas`, `Despesas`, `Saldo`), expenses are currently treated as $0.00$, making `Saldo = Receitas`. If expense tracking is added in a future milestone, the service can easily incorporate it without breaking contracts.
3. **Timezone Handling**: All dates are queried using UTC boundaries or ISO strings with timezone offsets. Tests use standard JavaScript `Date` helpers to ensure consistency across LocalDB and client environments.

---

## 4. Conclusion (Turnkey Specification & Architecture Blueprint)

### 4.1 Vitest Configuration Fix (`vitest.config.ts`)

Apply the following 1-line addition to `vitest.config.ts`:

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      ...testEnv,
      NODE_ENV: 'test',
    },
    pool: 'forks', // <-- MANDATORY: Activates single-fork child process pool
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

### 4.2 Data Types & Contracts (`src/types/dashboard.ts`)

Create `src/types/dashboard.ts`:

```typescript
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
```

---

### 4.3 Validation Schema (`src/schemas/dashboard.ts`)

Create `src/schemas/dashboard.ts`:

```typescript
// src/schemas/dashboard.ts
import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year', 'all', 'custom']).optional().default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  refDate: z.string().optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
```

---

### 4.4 Dashboard Domain Service (`src/services/dashboard.service.ts`)

Create `src/services/dashboard.service.ts`:

```typescript
// src/services/dashboard.service.ts
import prisma from '@/lib/prisma';
import {
  DashboardPeriod,
  DashboardQueryInput,
} from '@/schemas/dashboard';
import {
  DashboardSummaryResponseDto,
  FinancialMetricDto,
  PaymentMethodBreakdownDto,
  AccountsReceivableSummaryDto,
  AppointmentsMetricsDto,
  AttendancesMetricsDto,
  LowStockAlertDto,
  RemindersWidgetDto,
  BirthdayItemDto,
} from '@/types/dashboard';

const METHOD_LABELS: Record<string, string> = {
  Dinheiro: 'Dinheiro',
  Pix: 'PIX',
  CartaoDebito: 'Cartão de Débito',
  CartaoCredito: 'Cartão de Crédito',
  Boleto: 'Boleto Bancário',
  Transferencia: 'Transferência Bancária',
  Outro: 'Outro',
};

export class DashboardService {
  /**
   * Helper to compute start and end timestamps based on period type and reference date.
   */
  static getDateRange(
    period: DashboardPeriod = 'month',
    refDateInput?: string | Date,
    customStart?: string,
    customEnd?: string
  ): { startDate: Date; endDate: Date } {
    const ref = refDateInput ? new Date(refDateInput) : new Date();

    if (period === 'custom' && customStart && customEnd) {
      return {
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      };
    }

    if (period === 'today') {
      const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
      const endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'week') {
      const day = ref.getDay(); // 0 is Sunday
      const diffToSunday = day;
      const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - diffToSunday, 0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'year') {
      const startDate = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
      const endDate = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'all') {
      return {
        startDate: new Date('2000-01-01T00:00:00.000Z'),
        endDate: new Date('2099-12-31T23:59:59.999Z'),
      };
    }

    // Default 'month'
    const startDate = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const endDate = new Date(ref.getFullYear(), ref.getMonth(), lastDayOfMonth, 23, 59, 59, 999);
    return { startDate, endDate };
  }

  /**
   * Computes gross, discounts, net, and received revenue for a specific time range.
   */
  static async getFinancialMetrics(startDate: Date, endDate: Date): Promise<FinancialMetricDto> {
    // 1. Completed attendances in period
    const attendances = await prisma.attendance.findMany({
      where: {
        status: 'Realizado',
        dataHora: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        desconto: true,
        procedures: { select: { practicedValue: true } },
        payments: { select: { valor: true, status: true } },
      },
    });

    let grossRevenue = 0;
    let totalDiscounts = 0;
    let netRevenue = 0;

    for (const att of attendances) {
      const practicedSum = att.procedures.reduce((acc, p) => acc + Number(p.practicedValue), 0);
      const discount = Number(att.desconto ?? 0);
      const net = Math.max(0, practicedSum - discount);

      grossRevenue += practicedSum;
      totalDiscounts += discount;
      netRevenue += net;
    }

    // 2. Realized cash receipts in period (actual payments received)
    const payments = await prisma.payment.findMany({
      where: {
        status: 'Pago',
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true },
    });

    const receivedRevenue = payments.reduce((acc, p) => acc + Number(p.valor), 0);

    // 3. Outstanding revenue for attendances executed in this period
    let paidForTheseAttendances = 0;
    for (const att of attendances) {
      paidForTheseAttendances += att.payments
        .filter((p) => p.status === 'Pago')
        .reduce((acc, p) => acc + Number(p.valor), 0);
    }
    const outstandingRevenue = Math.max(0, netRevenue - paidForTheseAttendances);

    return {
      grossRevenue,
      totalDiscounts,
      netRevenue,
      receivedRevenue,
      outstandingRevenue,
    };
  }

  /**
   * Computes cash flow breakdown grouped by payment method.
   */
  static async getCashFlowByMethod(startDate: Date, endDate: Date): Promise<PaymentMethodBreakdownDto[]> {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'Pago',
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true, metodo: true },
    });

    const totalReceived = payments.reduce((acc, p) => acc + Number(p.valor), 0);
    const methodMap = new Map<string, { total: number; count: number }>();

    for (const p of payments) {
      const current = methodMap.get(p.metodo) || { total: 0, count: 0 };
      current.total += Number(p.valor);
      current.count += 1;
      methodMap.set(p.metodo, current);
    }

    const result: PaymentMethodBreakdownDto[] = [];
    for (const [metodo, data] of methodMap.entries()) {
      result.push({
        metodo,
        label: METHOD_LABELS[metodo] || metodo,
        total: data.total,
        count: data.count,
        percentage: totalReceived > 0 ? Number(((data.total / totalReceived) * 100).toFixed(2)) : 0,
      });
    }

    return result.sort((a, b) => b.total - a.total);
  }

  /**
   * Computes accounts receivable summary across all active attendances (D2).
   */
  static async getAccountsReceivableSummary(): Promise<AccountsReceivableSummaryDto> {
    const activeAttendances = await prisma.attendance.findMany({
      where: { status: { not: 'Cancelado' } },
      select: {
        id: true,
        clientId: true,
        dataHora: true,
        desconto: true,
        client: { select: { id: true, nome: true, telefone: true, cpf: true } },
        procedures: { select: { practicedValue: true } },
        payments: { select: { valor: true, status: true } },
      },
    });

    let totalOutstanding = 0;
    const clientSet = new Set<string>();
    const debtorsList: AccountsReceivableSummaryDto['topDebtors'] = [];

    for (const att of activeAttendances) {
      const practicedTotal = att.procedures.reduce((acc, p) => acc + Number(p.practicedValue), 0);
      const explicitDiscount = Number(att.desconto ?? 0);
      const netTotal = Math.max(0, practicedTotal - explicitDiscount);
      const paidTotal = att.payments
        .filter((p) => p.status === 'Pago')
        .reduce((acc, p) => acc + Number(p.valor), 0);
      const outstandingBalance = Math.max(0, netTotal - paidTotal);

      if (outstandingBalance > 0) {
        totalOutstanding += outstandingBalance;
        clientSet.add(att.clientId);
        debtorsList.push({
          attendanceId: att.id,
          clientId: att.clientId,
          clientName: att.client.nome,
          clientPhone: att.client.telefone,
          clientCpf: att.client.cpf,
          attendanceDate: att.dataHora.toISOString(),
          netTotal,
          paidTotal,
          outstandingBalance,
        });
      }
    }

    debtorsList.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // PIX Installment status
    const now = new Date();
    const overduePix = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        dataVencimento: { lt: now },
      },
      select: { valor: true },
    });
    const upcomingPix = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        dataVencimento: { gte: now },
      },
      select: { valor: true },
    });

    return {
      totalOutstanding,
      attendancesCount: debtorsList.length,
      clientsCount: clientSet.size,
      overduePixInstallments: {
        total: overduePix.reduce((acc, p) => acc + Number(p.valor), 0),
        count: overduePix.length,
      },
      upcomingPixInstallments: {
        total: upcomingPix.reduce((acc, p) => acc + Number(p.valor), 0),
        count: upcomingPix.length,
      },
      topDebtors: debtorsList.slice(0, 10),
    };
  }

  /**
   * Computes appointment metrics and upcoming list for today.
   */
  static async getAppointmentsMetrics(todayStart: Date, todayEnd: Date, now: Date): Promise<AppointmentsMetricsDto> {
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        dataHora: { gte: todayStart, lte: todayEnd },
      },
      select: { status: true },
    });

    const byStatus = {
      agendado: 0,
      confirmado: 0,
      concluido: 0,
      cancelado: 0,
      naoCompareceu: 0,
      reagendado: 0,
    };

    for (const appt of todayAppointments) {
      if (appt.status === 'Agendado') byStatus.agendado++;
      else if (appt.status === 'Confirmado') byStatus.confirmado++;
      else if (appt.status === 'Concluído') byStatus.concluido++;
      else if (appt.status === 'Cancelado') byStatus.cancelado++;
      else if (appt.status === 'Não compareceu') byStatus.naoCompareceu++;
      else if (appt.status === 'Reagendado') byStatus.reagendado++;
    }

    const upcomingRaw = await prisma.appointment.findMany({
      where: {
        dataHora: { gte: now },
        status: { notIn: ['Cancelado', 'Não compareceu', 'Concluído'] },
      },
      orderBy: { dataHora: 'asc' },
      take: 5,
      include: {
        client: { select: { id: true, nome: true, profilePhotoUrl: true } },
        plannedProcedures: { include: { procedure: { select: { nome: true } } } },
      },
    });

    const upcomingList = upcomingRaw.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.client.nome,
      clientPhotoUrl: a.client.profilePhotoUrl,
      dataHora: a.dataHora.toISOString(),
      status: a.status,
      duracaoMinutos: a.duracaoMinutos,
      procedimentosPlanejados: a.plannedProcedures.map((p) => p.procedure.nome),
    }));

    return {
      todayTotal: todayAppointments.length,
      byStatus,
      upcomingList,
    };
  }

  /**
   * Computes attendance volume and completion rate for today.
   */
  static async getAttendancesMetrics(todayStart: Date, todayEnd: Date): Promise<AttendancesMetricsDto> {
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        dataHora: { gte: todayStart, lte: todayEnd },
      },
      select: { status: true },
    });

    let realizadosCount = 0;
    let pendentesCount = 0;
    let canceladosCount = 0;

    for (const att of todayAttendances) {
      if (att.status === 'Realizado') realizadosCount++;
      else if (att.status === 'Pendente') pendentesCount++;
      else if (att.status === 'Cancelado') canceladosCount++;
    }

    const totalActive = realizadosCount + pendentesCount;
    const completionRate = totalActive > 0 ? Number(((realizadosCount / totalActive) * 100).toFixed(1)) : 0;

    return {
      todayTotal: todayAttendances.length,
      realizadosCount,
      pendentesCount,
      canceladosCount,
      completionRate,
    };
  }

  /**
   * Computes low stock alerts for active products with <= 5 available units.
   */
  static async getLowStockAlerts(now: Date): Promise<LowStockAlertDto[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nome: true,
        marca: true,
        categoria: true,
        unidade: true,
        isReusable: true,
        lots: {
          select: {
            dataValidade: true,
            stockUnits: {
              where: { status: 'Disponivel' },
              select: { id: true },
            },
          },
        },
      },
    });

    const alerts: LowStockAlertDto[] = [];

    for (const prod of products) {
      let availableUnits = 0;
      for (const lot of prod.lots) {
        // Exclude expired lots
        if (!lot.dataValidade || lot.dataValidade > now) {
          availableUnits += lot.stockUnits.length;
        }
      }

      if (availableUnits <= 5) {
        alerts.push({
          productId: prod.id,
          productName: prod.nome,
          marca: prod.marca,
          categoria: prod.categoria,
          unidade: prod.unidade,
          isReusable: prod.isReusable,
          availableUnits,
          alertLevel: availableUnits === 0 ? 'CRITICO' : 'BAIXO',
        });
      }
    }

    return alerts.sort((a, b) => a.availableUnits - b.availableUnits);
  }

  /**
   * Computes in-app reminders feed for pending reminders.
   */
  static async getRemindersWidget(todayStart: Date, todayEnd: Date): Promise<RemindersWidgetDto> {
    const pendingReminders = await prisma.reminder.findMany({
      where: { status: 'pendente' },
      orderBy: { dataVencimento: 'asc' },
      take: 10,
      include: {
        client: { select: { id: true, nome: true } },
        pixInstallment: { select: { id: true, valor: true, numeroParcela: true, totalParcelas: true } },
      },
    });

    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;

    const items = pendingReminders.map((r) => {
      const isOverdue = r.dataVencimento < todayStart;
      const isToday = r.dataVencimento >= todayStart && r.dataVencimento <= todayEnd;

      if (isOverdue) overdueCount++;
      else if (isToday) todayCount++;
      else upcomingCount++;

      return {
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        dataVencimento: r.dataVencimento.toISOString(),
        prioridade: r.prioridade,
        status: r.status,
        tipo: r.tipo,
        clientId: r.clientId,
        clientName: r.client?.nome ?? null,
        pixInstallmentId: r.pixInstallmentId,
        installmentValor: r.pixInstallment ? Number(r.pixInstallment.valor) : null,
        isOverdue,
      };
    });

    return {
      summary: {
        totalPending: pendingReminders.length,
        overdueCount,
        todayCount,
        upcomingCount,
      },
      items,
    };
  }

  /**
   * Computes upcoming birthdays within current month or next 30 days.
   */
  static async getBirthdays(now: Date): Promise<BirthdayItemDto[]> {
    const clients = await prisma.client.findMany({
      where: {
        isActive: true,
        dataNascimento: { not: null },
      },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        telefone: true,
      },
    });

    const currentYear = now.getFullYear();
    const results: BirthdayItemDto[] = [];

    for (const client of clients) {
      if (!client.dataNascimento) continue;
      const bday = new Date(client.dataNascimento);
      const bdayThisYear = new Date(currentYear, bday.getMonth(), bday.getDate());

      // If already passed this year, look at next year
      if (bdayThisYear < now) {
        bdayThisYear.setFullYear(currentYear + 1);
      }

      const diffTime = bdayThisYear.getTime() - now.getTime();
      const diasFaltando = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diasFaltando <= 30) {
        results.push({
          id: client.id,
          nome: client.nome,
          dataNascimento: client.dataNascimento.toISOString(),
          dataAniversario: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}`,
          diasFaltando,
          telefone: client.telefone,
        });
      }
    }

    return results.sort((a, b) => a.diasFaltando - b.diasFaltando).slice(0, 5);
  }

  /**
   * Master aggregator for executive dashboard payload.
   */
  static async getDashboardSummary(input?: DashboardQueryInput): Promise<DashboardSummaryResponseDto> {
    const period = input?.period ?? 'month';
    const refDate = input?.refDate ? new Date(input.refDate) : new Date();
    const { startDate, endDate } = this.getDateRange(period, refDate, input?.startDate, input?.endDate);

    const now = new Date();
    const todayRange = this.getDateRange('today', now);
    const weekRange = this.getDateRange('week', now);
    const monthRange = this.getDateRange('month', now);

    const [
      currentPeriodFinancial,
      dailyFinancial,
      weeklyFinancial,
      monthlyFinancial,
      cashFlowByMethod,
      accountsReceivable,
      appointments,
      attendances,
      lowStock,
      reminders,
      birthdays,
    ] = await Promise.all([
      this.getFinancialMetrics(startDate, endDate),
      this.getFinancialMetrics(todayRange.startDate, todayRange.endDate),
      this.getFinancialMetrics(weekRange.startDate, weekRange.endDate),
      this.getFinancialMetrics(monthRange.startDate, monthRange.endDate),
      this.getCashFlowByMethod(startDate, endDate),
      this.getAccountsReceivableSummary(),
      this.getAppointmentsMetrics(todayRange.startDate, todayRange.endDate, now),
      this.getAttendancesMetrics(todayRange.startDate, todayRange.endDate),
      this.getLowStockAlerts(now),
      this.getRemindersWidget(todayRange.startDate, todayRange.endDate),
      this.getBirthdays(now),
    ]);

    return {
      period: {
        name: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      financial: {
        currentPeriod: currentPeriodFinancial,
        daily: dailyFinancial,
        weekly: weeklyFinancial,
        monthly: monthlyFinancial,
        cashFlowByMethod,
        accountsReceivable,
      },
      operations: {
        appointments,
        attendances,
      },
      alerts: {
        lowStock,
        reminders,
        birthdays,
      },
      legacyCompat: {
        receitasMes: monthlyFinancial.receivedRevenue,
        despesasMes: 0,
        saldoMes: monthlyFinancial.receivedRevenue,
      },
    };
  }
}
```

---

### 4.5 API Route Handlers

#### 1. Executive Dashboard API (`src/app/api/dashboard/summary/route.ts`)

```typescript
// src/app/api/dashboard/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { DashboardService } from '@/services/dashboard.service';
import { dashboardQuerySchema } from '@/schemas/dashboard';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rawQuery = {
    period: searchParams.get('period') ?? 'month',
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    refDate: searchParams.get('refDate') ?? undefined,
  };

  const parsed = dashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros de consulta inválidos', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const summary = await DashboardService.getDashboardSummary(parsed.data);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('Error in /api/dashboard/summary:', err);
    return NextResponse.json({ error: 'Erro interno ao gerar métricas do dashboard' }, { status: 500 });
  }
}
```

#### 2. Financial Summary API (`src/app/api/financial/summary/route.ts`)

```typescript
// src/app/api/financial/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { DashboardService } from '@/services/dashboard.service';
import { dashboardQuerySchema } from '@/schemas/dashboard';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const rawQuery = {
    period: searchParams.get('period') ?? 'month',
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  };

  const parsed = dashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const { startDate, endDate } = DashboardService.getDateRange(
    parsed.data.period,
    undefined,
    parsed.data.startDate,
    parsed.data.endDate
  );

  const [metrics, cashFlow, receivables] = await Promise.all([
    DashboardService.getFinancialMetrics(startDate, endDate),
    DashboardService.getCashFlowByMethod(startDate, endDate),
    DashboardService.getAccountsReceivableSummary(),
  ]);

  return NextResponse.json({
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    metrics,
    cashFlow,
    receivables,
  });
}
```

#### 3. Financial Transactions Ledger API (`src/app/api/financial/transactions/route.ts`)

```typescript
// src/app/api/financial/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const status = searchParams.get('status') ?? undefined;
  const metodo = searchParams.get('metodo') ?? undefined;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (metodo) where.metodo = metodo;

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dataPagamento: 'desc' },
      include: {
        attendance: {
          select: {
            id: true,
            dataHora: true,
            status: true,
            desconto: true,
            client: { select: { id: true, nome: true, cpf: true } },
            procedures: {
              select: {
                practicedValue: true,
                procedure: { select: { nome: true } },
              },
            },
          },
        },
        pixInstallments: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: payments.map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      metodo: p.metodo,
      status: p.status,
      dataPagamento: p.dataPagamento?.toISOString() ?? p.createdAt.toISOString(),
      numeroParcelas: p.numeroParcelas,
      identificadorTransacao: p.identificadorTransacao,
      observacoes: p.observacoes,
      attendance: {
        id: p.attendance.id,
        dataHora: p.attendance.dataHora.toISOString(),
        status: p.attendance.status,
        desconto: Number(p.attendance.desconto),
        client: p.attendance.client,
        procedures: p.attendance.procedures.map((proc) => ({
          nome: proc.procedure.nome,
          practicedValue: Number(proc.practicedValue),
        })),
      },
      pixInstallments: p.pixInstallments.map((inst) => ({
        id: inst.id,
        numeroParcela: inst.numeroParcela,
        totalParcelas: inst.totalParcelas,
        valor: Number(inst.valor),
        dataVencimento: inst.dataVencimento.toISOString(),
        status: inst.status,
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

---

### 4.6 Master Milestone 4 Test Suite Architecture

The Milestone 4 test suite consists of **8 new test files** structured across Tiers 1–3, plus a targeted refactoring of Tier 4:

```
tests/
├── tier1_features/
│   ├── f09_payment_service.spec.ts         (Feature F09/F25: PaymentService, 6 tests)
│   ├── f10_reminder_service.spec.ts        (Feature F10/F26: ReminderService, 6 tests)
│   └── f27_dashboard_service.spec.ts       (Feature F27: DashboardService & Metrics, 6 tests)
├── tier2_boundaries/
│   ├── v20_attendance_multiple_payments.spec.ts (Validation V20 & D2: Multi-method, partial, dynamic balances, 5 tests)
│   ├── v21_card_installment_no_reminders.spec.ts (Validation V21 & D5: Card installments count, zero reminders, 5 tests)
│   ├── v22_pix_installment_reminders.spec.ts    (Validation V22 & D5: PIX installment schedule & in-app reminders, 5 tests)
│   └── v23_reminder_state_payment_truth.spec.ts (Validation V23 & D5: Reminder status decoupled from payment truth, 5 tests)
├── tier3_combinations/
│   └── m4_financial_reminders_e2e.spec.ts  (Cross-feature E2E: appt -> att -> procedures -> discount -> payment -> PIX schedule -> reminders -> dashboard metrics -> resolution, 1 test / multi-step)
└── tier4_workflows/
    └── scenarios_a_through_e.spec.ts       (Refactoring: Upgrade Scenario A & B to use real AttendanceService domain calls)
```

#### Detailed Test Specification Blueprint:

#### 1. `tests/tier1_features/f09_payment_service.spec.ts` (6 tests)
- `F09.1 - Record single payment`: Register Dinheiro R$ 200 for attendance; assert `status === 'Pago'`, linked to attendance, updates dynamic `outstandingBalance`.
- `F09.2 - Record credit card payment with installment count`: Register `CartaoCredito` R$ 600 with `numeroParcelas: 3`; assert `numeroParcelas` stored, creates 0 `PixInstallment` records, creates 0 `Reminder` records (V21).
- `F09.3 - Record PIX payment with installment schedule`: Register `Pix` R$ 600 with 3 installments of R$ 200; assert 3 `PixInstallment` records created with sequential `numeroParcela`, distinct `dataVencimento`, and `status: 'Pendente'`.
- `F09.4 - Update PIX installment status`: Pay installment 1; assert status transitions to `'Pago'`, sets `dataPagamento`, and dynamic `paidTotal` increases.
- `F09.5 - List and filter payments`: Query payments by `attendanceId` and verify relational includes and totals.
- `F09.6 - Validation error on invalid amount`: Payment with `valor <= 0` throws `ValidationError`.

#### 2. `tests/tier1_features/f10_reminder_service.spec.ts` (6 tests)
- `F10.1 - Generate reminders for PIX installment schedule`: Given a PIX payment with 3 installments, generate reminders; verify 3 in-app reminders created linked to `pixInstallmentId` and `clientId` with matching due dates.
- `F10.2 - Zero reminders for credit card payment`: Card payment with 6 installments creates 0 reminders (D5, V21).
- `F10.3 - List reminders with status filter`: Query reminders filtered by `status: 'pendente'`; verify client details and installment values are returned.
- `F10.4 - Mark reminder resolved (concluido)`: Toggle reminder to `'concluido'`; verify `completedAt` timestamp is set and status is `'concluido'`.
- `F10.5 - Dismiss reminder (dispensado)`: Toggle reminder to `'dispensado'`; verify reminder status updates.
- `F10.6 - Reminders feed categorization`: Categorize pending reminders into overdue (`dataVencimento < today`), today, and upcoming.

#### 3. `tests/tier1_features/f27_dashboard_service.spec.ts` (6 tests)
- `F27.1 - Calculate gross and net revenue metrics`: Create completed attendances with practiced values and explicit discounts; verify `DashboardService.getDashboardSummary()` returns accurate gross revenue, total discounts, net revenue, and received cash flow.
- `F27.2 - Cash flow breakdown by payment method`: Given payments across Dinheiro, Pix, CartaoDebito, and CartaoCredito; verify method totals, transaction counts, and percentages match.
- `F27.3 - Accounts receivable summary`: Given attendances with unpaid balances; verify total outstanding balance, debtor count, and top debtors list.
- `F27.4 - Appointment & attendance volume metrics`: Given appointments and attendances today; verify scheduled counts, completion rate, and upcoming list.
- `F27.5 - Low stock alert feed (units <= 5)`: Create products with 0, 3, and 10 available units; verify products with $\le 5$ units appear in feed with `CRITICO` (0) or `BAIXO` (1..5) alert levels, sorted ascending.
- `F27.6 - In-app reminders widget feed`: Verify pending PIX installment reminders appear in dashboard widget with overdue/today/upcoming categorization.

#### 4. `tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts` (5 tests)
- `V20.1 - Multiple payments across 3 distinct methods`: Attendance with procedures total R$ 1,000, discount R$ 100 (net R$ 900). Record Dinheiro R$ 200 + Cartão Débito R$ 300 + PIX R$ 250 -> verify `paidTotal = 750`, `outstandingBalance = 150`, `isFullyPaid = false`.
- `V20.2 - Settlement payment clears balance`: Record final PIX payment R$ 150 -> verify `paidTotal = 900`, `outstandingBalance = 0`, `isFullyPaid = true`.
- `V20.3 - Non-paid payments excluded from paidTotal`: Add payments with `status: 'Pendente'` and `status: 'Cancelado'` -> verify neither affects `paidTotal` or `outstandingBalance`.
- `V20.4 - Attendance with zero procedures`: Assert `netTotal = 0.00`, `outstandingBalance = 0.00`.
- `V20.5 - Fractional cent precision`: Split R$ 100 into R$ 33.33, R$ 33.33, R$ 33.34 -> verify zero cent drift.

#### 5. `tests/tier2_boundaries/v21_card_installment_no_reminders.spec.ts` (5 tests)
- `V21.1 - 1-installment credit card`: Creates 0 `PixInstallment` and 0 `Reminder`.
- `V21.2 - 6-installment credit card`: Creates 0 `PixInstallment` and 0 `Reminder`.
- `V21.3 - 12-installment boundary credit card`: Creates 0 `PixInstallment` and 0 `Reminder`.
- `V21.4 - Reminder scan query`: Verify reminder scan query ignores credit card payments entirely.
- `V21.5 - Validation rejects invalid count`: `numeroParcelas < 1` or non-integer throws `ValidationError`.

#### 6. `tests/tier2_boundaries/v22_pix_installment_reminders.spec.ts` (5 tests)
- `V22.1 - Single PIX installment`: Creates 1 `PixInstallment` and 1 `Reminder` with matching due date.
- `V22.2 - Multi-installment schedule (5 installments of R$ 200)`: Creates 5 `PixInstallment` records and 5 `Reminder` records with sequential titles (`"Parcela 1/5 - PIX"`).
- `V22.3 - Reminder query joins`: Querying reminders correctly joins client name and installment value.
- `V22.4 - Multi-client isolation`: Reminders for Client A and Client B remain completely isolated.
- `V22.5 - Cascade deletion`: Deleting `PixInstallment` cascades to delete linked `Reminder`.

#### 7. `tests/tier2_boundaries/v23_reminder_state_payment_truth.spec.ts` (5 tests)
- `V23.1 - Marking reminder 'concluido' does NOT mark installment/payment paid`: Mark reminder as `'concluido'`; verify `PixInstallment.status` remains `'Pendente'`, `Payment.status` remains `'Pendente'`, and `outstandingBalance` is completely unchanged (AC 68).
- `V23.2 - Dismissing reminder ('dispensado') does NOT alter balance`: Mark reminder as `'dispensado'`; verify financial balance remains identical.
- `V23.3 - Paying installment does not corrupt reminder`: Paying installment updates payment truth without corrupting completed reminders.
- `V23.4 - Invalid status transitions rejected`: Updating reminder to invalid status string throws `ValidationError`.
- `V23.5 - Database trigger/cascade isolation`: Verify zero triggers mutate `Payment` when `Reminder` is updated.

#### 8. `tests/tier3_combinations/m4_financial_reminders_e2e.spec.ts` (1 comprehensive test)
- Comprehensive end-to-end integration test executing the complete clinical-financial journey:
  1. Create Client with unique CPF.
  2. Create Appointment and auto-created pending Attendance (D1).
  3. Add 2 procedures with practiced values R$ 600 + R$ 400 = R$ 1,000.
  4. Apply explicit discount R$ 100 -> net total = R$ 900 (D2).
  5. Consume 1 reusable stock unit for Client (V16).
  6. Register partial Credit Card payment R$ 300 (3 installments, 0 reminders) (V21).
  7. Register PIX installment plan for remaining R$ 600 (3 installments of R$ 200 with due dates) (V22).
  8. In-app reminders generated for PIX installments (V22).
  9. Assert `DashboardService.getDashboardSummary()`:
     - Gross revenue reflects R$ 1,000.
     - Discounts reflect R$ 100.
     - Net revenue reflects R$ 900.
     - Received cash reflects R$ 300.
     - Accounts receivable reflects R$ 600.
     - Cash flow breakdown shows Credit Card R$ 300.
     - Low stock feed updates available stock.
     - Reminders widget reflects 3 upcoming PIX reminders.
  10. Resolve reminder 1 -> verify `outstandingBalance` remains R$ 600 (V23).
  11. Mark PIX installment 1 as paid -> verify `outstandingBalance` drops to R$ 400 and received cash increases to R$ 500.
  12. Complete Attendance (`Realizado`) -> Appointment transitions to `Concluído`.

#### 9. Refactoring of `tests/tier4_workflows/scenarios_a_through_e.spec.ts`
- Replace raw `(prismaTest as any).attendance.create({ data: { ... } })` in Scenarios A and B with real domain service calls:
  - `const appt = await AppointmentService.createAppointment({ ... });`
  - `await AttendanceService.addProcedure(att.id, { procedureId, practicedValue: 400 });`
  - `await AttendanceService.setDiscount(att.id, { desconto: 100 });`
  - `const financials = await AttendanceService.getAttendanceById(att.id);`
  - Preserves exact §47 values and assertions while exercising the real domain services.

---

## 5. Verification Method

To independently verify all findings and test specifications:

1. **Verify Database Proxy & Connection**:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   npm run db:proxy
   ```

2. **Verify the Single-Worker Test Suite**:
   ```powershell
   npx vitest run --pool=forks
   # Expected result: 32 test files passed (100%), 217 tests passed (100%), 0 failures
   ```

3. **Verify Linter and Next.js Build**:
   ```powershell
   npm run lint
   # Expected: ✔ No ESLint warnings or errors
   npm run build
   # Expected: Exit code 0, 21 static pages and 30 API route handlers compiled cleanly
   ```

4. **Invalidation Conditions**:
   - If `npm test` fails with concurrency/truncation errors when `pool: 'forks'` is omitted from `vitest.config.ts`, this confirms finding 1.1.
   - If resolving a reminder alters `Payment.status` or `Attendance` outstanding balance, validation V23 is violated.
   - If credit card payments generate reminder rows, validation V21 is violated.
   - If low-stock alerts include products with $>5$ available units or products from expired lots, F27 is violated.
