# Handoff Report: Milestone 3 — Appointment & Attendance Domain Services and API Specification

## 1. Observation

### 1.1 Direct Repository & Spec Observations
- **Binding Requirements**:
  - `ORIGINAL_REQUEST.md` (lines 18–20, 57, 65): Defines D1 (Attendance lifecycle: `Pendente` auto-created on Appointment creation; manual transition to `Realizado`; auto-cancellation on Appointment cancel, no-show, or reschedule; new `Pendente` Attendance on reschedule), D2 (Attendance totals and outstanding balances computed dynamically, never stored), D3 (Planned procedures distinct from Attendance procedures, used for estimates and pre-filling Attendance).
  - `POPOAPP_DEVELOPMENT_SPEC.md` (§7 lines 140–170; §8 lines 174–195; §10 lines 220–238; §11 lines 240–250; §27 lines 530–542; §32 Critical Validations lines 615–642):
    - Appointment 6 canonical statuses: `Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`.
    - Prohibited status: `Em atendimento` is strictly prohibited (§27, §32.3).
    - Rescheduling: Preserves old appointment history as `Reagendado` and links via `rescheduledToId` to a newly created Appointment (`Agendado`, `rescheduledFromId`).
    - Attendance 3 canonical statuses: `Pendente`, `Realizado`, `Cancelado`.
    - Cardinality: `Appointment 1:N Attendance`. An Appointment may have multiple attendances (§8, §31).
    - Critical Validation V08: Cannot complete appointment without completed attendance (`PROJECT.md` line 96). Every procedure attached to an attendance must have a non-nullable practiced value (`AttendanceProcedure.practicedValue`).
    - Critical Validation V09: Standard procedure value (`valorPadrao`) must be snapshotted (`standardValueSnapshot`) upon association and stored separately from practiced value (`practicedValue`).
- **Data Model (`prisma/schema.prisma`)**:
  - `Appointment` (lines 70–92): `id` (UUID), `clientId` (FK), `dataHora` (DateTime), `status` (String, default "Agendado"), `valorEstimado` (Decimal 10,2), `observacoes` (NVarChar Max), `motivoCancelamento` (String?), `rescheduledFromId` (FK self-relation), `rescheduledToId` (String?), timestamps.
  - `PlannedProcedure` (lines 94–106): `id` (UUID), `appointmentId` (FK), `procedureId` (FK), `ordem` (Int default 0), `createdAt`.
  - `Attendance` (lines 111–135): `id` (UUID), `appointmentId` (FK), `clientId` (FK), `status` (String, default "Pendente"), `dataHora` (DateTime), `completedAt` (DateTime?), `desconto` (Decimal 10,2 default 0.00), `observacoes` (NVarChar Max), timestamps.
  - `AttendanceProcedure` (lines 173–189): `id` (UUID), `attendanceId` (FK), `procedureId` (FK), `standardValueSnapshot` (Decimal 10,2), `practicedValue` (Decimal 10,2), `observacoes` (String?), timestamps.
- **Existing Implementation & Patterns**:
  - Service pattern in `src/services/client.service.ts` and `src/services/procedure.service.ts`: Class with static methods (or exported functions), using Prisma transactions for multi-entity operations, throwing custom domain errors from `src/lib/errors.ts` (`ValidationError`, `NotFoundError`, `ConflictError`).
  - Next.js 15 App Router API handlers in `src/app/api/clients/*`: NextRequest, session check via `requireAuth(request)`, asynchronous `const { id } = await params;`, Zod schema parsing, structured JSON response `{ success: true, data: ... }` or `{ success: false, error: ... }`.
  - Testing pattern in `tests/tier3_combinations/appointment_attendance_d1.spec.ts`: Tests D1 lifecycle state machine, currently using inline raw Prisma transactions.

---

## 2. Logic Chain

1. **State Machine Integrity (D1 & V07)**:
   - Observation: When an appointment is scheduled, clinical service has not occurred.
   - Inference: `createAppointment` must atomically create the `Appointment` and an `Attendance` with status `'Pendente'`. An `Attendance` must NEVER be initialized with status `'Realizado'`.
2. **Cancellation and No-Show Cascade (D1 Rules 2, 3, & 5)**:
   - Observation: When an appointment is cancelled or marked no-show, unperformed attendances must not linger as pending.
   - Inference: In an atomic Prisma `$transaction`, setting an appointment to `Cancelado` or `Não compareceu` must update all linked attendances with `status: 'Pendente'` to `status: 'Cancelado'`.
   - Invariant: If an attendance was already marked `Realizado` (e.g. partial service delivered prior to cancellation of follow-up slot), it must NOT be modified (verified by `appointment_attendance_d1.spec.ts` line 205).
3. **Rescheduling Chain (D1 Rule 4, V04, Example D)**:
   - Observation: Rescheduling must not overwrite the original appointment or lose date history.
   - Inference: In an atomic Prisma `$transaction`:
     1. Create new Appointment with status `'Agendado'`, date `novaDataHora`, `rescheduledFromId: oldAppointment.id`.
     2. Create new Attendance for the new appointment with status `'Pendente'`.
     3. Update old Appointment to `status: 'Reagendado'` and `rescheduledToId: newAppointment.id`.
     4. Cascade `status: 'Cancelado'` to any pending Attendances of the old appointment.
