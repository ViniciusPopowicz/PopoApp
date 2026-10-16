# Handoff Report: Milestone 4 Payment Service & Installments Engine Architecture

- **Author**: `explorer_m4_1`
- **Role**: `teamwork_preview_explorer`
- **Target Recipient**: Orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`) and Implementation Worker (`worker_m4_1`)
- **Working Directory**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_1`
- **Workspace Root**: `c:\Users\Vinicius\PopoApp\PopoApp`
- **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

### 1.1 Database Schema State (`prisma/schema.prisma`)
Direct inspection of `prisma/schema.prisma` lines 304–367 revealed the existing models for payments and installments:
```prisma
model Payment {
  id                     String           @id @default(uuid())
  attendanceId           String
  valor                  Decimal          @db.Decimal(10, 2)
  metodo                 String           // 'CartaoCredito', 'Pix', 'Dinheiro', 'CartaoDebito', 'Boleto', 'Transferencia'
  status                 String           @default("Pago") // 'Pago', 'Pendente', 'Cancelado'
  dataPagamento          DateTime?        @default(now())
  numeroParcelas         Int              @default(1)
  identificadorTransacao String?
  observacoes            String?
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pixInstallments PixInstallment[]

  @@index([attendanceId])
  @@index([metodo])
  @@index([status])
}

model PixInstallment {
  id             String     @id @default(uuid())
  paymentId      String
  numeroParcela  Int
  totalParcelas  Int
  valor          Decimal    @db.Decimal(10, 2)
  dataVencimento DateTime
  dataPagamento  DateTime?
  status         String     @default("Pendente") // 'Pendente', 'Pago', 'Atrasado', 'Cancelado'
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  payment   Payment    @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  reminders Reminder[]

  @@index([paymentId])
  @@index([dataVencimento])
  @@index([status])
}

model Reminder {
  id               String          @id @default(uuid())
  clientId         String?
  pixInstallmentId String?
  titulo           String
  descricao        String?         @db.NVarChar(Max)
  dataVencimento   DateTime
  prioridade       String          @default("media") // 'baixa', 'media', 'alta'
  status           String          @default("pendente") // 'pendente', 'concluido', 'dispensado'
  tipo             String          @default("parcela_pix") // 'parcela_pix', 'retorno', 'geral'
  completedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@index([clientId])
  @@index([pixInstallmentId])
  @@index([dataVencimento])
  @@index([status])
}
```

Key Schema Observations:
1. The model is named **`PixInstallment`** (not `PaymentInstallment`). The relation field on `Payment` is `pixInstallments`.
2. `PixInstallment` has a cascade delete relationship with `Payment` (`onDelete: Cascade`), and `Reminder` has a cascade delete with `PixInstallment` (`onDelete: Cascade`).
3. Monetary amounts (`valor`) are typed `@db.Decimal(10, 2)` across `Payment` and `PixInstallment`.
4. The migration `20261006000000_init_domain_models/migration.sql` creating these exact tables is already deployed on both development DB (`PopoApp`) and test DB (`PopoAppTest`). No database migrations are needed.

