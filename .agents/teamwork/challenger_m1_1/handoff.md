# Handoff Report: Challenger M1 1

**Agent**: Challenger M1 1 (`teamwork_preview_challenger`)  
**Timestamp**: 2026-10-06T03:05:00Z  
**Recipient**: Parent Orchestrator (`4921052e-c509-477d-985b-561354b8b140`)  
**Verdict**: **`REQUEST_CHANGES`**  
**Type**: Hard Handoff (Task Complete)

---

## 1. Observation

1. **Attachment XOR Ownership Constraint (`CK_Attachment_Ownership`)**:
   - `prisma/migrations/20261006000000_init_domain_models/migration.sql` (lines 328–330):
     ```sql
     -- Business Constraint: Attachment ownership exclusivity (Client XOR Attendance)
     ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
     CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
     ```
   - In `migration.sql` (lines 199–212), table `[dbo].[Attachment]` is defined with Portuguese columns:
     `[nomeOriginal]`, `[nomeArquivo]`, `[caminhoRelativo]`, `[mimeType]`, `[tamanhoBytes]`, `[categoria]`.
   - In `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` (lines 33–40, 56–63, 78–84, 100–106), the empirical test executes raw SQL referencing nonexistent English columns:
     ```sql
     INSERT INTO [Attachment] (
       [id], [originalName], [storedFileName], [mimeType], [sizeBytes], [filePath],
       [createdAt], [updatedAt], [clientId], [attendanceId]
     ) VALUES (...)
     ```
   - Columns `[originalName]`, `[storedFileName]`, `[filePath]`, `[sizeBytes]` do not exist in the database table schema.

2. **Client CPF Unique Constraint**:
   - In `prisma/schema.prisma` (line 29): `cpf String @unique`.
   - In `migration.sql` (lines 25, 36):
     ```sql
     [cpf] NVARCHAR(1000) NOT NULL,
     ...
     CONSTRAINT [Client_cpf_key] UNIQUE NONCLUSTERED ([cpf])
     ```
   - In `tests/tier1_features/f03_client_model.spec.ts` (lines 20–29, 71–80), tests instantiate client records using English properties (`name`, `phone`, `birthDate`, `notes`, `isActive`) rather than the Prisma schema properties (`nome`, `telefone`, `dataNascimento`, `observacoes`, `status`).

3. **Relation Cascades and SQL Server Error 1785**:
   - In `migration.sql` (lines 304, 308, 309, 317, 318, 319, 321, 322, 323, 324, 325, 326), foreign keys are defined with `ON UPDATE CASCADE`:
     - Line 304: `ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;`
     - Line 308: `ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;`
     - Line 309: `ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;`
     - Line 321: `ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE CASCADE ON UPDATE CASCADE;`
     - Line 322: `ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE CASCADE;`
     - Line 325: `ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;`
     - Line 326: `ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;`
   - In SQL Server, `ON UPDATE CASCADE` across multi-path (diamond) graphs triggers:
     `Msg 1785, Level 16: Introducing FOREIGN KEY constraint '...' on table '...' may cause cycles or multiple cascade paths. Specify ON DELETE NO ACTION or ON UPDATE NO ACTION`.
   - The diamond paths triggering Error 1785 on update are:
     - `Client -> Attendance` directly vs `Client -> Appointment -> Attendance` (both reaching `Attendance` via `ON UPDATE CASCADE`).
     - `Client -> Attachment` directly vs `Client -> Attendance -> Attachment` (both reaching `Attachment` via `ON UPDATE CASCADE`).
     - `Client -> Reminder` directly vs `Client -> Attendance -> Payment -> PixInstallment -> Reminder` (both reaching `Reminder` via `ON UPDATE CASCADE`).
     - `Client -> StockUnit -> ProductUsage` vs `Client -> Attendance -> ProductUsage` (both reaching `ProductUsage` via `ON UPDATE CASCADE`).

4. **TypeScript Types & Generated Prisma Client**:
   - `node_modules/@prisma/client` and `node_modules/.prisma/client/index.d.ts` contain only the initial `User` model (generated before milestone execution).
   - `npx prisma generate` has not been applied to `node_modules`.
   - Test suites in `tests/` bypass TypeScript compilation errors via forced type casting (`prismaTest as any`).

5. **Entity & Property Discrepancy Between Schema and Test Fixtures**:
   - `tests/helpers/test-fixtures.ts`:
     - Line 83: `(prismaTest as any).lot.create` (Schema model is `ProductLot`, not `lot`).
     - Line 99: `(prismaTest as any).individualStockUnit.create` (Schema model is `StockUnit`, not `individualStockUnit`).
     - Line 119: `scheduledDate` (Schema field is `dataHora`).
     - Line 121: `estimatedValue` (Schema field is `valorEstimado`).
     - Line 122: `notes` (Schema field is `observacoes`).
   - `tests/tier4_workflows/scenarios_a_through_e.spec.ts`:
     - Lines 213, 221: `rescheduledFromAppointmentId`, `rescheduledToAppointmentId` (Schema fields are `rescheduledFromId`, `rescheduledToId`).

---

## 2. Logic Chain

1. **XOR Constraint Validation**:
   - From Observation 1, the boolean logic in `migration.sql` (`([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL)`) mathematically enforces mutual exclusivity:
     - (ClientID=Set, AttendanceID=NULL) => TRUE.
     - (ClientID=NULL, AttendanceID=Set) => TRUE.
     - (ClientID=Set, AttendanceID=Set) => FALSE.
     - (ClientID=NULL, AttendanceID=NULL) => FALSE.
   - However, the validation test `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` was written with English column names (`originalName`, `storedFileName`, `filePath`, `sizeBytes`). When executed against SQL Server, SQL Server fails at statement parsing with `Invalid column name 'originalName'`, preventing the check constraint from ever being evaluated.

