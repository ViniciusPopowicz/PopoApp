# Dispatch: Worker M1 1 (Foundation & Database)

You are a worker agent (`teamwork_preview_worker`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_codebase_1\codebase_assessment.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
Implement Milestone 1 (Phases 1 & 2):
1. Phase 1: Environment & Project Foundation
   - Create `.eslintrc.json` extending `"next/core-web-vitals"` so `npm run lint` runs without prompts and passes.
   - Install vitest and related test dependencies (`npm install -D vitest @vitejs/plugin-react`) if not present.
   - Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.
   - Create `vitest.config.ts` configured for TypeScript path aliases (`@/*`).
   - Create `.env.test` with `DATABASE_URL` pointing to `PopoAppTest` on SQL Server LocalDB.
   - Verify `npx tsc --noEmit` and `npm run lint`.
2. Phase 2: 🔴 Database & Domain Model
   - Implement the complete 18-model Prisma schema in `prisma/schema.prisma` using the verified schema specification from `spec_miner_arch_1/arch_and_test_spec.md`:
     - Models: User, Client, EmergencyContact, Appointment, AppointmentPlannedProcedure, Attendance, AttendanceProcedure, Procedure, Product, Lot, IndividualStockUnit, ProductUsage, MedicalRecord, Attachment, Payment, PaymentMethodEnum (or validated string), Reminder, DashboardMetricCache.
     - Note SQL Server LocalDB specifics: string enums with Zod validation, `@db.Decimal(10, 2)` for currency, `onDelete: NoAction` to avoid cycles.
   - Create and apply migration: `npx prisma migrate dev --name init_domain_models`.
   - Add SQL Server CHECK constraint for Attachment exclusivity (`CK_Attachment_Ownership`):
     `ALTER TABLE [Attachment] ADD CONSTRAINT [CK_Attachment_Ownership] CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));`
   - Run `npx prisma generate` to generate the updated Prisma client.
   - Run verification test or query confirming tables and constraints exist.
   - Update `IMPLEMENTATION_CHECKLIST.md` marking completed tasks in Phase 1 and Phase 2.

Deliverables:
- Passing build, lint, and Prisma generate.
- Verified migration and database schema on SQL Server LocalDB.
- Detailed handoff.md in your working directory documenting commands run, build outputs, and verification.
- Notify parent via send_message when complete.


## 2026-10-06T02:43:33Z
You are Worker M1 1 (Foundation & Database).
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_1
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_1\DISPATCH.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Authoritative source files:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_codebase_1\codebase_assessment.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

Scope & Tasks:
1. Phase 1: Environment & Project Foundation
   - Create `.eslintrc.json` extending `"next/core-web-vitals"` so `npm run lint` passes without prompts.
   - Install vitest and dependencies (`npm install -D vitest @vitejs/plugin-react`).
   - Add `"test": "vitest run"` and `"test:watch": "vitest"` to package.json scripts.
   - Create `vitest.config.ts` with path aliases.
   - Create `.env.test` pointing to `PopoAppTest` on SQL Server LocalDB.
   - Verify `npx tsc --noEmit` and `npm run lint`.
2. Phase 2: 🔴 Database & Domain Model
   - Implement the complete 18-model Prisma schema in `prisma/schema.prisma` from `spec_miner_arch_1/arch_and_test_spec.md`.
   - Run Prisma migration on SQL Server LocalDB (`npx prisma migrate dev --name init_domain_models`).
   - Apply SQL Server CHECK constraint for Attachment exclusivity (`CK_Attachment_Ownership`).
   - Run `npx prisma generate`.
   - Update `IMPLEMENTATION_CHECKLIST.md` marking completed tasks in Phase 1 and Phase 2.

Deliverables:
- Passing build, lint, and Prisma generate.
- Database tables and constraints verified on SQL Server LocalDB.
- Detailed handoff.md in your working directory.
- Notify parent via send_message when complete.