### 1.2 Existing Attendance Financial Engine (`src/services/attendance.service.ts`)
Lines 18–53 of `src/services/attendance.service.ts`:
```typescript
  static computeFinancials(attendance: {
    desconto?: Prisma.Decimal | number | null;
    procedures?: { standardValueSnapshot?: Prisma.Decimal | number; practicedValue?: Prisma.Decimal | number }[];
    payments?: { valor?: Prisma.Decimal | number; status?: string }[];
  }): AttendanceFinancialsDto {
    const procs = attendance.procedures ?? [];
    const standardTotal = procs.reduce(
      (acc, p) => acc + Number(p.standardValueSnapshot ?? 0),
      0
    );

    const practicedTotal = procs.reduce(
      (acc, p) => acc + Number(p.practicedValue ?? 0),
      0
    );

    const explicitDiscount = Number(attendance.desconto ?? 0);
    const netTotal = Math.max(0, practicedTotal - explicitDiscount);

    const paidTotal = (attendance.payments ?? [])
      .filter((pay) => pay.status === 'Pago')
      .reduce((acc, pay) => acc + Number(pay.valor ?? 0), 0);

    const outstandingBalance = Math.max(0, netTotal - paidTotal);
    const isFullyPaid = netTotal > 0 && paidTotal >= netTotal;

    return {
      standardTotal,
      practicedTotal,
      explicitDiscount,
      netTotal,
      paidTotal,
      outstandingBalance,
      isFullyPaid,
    };
  }
```
And lines 114–117 in `getAttendanceById`:
```typescript
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
```
Crucial Observation:
`computeFinancials` currently filters payments solely by `pay.status === 'Pago'`. For a PIX payment split into installments, the parent `Payment` has initial status `'Pendente'`. If `computeFinancials` only looks at `pay.status === 'Pago'`, it computes `0` paid even after individual installments are paid. Conversely, if `Payment` was set to `'Pago'` immediately, it would falsely mark the entire future installment amount as paid on day zero.
Therefore, `computeFinancials` must be updated to aggregate paid installments when `pixInstallments` are present.

### 1.3 Binding Business Rules from Specifications
- **D2 (ORIGINAL_REQUEST.md line 19)**: Attendance total = sum(practiced values) - explicit discount. Outstanding = total - sum(paid payments). Both computed dynamically, not stored in the database.
- **D5 (ORIGINAL_REQUEST.md line 22)**: In-app reminders only. Lembretes page + dashboard feed of upcoming and overdue PIX installments. Reminders can be marked done or dismissed. No external delivery (WhatsApp, email, SMS).
- **V20 (§32 / IMPLEMENTATION_CHECKLIST.md line 652)**: Attendance may have multiple payments across different methods and dates.
- **V21 (§32 / Dev Spec §22, §32)**: Credit card installments store total amount, payment method = `CartaoCredito`, and installment count `numeroParcelas` ($1..12$). Credit card installments **do NOT create installment rows and generate ZERO reminders**.
- **V22 (§32 / Dev Spec §23, §32)**: PIX installments generate an agreed installment schedule with individual installment records (`PixInstallment`), each with `numeroParcela`, `valor`, `dataVencimento`, and `status`. Used to generate in-app reminders (`Reminder`).
- **V23 (§32 / Dev Spec §23, §32, D5)**: Reminder state must NOT replace payment truth. Marking a reminder `concluido` or `dispensado` never mutates `PixInstallment.status`, `Payment.status`, or the attendance outstanding balance.
- **AC 58**: A test with several procedures, a discount, and partial payments across two methods asserts the exact total and outstanding values.
- **AC 65 & Scenario E**: Attendance total R$ 1.000 (two procedures of R$ 500). R$ 400 paid via Credit Card (2x, 0 reminders). R$ 600 scheduled in 3x PIX (3 reminders). Outstanding updates accurately to R$ 600.
- **AC 68**: PIX installment reminders appear in reminders and dashboard; credit card installments generate none.

### 1.4 Next.js 15 App Router Dynamic Route Handlers
Across existing routes (e.g. `src/app/api/attendances/[id]/discount/route.ts` line 7, `src/app/api/clients/[id]/history/route.ts` line 7):
Route params are passed as a Promise: `{ params }: { params: Promise<{ id: string }> }`.
Handlers must await `params`: `const { id } = await params;`.

---

## 2. Logic Chain

1. **Model Concordance (Obs 1.1)**:
   The database schema already defines `Payment` and `PixInstallment` tables. Creating duplicate tables or renaming `PixInstallment` to `PaymentInstallment` would break existing migrations and LocalDB deployment. Therefore, our service and types must use `PixInstallment` (with TypeScript aliases where convenient) and bind directly to Prisma's `prisma.payment` and `prisma.pixInstallment`.

