# Milestone 1 Remediation Plan: Database Schema & Test Suite Synchronization

**Author**: Explorer M1 Iteration 2 (`explorer_m1_it2_1`)  
**Target Recipient**: Worker M1 (`worker_m1_1`) & Parent Orchestrator (`orchestrator_1`)  
**Date**: 2026-10-06  
**Status**: READY FOR WORKER EXECUTION  

---

## 1. Executive Summary & Problem Diagnosis

Milestone 1 execution failed forensic audit due to three interconnected defects:
1. **Prisma P1012 Schema Validation Failure (9 Errors)**: Prisma with `provider = "sqlserver"` defaults implicit referential actions to `onUpdate: Cascade`. When multiple relation paths connect models (specifically converging on `Attendance`, `ProductUsage`, `Attachment`, and `Reminder`), Prisma rejects the schema because Microsoft SQL Server prohibits multiple cascade update paths.
2. **SQL Server Engine Error Msg 1785 in `migration.sql`**: In `prisma/migrations/20261006000000_init_domain_models/migration.sql`, foreign keys are configured with `ON UPDATE CASCADE` and duplicate `ON DELETE CASCADE`. In Microsoft SQL Server LocalDB, cyclic or multi-path cascade triggers `Msg 1785, Level 16: Introducing FOREIGN KEY constraint may cause cycles or multiple cascade paths`. Because all primary keys are immutable UUIDs (`@default(uuid())`), cascade updates are unnecessary and harmful.
3. **Severe Contract Divergence in Test Suite**: Test files in `tests/` were authored referencing an English conceptual model (`name`, `phone`, `birthDate`, `discount`, `individualStockUnit`, `unitIdentifier`, `originalName`, `storedFileName`, `filePath`, `sizeBytes`), whereas `schema.prisma` and `migration.sql` define canonical Brazilian Portuguese columns (`nome`, `telefone`, `dataNascimento`, `desconto`, `StockUnit`, `codigoSerial`, `nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `tamanhoBytes`).
4. **Missing Tooling Installation & Prisma Generation**: `vitest` and `@vitejs/plugin-react` are listed in `package.json` devDependencies but are missing from `node_modules`. Prisma Client (`@prisma/client`) currently only contains the legacy `User` model because `npx prisma generate` was blocked by schema validation failures.

---

## 2. Fix 1: Resolving all 9 P1012 Referential Cascade Errors in `prisma/schema.prisma`

### Root Cause Analysis of the 9 Validation Errors
Prisma flags 9 specific relations across 4 child models:
- **`Attendance` (Errors 1 & 2, lines 123–124)**: Reached from `Client` directly and via `Client -> Appointment -> Attendance`. Both omitted `onUpdate`, defaulting to `Cascade`.
- **`ProductUsage` (Errors 3, 4, 5, lines 269–271)**: Reached from `Client` via `StockUnit` and via `Attendance`, and from `Attendance` directly and via `AttendanceProcedure`. All omitted `onUpdate`.
- **`Attachment` (Errors 6 & 7, lines 294–295)**: Reached from `Client` directly (`onDelete: Cascade`) and via `Attendance` (`onDelete: Cascade`).
- **`Reminder` (Errors 8 & 9, lines 359–360)**: Reached from `Client` directly and via `Client -> Attendance -> Payment -> PixInstallment -> Reminder`. Both omitted `onUpdate`.

### Exact Remediation for `prisma/schema.prisma`

Set explicit `onUpdate: NoAction` and `onDelete: NoAction` across all multi-path and diamond relations:

#### A. Model `Appointment` (Line 83)
```prisma
// BEFORE (Line 83):
client              Client             @relation(fields: [clientId], references: [id], onDelete: NoAction)

// AFTER:
client              Client             @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### B. Model `Attendance` (Lines 123–124) [Errors 1 & 2]
```prisma
// BEFORE (Lines 123-124):
appointment   Appointment           @relation(fields: [appointmentId], references: [id], onDelete: NoAction)
client        Client                @relation(fields: [clientId], references: [id], onDelete: NoAction)

// AFTER:
appointment   Appointment           @relation(fields: [appointmentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
client        Client                @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### C. Model `AttendanceProcedure` (Lines 183–184)
```prisma
// BEFORE (Lines 183-184):
attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction)

