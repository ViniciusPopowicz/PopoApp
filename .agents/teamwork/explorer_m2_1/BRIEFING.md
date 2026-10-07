# BRIEFING — 2026-10-06T03:40:00Z

## Mission
Investigate and design Phase 3 (Auth: real Prisma + bcrypt auth.service.ts) and Phase 4 (Client Management: cpf.ts, client.service.ts, emergency contacts, /api/clients).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesis
- Working directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_1
- Original parent: 4921052e-c509-477d-985b-561354b8b140
- Milestone: M2 (Auth & Client Management)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Design real Prisma + bcrypt auth.service.ts replacing mock logic
- Design cpf.ts (MOD 11, repeated digits rejection, normalization)
- Design client.service.ts (mandatory CPF, checksum validation V01, unique CPF V02 / AC 62, 1:N emergency contacts V04, soft delete / status toggle preserving history V05)
- Design API routes /api/clients and /api/clients/[id]
- Specify Zod validation schemas for requests
- Comply with D4, AC 52, AC 53, AC 62, §3, §4, §32 V01-V05, PROJECT.md, prisma/schema.prisma

## Current Parent
- Conversation ID: 4921052e-c509-477d-985b-561354b8b140
- Updated: 2026-10-06T03:35:00Z

## Investigation State
- **Explored paths**:
  - `DISPATCH.md`
  - `ORIGINAL_REQUEST.md` (D4, AC 52, AC 53, AC 62)
  - `POPOAPP_DEVELOPMENT_SPEC.md` (§3, §4, §5, §26, §29, §30, §32, §41, §49)
  - `PROJECT.md` (F02, F03, F12, F13, Milestones M1/M2)
  - `IMPLEMENTATION_CHECKLIST.md` (Phase 3 & Phase 4, V01–V24 matrix)
  - `prisma/schema.prisma` (`User`, `Client`, `EmergencyContact`, `Appointment`, `Attendance`)
  - `src/services/auth.service.ts` (current mock implementation)
  - `src/lib/session.ts` (iron-session config)
  - `src/middleware.ts` (unauthenticated redirection bug on API routes)
  - `tests/helpers/cpf-validator.ts` and `tests/tier2_boundaries/cpf_validation.spec.ts`
  - `tests/tier1_features/f03_client_model.spec.ts`
- **Key findings**:
  1. `src/services/auth.service.ts` has hardcoded admin mock credentials; needs Prisma query and `bcrypt.compare` + `isActive` check.
  2. `src/middleware.ts` redirects all unauthenticated requests to `/login`, which breaks REST API contracts (should return 401 JSON for `/api/*` requests per AC 60).
  3. `cpf.ts` MOD 11 algorithm with repeated digits rejection is fully tested in `tests/tier2_boundaries/cpf_validation.spec.ts`.
  4. `Client` model requires mandatory unique CPF normalized to 11 digits (D4, AC 62) and supports $1:N$ emergency contacts (`Client 1:N EmergencyContact`).
  5. Soft-delete toggle (`status: 'inativo'`) satisfies historical retention (§30) without breaking relational foreign keys.
  6. Client history should be derived from real domain records rather than artificial history tables (§26, §41).
- **Unexplored areas**: None for M2 scope.

## Key Decisions Made
- Auth design: Replaces mock in `auth.service.ts` while retaining signature `validateCredentials(nickname, password)`. Adds `requireAuth()` in `src/lib/session.ts`.
- Middleware design: Differentiates `/api/*` to return 401 JSON instead of redirecting to `/login`.
- CPF design: Matches Brazilian MOD 11 algorithm, normalizes to 11 digits, rejects all 10 repetitive sequences.
- Client Service design: Enforces mandatory CPF, checksum verification, duplicate pre-check + Prisma P2002 translation, $1:N$ emergency contacts lifecycle, soft-delete toggle, real-time search, and derived history.

## Artifact Index
- `DISPATCH.md` — Dispatch instructions from parent
- `auth_client_spec.md` — Comprehensive design blueprint for Phase 3 and Phase 4
- `handoff.md` — Self-contained 5-component handoff report
