# Project: PopoApp

## Architecture
PopoApp is an aesthetic clinic management system built with Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI, iron-session, and Prisma ORM on Microsoft SQL Server LocalDB.
The architecture enforces strict layered boundaries:
- **Data Layer (Prisma on SQL Server LocalDB)**: 18 domain entities, strong relational constraints, SQL Server `CK_Attachment_Ownership` CHECK constraint, decimal precisions, string-based enums with service-level union validation.
- **Service Layer (`src/services/`)**: Pure business logic encapsulating all 24 Critical Validations (§32), lifecycle state machines (D1), dynamic financial calculations (D2: total and outstanding computed, never stored), inventory tracking (reusable vs single-use units), and security boundaries.
- **API Layer (`src/app/api/`)**: Next.js route handlers performing session validation, Zod request validation, delegating to domain services, and returning structured JSON or streaming authenticated files.
- **Presentation Layer (`src/app/(authenticated)/`)**: React Server & Client Components rendered in Brazilian Portuguese (pt-BR), consuming real API endpoints, providing responsive clinical workflows, forms, and dialogs.
- **Storage Layer (`./storage/uploads/`)**: Authenticated local disk storage outside the web root (`public/`), files named with UUIDs, streaming access guarded by iron-session and ownership checks.
- **Testing Track (`tests/`)**: Automated test suite executing on an isolated SQL Server LocalDB database (`PopoAppTest`), covering Tiers 1–4 without mocks.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Tooling & Linting | ESLint configuration, TypeScript compilation, Vitest test runner setup | M1 | Survey / Baseline |
| F02 | User & Authentication Data Model | Prisma User model, passwordHash, active state, session support | M1 | Dev Spec §3 / §31 |
| F03 | Client & Emergency Contact Data Model | Client entity with mandatory, unique CPF, Contact, and Emergency Contacts | M1 | Dev Spec §4 / §31 |
| F04 | Appointment & Attendance Relational Model | Appointment (6 statuses) and Attendance (3 lifecycles, D1) with 1:N cardinality | M1 | Dev Spec §7, §8 / §31 |
| F05 | Procedure & Technical Association Model | Procedure with standard value; Attendance-Procedure link with practiced value and snapshot | M1 | Dev Spec §9, §10, §11 / §31 |
| F06 | Product, Lot & Stock Unit Relational Model | Product, Lot, IndividualStockUnit, and ProductUsage relational hierarchy | M1 | Dev Spec §13–§17 / §31 |
| F07 | Medical Record Data Model | Prontuário model exactly 1:1 with Attendance | M1 | Dev Spec §19 / §31 |
| F08 | Attachment Relational Model & SQL CHECK Constraint | Attachment entity with SQL Server CHECK constraint ensuring Client XOR Attendance exclusivity | M1 | Dev Spec §6 / §31, AC 61 |
| F09 | Financial Payment Data Model | Payment entity, payment methods, installments count, dynamic references | M1 | Dev Spec §20–§24 / §31 |
| F10 | Reminder Data Model | Reminder entity with trigger date, message, resolved status, in-app scope | M1 | Dev Spec §25 / §31 |
| F11 | Database Migrations & SQL Server LocalDB Setup | Initial Prisma migration establishing all tables and constraints on LocalDB | M1 | D7 / Dev Spec §30 |
| F12 | Authenticated Session & Bcrypt Authentication | Real user authentication against Prisma database with bcrypt verification | M2 | Dev Spec §3 / §29 |
| F13 | Client Management Service & Validations | CRUD with mandatory CPF, valid checksum, unique CPF, emergency contacts | M2 | Dev Spec §4 / §32 (V01, V02, V03) |
| F14 | Procedure Catalog Service & Validations | CRUD for aesthetic procedures, active flag, positive standard values | M2 | Dev Spec §9 / §32 (V06, V07) |
| F15 | Secure File Storage Engine | Disk write outside web root, UUID naming, MIME validation, 10MB limit | M2 | D6 / Dev Spec §6, §32 (V12, V13) |
| F16 | Authenticated File Streaming API | Route `/api/attachments/[id]` streaming files with auth and ownership checks | M2 | D6 / Dev Spec §6, AC 60 |
| F17 | Appointment Scheduling Service & Lifecycle | 6 statuses (Agendado, Confirmado, Concluído, Cancelado, Não compareceu, Reagendado) | M3 | Dev Spec §7 / §32 (V08) |
| F18 | Attendance Service & D1 State Machine | Auto-creates pending Attendance; updates to Realizado on completion; cancels on appt cancel/reschedule | M3 | D1 / Dev Spec §8, §32 (V09) |
| F19 | Planned vs Actual Procedures Management | Separate planned procedures from actual performed procedures | M3 | D3 / Dev Spec §8, §10 |
| F20 | Product Inventory & Lot Management Service | Product catalog, lots with expiration dates, stock unit generation | M3 | Dev Spec §13, §14 / §32 (V15) |
| F21 | Individual Stock Unit Tracking & Usage Service | Same-client reuse of reusable units; cross-client reuse strictly blocked; single-use non-reusable | M3 | Dev Spec §15, §16 / §32 (V16, V17, V18) |
| F22 | Medical Record (Prontuário) Service | 1:1 creation and retrieval linked to Attendance | M3 | Dev Spec §19 / §32 (V19) |
| F23 | Attendance Pricing & Financial Service | Practiced value independent of standard value; snapshot standard value; explicit discount | M4 | D2 / Dev Spec §10–§12 / §32 (V10, V11) |
| F24 | Dynamic Financial Calculations | Total = sum(practicedValue) - discount; Outstanding = Total - sum(paid); dynamic calculation | M4 | D2 / Dev Spec §20 / §32 (V20) |
| F25 | Payment Processing Service & Installments | Register payments, support payment methods, card installments (stored count, zero reminders) | M4 | Dev Spec §21–§24 / §32 (V21, V22) |
| F26 | In-App Reminder Service | In-app reminders, dashboard feed, manual resolution toggle; no external delivery | M4 | D5 / Dev Spec §25 / §32 (V23, V24) |
| F27 | Dashboard Metrics & Aggregation Engine | Aggregates daily/weekly/monthly revenue, attendance counts, low stock alerts, pending reminders | M4 | Dev Spec §26 |
| F28 | Comprehensive Clinical Seed Data | Seed script creating full clinical workflow covering Examples A–E | M5 | Dev Spec §50 |
| F29 | pt-BR Client UI (List, Create, Edit, [id] Detail) | Client screens with Brazilian Portuguese text, CPF mask/validation, emergency contacts, history tabs | M5 | R4 / Dev Spec §28 |
| F30 | pt-BR Agenda UI (Day/Week/Month, Scheduling) | Calendar view, appointment modals, 6 status badges, D1 transitions | M5 | R4 / Dev Spec §28 |
| F31 | pt-BR Attendance UI & [id] Clinical Workspace | Attendance execution workspace: procedures, stock usage, clinical notes, financial breakdown | M5 | R4 / Dev Spec §28 |
| F32 | pt-BR Procedure Catalog UI | Procedure listing, pricing modal, category filters | M5 | R4 / Dev Spec §28 |
| F33 | pt-BR Product & Stock UI | Product catalog, lot intake, unit barcode/identifier list, usage history | M5 | R4 / Dev Spec §28 |
| F34 | pt-BR Financial Dashboard & Payments UI | Accounts receivable, payment registration modal, installment breakdown, cash flow | M5 | R4 / Dev Spec §28 |
| F35 | pt-BR Reminders UI & Dashboard Widget | Reminders page with status toggles, dashboard alert widget | M5 | R4 / Dev Spec §28 |
| F36 | pt-BR Navigation, Layout & Error Feedback | Header, sidebar, toasts, error messages in Portuguese | M5 | R4 / Dev Spec §28 |
| F37 | Test Runner Infrastructure Setup | Vitest installed, `.env.test` configured for `PopoAppTest`, test DB helper scripts | Test Track | D7 / Dev Spec §49 |
| F38 | Tier 1: Feature Coverage Test Suite | >=5 tests per core feature across all domain entities | Test Track | Project Pattern Tier 1 |
| F39 | Tier 2: Boundary & Corner Cases Test Suite | Tests for CPF edges, decimal precisions, stock boundaries, attachment XOR constraint AC 61 | Test Track | Project Pattern Tier 2 |
| F40 | Tier 3: Cross-Feature Combination Tests | State machine transitions, appointment-attendance-payment interactions, stock-client reuse | Test Track | Project Pattern Tier 3 |
| F41 | Tier 4: Real-World Clinical Workflows | End-to-end clinical scenarios A through E (§47) verified against live test DB | Test Track | Project Pattern Tier 4 |
| F42 | Tier 5: Adversarial Coverage Hardening | White-box adversarial testing, edge conditions, concurrency checks | M6 (Phase 2) | Project Pattern Tier 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Tooling & Database Schema | Phases 1 & 2: ESLint, Vitest, 18 Prisma domain models, SQL Server LocalDB migrations, Attachment XOR CHECK constraint | none | COMPLETED (commit `dc33eb9`) |
| M2 | Security, Core Entities & Catalog | Phases 3, 4, 5, 11: Bcrypt auth, Client service + CPF, Procedure catalog, Authenticated file storage pipeline | M1 | COMPLETED (Gate PASSED, commit `5a17482`) |
| M3 | Clinical Workflows, Products & Inventory | Phases 6, 7, 9, 10: Appointments (6 statuses), Attendance (D1), Inventory & Unit Traceability (reuse rules), Medical Records | M2 | COMPLETED (Backend verified, test suites pass) |
| M4 | Financial Engine, Pricing & Reminders | Phases 8, 12, 13, 14: Practiced values, dynamic Total/Outstanding (D2), Payments, Card Installments, In-app reminders, Dashboard metrics | M3 | IN_PROGRESS (Backend & test suites verified against LocalDB) |
| M5 | Brazilian Portuguese UI Integration & Seed Data | Phases 15 & 16: Seed script (Examples A–E), complete pt-BR UI screens, client detail [id], attendance workspace [id], real API integration | M4 | PLANNED |
| M6 | Validation Engine & E2E Testing Verification | Phase 17: Implementation track passes 100% of E2E test suite (Tiers 1–4) + Tier 5 Adversarial Coverage Hardening | M5, TEST_READY | PLANNED |
| M7 | Final Completion Audit & Acceptance Verification | Phase 18: Audit against 22 checklist items, 24 critical validations, D1–D7, R1–R5, and final signoff | M6 | PLANNED |