// AFTER:
attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade, onUpdate: NoAction)
procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### D. Model `StockUnit` (Line 252)
```prisma
// BEFORE (Line 252):
currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction)

// AFTER:
currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### E. Model `ProductUsage` (Lines 269–271) [Errors 3, 4, 5]
```prisma
// BEFORE (Lines 269-271):
attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction)
stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction)
attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction)

// AFTER:
attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction, onUpdate: NoAction)
attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### F. Model `Attachment` (Lines 294–295) [Errors 6 & 7]
```prisma
// BEFORE (Lines 294-295):
client     Client?     @relation(fields: [clientId], references: [id], onDelete: Cascade)
attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: Cascade)

// AFTER:
client     Client?     @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: Cascade, onUpdate: NoAction)
```

#### G. Model `Payment` (Line 317)
```prisma
// BEFORE (Line 317):
attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction)

// AFTER:
attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

#### H. Model `Reminder` (Lines 359–360) [Errors 8 & 9]
```prisma
// BEFORE (Lines 359-360):
client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction)
pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade)

// AFTER:
client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade, onUpdate: NoAction)
```

---

## 3. Fix 2: Synchronizing `migration.sql` for SQL Server LocalDB Msg 1785 Safety

In `prisma/migrations/20261006000000_init_domain_models/migration.sql`, replace lines 302–330 with the following constraint definitions.  
All foreign keys use `ON UPDATE NO ACTION`. Cascade delete paths are strictly confined to single-parent child relations. The XOR constraint `CK_Attachment_Ownership` is preserved intact.

```sql
-- Add Foreign Keys
ALTER TABLE [dbo].[EmergencyContact] ADD CONSTRAINT [EmergencyContact_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_rescheduledFromId_fkey] FOREIGN KEY ([rescheduledFromId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[MedicalRecord] ADD CONSTRAINT [MedicalRecord_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductLot] ADD CONSTRAINT [ProductLot_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_currentClientId_fkey] FOREIGN KEY ([currentClientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_stockUnitId_fkey] FOREIGN KEY ([stockUnitId]) REFERENCES [dbo].[StockUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceProcedureId_fkey] FOREIGN KEY ([attendanceProcedureId]) REFERENCES [dbo].[AttendanceProcedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PixInstallment] ADD CONSTRAINT [PixInstallment_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Business Constraint: Attachment ownership exclusivity (Client XOR Attendance)
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
```

---

## 4. Fix 3: Aligning `tests/` with Canonical Portuguese Schema

### Complete Mapping Table

| Model | English in Tests | Canonical Portuguese in `schema.prisma` | Type / Value Notes |
|---|---|---|---|
| **Client** | `name` | `nome` | `String` |
| | `phone` | `telefone` | `String` |
| | `birthDate` | `dataNascimento` | `DateTime?` |
| | `address` | `endereco` | `String?` |
| | `notes` | `observacoes` | `String?` |
| | `isActive` (`true`/`false`) | `status` | `'ativo'` / `'inativo'` |
| **EmergencyContact** | `name` | `nome` | `String` |
| | `phone` | `telefone` | `String` |
| | `relationship` | `parentesco` | `String` |
| | `notes` | `observacoes` | `String?` |
| **Appointment** | `scheduledDate` | `dataHora` | `DateTime` |
| | `estimatedValue` | `valorEstimado` | `Decimal?` |
| | `notes` | `observacoes` | `String?` |
| | `cancellationReason` | `motivoCancelamento` | `String?` |
| | `rescheduledFromAppointmentId` | `rescheduledFromId` | `String?` |
| | `rescheduledToAppointmentId` | `rescheduledToId` | `String?` |
| **Attendance** | `discount` | `desconto` | `Decimal` |
| | `notes` | `observacoes` | `String?` |
| **Procedure** | `name` | `nome` | `String` |
| | `description` | `descricao` | `String?` |
| | `standardValue` | `valorPadrao` | `Decimal` |
| | `estimatedDurationMinutes` | `duracaoMinutos` | `Int` |
| | `category` | `categoria` | `String?` |
| **Product** | `name` | `nome` | `String` |
| | `brand` | `marca` | `String?` |
| | `unitOfMeasure` | `unidade` | `String` |
| | `minimumStockAlert` | *(Omit)* | Not on model |
| **ProductLot** | `lot` (Prisma delegate) | `productLot` | Model name is `ProductLot` |
| | `lotNumber` | `numeroLote` | `String` |
| | `expirationDate` | `dataValidade` | `DateTime?` |
| | `quantityReceived` | *(Omit)* | Not on model |
| **StockUnit** | `individualStockUnit` (Prisma delegate) | `stockUnit` | Model name is `StockUnit` |
| | `unitIdentifier` | `codigoSerial` | `String @unique` |
| | `status: 'DISPONIVEL'` | `status: 'Disponivel'` | TitleCase |
| **ProductUsage** | `individualStockUnitId` | `stockUnitId` | `String` |
| | `notes` | `observacoes` | `String?` |
| | `quantityUsed` | *(Omit)* | Unit tracked by row existence |
| **Attachment** | `originalName` | `nomeOriginal` | `String` |
| | `storedFileName` | `nomeArquivo` | `String` |
| | `filePath` | `caminhoRelativo` | `String` |
| | `sizeBytes` | `tamanhoBytes` | `Int` |
| | `category` | `categoria` | `String?` |

### File-by-File Changes Required

#### 1. `tests/helpers/test-fixtures.ts`
Replace `test-fixtures.ts` with:
```typescript
import prismaTest from './db-client';
import { generateValidCpf } from './cpf-validator';

let fixtureCounter = 1;

export function getNextCounter(): number {
  return fixtureCounter++;
}

export async function createTestClient(overrides: Record<string, any> = {}) {
  const count = getNextCounter();
  const cpf = overrides.cpf ?? generateValidCpf(count);

  return (prismaTest as any).client.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Cliente Teste ${count}`,
      cpf,
      telefone: overrides.telefone ?? overrides.phone ?? `1198888${String(count).padStart(4, '0')}`,
      email: overrides.email ?? `cliente${count}@test.com`,
      dataNascimento: overrides.dataNascimento ?? overrides.birthDate ?? new Date('1990-01-01'),
      endereco: overrides.endereco ?? overrides.address ?? 'Rua das Flores, 123, São Paulo - SP',
      observacoes: overrides.observacoes ?? overrides.notes ?? 'Sem observações especiais',
      status: overrides.status ?? (overrides.isActive === false ? 'inativo' : 'ativo'),
      ...(overrides.emergencyContacts
        ? {
            emergencyContacts: {
              create: overrides.emergencyContacts.map((c: any) => ({
                nome: c.nome ?? c.name,
                telefone: c.telefone ?? c.phone,
                parentesco: c.parentesco ?? c.relationship,
                observacoes: c.observacoes ?? c.notes,
                isActive: c.isActive ?? true,
              })),
            },
          }
        : {}),
    },
    include: {
      emergencyContacts: true,
    },
  });
}

export async function createTestProcedure(overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).procedure.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Procedimento ${count}`,
      descricao: overrides.descricao ?? overrides.description ?? 'Descrição do procedimento para testes',
      valorPadrao: overrides.valorPadrao ?? overrides.standardValue ?? 500.0,
      duracaoMinutos: overrides.duracaoMinutos ?? overrides.estimatedDurationMinutes ?? 60,
      categoria: overrides.categoria ?? overrides.category ?? 'Facial',
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createTestProduct(overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).product.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Produto Teste ${count}`,
      marca: overrides.marca ?? overrides.brand ?? 'Marca Teste',
      categoria: overrides.categoria ?? overrides.category ?? 'Estética',
      descricao: overrides.descricao ?? overrides.description ?? 'Descrição do produto teste',
      unidade: overrides.unidade ?? overrides.unitOfMeasure ?? 'frasco',
      isReusable: overrides.isReusable ?? false,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createTestLot(productId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).productLot.create({
    data: {
      productId,
      numeroLote: overrides.numeroLote ?? overrides.lotNumber ?? `LOTE-${count}`,
      dataValidade: overrides.dataValidade ?? overrides.expirationDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      dataAquisicao: overrides.dataAquisicao ?? new Date(),
      precoCusto: overrides.precoCusto ?? 150.0,
      observacoes: overrides.observacoes ?? overrides.notes ?? 'Lote de teste',
    },
  });
}

export async function createTestStockUnit(lotId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).stockUnit.create({
    data: {
      lotId,
      codigoSerial: overrides.codigoSerial ?? overrides.unitIdentifier ?? `UNIT-${count}`,
      status: overrides.status ?? 'Disponivel',
      currentClientId: overrides.currentClientId ?? null,
    },
  });
}

export async function createTestAppointment(clientId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();
  const dataHora = overrides.dataHora ?? overrides.scheduledDate ?? new Date(Date.now() + 86400000);

  return (prismaTest as any).appointment.create({
    data: {
      clientId,
      dataHora,
      status: overrides.status ?? 'Agendado',
      valorEstimado: overrides.valorEstimado ?? overrides.estimatedValue ?? 500.0,
      observacoes: overrides.observacoes ?? overrides.notes ?? 'Agendamento de teste',
      attendances: {
        create: {
          clientId,
          status: 'Pendente',
          observacoes: 'Atendimento inicial gerado automaticamente',
        },
      },
    },
    include: {
      attendances: true,
    },
  });
}
```

#### 2. `tests/tier1_features/f03_client_model.spec.ts`
- Replace client create fields (`name`, `phone`, `birthDate`, `address`, `notes`, `isActive`) with (`nome`, `telefone`, `dataNascimento`, `endereco`, `observacoes`, `status: 'ativo'`).
- In emergency contact tests: update assertion to `c.parentesco`, `retrieved.emergencyContacts[0].nome`.
- In soft-deactivation test: update `status: 'inativo'` assertion on `client.status`.

#### 3. `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`
- In raw SQL INSERT queries: update column list to:
  `[id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo], [categoria], [createdAt], [updatedAt], [clientId], [attendanceId]`
  with corresponding values.

#### 4. `tests/tier3_combinations/appointment_attendance_d1.spec.ts`
- Update `scheduledDate` -> `dataHora`.
- Update `estimatedValue` -> `valorEstimado`.
- Update `notes` -> `observacoes`.
- Update `cancellationReason` -> `motivoCancelamento`.
- Update `rescheduledFromAppointmentId` -> `rescheduledFromId`.
- Update `rescheduledToAppointmentId` -> `rescheduledToId`.

#### 5. `tests/tier4_workflows/scenarios_a_through_e.spec.ts`
- Update `createTestProcedure` calls: `nome`, `valorPadrao`.
- Update `attendance.create`: `desconto: 0.0` and `desconto: 100.0`.
- Update `createTestLot`: `numeroLote`.
- Update `createTestStockUnit`: `codigoSerial`.
- Update `productUsage.create`: `stockUnitId: unit.id`, `observacoes`, remove `quantityUsed`.
- Update `individualStockUnit` calls -> `stockUnit`.
- Update `rescheduledFromAppointmentId` -> `rescheduledFromId`, `rescheduledToAppointmentId` -> `rescheduledToId`.
- Update `attachment.create`: `nomeOriginal`, `nomeArquivo`, `mimeType`, `tamanhoBytes`, `caminhoRelativo`, `categoria`.

#### 6. `tests/helpers/db-cleaner.ts`
- Add `'ProcedureProduct'` to `tablesInOrder` before `'Procedure'` and `'Product'` to prevent foreign key truncation errors.

---

## 5. Fix 4: Tooling & Verification Command Sequence

The Worker must execute the following sequential commands in `c:\Users\Vinicius\PopoApp\PopoApp`:

### Step 1: Install Missing Test Packages
```powershell
npm install
```
*Expected Result*: `vitest` and `@vitejs/plugin-react` are installed into `node_modules`, `package-lock.json` updated with 0 errors.

### Step 2: Validate Prisma Schema
```powershell
npx prisma validate
```
*Expected Result*: Exit code 0, outputting: `The schema at prisma/schema.prisma is valid`. (Zero P1012 errors).

### Step 3: Generate Prisma Client
```powershell
npx prisma generate
```
*Expected Result*: Exit code 0, generating all 18 models (`Client`, `EmergencyContact`, `Appointment`, `PlannedProcedure`, `Attendance`, `MedicalRecord`, `Procedure`, `AttendanceProcedure`, `Product`, `ProcedureProduct`, `ProductLot`, `StockUnit`, `ProductUsage`, `Attachment`, `Payment`, `PixInstallment`, `Reminder`, `User`) into `node_modules/@prisma/client`.

### Step 4: Verify SQL Server Migration Integrity
```powershell
npx prisma migrate dev
```
*(or if database exists: `npx prisma db push` or `npx prisma migrate deploy`)*  
*Expected Result*: Migration applies without SQL Server Msg 1785 errors.

### Step 5: Execute Complete Test Suite
```powershell
npm test
```
*Expected Result*: All tests in `tests/` execute with 0 failures, verifying all tiers (Tiers 1–4), D1, D4, AC 61 (Attachment XOR), and AC 62 (CPF uniqueness).
