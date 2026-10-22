# Handoff Report — Challenger M1 2

**Agent**: Milestone 1 Challenger 2 (`challenger_m1_2`)  
**Timestamp**: 2026-10-06T03:07:00Z  
**Recipient**: Parent Orchestrator (`4921052e-c509-477d-985b-561354b8b140`)  
**Type**: Hard Handoff (Challenge Complete)  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

1. **Tooling and Test Script Configuration**:
   - `PopoApp/package.json` lines 10–11 define:
     ```json
     "test": "vitest run",
     "test:watch": "vitest"
     ```
   - `PopoApp/package.json` lines 62–63 declare devDependencies:
     ```json
     "@vitejs/plugin-react": "^4.3.4",
     "vitest": "^2.1.8"
     ```
   - `PopoApp/package-lock.json` contains 0 occurrences of `"vitest"` and 0 occurrences of `"@vitejs/plugin-react"`.
   - Inspection of `node_modules/vitest` and `node_modules/@vitejs/plugin-react` yields: `The system cannot find the path specified`. Neither package is installed in `node_modules`.
   - `PopoApp/.eslintrc.json` lines 1–3 configure:
     ```json
     {
       "extends": "next/core-web-vitals"
     }
     ```
     `PopoApp/node_modules/eslint/package.json` line 3 shows `version: 8.57.1`, and `PopoApp/node_modules/eslint-config-next/package.json` line 3 shows `version: 15.5.26`.

2. **Prisma Client Generation State**:
   - `PopoApp/node_modules/.prisma/client/index.d.ts` lines 16–20 only expose `Model User` (2168 total lines).
   - The newly defined 17 domain models (`Client`, `EmergencyContact`, `Appointment`, `PlannedProcedure`, `Attendance`, `MedicalRecord`, `Procedure`, `AttendanceProcedure`, `Product`, `ProcedureProduct`, `ProductLot`, `StockUnit`, `ProductUsage`, `Attachment`, `Payment`, `PixInstallment`, `Reminder`) have not been compiled into `@prisma/client` because `npx prisma generate` was not run after schema updating.

3. **Entity Model Boundary: Planned vs Actual Procedures**:
   - `PopoApp/prisma/schema.prisma` lines 70–92 define `Appointment` with relation:
     `plannedProcedures PlannedProcedure[]`
   - `PopoApp/prisma/schema.prisma` lines 94–106 define:
     ```prisma
     model PlannedProcedure {
       id            String      @id @default(uuid())
       appointmentId String
       procedureId   String
       ordem         Int         @default(0)
       createdAt     DateTime    @default(now())
       appointment   Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
       procedure     Procedure   @relation(fields: [procedureId], references: [id], onDelete: NoAction)
     }
     ```
   - `PopoApp/prisma/schema.prisma` lines 111–135 define `Attendance` with relation:
     `procedures AttendanceProcedure[]`
   - `PopoApp/prisma/schema.prisma` lines 173–189 define:
     ```prisma
     model AttendanceProcedure {
       id                    String   @id @default(uuid())
       attendanceId          String
       procedureId           String
       standardValueSnapshot Decimal  @db.Decimal(10, 2)
       practicedValue        Decimal  @db.Decimal(10, 2)
       observacoes           String?
       createdAt             DateTime @default(now())
       updatedAt             DateTime @updatedAt
       attendance            Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
       procedure             Procedure  @relation(fields: [procedureId], references: [id], onDelete: NoAction)
       productUsages         ProductUsage[]
     }
     ```
   - In accordance with `POPOAPP_DEVELOPMENT_SPEC.md` §10 (line 224: *"Do NOT create a domain entity called PerformedProcedure or Procedimento Realizado"*), the technical model is named `AttendanceProcedure`.
   - Planned procedures belong strictly to `Appointment`, while executed procedures belong strictly to `Attendance`.

