# Handoff Report — Empirical Challenge Milestone 2 Iteration 2

**Agent**: challenger_m2_it2_1  
**Target**: PopoApp Milestone 2 Iteration 2 (commit `5a17482`)  
**Date**: 2026-10-16T00:43:00Z  
**Verdict**: **APPROVE**

---

## 1. Observation

Direct empirical observations gathered via automated test execution and shell commands against Microsoft SQL Server LocalDB (`PopoAppTest`) using Vitest (`npm test`), ESLint (`npm run lint`), and Next.js compiler (`npm run build`).

### 1.1 Database Isolation & LocalDB Environment (D7)
- **LocalDB Instance Status**:
  Command: `sqllocaldb info MSSQLLocalDB`
  Output:
  ```
  Nome: "MSSQLLocalDB"
  Versão: 15.0.4153.1
  Estado: Executando
  Nome do pipe da instância: np:\\.\pipe\LOCALDB#034D9441\tsql\query
  ```
- **Connection Isolation Guards**:
  - `src/lib/prisma.ts:8-18`: `resolveDatabaseUrl()` enforces:
    ```ts
    if (process.env.NODE_ENV === 'test') {
      if (!url || !/database=PopoAppTest(;|$)/i.test(url)) {
        throw new Error(
          `[D7] Ambiente de teste deve usar o banco PopoAppTest. DATABASE_URL atual: ${url ?? '(vazio)'}`
        );
      }
    }
    ```
  - `tests/helpers/db-client.ts:6-10`: enforces safety guard `if (!/database=PopoAppTest(;|$)/i.test(TEST_DATABASE_URL))` and exports `prismaTest = prisma` (sharing the exact singleton instance as domain services to prevent split-brain connections).
  - `.env.test:2`: `DATABASE_URL="sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT"`
  - `vitest.config.ts:7,18-26`: loads `.env.test` with `override: true`, sets `NODE_ENV: 'test'`, `singleFork: true`, `fileParallelism: false`, `maxConcurrency: 1` to guarantee sequential test execution without concurrency contention on LocalDB.

### 1.2 Full Test Suite Execution (`npm test`)
- **Command**: `npm test`
- **Output verbatim**:
  ```
  > popoapp@1.0.0 test
  > vitest run

   RUN  v2.1.9 C:/Users/Vinicius/PopoApp/PopoApp

   ✓ tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts (21 tests) 2432ms
   ✓ tests/tier5_adversarial/milestone2_client_adversarial.spec.ts (24 tests) 2412ms
   ✓ tests/tier4_workflows/scenarios_a_through_e.spec.ts (5 tests) 2414ms
   ✓ tests/tier3_combinations/appointment_attendance_d1.spec.ts (5 tests) 2361ms
   ✓ tests/tier1_features/f15_attachment_storage.spec.ts (7 tests) 2294ms
   ✓ tests/tier1_features/f03_client_service.spec.ts (10 tests) 4372ms
     ✓ Feature F03: Client Management Domain Service (Phase 4, D4, AC 62) > should list clients with search by name and normalized CPF 2089ms
   ✓ tests/tier1_features/f14_procedure_catalog.spec.ts (7 tests) 2324ms
   ✓ tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts (4 tests) 2247ms
   ✓ tests/tier1_features/f02_auth_service.spec.ts (10 tests) 3340ms
     ✓ Feature F02: Authentication Service & Security (Phase 3) > should generate valid bcrypt hash matching plaintext 448ms
   ✓ tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts (4 tests) 2254ms
   ✓ tests/tier1_features/f03_client_model.spec.ts (5 tests) 2234ms
   ✓ tests/tier2_boundaries/cpf_validation.spec.ts (12 tests) 3ms
   ✓ tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts (5 tests) 3ms
   ✓ tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts (1 test) 2269ms
   ✓ tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts (5 tests) 1ms
   ✓ tests/tier2_boundaries/middleware_session.spec.ts (6 tests) 7ms
   ✓ tests/tier2_boundaries/v06_procedure_positive_value.spec.ts (4 tests) 2ms
   ✓ tests/tier1_features/f01_tooling.spec.ts (5 tests) 2ms

   Test Files  18 passed (18)
        Tests  140 passed (140)
     Duration  32.74s
  ```
- **Result**: Exactly 18 test files executed, 140 tests executed, 140 passed, 0 failed, 0 skipped (100% pass rate).

### 1.3 Adversarial Coverage Inspection