4. **Completion Guard (V08 & §27)**:
   - Observation: An appointment cannot be concluded without proof of service.
   - Inference: In `completeAppointment(id)`: Query linked attendances. If no attendance has `status: 'Realizado'`, or if attendances remain in `'Pendente'`, the service must throw `ValidationError('Não é possível concluir o agendamento sem que o atendimento esteja realizado')`.
5. **Procedure Snapshot & Pricing Independence (V09, V10, V11, V12, D2)**:
   - Observation: Adding a procedure to an attendance must snapshot catalog `valorPadrao` and record explicit `practicedValue`.
   - Inference: When associating a procedure via `addProcedure`:
     1. Fetch procedure from `prisma.procedure`.
     2. Assign `standardValueSnapshot = procedure.valorPadrao`.
     3. Assign `practicedValue = input.practicedValue ?? procedure.valorPadrao`.
     4. Difference between standard and practiced value does NOT alter `Attendance.desconto`.
     5. Attendance discount `desconto` is explicit, non-negative, and must not exceed the sum of practiced values (`sum(practicedValue)`).
6. **Dynamic Financial Breakdown (D2)**:
   - Observation: Totals and balances must be computed on demand, never persisted as static columns.
   - Inference: Provide a calculation helper `calculateAttendanceFinancials(attendance)`:
     - `standardTotal = sum(procedures.standardValueSnapshot)`
     - `practicedTotal = sum(procedures.practicedValue)`
     - `explicitDiscount = attendance.desconto`
     - `netTotal = practicedTotal - explicitDiscount`
     - `paidTotal = sum(payments with status == 'Pago')`
     - `outstandingBalance = max(0, netTotal - paidTotal)`
     - `isFullyPaid = paidTotal >= netTotal && netTotal > 0`

---

## 3. Caveats

1. **Transaction Timeouts on LocalDB**: Under SQL Server LocalDB, transactions involving multiple table locks should remain brief. Sequential operations inside `prisma.$transaction(async (tx) => { ... })` must be kept minimal and avoid external network calls.
2. **Next.js 15 Route Handler Params**: In Next.js 15, route handler context params are promises (`{ params }: { params: Promise<{ id: string }> }`). All route handlers must `await params` before accessing `id`.
3. **Cardinality 1:N vs Default 1:1**: While 95% of appointments will have exactly 1 attendance, the schema and services support `Appointment 1:N Attendance`. `completeAppointment` verifies that at least one attendance is `Realizado` and no unhandled pending attendances remain.
4. **Planned Procedures vs Actual Attendance Procedures**: Planned procedures are linked to the `Appointment` via `PlannedProcedure`. They can optionally pre-fill `AttendanceProcedure` rows on demand or at creation, but editing attendance procedures never modifies `PlannedProcedure`.

---

## 4. Conclusion: Turnkey Implementation Specification

### 4.1 Canonical Enums and Types

```typescript
// Status types aligned with POPOAPP_DEVELOPMENT_SPEC.md §7, §8, §32
export const APPOINTMENT_STATUSES = [
  'Agendado',
  'Confirmado',
  'Concluído',
  'Cancelado',
  'Não compareceu',
  'Reagendado',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  'Pendente',
  'Realizado',
  'Cancelado',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// Em atendimento is strictly forbidden
export const PROHIBITED_APPOINTMENT_STATUSES = ['Em atendimento', 'em_atendimento', 'EM ATENDIMENTO'] as const;
```

---

### 4.2 Zod Validation Schemas