4. **Entity Model Boundary: Practiced Value Independence**:
   - `PopoApp/prisma/schema.prisma` lines 177–178:
     ```prisma
     standardValueSnapshot Decimal @db.Decimal(10, 2) // Snapshot imutável do valor padrão na inclusão
     practicedValue        Decimal @db.Decimal(10, 2) // Valor praticado obrigatório e independente
     ```
   - In `PopoApp/prisma/migrations/20261006000000_init_domain_models/migration.sql` lines 128–129, both columns are non-nullable `DECIMAL(10,2)` physical columns:
     ```sql
     [standardValueSnapshot] DECIMAL(10,2) NOT NULL,
     [practicedValue] DECIMAL(10,2) NOT NULL,
     ```
   - `Attendance` line 118 stores `desconto Decimal @default(0.00) @db.Decimal(10, 2)`. Neither table stores a denormalized `total` or auto-discount column, strictly adhering to binding Decision D2 (dynamic financial calculation: Total = sum(practicedValue) - discount).

5. **Entity Model Boundary: ProductUsage Linkage to StockUnit and Attendance**:
   - `PopoApp/prisma/schema.prisma` lines 260–276 define:
     ```prisma
     model ProductUsage {
       id                    String               @id @default(uuid())
       attendanceId          String
       stockUnitId           String
       attendanceProcedureId String?
       dataHora              DateTime             @default(now())
       observacoes           String?
       createdAt             DateTime             @default(now())
       attendance            Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction)
       stockUnit             StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction)
       attendanceProcedure   AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction)
     }
     ```
   - Mandatory foreign keys link directly to `Attendance` and `StockUnit`. Optional foreign key links to `AttendanceProcedure`.
   - `StockUnit` lines 242–258 link to `ProductLot` and track `currentClientId String?` to support same-client reuse rules.

6. **Test Suite Property Name Discrepancy**:
   - In `tests/tier1_features/f03_client_model.spec.ts` lines 20–29 and `tests/helpers/test-fixtures.ts` lines 18–33:
     Fixtures invoke `client.create({ name, phone, email, birthDate, address, notes, isActive })`.
     `schema.prisma` lines 27–38 declare `nome`, `cpf`, `telefone`, `email`, `dataNascimento`, `endereco`, `observacoes`, `status`.
   - In `tests/helpers/test-fixtures.ts` lines 83 & 99:
     Fixtures invoke `lot.create` and `individualStockUnit.create({ unitIdentifier, ... })`.
     `schema.prisma` lines 224 & 242 define `ProductLot` and `StockUnit` with `codigoSerial`.
   - In `tests/tier4_workflows/scenarios_a_through_e.spec.ts` lines 43 & 84:
     Fixtures invoke `attendance.create({ discount: 0.0 })`.
     `schema.prisma` line 118 defines `desconto`.
   - In `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` lines 33–37:
     Raw SQL executes `INSERT INTO [Attachment] ([originalName], [storedFileName], [filePath], ...)`.
     `schema.prisma` lines 285–287 and `migration.sql` lines 203–205 define `[nomeOriginal]`, `[nomeArquivo]`, `[caminhoRelativo]`.

---

## 2. Logic Chain

1. **Tooling and Runner Execution**:
   - From Observation 1, running `npm test` requires `vitest` in `node_modules` and its binary in `.bin`. Because `vitest` is missing from `node_modules` and `package-lock.json`, the command fails immediately with binary not found.
   - From Observation 1, `next lint` is supported by the installed ESLint 8.57.1 with `.eslintrc.json` extending `next/core-web-vitals`. However, `next lint` does not lint `tests/` by default.

