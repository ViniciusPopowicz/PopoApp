# Handoff Report: Architecture & Test Specification Mining

**Agent**: Architecture & Test Miner 1 (`spec_miner_arch_1`)  
**Timestamp**: 2026-10-06T02:37:00Z  
**Type**: Hard Handoff (Task Complete)  
**Deliverable**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md`  

---

## 1. Observation
1. **Repository & Stack State**:
   - `c:\Users\Vinicius\PopoApp\PopoApp\package.json`: Lines 18–46 confirm Next.js 15.0.0, React 19.0.0, Prisma 6.0.0, iron-session 8.0.3, bcrypt 5.1.1, Tailwind CSS 3.4.19, date-fns 4.1.0, Zod 3.23.8. There are zero test dependencies or test runner scripts in `package.json` (`scripts` only contains `dev`, `build`, `start`, `lint`, `db:migrate`, `db:seed`, `db:studio`, `db:generate`).
   - `c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma`: Lines 1–19 show only the single `User` model with `provider = "sqlserver"`. No domain models exist.
   - `c:\Users\Vinicius\PopoApp\PopoApp\src\services\auth.service.ts`: Lines 1–12 indicate auth credentials are hardcoded (`if (nickname === 'admin' && password === 'PopoApp2024!')`) with comment: `// TODO: Replace with Prisma queries when DB is available`.
   - `c:\Users\Vinicius\PopoApp\PopoApp\src\app\(authenticated)`: All route pages (`agenda/page.tsx`, `atendimentos/page.tsx`, `clientes/page.tsx`, `financeiro/page.tsx`, `lembretes/page.tsx`, `procedimentos/page.tsx`, `produtos/page.tsx`, `page.tsx`) import static mock data from `src/data/mock/*`.
2. **Authoritative Specification & Binding Requirements**:
   - `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md`:
     - D1 (Lines 18): Attendance has distinct lifecycle (`Pendente` / `Realizado` / `Cancelado`), auto-created as `Pendente` when Appointment is created; cancel/no-show/reschedule moves pending Attendance to `Cancelado`.
     - D2 (Line 19): Total = sum(practiced values) - explicit discount; Outstanding = Total - sum(paid payments); both computed, not stored.
     - D3 (Line 20): Appointment planned procedures distinct from actual attendance procedures; no planned products.
     - D4 (Line 21): Client CPF is mandatory, unique, normalized, validated.
     - D5 (Line 22): Reminders in-app only; no external delivery; marking reminder done does not alter payment status.
     - D6 (Line 23): Uploaded files live outside public folder, served only through authenticated routes.
     - D7 (Line 24): SQL Server LocalDB with separate test database (`PopoAppTest`).
     - AC 61 (Line 61): "The database rejects an attachment row owning both a Client and an Attendance (or neither). This is verified by a test that bypasses the service layer."
     - AC 62 (Lines 62–63): "creating a Client without a CPF, with an invalid CPF, or with a CPF already used by another Client is rejected server-side, and the duplicate is also rejected by a database unique constraint (tested)."
   - `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md`:
     - §6 / §32 V14: Attachment ownership exclusivity (Client XOR Attendance).
     - §10 / §11: Attendance-Procedure technical association captures `standardValueSnapshot` and independent mandatory `practicedValue`.
     - §14 / §15 / §16 / §32 V15–V18: Product inventory hierarchy (`Product -> Lot -> IndividualStockUnit`), same-client reuse allowed for reusable units, cross-client reuse strictly prohibited, single-use units non-reusable.
     - §19 / §32 V19: MedicalRecord (`Prontuário`) exactly 1:1 with Attendance.
     - §22 / §24 / §32 V21: Credit card installments store count; generate ZERO reminders.
     - §47: Integrity Examples A–E with exact values.

---

