# Technical Exploration & Architecture Design: In-App Reminder Service (Phase 13, D5, V21, V22, V23, AC 68)

## 1. Observation

Direct observations from the repository codebase and authoritative specifications:

1. **User Binding Decisions & Acceptance Criteria (`ORIGINAL_REQUEST.md`)**:
   - **D5 (Line 22 & 103)**:
     > "- **D5. Reminders:** in-app only. A Lembretes page plus a dashboard list of upcoming and overdue PIX installments. Reminders can be marked done or dismissed. No email, WhatsApp or other external delivery."
   - **AC 68 (Line 68)**:
     > "- [ ] PIX installment reminders appear in the Lembretes area and on the dashboard (upcoming/overdue). Credit-card installments generate none. Marking a reminder done does not change any payment status."
   - **Checklist Phase 13 (Line 307-316 in `IMPLEMENTATION_CHECKLIST.md`)**:
     > "### Phase 13 — Reminders `[ ]` 🔴 HIGH COMPLEXITY
     > - `[ ] 🔴 HIGH COMPLEXITY — In-app reminder engine for PIX installments with financial decoupling`
     >   - `[ ]` Implement reminder generation service triggered by PIX installment schedule creation
     >   - `[ ]` Implement `/api/reminders` API route (GET list with status filter, POST manual reminder)
     >   - `[ ]` Implement `/api/reminders/[id]/status` API route (PATCH mark `concluido` or `dispensado`)
     >   - `[ ]` Enforce decoupling rule: marking reminder complete/dismissed never alters payment status or outstanding balance
     >   - `[ ]` Build reminders management page (`/lembretes`) with tabs for pending, completed, and dismissed
     >   - `[ ]` Build dashboard upcoming and overdue PIX reminders widget
     >   - `[ ]` Replace mock data imports in `src/app/(authenticated)/lembretes/page.tsx`"

2. **Master Development Specification (`POPOAPP_DEVELOPMENT_SPEC.md`)**:
   - **§22 Credit Card Installments (Lines 445-458)**:
     > "Credit card installments are supported. For a credit-card payment, store: total amount; payment method = Credit Card; number of installments. The user explicitly does NOT need collection reminders for credit-card installments. Do not add unnecessary reminder workflows for credit-card installments."
   - **§23 PIX Installments (Lines 461-480)**:
     > "PIX installments have a special rule. The user may agree to a schedule such as: total: R$ 1,000; 5 installments; R$ 200 each; every 10th day of the month. The system should support installment scheduling and reminders for agreed PIX installment dates. Important: PIX installment reminders are convenience/reminder functionality; reminders are NOT the financial source of truth; payment records and payment status remain the source of truth."
   - **§24 General Reminders (Lines 482-492)**:
     > "Reminder functionality should be useful but simple. Support reminders where explicitly required by the business, especially PIX installment due dates. Do not turn reminders into a complex accounting or collections subsystem. Credit-card installments do not require reminders."
   - **§32 Critical Validations (Lines 638-640)**:
     > "21. Credit-card installments do not generate collection reminders.
     > 22. PIX installment schedules may generate reminders.
     > 23. Reminder state must not replace payment truth."

