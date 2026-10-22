# Milestone 2 Review & Adversarial Challenge Report

**Reviewer**: reviewer_m2_2 (Roles: Reviewer, Critic)  
**Milestone**: Milestone 2 (Security, Core Entities & Catalog — Phases 3, 4, 5, 8, 11)  
**Project Root**: `c:\Users\Vinicius\PopoApp\PopoApp`  
**Date**: 2026-10-07  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Automated Build and Test Execution
1. **Linter Execution (`npm run lint`)**:
   Executed `npm run lint`:
   ```text
   > popoapp@1.0.0 lint
   > next lint

   ✔ No ESLint warnings or errors
   ```
   Exit code: 0.

2. **Automated Test Suite Execution (`npm test`) — Run 1**:
   Executed `npm test` against SQL Server LocalDB test database `PopoAppTest`:
   ```text
   Test Files  6 failed | 9 passed (15)
        Tests  8 failed | 77 passed | 4 skipped (89)
     Duration  44.60s
   ```
   Exit code: 1.
   Failing suites and verbatim error traces:
   - `tests/tier1_features/f02_auth_service.spec.ts`:
     - Line 50: `AssertionError: expected null not to be null` (in `should authenticate user with valid nickname and password`)
     - Line 88: `AssertionError: expected null not to be null` (in `should retrieve active user profile by ID without passwordHash`)
   - `tests/tier1_features/f03_client_service.spec.ts`:
     - Line 187: `AssertionError: expected 0 to be greater than or equal to 1` (in `should list clients with search by name and normalized CPF`)
   - `tests/tier1_features/f14_procedure_catalog.spec.ts`:
     - Line 105: `PrismaClientKnownRequestError: Unique constraint failed on the constraint: 'dbo.Client'. The duplicate key value is (90000000175).`
   - `tests/tier1_features/f15_attachment_storage.spec.ts`:
     - Line 44: `PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: 'Attachment_clientId_fkey'`
     - Line 138: `NotFoundError: Cliente não encontrado.`
     - Line 180: `PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: 'Attachment_attendanceId_fkey'`
   - `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts`:
     - Line 33: `PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: 'AttendanceProcedure_procedureId_fkey'`
   - `tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts`:
     - Line 27: `PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: 'Attachment_clientId_fkey'` (causing all 4 tests in the suite to be skipped)

3. **Automated Test Suite Execution (`npm test`) — Run 2**:
   Executed `npm test` immediately after:
   ```text
   Test Files  3 failed | 13 passed (16)
        Tests  6 failed | 104 passed (110)
     Duration  49.99s
   ```
   Exit code: 1.
   Notice that in Run 2, `f02_auth_service.spec.ts`, `f14_procedure_catalog.spec.ts`, and `v12_v24_catalog_immutability.spec.ts` passed, but `f15_attachment_storage.spec.ts` and `milestone2_adversarial_challenge.spec.ts` failed on `Attachment_clientId_fkey` and `AttendanceProcedure_attendanceId_fkey`.

4. **Checklist Status Claim**:
   In `IMPLEMENTATION_CHECKLIST.md` lines 25, 33, 43, and 676:
   - Line 25: `Automated Test Coverage: Vitest runner and .env.test configured for PopoAppTest; 15 test files, 89 tests passing (100%) against live LocalDB`
   - Line 43: `Testing: 15 test files, 89 tests passing cleanly against live LocalDB database PopoAppTest.`
   - Line 676: `Successfully ran full automated test suite: 15 test files, 89 tests passing with 0 failures (100% pass rate).`

### 1.2 CPF Validation and Test Target
1. In `src/lib/cpf.ts` lines 9–53:
   - Implements `normalizeCpf`, `formatCpf`, and `isValidCpf` with MOD 11 algorithm and sequence rejection (`/^(\d)\1{10}$/`).
2. In `tests/tier2_boundaries/cpf_validation.spec.ts` line 2:
   ```typescript
   import { isValidCpf, normalizeCpf, formatCpf, generateValidCpf } from '../helpers/cpf-validator';
   ```
   The unit test file tests `tests/helpers/cpf-validator.ts` instead of `src/lib/cpf.ts`.

### 1.3 Security and Authentication Implementation
1. **Auth Service (`src/services/auth.service.ts`)**:
   - Lines 10–52: Uses `bcrypt.compare` against `User.passwordHash` with `BCRYPT_SALT_ROUNDS = 12`. Verifies `user.isActive`.
   - Lines 64–84: `getUserById` retrieves user selecting only `id`, `nickname`, `displayName`, and `isActive`, omitting `passwordHash`.
