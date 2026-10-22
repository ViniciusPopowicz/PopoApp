# Dispatch: Worker M1 Iteration 2 (Remediation)

You are a worker agent (`teamwork_preview_worker`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_it2
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\auditor_m1_1\handoff.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_1\remediation_plan.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_2\schema_remediation.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_3\test_alignment_plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
Implement the remediation formulated by the 3 Explorers:
1. Apply the exact Prisma schema fixes from `schema_remediation.md` to `prisma/schema.prisma`:
   - Set `onDelete: NoAction, onUpdate: NoAction` on diamond relations (`Appointment.client`, `Attendance.appointment`, `Attendance.client`, `StockUnit.currentClient`, `ProductUsage.attendance`, `ProductUsage.stockUnit`, `ProductUsage.attendanceProcedure`, `Attachment.client`, `Attachment.attendance`, `Payment.attendance`, `Reminder.client`).
   - Run `npx prisma validate` and verify exit code 0 (zero P1012 errors).
2. Synchronize `prisma/migrations/20261006000000_init_domain_models/migration.sql` lines 302–330 with matching `ON DELETE NO ACTION ON UPDATE NO ACTION` foreign keys while preserving `CK_Attachment_Ownership`.
3. Apply test alignment fixes from `test_alignment_plan.md` to:
   - `tests/helpers/db-cleaner.ts`
   - `tests/helpers/test-fixtures.ts`
   - `tests/tier1_features/f03_client_model.spec.ts`
   - `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`
   - `tests/tier3_combinations/appointment_attendance_d1.spec.ts`
   - `tests/tier4_workflows/scenarios_a_through_e.spec.ts`
4. Run `npm install` (if vitest packages need installing in node_modules).
5. Run `npx prisma generate` to generate the 18 domain models in `@prisma/client`.
6. Run `npm run lint` and `npx tsc --noEmit` to verify type and lint cleanliness.
7. Run tests via `npx vitest run tests/tier1_features/f01_tooling.spec.ts tests/tier2_boundaries/cpf_validation.spec.ts tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts`.
8. Update `IMPLEMENTATION_CHECKLIST.md` with accurate progress.

Deliverables:
- Passing `npx prisma validate`.
- Passing TypeScript check (`npx tsc --noEmit`).
- Passing unit test execution.
- Self-contained handoff.md in your working directory documenting all commands run and results.
- Notify parent via send_message when done.


## 2026-10-06T03:13:41Z
You are Worker M1 Iteration 2 (Remediation).
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_it2
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m1_it2\DISPATCH.md first.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Authoritative source files:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\auditor_m1_1\handoff.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_1\remediation_plan.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_2\schema_remediation.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m1_it2_3\test_alignment_plan.md

Execute the remediation:
1. Apply the exact Prisma schema fixes from schema_remediation.md to prisma/schema.prisma (onDelete: NoAction, onUpdate: NoAction on diamond relations). Run `npx prisma validate` and verify exit code 0.
2. Synchronize foreign keys in prisma/migrations/20261006000000_init_domain_models/migration.sql (NoAction on diamond paths, preserving CK_Attachment_Ownership).
3. Apply test fixes from test_alignment_plan.md to db-cleaner.ts, test-fixtures.ts, and test specs in tests/.
4. Run `npm install` for vitest if needed, and run `npx prisma generate`.
5. Run `npx tsc --noEmit` and `npm test` (or `npx vitest run ...`).
6. Update IMPLEMENTATION_CHECKLIST.md.

Deliverables:
- Zero P1012 errors on npx prisma validate.
- Clean TypeScript and unit test runs.
- Detailed handoff.md in your working directory.
- Notify parent via send_message when done.