## 2. Logic Chain
1. **SQL Server LocalDB Prisma Constraints**:
   - *Premise*: Prisma's `sqlserver` connector does not support native `enum` blocks (`enum AppointmentStatus { ... }`).
   - *Inference*: Trying to define Prisma enums will cause `prisma generate` and `prisma migrate` to fail. All status fields must be defined as `String` in Prisma schema, with validation strictly enforced at the application/service layer via TypeScript string literal unions and Zod schemas.
   - *Cascade Paths*: SQL Server rejects multiple cascade delete paths to the same table (error 1785). Models with multiple incoming relations (`Attendance`, `Attachment`, `ProductUsage`) must use `onDelete: NoAction` or `onDelete: Restrict` where appropriate.
   - *Exclusive Attachment Ownership*: Prisma DSL cannot specify table-level `CHECK` constraints directly. Therefore, a custom SQL migration script must apply:
     `ALTER TABLE [Attachment] ADD CONSTRAINT [CK_Attachment_Ownership] CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));`
     This directly satisfies Acceptance Criterion 61.
2. **File Storage Architecture**:
   - *Premise*: Files must live outside `public/` and only be accessible via authenticated routes (D6, AC 60).
   - *Inference*: Files must be written to an isolated directory (e.g. `./storage/uploads/`) using UUID filenames. The database stores metadata (`originalName`, `fileName`, `mimeType`, `sizeBytes`, `relativePath`). Route `/api/attachments/[id]` checks `iron-session` session (`session.isLoggedIn === true`), verifies ownership/existence, and streams the file with `X-Content-Type-Options: nosniff` and `Cache-Control: private`. Unauthenticated requests receive 401.
3. **Financial Model & UX Transparency**:
   - *Premise*: Practiced procedure value differences are not discounts (Dev Spec §11, §12; Examples A & B).
   - *Inference*: The data model and UI must keep `standardValueSnapshot`, `practicedValue`, and explicit `desconto` separate. Total and Outstanding are calculated at runtime (`Total = sum(practicedValue) - desconto`, `Outstanding = Total - sum(paid)`). The UI must never label a difference between standard and practiced values as a discount.
4. **Test Infrastructure & Isolation**:
   - *Premise*: Tests must run against a separate database `PopoAppTest` on SQL Server LocalDB, with a single command `npm test`, covering Tiers 1–4 without mock dependencies.
   - *Inference*: A test runner (e.g. Vitest) must be introduced into `package.json`, `.env.test` configured with `database=PopoAppTest`, test database created via migrations, and test helpers created for data seeding and teardown.

---

## 3. Caveats
- SQL Server LocalDB requires Windows and a running instance of `MSSQLLocalDB` (`sqllocaldb start MSSQLLocalDB`). In test environments without LocalDB, integration tests connecting directly to SQL Server will require the service running locally.
- In-memory SQLite is not recommended for integration tests because SQLite does not emulate SQL Server T-SQL syntax, datetime types, or SQL Server error codes (e.g. error 2627 for unique violation, error 547 for check violation). Tests must target `PopoAppTest` on SQL Server LocalDB per D7.
- No other caveats.

---

## 4. Conclusion
The specification mining for Architecture, Data Modeling, Security, Storage, Localization, and Testing is fully complete. All requirements have been codified into `arch_and_test_spec.md`, which contains:
- 36 enumerated features in standard table format.
- 20 specific edge cases and failure modes in standard table format.
- Complete 18-entity Prisma schema matching SQL Server LocalDB constraints.
- File storage security pipeline specification.
- Brazilian Portuguese localization and UX layout mapping.
- 4-Tier test infrastructure specification mapping all 24 critical validations and Examples A–E.
- Cross-module boundaries and service interfaces.

The project is ready for checklist creation (`IMPLEMENTATION_CHECKLIST.md`) and subsequent implementation phases.

---

## 5. Verification Method
1. **Inspect Mined Specification**:
   - View `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md`.
   - Verify all 5 dispatch objectives are addressed in depth.
2. **Schema & Constraint Audit**:
   - Verify `arch_and_test_spec.md` Section 4 contains the complete `schema.prisma` draft.
   - Verify presence of SQL Server CHECK constraint for Attachment exclusivity (`CK_Attachment_Ownership`).
   - Verify presence of unique constraint on `Client.cpf`.
3. **Test Infrastructure Audit**:
   - Verify `arch_and_test_spec.md` Section 7 maps all 24 critical validations (§32), Examples A–E (§47), and binding decisions D1–D7 to specific tests across Tiers 1–4.
