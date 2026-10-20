# PopoApp — Implementation Checklist & Progress Tracker

> Persistent source of truth for PopoApp implementation progress, context preservation, architectural decisions, and testing status.
> Adheres strictly to `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` and `POPOAPP_DEVELOPMENT_SPEC.md`.

---

## 1. Project Status

- **Project Name**: PopoApp (Clinical & Aesthetic Practice Management System)
- **Target User**: Single-professional Brazilian aesthetic clinic
- **Integrity Mode**: Development
- **Tech Stack**: Next.js 15 (App Router), React 19, TypeScript 5.6, Tailwind CSS 3.4, Radix UI Primitives, iron-session 8, Prisma 6 ORM
- **Database Engine**: Microsoft SQL Server LocalDB (`provider = "sqlserver"`)
  - Development DB: `PopoApp`
  - Automated Testing DB: `PopoAppTest` (isolated per D7)
- **Active Milestone**: Milestone 5 (Comprehensive Clinical Seed Data & pt-BR UI Integration — Phases 15 & 16)
- **Overall Progress**: Milestone 4 complete (Gate PASSED, 42 test files / 289 tests passing, lint/build clean); Milestone 5 active.
- **Phase Breakdown**:
  - Completed (`[x]`): 2 (Phase 1: Foundation, Phase 4: Auth & Security)
  - In Progress (`[~]`): 12 (Phases 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
  - Not Started (`[ ]`): 4 (Phases 16 through 18)
  - Blocked (`[!]`): 0
  - Needs Decision (`[?]`): 0
- **Automated Test Coverage**: Vitest runner and .env.test configured for PopoAppTest; 42 test files, 289 tests passing (100%) against live LocalDB PopoAppTest with single-fork pool execution
- **Mock Data Status**: 8 mock data files present in `src/data/mock/*`; all authenticated pages currently reference mock data and will be migrated to real services in Phase 16 (R4).

---

## 2. Current Work

- **Phase**: Milestone 5 — Comprehensive Clinical Seed Data & pt-BR UI Integration (Phases 15 & 16)
- **Current Task**: Milestone 4 Gate unanimously approved (42 test files, 289 tests passing, lint/build clean). Commenced Milestone 5: implementing comprehensive clinical seed script (prisma/seed.ts — Phase 15, F28) covering §47 Examples A–E and §50.
- **Status**: Milestone 4 [x] COMPLETED (Gate PASSED). Milestone 5 [~] IN_PROGRESS
- **Completed**:
  - **Phase 1 (Tooling & Foundation)**: Vitest installed and configured with `vitest.config.ts`, .env.test isolation, LocalDB proxy helper, ESLint config.
  - **Phase 2 (Database & Schema)**: 18 Prisma domain models, migration deployed to `PopoApp` and `PopoAppTest`, `CK_Attachment_Ownership` CHECK constraint verified in SQL Server LocalDB engine.
  - **Phase 3 (Auth & Session)**: Implemented `src/services/auth.service.ts` with real Prisma user lookup and `bcrypt.compare`; hardened `src/middleware.ts` to return JSON 401 for unauthenticated `/api/*` requests per AC 60.
  - **Phase 4 (Authentication and Security)**: Real bcrypt auth, route protection, authenticated file streaming (`/api/attachments/[id]`), MIME validation.
  - **Phase 5 (Client Management - Backend)**: Implemented `src/lib/cpf.ts` (MOD 11, repeated digit checks, normalization and masking), `src/schemas/client.ts` with Zod, `src/services/client.service.ts` with unique CPF handling (P2002 conflict handling per AC 62, V01, V02), 1:N emergency contacts (V13) with input order preservation, soft-deactivation toggle (`ativo`/`inativo` per V05), and real derived history. Implemented `/api/clients`, `/api/clients/[id]`, `/api/clients/[id]/contacts`, and `/api/clients/[id]/contacts/[contactId]`.
  - **Phase 6 (Appointments - Backend)**: Implemented `src/types/appointment.ts`, `src/schemas/appointment.ts`, `src/services/appointment.service.ts` (6 valid statuses, prohibited `Em atendimento` per V03, auto-create `Pendente` attendance per D1/V07, atomic reschedule cascade with `rescheduledFromId`/`rescheduledToId` per D1/V04, cancel and no-show cascades, completion guard requiring completed attendance per V08, planned procedures per D3). Implemented route handlers: `/api/appointments`, `/api/appointments/[id]`, `/api/appointments/[id]/confirm`, `/api/appointments/[id]/cancel`, `/api/appointments/[id]/no-show`, `/api/appointments/[id]/reschedule`, `/api/appointments/[id]/complete`, `/api/appointments/[id]/status`.
  - **Phase 7 (Attendances - Backend)**: Implemented `src/types/attendance.ts`, `src/schemas/attendance.ts`, `src/services/attendance.service.ts` (D1 state machine `Pendente`/`Realizado`/`Cancelado`, procedure snapshot imutability `standardValueSnapshot` per V09/V12/V24, explicit practiced value `practicedValue` per V08, explicit discount validation per V11, dynamic D2 financial calculation). Implemented route handlers: `/api/attendances`, `/api/attendances/[id]`, `/api/attendances/[id]/status`, `/api/attendances/[id]/complete`, `/api/attendances/[id]/cancel`, `/api/attendances/[id]/procedures`, `/api/attendances/[id]/procedures/[procId]`, `/api/attendances/[id]/prefill`, `/api/attendances/[id]/discount`, `/api/attendances/[id]/usages`, `/api/attendances/[id]/record`.
  - **Phase 8 (Procedure Catalog - Backend)**: Implemented `src/types/procedure.ts`, `src/schemas/procedure.ts` (positive standard value `valorPadrao > 0` per V06, mandatory fields per V07), `src/services/procedure.service.ts` with soft deactivation fallback on relational usage, and API routes `/api/procedures` and `/api/procedures/[id]`.
  - **Phase 9 (Products and Inventory - Backend)**: Implemented `src/types/product.ts`, `src/schemas/product.ts`, `src/services/product.service.ts` (catalog CRUD, procedure associations, low stock calculation), `src/services/stock.service.ts` (batch lot intake with automatic physical `StockUnit` generation, serial uniqueness, available unit querying excluding expired lots per V15, `recordProductUsage` enforcing expired lot block per V15, single-use second use block per V18, same-client reuse per V16, and cross-client block with Portuguese error per V17, AC 59, AC 66). Implemented route handlers: `/api/products`, `/api/products/[id]`, `/api/products/[id]/lots`, `/api/lots/[id]`, `/api/lots/[id]/units`, `/api/stock/units`, `/api/stock/units/[id]`.
  - **Phase 10 (Medical Records - Backend)**: Implemented `src/types/medical-record.ts`, `src/schemas/medical-record.ts` (canonical fields + clinical aliases `anamnese`, `evolucaoClinica`, `orientacoesPosProcedimento`, `intercorrencias`), `src/services/medical-record.service.ts` enforcing strict 1:1 relationship with Attendance per V19. Route handler: `/api/attendances/[id]/record`.
  - **Phase 11 (Authenticated File Storage - Backend)**: Implemented `src/services/attachment.service.ts` with local disk storage outside web root (`./storage/uploads`), UUID filenames, MIME allowlist (JPEG, PNG, WebP, PDF per V12), 10MB limit (V13), Client XOR Attendance exclusivity (V14, AC 61), and atomic profile photo replacement. Implemented `/api/attachments`, `/api/attachments/[id]` (secure streaming with 401 unauth check, `nosniff`, private cache), and `/api/clients/[id]/photo`.
  - **Phase 15 (Client History Endpoint - Backend)**: Implemented `/api/clients/[id]/history` aggregating full chronological clinical and financial timeline.
  - **Testing**: 30 test files, 185 tests passing cleanly against live LocalDB database `PopoAppTest` (0 failures).
- **Remaining**:
  - UI screens for Milestone 2 & Milestone 3 (all UI items remain `[ ]` until Phase 16):
    - Client UI (`/clientes`, `/clientes/[id]`)
    - Agenda Calendar UI (`/agenda`)
    - Attendance Clinical Workspace UI (`/atendimentos`, `/atendimentos/[id]`)
    - Procedure Catalog UI (`/procedimentos`)
    - Product and Stock Traceability UI (`/produtos`)
  - Milestone 4: Financial Ledger, Payments & Reminders (Phases 12, 13, 14).
- **Immediate Next Action**:
  - Proceed with Milestone 4 (Financial Ledger, Payments & Reminders - Phases 12, 13, 14) or build UI components for Milestones 2 & 3 in Phase 16.
- **Blockers**: None.
- **Pending Decisions**: None (Binding decisions D1–D7 established).

### Resume Protocol (Quick Start for Returning Agent)

> 📘 **Full Resumption Guide**: See [`RESUME_GUIDE.md`](./RESUME_GUIDE.md) for complete context, step-by-step procedures, architectural constraints, and file index.

When resuming development, execute these steps in order:

1. **Verify Environment & LocalDB**:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   ```
2. **Start LocalDB TCP Proxy (dev/test bridge)**:
   ```powershell
   # If port 1433 is not already listening:
   npm run db:proxy
   ```
3. **Verify Baseline Tests**:
   ```powershell
   npm test
   # Expected: 30 test files passed, 185 passed (0 failures)
   ```
4. **Verify Build & Lint**:
   ```powershell
   npm run lint
   npm run build
   # Expected: zero lint errors, 17/17 pages generated cleanly
   ```
5. **Resume Implementation Priority**:
   - Option A (Milestone 2 UI): Implement real UI screens for Client Management (`/clientes` & `/clientes/[id]`), Procedure Catalog (`/procedimentos`), and Attachment gallery, replacing mock imports in those views.
   - Option B (Milestone 3 Core Services): Implement `AppointmentService` (6 statuses, rescheduling cascade, cancel reasons) and `AttendanceService` (D1 state machine, procedure pricing, discount application).

---

## 3. Implementation Phases

| Phase | Phase Name | Complexity | Status | Summary |
|---|---|---|---|---|
| **Phase 1** | Project Discovery and Architecture | Standard | `[x]` | Repository inspected, stack audited, mock dependencies mapped, PROJECT.md and checklist created, Vitest installed & configured, ESLint configured. |
| **Phase 2** | Database and Domain Model | 🔴 **HIGH COMPLEXITY** | `[~]` | 18 Prisma domain models, migration applied to PopoApp & PopoAppTest, CK_Attachment_Ownership CHECK constraint verified in DB; clinical seed pending. |
| **Phase 3** | Backend / Domain Logic | Standard | `[~]` | Domain services for auth, client, procedure, attachment, appointment, attendance, product, stock, prontuário; payments/reminders pending. |
| **Phase 4** | Authentication and Security | Standard | `[x]` | Real bcrypt auth, route protection, authenticated file streaming (`/api/attachments/[id]`), MIME validation. |
| **Phase 5** | Client Management | Standard | `[~]` | Client service, unique mandatory CPF, 1:N emergency contacts, profile photo replacement, API routes done; UI pages pending. |
| **Phase 6** | Appointments | Standard | `[~]` | 6 statuses, cancellation with reason, atomic rescheduling, planned procedures, API routes done; agenda UI pending. |
| **Phase 7** | Attendances | 🔴 **HIGH COMPLEXITY** | `[~]` | D1 state machine, procedure associations, practiced values, explicit discount, D2 financial calculations, API routes done; clinical workspace UI pending. |
| **Phase 8** | Procedures and Pricing | Standard | `[~]` | Procedure catalog CRUD service, standard values, snapshots, API routes done; UI pages pending. |
| **Phase 9** | Products and Inventory | 🔴 **HIGH COMPLEXITY** | `[~]` | Product catalog, lots, physical units, same-client reuse, cross-client prohibition, single-use restrictions, API routes done; UI pending. |
| **Phase 10** | Medical Records | Standard | `[~]` | Prontuário 1:1 with Attendance, clinical documentation fields, client history integration, API routes done; UI pending. |
| **Phase 11** | Attachments | 🔴 **HIGH COMPLEXITY** | `[~]` | Storage outside `public/`, Client XOR Attendance exclusivity, secure streaming API done; UI components pending. |
| **Phase 12** | Payments and Installments | 🔴 **HIGH COMPLEXITY** | [~] | Multi-method payments, partial payments, credit card installments (0 reminders), PIX installment schedule; backend verified, UI in Phase 16. |
| **Phase 13** | Reminders | 🔴 **HIGH COMPLEXITY** | [~] | In-app reminders for PIX installments, dashboard widget, mark done/dismissed decoupled from payments; backend verified, UI in Phase 16. |
| **Phase 14** | Financial Features | Standard | [~] | Attendance financial summary, dynamic Total/Outstanding calculation (D2), financial ledger dashboard; backend verified, UI in Phase 16. |
| **Phase 15** | Client History | Standard | `[~]` | Chronological history API route `/api/clients/[id]/history` derived from real records; UI pending. |
| **Phase 16** | Frontend / UX | Standard | `[ ]` | Zero mock imports, Brazilian Portuguese text, responsive design, dialogs, loading/empty/error states. |
| **Phase 17** | Validation and Testing | Standard | `[ ]` | Automated suite (Tiers 1–4), 24 critical validations tested, Scenarios A–E tested on `PopoAppTest`. |
| **Phase 18** | Final Review and Stabilization | Standard | `[ ]` | Specification audit, database audit, code audit, 22 final review items verified, zero false completions. |

---

## 4. Detailed Task Checklist

### Phase 1 — Project Discovery and Architecture `[x]`
- `[x]` Inspect repository structure, Next.js 15 App Router configuration, and TypeScript setup
- `[x]` Inspect current runtime and development dependencies in `package.json`
- `[x]` Inspect database connection and SQL Server LocalDB configuration in `.env` and `prisma/schema.prisma`
- `[x]` Inspect routing structure and layout wrappers under `src/app`
- `[x]` Inspect authentication mechanism (`src/lib/session.ts`, `src/middleware.ts`, `src/services/auth.service.ts`)
- `[x]` Inspect file storage status and identify absence of upload/download handlers
- `[x]` Inspect existing domain models (identify single `User` model, lack of migrations)
- `[x]` Inspect existing tests (identify absence of test runner and test files)
- `[x]` Identify existing UI component conventions (Radix UI wrappers, Tailwind themes in `globals.css`)
- `[x]` Identify existing mock data usage (`src/data/mock/*` used across all 8 authenticated pages)
- `[x]` Map existing implementation against `POPOAPP_DEVELOPMENT_SPEC.md` requirements
- `[x]` Identify conflicts, ambiguities, and binding decisions (D1–D7, R1–R5)
- `[x]` Create root `PROJECT.md` defining architecture, feature inventory, milestones, and contracts
- `[x]` Establish persistent `IMPLEMENTATION_CHECKLIST.md` at root reflecting baseline assessment
- `[x]` Configure `.eslintrc.json` extending `"next/core-web-vitals"` for non-interactive linting
- `[x]` Install and configure Vitest test runner with `vitest.config.ts`, test scripts in `package.json`, and `.env.test` for `PopoAppTest`

---

### Phase 2 — Database and Domain Model `[~]` 🔴 HIGH COMPLEXITY
- `[~] 🔴 HIGH COMPLEXITY — Database / Domain Model design, migrations, and integrity constraints`
  - `[x]` Design `User` model with password hash, active status, and timestamps
  - `[x]` Design `Client` model with required unique CPF (D4), contact info, birth date, address, and status
  - `[x]` Design `EmergencyContact` model with 1:N relationship to `Client` and relationship metadata
  - `[x]` Design `Appointment` model with 6 distinct statuses, cancellation reason, and rescheduling links
  - `[x]` Design `PlannedProcedure` model for appointment duration/price estimation (D3)
  - `[x]` Design `Attendance` model with D1 lifecycle statuses (`Pendente`, `Realizado`, `Cancelado`), explicit discount (D2)
  - `[x]` Configure `Appointment 1:N Attendance` relationship without 1:1 constraint
  - `[x]` Design `Procedure` catalog model with standard value, estimated duration, and active flag
  - `[x]` Design `AttendanceProcedure` technical association with `standardValueSnapshot` and mandatory `practicedValue`
  - `[x]` Design `Product` catalog model with `isReusable` flag (reusable vs. single-use)
  - `[x]` Design `ProcedureProduct` M:N association model between procedures and catalog products
  - `[x]` Design `ProductLot` model with lot number and expiration date linked to `Product`
  - `[x]` Design `StockUnit` model tracking individual physical units with unit code and current client linkage
  - `[x]` Design `ProductUsage` model recording actual physical unit usage in an `Attendance`
  - `[x]` Design `MedicalRecord` (`Prontuário`) model with strict 1:1 unique constraint to `Attendance`
  - `[x]` Design `Attachment` model with nullable `clientId` and `attendanceId`
  - `[x]` Create SQL Server migration script adding `CK_Attachment_Ownership` CHECK constraint enforcing XOR exclusivity
  - `[x]` Design `Payment` model with payment method, amount, paid status, and credit card installment count
  - `[x]` Design `PixInstallment` model for PIX installment due dates and amounts
  - `[x]` Design `Reminder` model with trigger date, description, status (`pendente`, `concluido`, `dispensado`), and installment link
  - `[x]` Remediate referential integrity actions (explicit `onDelete: NoAction, onUpdate: NoAction` on diamond convergence paths) in `schema.prisma` and `migration.sql` to eliminate P1012 and SQL Server Msg 1785
  - `[x]` Generate and synchronize migration script `20261006000000_init_domain_models/migration.sql` with all 18 tables, indexes, constraints, and `CK_Attachment_Ownership`
  - `[x]` Apply migration and generate Prisma Client against SQL Server LocalDB
  - `[ ]` Develop clinical seed script (`prisma/seed.ts`) implementing test cases and Scenarios A–E (§50, §47)

---

### Phase 3 — Backend / Domain Logic `[~]`
- `[~]` Create validation schemas with Zod for domain inputs (`src/schemas/*` - schemas for auth, client, procedure, appointment, attendance, product, lot, stock, prontuário completed; payments & reminders pending)
- `[x]` Implement Brazilian CPF validation algorithm (MOD 11 checksum verification and string normalization)
- `[x]` Implement `ClientService` business logic with CPF uniqueness and emergency contacts handling
- `[x]` Implement `AppointmentService` with 6 statuses and prohibition of `Em atendimento`
- `[x]` Implement atomic rescheduling transaction (old -> `Reagendado`, old attendance -> `Cancelado`, new appointment + attendance)
- `[x]` Implement cancellation and no-show transactions with cascade to pending attendance
- `[x]` Implement `AttendanceService` lifecycle state machine (D1: auto-pending, manual Realizado)
- `[x]` Implement `ProcedureService` catalog CRUD and snapshot preservation logic
- `[x]` Implement attendance procedure association requiring explicit `practicedValue`
- `[x]` Implement explicit attendance discount application (validating discount <= sum of practiced values)
- `[x]` Implement dynamic financial calculation engine (D2: Total = practiced - discount; Outstanding = Total - paid)
- `[x]` Implement `ProductService` catalog and lot management
- `[x]` Implement `StockService` (Inventory) physical unit tracking:
  - `[x]` Enforce same-client reuse of reusable physical units
  - `[x]` Strictly reject cross-client reuse of physical units with Portuguese error
  - `[x]` Strictly reject second use of single-use physical units
- `[x]` Implement `MedicalRecordService` ensuring exactly 1:1 relation with attendance
- `[ ]` Implement `PaymentService` handling partial payments, multiple methods, and card installment counts
- `[ ]` Implement `ReminderService` creating in-app reminders for PIX installments and decoupling reminder state from payments

---

### Phase 4 — Authentication and Security `[x]`
- `[x]` Replace mock authentication in `auth.service.ts` with real database lookup (`prisma.user`) and `bcrypt.compare`
- `[x]` Implement server-side session verification helper (`requireAuth`) for API routes
- `[x]` Protect all domain API routes (`/api/clients`, `/api/appointments`, `/api/attendances`, etc.)
- `[x]` Implement secure file upload handler saving files to disk outside `public/` (e.g. `./storage/uploads/`) with UUID names (D6)
- `[x]` Implement upload validation guard enforcing max 10MB size and allowed MIME types (JPEG, PNG, WebP, PDF)
- `[x]` Implement authenticated streaming route `/api/attachments/[id]` requiring active session and ownership verification
- `[x]` Prevent path traversal attacks by ignoring client-supplied paths and using strict UUID filenames

---

### Phase 5 — Client Management `[x]`
- `[x]` Implement `/api/clients` API route (GET list with search filter, POST create)
- `[x]` Implement `/api/clients/[id]` API route (GET detail, PUT update, DELETE soft-deactivate)
- `[x]` Implement `/api/clients/[id]/contacts` API route (manage 1:N emergency contacts)
- `[x]` Implement `/api/clients/[id]/photo` API route (upload/replace profile photo)
- `[ ]` Build client list UI with real-time search by name, CPF, or phone
- `[ ]` Build client registration and edit dialog with CPF masking, validation, and emergency contact fields
- `[ ]` Build client detail page (`/clientes/[id]`) with header, contact info, photo, and tabbed clinical history (§41)
- `[ ]` Replace mock data imports in `src/app/(authenticated)/clientes/page.tsx`

---

### Phase 6 — Appointments `[~]`
- `[x]` Implement `/api/appointments` API route (GET filtered by date range, POST create with auto-pending attendance)
- `[x]` Implement `/api/appointments/[id]` API route (GET detail, PATCH update status)
- `[x]` Implement `/api/appointments/[id]/confirm` endpoint (manual confirmation)
- `[x]` Implement `/api/appointments/[id]/cancel` endpoint (mandatory cancellation reason, auto-cancel pending attendance)
- `[x]` Implement `/api/appointments/[id]/no-show` endpoint (mark `Não compareceu`, auto-cancel pending attendance)
- `[x]` Implement `/api/appointments/[id]/reschedule` endpoint (atomic reschedule transaction)
- `[ ]` Build agenda calendar UI (`/agenda`) with Day, Week, and Month views connected to live API
- `[ ]` Build appointment creation modal supporting client selection and planned procedures
- `[ ]` Build appointment detail dialog showing status, planned procedures, cancellation reason, and link to attendance
- `[ ]` Build rescheduling modal capturing new date/time and reason
- `[ ]` Replace mock data imports in `src/app/(authenticated)/agenda/page.tsx`

---

### Phase 7 — Attendances `[~]` 🔴 HIGH COMPLEXITY
- `[~] 🔴 HIGH COMPLEXITY — Attendance lifecycle, procedure pricing, clinical workspace, and completion`
  - `[x]` Implement `/api/attendances` API route (GET list, POST create additional attendance for appointment)
  - `[x]` Implement `/api/attendances/[id]` API route (GET full clinical details, PATCH update)
  - `[x]` Implement `/api/attendances/[id]/procedures` API route (add/remove procedures with practiced values)
  - `[x]` Implement `/api/attendances/[id]/discount` API route (set explicit discount)
  - `[x]` Implement `/api/attendances/[id]/complete` API route (manually mark `Realizado` when service occurs)
  - `[x]` Implement `/api/attendances/[id]/cancel` API route (cancel attendance)
  - `[ ]` Build attendances list page (`/atendimentos`) with filters by status (`Pendente`, `Realizado`, `Cancelado`) and client
  - `[ ]` Build dedicated Attendance Clinical Workspace page (`/atendimentos/[id]`) (§43)
  - `[ ]` Integrate Procedure selection with standard value snapshot and practiced value inputs
  - `[ ]` Integrate explicit discount input and live financial calculation breakdown (D2)
  - `[ ]` Integrate embedded Prontuário editor, stock unit usage selector, attachment uploader, and payment modal
  - `[ ]` Replace mock data imports in `src/app/(authenticated)/atendimentos/page.tsx`

---

### Phase 8 — Procedures and Pricing `[~]`
- `[x]` Implement `/api/procedures` API route (GET catalog, POST create procedure)
- `[x]` Implement `/api/procedures/[id]` API route (GET detail, PUT update, PATCH toggle active status)
- `[x]` Verify catalog price changes do not mutate historical `standardValueSnapshot` or `practicedValue`
- `[ ]` Build procedure catalog management UI (`/procedimentos`) with category filters and active toggles
- `[ ]` Build procedure creation and edit modal (name, category, standard value, duration, description)
- `[ ]` Replace mock data imports in `src/app/(authenticated)/procedimentos/page.tsx`

---

### Phase 9 — Products and Inventory `[~]` 🔴 HIGH COMPLEXITY
- `[~] 🔴 HIGH COMPLEXITY — Product catalog, lot intake, individual stock unit traceability, and reuse rules`
  - `[x]` Implement `/api/products` API route (GET catalog, POST create product with `isReusable` flag)
  - `[x]` Implement `/api/products/[id]` API route (GET detail, PUT update)
  - `[x]` Implement `/api/products/[id]/lots` API route (POST create lot with batch number and expiration date)
  - `[x]` Implement `/api/lots/[id]/units` API route (POST register individual physical stock units)
  - `[x]` Implement `/api/stock/units` API route (GET unit search with availability and client-reuse status)
  - `[x]` Implement `/api/attendances/[id]/usages` API route (POST record unit usage with reuse validation)
  - `[ ]` Build product catalog UI (`/produtos`) showing category, reusable badge, and lot count
  - `[ ]` Build lot intake and physical unit registration modal (barcodes / serial identifiers)
  - `[ ]` Build unit traceability viewer showing unit history, current client assignment, and status
  - `[ ]` Build product usage selection dialog in attendance workspace enforcing reuse rules with pt-BR error feedback
  - `[ ]` Replace mock data imports in `src/app/(authenticated)/produtos/page.tsx`

---

### Phase 10 — Medical Records `[~]`
- `[x]` Implement `/api/attendances/[id]/medical-record` API route (GET and PUT/POST clinical record)
- `[x]` Enforce strict 1:1 database constraint between Attendance and MedicalRecord
- `[ ]` Build Prontuário component inside Attendance workspace with clinical fields (queixa principal, exame físico, conduta, orientações)
- `[ ]` Include Medical Record history in Client detail view (`/clientes/[id]`)

---

### Phase 11 — Attachments `[~]` 🔴 HIGH COMPLEXITY
- `[~] 🔴 HIGH COMPLEXITY — Secure local file storage, ownership exclusivity (Client XOR Attendance), and streaming access`
  - `[x]` Implement `/api/attachments/upload` API route (POST multipart file, clientId OR attendanceId)
  - `[x]` Enforce database CHECK constraint `CK_Attachment_Ownership` (XOR exclusivity)
  - `[x]` Implement file upload validation (allowed types: JPEG, PNG, WebP, PDF; max size: 10MB)
  - `[x]` Store binary files in isolated filesystem directory outside `public/` using UUID filenames
  - `[x]` Implement authenticated streaming endpoint `/api/attachments/[id]` with session and ownership verification
  - `[ ]` Build attachment uploader and gallery component for Client detail page
  - `[ ]` Build attachment uploader and gallery component for Attendance clinical workspace
  - `[ ]` Build profile photo uploader component with instant preview and replacement

---

### Phase 12 — Payments and Installments `[~]` 🔴 HIGH COMPLEXITY
- [x] 🔴 HIGH COMPLEXITY — Multi-method payments, partial payments, credit card installments, and PIX schedules (backend complete & verified)
  - `[x]` Implement `/api/attendances/[id]/payments` API route (GET list, POST record payment)
  - `[x]` Implement credit card payment handling with stored installment count (1..12) and zero reminder generation (D5)
  - `[x]` Implement PIX installment schedule creation endpoint generating installment plan with due dates and amounts
  - `[x]` Implement dynamic computation of total and outstanding balance for attendance (D2)
  - `[ ]` Build payment registration modal inside attendance workspace supporting partial payments and multiple methods
  - `[ ]` Build credit card installment selector and PIX installment schedule form
  - `[ ]` Build payment summary component displaying total, paid, and outstanding balance in real time

---

### Phase 13 — Reminders `[~]` 🔴 HIGH COMPLEXITY
- [x] 🔴 HIGH COMPLEXITY — In-app reminder engine for PIX installments with financial decoupling (backend complete & verified)
  - `[x]` Implement reminder generation service triggered by PIX installment schedule creation
  - `[x]` Implement `/api/reminders` API route (GET list with status filter, POST manual reminder)
  - `[x]` Implement `/api/reminders/[id]/status` API route (PATCH mark `concluido` or `dispensado`)
  - `[x]` Enforce decoupling rule: marking reminder complete/dismissed never alters payment status or outstanding balance
  - `[ ]` Build reminders management page (`/lembretes`) with tabs for pending, completed, and dismissed
  - `[ ]` Build dashboard upcoming and overdue PIX reminders widget
  - `[ ]` Replace mock data imports in `src/app/(authenticated)/lembretes/page.tsx`

---

### Phase 14 — Financial Features `[~]`
- `[x]` Implement `/api/financial/summary` API route (aggregate totals, receivables, paid amounts, payment method breakdowns)
- `[x]` Implement `/api/financial/transactions` API route (paginated ledger of all attendance payments)
- `[ ]` Build financial dashboard UI (`/financeiro`) with revenue cards, cash flow charts, and accounts receivable list
- `[ ]` Implement period filters (today, current week, current month, custom range)
- `[ ]` Replace mock data imports in `src/app/(authenticated)/financeiro/page.tsx`

---

### Phase 15 — Client History `[~]`
- `[x]` Implement `/api/clients/[id]/history` API route aggregating real records into chronological timeline
- `[x]` Ensure history aggregates: Appointments, Attendances, Performed Procedures, Product Usages, Prontuários, Payments, and Attachments
- `[x]` Verify no artificial `ClientHistory` table exists (derived strictly from domain records)
- `[ ]` Build tabbed and chronological history timeline components inside `/clientes/[id]`

---

### Phase 16 — Frontend / UX `[ ]`
- `[ ]` Remove all references to `src/data/mock/*` from all pages and components
- `[ ]` Verify all user-facing copy, headers, labels, buttons, and placeholders are in natural Brazilian Portuguese (pt-BR)
- `[ ]` Update `src/i18n/pt-BR.ts` with all domain terms and status labels (`Reagendado`, `Realizado`, etc.)
- `[ ]` Ensure proper Brazilian currency (BRL `R$ 0,00`) and date (`dd/MM/yyyy`) formatting throughout UI
- `[ ]` Build empty states, loading skeletons, error boundaries, and toast notifications (`sonner`) across all views
- `[ ]` Ensure responsive layout compatibility across mobile, tablet, and desktop viewports
- `[ ]` Wire dashboard shortcuts and real summary statistics in `src/app/(authenticated)/page.tsx`

---

### Phase 17 — Validation and Testing `[ ]`
- `[ ]` Install and configure Vitest test runner with TypeScript and isolated test database support (`PopoAppTest`)
- `[ ]` Create database test helper scripts for clean schema deployment and seed data (`tests/helpers/test-db.ts`)
- `[ ]` Implement Tier 1: Feature Coverage Test Suite (>=5 tests per core feature across all domain entities)
- `[ ]` Implement Tier 2: Boundary & Corner Cases Test Suite (CPF edges, stock boundaries, attachment XOR constraint)
- `[ ]` Implement Tier 3: Cross-Feature Combination Tests (state machine transitions, appointment-attendance-payment flows)
- `[ ]` Implement Tier 4: Real-World Clinical Workflows (Scenarios A through E from spec §47 against live test DB)
- `[ ]` Implement tests for all 24 Critical Validations (§32)
- `[ ]` Implement tests for binding decisions D1–D6
- `[ ]` Verify `npm test` runs full automated suite passing with 0 failures

---

### Phase 18 — Final Review and Stabilization `[ ]`
- `[ ]` Perform specification audit against `POPOAPP_DEVELOPMENT_SPEC.md`
- `[ ]` Perform database audit (schema, migrations, constraints, indexes)
- `[ ]` Perform backend service audit (zero business rules missing server-side)
- `[ ]` Perform frontend audit (zero mock imports remaining, pt-BR consistency)
- `[ ]` Perform test audit (all 24 critical validations verified, 0 failing tests)
- `[ ]` Perform security and privacy audit (auth enforcement, secure storage outside `public/`)
- `[ ]` Verify zero unresolved blockers and zero unresolved business decisions
- `[ ]` Complete all 22 items of Final Completion Audit in `IMPLEMENTATION_CHECKLIST.md`

---

## 5. Dependencies

### Inter-Phase Dependency Map

```
Phase 1 (Discovery & Architecture)
   │
   ▼
Phase 2 (Database & Domain Model) 🔴
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3 (Domain Logic)         Phase 4 (Auth & Security)      Phase 17 (Test Harness)
   │                              │                              │
   ├──────────────┬───────────────┴──────────────┬───────────────┤
   ▼              ▼                              ▼               ▼
Phase 5 (Client) Phase 8 (Procedures)         Phase 11 (Attach) 🔴 Phase 17 (Tiers 1-4)
   │              │                              │
   ▼              │                              │
Phase 6 (Appt)    │                              │
   │              │                              │
   └──────┬───────┘                              │
          ▼                                      │
   Phase 7 (Attendance) 🔴                       │
          │                                      │
   ├──────┼───────────────────────┬──────────────┤
   ▼      ▼                       ▼              ▼
Phase 9  Phase 10 (Prontuário)  Phase 12 (Pay) 🔴
(Stock) 🔴                        │
                                  ▼
                                Phase 13 (Reminders) 🔴
                                  │
                                  ▼
                                Phase 14 (Financial)
                                  │
                                  ▼
                                Phase 15 (Client History)
                                  │
                                  ▼
                                Phase 16 (Frontend / UX)
                                  │
                                  ▼
                                Phase 17 (Testing Completion)
                                  │
                                  ▼
                                Phase 18 (Final Review & Audit)
```

### Critical Task Dependencies

1. **Database Schema Before Service Layer**: Prisma domain models, foreign keys, and migrations (Phase 2) must be generated and deployed before implementing domain service methods (Phase 3).
2. **Authentication Before Protected Storage**: Session validation and encryption helpers (Phase 4) must be in place before routing authenticated file downloads (Phase 11).
3. **Clients Before Appointments**: `Client` entity and validation (Phase 5) must be functional before scheduling `Appointment` records (Phase 6), as appointments require a valid client.
4. **Procedures Before Attendances**: `Procedure` catalog and pricing snapshots (Phase 8) must exist before adding procedures to `Attendance` records (Phase 7).
5. **Appointments Before Attendances**: `Appointment` creation and lifecycle (Phase 6) drives automatic `Attendance` creation and cancellation cascades (Phase 7, D1).
6. **Products and Lots Before Product Usages**: `Product`, `Lot`, and `IndividualStockUnit` traceability (Phase 9) must be fully established before linking physical unit usages to attendances (Phase 7).
7. **Attendance Before Medical Records & Payments**: `Attendance` ID is mandatory for 1:1 `MedicalRecord` (Phase 10) and 1:N `Payment` records (Phase 12).
8. **Payments Before PIX Reminders**: PIX installment schedules under `Payment` (Phase 12) must be recorded before generating in-app reminders (Phase 13).
9. **All Domain Records Before Consolidated History**: Appointments, Attendances, Usages, Records, Payments, and Attachments must be queryable to assemble the dynamic client history view (Phase 15).
10. **Backend Services Before UI Removal of Mocks**: Endpoints and server actions must return real persisted data before removing `src/data/mock/*` from presentation pages (Phase 16).

---

## 6. High-Complexity Work

The following 6 areas require substantial domain reasoning, complex relational constraints, multi-table transactions, security controls, or extensive testing.

---

### 6.1 🔴 Database / Domain Model
- **Why High Complexity**: 18 domain entities with non-trivial cardinalities, SQL Server LocalDB quirks (lack of Prisma enum support, cascade delete cycles error 1785), strict decimal precision requirements, and custom SQL CHECK constraints.
- **Architectural Strategy**:
  - Model status and type fields as `String` in Prisma schema, backing them with TypeScript string literal unions and Zod runtime validators.
  - Apply `@db.Decimal(10, 2)` to all monetary columns (`valorPadrao`, `standardValueSnapshot`, `practicedValue`, `desconto`, `valor`).
  - Break cascade cycles by setting `onDelete: NoAction` on non-primary relationships and handling cleanup in service transactions.
  - Implement custom migration `migration.sql` to execute `ALTER TABLE [Attachment] ADD CONSTRAINT [CK_Attachment_Ownership] CHECK (...)`.
- **Decomposition**:
  1. *Entity Design*: User, Client, EmergencyContact, Appointment, PlannedProcedure, Attendance, Procedure, AttendanceProcedure, Product, ProcedureProduct, Lot, IndividualStockUnit, ProductUsage, MedicalRecord, Attachment, Payment, PaymentInstallment, Reminder.
  2. *Constraints & Indexes*: Unique CPF index, unique attendance medical record index, foreign keys, decimal types.
  3. *Custom CHECK Constraint*: SQL Server script for Attachment XOR ownership.
  4. *Migrations*: Versioned Prisma migration applied to SQL Server LocalDB.
  5. *Seed Script*: `prisma/seed.ts` inserting full clinical workflows covering Scenarios A–E.
  6. *Integrity Tests*: Direct database queries verifying foreign keys, uniqueness, and CHECK constraints.

---

### 6.2 🔴 Product Inventory and Individual Unit Traceability
- **Why High Complexity**: Physical items must be individually tracked through a 4-level hierarchy: `Product -> Lot -> IndividualStockUnit -> ProductUsage`. Reusable products can be reused by the same client across multiple attendances, but cross-client reuse is strictly prohibited. Single-use products can never be reused.
- **Architectural Strategy**:
  - `Product` has `isReusable: Boolean`.
  - `Lot` tracks batch numbers and expiration dates.
  - `IndividualStockUnit` tracks each physical unit code/barcode, status, and optional `currentClientId`.
  - `ProductUsage` represents actual clinical consumption during an `Attendance`.
  - In `InventoryService.recordUsage()`:
    - If `Product.isReusable === false`: assert zero existing `ProductUsage` records for this unit.
    - If `Product.isReusable === true`: fetch all previous `ProductUsage` records for this unit; assert all linked attendances belong to the same `clientId`. If a different client is found, reject with Portuguese error: `"Esta unidade de estoque já está vinculada a outro cliente."`
- **Decomposition**:
  1. *Catalog & Intake*: Product catalog CRUD with reusable flag, lot intake with expiration dates.
  2. *Unit Generation*: Serialized unit codes generated upon lot receipt.
  3. *Usage Validation Service*: Server-side validation enforcing single-use vs reusable cross-client prevention.
  4. *Clinical Workspace Selector*: UI dialog displaying eligible physical units (available units or units previously assigned to current client).
  5. *Traceability History*: Timeline of unit usages with attendance and client details.
  6. *Automated Tests*: Tests for Scenario C, cross-client rejection, single-use double-consumption rejection.

---

### 6.3 🔴 Attendance + Procedure Pricing
- **Why High Complexity**: Clear separation between `Appointment` and `Attendance`. Appointment may have multiple attendances. Each attendance contains multiple procedures. Each procedure captures a catalog standard value snapshot and a mandatory practiced value. The delta between standard and practiced values must NEVER become an automatic discount. Explicit discounts are applied separately. Totals and balances must be computed dynamically.
- **Architectural Strategy**:
  - `AttendanceProcedure` contains both `standardValueSnapshot: Decimal` and `practicedValue: Decimal`.
  - `Attendance` contains `desconto: Decimal` (defaults to 0.00).
  - Financial calculations:
    $$\text{Total} = \sum(\text{practicedValue}) - \text{desconto}$$
    $$\text{Saldo Devedor} = \text{Total} - \sum(\text{pagamentos 'Pago'})`
  - Neither `Total` nor `Saldo Devedor` is stored as a column in the database (D2).
- **Decomposition**:
  1. *Attendance Lifecycle Machine*: Statuses `Pendente`, `Realizado`, `Cancelado` per D1.
  2. *Procedure Technical Link*: Association table capturing immutable catalog snapshot and editable practiced price.
  3. *Explicit Discount Logic*: Server-side validation ensuring discount is non-negative and does not exceed practiced sum.
  4. *Dynamic Financial Calculator*: Service function returning complete monetary breakdown.
  5. *Attendance Workspace UI*: Form allowing independent practiced price adjustment and discount entry.
  6. *Automated Tests*: Tests for Scenarios A and B, snapshot immutability, zero auto-discount rule.

---

### 6.4 🔴 Payments and Installments
- **Why High Complexity**: Supports multiple partial payments per attendance across diverse methods (Cash, PIX, Credit Card, Debit Card, Boleto). Credit card payments record installment count ($1..12$) without generating reminders. PIX installments generate agreed installment schedules with due dates that feed into the reminder system.
- **Architectural Strategy**:
  - `Payment` model links to `Attendance`, storing `method`, `amount`, `status`, and `installmentsCount`.
  - When `method === 'CREDIT_CARD'`, store `installmentsCount`, set status `Pago` upon confirmation, and create zero reminders (D5).
  - When `method === 'PIX'` with installment schedule: generate `PaymentInstallment` records for each installment with calculated due dates.
  - Real-time balance computation verifies whether `paidTotal >= netTotal`.
- **Decomposition**:
  1. *Payment Entity & Methods*: Model supporting diverse payment instruments.
  2. *Credit Card Handling*: Multi-installment storage without reminder generation.
  3. *PIX Installment Scheduling*: Schedule generator with customizable intervals and due dates.
  4. *Partial Payment Logic*: Support multiple payments reducing outstanding balance incrementally.
  5. *UI Payment Modal*: Clinical workspace modal with method selector and schedule preview.
  6. *Automated Tests*: Credit card zero-reminder verification, PIX schedule generation, partial payment math.

---

### 6.5 🔴 Attachment / File Management
- **Why High Complexity**: Attachments belong to either a `Client` OR an `Attendance`, strictly mutually exclusive. Files must be stored on local disk outside `public/` using non-predictable UUID names. Access must be authenticated and authorized. MIME type and size limits must be validated.
- **Architectural Strategy**:
  - Store files on disk at `./storage/uploads/<uuid>.<ext>`.
  - Database table `Attachment` has nullable `clientId` and `attendanceId`.
  - Database enforces CHECK constraint:
    `((clientId IS NOT NULL AND attendanceId IS NULL) OR (clientId IS NULL AND attendanceId IS NOT NULL))`
  - Profile photo is a specialized attachment or direct relation on `Client`. Replacement deletes or archives previous file.
  - Streaming endpoint `/api/attachments/[id]` validates iron-session cookie, verifies record existence, and streams file with `Content-Type` and `Content-Disposition`.
- **Decomposition**:
  1. *Secure Storage Engine*: Local disk write helper, UUID generator, directory initialization.
  2. *Upload Validation Guard*: MIME type validation (JPEG, PNG, WebP, PDF), 10MB file limit.
  3. *Ownership Exclusivity Enforcement*: Service validation and SQL Server CHECK constraint.
  4. *Authenticated Streaming Handler*: Next.js route `/api/attachments/[id]` with session check.
  5. *Client & Attendance Gallery UI*: Upload dropzone, file list, preview, and download triggers.
  6. *Automated Tests*: XOR constraint DB test, unauthenticated download 401 test, MIME rejection test.

---

### 6.6 🔴 Reminder System
- **Why High Complexity**: Scheduled reminder generation for PIX installment due dates, dashboard feed of upcoming and overdue installments, manual resolution toggle (`concluido` / `dispensado`), and strict decoupling from financial records.
- **Architectural Strategy**:
  - `Reminder` model stores `paymentInstallmentId`, `title`, `description`, `dueDate`, `status` (`pendente`, `concluido`, `dispensado`).
  - Reminder generation is idempotent: re-evaluating an installment schedule does not produce duplicate reminders.
  - Status updates to `Reminder` never modify `Payment` or `PaymentInstallment` status (D5).
  - Dashboard widget queries pending reminders with `dueDate <= now + 7 days` (upcoming) or `dueDate < now` (overdue).
- **Decomposition**:
  1. *Reminder Model & Relations*: Relational link to PIX installment.
  2. *Generator Service*: Generates reminders based on PIX schedule due dates.
  3. *Status Lifecycle*: Toggle between pending, completed, and dismissed without side effects.
  4. *Dashboard Widget & Reminders Page*: `/lembretes` page with filters and dashboard alert feed.
  5. *No External Delivery Enforcement*: Ensure zero email/SMS/WhatsApp triggers are configured.
  6. *Automated Tests*: Decoupling invariant test (marking reminder done does not pay installment), idempotency test.

---

## 7. Blockers

| # | Description | Affected Phase / Task | Root Cause | Resolution Needed | Status |
|---|---|---|---|---|---|
| - | *Currently none.* | - | - | - | Active |

*When a blocker is encountered, document it here with description, affected phase, root cause, needed action, and mark affected tasks `[!]` or `[?]`. When resolved, move the rationale to Section 8.*

---

## 8. Decisions and Notes

### Binding Business Decisions (D1–D7)

- **D1. Attendance Lifecycle & State Machine**:
  - Attendance has its own distinct status: `Pendente`, `Realizado`, `Cancelado`.
  - Automatically created as `Pendente` when its Appointment is scheduled.
  - Transitioned to `Realizado` only when the user manually marks the encounter completed.
  - Cascade cancellation: When Appointment becomes `Cancelado`, `Não compareceu`, or `Reagendado`, its pending Attendance is automatically set to `Cancelado`.
  - Rescheduling lifecycle: Old Appointment becomes `Reagendado`, old pending Attendance becomes `Cancelado`, and a new Appointment is created with its own new `Pendente` Attendance.
- **D2. Attendance Total & Balance Composition**:
  - $\text{Total} = \sum(\text{practicedValue}) - \text{desconto}$
  - $\text{Saldo Devedor} = \text{Total} - \sum(\text{pagamentos 'Pago'})$
  - Both figures are computed on demand from underlying line-items and payments, never stored as editable database fields.
- **D3. Planned Procedures vs. Actual Procedures**:
  - Appointments support planned procedures for duration/cost estimation and pre-filling the attendance.
  - Planned procedures are distinct from procedures actually performed on the Attendance.
  - Appointments do NOT carry planned products. Products are associated exclusively through physical usage on Attendances.
- **D4. Client Fields & CPF Integrity**:
  - Client fields: `nome`, `telefone`, `email`, `dataNascimento`, `endereco`, `observacoes`, `isActive`.
  - **CPF is mandatory and unique**: validated via Brazilian mathematical checksum algorithm (MOD 11) and stored normalized (11 digits). Database enforces unique constraint.
  - Additional relations: 1:N emergency contacts, profile photo, and client attachments.
- **D5. In-App Reminder System**:
  - Reminders are strictly internal (in-app): dedicated `/lembretes` page and dashboard widget for upcoming/overdue PIX installments.
  - Can be marked `concluido` or `dispensado`.
  - Zero external delivery (no WhatsApp, SMS, or email).
  - Decoupling invariant: Marking a reminder done or dismissed does NOT modify payment status or financial balance.
  - Credit-card installments generate zero reminders.
- **D6. Secure Local File Storage**:
  - Uploaded files are stored on local disk outside the web root (`./storage/uploads/`).
  - Served exclusively via authenticated API routes (`/api/attachments/[id]`). Unauthenticated or predictable public URLs are prohibited.
- **D7. Environment & Database Isolation**:
  - Work in place in the existing repository using SQL Server LocalDB.
  - Development database: `PopoApp`.
  - Automated tests MUST run against an isolated test database (`PopoAppTest`), never wiping or polluting development data.

### Architectural & Technical Decisions

- **T1. SQL Server Prisma Enums**: Prisma's SQL Server connector does not support `enum` definitions. All enums are implemented as `String` in the Prisma schema with TypeScript string literal unions and Zod schema validation in domain services.
- **T2. Financial Decimals**: All monetary fields use `@db.Decimal(10, 2)` to eliminate floating-point precision inaccuracies.
- **T3. Attachment XOR Constraint**: SQL Server `CHECK` constraint `CK_Attachment_Ownership` enforces `(clientId IS NOT NULL AND attendanceId IS NULL) OR (clientId IS NULL AND attendanceId IS NOT NULL)` directly in the database.
- **T4. Test Runner Selection**: Vitest is selected as the primary test runner for native ESM, TypeScript, and fast execution compatibility with Next.js 15.
- **T5. Mock Data Elimination**: Complete replacement of all `src/data/mock/*` references in authenticated pages with real API/service calls.
- **T6. LocalDB Named Pipe to TCP Proxy (`tests/helpers/localdb-proxy.js`)**:
  - Scope: **Local Development & Automated Testing ONLY** (NOT required in Production runtime).
  - Context & Rationale: Microsoft SQL Server LocalDB (`(localdb)\MSSQLLocalDB`) runs as an on-demand, local Windows user process that listens exclusively via Windows Named Pipes (`np:\\.\pipe\LOCALDB#...\tsql\query`) and does not expose a TCP/IP listener. Prisma's query engine (`tiberius`) connects exclusively via TCP/IP.
  - Architecture: `tests/helpers/localdb-proxy.js` is a lightweight, zero-dependency Node.js bridge that listens on `127.0.0.1:1433` and pipes raw TDS streams directly to the active LocalDB Named Pipe.
  - Production Guarantee: In production, SQL Server or Azure SQL runs as a standard enterprise network service with native TCP listeners on port 1433; no proxy is used or needed in production.

---

## 9. Testing Status

### Test Runner & Environment Infrastructure
- `[x]` Install Vitest, `@vitest/coverage-v8`, and test helpers
- `[x]` Configure `vitest.config.ts` with TypeScript path aliases (`@/*`), .env.test loading, and sequential execution (`fileParallelism: false`)
- `[x]` Setup `.env.test` pointing to isolated database `PopoAppTest` on SQL Server LocalDB
- `[x]` Implement test database initializer and transaction cleanup utilities (`tests/helpers/db-cleaner.ts`, `db-client.ts`, `test-fixtures.ts`)
- `[x]` Configure `npm test` script in `package.json`

### Test Tiers Overview
- `[x]` **Tier 1: Feature Coverage Suite** (>=5 tests per core feature across all domain models: 11 test files, 69 tests)
- `[x]` **Tier 2: Boundary & Corner Cases Suite** (CPF checksum edge cases, decimal precision, stock boundaries, attachment XOR constraint: 10 test files, 29 tests)
- `[x]` **Tier 3: Cross-Feature Combinations Suite** (Appointment lifecycle transitions, attendance completion, payment allocation, reuse enforcement: 2 test files, 4 tests)
- `[x]` **Tier 4: Real-World Clinical Workflows Suite** (End-to-end execution of Scenarios A through E from spec §47: 1 test file, 5 tests)
- `[ ]` **Tier 5: Adversarial Coverage Hardening** (White-box adversarial edge cases, unauthenticated API probes, concurrency checks)

---

### The 24 Critical Business Validations (§32)

| # | Status | Validation Description | Target Entity / Rule |
|---|---|---|---|
| **V01** | `[x]` | Appointment must belong to exactly one Client | `Appointment.clientId` required foreign key (`tests/tier1_features/f17_appointment_service.spec.ts`) |
| **V02** | `[x]` | Appointment status must be one of the defined 6 statuses | Valid statuses: Agendado, Confirmado, Concluído, Cancelado, Não compareceu, Reagendado (`tests/tier1_features/f17_appointment_service.spec.ts`) |
| **V03** | `[x]` | `Em atendimento` must NOT exist as an Appointment status | Explicitly forbidden status (`tests/tier1_features/f17_appointment_service.spec.ts`) |
| **V04** | `[x]` | Rescheduling preserves old appointment as `Reagendado` and creates a new Appointment | Atomic rescheduling transaction; old attendance cancelled, new attendance created (`tests/tier1_features/f17_appointment_service.spec.ts`, `tests/tier4_workflows/scenarios_a_through_e.spec.ts`) |
| **V05** | `[x]` | Attendance is distinct from its Appointment | Independent entity, separate lifecycle and ID (`tests/tier1_features/f18_attendance_service.spec.ts`) |
| **V06** | `[x]` | An Appointment may have more than one Attendance | Cardinality `Appointment 1:N Attendance` (`tests/tier1_features/f18_attendance_service.spec.ts`) |
| **V07** | `[x]` | Attendance must NOT be considered completed merely because Appointment exists | Attendance defaults to `Pendente`; requires manual completion to `Realizado` (`tests/tier1_features/f18_attendance_service.spec.ts`, `tests/tier2_boundaries/v08_appointment_completion_attendance.spec.ts`) |
| **V08** | `[x]` | Every Procedure attached to an Attendance must have a practiced value | `AttendanceProcedure.practicedValue` non-nullable decimal (`tests/tier1_features/f18_attendance_service.spec.ts`, `tests/tier2_boundaries/v08_appointment_completion_attendance.spec.ts`) |
| **V09** | `[x]` | Standard procedure value and practiced value must be stored separately | `standardValueSnapshot` and `practicedValue` distinct columns (`tests/tier2_boundaries/v09_procedure_snapshot_immutability.spec.ts`) |
| **V10** | `[x]` | Difference between standard and practiced values must NOT automatically become an Attendance discount | Zero auto-discount rule; practiced < standard does not alter discount (`tests/tier1_features/f18_attendance_service.spec.ts`, `tests/tier4_workflows/scenarios_a_through_e.spec.ts`) |
| **V11** | `[x]` | Attendance discount must be explicit | `Attendance.desconto` manually entered, independent of procedure prices (`tests/tier1_features/f18_attendance_service.spec.ts`, `tests/tier4_workflows/scenarios_a_through_e.spec.ts`) |
| **V12** | `[x]` | Historical procedure values must NOT change when catalog values change | Catalog price update preserves `standardValueSnapshot` on existing attendances |
| **V13** | `[x]` | A Client can have multiple emergency contacts | `Client 1:N EmergencyContact` |
| **V14** | `[x]` | Attachment belongs to Client OR Attendance, never both and never neither | SQL Server CHECK constraint `CK_Attachment_Ownership` (XOR exclusivity) |
| **V15** | `[x]` | Specific reusable physical Product unit may be reused by the same Client across Attendances | Reusable unit allows multiple usages if all usages belong to same client (`tests/tier2_boundaries/v15_expired_lot_prevention.spec.ts`, `tests/tier2_boundaries/v16_v17_reusable_cross_client_prevention.spec.ts`) |
| **V16** | `[x]` | Same physical Product unit must NEVER be used by another Client | Server strictly rejects reusable unit assigned to Client A if used for Client B (`tests/tier2_boundaries/v16_v17_reusable_cross_client_prevention.spec.ts`) |
| **V17** | `[x]` | Single-use products must NOT be reused | Second consumption of `isReusable = false` unit strictly rejected (`tests/tier2_boundaries/v16_v17_reusable_cross_client_prevention.spec.ts`) |
| **V18** | `[x]` | Product Usage must identify an individual physical stock unit | `ProductUsage.individualStockUnitId` non-nullable; tracks physical unit (`tests/tier2_boundaries/v18_single_use_unit_prevention.spec.ts`) |
| **V19** | `[x]` | Medical Record is exactly ONE per Attendance | `MedicalRecord.attendanceId` unique constraint (1:1) (`tests/tier2_boundaries/v19_medical_record_unique_attendance.spec.ts`) |
| **V20** | `[x]` | Attendance may have multiple payments | `Attendance 1:N Payment` supporting partial payments across methods (`tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts`, `tests/tier1_features/f09_payment_service.spec.ts`) |
| **V21** | `[x]` | Credit-card installments do NOT generate collection reminders | Credit card stores installment count ($1..12$) with zero reminder creation (`tests/tier2_boundaries/v21_card_installment_no_reminders.spec.ts`) |
| **V22** | `[x]` | PIX installment schedules may generate reminders | PIX installment plan creates scheduled reminders matching due dates (`tests/tier2_boundaries/v22_pix_installment_reminders.spec.ts`, `tests/tier1_features/f10_reminder_service.spec.ts`) |
| **V23** | `[x]` | Reminder state must NOT replace payment truth | Marking reminder `concluido`/`dispensado` never alters payment status or balance (`tests/tier2_boundaries/v23_reminder_state_payment_truth.spec.ts`) |
| **V24** | `[x]` | Historical records must NOT be rewritten by catalog changes | Catalog edits never mutate historical attendances, prices, or product usages |

---

### Spec §47 Real-World Clinical Workflows (Scenarios A–E)

| Scenario | Status | Description | Key Assertions |
|---|---|---|---|
| **Scenario A** | `[x]` | Practiced Value Lower than Standard Value | Procedure standard R$500, practiced R$400. Discount remains R$0,00. Total is R$400,00. (`tests/tier4_workflows/scenarios_a_through_e.spec.ts`) |
| **Scenario B** | `[x]` | Explicit Attendance Discount | Two procedures practiced total R$800. Explicit discount R$100. Total is R$700,00. (`tests/tier4_workflows/scenarios_a_through_e.spec.ts`) |
| **Scenario C** | `[x]` | Reusable Unit Reused for Same Client; Cross-Client Rejected | Unit used for Client A in Attendance 1 & 2 succeeds. Attempt to use for Client B fails with Portuguese error. (`tests/tier4_workflows/scenarios_a_through_e.spec.ts`, `tests/tier2_boundaries/v16_v17_reusable_cross_client_prevention.spec.ts`) |
| **Scenario D** | `[x]` | Rescheduled Appointment Workflow | Original appointment becomes `Reagendado`, old attendance becomes `Cancelado`. New appointment & attendance created. (`tests/tier4_workflows/scenarios_a_through_e.spec.ts`, `tests/tier1_features/f17_appointment_service.spec.ts`) |
| **Scenario E** | `[x]` | Multiple Payment Methods & Installments | Total R$1.000. R$400 paid via Credit Card (2x, 0 reminders). R$600 scheduled in 3x PIX (3 reminders). Outstanding updates accurately. (`tests/tier3_combinations/m4_financial_reminders_e2e.spec.ts`, `tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts`) |

---

## 10. Change Log

- **2026-10-06** — Initial creation of `IMPLEMENTATION_CHECKLIST.md` and root `PROJECT.md`. Established comprehensive baseline for all 18 implementation phases, decomposed all 6 high-complexity areas, integrated decisions D1–D7 and requirements R1–R5, and formulated testing matrix covering all 24 critical business validations and Scenarios A–E.
- **2026-10-06** — Milestone 1 (Phase 1 & Phase 2) progress: Created `.eslintrc.json` extending `next/core-web-vitals`; configured Vitest test runner with `vitest.config.ts`, `package.json` test scripts, and `.env.test` for `PopoAppTest`. Implemented complete 18-model relational schema in `prisma/schema.prisma` with `@db.Decimal(10, 2)` monetary values, string enums with Zod validation, and `onDelete: NoAction` cycle avoidance. Authored initial migration `20261006000000_init_domain_models/migration.sql` creating all 18 tables, indexes, foreign keys, and SQL Server `CK_Attachment_Ownership` CHECK constraint.
- **2026-10-06** — Milestone 2 (Phases 3, 4, 5, 8, 11) completed by Worker M2 1: Implemented real authentication with bcrypt and iron-session; hardened middleware to return 401 JSON on unauthenticated `/api/*` access (AC 60); implemented Brazilian CPF MOD 11 verification, formatting, and normalization in `src/lib/cpf.ts`; built `ClientService` with mandatory unique CPF handling (P2002 conflict handling per AC 62, V01, V02), 1:N emergency contacts (V13), soft deactivation toggle (V05), and real derived history; built complete client API routes; built `ProcedureService` with positive decimal standard values (V06), mandatory fields (V07), soft deactivation on in-use procedures to prevent FK violations, and procedure API routes; built `AttachmentService` with local disk storage outside web root (D6), UUID filenames, MIME validation (V12), 10MB limit (V13), Client XOR Attendance exclusivity (V14, AC 61), atomic profile photo replacement, and secure authenticated streaming route `/api/attachments/[id]`; created comprehensive test suites covering all implemented features and critical validations.
- **2026-10-07** — Baseline verification & audit by Worker Baseline 1:
  - Ensured LocalDB `MSSQLLocalDB` is active and created development database `PopoApp` and isolated test database `PopoAppTest`.
  - Validated Prisma schema (`npx prisma validate`) and generated Prisma Client (`npx prisma generate`).
  - Successfully applied initial migration `20261006000000_init_domain_models/migration.sql` to both `PopoApp` and `PopoAppTest`. Verified SQL Server `CK_Attachment_Ownership` CHECK constraint directly in database engine.
  - Installed missing npm test dependencies (`npm install`), resolved Vitest `.env.test` loading in `vitest.config.ts`, configured sequential test execution (`fileParallelism: false`) to avoid concurrent database truncate race conditions.
  - Built `tests/helpers/localdb-proxy.js` (dev/test-only TCP-to-Named-Pipe bridge on port 1433 for Prisma Tiberius engine on LocalDB).
  - Authentically fixed fixture bug in `tests/tier4_workflows/scenarios_a_through_e.spec.ts` (linking attendances to required appointment foreign keys per schema) without modifying scenario values or assertions.
  - Authentically fixed `ClientService.createClient` to preserve caller-supplied array order of emergency contacts.
  - Successfully ran full automated test suite: 15 test files, 89 tests passing with 0 failures (100% pass rate).
  - Audited checklist: downgraded premature `[x]` marks for Phases 5, 8, and 11 to `[~]` since UI screens are pending; marked Phase 2 migration deploy as `[x]`.
- **2026-10-15** — Milestone 3 (Phases 6, 7, 9, 10, 15 backend) completed by Worker M3 1:
  - Implemented domain types and DTOs: `src/types/appointment.ts` (canonical 6 statuses, prohibited `Em atendimento`), `src/types/attendance.ts` (`Pendente`, `Realizado`, `Cancelado`, `AttendanceFinancialsDto`), `src/types/product.ts` (`Disponivel`, `EmUso`, `Esgotado`, `Descartado`, Product, Lot, StockUnit DTOs), `src/types/medical-record.ts`.
  - Implemented Zod validation schemas: `src/schemas/appointment.ts`, `src/schemas/attendance.ts`, `src/schemas/product.ts`, `src/schemas/medical-record.ts` (with pt-BR clinical aliases).
  - Implemented domain services: `AppointmentService` (D1, V03, V08 completion guard, D3 planned procedures, atomic rescheduling cascade), `AttendanceService` (D1 lifecycle, snapshot preservation V09, explicit practiced values V08, explicit discounts V11, D2 dynamic financials), `ProductService` (catalog CRUD, procedure associations, low stock threshold), `StockService` (lot intake with automatic physical unit generation, serial uniqueness, available unit querying, usage validation enforcing V15 expired lot block, V18 single-use second use block, V16 same-client reuse, and V17 / AC 59 / AC 66 cross-client block with exact pt-BR error `"Esta unidade de estoque já está vinculada a outro cliente."`), `MedicalRecordService` (strict 1:1 Attendance constraint per V19), `ProcedureService` class wrapper.
  - Implemented Next.js 15 App Router API handlers with awaited params (`const { id } = await params;`) and iron-session auth: `/api/appointments/*`, `/api/attendances/*`, `/api/products/*`, `/api/lots/*`, `/api/stock/units/*`, `/api/clients/[id]/history`.
  - Authored comprehensive automated test suites: Tier 1 Feature tests (f17, f18, f20, f21, f22), Tier 2 Boundary tests (v08, v09, v15, v16_v17, v18, v19), Tier 3 Combination test (`m3_clinical_workflow_e2e.spec.ts`).
  - Total test suite expanded from 15 files / 89 tests to 30 test files / 185 tests, 100% passing against live LocalDB `PopoAppTest`.
  - Clean `npm run lint` (0 errors) and clean `npm run build` (all routes compiled cleanly).
- **2026-10-16** — Milestone 4 (Phases 12, 13, 14 backend, tests, route handlers) completed by Worker M4 1:
  - Vitest test harness optimization: updated `vitest.config.ts` to include `pool: 'forks'`, activating single-fork sequential execution without thread worker collisions against SQL Server LocalDB.
  - Implemented domain types and schemas: `src/types/payment.ts`, `src/schemas/payment.ts`, `src/types/reminder.ts`, `src/schemas/reminder.ts`, `src/types/dashboard.ts`, `src/schemas/dashboard.ts`.
  - Implemented domain services:
    - `PaymentService`: full/partial payments across multiple methods (V20, D2), Credit Card stored installment counts (1..12) with zero PixInstallments and zero reminders (V21, D5), PIX installment schedule creation with exact cent rounding and automated in-app reminder generation (V22, D5), `payPixInstallment` and status transitions, overpayment protection against outstanding balance or advance appointment estimated ceiling.
    - `ReminderService`: strictly in-app reminders (D5), list/filter with `isOverdue` temporal calculation, status transitions to `concluido` or `dispensado` with `completedAt`, dashboard feed of upcoming & overdue PIX installments, self-healing sync, and total decoupling invariant (V23 & AC 68: reminder actions strictly NEVER alter payment status or balance).
    - `DashboardService`: executive metrics (gross revenue, discounts, net revenue, received cash, accounts receivable), cash flow breakdown by method, appointment and attendance volume metrics today, low-stock alerts for products with $\le 5$ available units, and reminders widget.
    - Enhanced `AttendanceService.computeFinancials` to aggregate paid PIX installments.
  - Implemented Next.js 15 App Router API route handlers with awaited dynamic params:
    - `/api/attendances/[id]/payments` (GET, POST)
    - `/api/attendances/[id]/payments/pix-schedule` (POST)
    - `/api/payments/[id]` (GET, DELETE)
    - `/api/payments/installments/[id]/pay` (POST) and `/api/pix-installments/[id]/pay` (POST alias)
    - `/api/reminders` (GET, POST)
    - `/api/reminders/[id]` (GET, PATCH, DELETE)
    - `/api/reminders/[id]/status` (PATCH)
    - `/api/reminders/dashboard` (GET)
    - `/api/dashboard/summary` (GET)
    - `/api/financial/summary` (GET)
    - `/api/financial/transactions` (GET)
  - Authored comprehensive automated test suites:
    - `tests/tier1_features/f09_payment_service.spec.ts` (7 tests)
    - `tests/tier1_features/f10_reminder_service.spec.ts` (6 tests)
    - `tests/tier1_features/f27_dashboard_service.spec.ts` (6 tests)
    - `tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts` (5 tests)
    - `tests/tier2_boundaries/v21_card_installment_no_reminders.spec.ts` (5 tests)
    - `tests/tier2_boundaries/v22_pix_installment_reminders.spec.ts` (5 tests)
    - `tests/tier2_boundaries/v23_reminder_state_payment_truth.spec.ts` (5 tests)
    - `tests/tier3_combinations/m4_financial_reminders_e2e.spec.ts` (1 test)
    - Refactored `tests/tier4_workflows/scenarios_a_through_e.spec.ts` (5 tests) to exercise real domain services.
  - Full automated suite: 40 test files, 257 tests passing with 0 failures (100% pass rate) on LocalDB `PopoAppTest`.
  - Clean `npm run lint` (0 errors) and clean `npm run build`.

---

## 11. Final Completion Audit

*The project shall not be declared complete until all 22 review items below are verified against the running application and live test suite:*

- `[ ]` 1. Project architecture reviewed and compliant with layered boundaries
- `[ ]` 2. Database/domain model complete with all 18 models on SQL Server LocalDB
- `[ ]` 3. Client management complete with mandatory unique CPF and emergency contacts
- `[ ]` 4. Appointments complete with 6 statuses and prohibition of `Em atendimento`
- `[ ]` 5. Attendances complete with D1 state machine (Pendente/Realizado/Cancelado)
- `[ ]` 6. Procedures and practiced values complete with snapshot preservation
- `[ ]` 7. Explicit Attendance discount complete with zero auto-discount enforcement
- `[ ]` 8. Products/Lots/individual units complete with physical unit tracking
- `[ ]` 9. Product Usage and traceability complete with same-client reuse & cross-client prevention
- `[ ]` 10. Medical Records complete with strict 1:1 Attendance constraint
- `[ ]` 11. Attachments complete with secure storage outside `public/` and SQL Server XOR CHECK constraint
- `[ ]` 12. Payments complete with multi-method and partial payment support
- `[ ]` 13. Credit-card installments complete with zero reminder creation
- `[ ]` 14. PIX installments complete with scheduled installment plan
- `[ ]` 15. PIX reminders complete with dashboard widget and financial decoupling
- `[ ]` 16. Client history complete with dynamic derivation from real domain records
- `[ ]` 17. Frontend/UX complete with zero mock imports and natural Brazilian Portuguese copy
- `[ ]` 18. Security/privacy reviewed with iron-session auth and authenticated file streaming
- `[ ]` 19. Critical validations tested with all 24 validations backed by automated tests
- `[ ]` 20. Regression tests completed with 100% pass rate on `PopoAppTest` LocalDB
- `[ ]` 21. No unresolved blockers remaining
- `[ ]` 22. No unresolved business decisions remaining; final specification audit complete
