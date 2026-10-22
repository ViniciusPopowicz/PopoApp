# Dispatch: Sub-Orchestrator Milestone 1 (Foundation & Database)

You are the Sub-Orchestrator for Milestone 1 (`orchestrator`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\sub_orch_m1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_survey_1\spec_inventory.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\spec_miner_arch_1\arch_and_test_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1\PROJECT.md

Scope:
Execute Milestone 1 (Phases 1 & 2 of POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md):
1. Phase 1: Environment & Project Foundation
   - Resolve ESLint configuration (.eslintrc.json) so `npm run lint` passes without prompts.
   - Configure Vitest (`vitest.config.ts`, `package.json` scripts: `"test": "vitest run"`).
   - Ensure `npm run build` and `npx tsc --noEmit` succeed.
2. Phase 2: 🔴 Database & Domain Model
   - Expand `prisma/schema.prisma` to include all 18 clinical & domain models specified in `arch_and_test_spec.md` (handling SQL Server constraints, string enums, decimal precisions, referential actions).
   - Run Prisma migration on SQL Server LocalDB (`npx prisma migrate dev --name init_domain_model`).
   - Add the SQL Server CHECK constraint for Attachment exclusivity:
     `ALTER TABLE [Attachment] ADD CONSTRAINT [CK_Attachment_Ownership] CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));`
   - Run `npx prisma generate` to generate the full Prisma client.
   - Verify baseline schema and constraints on SQL Server LocalDB.
   - Update `IMPLEMENTATION_CHECKLIST.md` marking Phase 1 and Phase 2 items completed.

Your Procedure:
Follow the Project Pattern iteration loop:
- Dispatch Explorer / Spec Miner if needed.
- Dispatch Worker to implement the changes and run migrations/builds.
- Dispatch 2 Reviewers, 2 Challengers, and Forensic Auditor (`teamwork_preview_auditor`).
- Enforce Gate passing criteria.
- Report back completion to parent orchestrator.