#### A. Attachment XOR Ownership & File Boundaries (`tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts`)
- **Database CHECK Constraint Enforcement (AC 61, V14)**:
  - Raw SQL insert attempting to populate BOTH `clientId` and `attendanceId` failed with SQL Server CHECK constraint violation (`ck_attachment_ownership`), verbatim:
    `check constraint 'CK_Attachment_Ownership' conflict`.
  - Raw SQL insert attempting to populate NEITHER `clientId` nor `attendanceId` failed with SQL Server CHECK constraint violation (`ck_attachment_ownership`).
  - Raw SQL insert with ONLY `clientId` succeeded and verified in database (`attendanceId IS NULL`).
  - Raw SQL insert with ONLY `attendanceId` succeeded and verified in database (`clientId IS NULL`).
- **Service Layer Invariants (`attachmentService.saveAttachment`)**:
  - Calling `saveAttachment` with both `clientId` and `attendanceId` threw `ValidationError: "Anexo deve pertencer a um Cliente OU a um Atendimento, exclusivamente."`.
  - Calling `saveAttachment` with neither `clientId` nor `attendanceId` threw `ValidationError`.
  - Calling with whitespace strings threw `ValidationError`.
- **File Storage Boundaries & Path Traversal Prevention**:
  - Oversized payload (10MB + 1 byte) threw `ValidationError: "Tamanho do arquivo excede o limite máximo permitido de 10 MB."`.
  - 0-byte or negative size payloads threw `ValidationError`.
  - Dangerous MIME types (`.exe`, `.sh`, `.html`, `.js`, `.php`, `.svg`, `.zip`) strictly rejected with `ValidationError: "Tipo de arquivo não permitido"`.
  - Path traversal sequences (`../../../../etc/passwd.pdf`, `..\..\..\windows\system32\calc.exe.pdf`, etc.) safely sanitized to UUID file names (`^[0-9a-f-]{36}\.pdf$`) confined within storage directory.
  - `attachmentService.getAbsoluteFilePath` with tampered path threw `ValidationError: "Caminho de arquivo inseguro detectado."`.

#### B. Procedure Catalog Boundaries & Soft Deactivation
- Standard value = 0 or < 0 rejected by schema and API route (`POST /api/procedures` returned 400).
- Category missing or whitespace rejected by schema and API route.
- Soft Deactivation vs Hard Deletion:
  - Deleting an unused procedure permanently removed the record (`hard delete`).
  - Deleting a procedure referenced in clinical history (`AttendanceProcedure`) soft-deactivated the record (`isActive: false`), keeping historical data intact while excluding it from active query lists.
  - Procedure can be reactivated via `toggleProcedureActive(id, true)`.

#### C. Route Security & Middleware Token Verification (`tests/tier2_boundaries/middleware_session.spec.ts`)
- Unauthenticated requests to `/clientes` redirected to `/login` with HTTP 307.
- Unauthenticated API requests (`/api/clients`, `/api/attachments/[id]`, `/api/procedures`, `/api/procedures/[id]`) returned HTTP 401 with JSON `{ success: false, error: 'Não autorizado' }`.
- Forged/corrupted session cookies (`popoapp-session=forged_token_value`) failed cryptographic unseal via `unsealData` from `iron-session`, resulting in HTTP 307 on pages and HTTP 401 on APIs.
- Validly sealed cookies with `isLoggedIn: false` returned HTTP 401 on APIs.
- Legitimate sealed logged-in sessions passed through with HTTP 200 and `x-middleware-next: 1`.
- Public routes (`/login`, `/api/auth/login`) remained accessible without session cookie.

#### D. Malformed and Duplicate CPFs (`tests/tier5_adversarial/milestone2_client_adversarial.spec.ts`)
- All 10 repetitive sequences (`000...00` to `999...99`) in masked and unmasked forms rejected by `isValidCpf`.
- Corrupted check digit 1 (D1), check digit 2 (D2), and both corrupted rejected.
- Length errors (0, 1, 2, 8, 10, 12, 20 digits) rejected.
- SQL injection (`12345678901; DROP TABLE Client; --`), XSS (`<script>`), and Unicode emojis rejected.
- `ClientService.createClient` and `ClientService.updateClient` threw `ValidationError` for malformed CPFs.
- Duplicate CPF on creation rejected with `ConflictError: "CPF já cadastrado para outro cliente"`.
- Collision between formatted mask and unmasked digits correctly detected and blocked.
- Direct raw insert via Prisma bypassing service layer threw Prisma error `P2002` on `UNIQUE KEY constraint 'Client_cpf_key'`.
- Self-update of client with own CPF allowed; updating to another client's CPF blocked with `ConflictError`.

#### E. Emergency Contacts Edge Cases & Database Cleanup Invariant
- Empty contacts array and omitted property created client with 0 contacts cleanly.
- Strict ordering preserved for multiple emergency contacts (order 1, 2, 3).
- Chronological ordering preserved for sequentially added contacts.
- Complete lifecycle tested: addition, partial updates, soft deactivation (`isActive: false` filtered from active queries), and physical deletion.
- Schema rejects telephone strings < 8 or > 20 characters, short names (< 2 chars), and short parentesco (< 2 chars).
- `cleanTestDatabase()` safely truncated/deleted all 18 domain tables in dependency order (nulling self-referencing FKs and profile photo FKs first), leaving count 0 across all tables.
- Idempotency verified: re-inserting with the same CPF after cleanup succeeded with zero collision.