2. **Credit Card Semantics (Obs 1.3 — V21)**:
   In aesthetic clinics, credit card transactions are captured via POS terminal / card acquirer. The clinic receives payout from the acquirer according to the card contract. The client's debt is with the card issuer, not the clinic. Therefore, for `metodo: 'CartaoCredito'`:
   - Store total transaction `valor`.
   - Store `numeroParcelas` ($1..12$).
   - Status is `'Pago'`.
   - Generate **zero** `PixInstallment` records and **zero** `Reminder` records.

3. **PIX Installment Plan Semantics (Obs 1.3 — V22)**:
   PIX installments are a bilateral financing arrangement agreed directly between the clinic and the client (e.g. R$ 600 split into 3 monthly transfers of R$ 200). Therefore:
   - Create a parent `Payment` record with `metodo: 'Pix'`, `valor: 600.00`, `status: 'Pendente'`, `numeroParcelas: 3`.
   - Create $N$ children in `PixInstallment` with `numeroParcela`, `totalParcelas`, `valor`, `dataVencimento`, `status: 'Pendente'`.
   - For each `PixInstallment`, automatically create a `Reminder` with `tipo: 'parcela_pix'`, `clientId: attendance.clientId`, `pixInstallmentId: installment.id`, `dataVencimento: installment.dataVencimento`, `status: 'pendente'`.
   - Brazilian cent rounding rule: If $Total / N$ has fractional cents, allocate the remainder to installment 1 so that $\sum(\text{installment.valor}) \equiv \text{payment.valor}$.

4. **Dynamic Balance Reconciliation (Obs 1.2 — D2, V20)**:
   At schedule creation, none of the PIX installments have been paid. Outstanding balance is $Total - \text{paidImmediate}$.
   When client pays installment $k$:
   - `PixInstallment.status` is updated to `'Pago'`, with `dataPagamento: new Date()`.
   - `AttendanceService.computeFinancials` must sum paid installments:
     $$\text{paidTotal} = \sum_{\text{direct paid payments}} \text{valor} + \sum_{\text{paid pixInstallments}} \text{valor}$$
   - When all $N$ installments are `'Pago'`, parent `Payment.status` transitions from `'Pendente'` to `'Pago'`.
   - When total paid equals net total, `outstandingBalance` becomes `0.00` and `isFullyPaid` becomes `true`.

5. **Financial Guardrails (Obs 1.3 — V20)**:
   - Payments cannot be registered against an attendance with status `'Cancelado'`.
   - A payment amount cannot exceed the current `outstandingBalance`. Any attempt throws `ValidationError('O valor do pagamento não pode ser superior ao saldo devedor (R$ X,XX)')`.
   - Payment amount must be strictly positive (`valor > 0`).

6. **Decoupling Invariant (Obs 1.3 — V23)**:
   Reminders are operational notifications, not financial ledgers. Marking a reminder `concluido` or `dispensado` never updates `PixInstallment.status` or `Payment.status`. Conversely, paying an installment through `PaymentService.payPixInstallment` may mark the corresponding reminder `concluido` for user convenience, but reminder actions never flow backward to payment status.

---

## 3. Caveats

1. **No Database Migrations Required**: The database schema in `prisma/schema.prisma` already includes `Payment`, `PixInstallment`, and `Reminder`. Do not run migrations or alter schema tables.
2. **LocalDB Named Pipe Proxy**: All Vitest integration tests against `PopoAppTest` require the LocalDB proxy to be active (`tests/helpers/localdb-proxy.js` on port 1433).
3. **Decimals Serialization**: All service methods and API responses must convert Prisma `Decimal` instances to JavaScript `number` (e.g. `Number(p.valor)`) to prevent JSON serialization errors in Next.js 15 route handlers.

---

## 4. Conclusion: Turnkey Specification & Implementation Plan

### 4.1 Types: `src/types/payment.ts`
Create `src/types/payment.ts` with:
```typescript
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
```

