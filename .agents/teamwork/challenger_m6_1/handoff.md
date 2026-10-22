# Handoff Report — Challenger M6 1 (Security & Business Integrity Adversarial Hardening)

**Date**: 2026-10-22T01:23:00Z  
**Agent**: challenger_m6_1 (Critic / Specialist)  
**Milestone**: M6 (Phase 17 — E2E Verification & Hardening)  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Test Suite Creation & Execution
- Created test file: `tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts` (33 tests across 4 threat categories).
- Executed via: `npx vitest run tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts`
- Result:
  ```
  RUN  v2.1.9 C:/Users/Vinicius/PopoApp/PopoApp

  ✓ tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts (33 tests) 2962ms

  Test Files  1 passed (1)
       Tests  33 passed (33)
    Duration  4.34s
  ```

### 1.2 Route Authentication & Session Protection (Challenge 1, AC 60)
- Observed in `src/middleware.ts` (lines 7–9):
  ```typescript
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }
  ```
- Tested unauthenticated requests to: `/api/clients`, `/api/appointments`, `/api/attendances`, `/api/procedures`, `/api/products`, `/api/financial/summary`, `/api/financial/transactions`, `/api/attachments`, `/api/attachments/[id]`. Every unauthenticated request returns HTTP 401 with JSON `{ success: false, error: 'Não autorizado' }`.
- Tested tampered/corrupted session cookies: forged ciphertext, null token, invalid base64 payloads -> all return HTTP 401.
- Tested session cookies with `isLoggedIn: false` or empty `userId` -> return HTTP 401.
- Tested defense-in-depth: directly invoking route handlers (`GET`/`POST`) without request session cookies throws `UnauthorizedError` from `requireAuth(request)` (`src/lib/session.ts`: line 37), catching and returning HTTP 401 JSON.

### 1.3 SQL Server Attachment XOR Constraint (Challenge 2, AC 61, V14)
- Observed SQL Server constraint in `prisma/migrations/20261006000000_init_domain_models/migration.sql` (lines 329–330):
  ```sql
  ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
  CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
  ```
- Tested raw SQL bypass (`$executeRawUnsafe`) inserting with both `clientId` and `attendanceId` -> rejected with SQL Server check constraint violation:
  `Raw query failed. Code: 547. Message: The INSERT statement conflicted with the CHECK constraint "CK_Attachment_Ownership".`
- Tested raw SQL bypass inserting with neither (both NULL) -> rejected with `CK_Attachment_Ownership` violation.
- Tested raw SQL bypass inserting with single ownership (`clientId` only or `attendanceId` only) -> succeeds cleanly.
- Tested raw SQL UPDATE mutations: attempting to add `attendanceId` to a client attachment, add `clientId` to an attendance attachment, or set both to NULL -> all rejected by SQL Server check constraint.
- Tested service layer pre-validation (`attachmentService.saveAttachment` in `src/services/attachment.service.ts`: lines 94–104): throws `ValidationError` for dual or missing ownership before touching disk or database.

### 1.4 CPF Validation & Database Unique Constraint (Challenge 3, AC 62, D4)
- Tested mathematical MOD 11 algorithm with corrupted 1st check digit and corrupted 2nd check digit -> rejected with `ValidationError('CPF inválido')`.
- Tested 10 repetitive digit sequences (`000.000.000-00` through `999.999.999-99`) -> rejected with `ValidationError('CPF inválido')`.
- Tested malformed strings: length != 11, alphanumeric characters, SQL injection payloads (`12345678901' OR '1'='1`), script tags, empty strings -> rejected with `ValidationError`.
- Tested duplicate CPF in `ClientService.createClient`: throws `ConflictError('CPF já cadastrado para outro cliente')`.
- Tested normalization invariance: creating with unmasked `12345678909` and then masked `123.456.789-09` -> detected and rejected as duplicate.
- Tested client update: updating Client B's CPF to Client A's existing CPF -> rejected with `ConflictError`.
- Tested database engine level constraint: raw SQL insert (`$executeRawUnsafe`) of duplicate CPF into `Client` table -> SQL Server engine rejects with `Violation of UNIQUE KEY constraint 'Client_cpf_key'`.

### 1.5 Stock Unit Anti-Reuse & Client Isolation (Challenge 4, AC 59, AC 66, V16, V17, V18)
- Observed in `src/services/stock.service.ts` (lines 316–347):
  - Single-use unit (`!product.isReusable`): upon first usage, transitions to status `'Esgotado'`. Attempted second usage for SAME or DIFFERENT client is blocked with `ConflictError('Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17).')`.
  - Reusable unit (`product.isReusable`): multi-session reuse by SAME client succeeds, unit transitions to `'EmUso'` with `currentClientId` assigned. Attempted usage by a DIFFERENT client throws `ConflictError('Esta unidade de estoque já está vinculada a outro cliente.')`.
- Tested API route `POST /api/attendances/[id]/usages` directly:
  - Attempting cross-client reuse of reusable unit -> returns HTTP 409 Conflict with `"Esta unidade de estoque já está vinculada a outro cliente."`.
  - Attempting second usage of single-use unit -> returns HTTP 409 Conflict with single-use message.
