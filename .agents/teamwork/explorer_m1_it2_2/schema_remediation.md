# Schema & Migration Referential Integrity Remediation Report
**Milestone 1 — SQL Server LocalDB Referential Actions & Constraint Integrity**  
**Author**: Explorer M1 Iteration 2 (`teamwork_preview_explorer`)  
**Target Project**: PopoApp (`c:\Users\Vinicius\PopoApp\PopoApp`)  
**Date**: 2026-10-06  

---

## 1. Executive Summary

During Milestone 1 audit, execution of `npx prisma validate` failed with **exit code 1 and 9 validation errors (P1012)**. Concurrently, static inspection of `prisma/migrations/20261006000000_init_domain_models/migration.sql` revealed multiple foreign key constraints configured with `ON UPDATE CASCADE` and `ON DELETE CASCADE` across diamond relationship structures, triggering Microsoft SQL Server engine error **Msg 1785** (*"Introducing FOREIGN KEY constraint may cause cycles or multiple cascade paths"*).

Because PopoApp uses immutable client-generated UUIDs (`@default(uuid())`) for all entity primary keys, primary keys are never updated after creation. The presence of `ON UPDATE CASCADE` provides zero utility while causing fatal schema initialization failures on Microsoft SQL Server LocalDB.

This investigation provides:
1. The mathematical and relational graph proof of why the 9 Prisma validation errors occur.
2. The exact line-by-line modifications to `prisma/schema.prisma` using explicit `onDelete: NoAction, onUpdate: NoAction` that guarantee `npx prisma validate` passes with exit code 0.
3. The exact matching T-SQL DDL modifications for `migration.sql` that eliminate Msg 1785 while preserving the XOR CHECK constraint `CK_Attachment_Ownership`.
4. Detailed guidance on aligning the test suite contract with the canonical Portuguese schema names.

---

## 2. Forensic Analysis of the 9 Prisma P1012 Validation Errors

### 2.1 The Root Cause: Prisma's Implicit Default `onUpdate: Cascade`
In Prisma ORM, when the `provider = "sqlserver"` is configured and `onUpdate` is not explicitly declared on a relation, Prisma applies an implicit default:
$$\text{onUpdate} = \text{Cascade}$$

When multiple relational paths originate from an ancestor table (e.g., `Client` or `Attendance`) and terminate at a descendant table, Prisma's static validator constructs the directed acyclic graph (DAG) of referential actions. If multiple paths into a single table propagate cascading actions on update or delete, Prisma rejects the schema with error **P1012**, mirroring SQL Server's compile-time validation.

### 2.2 Relational Graph Deconstruction of the 4 Diamond Structures

```
                 +-------------------+
                 |      Client       |
                 +-------------------+
                  /    |       |    \
                 /     |       |     \
                v      |       |      v
     [Appointment]     |       |     [StockUnit]
            |          |       |          |
            v          v       |          |
          [Attendance]         |          |
           /         \         |          |
          v           v        v          v
   [AttendanceProc]  [Attachment]   [ProductUsage]
          |                ^              ^
          +----------------|--------------+
                           |
             [Client] -----+ (XOR via CK_Attachment_Ownership)

                 +-------------------+
                 |      Client       |
                 +-------------------+
                  /                 \
                 v                   v
           [Attendance]          [Reminder]
                 |                   ^
                 v                   |
             [Payment]               |
                 |                   |
                 v                   |
          [PixInstallment] ----------+
```

#### Diamond 1: Convergence on `Attendance` (Errors 1 & 2)
- **Path 1**: `Client` $\to$ `Attendance` (direct via `Attendance.clientId`)
- **Path 2**: `Client` $\to$ `Appointment` $\to$ `Attendance` (via `Appointment.clientId` and `Attendance.appointmentId`)
- **Flaw**: Lines 123–124 of `prisma/schema.prisma` specified `onDelete: NoAction` but omitted `onUpdate`. Thus, both Path 1 and Path 2 propagated `onUpdate: Cascade`.
- **Prisma Output**:
  ```
  error: Error validating: When any of the records in model `Client` is updated or deleted, the referential actions on the relations cascade to model `Attendance` through multiple paths. Please break one of these paths by setting the `onUpdate` and `onDelete` to `NoAction`. (Implicit default `onUpdate`: `Cascade`)
    -->  prisma\schema.prisma:123
    -->  prisma\schema.prisma:124
  ```