3. **Database Schema (`prisma/schema.prisma` Lines 304-367)**:
   - `Payment` model:
     - Fields: `id`, `attendanceId`, `valor Decimal(10,2)`, `metodo String`, `status String @default("Pago")`, `dataPagamento DateTime?`, `numeroParcelas Int @default(1)`, `identificadorTransacao String?`, `observacoes String?`, `createdAt`, `updatedAt`.
     - Relations: `attendance Attendance`, `pixInstallments PixInstallment[]`.
   - `PixInstallment` model:
     - Fields: `id`, `paymentId`, `numeroParcela Int`, `totalParcelas Int`, `valor Decimal(10,2)`, `dataVencimento DateTime`, `dataPagamento DateTime?`, `status String @default("Pendente")`, `createdAt`, `updatedAt`.
     - Relations: `payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)`, `reminders Reminder[]`.
     - Indexes: `@@index([paymentId])`, `@@index([dataVencimento])`, `@@index([status])`.
   - `Reminder` model:
     - Fields:
       - `id String @id @default(uuid())`
       - `clientId String?`
       - `pixInstallmentId String?`
       - `titulo String`
       - `descricao String? @db.NVarChar(Max)`
       - `dataVencimento DateTime`
       - `prioridade String @default("media")` (`baixa`, `media`, `alta`)
       - `status String @default("pendente")` (`pendente`, `concluido`, `dispensado`)
       - `tipo String @default("parcela_pix")` (`parcela_pix`, `retorno`, `geral`)
       - `completedAt DateTime?`
       - `createdAt DateTime @default(now())`
       - `updatedAt DateTime @updatedAt`
     - Relations:
       - `client Client? @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)`
       - `pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade, onUpdate: NoAction)`
     - Indexes: `@@index([clientId])`, `@@index([pixInstallmentId])`, `@@index([dataVencimento])`, `@@index([status])`.

4. **Test Infrastructure Matrix (`TEST_INFRA.md` Lines 154-156 & 195-198)**:
   - **V21**: Credit card installments generate 0 reminders (`tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts`) — Stored installment count (1..12); creates exactly zero reminders in database (AC 68).
   - **V22**: PIX installment schedule generates reminders (`tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts`) — N reminders created matching agreed PIX installment due dates (AC 68).
   - **V23**: Reminder status decoupling from payment truth (`tests/tier2_boundaries/v23_reminder_decoupling.spec.ts`) — Marking reminder done/dismissed leaves `Payment.status` and outstanding balance unchanged (AC 68).
   - **F10 / F26**: Feature coverage for `ReminderService` (`tests/tier1_features/f10_reminder_service.spec.ts`).

5. **Existing Code & UI Analysis**:
   - `src/services/attendance.service.ts`: `computeFinancials` (lines 18-53) computes dynamic financials (`netTotal`, `paidTotal`, `outstandingBalance`, `isFullyPaid`) derived strictly from procedures, discount, and `payments` where `status === 'Pago'`. Reminder state is completely absent from financials, matching domain decoupling.
   - `src/app/(authenticated)/lembretes/page.tsx`: Currently imports `mockLembretes` from `src/data/mock/lembretes`. Uses tabs ('Todos', 'Pendentes', 'Em Andamento', 'Concluídos', 'Atrasados'), priority dots ('baixa', 'media', 'alta'), and actions for check, edit, delete.
   - `src/app/(authenticated)/page.tsx`: Dashboard has a `Lembretes Pendentes` card (lines 151-180) currently reading from `dashboardData.lembretesPendentes`.
   - `src/lib/session.ts`: `requireAuth(request)` enforces authenticated session on route handlers.
   - Route handlers in App Router: Compliant with Next.js 15 `{ params }: { params: Promise<{ id: string }> }` followed by `const { id } = await params`.

---

## 2. Logic Chain

1. **Strict In-App Boundary (D5)**:
   - Because D5 explicitly dictates *"in-app only... No email, WhatsApp or other external delivery"*, the system does not need notification background dispatch workers, SMS queues, or email gateways.
   - Reminders exist entirely in the database as operational items, queried through Next.js App Router API routes, and rendered on `/lembretes` and the dashboard widget.

2. **Divergent Treatment of Payment Methods (V21 vs V22)**:
   - Credit card installments are processed by the acquirer/gateway; the clinic receives either upfront funding or an acquirer receivable schedule. The clinic does not collect from the client on a monthly basis. Therefore, `metodo === 'CartaoCredito'` only stores `numeroParcelas` (1..12) as an integer on `Payment` and creates zero `PixInstallment` records and zero `Reminder` records (V21, D5).
   - Conversely, PIX installment agreements are an informal or direct payment plan where the client transfers funds on agreed dates. Therefore, `metodo === 'Pix'` with installments creates `N` `PixInstallment` records, each triggering the generation of an in-app `Reminder` with matching `dataVencimento`, `valor`, and `clientId` (V22, D5).