#### File: `src/schemas/appointment.ts`
```typescript
import { z } from 'zod';
import { APPOINTMENT_STATUSES, PROHIBITED_APPOINTMENT_STATUSES } from '@/types/appointment';

export const appointmentStatusSchema = z.string().refine(
  (val): val is (typeof APPOINTMENT_STATUSES)[number] => {
    if (PROHIBITED_APPOINTMENT_STATUSES.includes(val as any)) {
      return false;
    }
    return (APPOINTMENT_STATUSES as readonly string[]).includes(val);
  },
  {
    message: 'Status de agendamento inválido. "Em atendimento" não é permitido.',
  }
);

export const plannedProcedureInputSchema = z.object({
  procedureId: z.string().uuid('ID do procedimento inválido'),
  ordem: z.number().int().min(0).optional().default(0),
});

export const createAppointmentSchema = z.object({
  clientId: z.string().uuid('ID do cliente inválido'),
  dataHora: z.coerce.date({
    errorMap: () => ({ message: 'Data e hora do agendamento inválidas' }),
  }),
  valorEstimado: z.coerce.number().min(0, 'Valor estimado deve ser positivo').optional().nullable(),
  observacoes: z.string().trim().max(4000, 'Observações muito longas').optional().nullable(),
  plannedProcedureIds: z.array(z.string().uuid()).optional().default([]),
  prefillAttendance: z.boolean().optional().default(false),
});

export const updateAppointmentSchema = z.object({
  dataHora: z.coerce.date().optional(),
  valorEstimado: z.coerce.number().min(0).optional().nullable(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  status: appointmentStatusSchema.optional(),
});

export const cancelAppointmentSchema = z.object({
  motivoCancelamento: z
    .string()
    .trim()
    .min(3, 'Motivo do cancelamento é obrigatório (mínimo 3 caracteres)')
    .max(500, 'Motivo do cancelamento muito longo'),
});

export const noShowAppointmentSchema = z.object({
  observacoes: z.string().trim().max(500).optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  novaDataHora: z.coerce.date({
    errorMap: () => ({ message: 'Nova data e hora inválidas' }),
  }),
  motivo: z.string().trim().max(500).optional().nullable(),
  valorEstimado: z.coerce.number().min(0).optional().nullable(),
  plannedProcedureIds: z.array(z.string().uuid()).optional(),
});

export const appointmentListQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  clientId: z.string().uuid().optional(),
  status: z.union([appointmentStatusSchema, z.literal('todos')]).optional().default('todos'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type NoShowAppointmentInput = z.infer<typeof noShowAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
```

#### File: `src/schemas/attendance.ts`
```typescript
import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '@/types/attendance';

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES, {
  errorMap: () => ({ message: 'Status de atendimento inválido' }),
});

export const createAttendanceSchema = z.object({
  appointmentId: z.string().uuid('ID do agendamento inválido'),
  clientId: z.string().uuid('ID do cliente inválido'),
  dataHora: z.coerce.date().optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  desconto: z.coerce.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
});

export const updateAttendanceSchema = z.object({
  dataHora: z.coerce.date().optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
});

export const addAttendanceProcedureSchema = z.object({
  procedureId: z.string().uuid('ID do procedimento inválido'),
  practicedValue: z.coerce
    .number()
    .min(0, 'Valor praticado não pode ser negativo'),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const updateAttendanceProcedureSchema = z.object({
  practicedValue: z.coerce
    .number()
    .min(0, 'Valor praticado não pode ser negativo'),
  observacoes: z.string().trim().max(1000).optional().nullable(),
});

export const setDiscountSchema = z.object({
  desconto: z.coerce
    .number()
    .min(0, 'Desconto não pode ser negativo'),
});

export const attendanceListQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  clientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  status: z.union([attendanceStatusSchema, z.literal('todos')]).optional().default('todos'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type AddAttendanceProcedureInput = z.infer<typeof addAttendanceProcedureSchema>;
export type UpdateAttendanceProcedureInput = z.infer<typeof updateAttendanceProcedureSchema>;
export type SetDiscountInput = z.infer<typeof setDiscountSchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
```

---

### 4.3 Service Layer Implementation Architecture