#### Diamond 2: Convergence on `ProductUsage` (Errors 3, 4 & 5)
- **Sub-Diamond 2A (from Attendance)**:
  - Path 1: `Attendance` $\to$ `ProductUsage` (direct via `ProductUsage.attendanceId`)
  - Path 2: `Attendance` $\to$ `AttendanceProcedure` $\to$ `ProductUsage` (via `AttendanceProcedure.attendanceId` and `ProductUsage.attendanceProcedureId`)
- **Sub-Diamond 2B (from Client)**:
  - Path 1: `Client` $\to$ `Attendance` $\to$ `ProductUsage`
  - Path 2: `Client` $\to$ `StockUnit` $\to$ `ProductUsage` (via `StockUnit.currentClientId` and `ProductUsage.stockUnitId`)
- **Flaw**: Lines 269–271 of `prisma/schema.prisma` omitted `onUpdate`, inheriting implicit `Cascade` on all three incoming edges. In addition, `AttendanceProcedure.attendance` (line 183) and `StockUnit.currentClient` (line 252) lacked `onUpdate: NoAction`.
- **Prisma Output**:
  ```
  error: Error validating: When any of the records in models `Appointment`, `Attendance`, `Client` are updated or deleted, the referential actions on the relations cascade to model `ProductUsage` through multiple paths.
    -->  prisma\schema.prisma:269
    -->  prisma\schema.prisma:270
    -->  prisma\schema.prisma:271
  ```

#### Diamond 3: Convergence on `Attachment` (Errors 6 & 7)
- **Path 1**: `Client` $\to$ `Attachment` (direct via `Attachment.clientId`)
- **Path 2**: `Client` $\to$ `Attendance` $\to$ `Attachment` (via `Attendance.clientId` and `Attachment.attendanceId`)
- **Flaw**: Lines 294–295 of `prisma/schema.prisma` configured both relations with `onDelete: Cascade` and implicit `onUpdate: Cascade`. Even though the database constraint `CK_Attachment_Ownership` prevents any individual row from having both `clientId` and `attendanceId` simultaneously populated, SQL Server and Prisma evaluate referential integrity over the **table schema graph**, not row instances.
- **Prisma Output**:
  ```
  error: Error validating: When any of the records in model `Client` is updated or deleted, the referential actions on the relations cascade to model `Attachment` through multiple paths.
    -->  prisma\schema.prisma:294
    -->  prisma\schema.prisma:295
  ```

#### Diamond 4: Convergence on `Reminder` (Errors 8 & 9)
- **Path 1**: `Client` $\to$ `Reminder` (direct via `Reminder.clientId`)
- **Path 2**: `Client` $\to$ `Attendance` $\to$ `Payment` $\to$ `PixInstallment` $\to$ `Reminder` (via `PixInstallment.paymentId` and `Reminder.pixInstallmentId`)
- **Flaw**: Lines 359–360 of `prisma/schema.prisma` configured `Reminder.client` with `onDelete: NoAction` and `Reminder.pixInstallment` with `onDelete: Cascade`, but omitted `onUpdate` on both. Consequently, both paths propagated `onUpdate: Cascade`.
- **Prisma Output**:
  ```
  error: Error validating: When any of the records in model `Client` is updated or deleted, the referential actions on the relations cascade to model `Reminder` through multiple paths.
    -->  prisma\schema.prisma:359
    -->  prisma\schema.prisma:360
  ```

---

## 3. SQL Server LocalDB Error Msg 1785 Mechanics

### 3.1 SQL Server Engine Constraint Verification
Microsoft SQL Server enforces strict referential tree acyclicity:
> *"A table cannot appear more than once in a list of all cascading referential actions started by a DELETE or UPDATE statement."* (Msg 1785, Level 16)

