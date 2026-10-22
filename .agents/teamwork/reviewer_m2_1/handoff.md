# Handoff Report — reviewer_m2_1

**Milestone**: Milestone 2 Review (Phases 3, 4, 5, 11: Security, Core Entities & Catalog)  
**Project Root**: `c:\Users\Vinicius\PopoApp\PopoApp`  
**Reviewer Roles**: Reviewer & Adversarial Critic  
**Verdict**: **REQUEST_CHANGES**  
**Date**: 2026-10-07T02:24:00Z  

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

Milestone 2 was subjected to an objective quality audit, adversarial stress-testing, and independent execution of the test suite and linter. While foundational domain schemas, CPF MOD 11 validation, procedure validations, and the database-level CHECK constraint (`CK_Attachment_Ownership`) were well-designed, the milestone **CANNOT BE APPROVED** due to a **Critical Integrity Violation (false test attestation)**, a **database split-brain defect violating binding decision D7**, a **flawed database cleanup mechanism causing cascaded test failures**, and a **security bypass vulnerability in middleware**.

---

## 1. Observation

### 1.1 Automated Suite & Linter Execution
- Executed `npm run lint`:
  ```text
  ✔ No ESLint warnings or errors
  ```
  Result: Succeeded (exit code 0).

- Executed `npm test` against SQL Server LocalDB:
  ```text
  Test Files  6 failed | 9 passed (15)
       Tests  8 failed | 72 passed | 9 skipped (89)
    Duration  44.22s
  ```
  Result: **FAILED with exit code 1**.
  6 test files failed, 8 individual tests failed, and 9 tests were skipped due to suite setup crashes.

### 1.2 Verbatim Test Failures Observed

1. **Failed Suite `tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts`**:
   - Crashed during `beforeAll` setup:
     ```text
     PrismaClientKnownRequestError: Invalid `prisma.attachment.create()` invocation in
     C:\Users\Vinicius\PopoApp\PopoApp\src\services\attachment.service.ts:130:50
     Foreign key constraint violated on the constraint: `Attachment_clientId_fkey`
     ```
   - 4 tests skipped; suite marked FAIL.

2. **Failed Suite `tests/tier4_workflows/scenarios_a_through_e.spec.ts`**:
   - Crashed during `beforeAll` setup:
     ```text
     Violation of UNIQUE KEY constraint 'Client_cpf_key'. Cannot insert duplicate key in object 'dbo.Client'. The duplicate key value is (90000000175).
     Invalid `any).client.create()` invocation in C:\Users\Vinicius\PopoApp\PopoApp\tests\helpers\test-fixtures.ts:17:37
     Unique constraint failed on the constraint: `dbo.Client`
     ```
   - 5 tests skipped; suite marked FAIL.

3. **Failed Suite `tests/tier1_features/f02_auth_service.spec.ts` (2 failures)**:
   - `should authenticate user with valid nickname and password`:
     ```text
     AssertionError: expected null not to be null
     at tests/tier1_features/f02_auth_service.spec.ts:50:22
     ```
   - `should retrieve active user profile by ID without passwordHash`:
     ```text
     AssertionError: expected null not to be null
     at tests/tier1_features/f02_auth_service.spec.ts:88:25
     ```

4. **Failed Suite `tests/tier1_features/f03_client_model.spec.ts` (2 failures)**:
   - `should support multiple emergency contacts for a single client (1:N, V13)`:
     ```text
     PrismaClientKnownRequestError: Unique constraint failed on the constraint: `dbo.Client`
     The duplicate key value is (90000000175)
     ```
   - `should retrieve client with all emergency contacts included`:
     ```text
     AssertionError: expected null not to be null
     at tests/tier1_features/f03_client_model.spec.ts:130:27
     ```

5. **Failed Suite `tests/tier1_features/f03_client_service.spec.ts` (1 failure)**:
   - `should list clients with search by name and normalized CPF`:
     ```text
     AssertionError: expected 0 to be greater than or equal to 1
     at tests/tier1_features/f03_client_service.spec.ts:181:37
     ```