2. **Client CPF Constraint**:
   - From Observation 2, `[cpf] NVARCHAR(1000) NOT NULL` and `CONSTRAINT [Client_cpf_key] UNIQUE NONCLUSTERED ([cpf])` guarantee that duplicate CPFs will be rejected at the storage layer (SQL Server Error 2627).
   - However, tests for CPF uniqueness and persistence fail because they target non-existent English properties (`name`, `phone`, `birthDate`).

3. **Cascade Cycles and Error 1785**:
   - From Observation 3, SQL Server evaluates referential integrity paths not only for `ON DELETE CASCADE` but equally for `ON UPDATE CASCADE`.
   - Because `schema.prisma` omitted `onUpdate: NoAction` for relations, Prisma's default behavior generated `ON UPDATE CASCADE` across multiple concurrent paths originating from `Client`.
   - On SQL Server, when table $B$ and table $C$ both reference table $A$ with `ON UPDATE CASCADE`, and table $D$ references both $B$ and $C$ with `ON UPDATE CASCADE`, SQL Server rejects the creation of the foreign keys with Error 1785.
   - Because PopoApp uses immutable UUIDs (`@default(uuid())`) for all entity primary keys, primary keys are never updated. Retaining `ON UPDATE CASCADE` provides zero utility while causing fatal schema initialization failures on SQL Server LocalDB.

4. **Integration Desynchronization**:
   - From Observations 4 and 5, `worker_m1_1` implemented the Portuguese schema from `arch_and_test_spec.md`, while `e2e_test_writer_1` implemented tests against an English conceptual model.
   - Running the test suite against the generated database schema will fail across all database-backed tests due to column and model mismatches.

---

## 3. Caveats

- Shell execution (`run_command`) in subagent mode timed out awaiting user GUI interaction, mirroring the worker agent's experience. Findings are established through rigorous static graph traversal of foreign keys, boolean truth-table verification, and cross-file AST/spec differential analysis.
- The unit tests without database dependencies (`tests/tier1_features/f01_tooling.spec.ts`, `tests/tier2_boundaries/cpf_validation.spec.ts`, and `tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts`) are structurally valid and independent of the schema naming desynchronization.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

Milestone 1 deliverables cannot be approved due to four blocking defects:
1. **SQL Server Error 1785 Vulnerability**: `migration.sql` will fail on SQL Server LocalDB due to multiple cascade update paths (`ON UPDATE CASCADE`) on diamond relations (`Client -> Appointment -> Attendance`, `Client -> Attendance -> Attachment`, `Client -> StockUnit -> ProductUsage`, `Client -> Reminder`).
2. **Broken XOR Verification Test**: `v14_attachment_xor_constraint.spec.ts` contains raw SQL querying nonexistent English columns (`originalName`, `storedFileName`, `filePath`, `sizeBytes`), failing before the XOR constraint can be exercised.
3. **Severe Naming Desynchronization**: Test suites (`tests/helpers/test-fixtures.ts`, `f03_client_model.spec.ts`, `appointment_attendance_d1.spec.ts`, `scenarios_a_through_e.spec.ts`) use English property names and incorrect model names (`lot`, `individualStockUnit`) that contradict `prisma/schema.prisma`.
4. **Missing Prisma Client Generation**: `@prisma/client` has not been generated for the 18 domain entities, leaving TypeScript compilation reliant on `any` workarounds.

### Required Remediations:
1. In `prisma/schema.prisma` and `migration.sql`, add `onUpdate: NoAction` across relations (specifically `Appointment.client`, `Attendance.client`, `Attendance.appointment`, `Attachment.client`, `Attachment.attendance`, `StockUnit.currentClient`, `ProductUsage.attendance`, `ProductUsage.stockUnit`, `Reminder.client`, `Reminder.pixInstallment`) to eliminate SQL Server Error 1785.
2. In `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`, align the raw SQL insert/select statements to the actual database column names (`nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `mimeType`, `tamanhoBytes`).
3. Align test fixtures and test assertions in `tests/` to use the canonical schema names (`nome`, `telefone`, `dataNascimento`, `observacoes`, `ProductLot`, `StockUnit`, `dataHora`, `valorEstimado`, `desconto`).
4. Execute `npx prisma generate` once terminal authorization is granted.

---

## 5. Verification Method

1. **Verify Cascade Update Diamonds**:
   Inspect `prisma/migrations/20261006000000_init_domain_models/migration.sql` lines 304, 308, 309, 321, 322, 325, 326. Confirm that multiple incoming `ON UPDATE CASCADE` edges converge on `Attendance`, `Attachment`, and `Reminder`.
2. **Verify XOR Test Raw SQL Column Mismatch**:
   Inspect `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` lines 34–35 and compare with `migration.sql` lines 201–207. Confirm that `[originalName]` and `[storedFileName]` do not exist in `[dbo].[Attachment]`.
3. **Verify Fixture Model Mismatch**:
   Inspect `tests/helpers/test-fixtures.ts` lines 83 and 99. Compare `lot` and `individualStockUnit` with `prisma/schema.prisma` models `ProductLot` and `StockUnit`.
4. **Execute Migration on LocalDB (once shell permitted)**:
   ```powershell
   npx prisma migrate dev
   ```
   Observe SQL Server Error 1785 failure on cascade paths if `ON UPDATE CASCADE` is retained.
