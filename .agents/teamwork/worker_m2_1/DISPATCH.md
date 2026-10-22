# Dispatch: Worker M2 1 (Security, Core Entities & Catalog)

You are a worker agent (`teamwork_preview_worker`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (D4, D6, AC 52, AC 53, AC 60, AC 61, AC 62)
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§3, §4, §5, §6, §9, §32 V01–V07, V12–V14)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md (Phases 3, 4, 5, 11)
- c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_1\auth_client_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_2\procedure_spec.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_3\storage_spec.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Tasks:
Implement Milestone 2 across Phases 3, 4, 5, and 11:
1. Phase 3: Real Authentication & Session
   - Implement `src/services/auth.service.ts` replacing mock validation with real Prisma `User` query, `bcrypt.compare(password, user.passwordHash)`, and `user.isActive` check.
   - Update `src/middleware.ts` so unauthenticated requests to `/api/*` return JSON 401 Unauthorized (AC 60) instead of redirecting to `/login`.
2. Phase 4: Client Management & CPF Algorithm
   - Implement `src/lib/cpf.ts` (MOD 11 validation, rejection of all repeated digits sequences, normalization to 11 digits, canonical formatting `000.000.000-00`).
   - Implement `src/schemas/client.ts` with Zod validation.
   - Implement `src/services/client.service.ts`:
     - Mandatory CPF with checksum validation (V01).
     - Unique CPF validation in service layer and database P2002 error handling (AC 62, V02).
     - 1:N emergency contacts management (V04).
     - Soft-delete status toggle (`ativo` / `inativo`) preserving medical/financial history (V05).
     - Historical records retrieval derived from real relational models.
   - Implement `/api/clients/route.ts` and `/api/clients/[id]/route.ts`.
3. Phase 5: Procedure Catalog
   - Implement `src/schemas/procedure.ts` with Zod validation.
   - Implement `src/services/procedure.service.ts`:
     - Positive decimal standard value validation (`valorPadrao > 0`) (V06).
     - Mandatory name, description, duration (`duracaoMinutos > 0`), category (V07).
     - Soft deactivation fallback (`isActive = false`) when in-use to prevent Msg 547 errors.
   - Implement `/api/procedures/route.ts` and `/api/procedures/[id]/route.ts`.
4. Phase 11: 🔴 Authenticated File Storage Pipeline
   - Implement `src/services/attachment.service.ts`:
     - Local disk storage outside web root (`./storage/uploads/` or `env.STORAGE_DIR`).
     - Random UUID filename generation (`${uuid()}${ext}`).
     - MIME type validation (JPEG, PNG, WebP, PDF) (V12) and 10MB limit (V13).
     - XOR ownership validation (Client XOR Attendance) (V14, AC 61).
     - Profile photo replacement atomic update and cleanup.
   - Implement `/api/attachments/route.ts` (multipart upload) and `/api/attachments/[id]/route.ts` (authenticated streaming with session check, 401 unauth check per AC 60, `X-Content-Type-Options: nosniff`, and private caching).
5. Update `IMPLEMENTATION_CHECKLIST.md` marking completed tasks in Phases 3, 4, 5, 11.

Deliverables:
- All source files, schemas, services, and route handlers implemented.
- Detailed handoff.md in your working directory.
- Notify parent via send_message when complete.