3. **Generation Strategy: Automated & Idempotent Sync**:
   - When `PaymentService` registers a PIX payment with installments, it calls `ReminderService.generateRemindersForPixInstallments(installments, clientId, tx)`.
   - To guarantee robustness, the generation logic is strictly idempotent: it verifies whether a reminder with `pixInstallmentId === installment.id` already exists before creating a new one.
   - A self-healing helper `ReminderService.syncPixInstallmentReminders()` scans for any pending `PixInstallment` records that lack an associated `Reminder` and generates them.

4. **Absolute Decoupling of Reminder State from Financial Ledger (V23)**:
   - A user clicking "Concluir" (mark done) or "Dispensar" (dismiss) on a reminder is merely checking off an operational task (e.g., "I called the client" or "I noticed this installment").
   - It does NOT mean funds were received. Financial truth resides exclusively in `Payment.status` and `PixInstallment.status`.
   - Updating `Reminder.status` to `'concluido'` or `'dispensado'` sets `Reminder.completedAt = new Date()`, but makes ZERO alterations to `PixInstallment`, `Payment`, or `Attendance` financials.
   - When `AttendanceService.computeFinancials` is called, `paidTotal` and `outstandingBalance` remain identical before and after any reminder status change.

5. **Lifecycle and Status State Machine**:
   - Stored statuses in database:
     - `'pendente'`: Active reminder requiring attention.
     - `'concluido'`: Marked as completed/done by professional.
     - `'dispensado'`: Dismissed by professional without resolution.
   - Dynamic temporal calculation:
     - `'atrasado'`: Computed when `status === 'pendente' && dataVencimento < new Date()`.
     - In API queries, filtering by `status: 'atrasado'` evaluates `status: 'pendente', dataVencimento: { lt: new Date() }`.
     - The service adds a computed boolean `isOverdue` to returned reminder objects.

6. **Dashboard Feed Requirement (D5, AC 68)**:
   - The dashboard requires upcoming and overdue PIX reminders.
   - `ReminderService.getDashboardPixReminders(limit)` splits pending PIX reminders into two distinct ordered lists:
     - `overdue`: `status === 'pendente' AND dataVencimento < now`, sorted ascending by due date (most overdue first).
     - `upcoming`: `status === 'pendente' AND dataVencimento >= now`, sorted ascending by due date (due soonest first).

---

## 3. Caveats

1. **Non-PIX Reminders**:
   - While PIX installments are the primary automated source of reminders, the `Reminder` model also supports manual entries (`tipo: 'retorno'`, `tipo: 'geral'`, `tipo: 'aniversario'`). Manual reminders have `pixInstallmentId: null` and optional `clientId`. The architecture fully supports both without interference.
2. **Payment Deletion / Cascade Behavior**:
   - If a `Payment` with PIX installments is deleted, `prisma/schema.prisma` defines `onDelete: Cascade` on `PixInstallment`, which in turn has `onDelete: Cascade` to `Reminder`. Thus, cascading deletes cleanly remove associated reminders without leaving orphaned records.
3. **Multi-User / Single Professional Context**:
   - Per §29 of `POPOAPP_DEVELOPMENT_SPEC.md`, the app is single-professional. Reminders do not track assigned staff IDs.

---

## 4. Conclusion: Turnkey Architecture & Implementation Plan

The following turnkey blueprint is ready for immediate implementation by the assigned worker agent.

### 4.1 Types Definition (`src/types/reminder.ts`)

```typescript
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
  dataVencimento: Date;
  prioridade: ReminderPriority;
  status: ReminderStatus;
  tipo: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
    valor: Prisma.Decimal | number;
    dataVencimento: Date;
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
```