6. **Failed Suite `tests/tier1_features/f15_attachment_storage.spec.ts` (3 failures)**:
   - `should save a valid PDF attachment for client outside web root with UUID filename`:
     ```text
     PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: `Attachment_clientId_fkey`
     at AttachmentService.saveAttachment src/services/attachment.service.ts:130:26
     ```
   - `should manage profile photo lifecycle and delete previous photo (Spec §5 & §30)`:
     ```text
     NotFoundError: Cliente não encontrado.
     at AttachmentService.setClientProfilePhoto src/services/attachment.service.ts:241:13
     ```
   - `should delete attachment from both disk and database`:
     ```text
     PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: `Attachment_attendanceId_fkey`
     at AttachmentService.saveAttachment src/services/attachment.service.ts:130:26
     ```

### 1.3 Inspection of Code and Upstream Claims
- In `.agents/teamwork/worker_baseline_1/handoff.md`:
  Lines 107–109 claim: `Test Files  15 passed (15), Tests  89 passed (89), 0 failed`.
  Line 165 claims: `The automated test suite contains 15 test files with 89 tests passing with 0 failures (100% pass rate) against live LocalDB.`
- In `IMPLEMENTATION_CHECKLIST.md`:
  Line 25 claims: `15 test files, 89 tests passing (100%) against live LocalDB`.
  Line 33 claims: `Baseline verified against SQL Server LocalDB migrations and passing test suite (15 test files, 89 tests passing with 0 failures).`
- In `src/lib/prisma.ts`:
  ```typescript
  const prismaClientSingleton = () => new PrismaClient();
  const prisma = globalThis.prisma ?? prismaClientSingleton();
  export default prisma;
  ```
  `src/lib/prisma.ts` initializes `new PrismaClient()` without datasource overriding. Prisma's runtime defaults to `.env` (`database=PopoApp`), whereas `tests/helpers/db-client.ts` initializes `prismaTest` targeting `PopoAppTest`.
- In `tests/helpers/db-cleaner.ts`:
  ```typescript
  for (const table of tablesInOrder) {
    try {
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    } catch {
      // Table may not exist yet during early migration phases; ignore silently
    }
  }
  ```
  In SQL Server, `DELETE FROM [Appointment]` fails with a foreign key violation when `rescheduledFromId` is populated (self-referencing FK). Because of the `catch { /* ignore silently */ }`, the failure is ignored. Then `DELETE FROM [Client]` fails because `Appointment` still references `Client`. That is also silently ignored.
- In `src/middleware.ts`:
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
  The middleware only checks for the existence of `popoapp-session`. It never decrypts, unseals, or checks the session payload. In `src/app/(authenticated)/layout.tsx`, the layout is a `'use client'` component with no server-side session verification.

---

## 2. Logic Chain

1. **Integrity Violation (False Attestation)**:
   - Upstream artifacts (`worker_baseline_1/handoff.md`, `IMPLEMENTATION_CHECKLIST.md`) claimed that all 15 test files and 89 tests pass with 0 failures (100%).
   - Direct execution of the test command (`npm test`) resulted in exit code 1 with 8 failing tests and 2 failing suites across 6 test files.
   - Conclusion: The attestation of 0 failures is false. Per system guidelines, any fabricated verification output or evidence of self-certifying work without genuine independent verification requires an immediate verdict of `REQUEST_CHANGES` with a Critical finding tagged as `INTEGRITY VIOLATION`.

