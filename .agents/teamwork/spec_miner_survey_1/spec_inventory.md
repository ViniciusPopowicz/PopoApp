# PopoApp — Master Specification Survey & Feature Inventory

**Author**: Spec Miner Survey 1 (`teamwork_preview_spec_miner`)  
**Timestamp**: 2026-10-06T02:27:00Z  
**Authoritative Sources**:
1. `ORIGINAL_REQUEST.md` (Original User Request, Decisions D1–D7, Requirements R1–R5, Acceptance Criteria)
2. `POPOAPP_DEVELOPMENT_SPEC.md` (Product / Domain Specification, §§1–53)
3. `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Implementation Checklist & Context Management Specification, §§1–21)
4. Existing Codebase: Next.js 15, React 19, TypeScript 5.6, Tailwind CSS, Radix UI, Prisma 6 (SQL Server LocalDB), iron-session.

---

## 1. Executive Summary & Architectural Overview

PopoApp is a production-grade management application for a single Brazilian aesthetic/clinical healthcare professional. The system replaces an existing Next.js 15 mock-data skeleton with a real relational model, server-side domain services, strict data validation, secure local file storage, and an automated test suite running against Microsoft SQL Server LocalDB.

### Key Architectural Pillars:
1. **Domain Integrity over Convenience**: Clear structural separation among Clients, Appointments, Attendances, Procedures, Products, Medical Records, Attachments, and Payments.
2. **Historical Immutability**: Historical financial values, procedures, and inventory usage snapshots must never change when catalog defaults are altered.
3. **Traceability of Stock Units**: Physical inventory units are individually tracked (Product -> Lot -> Individual Stock Unit -> Product Usage) with strict cross-client reuse prevention.
4. **Decoupled Financial Truth**: Reminders are strictly convenience notifications and never the financial source of truth. Totals and balances are computed dynamically.
5. **Security & Privacy**: Clinical medical records and uploaded attachments must reside outside the public web root and be served solely through authenticated streaming endpoints.
6. **Brazilian Portuguese UX**: User-facing interfaces, forms, validation messages, and terminology must be in natural Brazilian Portuguese.

---

## 2. Binding Decisions (D1–D7) & Mandatory Requirements (R1–R5)

### Binding Decisions (User-Established & Non-Negotiable)

- **D1. Attendance Lifecycle & State Machine**
  - **Statuses**: Exactly `Pendente`, `Realizado`, `Cancelado`.
  - **Auto-creation**: When an Appointment is created, its corresponding Attendance is automatically instantiated in `Pendente` status.
  - **Manual completion**: An Attendance is transitioned to `Realizado` only when the professional manually marks the clinical service as completed upon actual encounter. Creating an Appointment never produces a `Realizado` Attendance.
  - **Cascade cancellation**: If an Appointment transitions to `Cancelado`, `Não compareceu`, or `Reagendado`, its pending Attendance is automatically transitioned to `Cancelado`.
  - **Rescheduling lifecycle**: When an Appointment is rescheduled, the previous Appointment becomes `Reagendado`, its pending Attendance becomes `Cancelado`, and the newly created Appointment receives a brand-new `Pendente` Attendance.

- **D2. Attendance Financial Calculation & Dynamic Composition**
  - **Total**: Computed as $\text{Total} = \sum(\text{practicedValue of associated procedures}) - \text{explicit Attendance discount}$.
  - **Outstanding Balance**: Computed as $\text{Outstanding} = \text{Total} - \sum(\text{amount of payments with 'paid' status})$.
  - **Storage Rule**: Both Total and Outstanding must be dynamically computed from underlying records, not persisted as static source-of-truth fields (preventing drift).

- **D3. Planned Procedures vs. Actual Procedures**
  - **Appointments**: An Appointment may carry *planned procedures* for estimating duration and value, and to pre-fill the initial Attendance.
  - **Separation**: Planned procedures remain strictly distinct from the actual procedures recorded on the Attendance.
  - **No Planned Products**: Appointments do NOT support planned products. Products are only associated with Attendances through physical usage.

- **D4. Client Fields & CPF Integrity**
  - **Mandatory fields**: `nome`, `telefone`, `email`, `data de nascimento`, `endereço`, `observações`, and `active/inactive` status.
  - **CPF Mandatory & Unique**: CPF is mandatory and unique across all clients. Must be validated using Brazilian mathematical checksum algorithms (well-formed CPF) and stored normalized (digits only, 11 characters).
  - **Additional Client Relations**: Emergency contacts (1:N), profile photo, and client attachments.

- **D5. In-App Reminder System**
  - **Channel**: In-app only. Consists of a dedicated `/lembretes` page and a dashboard widget displaying upcoming and overdue PIX installments.
  - **Interactions**: Reminders can be marked as completed (`done`) or dismissed (`dismissed`).
  - **No External Delivery**: No external emails, WhatsApp, or SMS messaging services.
  - **Decoupling**: Marking a reminder done or dismissed does NOT modify payment status or financial ledgers.

- **D6. Secure Local File Storage**
  - **Location**: Uploaded files (attachments, profile photos) must be stored on local disk outside the web server's `public/` directory (e.g., in a protected `uploads/` directory).
  - **Access Control**: Served exclusively via authenticated Next.js API routes (e.g., `/api/attachments/[id]`). Unauthenticated access and predictable public file URLs are strictly prohibited.

- **D7. Environment & Test Database Isolation**
  - **Repository**: Work in place within the existing git repository, committing incrementally.
  - **Database Engine**: Microsoft SQL Server LocalDB (`provider = "sqlserver"`).
  - **Isolation**: Migrations and development run on the development database. Automated tests MUST run against an isolated test database, never touching or wiping development data.

---

### Mandatory Requirements (R1–R5)

- **R1. Persistent Implementation Checklist**
  - Create and maintain `IMPLEMENTATION_CHECKLIST.md` at the project root containing all 11 required sections, 18 phases, only the 5 allowed status markers (`[ ]`, `[~]`, `[x]`, `[!]`, `[?]`), 🔴 high-complexity markings, dependencies, blockers, and testing statuses. Record decisions D1–D7 under Decisions and Notes.

- **R2. Real Relational Domain Model & Database**
  - Replace the single-model Prisma schema with a complete relational model covering all entities in §31. Enforce business constraints in SQL Server (foreign keys, unique constraints, check constraints, snapshots, indexes). Implement Prisma migrations and realistic seed data (§50).

- **R3. Business Logic, Security & Server-Side Enforcement**
  - Implement business rules in a robust server/service domain layer (not just React client forms). Enforce all 24 Critical Validations (§32) and decisions D1–D6. Protect all clinical routes with iron-session auth and validate all file uploads.

- **R4. User-Facing Application (Brazilian Portuguese UX)**
  - Replace all mock data imports (`src/data/mock`) with real data flows across Clients, Appointments/Calendar, Attendances, Procedures, Products/Inventory, Payments, and Reminders. Deliver responsive layouts, empty states, loading skeletons, error boundaries, and Brazilian Portuguese copy.

- **R5. Automated Test Suite**
  - Deliver an automated test suite covering all 24 critical validations, decisions D1–D6, and §47 scenarios (A–E). Tests must run against the real database/service layer via a single documented command (`npm test`) with 100% pass rate.

---

## 3. Enumeration of All 18 Implementation Phases

Per `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` §§5 & 7:

| Phase | Phase Name | Complexity | Scope & Tasks | Key Deliverables | Dependencies |
|---|---|---|---|---|---|
| **Phase 1** | Project Discovery & Architecture | Standard | Inspect existing repo, stack (Next.js 15, React 19, Prisma 6, SQL Server LocalDB), inspect mock data, inspect auth (iron-session), map existing code to development spec, identify conventions and architectural gaps. | Architecture map, inventory of mock dependencies, convention guidelines. | None |
| **Phase 2** | Database & Domain Model | 🔴 **HIGH COMPLEXITY** | Design and implement Prisma schema covering all entities: User, Client, EmergencyContact, Appointment, Attendance, Procedure, AttendanceProcedure, Product, Lot, IndividualStockUnit, ProductUsage, MedicalRecord, Attachment, Payment, PaymentInstallment, Reminder. Define relations, foreign keys, unique constraints, check constraints, snapshots, and indexes. Generate migrations and seed script (§50). | Updated `schema.prisma`, SQL Server migration scripts, `prisma/seed.ts`, database integration test. | Phase 1 |
| **Phase 3** | Backend / Domain Logic | Standard | Build service/domain layer for business rules, validation, transactions, server actions/API routes, error handling, snapshot preservation, inventory checks, and dynamic financial computations. | Service modules (`src/server/services/*`), validation schemas (`zod`), error handlers. | Phase 2 |
| **Phase 4** | Authentication & Security | Standard | Verify iron-session auth, protect all domain routes and API endpoints, implement secure streaming route for attachments outside `public/`, upload file validation (MIME, max size, sanitization). | Auth middleware/helpers, `/api/attachments/[id]` streaming handler, upload validator. | Phase 1, Phase 2 |
| **Phase 5** | Client Management | Standard | Full Client CRUD, CPF validation (checksum + normalization + unique constraint), contact details, 1:N emergency contacts management, profile photo upload/replacement, client attachments, search, and client detail view. | Client pages (`/clientes`), client dialogs, emergency contacts UI, client service layer. | Phase 2, Phase 3, Phase 4 |
| **Phase 6** | Appointments | Standard | Appointment creation, Client association, date/time scheduling, exact 6 statuses (`Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`), manual confirmation, cancellation reason, rescheduling workflow, auto-creation of pending Attendance, planned procedures. | Agenda/Calendar pages (`/agenda`), appointment modals, reschedule dialog, appointment service. | Phase 2, Phase 3, Phase 5 |
| **Phase 7** | Attendances | 🔴 **HIGH COMPLEXITY** | Attendance lifecycle (`Pendente`, `Realizado`, `Cancelado`), decoupling from Appointment, manual completion trigger, automatic cancellation cascade on appointment cancel/no-show/reschedule, procedure associations, practiced values, explicit discount, linking medical record, product usage, payments. | Attendance workflow pages (`/atendimentos`), attendance detail view, procedure association UI, attendance service. | Phase 2, Phase 3, Phase 6, Phase 8 |
| **Phase 8** | Procedures & Pricing | Standard | Procedure catalog CRUD, standard reference value, estimated duration, active/inactive flag, historical standard-value snapshot, technical Attendance-Procedure association, practiced value input, explicit Attendance discount calculation. | Procedure catalog pages (`/procedimentos`), procedure modals, pricing calculator service. | Phase 2, Phase 3, Phase 7 |
| **Phase 9** | Products & Inventory | 🔴 **HIGH COMPLEXITY** | Product catalog -> Lot -> Individual physical stock unit hierarchy. Reusable vs. single-use flag. Procedure-Product M:N relationship. Product Usage tracking by unit. Same-client reuse allowance; cross-client reuse strict prevention; single-use unit reuse prevention. Usage traceability history. | Inventory pages (`/produtos`), lot & unit management UI, product usage modal, stock validation service. | Phase 2, Phase 3, Phase 7 |
| **Phase 10** | Medical Records (`Prontuário`) | Standard | Attendance 1:1 MedicalRecord. Clinical fields (presentation, clinical observation, actions performed, patient instructions). View/edit controls inside Attendance, consolidated view in Client history. | Prontuário component inside Attendance, medical record service. | Phase 2, Phase 3, Phase 7 |
| **Phase 11** | Attachments | 🔴 **HIGH COMPLEXITY** | Client attachments vs. Attendance attachments. Strict ownership exclusivity (Client OR Attendance, never both, never neither). Profile photo upload & replacement. File storage on local disk outside `public/`. File metadata, upload validation, secure download streaming route. | Attachment service, upload components, attachment list/viewer, security access checks. | Phase 2, Phase 3, Phase 4, Phase 5, Phase 7 |
| **Phase 12** | Payments & Installments | 🔴 **HIGH COMPLEXITY** | Multiple payments per Attendance. Partial payments, signal payments. Multiple payment methods (Credit Card, PIX, etc.). Credit-card installments (store total and count, no reminders). PIX installments (agreed schedule, amounts, due dates). Outstanding balance computation. | Payment modal inside Attendance, installment schedule generator, payment service. | Phase 2, Phase 3, Phase 7 |
| **Phase 13** | Reminders | 🔴 **HIGH COMPLEXITY** | In-app reminder engine. PIX installment due-date reminder generation. Dashboard upcoming/overdue widget. Dedicated `/lembretes` page. Mark done / dismiss actions. Strict decoupling from financial truth (never alters payment status). No credit-card reminders. | Reminder service, `/lembretes` page, dashboard reminder widget. | Phase 2, Phase 3, Phase 12 |
| **Phase 14** | Financial Features | Standard | Attendance financial summary view (practiced values sum, explicit discount, computed total, paid sum, computed outstanding). Financial dashboard overview, date filtering, ledger consistency checks. | Financial dashboard (`/financeiro`), financial summary cards, balance audit service. | Phase 7, Phase 8, Phase 12 |
| **Phase 15** | Client History | Standard | Consolidated history tab on Client detail page derived from real records: Appointments, Attendances, Procedures performed, Product usages, Medical records, Payments, and Attachments. No artificial `ClientHistory` table. | Tabbed client detail history components (`src/app/(app)/clientes/[id]`). | Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11, Phase 12 |
| **Phase 16** | Frontend / UX | Standard | Complete replacement/removal of `src/data/mock`. Brazilian Portuguese labels and terminology across all pages. Radix UI dialogs, responsive layouts, validation messages, loading skeletons, error states, accessibility. | Clean, mock-free UI across all routes (`src/app/(app)/*`), toast notifications (`sonner`). | Phase 4 through Phase 15 |
| **Phase 17** | Validation & Testing | Standard | Automated test suite covering all 24 Critical Validations (§32), decisions D1–D6, scenarios §47 A–E, running against isolated SQL Server LocalDB test database. Service and database level tests. Single command `npm test`. | Vitest/Jest test suites (`tests/**/*.test.ts`), test runner script, test DB fixtures. | Phase 2 through Phase 16 |
| **Phase 18** | Final Review & Stabilization | Standard | Comprehensive audit against `POPOAPP_DEVELOPMENT_SPEC.md` and checklist spec. Verification of zero mock imports, zero false completions, definition of done checklist, resolution of blockers/decisions, final report per §53. | Completed `IMPLEMENTATION_CHECKLIST.md` Final Audit, final completion report. | Phase 1 through Phase 17 |

---

## 4. Enumeration of the 11 Required Sections for `IMPLEMENTATION_CHECKLIST.md`

Per `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` §4:

### 1. Project Status
- High-level overview: Project name, integrity mode (`development`), active tech stack, database status, test suite status, and overall completion health.

### 2. Current Work
- Live working state (updated constantly):
  - Current Phase
  - Current Task
  - Status (`[ ]`, `[~]`, `[x]`, `[!]`, `[?]`)
  - Completed sub-items
  - Remaining sub-items
  - Immediate Next Action
  - Active Blockers / Pending Decisions

### 3. Implementation Phases
- High-level progress tracker of all 18 phases with phase status marker and concise summary of status.

### 4. Detailed Task Checklist
- Granular, decomposed tasks for each of the 18 phases.
- Strict rules:
  - No vague items (e.g., "Implement payments" is forbidden; must be decomposed into atomic tasks).
  - Use ONLY the 5 valid status markers: `[ ]` (Not Started), `[~]` (In Progress), `[x]` (Completed), `[!]` (Blocked), `[?]` (Needs Decision).
  - Explicit 🔴 **HIGH COMPLEXITY** tags for the 6 designated high-complexity areas.

### 5. Dependencies
- Explicit tracking of inter-phase and inter-task dependencies (e.g., Schema -> Domain Services -> UI Forms; Payment models -> PIX installments -> Reminders).

### 6. High-Complexity Work
- Dedicated decomposition and architectural execution plans for the 6 high-complexity areas:
  1. Database / Domain Model
  2. Product Inventory and Individual Unit Traceability
  3. Attendance + Procedure Pricing
  4. Payments and Installments
  5. Attachment / File Management
  6. Reminder System

### 7. Blockers
- Formal registry of blockers:
  - Description
  - Affected Phase / Task
  - Root Cause / Why it is blocked
  - What is needed to resolve
  - Status (Active / Resolved)

### 8. Decisions and Notes
- Architectural decisions, binding user choices (D1–D7), domain interpretations, technical trade-offs, and reasons for implementation choices.

### 9. Testing Status
- Matrix of test coverage across domain areas:
  - Client Tests (CRUD, emergency contacts, profile photo, attachments, CPF)
  - Appointment Tests (creation, status transitions, confirmation, reschedule, attendance link)
  - Attendance Tests (lifecycle, multiple attendances, procedure associations, practiced values, discount, completion, medical record)
  - Inventory Tests (lots, units, single-use, same-client reuse, cross-client prohibition)
  - Payment Tests (multi-method, partial payments, credit card installments, PIX installments, computed balance)
  - Attachment Tests (client vs attendance exclusivity, upload validation, secure streaming)
  - Mapping to all 24 Critical Validations and §47 Examples A–E.

### 10. Change Log
- Chronological, date-stamped log of significant project milestones and architectural completions.

### 11. Final Completion Audit
- Verification checklist covering all 22 domain review items (§19) and comparison against code, migrations, tests, and specs (§20) prior to declaring project completion.

---

## 5. The 24 Critical Business Validations (§32) and Core Scenarios

Every validation below must be enforced server-side/database-level and backed by dedicated automated tests:

| # | Critical Validation | Domain Entity | Rule & Enforcement Mechanism | Test / Verification Strategy |
|---|---|---|---|---|
| **1** | Appointment must belong to exactly one Client | `Appointment` | `clientId` is mandatory, non-nullable foreign key referencing `Client.id`. Rejects creation without a valid client. | Attempt creating Appointment with null or invalid `clientId`; assert validation failure. |
| **2** | Appointment status must be one of the defined statuses | `Appointment` | Status must strictly belong to enum: `Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`. | Pass unrecognized status string; verify schema/service validation error. |
| **3** | `Em atendimento` must NOT exist as an Appointment status | `Appointment` | Explicitly prohibited enum value. Enforced at schema and API levels. | Verify enum definition and API payload validator reject `Em atendimento`. |
| **4** | Rescheduling preserves old appointment as `Reagendado` and creates a new Appointment | `Appointment` | Service executes atomic transaction: old appointment status becomes `Reagendado`, old pending attendance becomes `Cancelado`, new appointment is created with new date/time and its own new pending attendance. Old and new linked via `rescheduledToAppointmentId` / `rescheduledFromAppointmentId`. | Execute reschedule; verify old appointment status is `Reagendado`, new appointment exists, and scheduling history is intact. |
| **5** | Attendance is distinct from its Appointment | `Attendance`, `Appointment` | Separate database models, distinct identifiers, separate lifecycles and business semantics. | Inspect DB schema and query records separately; assert independent entity identities. |
| **6** | An Appointment may have more than one Attendance | `Attendance` | Cardinality is `Appointment 1:N Attendance`. Database foreign key does not impose a 1:1 unique constraint. | Create a second Attendance associated with the same Appointment ID; assert successful persistence. |
| **7** | Attendance must NOT be considered completed merely because Appointment exists | `Attendance` | Attendance defaults to `Pendente`. Completion (`Realizado`) requires an explicit manual completion action when service occurs. | Create Appointment; query Attendance; assert status is `Pendente`, not `Realizado`. |
| **8** | Every Procedure attached to an Attendance must have a practiced value | `AttendanceProcedure` | `practicedValue` is a required, non-nullable decimal on the association record. | Attempt associating a Procedure without `practicedValue`; verify rejection. |
| **9** | Standard procedure value and practiced value must be stored separately | `AttendanceProcedure` | Model contains both `standardValueSnapshot` (catalog value at insertion) and `practicedValue` (actual agreed price). | Add Procedure with catalog price 500 and practiced price 400; verify both distinct columns are stored. |
| **10** | Difference between standard and practiced values must NOT automatically become an Attendance discount | `Attendance`, `AttendanceProcedure` | When practiced < standard, system must NOT auto-populate `discount`. Difference is simply a different practiced value. | Add procedure (catalog R$500, practiced R$400); verify Attendance `discount` remains R$0 and total is R$400 (§47 Example A). |
| **11** | Attendance discount must be explicit | `Attendance` | `discount` is an explicit decimal property on `Attendance`, manually entered by user. | Add two procedures (total practiced R$800) and explicit discount R$100; assert total is R$700 and discount is R$100 (§47 Example B). |
| **12** | Historical procedure values must NOT change when catalog values change | `AttendanceProcedure`, `Procedure` | Association stores `standardValueSnapshot`. Updates to `Procedure.standardValue` do not mutate existing snapshots. | Create Attendance with Procedure (R$500). Update catalog procedure to R$600. Verify existing Attendance snapshot remains R$500. |
| **13** | A Client can have multiple emergency contacts | `Client`, `EmergencyContact` | Relationship is `Client 1:N EmergencyContact`. Minimum fields: name, phone, relationship, observation, isActive. | Create a Client with 2 emergency contacts; query Client; verify both contacts returned. |
| **14** | Attachment belongs to Client OR Attendance, never both and never neither | `Attachment` | Model has nullable `clientId` and `attendanceId`. Database check constraint / service validator enforces XOR condition: `(clientId IS NOT NULL AND attendanceId IS NULL) OR (clientId IS NULL AND attendanceId IS NOT NULL)`. | Direct service/DB call with both IDs or neither ID; verify database constraint rejection. |
| **15** | Specific reusable physical Product unit may be reused by the same Client across Attendances | `ProductUsage`, `IndividualStockUnit` | If `Product.isReusable = true`, multiple `ProductUsage` records may reference the same `unitId` as long as all linked Attendances belong to the same Client. | Client A uses UNIT-001 in Attendance 1 and Attendance 2; verify both usages succeed (§47 Example C). |
| **16** | Same physical Product unit must NEVER be used by another Client | `ProductUsage`, `IndividualStockUnit` | When creating `ProductUsage`, service checks historical usages of `unitId`. If any usage belongs to a different Client ID, transaction aborts with an error. | Client A uses UNIT-001; Client B attempts to use UNIT-001 in another attendance; assert server rejection (§47 Example C). |
| **17** | Single-use products must NOT be reused | `ProductUsage`, `IndividualStockUnit` | If `Product.isReusable = false`, `IndividualStockUnit` cannot have more than 1 `ProductUsage` record. Unit status transitions to `Consumed` upon first use. | Attempt creating a second `ProductUsage` for a single-use unit; assert rejection. |
| **18** | Product Usage must identify an individual physical stock unit | `ProductUsage` | `unitId` is mandatory and non-nullable on `ProductUsage`. Does not track mere aggregate quantities. | Attempt recording product usage without specific `unitId`; verify validation error. |
| **19** | Medical Record is exactly ONE per Attendance | `MedicalRecord`, `Attendance` | Relationship is `Attendance 1:1 MedicalRecord`. Enforced by `@unique` foreign key on `attendanceId`. | Attempt creating a second Medical Record for the same Attendance; assert unique constraint violation. |
| **20** | Attendance may have multiple payments | `Attendance`, `Payment` | Cardinality is `Attendance 1:N Payment`. Supports partial payments across multiple methods. | Record R$300 via Credit Card and R$200 via PIX for an Attendance; verify both payments exist. |
| **21** | Credit-card installments do NOT generate collection reminders | `Payment`, `Reminder` | When payment method is Credit Card, installment count is recorded, but no reminders are created in the reminder engine. | Record a Credit Card payment with 3 installments; assert 0 reminder records created. |
| **22** | PIX installment schedules may generate reminders | `Payment`, `PaymentInstallment`, `Reminder` | PIX installment schedule generates corresponding in-app reminders matching agreed due dates. | Record a PIX plan with 5 monthly installments; verify 5 in-app reminder records created with correct due dates. |
| **23** | Reminder state must NOT replace payment truth | `Reminder`, `Payment` | Marking a reminder `done` or `dismissed` updates only `Reminder.status`; it does NOT update `Payment.status` or alter financial balance. | Mark PIX installment reminder as `done`; verify underlying installment/payment status remains pending and outstanding balance is unchanged. |
| **24** | Historical records must NOT be rewritten by catalog changes | `Attendance`, `ProductUsage`, `Procedure` | Immutability invariant: Modifying procedure names/prices or product definitions in catalogs never cascades into historical attendances or product usages. | Change product name and procedure standard value; query historical attendance; verify historical data unchanged. |

---

## 6. Complete Feature Inventory Table (PROJECT.md Format)

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| **F01** | Client Management | Client Creation & Validation | Registers a new client with contact info and mandatory unique CPF. | `nome`, `cpf`, `telefone`, `email`, `dataNascimento`, `endereco`, `observacoes`, `isActive` | Created `Client` record | Returns 400 if CPF is invalid checksum or duplicate; returns 400 if required fields missing. | ORIGINAL_REQUEST D4, §3, §32 |
| **F02** | Client Management | CPF Normalization & Uniqueness | Validates Brazilian CPF mathematical checksum and stores strictly digits (11 chars). | Raw CPF string (e.g. `123.456.789-01`) | Normalized CPF string (`12345678901`) | Rejects malformed digits; DB unique constraint rejects duplicate CPF. | ORIGINAL_REQUEST D4, Acceptance Criteria |
| **F03** | Client Management | Client Update & Soft Deactivation | Edits client personal/contact details and toggles active status. | `clientId`, updated fields, `isActive` flag | Updated `Client` record | Returns 404 if not found; 400 if CPF modified to invalid/duplicate. | §3, §32, §48 |
| **F04** | Client Management | Emergency Contacts Management | Manages 1:N emergency contacts per client. | `clientId`, `name`, `phone`, `relationship`, `observation`, `isActive` | `EmergencyContact` list / updated record | Rejects missing name/phone; returns 404 if client not found. | §4, §31, §32 |
| **F05** | Client Management | Profile Photo Upload & Replace | Uploads or replaces client profile picture without preserving historical photo revisions. | `clientId`, image file (multipart/form-data) | Updated client profile photo URL/record | Rejects non-image MIME types or files exceeding size limits. | §5, §30, §32 |
| **F06** | Client Management | Client-Level Attachments | Attaches general clinical files (signed terms, test results) strictly to Client. | `clientId`, file, category/notes | `Attachment` record (clientId set, attendanceId null) | Fails if attendanceId is also passed (violates XOR). | §6, §32, §47 Ex E |
| **F07** | Client Management | Client Fast Search & Listing | Lists clients with real-time search by name, CPF, or phone. | Search query string, pagination | Filtered array of `Client` summaries | Empty array if no matches; sanitized against SQL injection. | §40, §41 |
| **F08** | Client History | Consolidated Client History | Derives chronological client clinical history from real domain entities (no duplicate history table). | `clientId` | Aggregated timeline: appointments, attendances, procedures, product usage, records, payments, attachments | Returns 404 if client not found. | §3, §26, §41 |
| **F09** | Appointment Scheduling | Appointment Creation & Auto-Attendance | Schedules an appointment and automatically creates linked `Pendente` Attendance. | `clientId`, `dateTime`, `notes`, `plannedProcedures` | `Appointment` (status `Agendado`) + linked `Attendance` (`Pendente`) | Fails if clientId invalid, date missing, or invalid procedure ID. | ORIGINAL_REQUEST D1, D3, §7, §8 |
| **F10** | Appointment Scheduling | Planned Procedures on Appointment | Associates expected procedures to appointment for duration/cost estimation. | `appointmentId`, `procedureIds` array | Updated `Appointment` with planned procedure links | Fails if procedures inactive or missing. Does NOT associate planned products. | ORIGINAL_REQUEST D3, §7, §18 |
| **F11** | Appointment Scheduling | Manual Confirmation | Professional manually marks appointment as confirmed. | `appointmentId` | `Appointment` status updated to `Confirmado` | Fails if appointment already completed, cancelled, or rescheduled. | §7, §27, §32 |
| **F12** | Appointment Scheduling | Cancellation & Cascade | Cancels appointment with mandatory reason and cascades cancellation to pending Attendance. | `appointmentId`, `cancellationReason` | `Appointment` (`Cancelado`) + linked `Attendance` (`Cancelado`) | Rejects empty cancellation reason. Already completed attendance remains unchanged. | ORIGINAL_REQUEST D1, §7, §8 |
| **F13** | Appointment Scheduling | No-Show Handling | Marks appointment as missed (`Não compareceu`) and cascades pending Attendance to `Cancelado`. | `appointmentId` | `Appointment` (`Não compareceu`) + linked `Attendance` (`Cancelado`) | Cannot mark future appointment as no-show; attendance completed cannot be cancelled. | ORIGINAL_REQUEST D1, §7, §8 |
| **F14** | Appointment Scheduling | Appointment Rescheduling | Marks old appointment `Reagendado`, cancels old pending attendance, creates new appointment and new pending attendance. | `oldAppointmentId`, `newDateTime`, `reason` | Old `Appointment` (`Reagendado`), New `Appointment` (`Agendado`), New `Attendance` (`Pendente`) | Rejects if old appointment not found or new date invalid. Preserves historical linkage. | ORIGINAL_REQUEST D1, §7, §32, §47 Ex D |
| **F15** | Attendance Management | Attendance Lifecycle & Status | Controls attendance lifecycle (`Pendente`, `Realizado`, `Cancelado`). | `attendanceId`, target status | Updated `Attendance` record | Rejects direct transition to `Realizado` on appointment creation. | ORIGINAL_REQUEST D1, §8, §27 |
| **F16** | Attendance Management | Manual Attendance Completion | Completes clinical service when encounter actually happens. | `attendanceId` | `Attendance` status updated to `Realizado`, `completedAt` timestamp set | Fails if attendance is already `Cancelado`. | ORIGINAL_REQUEST D1, §8, §43 |
| **F17** | Attendance Management | Multiple Attendances per Appointment | Associates more than one attendance to the same appointment when needed. | `appointmentId`, initial details | Additional `Attendance` linked to same appointment | Allowed by cardinality `Appointment 1:N Attendance`. Fails if appointment invalid. | §8, §31, §32 |
| **F18** | Procedure Catalog | Procedure Catalog CRUD | Manages procedure catalog with reference values and durations. | `name`, `description`, `standardValue`, `estimatedDuration`, `isActive` | `Procedure` catalog record | Rejects negative price or empty name. | §9, §31, §32 |
| **F19** | Procedure Pricing | Attendance-Procedure Association | Adds procedure to attendance, capturing catalog snapshot and mandatory practiced value. | `attendanceId`, `procedureId`, `practicedValue` | `AttendanceProcedure` record with `standardValueSnapshot` | Rejects missing `practicedValue`. Rejects invalid procedure ID. | §10, §11, §32 |
| **F20** | Procedure Pricing | Independent Practiced Value Entry | Allows practiced value to differ from standard value without auto-discounting. | `attendanceProcedureId`, `practicedValue` | Updated `AttendanceProcedure.practicedValue` | Preserves both values independently. Rejects negative values. | ORIGINAL_REQUEST D2, §11, §32, §47 Ex A |
| **F21** | Financial Composition | Explicit Attendance Discount | Applies an explicit discount directly to the overall attendance. | `attendanceId`, `discountAmount` | Updated `Attendance.discount` | Rejects negative discount or discount exceeding procedure practiced sum. | ORIGINAL_REQUEST D2, §12, §32, §47 Ex B |
| **F22** | Financial Composition | Dynamic Total & Balance Computation | Computes total ($= \sum \text{practiced} - \text{discount}$) and outstanding balance ($= \text{total} - \sum \text{paid}$) on the fly. | `attendanceId` | Computed financial summary object | Throws if attendance not found. Consistent with payments. | ORIGINAL_REQUEST D2, §13, §25, §35 |
| **F23** | Inventory Management | Product Catalog & Reuse Classification | Manages product catalog with `isReusable` flag (reusable vs single-use). | `name`, `description`, `isReusable`, `isActive` | `Product` catalog record | Rejects empty name or missing classification. | §14, §15, §32 |
| **F24** | Inventory Management | Lot Management | Tracks product batches with expiration date and batch code. | `productId`, `lotNumber`, `expirationDate` | `Lot` record | Rejects past expiration date on creation; rejects empty lot number. | §14, §31 |
| **F25** | Inventory Management | Individual Physical Stock Units | Creates traceable physical units under a lot with unique identifiers. | `lotId`, unit identifiers / barcodes | `IndividualStockUnit` records (status: `Available`, `InUse`, `Consumed`, etc.) | Rejects duplicate unit identifiers within system. | §14, §31, §32 |
| **F26** | Inventory Management | Procedure-Product Relationship | Defines many-to-many catalog relationship of expected products per procedure. | `procedureId`, `productId` | Catalog association record | Useful for planned info; does not represent physical usage. | §17, §31 |
| **F27** | Inventory Traceability | Product Usage Recording | Records actual usage of an individual physical unit in an attendance. | `attendanceId`, `individualStockUnitId`, `procedureAssociationId?`, `notes` | `ProductUsage` record | Fails if unit not found or already consumed/incompatible. | §16, §32, §44 |
| **F28** | Inventory Traceability | Same-Client Reusable Unit Reuse | Allows a reusable unit to be used across multiple attendances for the same client. | `attendanceId`, `individualStockUnitId` (where `isReusable = true`) | Created `ProductUsage` | Allowed only if all prior usages of unit belong to same client. | §15, §32, §47 Ex C |
| **F29** | Inventory Traceability | Cross-Client Reuse Prevention Guard | Strictly rejects any attempt to use a physical unit for Client B if previously used by Client A. | `attendanceId` (Client B), `individualStockUnitId` (used by Client A) | Server 400 / Domain Exception | Rejection with Portuguese error: "Unidade já utilizada por outro cliente." | §15, §32, §47 Ex C |
| **F30** | Inventory Traceability | Single-Use Product Reuse Prevention | Rejects any secondary usage of a single-use physical unit. | `attendanceId`, `individualStockUnitId` (where `isReusable = false`) | Server 400 / Domain Exception | Rejection with Portuguese error: "Produto descartável de uso único." | §15, §32 |
| **F31** | Clinical Documentation | Medical Record (`Prontuário`) | Creates or updates exactly one clinical medical record per attendance. | `attendanceId`, clinical text: `queixaPrincipal`, `exameFisico`, `conduta`, `orientacoes` | `MedicalRecord` record | DB unique constraint rejects duplicate medical record on same attendance. | §19, §31, §32 |
| **F32** | Attachment Security | Attendance-Level Attachments | Attaches service-specific files (encounter photos, diagrams) strictly to Attendance. | `attendanceId`, file, notes | `Attachment` record (attendanceId set, clientId null) | Fails if clientId is also set (violates XOR). | §6, §32, §47 Ex E |
| **F33** | Attachment Security | Local Secure Storage & Streaming | Stores files on local disk outside `public/` and serves via authenticated streaming route. | `attachmentId`, session cookie | Streamed binary file response with proper MIME headers | Returns 401 if unauthenticated; returns 404 if file missing; rejects public URL guessing. | ORIGINAL_REQUEST D6, §6, §39 |
| **F34** | Attachment Security | Upload Validation Guard | Enforces MIME validation, file extension checks, and maximum size restrictions. | Upload file payload | Sanitized file metadata + stored disk path | Rejects executable files, unauthorized MIME types, or oversized files. | §6, §39, §49 |
| **F35** | Payments & Billing | Multi-Method Attendance Payments | Records multiple partial payments per attendance across different payment methods. | `attendanceId`, `amount`, `method`, `paymentDate`, `notes` | `Payment` record | Rejects zero or negative amount; rejects unrecognized payment method. | §20, §21, §32 |
| **F36** | Payments & Billing | Credit Card Installments | Records credit card payment with installment count without generating collection reminders. | `attendanceId`, `amount`, `method = 'CREDIT_CARD'`, `installmentCount` | `Payment` record with installment count | Rejects installment count < 1. Does NOT generate reminders. | ORIGINAL_REQUEST D5, §22, §32 |
| **F37** | Payments & Billing | PIX Installment Scheduling | Establishes agreed PIX installment plan with scheduled due dates and amounts. | `attendanceId`, `totalAmount`, `installmentCount`, `dueDayOfMonth` | `PaymentInstallment` schedule records | Rejects invalid due day or installment count. | §23, §32, §45 |
| **F38** | In-App Reminders | PIX Installment Due Reminders | Generates in-app reminders for agreed PIX installment due dates. | PIX installment schedule records | `Reminder` records linked to installment | Deduplicated; safe to regenerate without duplicate notifications. | ORIGINAL_REQUEST D5, §23, §24, §46 |
| **F39** | In-App Reminders | Reminder Status & Financial Decoupling | Allows marking reminders `done` or `dismissed` without changing payment status or balance. | `reminderId`, target action (`done` / `dismissed`) | Updated `Reminder.status` | Does NOT mutate `Payment` or `PaymentInstallment` status. | ORIGINAL_REQUEST D5, §23, §32 |
| **F40** | In-App Reminders | In-App Reminder Dashboard Widget | Displays upcoming and overdue PIX installment reminders on dashboard and `/lembretes`. | Current date, filter | Active reminder cards with client and value info | No external email/WhatsApp triggered. | ORIGINAL_REQUEST D5, §24, §46 |
| **F41** | Authentication & Access | iron-session Login & Session Guard | Protects application with session login, bcrypt hashing, and authenticated route guards. | `nickname`, `password` | Encrypted session cookie | Returns 401 on invalid credentials; redirects unauthenticated users to `/login`. | ORIGINAL_REQUEST R3, §29, §39 |
| **F42** | Database & Seeds | Realistic Seed Data Generator | Seeds system with realistic Brazilian aesthetic clinical data exercising all domain rules. | Seed command (`npm run db:seed`) | Populated database with clients, lots, attendances, PIX plans, etc. | Idempotent; clears or safely populates development database per §50. | §50, Acceptance Criteria |

---

## 7. Edge Cases Specification Table

| # | Feature | Input / Condition | Expected & Observed Behavior |
|---|---|---|---|
| **E01** | Client CPF Validation | CPF with valid formatting but invalid verification check digits (e.g. `111.444.777-05`). | Rejected server-side with validation error: "CPF inválido." Record not saved. |
| **E02** | Client CPF Uniqueness | Attempting to create Client B with the same CPF as existing Client A (e.g. `12345678901`). | Rejected server-side and by database unique constraint with error: "CPF já cadastrado." |
| **E03** | Client CPF Storage Normalization | Input CPF entered with punctuation: `123.456.789-00`. | Normalized to pure digits string `12345678900` prior to persistence. |
| **E04** | Attachment Ownership Constraint | Attachment payload providing both `clientId` and `attendanceId` simultaneously. | Rejected server-side and by database check constraint: Attachment must belong to Client OR Attendance, never both. |
| **E05** | Attachment Ownership Constraint | Attachment payload providing neither `clientId` nor `attendanceId`. | Rejected server-side and by database check constraint: Attachment must belong to either Client or Attendance. |
| **E06** | Appointment Status Enum | Attempting to assign status `Em atendimento` to an Appointment. | Rejected immediately by schema enum and API validation. `Em atendimento` is strictly prohibited. |
| **E07** | Reschedule Scheduling Cascade | Rescheduling an Appointment with status `Agendado` and pending Attendance. | Old Appointment becomes `Reagendado`. Old pending Attendance becomes `Cancelado`. New Appointment is created as `Agendado`. New pending Attendance is created as `Pendente`. Historical linkage preserved. |
| **E08** | Practiced Value vs. Standard Value | Procedure added with catalog Standard R$500 and Practiced R$400, no explicit discount. | Practiced value saved as R$400, Standard snapshot saved as R$500. Attendance discount remains R$0. Total is R$400. R$100 is NOT labeled as discount (§47 Ex A). |
| **E09** | Explicit Attendance Discount | Two procedures with practiced values R$500 and R$300 (sum R$800), explicit discount R$100. | Computed Total is R$700 ($800 - 100$). Financial summary explicitly displays R$100 as discount (§47 Ex B). |
| **E10** | Reusable Stock Unit Same-Client | Physical unit `UNIT-001` (reusable) used for Client A in Attendance 1, then used again for Client A in Attendance 2. | Allowed. Both usages recorded in `ProductUsage` for Client A (§47 Ex C). |
| **E11** | Reusable Stock Unit Cross-Client | Physical unit `UNIT-001` (reusable) previously used for Client A, now attempted for Client B in Attendance 3. | Strictly rejected server-side and in transaction: "Esta unidade física já foi utilizada por outro cliente e não pode ser compartilhada." |
| **E12** | Single-Use Stock Unit Reuse | Physical unit `UNIT-002` (`isReusable = false`) previously used in Attendance 1, attempted in Attendance 2. | Strictly rejected: "Unidade descartável de uso único já consumida." |
| **E13** | Medical Record Cardinality | Attempting to create a second `MedicalRecord` for an Attendance that already has one. | Rejected by database `@unique` constraint on `attendanceId`. Replaces/updates existing record instead. |
| **E14** | Credit Card Installments & Reminders | Recording Credit Card payment with 6 installments. | Payment saved with `installmentCount = 6`. Zero reminder entries created in Reminder engine. |
| **E15** | PIX Installment Due Reminders | Recording PIX payment schedule with 3 monthly installments. | Creates 3 in-app reminder entries corresponding to agreed due dates in dashboard/lembretes. |
| **E16** | Reminder Dismissal Decoupling | User clicks "Concluir" or "Dispensar" on a PIX installment reminder. | Reminder status updates to `done` / `dismissed`. Underlying `Payment` and `PaymentInstallment` status remain unchanged (e.g. `Pendente`). Outstanding balance unaffected. |
| **E17** | Procedure Catalog Price Mutation | Changing catalog price of "Botox" from R$500 to R$600 after Attendances exist. | Existing historical `AttendanceProcedure.standardValueSnapshot` remains R$500. Historical totals unchanged. |
| **E18** | Unauthenticated File Download Route | Direct HTTP GET to `/api/attachments/[id]` without a valid iron-session cookie. | Returns HTTP 401 Unauthorized. File content is never served. |
| **E19** | Outstanding Balance with Partial Payments | Attendance with Total R$1,000. Payment 1 (Credit Card): R$400 paid. Payment 2 (PIX): R$300 pending. | Paid sum is R$400. Outstanding balance is computed as R$600 ($1,000 - 400$). Pending payment is not counted as paid. |
| **E20** | Appointment Cascade to Completed Attendance | Appointment is marked `Cancelado` after its Attendance was already manually marked `Realizado`. | Completed Attendance (`Realizado`) is preserved as `Realizado` and not overwritten, because clinical encounter actually occurred. |

---

## 8. Relational Entity Structure & Cardinalities (§31)

```
[User] (1 professional)