### 4.2 Zod Schemas (`src/schemas/reminder.ts`)

```typescript
import { z } from 'zod';

export const reminderPrioritySchema = z.enum(['baixa', 'media', 'alta'], {
  errorMap: () => ({ message: 'Prioridade inválida. Permitido: baixa, media, alta' }),
});

export const reminderStatusSchema = z.enum(['pendente', 'concluido', 'dispensado'], {
  errorMap: () => ({ message: 'Status inválido. Permitido: pendente, concluido, dispensado' }),
});

export const createReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  pixInstallmentId: z.string().uuid('ID da parcela deve ser um UUID válido').optional().nullable(),
  titulo: z.string().min(1, 'O título é obrigatório').max(200, 'O título não pode ter mais de 200 caracteres'),
  descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
  dataVencimento: z.coerce.date({ required_error: 'A data de vencimento é obrigatória' }),
  prioridade: reminderPrioritySchema.default('media'),
  tipo: z.string().min(1).default('geral'),
});

export const updateReminderSchema = z.object({
  clientId: z.string().uuid('ID do cliente deve ser um UUID válido').optional().nullable(),
  titulo: z.string().min(1, 'O título não pode ficar vazio').max(200, 'O título não pode ter mais de 200 caracteres').optional(),
  descricao: z.string().max(2000, 'A descrição não pode ter mais de 2000 caracteres').optional().nullable(),
  dataVencimento: z.coerce.date().optional(),
  prioridade: reminderPrioritySchema.optional(),
  status: reminderStatusSchema.optional(),
  tipo: z.string().min(1).optional(),
});

export const updateReminderStatusSchema = z.object({
  status: reminderStatusSchema,
});

export const reminderQuerySchema = z.object({
  status: z.enum(['pendente', 'concluido', 'dispensado', 'todos', 'atrasado']).optional(),
  prioridade: reminderPrioritySchema.optional(),
  tipo: z.string().optional(),
  clientId: z.string().uuid().optional(),
  pixInstallmentId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  overdueOnly: z.preprocess((val) => val === 'true' || val === true, z.boolean().optional()),
  upcomingDays: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusSchema>;
export type ReminderQueryParams = z.infer<typeof reminderQuerySchema>;
```

### 4.3 Domain Service Architecture (`src/services/reminder.service.ts`)