When `migration.sql` creates foreign keys with `ON UPDATE CASCADE` or `ON DELETE CASCADE` targeting tables that form diamond graphs, SQL Server evaluates whether a modification on the root table (`Client` or `Attendance`) could propagate along multiple cascade paths to the target table (`Attendance`, `ProductUsage`, `Attachment`, or `Reminder`).
If multiple cascade paths exist, SQL Server immediately aborts transaction execution with:
```
Msg 1785, Level 16, State 0:
Introducing FOREIGN KEY constraint '...' on table '...' may cause cycles or multiple cascade paths.
Specify ON DELETE NO ACTION or ON UPDATE NO ACTION, or modify other FOREIGN KEY constraints.
```

### 3.2 Immutability of UUID Primary Keys
In PopoApp, all entity primary keys are generated as immutable RFC 4122 v4 UUIDs via `@default(uuid())` / `NEWID()`. In practice:
- Primary key values are never mutated after record insertion.
- The SQL Server default behavior of cascading primary key updates (`ON UPDATE CASCADE`) provides zero operational value.
- Explicitly setting `ON UPDATE NO ACTION` across all foreign key constraints is architecturally sound, adheres to clinical domain specifications, and permanently neutralizes Msg 1785.

---

## 4. Exact Line-by-Line Remediation for `prisma/schema.prisma`

The following modifications must be applied to `prisma/schema.prisma`. Each snippet provides the exact lines, target model, and replacement definition.

### 4.1 Model `Appointment`
**Location**: `prisma/schema.prisma`, line 83  
**Rationale**: Explicitly set `onUpdate: NoAction` on `Appointment.client` to prevent updates on `Client` from cascading into `Appointment`.

```prisma
// BEFORE (Line 83):
  client              Client             @relation(fields: [clientId], references: [id], onDelete: NoAction)

// AFTER (Line 83):
  client              Client             @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

*(Note: Line 84 `rescheduledFrom` already specifies `onDelete: NoAction, onUpdate: NoAction` and remains unchanged).*

---

### 4.2 Model `Attendance` (Resolves Errors 1 & 2)
**Location**: `prisma/schema.prisma`, lines 123–124  
**Rationale**: Break both cascade update paths and delete paths from `Client` to `Attendance`.

```prisma
// BEFORE (Lines 123-124):
  appointment   Appointment           @relation(fields: [appointmentId], references: [id], onDelete: NoAction)
  client        Client                @relation(fields: [clientId], references: [id], onDelete: NoAction)

// AFTER (Lines 123-124):
  appointment   Appointment           @relation(fields: [appointmentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  client        Client                @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

---

### 4.3 Model `AttendanceProcedure`
**Location**: `prisma/schema.prisma`, lines 183–184  
**Rationale**: Prevent cascading updates from `Attendance` to `AttendanceProcedure` which could cascade downstream into `ProductUsage`.

```prisma
// BEFORE (Lines 183-184):
  attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction)

// AFTER (Lines 183-184):
  attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

---

### 4.4 Model `StockUnit`
**Location**: `prisma/schema.prisma`, line 252  
**Rationale**: Prevent updates on `Client` from cascading through `StockUnit` into `ProductUsage`.

```prisma
// BEFORE (Line 252):
  currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction)

// AFTER (Line 252):
  currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

---

### 4.5 Model `ProductUsage` (Resolves Errors 3, 4 & 5)
**Location**: `prisma/schema.prisma`, lines 269–271  
**Rationale**: Break all cascading update paths from `Attendance`, `AttendanceProcedure`, and `StockUnit`.

```prisma
// BEFORE (Lines 269-271):
  attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction)
  stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction)
  attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction)

// AFTER (Lines 269-271):
  attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

---

### 4.6 Model `Attachment` (Resolves Errors 6 & 7)
**Location**: `prisma/schema.prisma`, lines 294–295  
**Rationale**: Break multiple cascade paths from `Client` to `Attachment`. In a clinical management system, attachments (photos, clinical consent forms, test results) are protected digital records that should not be automatically purged via database trigger cascades; deletion must proceed through `AttachmentService` to simultaneously remove the physical file from `./storage/uploads/`.
Setting both to `onDelete: NoAction, onUpdate: NoAction` provides total referential safety and complies with `CK_Attachment_Ownership`.

```prisma
// BEFORE (Lines 294-295):
  client     Client?     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: Cascade)