### 4.2 Zod Schemas: `src/schemas/payment.ts`
Create `src/schemas/payment.ts` with:
```typescript
// src/schemas/payment.ts
import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUSES, PIX_INSTALLMENT_STATUSES } from '@/types/payment';

export const recordPaymentSchema = z.object({
  valor: z
    .number({ required_error: 'O valor é obrigatório' })
    .positive('O valor do pagamento deve ser maior que zero'),
  metodo: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Método de pagamento inválido' }),
  }),
  status: z.enum(PAYMENT_STATUSES).optional().default('Pago'),
  dataPagamento: z.coerce.date().optional().default(() => new Date()),
  numeroParcelas: z
    .number()
    .int('O número de parcelas deve ser um número inteiro')
    .min(1, 'Mínimo de 1 parcela')
    .max(24, 'Máximo de 24 parcelas')
    .optional()
    .default(1),
  identificadorTransacao: z.string().trim().max(100).nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const createPixScheduleSchema = z.object({
  valorTotal: z
    .number({ required_error: 'O valor total é obrigatório' })
    .positive('O valor total do parcelamento deve ser maior que zero'),
  numeroParcelas: z
    .number({ required_error: 'O número de parcelas é obrigatório' })
    .int('O número de parcelas deve ser um número inteiro')
    .min(2, 'O parcelamento PIX deve ter no mínimo 2 parcelas')
    .max(24, 'O parcelamento PIX suporta no máximo 24 parcelas'),
  primeiroVencimento: z.coerce.date({
    required_error: 'A data do primeiro vencimento é obrigatória',
  }),
  intervaloDias: z
    .number()
    .int()
    .min(1, 'O intervalo deve ser de pelo menos 1 dia')
    .max(90, 'O intervalo máximo é de 90 dias')
    .optional()
    .default(30),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const payPixInstallmentSchema = z.object({
  dataPagamento: z.coerce.date().optional().default(() => new Date()),
});

export const updatePixInstallmentStatusSchema = z.object({
  status: z.enum(PIX_INSTALLMENT_STATUSES, {
    errorMap: () => ({ message: 'Status de parcela PIX inválido' }),
  }),
  dataPagamento: z.coerce.date().nullable().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CreatePixScheduleInput = z.infer<typeof createPixScheduleSchema>;
export type PayPixInstallmentInput = z.infer<typeof payPixInstallmentSchema>;
export type UpdatePixInstallmentStatusInput = z.infer<typeof updatePixInstallmentStatusSchema>;
```

### 4.3 Enhancement to `AttendanceService.computeFinancials` (`src/services/attendance.service.ts`)
Update `computeFinancials` in `src/services/attendance.service.ts` (lines 18–53) to support PIX installment breakdown:
```typescript
  static computeFinancials(attendance: {
    desconto?: Prisma.Decimal | number | null;
    procedures?: { standardValueSnapshot?: Prisma.Decimal | number; practicedValue?: Prisma.Decimal | number }[];
    payments?: {
      valor?: Prisma.Decimal | number;
      status?: string;
      pixInstallments?: { valor?: Prisma.Decimal | number; status?: string }[];
    }[];
  }): AttendanceFinancialsDto {
    const procs = attendance.procedures ?? [];
    const standardTotal = procs.reduce(
      (acc, p) => acc + Number(p.standardValueSnapshot ?? 0),
      0
    );

    const practicedTotal = procs.reduce(
      (acc, p) => acc + Number(p.practicedValue ?? 0),
      0
    );

    const explicitDiscount = Number(attendance.desconto ?? 0);
    const netTotal = Math.max(0, practicedTotal - explicitDiscount);

    const paidTotal = (attendance.payments ?? []).reduce((acc, pay) => {
      // If payment carries pixInstallments, aggregate installments with status 'Pago'
      if (pay.pixInstallments && pay.pixInstallments.length > 0) {
        const installmentsPaid = pay.pixInstallments
          .filter((inst) => inst.status === 'Pago')
          .reduce((sum, inst) => sum + Number(inst.valor ?? 0), 0);
        return acc + installmentsPaid;
      }
      // Otherwise, count payment if its status is 'Pago'
      if (pay.status === 'Pago') {
        return acc + Number(pay.valor ?? 0);
      }
      return acc;
    }, 0);

    const outstandingBalance = Math.max(0, netTotal - paidTotal);
    const isFullyPaid = netTotal > 0 && paidTotal >= netTotal;

    return {
      standardTotal,
      practicedTotal,
      explicitDiscount,
      netTotal,
      paidTotal,
      outstandingBalance,
      isFullyPaid,
    };
  }
```