#### File: `src/services/appointment.service.ts`
```typescript
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  CancelAppointmentInput,
  NoShowAppointmentInput,
  RescheduleAppointmentInput,
  AppointmentListQuery,
} from '@/schemas/appointment';
import { PROHIBITED_APPOINTMENT_STATUSES } from '@/types/appointment';

export class AppointmentService {
  /**
   * Creates an Appointment and automatically creates a linked Attendance in status 'Pendente' (D1, V07).
   * Supports planned procedures (D3).
   */
  static async createAppointment(data: CreateAppointmentInput) {
    // 1. Verify client exists and is active (V01)
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, status: true, nome: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }
    if (client.status !== 'ativo') {
      throw new ValidationError('Não é possível agendar para um cliente inativo');
    }

    // 2. Validate planned procedures if provided
    let plannedProceduresToCreate: { procedureId: string; ordem: number; valorPadrao: Prisma.Decimal }[] = [];
    let calculatedEstimatedValue = data.valorEstimado !== undefined && data.valorEstimado !== null
      ? new Prisma.Decimal(data.valorEstimado)
      : new Prisma.Decimal(0);

    if (data.plannedProcedureIds && data.plannedProcedureIds.length > 0) {
      const procedures = await prisma.procedure.findMany({
        where: { id: { in: data.plannedProcedureIds }, isActive: true },
        select: { id: true, valorPadrao: true },
      });

      if (procedures.length !== data.plannedProcedureIds.length) {
        throw new ValidationError('Um ou mais procedimentos planejados são inválidos ou estão inativos');
      }

      const procMap = new Map(procedures.map((p) => [p.id, p.valorPadrao]));
      plannedProceduresToCreate = data.plannedProcedureIds.map((procId, index) => ({
        procedureId: procId,
        ordem: index,
        valorPadrao: procMap.get(procId)!,
      }));

      // If user did not provide an estimated value, auto-sum standard values of planned procedures
      if (data.valorEstimado === undefined || data.valorEstimado === null) {
        calculatedEstimatedValue = plannedProceduresToCreate.reduce(
          (acc, p) => acc.add(p.valorPadrao),
          new Prisma.Decimal(0)
        );
      }
    }

    // 3. Execute atomic transaction (Appointment + PlannedProcedures + Attendance [Pendente])
    return await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          clientId: data.clientId,
          dataHora: data.dataHora,
          status: 'Agendado',
          valorEstimado: calculatedEstimatedValue,
          observacoes: data.observacoes ? data.observacoes.trim() : null,
          plannedProcedures: {
            create: plannedProceduresToCreate.map((p) => ({
              procedureId: p.procedureId,
              ordem: p.ordem,
            })),
          },
          attendances: {
            create: {
              clientId: data.clientId,
              status: 'Pendente', // CRITICAL D1: Always starts as Pendente, never Realizado
              dataHora: data.dataHora,
              desconto: new Prisma.Decimal(0),
              observacoes: 'Atendimento gerado automaticamente pelo agendamento',
              ...(data.prefillAttendance && plannedProceduresToCreate.length > 0
                ? {
                    procedures: {
                      create: plannedProceduresToCreate.map((p) => ({
                        procedureId: p.procedureId,
                        standardValueSnapshot: p.valorPadrao, // Snapshot V09
                        practicedValue: p.valorPadrao,        // Practiced value V08
                      })),
                    },
                  }
                : {}),
            },
          },
        },
        include: {
          client: { select: { id: true, nome: true, telefone: true, cpf: true } },
          plannedProcedures: {
            include: { procedure: { select: { id: true, nome: true, duracaoMinutos: true, valorPadrao: true } } },
            orderBy: { ordem: 'asc' },
          },
          attendances: true,
        },
      });

      return appointment;
    });
  }

  /**
   * Retrieves an appointment by ID with full relational context.
   */
  static async getAppointmentById(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true, telefone: true, email: true, cpf: true } },
        plannedProcedures: {
          include: { procedure: true },
          orderBy: { ordem: 'asc' },
        },
        attendances: {
          include: {
            procedures: { include: { procedure: true } },
            payments: true,
          },
        },
        rescheduledFrom: { select: { id: true, dataHora: true, status: true } },
        rescheduledTo: { select: { id: true, dataHora: true, status: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    return appointment;
  }

  /**
   * Lists appointments filtered by date range, client, and status.
   */
  static async listAppointments(query: AppointmentListQuery) {
    const where: Prisma.AppointmentWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status && query.status !== 'todos' ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            dataHora: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { dataHora: 'asc' },
        include: {
          client: { select: { id: true, nome: true, telefone: true, cpf: true } },
          plannedProcedures: {
            include: { procedure: { select: { id: true, nome: true, duracaoMinutos: true } } },
            orderBy: { ordem: 'asc' },
          },
          attendances: {
            select: { id: true, status: true, completedAt: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * Manually confirms an appointment (transitions from 'Agendado' to 'Confirmado').
   */
  static async confirmAppointment(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appointment.status === 'Confirmado') {
      return appointment; // Idempotent
    }

    if (appointment.status !== 'Agendado') {
      throw new ValidationError(`Não é possível confirmar um agendamento com status "${appointment.status}"`);
    }

    return await prisma.appointment.update({
      where: { id },
      data: { status: 'Confirmado' },
      include: { client: true, attendances: true },
    });
  }

  /**
   * Cancels an appointment and automatically cascades status 'Cancelado' to all linked pending attendances (D1 Rule 2).
   * Attendances already 'Realizado' are left intact (D1 Rule 5).
   */
  static async cancelAppointment(id: string, input: CancelAppointmentInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado'].includes(appointment.status)) {
      throw new ValidationError(`Agendamento não pode ser cancelado porque já está "${appointment.status}"`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update appointment to Cancelado with cancellation reason
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: 'Cancelado',
          motivoCancelamento: input.motivoCancelamento.trim(),
        },
      });

      // 2. Cascade Cancelado to pending attendances ONLY (D1 Rule 2 & 5)
      await tx.attendance.updateMany({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      return updated;
    });
  }

  /**
   * Marks an appointment as 'Não compareceu' (no-show) and cascades status 'Cancelado' to pending attendances (D1 Rule 3).
   */
  static async markNoShow(id: string, input?: NoShowAppointmentInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true, observacoes: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado', 'Não compareceu'].includes(appointment.status)) {
      throw new ValidationError(`Agendamento não pode ser marcado como falta porque já está "${appointment.status}"`);
    }

    const updatedObs = input?.observacoes
      ? `${appointment.observacoes ? appointment.observacoes + ' | ' : ''}Falta: ${input.observacoes.trim()}`
      : appointment.observacoes;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: 'Não compareceu',
          observacoes: updatedObs,
        },
      });

      // Cascade Cancelado to pending attendances ONLY
      await tx.attendance.updateMany({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      return updated;
    });
  }

  /**
   * Reschedules an appointment atomically (D1 Rule 4, V04):
   * 1. Marks current appointment as 'Reagendado' and sets rescheduledToId to new appointment.
   * 2. Sets pending attendances of old appointment to 'Cancelado'.
   * 3. Creates new Appointment with status 'Agendado' and rescheduledFromId pointing to old appointment.
   * 4. Creates a new linked Attendance with status 'Pendente'.
   */
  static async rescheduleAppointment(id: string, input: RescheduleAppointmentInput) {
    const oldAppt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        plannedProcedures: true,
        attendances: { where: { status: 'Pendente' } },
      },
    });

    if (!oldAppt) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado'].includes(oldAppt.status)) {
      throw new ValidationError(`Agendamento não pode ser reagendado porque já está "${oldAppt.status}"`);
    }

    // Determine planned procedures for new appointment
    const plannedProcIds = input.plannedProcedureIds ?? oldAppt.plannedProcedures.map((p) => p.procedureId);

    return await prisma.$transaction(async (tx) => {
      // 1. Create new Appointment with status 'Agendado'
      const newAppt = await tx.appointment.create({
        data: {
          clientId: oldAppt.clientId,
          dataHora: input.novaDataHora,
          status: 'Agendado',
          valorEstimado: input.valorEstimado !== undefined && input.valorEstimado !== null
            ? new Prisma.Decimal(input.valorEstimado)
            : oldAppt.valorEstimado,
          observacoes: input.motivo
            ? `Reagendado a partir de ${oldAppt.dataHora.toISOString()}: ${input.motivo.trim()}`
            : oldAppt.observacoes,
          rescheduledFromId: oldAppt.id,
          plannedProcedures: {
            create: plannedProcIds.map((procId, index) => ({
              procedureId: procId,
              ordem: index,
            })),
          },
          attendances: {
            create: {
              clientId: oldAppt.clientId,
              status: 'Pendente', // New pending attendance for new appointment (D1 Rule 4)
              dataHora: input.novaDataHora,
              desconto: new Prisma.Decimal(0),
              observacoes: 'Atendimento do reagendamento',
            },
          },
        },
        include: {
          client: true,
          attendances: true,
          plannedProcedures: { include: { procedure: true } },
        },
      });

      // 2. Update old appointment to 'Reagendado' and link rescheduledToId
      await tx.appointment.update({
        where: { id: oldAppt.id },
        data: {
          status: 'Reagendado',
          rescheduledToId: newAppt.id,
        },
      });

      // 3. Cancel old pending attendances (D1 Rule 4)
      await tx.attendance.updateMany({
        where: {
          appointmentId: oldAppt.id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      return newAppt;
    });
  }

  /**
   * Concludes an appointment (Validation V08, §27):
   * Cannot complete appointment without completed attendance!
   */
  static async completeAppointment(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        attendances: {
          select: { id: true, status: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appointment.status === 'Concluído') {
      return appointment; // Idempotent
    }

    if (['Cancelado', 'Não compareceu', 'Reagendado'].includes(appointment.status)) {
      throw new ValidationError(`Não é possível concluir um agendamento com status "${appointment.status}"`);
    }

    // Validation V08 Guard: At least one attendance must be 'Realizado'
    const hasRealizado = appointment.attendances.some((att) => att.status === 'Realizado');
    if (!hasRealizado) {
      throw new ValidationError('Não é possível concluir o agendamento sem que o atendimento esteja realizado');
    }

    // Check if there are still lingering 'Pendente' attendances
    const hasPending = appointment.attendances.some((att) => att.status === 'Pendente');
    if (hasPending) {
      throw new ValidationError('Existem atendimentos pendentes vinculados a este agendamento');
    }

    return await prisma.appointment.update({
      where: { id },
      data: { status: 'Concluído' },
      include: {
        client: true,
        attendances: true,
      },
    });
  }
}
```