2. **Database Domain Boundaries**:
   - From Observation 3, `PlannedProcedure` is coupled to `Appointment`, while `AttendanceProcedure` is coupled to `Attendance`. This guarantees that planned procedures and actually performed procedures have independent lifecycles, cardinality, and records. The naming rule forbidding `PerformedProcedure` is strictly honored.
   - From Observation 4, `standardValueSnapshot` and `practicedValue` are independently stored non-nullable decimals. `Attendance.desconto` is independent, and no computed financial columns are denormalized. This fully satisfies Decision D2, §11, and §12.
   - From Observation 5, `ProductUsage` enforces mandatory relational links to `StockUnit` and `Attendance`, with an optional link to `AttendanceProcedure`. `StockUnit` maintains `currentClientId` for patient reuse isolation. This fully satisfies §14–17.

3. **Runtime Test Suite Execution**:
   - From Observation 2, `@prisma/client` does not yet contain the 17 domain models.
   - From Observation 6, the authored test suite in `tests/` uses English model and column names (`name`, `birthDate`, `discount`, `individualStockUnit`, `unitIdentifier`, `originalName`), which conflict with the Portuguese domain names in `schema.prisma` and `migration.sql`.
   - Therefore, even after installing `vitest`, the test suite will fail at runtime against Prisma and SQL Server until test fixtures are reconciled with the schema.

---

## 3. Caveats

- Interactive shell execution of `npx prisma migrate dev` and `npm install` timed out waiting for unattended GUI confirmation in this environment.
- Live database queries could not be executed against SQL Server LocalDB due to interactive permission timeouts. However, static verification of DDL (`migration.sql`), Prisma schema DSL (`schema.prisma`), package dependencies, and test source code is exhaustive and 100% reproducible.

---

## 4. Conclusion

### Verdict: **`REQUEST_CHANGES`**

While the **Prisma Schema and Database DDL** are thoroughly compliant with `POPOAPP_DEVELOPMENT_SPEC.md` (all 3 boundary checks pass with excellence):
- ✅ Attendance correctly separates planned procedures from actual procedures.
- ✅ AttendanceProcedure stores `practicedValue` independently from `standardValueSnapshot`.
- ✅ ProductUsage links to StockUnit, Attendance, and optionally AttendanceProcedure.

The **Tooling and Automated Test Suite** require immediate changes before Milestone 1 can be considered verified:
1. **Missing Test Runner Packages**: `vitest` and `@vitejs/plugin-react` must be installed into `node_modules` and locked into `package-lock.json` (`npm install`).
2. **Missing Prisma Client Generation**: `npx prisma generate` must be run to generate the 17 new models into `@prisma/client`.
3. **Test Fixture Schema Mismatch**: Test fixtures in `tests/helpers/test-fixtures.ts` and test specs in `tests/tier1_features/`, `tests/tier2_boundaries/`, `tests/tier3_combinations/`, and `tests/tier4_workflows/` must be updated to use the canonical Portuguese field names from `schema.prisma` (`nome`, `telefone`, `dataNascimento`, `desconto`, `ProductLot`, `StockUnit`, `codigoSerial`, `nomeOriginal`, `caminhoRelativo`).

---

## 5. Verification Method

1. **Verify missing `vitest` in node_modules**:
   Inspect `PopoApp/node_modules/vitest/package.json` — file does not exist.
2. **Verify missing models in Prisma client**:
   Inspect `PopoApp/node_modules/.prisma/client/index.d.ts` — only `Model User` is present.
3. **Verify entity model boundary compliance**:
   - View `PopoApp/prisma/schema.prisma` lines 87 & 94–106 (`PlannedProcedure`).
   - View `PopoApp/prisma/schema.prisma` lines 125 & 173–189 (`AttendanceProcedure`).
   - View `PopoApp/prisma/schema.prisma` lines 260–276 (`ProductUsage`).
4. **Verify test suite schema field mismatch**:
   - Compare `tests/helpers/test-fixtures.ts` lines 18–33 (`name`, `phone`, `birthDate`) against `schema.prisma` lines 27–38 (`nome`, `telefone`, `dataNascimento`).
   - Compare `tests/tier4_workflows/scenarios_a_through_e.spec.ts` line 43 (`discount: 0.0`) against `schema.prisma` line 118 (`desconto`).
