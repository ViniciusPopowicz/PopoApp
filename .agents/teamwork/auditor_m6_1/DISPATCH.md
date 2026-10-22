# Dispatch for Forensic Auditor M6 1

## Role
Forensic Integrity Auditor for Milestone 6 (Phase 17 — E2E Verification & Hardening).

## Tasks
1. Read binding context: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md`, `POPOAPP_DEVELOPMENT_SPEC.md`, `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`, `PROJECT.md`, `TEST_INFRA.md`, and `IMPLEMENTATION_CHECKLIST.md`.
2. Perform systematic forensic integrity verification:
   - Check for hardcoded test results, expected outputs, or dummy facades in domain services (`src/services/*`), API routes (`src/app/api/*`), or UI components (`src/app/(authenticated)/*`).
   - Verify that `src/data/mock/` has been completely eliminated and zero mock data feeds the application.
   - Verify that all database operations execute against Microsoft SQL Server LocalDB (`PopoApp` for dev/seed, `PopoAppTest` for automated tests) adhering strictly to D7 isolation.
   - Verify genuine business logic implementation:
     - 24 Critical Validations in §32
     - D1 Attendance lifecycle & atomic rescheduling
     - D2 dynamic financial calculation (computed on demand, not stored)
     - D3 planned vs actual procedures
     - D4 mandatory unique CPF (MOD 11)
     - D5 decoupled in-app reminders
     - D6 secure authenticated file storage outside `public/`
     - Attachment XOR CHECK constraint `CK_Attachment_Ownership` in SQL Server
   - Inspect git log and git diff for fabricated logs or bypassed checks.
3. Render an independent verdict: CLEAN or INTEGRITY VIOLATION.
4. Write handoff report in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\auditor_m6_1\handoff.md` and send message back to orchestrator.


## 2026-10-22T00:46:49Z
You are auditor_m6_1.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\auditor_m6_1
The project root is: c:\Users\Vinicius\PopoApp\PopoApp

MANDATORY INSTRUCTION:
Read `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Also read `POPOAPP_DEVELOPMENT_SPEC.md`, `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`, `PROJECT.md`, `TEST_INFRA.md`, and `IMPLEMENTATION_CHECKLIST.md`.

Your mission:
1. Initialize BRIEFING.md and progress.md in your working directory.
2. Perform systematic forensic integrity verification across the entire PopoApp codebase:
   - Check for hardcoded test results, expected outputs, or dummy facades in domain services (`src/services/*`), API routes (`src/app/api/*`), or UI components (`src/app/(authenticated)/*`).
   - Verify that `src/data/mock/` has been completely eliminated and zero mock data feeds the application.
   - Verify that all database operations execute against Microsoft SQL Server LocalDB (`PopoApp` for dev/seed, `PopoAppTest` for automated tests) adhering strictly to D7 isolation.
   - Verify genuine business logic implementation:
     - 24 Critical Validations in §32
     - D1 Attendance lifecycle & atomic rescheduling
     - D2 dynamic financial calculation (computed on demand, not stored)
     - D3 planned vs actual procedures
     - D4 mandatory unique CPF (MOD 11)
     - D5 decoupled in-app reminders
     - D6 secure authenticated file storage outside `public/`
     - Attachment XOR CHECK constraint `CK_Attachment_Ownership` in SQL Server
   - Inspect git log and git diff for fabricated logs or bypassed checks.
3. Render an independent verdict: CLEAN or INTEGRITY VIOLATION.
4. Write your complete handoff report in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\auditor_m6_1\handoff.md`.
5. Send a message to orchestrator with your verdict, evidence, and path to handoff.md.