### 4.4 Domain Service: `src/services/payment.service.ts`
Implement `PaymentService` with the following comprehensive methods:

1. **`recordPayment(attendanceId: string, input: RecordPaymentInput)`**:
   - Fetches attendance with procedures, discount, payments (including `pixInstallments`), and client info.
   - Guard 1: Throws `NotFoundError` if attendance does not exist.
   - Guard 2: Throws `ValidationError` if `attendance.status === 'Cancelado'`.
   - Guard 3: Calculates current `financials = AttendanceService.computeFinancials(attendance)`.
   - Guard 4: If `input.valor > financials.outstandingBalance + 0.001`:
     Throws `ValidationError(`O valor do pagamento (R$ ${input.valor.toFixed(2)}) não pode ser superior ao saldo devedor (R$ ${financials.outstandingBalance.toFixed(2)}).`)`.
   - Guard 5 (V21): If `input.metodo === 'CartaoCredito'`:
     - Creates `Payment` with `numeroParcelas: input.numeroParcelas || 1`, `status: input.status || 'Pago'`, `dataPagamento: input.dataPagamento`.
     - Strictly creates **zero** records in `PixInstallment` and **zero** records in `Reminder`.
   - For all other direct methods (`Dinheiro`, `CartaoDebito`, single `Pix`, `Boleto`, `Transferencia`, `Outro`):
     - Creates `Payment` with `numeroParcelas: 1`, `status: input.status || 'Pago'`, `dataPagamento: input.dataPagamento`.
   - Returns payment record and updated attendance financials.

2. **`createPixInstallmentSchedule(attendanceId: string, input: CreatePixScheduleInput)`**:
   - Fetches attendance with procedures, discount, payments (with `pixInstallments`), and client.
   - Validates attendance exists and is not `Cancelado`.
   - Validates `input.valorTotal <= financials.outstandingBalance + 0.001`.
   - Computes installments:
     - Base installment value: `Math.floor((input.valorTotal / input.numeroParcelas) * 100) / 100`.
     - First installment value: `Number((input.valorTotal - baseValue * (input.numeroParcelas - 1)).toFixed(2))` (absorbs cent rounding so sum matches `input.valorTotal` exactly).
     - Calculates due dates based on `input.primeiroVencimento` and `input.intervaloDias` (adding `k * intervaloDias * 86400000` or monthly).
   - In `prisma.$transaction(async (tx) => { ... })`:
     - Creates `Payment`:
       - `attendanceId`
       - `valor: input.valorTotal`
       - `metodo: 'Pix'`
       - `status: 'Pendente'`
       - `numeroParcelas: input.numeroParcelas`
       - `dataPagamento: null`
       - `observacoes: input.observacoes`
     - Iterates $1..N$ and creates `PixInstallment` rows:
       - `paymentId: payment.id`
       - `numeroParcela: i`
       - `totalParcelas: input.numeroParcelas`
       - `valor: installmentValue`
       - `dataVencimento: dueDate`
       - `status: 'Pendente'`
     - For each created installment, creates `Reminder` (V22, D5):
       - `clientId: attendance.clientId`
       - `pixInstallmentId: installment.id`
       - `titulo: 'Parcela PIX ${i}/${input.numeroParcelas} - ${client.nome}'`
       - `descricao: 'Parcela PIX no valor de R$ ${installmentValue.toFixed(2)} com vencimento em ${format(dueDate, 'dd/MM/yyyy')}'`
       - `dataVencimento: dueDate`
       - `prioridade: 'media'`
       - `status: 'pendente'`
       - `tipo: 'parcela_pix'`
   - Returns created payment with `pixInstallments` and updated attendance financials.