```typescript
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateReminderInput,
  UpdateReminderInput,
  ReminderQueryParams,
} from '@/schemas/reminder';
import { ReminderDto, ReminderPriority, ReminderStatus, DashboardPixRemindersDto, ReminderStatsDto } from '@/types/reminder';

export class ReminderService {
  /**
   * Creates a manual or general reminder (tipo: 'retorno', 'geral', 'aniversario', etc.)
   */
  static async createReminder(data: CreateReminderInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;

    if (data.clientId) {
      const client = await db.client.findUnique({ where: { id: data.clientId } });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    if (data.pixInstallmentId) {
      const installment = await db.pixInstallment.findUnique({ where: { id: data.pixInstallmentId } });
      if (!installment) {
        throw new NotFoundError('Parcela PIX não encontrada');
      }
    }

    return await db.reminder.create({
      data: {
        clientId: data.clientId ?? null,
        pixInstallmentId: data.pixInstallmentId ?? null,
        titulo: data.titulo.trim(),
        descricao: data.descricao ? data.descricao.trim() : null,
        dataVencimento: data.dataVencimento,
        prioridade: data.prioridade ?? 'media',
        status: 'pendente',
        tipo: data.tipo ?? 'geral',
        completedAt: null,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: true,
      },
    });
  }

  /**
   * Generates reminders automatically for an agreed PIX installment plan (V22, D5).
   * Strictly idempotent: will not create duplicate reminders for the same installment.
   */
  static async generateRemindersForPixInstallments(
    installments: Array<{
      id: string;
      numeroParcela: number;
      totalParcelas: number;
      valor: number | Prisma.Decimal;
      dataVencimento: Date;
    }>,
    clientId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? prisma;
    const reminders = [];

    for (const inst of installments) {
      const existing = await db.reminder.findFirst({
        where: { pixInstallmentId: inst.id },
      });

      if (!existing) {
        const valFormatted = Number(inst.valor).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });

        const created = await db.reminder.create({
          data: {
            clientId,
            pixInstallmentId: inst.id,
            titulo: `Parcela ${inst.numeroParcela}/${inst.totalParcelas} - PIX (${valFormatted})`,
            descricao: `Vencimento da parcela ${inst.numeroParcela} de ${inst.totalParcelas} acordada no valor de ${valFormatted}.`,
            dataVencimento: inst.dataVencimento,
            prioridade: 'media',
            status: 'pendente',
            tipo: 'parcela_pix',
          },
        });
        reminders.push(created);
      } else {
        reminders.push(existing);
      }
    }

    return reminders;
  }

  /**
   * Lists reminders with comprehensive filtering, status tabs, and overdue detection.
   */
  static async listReminders(query: ReminderQueryParams) {
    const now = new Date();
    const where: Prisma.ReminderWhereInput = {};

    if (query.clientId) where.clientId = query.clientId;
    if (query.pixInstallmentId) where.pixInstallmentId = query.pixInstallmentId;
    if (query.prioridade) where.prioridade = query.prioridade;
    if (query.tipo) where.tipo = query.tipo;

    // Status & overdue filtering
    if (query.status === 'atrasado' || query.overdueOnly) {
      where.status = 'pendente';
      where.dataVencimento = { lt: now };
    } else if (query.status && query.status !== 'todos') {
      where.status = query.status;
    }

    if (query.upcomingDays) {
      const futureLimit = new Date();
      futureLimit.setDate(futureLimit.getDate() + query.upcomingDays);
      where.status = 'pendente';
      where.dataVencimento = { gte: now, lte: futureLimit };
    }

    if (query.startDate || query.endDate) {
      where.dataVencimento = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const items = await prisma.reminder.findMany({
      where,
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
      orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.offset,
    });

    return items.map((item) => ({
      ...item,
      isOverdue: item.status === 'pendente' && new Date(item.dataVencimento) < now,
    }));
  }

  /**
   * Retrieves single reminder by ID.
   */
  static async getReminderById(id: string) {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
    });

    if (!reminder) {
      throw new NotFoundError('Lembrete não encontrado');
    }

    const now = new Date();
    return {
      ...reminder,
      isOverdue: reminder.status === 'pendente' && new Date(reminder.dataVencimento) < now,
    };
  }

  /**
   * Updates reminder fields.
   */
  static async updateReminder(id: string, data: UpdateReminderInput) {
    await this.getReminderById(id);

    return await prisma.reminder.update({
      where: { id },
      data: {
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.titulo ? { titulo: data.titulo.trim() } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao ? data.descricao.trim() : null } : {}),
        ...(data.dataVencimento ? { dataVencimento: data.dataVencimento } : {}),
        ...(data.prioridade ? { prioridade: data.prioridade } : {}),
        ...(data.status ? {
          status: data.status,
          completedAt: (data.status === 'concluido' || data.status === 'dispensado') ? new Date() : null,
        } : {}),
        ...(data.tipo ? { tipo: data.tipo } : {}),
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: true,
      },
    });
  }

  /**
   * CRITICAL INVARIANT (V23, D5, AC 68):
   * Marking a reminder as 'concluido' or 'dispensado' updates ONLY the reminder.
   * It strictly NEVER mutates PixInstallment.status, Payment.status, or any financial balance!
   */
  static async updateReminderStatus(id: string, status: ReminderStatus) {
    await this.getReminderById(id);

    const completedAt = (status === 'concluido' || status === 'dispensado') ? new Date() : null;

    return await prisma.reminder.update({
      where: { id },
      data: {
        status,
        completedAt,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: true,
      },
    });
  }

  /**
   * Deletes a reminder.
   */
  static async deleteReminder(id: string) {
    await this.getReminderById(id);
    await prisma.reminder.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Fetches dashboard upcoming and overdue PIX installment reminders feed (D5, AC 68).
   */
  static async getDashboardPixReminders(limit = 10): Promise<DashboardPixRemindersDto> {
    const now = new Date();

    const overdue = await prisma.reminder.findMany({
      where: {
        status: 'pendente',
        tipo: 'parcela_pix',
        dataVencimento: { lt: now },
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
      take: limit,
    });

    const upcoming = await prisma.reminder.findMany({
      where: {
        status: 'pendente',
        tipo: 'parcela_pix',
        dataVencimento: { gte: now },
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
      take: limit,
    });

    return {
      overdue: overdue.map((r) => ({ ...r, isOverdue: true })),
      upcoming: upcoming.map((r) => ({ ...r, isOverdue: false })),
    };
  }

  /**
   * Returns statistics counts across reminder statuses for UI badges and tabs.
   */
  static async getReminderStats(): Promise<ReminderStatsDto> {
    const now = new Date();

    const [total, pendentes, concluidos, dispensados, atrasados] = await Promise.all([
      prisma.reminder.count(),
      prisma.reminder.count({ where: { status: 'pendente' } }),
      prisma.reminder.count({ where: { status: 'concluido' } }),
      prisma.reminder.count({ where: { status: 'dispensado' } }),
      prisma.reminder.count({ where: { status: 'pendente', dataVencimento: { lt: now } } }),
    ]);

    return {
      total,
      pendentes,
      concluidos,
      dispensados,
      atrasados,
    };
  }

  /**
   * Self-healing sync: scans all pending PixInstallments without reminders and generates them.
   */
  static async syncPixInstallmentReminders() {
    const unlinkedInstallments = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        reminders: { none: {} },
      },
      include: {
        payment: {
          include: {
            attendance: { select: { clientId: true } },
          },
        },
      },
    });

    let generatedCount = 0;
    for (const inst of unlinkedInstallments) {
      const clientId = inst.payment.attendance.clientId;
      await this.generateRemindersForPixInstallments([inst], clientId);
      generatedCount++;
    }

    return { generatedCount };
  }
}
```

