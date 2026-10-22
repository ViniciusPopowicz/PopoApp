# Dispatch for Challenger M6 1

## Role
Adversarial Challenger for Milestone 6 (Phase 17 — E2E Verification & Hardening).

## Tasks
1. Read binding context: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md`, `POPOAPP_DEVELOPMENT_SPEC.md`, `PROJECT.md`, `TEST_INFRA.md`, and `IMPLEMENTATION_CHECKLIST.md`.
2. Empirically verify system correctness and robustness under adversarial conditions:
   - Challenge authentication and route protection: unauthenticated requests to protected API routes (`/api/clients`, `/api/appointments`, `/api/attendances`, `/api/procedures`, `/api/products`, `/api/financial/*`, `/api/attachments/*`) must be rejected with 401.
   - Challenge Attachment XOR constraint: database must reject an attachment row owning both a Client and an Attendance (or neither) at the SQL Server engine level.
   - Challenge CPF validation: invalid checksums, malformed CPFs, duplicate CPFs must be rejected by both service layer and database unique constraint.
   - Challenge product stock unit rules: cross-client reuse of a reusable unit must fail; second use of a single-use unit must fail.
3. Write adversarial test suite in `tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts` targeting `PopoAppTest` (isolated per D7) and run it via `npx vitest run tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts`.
4. Ensure all existing tests continue to pass and `npm run lint` remains clean (0 errors).
5. Render an independent verdict: APPROVE or REQUEST_CHANGES.
6. Write handoff report in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m6_1\handoff.md` and send message back to orchestrator.
## 2026-10-22T00:46:49Z
[Message] timestamp=2026-10-22T00:46:49Z sender=17d1a415-f458-405e-be53-fd59132ad8cf priority=MESSAGE_PRIORITY_HIGH
Role: challenger_m6_1
Working directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m6_1
Project root: c:\Users\Vinicius\PopoApp\PopoApp
Mission: Empirically verify system correctness and robustness under adversarial conditions; author adversarial test suite tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts targeting PopoAppTest; verify lint and all tests; render verdict; report in handoff.md.