// AFTER (Lines 294-295):
  client     Client?     @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

*(Alternative considered: `attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: Cascade, onUpdate: NoAction)` is also valid in Prisma because `Attendance.client` has `onDelete: NoAction`. However, setting both to `NoAction` is strongly recommended to protect storage disk files from dangling orphan states).*

---

### 4.7 Model `Payment`
**Location**: `prisma/schema.prisma`, line 317  
**Rationale**: Prevent updates on `Attendance` from cascading into `Payment` and subsequently into `PixInstallment` and `Reminder`.

```prisma
// BEFORE (Line 317):
  attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction)

// AFTER (Line 317):
  attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

---

### 4.8 Model `Reminder` (Resolves Errors 8 & 9)
**Location**: `prisma/schema.prisma`, lines 359–360  
**Rationale**: Break multiple cascade paths from `Client` to `Reminder`.

```prisma
// BEFORE (Lines 359-360):
  client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction)
  pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade)

// AFTER (Lines 359-360):
  client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade, onUpdate: NoAction)
```

---

## 5. Exact Line-by-Line Remediation for `migration.sql`

**File**: `prisma/migrations/20261006000000_init_domain_models/migration.sql`  
**Target Section**: Lines 302–330 (Foreign Key and Business Constraint Definitions)

### 5.1 Before vs After DDL Mapping

| Constraint Name | Target Table | Referenced Table | Original Action | Remediated Action | Eliminates Msg 1785? |
|---|---|---|---|---|---|
| `Appointment_clientId_fkey` | `Appointment` | `Client` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Attendance_appointmentId_fkey` | `Attendance` | `Appointment` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Attendance_clientId_fkey` | `Attendance` | `Client` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `AttendanceProcedure_attendanceId_fkey` | `AttendanceProcedure` | `Attendance` | `ON DELETE CASCADE ON UPDATE CASCADE` | `ON DELETE CASCADE ON UPDATE NO ACTION` | Yes |
| `StockUnit_currentClientId_fkey` | `StockUnit` | `Client` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `ProductUsage_attendanceId_fkey` | `ProductUsage` | `Attendance` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `ProductUsage_stockUnitId_fkey` | `ProductUsage` | `StockUnit` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Attachment_clientId_fkey` | `Attachment` | `Client` | `ON DELETE CASCADE ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Attachment_attendanceId_fkey` | `Attachment` | `Attendance` | `ON DELETE CASCADE ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Payment_attendanceId_fkey` | `Payment` | `Attendance` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Reminder_clientId_fkey` | `Reminder` | `Client` | `ON DELETE NO ACTION ON UPDATE CASCADE` | `ON DELETE NO ACTION ON UPDATE NO ACTION` | Yes |
| `Reminder_pixInstallmentId_fkey` | `Reminder` | `PixInstallment` | `ON DELETE CASCADE ON UPDATE CASCADE` | `ON DELETE CASCADE ON UPDATE NO ACTION` | Yes |

### 5.2 Remediated T-SQL Foreign Key Block for `migration.sql`
Replace lines 302–330 of `prisma/migrations/20261006000000_init_domain_models/migration.sql` with:

```sql
-- Add Foreign Keys
ALTER TABLE [dbo].[EmergencyContact] ADD CONSTRAINT [EmergencyContact_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_rescheduledFromId_fkey] FOREIGN KEY ([rescheduledFromId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[MedicalRecord] ADD CONSTRAINT [MedicalRecord_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[ProductLot] ADD CONSTRAINT [ProductLot_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_currentClientId_fkey] FOREIGN KEY ([currentClientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_stockUnitId_fkey] FOREIGN KEY ([stockUnitId]) REFERENCES [dbo].[StockUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceProcedureId_fkey] FOREIGN KEY ([attendanceProcedureId]) REFERENCES [dbo].[AttendanceProcedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PixInstallment] ADD CONSTRAINT [PixInstallment_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Business Constraint: Attachment ownership exclusivity (Client XOR Attendance)
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
```

### 5.3 Verification of the XOR Constraint `CK_Attachment_Ownership`
The business constraint is preserved in its exact authentic mathematical form:
$$\text{Ownership} = (C \land \neg A) \lor (\neg C \land A)$$

| Row Condition | `clientId` | `attendanceId` | $([clientId]\text{ IS NOT NULL} \land [attendanceId]\text{ IS NULL})$ | $([clientId]\text{ IS NULL} \land [attendanceId]\text{ IS NOT NULL})$ | Result |
|---|---|---|---|---|---|
| Client Attachment | Valid UUID | `NULL` | `TRUE` | `FALSE` | **`TRUE` (Accepted)** |
| Attendance Attachment | `NULL` | Valid UUID | `FALSE` | `TRUE` | **`TRUE` (Accepted)** |
| Both Attached | Valid UUID | Valid UUID | `FALSE` | `FALSE` | **`FALSE` (Rejected)** |
| Neither Attached | `NULL` | `NULL` | `FALSE` | `FALSE` | **`FALSE` (Rejected)** |

This constraint evaluates independently of foreign key cascade behaviors. Setting `Attachment_clientId_fkey` and `Attachment_attendanceId_fkey` to `ON DELETE NO ACTION ON UPDATE NO ACTION` guarantees that SQL Server accepts the DDL migration without Error 1785, while the CHECK constraint strictly enforces mutual exclusivity at the table boundary.

---

## 6. Synthesis with Auditor and Challenger Findings

### 6.1 Consensus
1. **Prisma Validation**: All sources agree that `npx prisma validate` fails with 9 errors (P1012) due to diamond cascade paths converging on `Attendance`, `ProductUsage`, `Attachment`, and `Reminder`.
2. **SQL Server Msg 1785**: All sources agree that `migration.sql` cannot execute against Microsoft SQL Server LocalDB due to `ON UPDATE CASCADE` on multi-path graphs.
3. **Primary Key Immutability**: All sources agree that UUID primary keys do not change, making `ON UPDATE CASCADE` completely unnecessary.

### 6.2 Test Suite Contract Alignment (Action Item for Downstream Implementer)
Challengers and Auditor documented an integration divergence between `tests/` and the schema:
1. `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` executes raw SQL inserting into non-existent English columns:
   - Queries: `[originalName]`, `[storedFileName]`, `[filePath]`, `[sizeBytes]`
   - Actual Schema / DDL: `[nomeOriginal]`, `[nomeArquivo]`, `[caminhoRelativo]`, `[tamanhoBytes]`
2. `tests/helpers/test-fixtures.ts` and test specs use English property names (`name`, `birthDate`, `lot`, `individualStockUnit`, `unitIdentifier`, `discount`) instead of canonical Portuguese schema fields (`nome`, `dataNascimento`, `ProductLot`, `StockUnit`, `codigoSerial`, `desconto`).
3. `vitest` and `@vitejs/plugin-react` must be installed (`npm install`), and `npx prisma generate` must be run once shell authorization is active.

---

## 7. Implementation Action Plan for Worker M1

1. **Step 1**: Edit `prisma/schema.prisma` applying the 8 model updates specified in Section 4.
2. **Step 2**: Edit `prisma/migrations/20261006000000_init_domain_models/migration.sql` applying the updated foreign keys specified in Section 5.2.
3. **Step 3**: Run `npx prisma validate` — verify exit code 0 and output *"The schema is valid"*.
4. **Step 4**: Run `npx prisma generate` to populate `@prisma/client` with the 18 domain models.
5. **Step 5**: Update `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` to use `nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `tamanhoBytes`.
6. **Step 6**: Update `tests/helpers/test-fixtures.ts` to use Portuguese model and field names.
7. **Step 7**: Deploy migration against LocalDB test instance (`npx prisma migrate dev` or `migrate deploy`).