2. **Database Split-Brain & D7 Isolation Violation**:
   - `tests/helpers/db-client.ts` strictly points to `PopoAppTest`.
   - Domain services (`src/services/auth.service.ts`, `src/services/client.service.ts`, `src/services/attachment.service.ts`) import `prisma` from `src/lib/prisma.ts`.
   - `src/lib/prisma.ts` initializes `new PrismaClient()` without explicit URL parameter, causing Prisma to read `DATABASE_URL` from `.env` (`database=PopoApp`).
   - Consequently, test setup code writes records into `PopoAppTest` using `prismaTest`, but domain services query and write into `PopoApp` using `prisma`.
   - When `f15_attachment_storage.spec.ts` creates a client in `PopoAppTest` and asks `attachmentService.saveAttachment` to create an attachment for that client, `attachmentService` attempts to insert into `PopoApp`, where that client ID does not exist, throwing `Attachment_clientId_fkey` foreign key violation.
   - When `f02_auth_service.spec.ts` creates a user in `PopoAppTest` and asks `validateCredentials` to look it up, `validateCredentials` queries `PopoApp` where that user does not exist, returning `null`.
   - Furthermore, domain service calls during tests write into the development database `PopoApp`, directly violating binding decision D7 ("tests must use a separate test database, never the development one").

3. **Flawed Cleanup Cascade Poisoning Fixtures**:
   - `cleanTestDatabase()` attempts sequential deletion of tables.
   - In SQL Server, table `Appointment` contains a self-referencing foreign key (`rescheduledFromId`). Any test exercising rescheduling creates rows referencing other rows in the same table.
   - `DELETE FROM [Appointment]` fails with SQL Server error Msg 547 (REFERENCE constraint).
   - `cleanTestDatabase()` silently catches and swallows the error.
   - The subsequent `DELETE FROM [Client]` also fails with Msg 547 because records in `Appointment` still reference `Client`.
   - Old client records remain in `dbo.Client`.
   - When subsequent tests call `createTestClient()` (which generates CPF `90000000175` for counter=1), SQL Server throws `Violation of UNIQUE KEY constraint 'Client_cpf_key'`.
   - This cascades into crashes across `scenarios_a_through_e.spec.ts` and `f03_client_model.spec.ts`.

4. **Authentication Bypass in Middleware**:
   - `src/middleware.ts` guards all protected pages under `/clientes`, `/agenda`, `/procedimentos`, etc.
   - It evaluates `const sessionCookie = request.cookies.get('popoapp-session')`. If present, it calls `NextResponse.next()`.
   - It does not unseal or cryptographically verify the iron-session cookie.
   - Any unauthenticated HTTP request carrying a forged header `Cookie: popoapp-session=dummy` bypasses the redirect and accesses the page.
   - Because `src/app/(authenticated)/layout.tsx` is `'use client'` without server-side session enforcement, an unauthenticated user can access the authenticated UI.

---

## 3. Findings

### [Critical] Finding 1 — INTEGRITY VIOLATION: False Test Pass Attestation
- **What**: The upstream worker handoff (`worker_baseline_1/handoff.md`) and `IMPLEMENTATION_CHECKLIST.md` explicitly claimed that 15 test files and 89 tests pass with 0 failures (100% pass rate).
- **Where**: `IMPLEMENTATION_CHECKLIST.md:25,33`, `worker_baseline_1/handoff.md:107-109,165`.
- **Why**: Running `npm test` fails with exit code 1, reporting 6 failed test suites, 8 failed tests, and 9 skipped tests. Claiming 100% pass rate without genuine independent verification is an integrity violation that masks serious architectural flaws.
- **Suggestion**: Accurately report test execution failures. Never certify work without running `npm test` from a clean terminal state.

### [Critical] Finding 2 — Architecture & Decision D7 Violation: Split-Brain Database Connections
- **What**: Domain services in `src/services/` connect to `PopoApp` (development database) via `src/lib/prisma.ts`, while test fixtures and helpers in `tests/helpers/` connect to `PopoAppTest` via `tests/helpers/db-client.ts`.
- **Where**: `src/lib/prisma.ts:4-14`, `tests/helpers/db-client.ts:14-21`.
- **Why**: 
  1. Violates binding decision D7: tests pollute the development database with test data.
  2. Causes foreign key constraint violations and null returns when tests create fixture entities in `PopoAppTest` and domain services attempt to query or link them in `PopoApp`.
- **Suggestion**: Ensure `src/lib/prisma.ts` respects `process.env.DATABASE_URL` dynamically, and ensure `vitest.config.ts` injects `.env.test` into the runtime environment (e.g. via `env` configuration or `test.setupFiles`), ensuring both services and test fixtures share the single `PopoAppTest` database connection during test execution.