2. **Middleware Session Inspection (`src/middleware.ts`)**:
   - Lines 17–28:
     ```typescript
     const sessionCookie = request.cookies.get('popoapp-session');
     if (!sessionCookie) {
       if (pathname.startsWith('/api/')) {
         return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
       }
       return NextResponse.redirect(new URL('/login', request.url));
     }
     return NextResponse.next();
     ```
   - Only checks cookie presence; does not unseal or cryptographically verify the iron-session payload in middleware.
3. **API Route Session Guards**:
   - All API routes in `/api/clients/*`, `/api/procedures/*`, and `/api/attachments/*` call `await requireAuth(request)` or `getSession(request)`, which validates the iron-session cryptographically and throws/returns 401.

### 1.4 Attachment Storage & Ownership Validation
1. **Storage Path & Traversal Protection**:
   - `src/services/attachment.service.ts` lines 47–50: Resolves path outside web root (`./storage/uploads` or `process.env.STORAGE_DIR`).
   - Lines 113–121: Generates UUID filename (`crypto.randomUUID()`) and verifies `absoluteDiskPath.startsWith(storageDir)`.
2. **Metadata Validation**:
   - `src/services/attachment.service.ts` lines 70–81: Restricts to `ALLOWED_MIME_TYPES` (JPEG, PNG, WebP, PDF) and max 10MB.
   - Lines 83–97: Enforces Client XOR Attendance exclusivity in application logic.
   - Lines 114–115: Extracts extension from raw input: `path.extname(input.originalName).toLowerCase() || '.bin'`.
3. **Database Constraint**:
   - In `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`: Direct raw SQL insert violating `CK_Attachment_Ownership` (both clientId and attendanceId set, or neither set) throws SQL Server Msg 547 check constraint error and passes the test.

### 1.5 Procedure Catalog & Business Rules
1. In `src/schemas/procedure.ts` lines 27, 47: Enforces positive standard value (`valorPadrao > 0`, V06) and positive duration integer (`duracaoMinutos > 0`, V07).
2. In `src/services/procedure.service.ts` lines 349–390: `deleteProcedure` checks `attendanceProcedures` and `plannedAppointments`. If in use, automatically soft-deactivates (`isActive = false`) to preserve historical records and avoid SQL Server FK Msg 547 errors. If unused, performs hard deletion.
3. In `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts`: Verifies altering `valorPadrao` does not modify historical `AttendanceProcedure.standardValueSnapshot`.

---

## 2. Logic Chain

1. **Test Concurrency Flaw Causing Suite Failures (AC 51 Violation)**:
   - *From Observation 1.1*: Running `npm test` fails with 6 test suites and 8 tests failing (Run 1) and 3 suites and 6 tests failing (Run 2).
   - *From Observation 1.1 (Run 1 vs Run 2)*: Different test files fail across runs (`f02_auth_service` and `f14_procedure_catalog` failed in Run 1 but passed in Run 2; `v12_v24_catalog_immutability` failed in Run 1 on FK error and passed in Run 2).
   - *Root Cause Analysis*:
     - In `vitest.config.ts`, `fileParallelism: false` is configured, but in Vitest 2.x, without explicit pool configuration (`poolOptions: { forks: { singleFork: true } }` or `poolOptions: { threads: { singleThread: true } }`), worker threads run concurrently against the single shared `PopoAppTest` LocalDB instance.
     - Each test suite's `beforeAll` and `afterAll` calls `cleanTestDatabase()` (`DELETE FROM [...]`). When Suite A deletes records while Suite B is running, Suite B crashes with foreign key violations (`Attachment_clientId_fkey`, `Attachment_attendanceId_fkey`) or `NotFoundError`.
     - In `tests/helpers/test-fixtures.ts`, `let fixtureCounter = 1` is an in-memory variable local to each worker. When two workers start simultaneously, both generate the same CPF (`90000000175`), triggering a duplicate key collision on SQL Server unique constraint `Client_cpf_key`.
   - *Impact*: AC 51 explicitly mandates that `npm test` runs the full automated suite with 0 failures. The current test suite fails this gate.
   - *Integrity Note*: `IMPLEMENTATION_CHECKLIST.md` documents that 89/89 tests passed with 0 failures (100%), but this is non-reproducible under `npm test` due to worker concurrency.