3. **`payPixInstallment(installmentId: string, input?: PayPixInstallmentInput)`**:
   - Finds `PixInstallment` by ID, including its parent `Payment` (with attendance and other installments) and linked `Reminder`.
   - If `installment.status === 'Pago'`, return idempotent.
   - In transaction:
     - Updates `PixInstallment`:
       - `status: 'Pago'`
       - `dataPagamento: input?.dataPagamento || new Date()`
     - If linked `reminder` exists and `reminder.status === 'pendente'`, mark `Reminder.status = 'concluido'`, `completedAt: new Date()`.
     - Checks whether all siblings in `payment.pixInstallments` are now `'Pago'`:
       - If all are `'Pago'`, update parent `Payment`: `status = 'Pago'`, `dataPagamento = new Date()`.
   - Returns updated installment and recalculated attendance financials.

4. **`previewPixSchedule(input: { valorTotal: number; numeroParcelas: number; primeiroVencimento: Date; intervaloDias?: number })`**:
   - Pure function returning preview array of `{ numeroParcela, totalParcelas, valor, dataVencimento }` without database writes.

5. **`getPaymentsByAttendance(attendanceId: string)`**:
   - Returns all payments for attendance, including `pixInstallments`, and attaches dynamic `financials`.

6. **`getPaymentById(paymentId: string)`**:
   - Returns payment by ID with `pixInstallments` and attendance link.

7. **`cancelPayment(paymentId: string)`**:
   - Cancels payment, sets all linked `pixInstallments` to `'Cancelado'`, and dismisses linked reminders (`status = 'dispensado'`).

8. **`deletePayment(paymentId: string)`**:
   - Deletes payment (cascading to `pixInstallments` and linked `reminders`).

### 4.5 API Routes to Implement
All route handlers follow Next.js 15 App Router requirements:
1. `src/app/api/attendances/[id]/payments/route.ts`:
   - `GET`: Returns `{ success: true, data: { payments, financials } }`.
   - `POST`: Validates request body. If `body.numeroParcelas > 1 && body.metodo === 'Pix'`, delegates to `createPixScheduleSchema` -> `createPixInstallmentSchedule`. Otherwise delegates to `recordPaymentSchema` -> `recordPayment`.
2. `src/app/api/attendances/[id]/payments/pix-schedule/route.ts`:
   - `POST`: Explicit endpoint for creating PIX installment schedules using `createPixScheduleSchema`.
3. `src/app/api/payments/[id]/route.ts`:
   - `GET`: Returns payment details.
   - `DELETE`: Deletes payment.
4. `src/app/api/pix-installments/[id]/pay/route.ts`:
   - `POST`: Marks installment paid using `payPixInstallmentSchema`.

### 4.6 Automated Test Suites to Implement
1. **`tests/tier1_features/f25_payment_service.spec.ts` (Tier 1 Feature Tests - F09, F25, V20, V21, V22)**:
   - `F25.1`: Record direct cash payment in full -> status `Pago`, `outstandingBalance = 0`, `isFullyPaid = true`.
   - `F25.2 (V20)`: Record multiple partial payments across methods (e.g. Cash R$ 200 + Debit R$ 300 on R$ 500 attendance) -> dynamic `paidTotal = 500`, `outstandingBalance = 0`.
   - `F25.3 (V21)`: Credit card payment with `numeroParcelas = 3` -> records total amount, `numeroParcelas = 3`, asserts 0 `PixInstallment` records and 0 `Reminder` records in DB.
   - `F25.4 (V22)`: PIX installment schedule (3x R$ 200 on R$ 600 total) -> creates `Payment` (`status: Pendente`), 3 `PixInstallment` records, and 3 in-app `Reminder` records with matching due dates.
   - `F25.5`: Overpayment prevention -> attempting to pay R$ 600 on an outstanding balance of R$ 500 throws `ValidationError`.
   - `F25.6`: Paying a PIX installment -> marks installment `Pago`, increases `paidTotal`, and when all installments are paid, transitions parent `Payment.status` to `Pago`.
   - `F25.7`: Schedule cent-rounding integrity -> R$ 1.000 split into 3 installments yields R$ 333.34, R$ 333.33, R$ 333.33 (sum equals exact R$ 1.000,00).