---

#### File: `src/services/attendance.service.ts`
```typescript
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AddAttendanceProcedureInput,
  UpdateAttendanceProcedureInput,
  SetDiscountInput,
  AttendanceListQuery,
} from '@/schemas/attendance';

export interface AttendanceFinancialsDto {
  standardTotal: number;
  practicedTotal: number;
  explicitDiscount: number;
  netTotal: number;
  paidTotal: number;
  outstandingBalance: number;
  isFullyPaid: boolean;
}

export class AttendanceService {
  /**
   * Computes dynamic financials for an attendance according to D2 rules (not stored in DB).
   */
  static computeFinancials(attendance: {
    desconto: Prisma.Decimal | number;
    procedures: { standardValueSnapshot: Prisma.Decimal | number; practicedValue: Prisma.Decimal | number }[];
    payments?: { valor: Prisma.Decimal | number; status: string }[];
  }): AttendanceFinancialsDto {
    const standardTotal = attendance.procedures.reduce(
      (acc, p) => acc + Number(p.standardValueSnapshot),
      0
    );

    const practicedTotal = attendance.procedures.reduce(
      (acc, p) => acc + Number(p.practicedValue),
      0
    );

    const explicitDiscount = Number(attendance.desconto ?? 0);
    const netTotal = Math.max(0, practicedTotal - explicitDiscount);

    const paidTotal = (attendance.payments ?? [])
      .filter((pay) => pay.status === 'Pago')
      .reduce((acc, pay) => acc + Number(pay.valor), 0);

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

  /**
   * Creates an additional Attendance for an existing Appointment (supports 1:N cardinality).
   * Status always defaults to 'Pendente' (D1, V07).
   */
  static async createAttendance(data: CreateAttendanceInput) {
    const appt = await prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      select: { id: true, clientId: true, status: true },
    });

    if (!appt) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appt.clientId !== data.clientId) {
      throw new ValidationError('O cliente informado não corresponde ao cliente do agendamento');
    }

    if (['Cancelado', 'Reagendado'].includes(appt.status)) {
      throw new ValidationError(`Não é possível criar atendimento para um agendamento "${appt.status}"`);
    }

    return await prisma.attendance.create({
      data: {
        appointmentId: data.appointmentId,
        clientId: data.clientId,
        status: 'Pendente', // Never created as Realizado
        dataHora: data.dataHora ?? new Date(),
        desconto: new Prisma.Decimal(data.desconto ?? 0),
        observacoes: data.observacoes ? data.observacoes.trim() : null,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true } },
        appointment: { select: { id: true, dataHora: true, status: true } },
      },
    });
  }

  /**
   * Retrieves an attendance with full clinical context and dynamic financial summary (D2).
   */
  static async getAttendanceById(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        client: true,
        appointment: {
          include: {
            plannedProcedures: { include: { procedure: true } },
          },
        },
        procedures: {
          include: {
            procedure: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        medicalRecord: true,
        attachments: true,
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
        productUsages: {
          include: {
            stockUnit: {
              include: { lot: { include: { product: true } } },
            },
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const financials = this.computeFinancials(attendance);

    return {
      ...attendance,
      financials,
    };
  }

  /**
   * Lists attendances with filtering and pagination.
   */
  static async listAttendances(query: AttendanceListQuery) {
    const where: Prisma.AttendanceWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
      ...(query.status && query.status !== 'todos' ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            dataHora: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { dataHora: 'desc' },
        include: {
          client: { select: { id: true, nome: true, telefone: true } },
          appointment: { select: { id: true, dataHora: true, status: true } },
          procedures: {
            include: { procedure: { select: { id: true, nome: true } } },
          },
          payments: { select: { id: true, valor: true, status: true } },
        },
      }),
    ]);

    const mappedItems = items.map((item) => ({
      ...item,
      financials: this.computeFinancials(item),
    }));

    return {
      items: mappedItems,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /**
   * Associates a procedure to an Attendance:
   * 1. Snapshots procedure standard value (standardValueSnapshot) at this instant (V09, V12).
   * 2. Records explicit practiced value (practicedValue) (V08).
   */
  static async addProcedure(attendanceId: string, input: AddAttendanceProcedureInput) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível adicionar procedimentos a um atendimento cancelado');
    }

    const procedure = await prisma.procedure.findUnique({
      where: { id: input.procedureId },
      select: { id: true, nome: true, valorPadrao: true, isActive: true },
    });

    if (!procedure) {
      throw new NotFoundError('Procedimento não encontrado');
    }

    if (!procedure.isActive) {
      throw new ValidationError('Procedimento está inativo no catálogo');
    }

    const created = await prisma.attendanceProcedure.create({
      data: {
        attendanceId,
        procedureId: input.procedureId,
        standardValueSnapshot: procedure.valorPadrao, // Snapshot imutável (V09, V12)
        practicedValue: new Prisma.Decimal(input.practicedValue), // Valor praticado obrigatório (V08)
        observacoes: input.observacoes ? input.observacoes.trim() : null,
      },
      include: {
        procedure: true,
      },
    });

    return created;
  }

  /**
   * Removes an associated procedure from an Attendance.
   */
  static async removeProcedure(attendanceId: string, attendanceProcedureId: string) {
    const record = await prisma.attendanceProcedure.findUnique({
      where: { id: attendanceProcedureId },
      select: { id: true, attendanceId: true },
    });

    if (!record || record.attendanceId !== attendanceId) {
      throw new NotFoundError('Procedimento do atendimento não encontrado');
    }

    await prisma.attendanceProcedure.delete({
      where: { id: attendanceProcedureId },
    });

    return { success: true };
  }

  /**
   * Updates practiced value or notes for an associated procedure.
   */
  static async updateProcedurePracticedValue(
    attendanceId: string,
    attendanceProcedureId: string,
    input: UpdateAttendanceProcedureInput
  ) {
    const record = await prisma.attendanceProcedure.findUnique({
      where: { id: attendanceProcedureId },
      select: { id: true, attendanceId: true },
    });

    if (!record || record.attendanceId !== attendanceId) {
      throw new NotFoundError('Procedimento do atendimento não encontrado');
    }

    return await prisma.attendanceProcedure.update({
      where: { id: attendanceProcedureId },
      data: {
        practicedValue: new Prisma.Decimal(input.practicedValue),
        observacoes: input.observacoes !== undefined ? (input.observacoes ? input.observacoes.trim() : null) : undefined,
      },
      include: { procedure: true },
    });
  }

  /**
   * Pre-fills attendance procedures from the linked appointment's planned procedures (D3).
   */
  static async prefillFromPlanned(attendanceId: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        appointment: {
          include: {
            plannedProcedures: {
              include: { procedure: true },
              orderBy: { ordem: 'asc' },
            },
          },
        },
        procedures: true,
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const planned = attendance.appointment.plannedProcedures;
    if (planned.length === 0) {
      return { addedCount: 0, procedures: attendance.procedures };
    }

    // Add procedures from planned that aren't already added
    const createdProcedures = await prisma.$transaction(
      planned.map((p) =>
        prisma.attendanceProcedure.create({
          data: {
            attendanceId,
            procedureId: p.procedureId,
            standardValueSnapshot: p.procedure.valorPadrao,
            practicedValue: p.procedure.valorPadrao,
            observacoes: 'Pré-preenchido a partir dos procedimentos planejados',
          },
          include: { procedure: true },
        })
      )
    );

    return { addedCount: createdProcedures.length, procedures: createdProcedures };
  }

  /**
   * Sets the explicit discount for the attendance (Validation V11, Example B).
   * Validates that discount <= total of practiced values.
   */
  static async setDiscount(attendanceId: string, input: SetDiscountInput) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { procedures: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const totalPracticed = attendance.procedures.reduce(
      (acc, p) => acc + Number(p.practicedValue),
      0
    );

    if (input.desconto > totalPracticed && totalPracticed > 0) {
      throw new ValidationError(
        `O desconto (R$ ${input.desconto.toFixed(2)}) não pode ser superior ao valor total praticado dos procedimentos (R$ ${totalPracticed.toFixed(2)})`
      );
    }

    return await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        desconto: new Prisma.Decimal(input.desconto),
      },
    });
  }

  /**
   * Manually marks an attendance as 'Realizado' when the clinical encounter occurs (D1).
   */
  static async completeAttendance(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Realizado') {
      return attendance; // Idempotent
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível concluir um atendimento cancelado');
    }

    return await prisma.attendance.update({
      where: { id },
      data: {
        status: 'Realizado',
        completedAt: new Date(),
      },
    });
  }

  /**
   * Manually cancels an attendance.
   */
  static async cancelAttendance(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    return await prisma.attendance.update({
      where: { id },
      data: { status: 'Cancelado' },
    });
  }
}
```