### 4.4 App Router API Routes Specification

All routes strictly comply with Next.js 15 `{ params }: { params: Promise<{ id: string }> }` and `await params`:

1. **`src/app/api/reminders/route.ts`**:
   - `GET`: Authenticated. Parses query parameters with `reminderQuerySchema`. Returns `{ success: true, data: ReminderDto[], stats?: ReminderStatsDto }`.
   - `POST`: Authenticated. Parses body with `createReminderSchema`. Calls `ReminderService.createReminder(parsed.data)`. Returns 201 `{ success: true, data: reminder }`.

2. **`src/app/api/reminders/[id]/route.ts`**:
   - `GET`: Authenticated. Resolves `await params`. Calls `ReminderService.getReminderById(id)`. Returns `{ success: true, data: reminder }`.
   - `PATCH`: Authenticated. Resolves `await params`. Parses body with `updateReminderSchema`. Calls `ReminderService.updateReminder(id, parsed.data)`. Returns `{ success: true, data: reminder }`.
   - `DELETE`: Authenticated. Resolves `await params`. Calls `ReminderService.deleteReminder(id)`. Returns `{ success: true }`.

3. **`src/app/api/reminders/[id]/status/route.ts`**:
   - `PATCH`: Authenticated. Resolves `await params`. Parses body with `updateReminderStatusSchema`.
   - Calls `ReminderService.updateReminderStatus(id, parsed.data.status)`.
   - Enforces V23: never alters payment status.
   - Returns `{ success: true, data: reminder }`.

4. **`src/app/api/reminders/dashboard/route.ts`**:
   - `GET`: Authenticated. Calls `ReminderService.getDashboardPixReminders()`.
   - Returns `{ success: true, data: { overdue: ReminderDto[], upcoming: ReminderDto[] } }`.