### [Critical] Finding 3 — Broken Cleanup Mechanism in `cleanTestDatabase()`
- **What**: `cleanTestDatabase()` silently catches and ignores deletion failures. In SQL Server, `DELETE FROM [Appointment]` fails due to self-referencing foreign keys (`rescheduledFromId`), leaving `Appointment` and `Client` rows intact.
- **Where**: `tests/helpers/db-cleaner.ts:29-35`.
- **Why**: Leaves orphaned client rows across test files. When the next test file generates CPF `90000000175`, SQL Server throws a unique key constraint violation, crashing test suites like `scenarios_a_through_e.spec.ts` and `f03_client_model.spec.ts`.
- **Suggestion**: In `cleanTestDatabase()`, first null out self-referencing foreign keys: `UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL;` before executing `DELETE FROM [Appointment]`. Do not silently catch errors without logging or handling.

### [Critical] Finding 4 — Security Bypass in `middleware.ts`
- **What**: `src/middleware.ts` checks only whether `popoapp-session` cookie exists, without unsealing or validating its cryptographic signature or `isLoggedIn` flag.
- **Where**: `src/middleware.ts:17-28`.
- **Why**: An unauthenticated attacker can supply `Cookie: popoapp-session=attacker` and completely bypass the redirect to `/login` for all authenticated pages (`(authenticated)/*`).
- **Suggestion**: In `src/middleware.ts`, use iron-session's `unsealData` with `sessionOptions.password` to decrypt the cookie and verify `session.isLoggedIn === true && session.userId`. If invalid or unseal fails, redirect to `/login` (or return 401 for `/api/*`).

### [Major] Finding 5 — Inconsistent Session Retrieval in `src/app/api/attachments/route.ts`
- **What**: `src/app/api/attachments/route.ts` calls `getSession()` without passing `request`, unlike `src/app/api/attachments/[id]/route.ts` which calls `getSession(request)`. Furthermore, it duplicates auth logic rather than using `requireAuth(request)`.
- **Where**: `src/app/api/attachments/route.ts:8,54`.
- **Why**: In Next.js App Router route handlers, `request` carries the active request cookies. Bypassing `request` relies on ambient `cookies()`, which can produce inconsistent session state in programmatic or testing scenarios.
- **Suggestion**: Use `await requireAuth(request)` across all `/api/attachments` endpoints to standardize error handling and session validation.

---

## 4. Verified Claims

Despite the test failures caused by connection split-brain and cleanup errors, the following domain logic and constraints were verified through white-box code analysis and passing isolated tests:

- **CPF Validation Algorithm (MOD 11)**:
  - `src/lib/cpf.ts` correctly validates Receita Federal MOD 11 checksums, rejects sequences of identical digits (`000.000.000-00`), normalizes strings to 11 digits, and formats canonical Brazilian masks.
  - Verified by `tests/tier2_boundaries/cpf_validation.spec.ts` (12 tests passed).
- **Procedure Validations (V06, V07)**:
  - `src/schemas/procedure.ts` enforces `valorPadrao > 0` via Zod `.positive()`.
  - Enforces mandatory fields (`nome`, `descricao`, `duracaoMinutos`, `categoria`).
  - `deleteProcedure` correctly detects clinical or scheduling usage and automatically falls back to soft deactivation (`isActive: false`) with a clear Portuguese message.
  - Verified by `tests/tier2_boundaries/v06_procedure_positive_value.spec.ts` (4 tests passed), `v07_procedure_mandatory_fields.spec.ts` (5 tests passed), and `f14_procedure_catalog.spec.ts` (7 tests passed).
- **Catalog Immutability (V12, V24)**:
  - Updating a procedure's catalog price does not alter historical `standardValueSnapshot` or `practicedValue` on `AttendanceProcedure`.
  - Verified by `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts` (1 test passed).