---

### 4.4 API Route Handler Specifications

All route handlers enforce:
1. `await requireAuth(request)` from `@/lib/session`.
2. Promise resolution for Next.js 15 route parameters: `const { id } = await params;`.
3. Zod validation with 400 Bad Request and field errors.
4. Catch block formatting `DomainError` (`ValidationError`, `NotFoundError`, `ConflictError`) with appropriate status codes and logging 500 on unexpected errors.

#### Appointment Route Endpoints:
| Route | Method | Payload / Query | Description |
|---|---|---|---|
| `/api/appointments` | GET | `startDate`, `endDate`, `clientId`, `status`, `page`, `limit` | Lists appointments with pagination and filters |
| `/api/appointments` | POST | `CreateAppointmentInput` | Creates appointment and auto-creates pending attendance |
| `/api/appointments/[id]` | GET | none | Returns appointment detail with attendances and planned procedures |
| `/api/appointments/[id]/confirm` | POST | none | Manually confirms appointment (`Agendado` -> `Confirmado`) |
| `/api/appointments/[id]/cancel` | POST | `{ motivoCancelamento: string }` | Cancels appointment, auto-cancels pending attendances |
| `/api/appointments/[id]/no-show` | POST | `{ observacoes?: string }` | Marks no-show (`Não compareceu`), auto-cancels pending attendances |
| `/api/appointments/[id]/reschedule` | POST | `{ novaDataHora: string, motivo?: string, valorEstimado?: number, plannedProcedureIds?: string[] }` | Atomic reschedule transaction |
| `/api/appointments/[id]/complete` | POST | none | Completes appointment with V08 guard (requires attendance `Realizado`) |