[Client] ──1:N──> [EmergencyContact]
[Client] ──1:N──> [Attachment] (exclusive: clientId != null, attendanceId == null)
[Client] ──1:N──> [Appointment]
[Client] ──1:N──> [ProfilePhoto] (special client attachment)

[Appointment] ──1:N──> [PlannedProcedure] (catalog reference only)
[Appointment] ──1:N──> [Attendance] (distinct lifecycle)
[Appointment] ──0:1──> [Appointment] (rescheduledTo / rescheduledFrom)

[Attendance] ──1:1──> [MedicalRecord] (Prontuário)
[Attendance] ──1:N──> [AttendanceProcedure] (technical line-item association)
[Attendance] ──1:N──> [Attachment] (exclusive: attendanceId != null, clientId == null)
[Attendance] ──1:N──> [ProductUsage]
[Attendance] ──1:N──> [Payment]

[Procedure] ──1:N──> [AttendanceProcedure] (stores snapshot & practiced value)
[Procedure] ──N:N──> [Product] (catalog association)

[Product] ──1:N──> [Lot]
[Lot] ──1:N──> [IndividualStockUnit]
[IndividualStockUnit] ──1:N──> [ProductUsage] (subject to reuse rules)

[Payment] ──1:N──> [PaymentInstallment] (for PIX schedules)
[PaymentInstallment] ──1:N──> [Reminder] (in-app only)
```

---

## 9. Verification & Acceptance Criteria Summary

1. **Build and Run Integrity**:
   - `npm install` clean
   - `npx prisma migrate dev` / `deploy` applies cleanly to fresh SQL Server LocalDB
   - `npm run db:seed` executes successfully without errors
   - `npm run build` succeeds with zero TypeScript / compilation errors
   - `npm run lint` succeeds with zero errors
   - No mock data imports anywhere in `src/app`
2. **Automated Test Suite**:
   - Single command `npm test` runs full automated suite against separate test DB
   - All 24 Critical Validations (§32) verified with failing tests if removed
   - All 5 Data Integrity Examples (§47 A–E) verified with exact test values
   - Decisions D1–D6 verified with server-side and DB tests
3. **Checklist & Audit Integrity**:
   - `IMPLEMENTATION_CHECKLIST.md` contains all 11 sections, 18 phases, only 5 allowed status markers, and 🔴 markings
   - Zero false completions (`[x]` items are backed by code and passing tests)
   - Final Completion Audit (§§19–20) completed honestly