## Resumption Protocol & Baseline Snapshot
- **Current Verified Baseline Commit**: `dc33eb9bd4b8086a127e1f016cb7fcae47667a9b`
- **Database Status**: Microsoft SQL Server LocalDB `MSSQLLocalDB` provisioned with `PopoApp` (dev) and `PopoAppTest` (isolated test). Migration `20261006000000_init_domain_models` applied to both. `CK_Attachment_Ownership` CHECK constraint verified in engine.
- **Protocol Bridge (Dev/Test Only)**: `tests/helpers/localdb-proxy.js` bridges TCP 1433 to LocalDB Named Pipes (`npm run db:proxy`).
- **Test Baseline**: 15 test files, 89 tests passing (100% pass rate) via `npm test`.
- **Code Quality**: `npm run lint` (0 errors), `npm run build` (17/17 pages generated cleanly).
- **Quick Resumption Commands**:
  1. `sqllocaldb start MSSQLLocalDB`
  2. `npm run db:proxy` (in background terminal if port 1433 is not already open)
  3. `npm test` (verify 89 passing tests)
  4. `npm run lint` && `npm run build` (verify clean build)
- **Next Development Focus**:
  - **Option A (Milestone 2 UI)**: Replace mock data in `src/app/(authenticated)/clientes/page.tsx`, create `/clientes/[id]` clinical detail page, replace mock data in `src/app/(authenticated)/procedimentos/page.tsx`, add attachment upload/gallery components.
  - **Option B (Milestone 3 Clinical Domain)**: Implement `AppointmentService` (6 statuses, rescheduling cascade per D1), `AttendanceService` (D1 state machine, procedure pricing per D2), `ProductService` (stock unit traceability, reusable vs single-use rules V16–V18), `MedicalRecordService` (1:1 with Attendance).