2. **`tests/tier1_features/f24_financial_calc.spec.ts` (Tier 1 Feature Tests - F23, F24, D2)**:
   - Dynamic recalculation of `standardTotal`, `practicedTotal`, `explicitDiscount`, `netTotal`, `paidTotal`, `outstandingBalance`, `isFullyPaid`.
   - Multi-procedure attendance with discount and mixed payments.

3. **`tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts` (Tier 2 Boundary Test - V21, AC 68)**:
   - Creating credit card payments with 1x, 3x, 6x, 12x installments generates zero reminder rows in the `Reminder` table.

4. **`tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts` (Tier 2 Boundary Test - V22, AC 68)**:
   - Creating a PIX installment schedule with $N$ installments generates exactly $N$ reminders with correct `clientId`, `pixInstallmentId`, and `dataVencimento`.

5. **`tests/tier2_boundaries/v23_reminder_decoupling.spec.ts` (Tier 2 Boundary Test - V23)**:
   - Updating a reminder to `concluido` or `dispensado` leaves `PixInstallment.status` (`Pendente`), `Payment.status` (`Pendente`), and `outstandingBalance` strictly unmodified.

6. **`tests/tier3_combinations/v20_multi_method_payments.spec.ts` (Tier 3 Cross-Feature Test - V20, AC 58)**:
   - AC 58: An attendance with 2 procedures (e.g. R$ 700 and R$ 500, practiced R$ 600 and R$ 400), an explicit discount of R$ 100, and payments across 2 different methods (Cash R$ 300 + PIX R$ 600) yields exact net total R$ 900, paid R$ 900, outstanding R$ 0.

7. **`tests/tier4_workflows/scenarios_a_through_e.spec.ts` (Tier 4 Workflow - Scenario E)**:
   - Upgrade Scenario E to execute through real `PaymentService` methods: Total R$ 1.000, R$ 400 paid via Credit Card (2x, 0 reminders), R$ 600 scheduled in 3x PIX (3 reminders). Asserts exact total R$ 1.000, paid R$ 400, outstanding R$ 600, credit card reminders 0, PIX reminders 3.

---

## 5. Verification Method

To verify the architecture and subsequent worker implementation:

1. **Verify Existing Baseline**:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   npx vitest run
   ```
   Must pass all 30 existing test files (185 tests) with 0 failures.

2. **Verify Next.js Build and Lint**:
   ```powershell
   npm run lint
   npm run build
   ```
   Must compile with 0 lint errors and all routes generated cleanly.

3. **Verify Milestone 4 Payment Suite (Once implemented by worker)**:
   ```powershell
   npx vitest run tests/tier1_features/f25_payment_service.spec.ts
   npx vitest run tests/tier1_features/f24_financial_calc.spec.ts
   npx vitest run tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts
   npx vitest run tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts
   npx vitest run tests/tier2_boundaries/v23_reminder_decoupling.spec.ts
   npx vitest run tests/tier3_combinations/v20_multi_method_payments.spec.ts
   npx vitest run tests/tier4_workflows/scenarios_a_through_e.spec.ts
   ```

4. **Invalidation Conditions**:
   - Any creation of `PixInstallment` or `Reminder` records when processing a `CartaoCredito` payment invalidates V21 and AC 68.
   - Any automatic mutation of `PixInstallment.status` or `Payment.status` when marking a reminder `concluido` or `dispensado` invalidates V23 and D5.
   - Any silent failure or omission of cent rounding adjustment on PIX schedules invalidates financial consistency.
   - Omitting `await params` in App Router route handlers violates Next.js 15 requirements.
