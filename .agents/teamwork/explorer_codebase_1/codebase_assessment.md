# PopoApp — Comprehensive Codebase Assessment Report

**Date:** 2026-10-06  
**Investigator:** Codebase Explorer 1  
**Project Root:** `c:\Users\Vinicius\PopoApp\PopoApp`  
**Reference Specs:**  
- `POPOAPP_DEVELOPMENT_SPEC.md`
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
- `.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

PopoApp is currently an **early-stage UI prototype skeleton** built on Next.js 15 (App Router), React 19, TypeScript 5.6, Tailwind CSS 3.4, Radix UI primitives, iron-session 8, and Prisma 6 targeting SQL Server LocalDB.

### Current Reality vs. Required Target
| Area | Current State | Target Specification Requirement | Gap Level |
|---|---|---|---|
| **Database & Schema** | Only `User` entity in `schema.prisma`. No migrations exist (`prisma/migrations/` is absent). Seed only inserts admin user. | 13+ domain models (Client, EmergencyContact, Appointment, Attendance, Procedure, AttendanceProcedure, Product, Lot, IndividualStockUnit, ProductUsage, MedicalRecord, Attachment, Payment, PaymentSchedule, Reminder), constraints, migrations, realistic seed data (§31, §50). | 🔴 Critical |
| **Backend Services & APIs** | Only `/api/auth/login` and `/api/auth/logout`. Even `auth.service.ts` has hardcoded admin credentials bypassing Prisma/bcrypt. | Robust domain service layer for Clients, Appointments, Attendances, Procedures, Inventory/Stock units, Medical Records, Payments/Installments, Reminders, and Attachments (§37). REST/Server action routes with validation. | 🔴 Critical |
| **Data Integrity & Validations** | None. Pure mock data in memory/files. | 24 critical business rules (§32) + 7 binding decisions (D1–D7) enforced at database and server service level. | 🔴 Critical |
| **Frontend UI Pages** | 8 authenticated pages render static data from `src/data/mock/*`. Action buttons have no handlers or close dialogs without mutating state. Missing `/clientes/[id]` and `/atendimentos/[id]`. | Fully functional CRUD/workflows for all 8 domains connected to real APIs. Dedicated Client Detail page with tabs (§41) and Attendance clinical workspace (§43). Zero imports from mock data. | 🔴 Critical |
| **File Storage** | None. No upload/download endpoints or storage directory. | Local disk storage outside public folder, authenticated streaming download route, MIME/size validation (D6, §6, §39). | 🔴 Critical |
| **Test Suite & Harness** | No test runner installed. Zero test files. No `npm test` script. | Complete automated test suite covering all 24 critical validations, D1–D6, and §47 scenarios A–E against a dedicated test database (D7, §49). | 🔴 Critical |
| **Tooling & Linter** | `npm run lint` fails because no `.eslintrc*` exists (interactive configuration prompt). | Configured ESLint and zero lint/type errors. | 🟡 High |
| **UI Components & Themes** | Radix UI primitives, Tailwind layout, pastel theme selector (6 palettes) implemented and working. | Retain and extend for full forms and detail views. | 🟢 Good |

---

## 2. Directory Layout & Repository Architecture

### 2.1 File Tree (Relevant Paths)
```
PopoApp/
├── .agents/
│   └── teamwork/
│       ├── ORIGINAL_REQUEST.md
│       ├── orchestrator_1/
│       └── explorer_codebase_1/
├── .env                              # Prisma DATABASE_URL (PopoApp on MSSQLLocalDB)
├── .env.example
├── .env.local                        # Next.js DATABASE_URL, SESSION_SECRET, NODE_ENV
├── next.config.ts                    # reactStrictMode: true
├── package.json                      # Next 15, React 19, Prisma 6, Tailwind 3, Radix UI
├── prisma/
│   ├── schema.prisma                 # ONLY User model!
│   └── seed.ts                       # Upserts admin user only
├── src/
│   ├── app/
│   │   ├── (authenticated)/
│   │   │   ├── agenda/page.tsx       # Mock calendar (mes/semana/dia)
│   │   │   ├── atendimentos/page.tsx # Mock table
│   │   │   ├── clientes/page.tsx     # Mock table + empty create dialog
│   │   │   ├── financeiro/page.tsx   # Generic ledger mock table
│   │   │   ├── layout.tsx            # Header + Sidebar + ThemeSelector wrapper
│   │   │   ├── lembretes/page.tsx    # Mock reminder cards
│   │   │   ├── page.tsx              # Dashboard (mock stats, mock shortcuts)
│   │   │   ├── procedimentos/page.tsx# Mock card list
│   │   │   └── produtos/page.tsx     # Mock aggregate stock table
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── login/route.ts    # POST /api/auth/login
│   │   │       └── logout/route.ts   # POST /api/auth/logout
│   │   ├── globals.css               # Pastel theme tokens (6 themes)
│   │   ├── layout.tsx                # Root layout with ThemeProvider & Toaster
│   │   ├── login/page.tsx            # Functional login form
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── layout/                   # Header, Sidebar, ThemeSelector, ThemeProvider
│   │   ├── shared/                   # EmptyState, LoadingSkeleton, PageHeader, SearchInput, StatCard, StatusBadge
│   │   └── ui/                       # 18 Radix/Tailwind components (alert-dialog, dialog, select, table, tabs, etc.)
│   ├── data/
│   │   └── mock/                     # 8 mock data files (agenda, atendimentos, clientes, dashboard, financeiro, etc.)
│   ├── i18n/
│   │   └── pt-BR.ts                  # Localization dictionary
│   ├── lib/
│   │   ├── format.ts                 # formatCurrency, formatDate, formatPhone, etc.
│   │   ├── prisma.ts                 # PrismaClient singleton
│   │   ├── session.ts                # iron-session wrapper and getSession()
│   │   └── utils.ts                  # cn() classnames helper
│   ├── middleware.ts                 # Session cookie existence check
│   ├── schemas/
│   │   └── auth.ts                   # loginSchema (Zod)
│   ├── services/
│   │   └── auth.service.ts           # validateCredentials (HARDCODED mock!)
│   └── types/
│       └── index.ts                  # Mock interfaces and types
├── tailwind.config.ts
└── tsconfig.json
```

### 2.2 Existing Dependencies Analysis (`package.json`)
- **Runtime:**
  - `next`: `^15.0.0`
  - `react`: `^19.0.0`, `react-dom`: `^19.0.0`
  - `@prisma/client`: `^6.0.0`
  - `iron-session`: `^8.0.3`
  - `bcrypt`: `^5.1.1`
  - `zod`: `^3.23.8`
  - `react-hook-form`: `^7.53.0`, `@hookform/resolvers`: `^3.9.0`
  - `date-fns`: `^4.1.0`
  - `lucide-react`: `^0.460.0`
  - `framer-motion`: `^11.3.31`
  - `sonner`: `^1.5.0`
  - Radix UI: dialog, alert-dialog, avatar, badge, dropdown-menu, label, scroll-area, select, separator, slot, tabs, tooltip.
- **Dev Dependencies:**
  - `typescript`: `^5.6.0`, `ts-node`: `^10.9.2`
  - `prisma`: `^6.0.0`
  - `tailwindcss`: `^3.4.19`, `postcss`: `^8.5.28`, `autoprefixer`: `^10.6.1`
  - `eslint`: `^8.0.0`, `eslint-config-next`: `^15.0.0`
- **Missing Tooling:**
  - No test runner (`vitest` or `jest` + `@testing-library/react`). Vitest is strongly recommended for ESM / TypeScript / Next.js 15 compatibility.
  - No ESLint config file (`.eslintrc.json` or `.eslintrc.js`).

---

## 3. Database & Persistence Layer Assessment

### 3.1 Current Prisma Schema (`prisma/schema.prisma`)
The file contains:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  nickname     String   @unique
  displayName  String
  passwordHash String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 3.2 Key Deficiencies & Missing Requirements
1. **Migrations:** There is no `prisma/migrations` directory. Schema has not been versioned with Prisma Migrate.
2. **Missing Domain Entities (§31):**
   - `Client`: id, name, cpf (unique, required per D4), phone, email, birthDate, address, notes, isActive, profilePhotoId/url, createdAt, updatedAt.
   - `EmergencyContact`: id, clientId, name, phone, relationship, notes, isActive, createdAt, updatedAt.
   - `Appointment`: id, clientId, scheduledDate, scheduledTime, estimatedDuration, status (`agendado`, `confirmado`, `cancelado`, `naoCompareceu`, `reagendado`), cancellationReason, notes, rescheduledToId (optional link to new appointment), createdAt, updatedAt.
   - `PlannedProcedure`: id, appointmentId, procedureId. (D3: planned procedures on appointment, distinct from attendance procedures).
   - `Attendance`: id, appointmentId, clientId, status (`pendente`, `realizado`, `cancelado` per D1), performedAt, discount (explicit per D2/§32), notes, createdAt, updatedAt.
   - `Procedure`: id, name, category, standardPrice, estimatedDuration, isActive, description, createdAt, updatedAt.
   - `AttendanceProcedure`: id, attendanceId, procedureId, standardValueSnapshot, practicedValue, notes, createdAt.
   - `Product`: id, name, category, brand, unit, isReusable (boolean per §15), isActive, description, createdAt, updatedAt.
   - `ProcedureProduct`: procedureId, productId (catalog relation per §17).
   - `Lot`: id, productId, lotNumber, expirationDate, receivedDate, createdAt, updatedAt.
   - `IndividualStockUnit`: id, lotId, unitCode/serialNumber, isUsed, currentClientId (nullable, tracks client for reusable unit per §15/§32), createdAt, updatedAt.
   - `ProductUsage`: id, attendanceId, individualStockUnitId, procedureId (optional), usedAt, notes, createdAt.
   - `MedicalRecord`: id, attendanceId (unique 1:1), chiefComplaint, clinicalExamination, procedureNotes, orientations, createdAt, updatedAt.
   - `Attachment`: id, clientId (nullable), attendanceId (nullable), fileName, filePath, mimeType, sizeBytes, isProfilePhoto, createdAt. Must enforce: exactly one of `clientId` OR `attendanceId` is non-null (§32 rule 14).
   - `Payment`: id, attendanceId, method (`dinheiro`, `pix`, `cartao_credito`, `cartao_debito`, `boleto`), amount, status (`pendente`, `pago`, `cancelado`), paidAt, installmentsCount (for credit card), notes, createdAt, updatedAt.
   - `PaymentSchedule` (for PIX installments): id, paymentId, installmentNumber, totalInstallments, dueDate, amount, status (`pendente`, `pago`), paidAt, createdAt.
   - `Reminder`: id, paymentScheduleId (optional), title, description, dueDate, status (`pendente`, `concluido`, `cancelado`), priority, createdAt, updatedAt.
3. **Seed Data (`prisma/seed.ts`):**
   Currently only upserts `admin` user. Must be replaced with comprehensive seed data exercising §50 and scenarios A–E from §47.

---

## 4. Backend APIs, Middleware & Services Assessment

### 4.1 Authentication & Session
- `src/middleware.ts`: Verifies cookie `popoapp-session` existence. If missing and route is not `/login` or `/api/auth`, redirects to `/login`. Note: does not decode or cryptographically verify the iron-session cookie in edge middleware (per design comments), leaving full verification to API routes/server actions.
- `src/app/api/auth/login/route.ts`: Validates body using `loginSchema` (`zod`), calls `validateCredentials`, stores session in iron-session cookie.
- `src/services/auth.service.ts`: **Critical stub:**
  ```ts
  if (nickname === 'admin' && password === 'PopoApp2024!') {
    return { userId: '1', nickname: 'admin', displayName: 'Administrador' };
  }
  ```
  It does NOT check the database, does NOT query `prisma.user`, and does NOT use `bcrypt.compare`. Must be rewritten to use `prisma.user` and `bcrypt.compare`.

### 4.2 Missing Domain Services & APIs
There are **zero domain API routes** and **zero domain services** implemented:
- No `client.service.ts` or `/api/clients` (listing, search, create, update, delete, get details with history).
- No `appointment.service.ts` or `/api/appointments` (create, confirm, cancel with reason, no-show, reschedule, auto-create attendance).
- No `attendance.service.ts` or `/api/attendances` (update status Realizado/Cancelado, add procedures with practiced values, apply explicit discount, calculate financial totals, link payments).
- No `procedure.service.ts` or `/api/procedures` (CRUD, catalog price vs. historical snapshot).
- No `inventory.service.ts` or `/api/products` / `/api/stock` (catalog, lots, physical stock units, validate same-client reuse, forbid cross-client reuse, forbid single-use re-execution).
- No `medical-record.service.ts` or `/api/attendances/[id]/medical-record` (1:1 prontuário).
- No `payment.service.ts` or `/api/payments` (record payments, PIX installment schedules, compute totals and outstanding balance).
- No `reminder.service.ts` or `/api/reminders` (PIX installment reminders, mark done, dismiss, dashboard list).
- No `attachment.service.ts` or `/api/attachments` / `/api/attachments/[id]/download` (secure local disk storage outside public dir, strict mime type and size checks, authenticated streaming response).

---

## 5. Frontend UI Components, Pages & Localization Assessment

### 5.1 What Exists and Works
1. **Design System & Theme Engine:**
   - 6 soft pastel themes implemented in `globals.css` via CSS variables (`rosa-delicado`, `lavanda-suave`, `nude-natural`, `verde-sereno`, `azul-classico`, `borgonha-elegante`).
   - `ThemeProvider` and `ThemeSelector` allow dynamic switching with `localStorage` persistence.
2. **Layout Shell:**
   - Responsive `AuthenticatedLayout` with `Header` and sliding animated `Sidebar` (Framer Motion).
   - Navigation links to all 8 areas.
   - User profile dropdown with Logout button wired to `/api/auth/logout`.
3. **UI Component Library:**
   - 18 clean Radix UI primitive wrappers in `src/components/ui/` (`dialog`, `alert-dialog`, `table`, `tabs`, `select`, `badge`, `button`, `card`, `input`, etc.).
   - Shared components: `PageHeader`, `StatCard`, `StatusBadge`, `SearchInput`, `EmptyState`, `LoadingSkeleton`.
4. **Login Screen:**
   - Clean, functional login screen at `/login` with show/hide password toggle and error message handling.

### 5.2 What Needs Fixing in Frontend
1. **Remove All Mock Data Imports:**
   Every page in `src/app/(authenticated)/` imports directly from `src/data/mock/*`.
2. **Missing Pages:**
   - **Client Detail Page (`/clientes/[id]`):** Spec §41 requires a dedicated detail page with organized sections or tabs:
     - Basic Info & CPF & Profile photo
     - Emergency Contacts (CRUD)
     - Appointment history
     - Attendance history (with performed procedures, values, prontuário)
     - Product usage history (traceable units)
     - Financial/payments history
     - Attachments list + uploader
   - **Attendance Detail / Clinical Workspace (`/atendimentos/[id]`):** Spec §43 requires a rich workspace to:
     - View Client and linked Appointment details
     - Add/remove procedures, record standard value snapshot & practiced value
     - Apply explicit discount
     - Record product usage (selecting physical unit, validating reuse)
     - Edit 1:1 Medical Record (Prontuário)
     - Upload/manage attendance attachments
     - Record payments (multiple methods, installments)
     - View financial calculation (standard total, practiced total, discount, final total, paid amount, outstanding balance)
     - Mark attendance `Realizado` (only manually when service actually occurs)
3. **Agenda Page Deficiencies:**
   - Appointment creation modal only allows a single procedure (spec requires planned procedures).
   - No Reschedule modal/action (spec D1, §32 validation 4: must mark current as `Reagendado`, create new appointment, create new attendance, cancel old pending attendance).
   - Detail dialog has a button labeled "Concluir" on Appointment, violating spec §27 ("An appointment being created does not mean the service happened... user manually confirms when actual service occurs and Attendance is completed. Do not create an appointment status called Em atendimento").
   - Lacks button to jump directly into the linked Attendance.
4. **Product / Inventory Page Deficiencies:**
   - Currently shows a flat catalog with aggregate `estoque: number`.
   - Must show Lots and Individual Stock Units, reusable vs. single-use badge, and unit tracking.
5. **Financeiro Page Deficiencies:**
   - Currently an arbitrary personal ledger (`receitas` vs `despesas`).
   - Must center around Attendances, payments, credit card installments, and PIX schedules.
6. **Lembretes Page Deficiencies:**
   - Currently static dummy cards.
   - Must display PIX installment due-date reminders (upcoming and overdue) with actions to mark done / dismiss, matching D5 and dashboard widgets.
7. **Portuguese Localization & Statuses (`src/i18n/pt-BR.ts` & `status-badge.tsx`):**
   - Add `reagendado: 'Reagendado'`.
   - Add `realizado: 'Realizado'`.
   - Remove or deprecate `concluido` from Appointment status context.

---

## 6. Testing Infrastructure Assessment

### 6.1 Current State
- **Test Runners Installed:** None (`vitest`, `jest`, `playwright` are all absent from `package.json`).
- **Test Scripts in `package.json`:** None (`"test"` script does not exist).
- **Existing Test Files:** 0 test files in the entire project.

### 6.2 Requirements from Specs
- Single command `npm test` must run full automated suite and pass with 0 failures (ORIGINAL_REQUEST.md line 51).
- Coverage required for:
  - All 24 critical validations in §32.
  - All binding decisions D1–D6.
  - §47 data integrity scenarios A–E (exact numeric and logic assertions).
  - Cross-client reuse rejection and single-use rejection at service/DB layer even when UI is bypassed.
  - Attachment exclusive ownership (Client XOR Attendance) enforced at DB/service level.
  - CPF validation, formatting, normalization, and unique constraint enforcement.
  - Unauthenticated access rejection for protected pages, APIs, and file downloads.
  - Dedicated test database configuration distinct from the development database (D7).

---

## 7. Compliance Matrix: 7 Binding Decisions (D1–D7)

| Decision | Requirement Summary | Codebase Status | Gap Details |
|---|---|---|---|
| **D1: Attendance Lifecycle** | Statuses: Pendente / Realizado / Cancelado. Created as Pendente when Appointment is created. Marked Realizado manually. Cancel/no-show/reschedule auto-cancels pending Attendance. Reschedule creates new Appointment + new Pendente Attendance. | 🔴 0% Implemented | No Attendance model or service. Appointment has mock status with `concluido`. No link between appointments and attendances. |
| **D2: Attendance Total & Outstanding** | Total = sum(practiced values) − discount. Outstanding = total − sum(paid payments). Both computed, never stored. | 🔴 0% Implemented | Mock attendance stores static `valor`. No calculation logic, no practiced values vs standard values, no explicit discount. |
| **D3: Planned Procedures** | Appointment carries planned procedures for estimated duration/value & pre-fill. Distinct from Attendance procedures. No planned products. | 🔴 0% Implemented | Mock appointment has single `procedimentoId`. No planned procedures list model or association. |
| **D4: Client Required Fields & CPF** | Name, phone, email, birthdate, address, notes, active status, emergency contacts, profile photo, attachments + **CPF required & unique, validated well-formed, stored normalized**. | 🔴 0% Implemented | Mock client has no CPF field at all. No CPF validation or normalization utility. No database model. |
| **D5: Reminders System** | In-app only. Lembretes page + dashboard list of upcoming/overdue PIX installments. Can mark done or dismiss. No email/WhatsApp. | 🔴 10% Implemented | Lembretes page and dashboard exist only with hardcoded mock tasks. No PIX installment reminder integration or dismiss state. |
| **D6: File Storage** | Local disk storage outside public folder. Authenticated routes only. Never predictable public URLs. | 🔴 0% Implemented | No storage folder configured, no upload API, no streaming download API, no auth check on file access. |
| **D7: Environment & Database** | Work in place in git repo. SQL Server LocalDB. Migrations against it. Tests use separate test database. | 🟡 25% Implemented | LocalDB configured in `.env` for main app. No migrations created yet. No separate test DB setup. |

---

## 8. Compliance Matrix: 24 Critical Validations (§32)

| # | Validation Rule | Implemented? | Existing Code vs. Gap |
|---|---|---|---|
| 1 | Appointment belongs to exactly 1 Client | ❌ No | No Appointment or Client DB model. |
| 2 | Appointment status in defined set (`agendado`, `confirmado`, `cancelado`, `naoCompareceu`, `reagendado`) | ⚠️ Partial | `src/types/index.ts` has `agendado`, `confirmado`, `concluido`, `cancelado`, `naoCompareceu`. Missing `reagendado`; contains invalid `concluido`. |
| 3 | `Em atendimento` must NOT exist as Appointment status | ✅ Compliant in types | Status is not in types, but UI logic needs enforcement. |
| 4 | Rescheduling preserves old as `Reagendado`, creates new Appointment + new Pendente Attendance | ❌ No | Rescheduling does not exist in code or UI. |
| 5 | Attendance is distinct from Appointment | ❌ No | Separate mock types exist, but no real relational model or workflow. |
| 6 | Appointment may have >1 Attendance | ❌ No | Relational model not implemented. |
| 7 | Attendance NOT marked completed merely because Appointment exists | ❌ No | Attendance lifecycle not implemented. |
| 8 | Every Procedure on Attendance has a practiced value | ❌ No | Attendance-Procedure association model missing. |
| 9 | Standard procedure value and practiced value stored separately | ❌ No | Not modeled. |
| 10 | Difference between standard & practiced values must NOT auto-become Attendance discount | ❌ No | Not implemented. |
| 11 | Attendance discount must be explicit | ❌ No | Not implemented. |
| 12 | Historical procedure values do not change when catalog values change | ❌ No | No snapshot field in DB model. |
| 13 | Client can have multiple emergency contacts | ❌ No | EmergencyContact model missing. |
| 14 | Attachment belongs to Client OR Attendance, never both | ❌ No | Attachment model and check constraint missing. |
| 15 | Reusable physical product unit may be reused by same Client across Attendances | ❌ No | Inventory traceability not modeled. |
| 16 | Same physical product unit must NEVER be used by another Client | ❌ No | Validation logic and DB checks missing. |
| 17 | Single-use product units must NOT be reused | ❌ No | Validation logic missing. |
| 18 | Product Usage must identify an individual physical stock unit | ❌ No | ProductUsage model missing. |
| 19 | Medical Record is exactly 1 per Attendance (1:1) | ❌ No | MedicalRecord model missing. |
| 20 | Attendance may have multiple payments | ❌ No | Payment model missing. |
| 21 | Credit-card installments do NOT generate collection reminders | ❌ No | Reminder logic missing. |
| 22 | PIX installment schedules generate reminders | ❌ No | PaymentSchedule and Reminder generation missing. |
| 23 | Reminder state must NOT replace payment truth | ❌ No | Not implemented. |
| 24 | Historical records must NOT be rewritten by catalog changes | ❌ No | Snapshotting architecture missing. |

---

## 9. Tooling & Environment Findings

1. **Linter Execution:**
   - Command: `npm run lint` -> triggers `next lint`.
   - Result: Failed with exit code 1 because Next.js prompts interactively `How would you like to configure ESLint?`.
   - Root Cause: No `.eslintrc.json` or `.eslintrc.js` file exists in the repository root.
   - Fix Needed: Create `.eslintrc.json` extending `"next/core-web-vitals"`.
2. **TypeScript Compilation:**
   - Command: `npx tsc --noEmit`.
   - Result: Exited with code 0. Existing code is strictly type-checked and compiles cleanly.
3. **Database Setup:**
   - `.env` specifies: `DATABASE_URL="sqlserver://localhost;database=PopoApp;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLOCALDB"`.
   - `.env.local` specifies identical connection string plus `SESSION_SECRET` and `NODE_ENV`.
   - Prisma provider: `"sqlserver"`.

---

## 10. Prioritized Implementation Recommendations for the Team

### Priority 1: Environment & Tooling Stabilization
1. Add `.eslintrc.json` to make `npm run lint` pass non-interactively.
2. Install test framework (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`) and configure `npm test` in `package.json`.
3. Create separate test database environment configuration (e.g. `PopoApp_Test` on LocalDB or SQLite/in-memory for unit tests if pure logic, but integration tests require SQL Server LocalDB per D7).

### Priority 2: Database Schema & Migrations
1. Expand `prisma/schema.prisma` with all 13 models, foreign keys, unique constraints (e.g. `Client.cpf`), and snapshots.
2. Run `npx prisma migrate dev --name init_domain_model` to generate the first real migration.
3. Build comprehensive seed script in `prisma/seed.ts` covering §50 and scenarios A–E from §47.

### Priority 3: Domain Services & Validations Layer
1. CPF validation utility (`validateCPF`, `formatCPF`, `normalizeCPF`).
2. Implement service layer with all 24 critical validations and D1–D6:
   - `AuthService` (verify with bcrypt against `prisma.user`)
   - `ClientService` & `EmergencyContactService`
   - `ProcedureService`
   - `InventoryService` (Product, Lot, IndividualStockUnit, reuse rules)
   - `AppointmentService` (lifecycle, rescheduling, auto-attendance)
   - `AttendanceService` (procedures, practiced values, explicit discount, total/outstanding computation, completion)
   - `MedicalRecordService` (1:1 prontuário)
   - `PaymentService` & `ReminderService` (multiple methods, PIX installments, reminders)
   - `AttachmentService` (local disk storage, authenticated streaming, client vs. attendance exclusivity)

### Priority 4: API Endpoints & File Storage
1. REST routes under `src/app/api/` for all domain resources with Zod request validation.
2. Local upload directory (e.g. `storage/uploads/` at root, outside `public/` and gitignored).
3. Streaming endpoint `/api/attachments/[id]/download` requiring valid session.

### Priority 5: Frontend UI Realization & Mock Data Purge
1. Build Client detail page (`/clientes/[id]`) with tabs for overview, contacts, appointments, attendances, procedures, product usage, medical records, financial history, attachments.
2. Build Attendance workspace (`/atendimentos/[id]`) supporting procedure editing, practiced values, explicit discount, product usage picking, prontuário editing, attachments, and payment entry.
3. Update Agenda calendar to support planned procedures, rescheduling modal, status updates, and direct link to Attendance.
4. Update Produtos page to manage Lots and traceable Physical Stock Units.
5. Update Financeiro & Lembretes to show real attendance payments, PIX installment schedules, and reminder dismissal.
6. Replace all imports from `src/data/mock/*` across all 8 authenticated pages and remove/deprecate mock files.

### Priority 6: Automated Test Suite
1. Unit tests for CPF validation, attendance calculations (total, outstanding), reminder generation.
2. Integration tests covering:
   - All 24 validations in §32.
   - All 7 binding decisions D1–D7.
   - §47 scenarios A–E with exact amounts.
   - Direct service/DB tests proving rejection of cross-client reuse and double single-use.
   - Direct service/DB tests proving attachment ownership exclusivity.
   - Unauthenticated route rejection tests.