#### Attendance Route Endpoints:
| Route | Method | Payload / Query | Description |
|---|---|---|---|
| `/api/attendances` | GET | `startDate`, `endDate`, `clientId`, `appointmentId`, `status`, `page`, `limit` | Lists attendances with dynamic D2 financials |
| `/api/attendances` | POST | `CreateAttendanceInput` | Creates secondary attendance for appointment (`Pendente`) |
| `/api/attendances/[id]` | GET | none | Returns full clinical attendance workspace data with D2 financials |
| `/api/attendances/[id]/procedures` | POST | `{ procedureId: string, practicedValue: number, observacoes?: string }` | Associates procedure, snapshots `standardValueSnapshot`, records `practicedValue` |
| `/api/attendances/[id]/procedures/[procId]` | DELETE | none | Disassociates procedure from attendance |
| `/api/attendances/[id]/procedures/[procId]` | PATCH | `{ practicedValue: number, observacoes?: string }` | Updates practiced value |
| `/api/attendances/[id]/prefill` | POST | none | Pre-fills attendance procedures from planned procedures |
| `/api/attendances/[id]/discount` | POST | `{ desconto: number }` | Sets explicit attendance discount |
| `/api/attendances/[id]/complete` | POST | none | Manually marks attendance as `Realizado` |
| `/api/attendances/[id]/cancel` | POST | none | Cancels attendance |