- Tested database atomicity: when an invalid usage attempt fails, the Prisma transaction rolls back cleanly with zero records inserted into `ProductUsage` and zero alterations to the unit's ownership or status.

### 1.6 Full Test Suite & Linter Conformance
- Executed `npm run lint`:
  ```
  ✔ No ESLint warnings or errors
  ```
- Executed all test tiers against `PopoAppTest`:
  - Tier 1 (`tests/tier1_features/`): 14/14 test files passed, 92/92 tests passed.
  - Tier 2 (`tests/tier2_boundaries/`): 18/18 test files passed, 76/76 tests passed.
  - Tier 3 (`tests/tier3_combinations/`): 3/3 test files passed, 7/7 tests passed.
  - Tier 4 (`tests/tier4_workflows/`): 1/1 test file passed, 5/5 tests passed.
  - Tier 5 (`tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts`): 1/1 test file passed, 33/33 tests passed.

---

## 2. Logic Chain

1. **Premise 1 (AC 60 Protection)**: Every protected API endpoint must enforce authentication.  
   *Evidence*: Observation 1.2 shows that Next.js middleware rejects all unauthenticated and tampered requests with HTTP 401 JSON. Route handlers also directly invoke `requireAuth(request)`, guaranteeing defense-in-depth even if middleware were bypassed.

2. **Premise 2 (AC 61 Attachment XOR)**: Exclusivity between Client and Attendance must be enforced by the SQL Server engine, not just service code.  
   *Evidence*: Observation 1.3 shows that direct SQL statements bypassing the application layer fail with SQL Server Msg 547 (`CK_Attachment_Ownership` CHECK constraint). Valid single-ownership rows succeed.

3. **Premise 3 (AC 62 & D4 CPF Integrity)**: CPF validation must be mathematical, normalization-invariant, and backed by a database unique constraint.  
   *Evidence*: Observation 1.4 confirms that invalid checksums and malformed inputs fail validation; masked and unmasked representations collide predictably; and direct raw SQL duplicate inserts fail against `Client_cpf_key`.

4. **Premise 4 (AC 59 & AC 66 Stock Unit Invariants)**: Single-use products cannot be reused; reusable units cannot cross client boundaries.  
   *Evidence*: Observation 1.5 confirms that single-use units exhaust to `Esgotado` and reject 2nd usages; reusable units track `currentClientId` and reject cross-client usage in both domain services and API route handlers (`POST /api/attendances/[id]/usages`) with HTTP 409.

5. **Premise 5 (Non-Regression)**: Existing tests and code quality must not degrade.  
   *Evidence*: Observation 1.6 confirms 0 lint errors/warnings and 100% pass rate across Tiers 1–4 and Tier 5.

---

## 3. Caveats

- **Concurrent Test Runs**: All tests execute against a single LocalDB database (`PopoAppTest`). When multiple subagents run test suites simultaneously, concurrent calls to `cleanTestDatabase()` (`DELETE FROM [...]`) will cause transactional lock conflicts or deadlocks (`Msg 1205`). Test executions must run sequentially or isolated per worker.
- **Scope Limit**: Performance under high-concurrency DDoS or network flooding was not evaluated, as PopoApp is designed as a single-professional desktop/local application per project specifications.

---

## 4. Conclusion

**Verdict: APPROVE.**

The PopoApp implementation demonstrates exceptional structural robustness under adversarial conditions:
1. Protected API routes strictly reject unauthenticated requests with HTTP 401 across both middleware and route handlers.
2. The Attachment XOR constraint is enforced at the database engine level via `CK_Attachment_Ownership`.
3. CPF integrity is safeguarded mathematically, service-side, and at the database schema level via `Client_cpf_key`.
4. Product unit tracking enforces strict single-use depletion and cross-client reuse blocking with user-friendly Portuguese error messages and HTTP 409 status codes.
5. All 33 adversarial test cases in `tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts` pass cleanly (100%), and `npm run lint` reports 0 errors.

---

## 5. Verification Method

To independently verify these findings, execute:

1. **Lint Check**:
   ```powershell
   npm run lint
   ```
   *Expected*: `✔ No ESLint warnings or errors`.

2. **Adversarial Security Test Suite**:
   ```powershell
   npx vitest run tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts
   ```
   *Expected*: 33 passed (100% pass rate in ~4 seconds).

3. **Database Constraint Engine Verification**:
   Inspect `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` and `tests/tier5_adversarial/m6_adversarial_security_rules.spec.ts` section 2 to observe live SQL Server error assertions against `CK_Attachment_Ownership`.

4. **Invalidation Conditions**:
   - If an unauthenticated request to any protected route returns HTTP 200, 302, or 500 instead of 401 JSON.
   - If SQL Server accepts an Attachment row with both `clientId` and `attendanceId` populated.
   - If duplicate CPFs are allowed into the database.
   - If a single-use unit or cross-client reusable unit can be consumed twice without error.