5. **`src/app/api/reminders/sync/route.ts`**:
   - `POST`: Authenticated. Calls `ReminderService.syncPixInstallmentReminders()`.
   - Returns `{ success: true, data: { generatedCount } }`.

### 4.5 Test Architecture Specifications

Worker will implement tests across 4 dedicated test files:

1. **`tests/tier1_features/f10_reminder_service.spec.ts` (Phase 13, D5, F10, F26)**:
   - `F10.1`: `createReminder` creates manual reminder (`tipo: 'retorno'`) with valid fields.
   - `F10.2`: `generateRemindersForPixInstallments` creates N reminders for N PIX installments.
   - `F10.3`: Idempotency: calling `generateRemindersForPixInstallments` twice creates 0 duplicate reminders.
   - `F10.4`: `listReminders` correctly filters by `status` ('pendente', 'concluido', 'dispensado') and computes `isOverdue`.
   - `F10.5`: `updateReminderStatus` updates status and populates `completedAt`.
   - `F10.6`: `getDashboardPixReminders` separates overdue and upcoming PIX installment reminders.

2. **`tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts` (AC 68, V21, D5)**:
   - `V21.1`: Credit card payment with 1 installment generates exactly 0 reminders.
   - `V21.2`: Credit card payment with 6 installments generates exactly 0 reminders.
   - `V21.3`: Credit card payment with 12 installments stores `numeroParcelas = 12` and creates exactly zero `PixInstallment` and zero `Reminder` rows.

3. **`tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts` (AC 68, V22, D5)**:
   - `V22.1`: PIX installment plan with 3 installments generates exactly 3 `Reminder` records matching installment due dates.
   - `V22.2`: PIX installment plan with 5 installments generates exactly 5 `Reminder` records linked via `pixInstallmentId`.
   - `V22.3`: Cascade deletion: deleting a PIX payment cascades to delete `PixInstallment` and associated `Reminder` rows, leaving zero orphaned rows.

4. **`tests/tier2_boundaries/v23_reminder_decoupling.spec.ts` (AC 68, V23, D5)**:
   - `V23.1`: Marking a PIX reminder as `concluido` updates `Reminder.status`, but `PixInstallment.status` remains `Pendente`, `Payment.status` remains `Pendente`, and attendance `outstandingBalance` is unchanged.
   - `V23.2`: Marking a PIX reminder as `dispensado` updates `Reminder.status`, leaving financial truth and balances unchanged.
   - `V23.3`: Toggling reminder status between `concluido`, `dispensado`, and `pendente` maintains total financial decoupling.
   - `V23.4`: Attendance `computeFinancials` produces identical `paidTotal` and `outstandingBalance` before and after reminder actions.

---

## 5. Verification Method

To independently verify the implementation once executed by the worker:

1. **Automated Vitest Execution**:
   ```bash
   npx vitest run tests/tier1_features/f10_reminder_service.spec.ts
   npx vitest run tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts
   npx vitest run tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts
   npx vitest run tests/tier2_boundaries/v23_reminder_decoupling.spec.ts
   ```
   *Expected Result*: All tests pass with 0 errors.

2. **Full Regression Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: All 30+ test suites in the repository pass.

3. **Database Decoupling Invariant Check**:
   - Inspect database state after running `v23_reminder_decoupling.spec.ts`.
   - Confirm that `Reminder.status = 'concluido'` does NOT equal `PixInstallment.status = 'Pago'`.

4. **Invalidation Conditions**:
   - Any external delivery logic (email, SMS, WhatsApp) is introduced -> Violation of D5.
   - Marking a reminder done alters `Payment.status` or `PixInstallment.status` -> Violation of V23.
   - Credit card payment creates rows in `Reminder` table -> Violation of V21.
   - Next.js 15 route parameters not awaited -> Build failure.