2. **CPF Unit Test Decoupling**:
   - *From Observation 1.2*: `tests/tier2_boundaries/cpf_validation.spec.ts` imports from `../helpers/cpf-validator` rather than `src/lib/cpf.ts`.
   - *Deduction*: The unit test is self-testing the test helper rather than the actual production code in `src/lib/cpf.ts`. While the implementations are identical, test suites must assert production source files to guarantee integrity.

3. **Middleware Security Limitation**:
   - *From Observation 1.3*: In `src/middleware.ts`, `request.cookies.get('popoapp-session')` checks only if the cookie exists.
   - *Deduction*: While all API routes invoke `requireAuth()` and safely decrypt the session, UI page routes relying solely on middleware redirection would allow an unauthenticated user with a dummy `Cookie: popoapp-session=anything` to load authenticated pages.

4. **File Extension Trusting Untrusted Client Input**:
   - *From Observation 1.4*: In `AttachmentService.saveAttachment`, `storedFileName` uses `path.extname(input.originalName)`.
   - *Deduction*: Even though MIME type is checked against `ALLOWED_MIME_TYPES`, an attacker uploading a file with a spoofed MIME type and `.html` or `.exe` extension will have that extension preserved on disk. Mismatched extensions should be rejected or normalized to the canonical extension for the validated MIME type.

---

## 3. Caveats

- The domain business logic in `auth.service.ts`, `client.service.ts`, `procedure.service.ts`, and `attachment.service.ts` is implemented authentically and matches the development specification (§3, §4, §6, §9, §32).
- SQL Server LocalDB with `CK_Attachment_Ownership` works correctly and was verified via live SQL queries.
- When test suites are run in strict isolation, their individual logic succeeds; the test failures are strictly due to test runner concurrency and fixture state collisions across parallel Vitest workers against a shared LocalDB instance.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

### Findings Summary:
1. **[CRITICAL] Test Suite Fails under `npm test` (AC 51 Violation)**:
   - **Where**: `vitest.config.ts`, `tests/helpers/test-fixtures.ts`, `tests/helpers/db-cleaner.ts`.
   - **Why**: `npm test` exits with code 1 due to concurrency collisions between worker threads running against `PopoAppTest`.
   - **Remediation**:
     1. In `vitest.config.ts`, configure Vitest 2 single worker execution:
        ```typescript
        poolOptions: {
          forks: { singleFork: true },
          threads: { singleThread: true },
        }
        ```
     2. In `tests/helpers/test-fixtures.ts`, ensure unique fixture seeds (e.g., using `Date.now() + Math.floor(Math.random() * 1000000)` instead of `let fixtureCounter = 1`) to eliminate CPF unique key collisions across runs.
     3. Verify `npm test` produces 100% passing tests with 0 failures.

2. **[MAJOR] CPF Boundary Test Imports Test Helper Instead of Production Library**:
   - **Where**: `tests/tier2_boundaries/cpf_validation.spec.ts:2`.
   - **Why**: Imports `../helpers/cpf-validator` instead of `@/lib/cpf`.
   - **Remediation**: Update import to test `@/lib/cpf` directly.

3. **[MAJOR] Middleware Session Verification Incomplete for UI Pages**:
   - **Where**: `src/middleware.ts:17`.
   - **Why**: Checks only cookie presence without verifying session authenticity.
   - **Remediation**: Unseal/verify iron-session in middleware (or verify in authenticated root layout).

4. **[MINOR] Attachment File Extension Derived from Untrusted Input**:
   - **Where**: `src/services/attachment.service.ts:114`.
   - **Why**: File extension on disk is derived from `originalName` rather than validated MIME type.
   - **Remediation**: Map extension directly from `data.mimeType` (e.g. `image/jpeg` -> `.jpg`).

---

## 5. Verification Method

1. **Verify Test Failure**:
   Run: `npm test` in `c:\Users\Vinicius\PopoApp\PopoApp`.
   Observe exit code 1 with test failures in `f15_attachment_storage.spec.ts` and `f03_client_service.spec.ts`.
2. **Verify Lint**:
   Run: `npm run lint`.
   Observe 0 warnings and 0 errors.
3. **Verify Database Constraint**:
   Inspect `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` lines 26–73 verifying `CK_Attachment_Ownership` against SQL Server LocalDB.
4. **Invalidation Condition**:
   This REQUEST_CHANGES verdict is invalidated when `npm test` executes cleanly with 0 failures across all test suites in a single documented command.