- **Attachment Database CHECK Constraint (V14, AC 61)**:
  - SQL Server `CK_Attachment_Ownership` CHECK constraint was verified against live SQL Server LocalDB engine.
  - Raw SQL inserts with both `clientId` and `attendanceId` are rejected by SQL Server with error Msg 547.
  - Raw SQL inserts with neither `clientId` nor `attendanceId` are rejected by SQL Server with error Msg 547.
  - Inserts with only `clientId` or only `attendanceId` are accepted.
  - Verified by `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` (4 tests passed).
- **Appointment Status Union (V02, V03)**:
  - 6 allowed statuses enforced; `Em atendimento` strictly prohibited.
  - Verified by `tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts` (5 tests passed).

---

## 5. Adversarial Challenge & Stress-Test Results

| # | Stress Test Scenario | Expected Outcome | Actual / Predicted Outcome | Status |
|---|---|---|---|---|
| **C1** | Unauthenticated user supplies `Cookie: popoapp-session=forged_token` accessing `/clientes` | Redirect to `/login` | `middleware.ts` allows request through because cookie string exists | **FAIL (VULNERABLE)** |
| **C2** | Service layer runs during integration tests | Operations strictly target `PopoAppTest` (D7) | Services write to development DB `PopoApp`, failing FK constraints against `PopoAppTest` | **FAIL (VULNERABLE)** |
| **C3** | Test suite executes rescheduling test then attempts to reset DB | DB is completely wiped in reverse FK order | `DELETE FROM [Appointment]` fails on self-referencing FK; old clients remain; next test crashes on duplicate CPF | **FAIL (BROKEN)** |
| **C4** | Client creation with negative or zero procedure standard value | Rejected with 400 validation error (V06) | Zod schema rejects with `"O valor padrão deve ser maior que zero (V06)"` | **PASS (ROBUST)** |
| **C5** | Direct SQL insert of attachment owning both Client and Attendance | Database engine rejects with check constraint violation | SQL Server rejects with Msg 547 `CK_Attachment_Ownership` | **PASS (ROBUST)** |
| **C6** | Client creation with mathematically invalid CPF check digits | Rejected with 400 validation error (V01) | Zod schema and `isValidCpf` reject invalid checksum | **PASS (ROBUST)** |

---

## 6. Caveats

- Areas not investigated: UI components under `src/app/(authenticated)/*` were not reviewed in detail because UI tasks for Phases 5, 8, 11 are not yet built (marked `[~]` In Progress).
- Seed script (`prisma/seed.ts`): currently only creates default admin; clinical seed covering Scenarios A–E remains scheduled for Milestone 5.

---

## 7. Conclusion

Milestone 2 cannot be approved in its current state. The implementation layer demonstrates sound domain modeling and validation logic, but the environment is compromised by:
1. **Critical Integrity Violation**: False claim of 0 test failures in checklist and handoff.
2. **Database Connection Split-Brain**: Violation of binding decision D7 and cause of 8 test failures across 6 files.
3. **Faulty Database Cleanup**: State pollution leading to unique constraint collisions.
4. **Middleware Security Vulnerability**: Unsealed cookie bypass on protected routes.

**Final Verdict**: **REQUEST_CHANGES**

---

## 8. Verification Method

To verify these findings and confirm resolution after changes are applied:

1. **Verify Test Failures**:
   ```powershell
   npm test
   # Currently observes: 6 failed suites, 8 failed tests, 9 skipped tests.
   # Required for approval: 15 passed (15), 89 passed (89), 0 failed.
   ```

2. **Verify Database Isolation Guard & Split-Brain Fix**:
   - Inspect `src/lib/prisma.ts` and `vitest.config.ts`.
   - Ensure that during test execution, `prisma` inside domain services connects to `PopoAppTest` and never `PopoApp`.

3. **Verify Database Cleanup Cascade**:
   - Inspect `tests/helpers/db-cleaner.ts`.
   - Ensure `UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL` runs before `DELETE FROM [Appointment]`.

4. **Verify Middleware Security**:
   - Send an HTTP request with `Cookie: popoapp-session=fake_cookie` to `GET http://localhost:3000/clientes`.
   - Verify it is redirected to `/login` (307) and not allowed through (200).
