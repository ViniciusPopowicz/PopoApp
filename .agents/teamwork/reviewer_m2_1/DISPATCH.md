# Dispatch: Reviewer M2 1 (Security, Core Entities & Catalog)

You are a reviewer agent (`teamwork_preview_reviewer`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (D4, D6, AC 52, AC 53, AC 60, AC 61, AC 62)
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§3, §4, §5, §6, §9, §32 V01–V07, V12–V14)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_1\handoff.md

Review Objectives:
1. Examine `src/services/auth.service.ts` and `src/middleware.ts`:
   - Real Prisma User lookup with bcrypt.compare.
   - User active status check (`isActive`).
   - Middleware returning JSON 401 for unauthenticated `/api/*` requests (AC 60).
2. Examine `src/lib/cpf.ts`, `src/schemas/client.ts`, `src/services/client.service.ts`:
   - Receita Federal MOD 11 validation and rejection of repeated sequences (111.111.111-11, etc.).
   - Mandatory and unique CPF validation (V01, V02, AC 62).
   - 1:N emergency contacts handling (V04).
   - Soft-delete status toggle preserving medical/financial history (V05).
3. Examine `src/schemas/procedure.ts`, `src/services/procedure.service.ts`:
   - Positive decimal standard value (`valorPadrao > 0`) (V06).
   - Mandatory description and duration (V07).
   - In-use deactivation fallback instead of hard delete.
4. Examine `src/services/attachment.service.ts` and `/api/attachments` routes:
   - File storage path outside public root (`./storage/uploads/`).
   - Allowed MIME types (JPEG, PNG, WebP, PDF) (V12) and 10MB limit (V13).
   - XOR ownership validation (Client XOR Attendance) (V14, AC 61).
   - Authenticated streaming with 401 unauthenticated response (AC 60) and `X-Content-Type-Options: nosniff`.
5. Run build / typecheck: `npx tsc --noEmit`.
6. Run unit / feature tests: `npx vitest run tests/tier1_features/`.

Render Verdict:
- Record your verdict: APPROVE or REQUEST_CHANGES in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_1\handoff.md`.
- Notify parent via `send_message`.


## 2026-10-06T03:58:48Z
You are Milestone 2 Reviewer 1.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_1
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_1\DISPATCH.md first.

Authoritative source files to review:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_1\handoff.md

Review the implementation of Milestone 2:
- src/services/auth.service.ts and src/middleware.ts (Prisma bcrypt auth, isActive, 401 unauth per AC 60)
- src/lib/cpf.ts, src/schemas/client.ts, src/services/client.service.ts (MOD 11, mandatory unique CPF, 1:N emergency contacts, soft delete)
- src/schemas/procedure.ts, src/services/procedure.service.ts (valorPadrao > 0, mandatory fields, soft deactivation on in-use)
- src/services/attachment.service.ts, /api/attachments routes (disk storage outside web root, MIME allowlist, 10MB limit, XOR ownership, authenticated streaming with 401 unauth per AC 60)
- Run typecheck and tests if needed.

Render Verdict:
- Record your verdict: APPROVE or REQUEST_CHANGES in handoff.md in your working directory.
- Notify parent via send_message.