## Interface Contracts
### Client Service ↔ Appointment Service
- `getClient(id: string): Promise<Client | null>`
- `validateClientActive(id: string): Promise<boolean>`

### Appointment Service ↔ Attendance Service (D1 State Machine)
- `createAppointment(data: CreateAppointmentInput): Promise<{ appointment: Appointment, attendance: Attendance }>`
- `updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment>`
  - If status becomes `Cancelado`, `Não compareceu`, or `Reagendado`, pending attendance status is set to `Cancelado`.
  - If status becomes `Concluído`, attendance must already be `Realizado`.

### Attendance Service ↔ Financial Engine (D2)
- `getAttendanceFinancials(attendanceId: string): Promise<{ standardTotal: Decimal, practicedTotal: Decimal, explicitDiscount: Decimal, netTotal: Decimal, paidTotal: Decimal, outstandingBalance: Decimal, isFullyPaid: boolean }>`

### Product Inventory ↔ Clinical Usage
- `consumeStockUnit(unitId: string, attendanceId: string, clientId: string): Promise<ProductUsage>`
  - Enforces: if unit is single-use, it cannot be consumed again.
  - Enforces: if unit is reusable, it can only be reused if previous usages belong to the same `clientId`.

### Attachment Service ↔ Storage Engine
- `saveAttachment(file: Buffer, metadata: { originalName: string, mimeType: string, sizeBytes: number, clientId?: string, attendanceId?: string }): Promise<Attachment>`
  - Enforces: exactly one of `clientId` or `attendanceId` must be non-null.

