# Milestone 3 Technical Specification & Turnkey Handoff Report
**Explorer**: `explorer_m3_3`  
**Domain Focus**: Medical Records (Prontuário V19), Milestone 3 System Integration Architecture, & Master Automated Test Suite Plan  
**Working Directory**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m3_3`  
**Target Milestone**: Milestone 3 (Clinical Workflows, Products, Inventory & Prontuário)  

---

## 1. Observation

### 1.1 Database Schema & Constraints
Direct examination of `prisma/schema.prisma` and `prisma/migrations/20261006000000_init_domain_models/migration.sql` reveals:
- **`MedicalRecord` Model** (`prisma/schema.prisma:137-149`):
  ```prisma
  model MedicalRecord {
    id                  String     @id @default(uuid())
    attendanceId        String     @unique // 1:1 estrito com Atendimento
    queixaPrincipal     String?    @db.NVarChar(Max)
    avaliacaoClinica    String?    @db.NVarChar(Max)
    condutaProcedimento String?    @db.NVarChar(Max)
    orientacoes         String?    @db.NVarChar(Max)
    observacoes         String?    @db.NVarChar(Max)
    createdAt           DateTime   @default(now())
    updatedAt           DateTime   @updatedAt

    attendance Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  }
  ```
- **SQL Server Unique Constraint** (`migration.sql:95-107`):
  ```sql
  CREATE TABLE [dbo].[MedicalRecord] (
      [id] NVARCHAR(1000) NOT NULL,
      [attendanceId] NVARCHAR(1000) NOT NULL,
      [queixaPrincipal] NVARCHAR(max) NULL,
      [avaliacaoClinica] NVARCHAR(max) NULL,
      [condutaProcedimento] NVARCHAR(max) NULL,
      [orientacoes] NVARCHAR(max) NULL,
      [observacoes] NVARCHAR(max) NULL,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [MedicalRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [MedicalRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
      CONSTRAINT [MedicalRecord_attendanceId_key] UNIQUE NONCLUSTERED ([attendanceId])
  );
  ```
- **`Attendance` Model** (`prisma/schema.prisma:111-135`):
  - Primary key `id`, foreign keys `appointmentId` and `clientId`.
  - Status column default `'Pendente'`. Allowed values: `'Pendente'`, `'Realizado'`, `'Cancelado'`.
  - Relations: `appointment` (1:1/1:N parent), `client`, `procedures` (`AttendanceProcedure[]`), `productUsages` (`ProductUsage[]`), `medicalRecord` (`MedicalRecord?`), `attachments` (`Attachment[]`), `payments` (`Payment[]`).
- **`StockUnit` & `ProductUsage` Models** (`prisma/schema.prisma:242-276`):
  - `StockUnit`: `codigoSerial` unique, `status` (`Disponivel`, `EmUso`, `Esgotado`, `Descartado`), `currentClientId` nullable FK to `Client`.
  - `ProductUsage`: links `attendanceId`, `stockUnitId`, optional `attendanceProcedureId`, `dataHora`, `observacoes`.
  - `Product`: `isReusable` boolean (`true` = reusable by same client, `false` = single-use).
  - `ProductLot`: `dataValidade` (expiration date nullable/datetime).

### 1.2 Existing Service & API State
- **Services in `src/services/`**:
  - `auth.service.ts`: Bcrypt session login.
  - `client.service.ts`: Full Client CRUD, CPF validation/normalization, emergency contacts, and `getClientWithHistory(id)`.
  - `procedure.service.ts`: Procedure catalog CRUD, positive standard values, duration.
  - `attachment.service.ts`: Authenticated file upload, disk storage outside web root, MIME validation, XOR Client vs Attendance ownership check.
  - **Missing Services**: `appointment.service.ts`, `attendance.service.ts`, `product.service.ts`, `stock.service.ts`, and `medical-record.service.ts`.
- **API Routes in `src/app/api/`**:
  - `/api/auth/*`: login/logout/session.
  - `/api/clients/*`: list, create, `[id]` GET/PUT/DELETE, `[id]/contacts`, `[id]/photo`. Note: `/api/clients/[id]?history=true` calls `ClientService.getClientWithHistory(id)`.
  - `/api/procedures/*`: procedure catalog endpoints.
  - `/api/attachments/*`: upload and authenticated streaming.
  - **Missing API Routes**: `/api/appointments/*`, `/api/attendances/*`, `/api/products/*`, and `/api/clients/[id]/history`.

### 1.3 Test Infrastructure & Database Cleanup
- **Test Database**: `PopoAppTest` on SQL Server LocalDB with isolation guard in `tests/helpers/db-client.ts`.
- **Database Cleaner** (`tests/helpers/db-cleaner.ts`):
  Cleans tables in foreign-key order: `Reminder` -> `PixInstallment` -> `Payment` -> `ProductUsage` -> `StockUnit` -> `ProductLot` -> `ProcedureProduct` -> `Product` -> `AttendanceProcedure` -> `PlannedProcedure` -> `MedicalRecord` -> `Attachment` -> `Attendance` -> `Appointment` -> `EmergencyContact` -> `Client` -> `Procedure` -> `User`.
- **Existing Test Suites**:
  15 test files (89 tests passing). Tier 4 test `tests/tier4_workflows/scenarios_a_through_e.spec.ts` currently bypasses services and writes directly to Prisma.

---

## 2. Logic Chain

1. **Validation V19 & Data Integrity**:
   - Spec §19, §31, §32 V19, and AC 65 state: "There is exactly one Medical Record per Attendance."
   - The database already contains a `UNIQUE NONCLUSTERED` constraint on `[dbo].[MedicalRecord].[attendanceId]`.
   - Therefore, `MedicalRecordService` must enforce this 1:1 relationship at both layers:
     - **Pre-check**: Query `prisma.medicalRecord.findUnique({ where: { attendanceId } })`. If present, reject immediately with `ConflictError('Atendimento já possui prontuário cadastrado')` (HTTP 409).
     - **Database guard**: Catch Prisma `P2002` error and map to `ConflictError`.
     - **Precondition check**: Attendance must exist (`NotFoundError` 404). Attendance must not be `Cancelado` (`ValidationError` 400), because an unperformed/cancelled clinical encounter cannot generate a clinical record.

2. **Clinical Fields & Semantic Vocabulary**:
   - The clinical domain requires: anamnese, queixa principal, evolução clínica, orientações pós-procedimento, intercorrências, fotos/observações.
   - The database columns are: `queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes`, `observacoes`.
   - To provide an intuitive developer experience while honoring the existing database migration, `createMedicalRecordSchema` and `MedicalRecordService` should accept both canonical names and clinical aliases:
     - `queixaPrincipal` = Queixa Principal
     - `avaliacaoClinica` / `anamnese` = Anamnese e Avaliação Clínica
     - `condutaProcedimento` / `evolucaoClinica` = Evolução Clínica / Conduta Realizada
     - `orientacoes` / `orientacoesPosProcedimento` = Orientações pós-procedimento
     - `observacoes` / `intercorrencias` = Intercorrências, observações e referências a fotos/anexos.
   - Clinical attachments (photos before/after) are linked to the Attendance (`Attachment.attendanceId`). The Medical Record query must include these attachments.

3. **System Integration Architecture**:
   - The clinical workflow moves through four interrelated services:
     - `AppointmentService`: Initiates the workflow. Creating an Appointment automatically instantiates a `Pendente` Attendance (D1). Cancelling or rescheduling cascades status `Cancelado` to the pending Attendance (D1). Concluding the Appointment requires the Attendance to be `Realizado` (V08).
     - `AttendanceService`: Manages clinical procedure execution. Adding procedures snapshots the catalog standard value into `standardValueSnapshot` (V09) while capturing the independent `practicedValue` (D2, §11).
     - `ProductService` & `StockService`: Controls inventory usage. When stock units are dispensed, it validates lot expiration (V15), enforces single-use non-reusability (V18), allows same-client reuse of reusable units (V16), and blocks cross-client reuse with HTTP 409 / `ConflictError` (V17, AC 59, AC 66).
     - `MedicalRecordService`: Documents clinical observations for the encounter (V19).
   - Once the clinical encounter is documented and completed, `ClientService.getClientWithHistory` or `GET /api/clients/[id]/history` provides a unified timeline aggregating appointments, attendances, procedures, product usage, medical records, attachments, and payments.

4. **Test Suite Stratification**:
   - A 3-tier testing strategy guarantees complete coverage without test flakiness:
     - **Tier 1 (Feature)**: 5 unit/integration test files verifying each service in isolation (`AppointmentService`, `AttendanceService`, `ProductService`, `StockService`, `MedicalRecordService`).
     - **Tier 2 (Boundary & Rules)**: 7 focused test files verifying critical rules V08, V09, V15, V16, V17, V18, and V19 under adversarial inputs.
     - **Tier 3 (Combination / E2E)**: 1 comprehensive test file exercising the complete multi-entity lifecycle from appointment booking to client history aggregation.

---

## 3. Caveats

1. **Prisma Schema Stability**:
   - `prisma/schema.prisma` already defines `MedicalRecord` with columns `queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes`, `observacoes`. No schema migration or ALTER TABLE is needed or permitted. Aliases (`anamnese`, `evolucaoClinica`, `intercorrencias`) must be resolved at the Zod schema / service layer.
2. **File Attachments Distinction**:
   - Attachments belong exclusively to `Client` OR `Attendance` via `CK_Attachment_Ownership` (AC 61). Clinical photos (before/after) belong to the `Attendance`, NOT directly to `MedicalRecord`. The `MedicalRecord` accesses photos through its parent `Attendance`.
3. **Financial Isolation (Milestone 4)**:
   - While `AttendanceService` records practiced procedure values and discounts, complex payment calculations, card installment logic, and PIX installment schedules belong to Milestone 4 (`FinancialService`). Milestone 3 only verifies that procedure associations store snapshots and practiced values.

---

## 4. Conclusion & Technical Implementation Specification

### 4.1 Medical Record Domain Service Specification

#### File: `src/schemas/medical-record.ts`
```typescript
import { z } from 'zod';

export const createMedicalRecordSchema = z.object({
  attendanceId: z.string().uuid('ID do atendimento inválido'),
  // Canonical fields
  queixaPrincipal: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  avaliacaoClinica: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  condutaProcedimento: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  orientacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  observacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  
  // Semantic clinical aliases (Brazilian clinical terminology)
  anamnese: z.string().trim().max(10000).optional(),
  evolucaoClinica: z.string().trim().max(10000).optional(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional(),
  intercorrencias: z.string().trim().max(5000).optional(),
}).transform((data) => {
  // Resolve aliases into canonical columns
  const avaliacaoClinica = data.avaliacaoClinica ?? data.anamnese ?? null;
  const condutaProcedimento = data.condutaProcedimento ?? data.evolucaoClinica ?? null;
  const orientacoes = data.orientacoes ?? data.orientacoesPosProcedimento ?? null;
  
  let observacoes = data.observacoes ?? null;
  if (data.intercorrencias) {
    observacoes = observacoes 
      ? `${observacoes}\n\n[Intercorrências]: ${data.intercorrencias}`
      : `[Intercorrências]: ${data.intercorrencias}`;
  }

  return {
    attendanceId: data.attendanceId,
    queixaPrincipal: data.queixaPrincipal ?? null,
    avaliacaoClinica,
    condutaProcedimento,
    orientacoes,
    observacoes,
  };
});

export const updateMedicalRecordSchema = z.object({
  queixaPrincipal: z.string().trim().max(5000).optional().nullable(),
  avaliacaoClinica: z.string().trim().max(10000).optional().nullable(),
  condutaProcedimento: z.string().trim().max(10000).optional().nullable(),
  orientacoes: z.string().trim().max(5000).optional().nullable(),
  observacoes: z.string().trim().max(5000).optional().nullable(),
  anamnese: z.string().trim().max(10000).optional(),
  evolucaoClinica: z.string().trim().max(10000).optional(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional(),
  intercorrencias: z.string().trim().max(5000).optional(),
}).transform((data) => {
  const avaliacaoClinica = data.avaliacaoClinica ?? data.anamnese;
  const condutaProcedimento = data.condutaProcedimento ?? data.evolucaoClinica;
  const orientacoes = data.orientacoes ?? data.orientacoesPosProcedimento;
  
  let observacoes = data.observacoes;
  if (data.intercorrencias !== undefined) {
    observacoes = observacoes 
      ? `${observacoes}\n\n[Intercorrências]: ${data.intercorrencias}`
      : `[Intercorrências]: ${data.intercorrencias}`;
  }

  return {
    ...(data.queixaPrincipal !== undefined ? { queixaPrincipal: data.queixaPrincipal } : {}),
    ...(avaliacaoClinica !== undefined ? { avaliacaoClinica } : {}),
    ...(condutaProcedimento !== undefined ? { condutaProcedimento } : {}),
    ...(orientacoes !== undefined ? { orientacoes } : {}),
    ...(observacoes !== undefined ? { observacoes } : {}),
  };
});

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;
export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>;
```

#### File: `src/services/medical-record.service.ts`
```typescript
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { CreateMedicalRecordInput, UpdateMedicalRecordInput } from '@/schemas/medical-record';

export class MedicalRecordService {
  /**
   * Creates a medical record for an attendance.
   * Strictly enforces 1:1 relationship with Attendance (V19).
   */
  static async createMedicalRecord(data: CreateMedicalRecordInput) {
    // 1. Verify Attendance exists
    const attendance = await prisma.attendance.findUnique({
      where: { id: data.attendanceId },
      include: { medicalRecord: { select: { id: true } } },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    // 2. Attendance cannot be Cancelado
    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível criar prontuário para um atendimento cancelado');
    }

    // 3. Strict 1:1 check (V19)
    if (attendance.medicalRecord) {
      throw new ConflictError('Atendimento já possui prontuário cadastrado (V19)');
    }

    try {
      const record = await prisma.medicalRecord.create({
        data: {
          attendanceId: data.attendanceId,
          queixaPrincipal: data.queixaPrincipal,
          avaliacaoClinica: data.avaliacaoClinica,
          condutaProcedimento: data.condutaProcedimento,
          orientacoes: data.orientacoes,
          observacoes: data.observacoes,
        },
        include: {
          attendance: {
            include: {
              client: { select: { id: true, nome: true, cpf: true } },
              procedures: { include: { procedure: true } },
              productUsages: {
                include: {
                  stockUnit: {
                    include: { lot: { include: { product: true } } },
                  },
                },
              },
              attachments: true,
            },
          },
        },
      });

      return record;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Atendimento já possui prontuário cadastrado (V19)');
      }
      throw error;
    }
  }

  /**
   * Retrieves medical record by attendance ID with clinical context.
   */
  static async getByAttendanceId(attendanceId: string) {
    const record = await prisma.medicalRecord.findUnique({
      where: { attendanceId },
      include: {
        attendance: {
          include: {
            client: true,
            procedures: { include: { procedure: true } },
            productUsages: {
              include: {
                stockUnit: {
                  include: { lot: { include: { product: true } } },
                },
              },
            },
            attachments: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundError('Prontuário não encontrado para este atendimento');
    }

    return record;
  }

  /**
   * Updates clinical fields of an existing medical record.
   */
  static async updateByAttendanceId(attendanceId: string, data: UpdateMedicalRecordInput) {
    const existing = await prisma.medicalRecord.findUnique({
      where: { attendanceId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Prontuário não encontrado para este atendimento');
    }

    return prisma.medicalRecord.update({
      where: { attendanceId },
      data,
      include: {
        attendance: {
          include: {
            client: { select: { id: true, nome: true } },
            procedures: { include: { procedure: true } },
            attachments: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves all medical records for a specific client across attendances.
   */
  static async getClientMedicalRecords(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.medicalRecord.findMany({
      where: {
        attendance: {
          clientId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        attendance: {
          include: {
            procedures: { include: { procedure: true } },
            productUsages: {
              include: {
                stockUnit: {
                  include: { lot: { include: { product: true } } },
                },
              },
            },
            attachments: true,
          },
        },
      },
    });
  }
}
```

---

### 4.2 System Integration Architecture & API Contracts

```
+---------------------------------------------------------------------------------------+
|                                    PopoApp UI                                         |
|  (/agenda, /atendimentos/[id], /produtos, /clientes/[id], /clientes/[id]/history)     |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v HTTP (iron-session / JSON)
+---------------------------------------------------------------------------------------+
|                                  API Route Handlers                                   |
|   /api/appointments/*   /api/attendances/*   /api/products/*   /api/clients/[id]/*    |
+---------+--------------------+-------------------+--------------------+---------------+
          |                    |                   |                    |
          v                    v                   v                    v
+------------------+  +------------------+  +------------------+  +---------------------+
|AppointmentService|  |AttendanceService |  | ProductService & |  | MedicalRecordService|
|                  |  |                  |  |   StockService   |  |                     |
| - 6 Statuses     |  | - D1 State Mach. |  | - Lot Intake     |  | - Strict 1:1 (V19)  |
| - Planned Procs  |  | - Snapshot (V09) |  | - Expiration(V15)|  | - Anamnese & Queixa |
| - Reschedule (D1)|  | - Practiced Val  |  | - Reuse (V16)    |  | - Conduta & Orient. |
| - Conclude (V08) |  | - Completion     |  | - Cross-Client   |  | - Intercorrências   |
|                  |  |                  |  |   Block (V17)    |  |                     |
|                  |  |                  |  | - Single-Use(V18)|  |                     |
+---------+--------+  +--------+---------+  +--------+---------+  +----------+----------+
          |                    |                     |                       |
          +--------------------+----------+----------+-----------------------+
                                          |
                                          v Prisma ORM / SQL Server LocalDB
+---------------------------------------------------------------------------------------+
|                                Relational Database                                    |
| [Appointment] [Attendance] [AttendanceProcedure] [ProductLot] [StockUnit]             |
| [ProductUsage] [MedicalRecord] (UNIQUE attendanceId) [Attachment] (XOR CHECK)         |
+---------------------------------------------------------------------------------------+
```

#### Interlocking Service Contracts:
1. **Appointment Creation -> Attendance Auto-Creation (D1)**:
   ```typescript
   // AppointmentService.createAppointment:
   await prisma.$transaction(async (tx) => {
     const appt = await tx.appointment.create({
       data: {
         clientId: input.clientId,
         dataHora: input.dataHora,
         status: 'Agendado',
         valorEstimado: input.valorEstimado,
         observacoes: input.observacoes,
         plannedProcedures: {
           create: input.plannedProcedureIds?.map((pid, idx) => ({
             procedureId: pid,
             ordem: idx,
           })) ?? [],
         },
         attendances: {
           create: {
             clientId: input.clientId,
             status: 'Pendente',
             dataHora: input.dataHora,
             observacoes: 'Atendimento gerado automaticamente',
           },
         },
       },
       include: { attendances: true, plannedProcedures: true },
     });
     return appt;
   });
   ```

2. **Rescheduling Cascade (D1)**:
   ```typescript
   // AppointmentService.rescheduleAppointment(id, newDataHora):
   await prisma.$transaction(async (tx) => {
     const oldAppt = await tx.appointment.findUnique({ where: { id } });
     // Create new appointment
     const newAppt = await tx.appointment.create({
       data: {
         clientId: oldAppt.clientId,
         dataHora: newDataHora,
         status: 'Agendado',
         rescheduledFromId: oldAppt.id,
         attendances: {
           create: {
             clientId: oldAppt.clientId,
             status: 'Pendente',
             dataHora: newDataHora,
           },
         },
       },
     });
     // Update old appointment to Reagendado and cancel its pending attendance
     await tx.appointment.update({
       where: { id: oldAppt.id },
       data: { status: 'Reagendado', rescheduledToId: newAppt.id },
     });
     await tx.attendance.updateMany({
       where: { appointmentId: oldAppt.id, status: 'Pendente' },
       data: { status: 'Cancelado' },
     });
     return newAppt;
   });
   ```

3. **Appointment Conclusion Guard (V08)**:
   ```typescript
   // AppointmentService.completeAppointment(id):
   const appt = await prisma.appointment.findUnique({
     where: { id },
     include: { attendances: true },
   });
   const hasRealizado = appt.attendances.some((a) => a.status === 'Realizado');
   if (!hasRealizado) {
     throw new ValidationError('Não é possível concluir agendamento sem atendimento realizado (V08)');
   }
   return prisma.appointment.update({
     where: { id },
     data: { status: 'Concluído' },
   });
   ```

4. **Stock Unit Dispensation & Reuse Rules (V15, V16, V17, V18, AC 59, AC 66)**:
   ```typescript
   // StockService.consumeStockUnit({ attendanceId, stockUnitId, procedureId }):
   await prisma.$transaction(async (tx) => {
     const attendance = await tx.attendance.findUnique({
       where: { id: attendanceId },
       select: { id: true, clientId: true, status: true },
     });
     if (!attendance || attendance.status === 'Cancelado') {
       throw new ValidationError('Atendimento inválido ou cancelado');
     }

     const unit = await tx.stockUnit.findUnique({
       where: { id: stockUnitId },
       include: {
         lot: { include: { product: true } },
         usages: { include: { attendance: { select: { clientId: true } } } },
       },
     });
     if (!unit) throw new NotFoundError('Unidade de estoque não encontrada');

     // V15: Expired Lot Guard
     if (unit.lot.dataValidade && new Date(unit.lot.dataValidade) < new Date()) {
       throw new ValidationError('Lote vencido não pode ser utilizado (V15)');
     }

     if (unit.status === 'Esgotado' || unit.status === 'Descartado') {
       throw new ConflictError('Unidade de estoque indisponível');
     }

     const isReusable = unit.lot.product.isReusable;

     if (!isReusable) {
       // Single-use product: V18
       if (unit.usages.length > 0 || unit.currentClientId !== null) {
         throw new ConflictError('Unidade de uso único já utilizada anteriormente (V18)');
       }
       // Mark unit exhausted
       await tx.stockUnit.update({
         where: { id: unit.id },
         data: { status: 'Esgotado', currentClientId: attendance.clientId },
       });
     } else {
       // Reusable product: V16 & V17
       if (unit.currentClientId && unit.currentClientId !== attendance.clientId) {
         // V17 & AC 59 / AC 66: Cross-client reuse strictly rejected
         throw new ConflictError('Unidade reutilizável já vinculada a outro cliente (V17)');
       }
       // Assign client and set EmUso if first use
       await tx.stockUnit.update({
         where: { id: unit.id },
         data: { status: 'EmUso', currentClientId: attendance.clientId },
       });
     }

     // Create ProductUsage record
     return tx.productUsage.create({
       data: {
         attendanceId,
         stockUnitId,
         attendanceProcedureId: procedureId ?? null,
         dataHora: new Date(),
       },
     });
   });
   ```

#### API Route Specifications:

##### 1. Route: `/api/attendances/[id]/record/route.ts`
- **`GET`**:
  - Auth: `await requireAuth(request)`.
  - Action: `MedicalRecordService.getByAttendanceId(id)`.
  - Response: `{ success: true, data: MedicalRecord }` (200), or `{ success: false, error: '...' }` (404/500).
- **`POST`**:
  - Auth: `await requireAuth(request)`.
  - Body: validated against `createMedicalRecordSchema` with `attendanceId: params.id`.
  - Action: `MedicalRecordService.createMedicalRecord(parsed.data)`.
  - Response: `{ success: true, data: MedicalRecord }` (201), or 400 (validation), 404 (not found), 409 (duplicate record V19).
- **`PUT`**:
  - Auth: `await requireAuth(request)`.
  - Body: validated against `updateMedicalRecordSchema`.
  - Action: `MedicalRecordService.updateByAttendanceId(params.id, parsed.data)`.
  - Response: `{ success: true, data: updated }` (200).

##### 2. Route: `/api/clients/[id]/history/route.ts`
- **`GET`**:
  - Auth: `await requireAuth(request)`.
  - Action: Calls `ClientService.getClientWithHistory(params.id)` and shapes into chronological clinical timeline.
  - Returns:
    ```json
    {
      "success": true,
      "data": {
        "client": { "id": "...", "nome": "...", "cpf": "...", "status": "ativo" },
        "timeline": [
          {
            "type": "attendance",
            "id": "...",
            "dataHora": "2026-10-16T14:00:00Z",
            "status": "Realizado",
            "procedures": [{ "nome": "Botox", "standardValue": 500, "practicedValue": 400 }],
            "productUsages": [{ "serial": "UNIT-001", "product": "Toxina Botulínica", "lot": "LOTE-10" }],
            "medicalRecord": { "queixaPrincipal": "...", "condutaProcedimento": "..." },
            "attachments": [{ "id": "...", "categoria": "clinico", "nomeOriginal": "antes.jpg" }],
            "financialSummary": { "practicedTotal": 400, "discount": 0, "netTotal": 400 }
          },
          {
            "type": "appointment",
            "id": "...",
            "dataHora": "2026-10-15T10:00:00Z",
            "status": "Reagendado",
            "rescheduledToId": "..."
          }
        ]
      }
    }
    ```

---

### 4.3 Master Automated Test Suite Plan for Milestone 3

#### Tier 1: Feature Coverage Test Suite
| File Path | Description | Key Assertions / Verifications |
|-----------|-------------|--------------------------------|
| `tests/tier1_features/f17_appointment_service.spec.ts` | Appointment CRUD & lifecycle | - Creates appointment and verifies auto-created attendance is `Pendente` (D1)<br>- Stores planned procedures in `PlannedProcedure`<br>- Updates status through `Agendado`, `Confirmado`<br>- Cancelling appointment auto-cancels pending attendance<br>- Rescheduling preserves old appointment as `Reagendado` with `rescheduledToId` |
| `tests/tier1_features/f18_attendance_service.spec.ts` | Attendance D1 state machine | - Adding procedure captures `standardValueSnapshot` and independent `practicedValue`<br>- Adding explicit attendance discount<br>- Completing attendance sets `status = Realizado` and `completedAt`<br>- Prevents modification of cancelled attendance |
| `tests/tier1_features/f20_product_lot_service.spec.ts` | Product catalog & Lot intake | - Creates single-use and reusable products<br>- Ingests lots with `numeroLote`, `dataValidade`, `precoCusto`<br>- Queries active products and their active lots |
| `tests/tier1_features/f21_stock_unit_service.spec.ts` | Stock unit generation & status | - Generates N traceable units with unique `codigoSerial`<br>- Initial status is `Disponivel`<br>- Tracks unit state through `Disponivel` -> `EmUso` -> `Esgotado` |
| `tests/tier1_features/f22_medical_record_service.spec.ts` | Medical Record 1:1 creation & retrieval | - Creates medical record with all clinical fields (`queixaPrincipal`, `avaliacaoClinica`, `condutaProcedimento`, `orientacoes`, `observacoes`)<br>- Retrieves record by `attendanceId` with related attendance and client<br>- Updates clinical fields<br>- Lists all records for client chronologically |

#### Tier 2: Boundary & Validation Rules Test Suite
| File Path | Validation Rule | Test Scenarios |
|-----------|-----------------|----------------|
| `tests/tier2_boundaries/v08_completed_appointment_requires_completed_attendance.spec.ts` | **V08** | 1. Attempting to conclude Appointment with pending Attendance throws `ValidationError` (400).<br>2. Attempting to conclude Appointment with cancelled Attendance throws `ValidationError` (400).<br>3. Concluding Appointment when Attendance is `Realizado` succeeds. |
| `tests/tier2_boundaries/v09_procedure_standard_value_snapshot.spec.ts` | **V09** (also V12, V24) | 1. `standardValueSnapshot` matches catalog `valorPadrao` at insertion.<br>2. Mutating catalog `valorPadrao` does NOT alter snapshot in existing attendance.<br>3. Practiced value differs from standard value without generating automatic discount. |
| `tests/tier2_boundaries/v15_expired_lot_rejection.spec.ts` | **V15** | 1. Consuming stock unit from a lot with `dataValidade < now` throws `ValidationError('Lote vencido não pode ser utilizado')`.<br>2. Consuming unit from lot with valid future date succeeds.<br>3. Direct service call bypassing UI fails with 400. |
| `tests/tier2_boundaries/v16_same_client_product_reuse.spec.ts` | **V16** | 1. First consumption of reusable unit binds `currentClientId = clientA.id` and status `EmUso`.<br>2. Second consumption of the same unit in a subsequent attendance of Client A succeeds.<br>3. Generates multiple `ProductUsage` records linked to Client A. |
| `tests/tier2_boundaries/v17_cross_client_reuse_prevention.spec.ts` | **V17, AC 59, AC 66** | 1. Attempting to consume unit bound to Client A for Client B throws `ConflictError('Unidade reutilizável já vinculada a outro cliente')` (409).<br>2. Direct service call bypassing UI fails with 409.<br>3. Database state intact: 0 usage rows for Client B, `currentClientId` unchanged. |
| `tests/tier2_boundaries/v18_single_use_product_rejection.spec.ts` | **V18, AC 59** | 1. First consumption of single-use unit transitions status to `Esgotado`.<br>2. Attempting second consumption for the SAME client throws `ConflictError` (409).<br>3. Attempting second consumption for a DIFFERENT client throws `ConflictError` (409). |
| `tests/tier2_boundaries/v19_medical_record_strict_1to1.spec.ts` | **V19** | 1. Creating medical record for attendance succeeds.<br>2. Attempting to create second record for same attendance via service throws `ConflictError` (409).<br>3. Direct Prisma insert bypassing service throws SQL Server unique constraint violation `MedicalRecord_attendanceId_key` (`P2002`).<br>4. Attempting to create record for cancelled attendance throws `ValidationError` (400). |

#### Tier 3: Combination & End-to-End Workflow Test Suite
- **File**: `tests/tier3_combinations/m3_clinical_workflow_e2e.spec.ts`
- **Execution Flow**:
  1. Create Client with valid CPF, emergency contacts, profile photo.
  2. Create Appointment with planned procedures (D3). Verify Attendance auto-created in `Pendente` (D1).
  3. Confirm Appointment (`Confirmado`).
  4. Associate 2 procedures to Attendance with practiced values distinct from standard values. Verify standard value snapshots captured (V09).
  5. Apply explicit discount on Attendance (D2).
  6. Dispense 1 single-use unit and 1 reusable unit. Verify consumption recorded in `ProductUsage`.
  7. Fill Medical Record with full clinical fields: queixa principal, anamnese, conduta, orientações, intercorrências (V19).
  8. Complete Attendance (`Realizado`, `completedAt`).
  9. Complete Appointment (`Concluído`) - succeeds because Attendance is `Realizado` (V08).
  10. Attempt cross-client reuse of the reusable unit on Client B -> strictly rejected with 409 (V17, AC 59).
  11. Attempt reuse of single-use unit -> strictly rejected with 409 (V18, AC 59).
  12. Reuse the reusable unit on Client A in a second encounter -> succeeds (V16).
  13. Query `/api/clients/[id]/history` -> verifies consolidated chronological timeline returns all events, procedures, products, medical records, and financial totals intact.

---

## 5. Verification Method

To independently verify the implementation once coded:
1. **Lint and Compilation Check**:
   ```powershell
   npm run lint
   npm run build
   ```
   Must pass with 0 errors and all 17+ pages generated.
2. **Execute Full Automated Test Suite**:
   ```powershell
   npm test
   ```
   All existing tests (89 passing) plus the new Milestone 3 tests (Tier 1, Tier 2, Tier 3) must pass against `PopoAppTest` with 0 failures.
3. **Inspect Key Boundary Assertions**:
   - Verify `tests/tier2_boundaries/v19_medical_record_strict_1to1.spec.ts` asserts both service-level `ConflictError` and database-level `P2002` constraint.
   - Verify `tests/tier2_boundaries/v17_cross_client_reuse_prevention.spec.ts` asserts cross-client reuse rejection with HTTP 409.
   - Verify `tests/tier2_boundaries/v08_completed_appointment_requires_completed_attendance.spec.ts` asserts appointment completion guard.
4. **Invalidation Conditions**:
   - Any attempt to allow an attendance to have more than one medical record.
   - Any attempt to allow cross-client reuse of a physical stock unit.
   - Any mock data importation or test passing via mocked database clients.