---

### 4.5 Automated Testing Specification

To guarantee 100% compliance with Dev Spec §32, D1, D2, D3, and Acceptance Criteria AC 55, AC 56, AC 57:

#### 1. `tests/tier1_features/f17_appointment_service.spec.ts`
- **Test 1**: `createAppointment` creates appointment in `Agendado` status and auto-creates linked attendance in `Pendente` status (never `Realizado`).
- **Test 2**: `createAppointment` with planned procedures creates `PlannedProcedure` records and auto-sums standard values into `valorEstimado` when omitted.
- **Test 3**: `confirmAppointment` transitions from `Agendado` to `Confirmado`.
- **Test 4**: `cancelAppointment` requires `motivoCancelamento`, updates status to `Cancelado`, and cascades `Cancelado` to pending attendances.
- **Test 5**: `markNoShow` updates status to `Não compareceu` and cascades `Cancelado` to pending attendances.
- **Test 6**: `rescheduleAppointment` executes atomic transaction: old appointment -> `Reagendado`, old pending attendance -> `Cancelado`, new appointment -> `Agendado` with `rescheduledFromId`, new attendance -> `Pendente`.

#### 2. `tests/tier1_features/f18_attendance_service.spec.ts`
- **Test 1**: `addProcedure` snapshots procedure standard value into `standardValueSnapshot` and records `practicedValue`.
- **Test 2**: Catalog price modification leaves historical `standardValueSnapshot` and `practicedValue` intact (V12, V24).
- **Test 3**: `setDiscount` allows valid discount, updates `desconto`, and dynamic financials compute `netTotal = practicedTotal - discount`.
- **Test 4**: `setDiscount` throws `ValidationError` if discount exceeds total practiced value.
- **Test 5**: `completeAttendance` updates status from `Pendente` to `Realizado` and sets `completedAt`.

#### 3. `tests/tier2_boundaries/v08_appointment_completion_guard.spec.ts`
- **Test 1**: Calling `completeAppointment` when linked attendance is `Pendente` fails with `ValidationError` ("Não é possível concluir o agendamento sem que o atendimento esteja realizado").
- **Test 2**: Calling `completeAppointment` when linked attendance has been marked `Realizado` succeeds and sets appointment status to `Concluído`.
- **Test 3**: Calling `completeAppointment` on already cancelled, no-show, or rescheduled appointment fails with `ValidationError`.

#### 4. `tests/tier2_boundaries/v09_procedure_pricing_snapshots.spec.ts`
- **Test 1**: Adding a procedure requires non-nullable `practicedValue`.
- **Test 2**: Practiced value different from standard value does not create an automatic discount (`desconto` remains `0.00`).
- **Test 3**: Negative practiced value is rejected by Zod validation.

#### 5. Integration with Existing Suites:
- Update `tests/tier3_combinations/appointment_attendance_d1.spec.ts` to call `AppointmentService` and `AttendanceService` directly rather than executing raw Prisma queries.
- Update `tests/tier4_workflows/scenarios_a_through_e.spec.ts` (Examples A, B, and D) to run through `AppointmentService` and `AttendanceService`.

---

## 5. Verification Method

To verify the implementation once executed:
1. **Compilation & Type Check**:
   ```powershell
   npm run build
   ```
   Ensures zero TypeScript errors across Next.js 15 route parameters, Zod schemas, and Prisma decimal casts.
2. **Linting Check**:
   ```powershell
   npm run lint
   ```
   Ensures zero ESLint warnings or errors.
3. **Automated Unit & Integration Test Suite**:
   ```powershell
   npm test tests/tier1_features/f17_appointment_service.spec.ts
   npm test tests/tier1_features/f18_attendance_service.spec.ts
   npm test tests/tier2_boundaries/v08_appointment_completion_guard.spec.ts
   npm test tests/tier2_boundaries/v09_procedure_pricing_snapshots.spec.ts
   npm test tests/tier3_combinations/appointment_attendance_d1.spec.ts
   npm test tests/tier4_workflows/scenarios_a_through_e.spec.ts
   ```
4. **Invalidation Conditions**:
   - Any test allowing `Em atendimento` to be saved or accepted.
   - Any code path allowing an Attendance to be created initially with status `Realizado`.
   - Any code path completing an Appointment while its Attendance is still `Pendente`.
   - Any code path where rescheduling deletes or mutates the date of the historical appointment record.
   - Any route handler failing to `await params` in Next.js 15.