## Code Layout
- `prisma/`: `schema.prisma`, `migrations/`, `seed.ts`
- `src/services/`: Domain service layer (`client.service.ts`, `appointment.service.ts`, `attendance.service.ts`, `procedure.service.ts`, `product.service.ts`, `financial.service.ts`, `attachment.service.ts`, `reminder.service.ts`, `auth.service.ts`)
- `src/lib/`: Shared utilities, database client (`db.ts` / `prisma.ts`), session (`session.ts`), CPF validator (`cpf.ts`), currency formatter (`formatters.ts`)
- `src/types/`: Domain TypeScript types and Zod schemas (`domain.ts`, `validations.ts`)
- `src/app/api/`: API route handlers (`/api/auth/*`, `/api/clients/*`, `/api/appointments/*`, `/api/attendances/*`, `/api/procedures/*`, `/api/products/*`, `/api/financial/*`, `/api/attachments/*`, `/api/reminders/*`, `/api/dashboard/*`)
- `src/app/(authenticated)/`: pt-BR UI pages (`agenda/`, `clientes/`, `atendimentos/`, `procedimentos/`, `produtos/`, `financeiro/`, `lembretes/`, `page.tsx`)
- `src/components/`: Reusable Radix/Tailwind components and domain-specific dialogs/forms
- `storage/uploads/`: Authenticated file storage root (outside `public/`, ignored in git)
- `tests/`: Automated test suite (`unit/`, `integration/`, `e2e/`, `helpers/`)
