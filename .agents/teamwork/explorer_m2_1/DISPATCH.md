# Dispatch: Explorer M2 1 (Auth & Client Management)

You are an exploration agent (`teamwork_preview_explorer`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_1
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (D4, AC 52, AC 53, AC 62)
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§3, §4, §32 V01–V05)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md (Phases 3 & 4)
- c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma

Objective:
Investigate and design the implementation for Phase 3 (Authentication) and Phase 4 (Client Management):
1. Phase 3 (Auth):
   - Replace mock logic in `src/services/auth.service.ts` with real Prisma query against `User` model, comparing password with `bcrypt.compare(password, user.passwordHash)` and checking `user.isActive`.
   - Ensure session handling via `iron-session` continues to work cleanly.
2. Phase 4 (Client Management):
   - Design `src/lib/cpf.ts` (MOD 11 validation, repeated digits rejection, normalization).
   - Design `src/services/client.service.ts`:
     - Mandatory CPF with checksum validation (V01).
     - Unique CPF validation both in service layer and via Prisma unique constraint handling (AC 62, V02).
     - 1:N emergency contacts handling (creation, update, deletion) (V04).
     - Soft-delete/status toggle (`ativo` / `inativo`) preserving medical/financial history (V05).
   - Design API routes: `/api/clients` and `/api/clients/[id]`.
   - Specify Zod validation schemas for requests.

Deliverables:
- Detailed design and implementation blueprint in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_1\auth_client_spec.md`.
- Self-contained handoff.md in your working directory.
- Notify parent via send_message.