### 1.4 Code Linting and Production Build
- **`npm run lint`**: Executed with exit code 0 (`✔ No ESLint warnings or errors`).
- **`npm run build`**: Executed with exit code 0, compiling all 17/17 pages and dynamic API routes cleanly.

---

## 2. Logic Chain

1. **Observation 1.1** demonstrates that database isolation is strictly enforced at runtime by code guards (`src/lib/prisma.ts` and `tests/helpers/db-client.ts`), ensuring that tests can never touch the development database (`PopoApp`), fulfilling requirement D7.
2. **Observation 1.2** demonstrates that all 18 automated test suites comprising 140 individual test cases execute against the live LocalDB test database (`PopoAppTest`) and achieve a 100% pass rate with 0 failures and 0 skips.
3. **Observation 1.3.A** demonstrates that attachment ownership exclusivity (AC 61) is enforced at both the database level via a SQL Server CHECK constraint (`CK_Attachment_Ownership`) and at the service level (`ValidationError`). Storage paths are hardened against path traversal and oversized/dangerous file uploads.
4. **Observation 1.3.B** demonstrates that procedure catalog pricing invariants (positive standard values, mandatory categories) and historical auditability (soft deactivation when in clinical use) operate correctly.
5. **Observation 1.3.C** demonstrates that unauthenticated requests and forged iron-session tokens are rejected at the edge by Next.js middleware and route handlers, satisfying AC 60 and security boundaries.
6. **Observation 1.3.D** demonstrates that CPF validation adheres to Receita Federal MOD 11 specifications and that duplicate CPFs are blocked by both domain logic and the database unique key constraint (`Client_cpf_key`), satisfying binding decision D4 and AC 62.
7. **Observation 1.3.E** demonstrates that emergency contacts handle complex edge cases and that database cleanup is robust and idempotent without residual state.
8. **Observation 1.4** demonstrates that the entire codebase adheres to strict linting and builds to a production bundle without errors.
9. Therefore, Milestone 2 Iteration 2 (commit `5a17482`) is fully verified, robust against adversarial attacks, and ready for Milestone 3 progression.

---

## 3. Caveats

- Milestone 2 verifies Authentication, Client Management, Procedure Catalog, and Secure Attachment Storage.
- Milestone 3 domain services (Appointment 6-status scheduling machine, Attendance D1 state machine, reusable stock unit cross-client tracking, and Medical Records) and Milestone 4 financial engines (practiced pricing, dynamic total/outstanding calculations per D2, installment tracking) remain to be implemented and challenged in subsequent milestones.
- `tests/tier4_workflows/scenarios_a_through_e.spec.ts` exercises direct database models rather than domain services (since clinical domain services do not yet exist); as documented in the project specifications, these scenarios will be rewritten through domain services in Milestone 3/4.

---

## 4. Conclusion

**Verdict: APPROVE**

PopoApp Milestone 2 Iteration 2 (commit `5a17482`) satisfies all architectural requirements, relational constraints, security boundaries, and empirical challenge standards. All 18 test files and 140 automated tests pass with 0 failures, lint is clean, build is clean, and database isolation against `PopoAppTest` is strictly enforced.

---

## 5. Verification Method

To independently reproduce this verification:

1. **Verify LocalDB instance**:
   ```powershell
   sqllocaldb info MSSQLLocalDB
   ```
   *Expected outcome*: Estado: Executando.

2. **Execute full automated test suite**:
   ```powershell
   npm test
   ```
   *Expected outcome*: 18 test files pass, 140 tests pass, 0 failures.

3. **Verify lint and production build**:
   ```powershell
   npm run lint
   npm run build
   ```
   *Expected outcome*: 0 lint errors, 17/17 pages generated cleanly.

4. **Inspect adversarial test suites**:
   - `tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts` (lines 80–180 for XOR constraint; lines 182–292 for file boundaries/path traversal; lines 294–476 for procedure boundaries/soft deactivation; lines 478–653 for route security/middleware).
   - `tests/tier5_adversarial/milestone2_client_adversarial.spec.ts` (lines 26–178 for malformed CPFs; lines 181–291 for duplicate CPFs; lines 294–414 for missing required fields; lines 416–621 for emergency contacts edge cases; lines 623–697 for DB cleanup invariant).
   - `tests/tier2_boundaries/middleware_session.spec.ts` (lines 12–51 for forged/unsealed session token testing).
   - `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` (lines 26–117 for raw SQL database-level XOR tests).
