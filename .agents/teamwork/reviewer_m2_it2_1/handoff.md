# Handoff Report — reviewer_m2_it2_1

**Milestone**: Milestone 2 Iteration 2 Review (Phases 3, 4, 5, 11: Security, Core Entities & Catalog Remediation)  
**Project Root**: `c:\Users\Vinicius\PopoApp\PopoApp`  
**Reviewer Roles**: Reviewer & Adversarial Critic  
**Commit Inspected**: `5a17482` (`fix(m2): remediate database isolation, cleaner, middleware auth and update resume guide`)  
**Verdict**: **APPROVE**  
**Date**: 2026-10-16T00:30:00Z  

---

## Review Summary

**Verdict**: **APPROVE**

Milestone 2 Iteration 2 remediation changes in commit `5a17482` were subjected to an independent objective quality review, adversarial stress-testing, and automated verification across LocalDB, Vitest, Next.js linter, and production build compiler.

All 4 critical findings and 1 major finding from Iteration 1 (`reviewer_m2_1/handoff.md`) have been **completely resolved**:
1. **Database Split-Brain & D7 Isolation Guard**: Domain services and test fixtures now share the single Prisma singleton from `src/lib/prisma.ts`. When `NODE_ENV === 'test'`, an invariant guard throws immediately if `DATABASE_URL` does not point to `PopoAppTest`.
2. **Database Cleaner FK Order & Cascades**: `tests/helpers/db-cleaner.ts` unlinks self-referencing appointment foreign keys (`rescheduledFromId`, `rescheduledToId`) and client profile photo references (`profilePhotoId`) prior to deleting records in reverse dependency order. Silent `try/catch` suppression was eliminated so errors surface immediately.
3. **Middleware Authentication Security**: `src/middleware.ts` now cryptographically unseals the `popoapp-session` cookie via iron-session's `unsealData` using `sessionOptions`. Forged, expired, or invalid session cookies are rejected with a 307 redirect to `/login` for page routes and 401 JSON for `/api/*` routes.
4. **CPF Imports & Fixture Non-Collision**: `tests/tier2_boundaries/cpf_validation.spec.ts` imports canonical algorithms (`isValidCpf`, `normalizeCpf`, `formatCpf`) directly from production `src/lib/cpf.ts`. Fixture counters in `tests/helpers/test-fixtures.ts` are seeded randomly to prevent collisions.
5. **Attachment Extension & Route Security**: `src/services/attachment.service.ts` derives disk file extensions strictly from validated MIME types (`MIME_TO_EXTENSION`), neutralizing extension spoofing. `/api/attachments/route.ts` standardizes session checking via `await requireAuth(request)`.

**Suite Health**:
- `npm test`: **18/18 test files passed**, **140/140 tests passed (100%)**, 0 failures, verified across 2 consecutive runs.
- `npm run lint`: **0 errors, 0 warnings**.
- `npm run build`: **17/17 routes compiled and generated cleanly**.

---

## 1. Observation

### 1.1 Command Execution & Verbatim Outputs

1. **LocalDB & TCP Proxy Verification**:
   - `sqllocaldb start MSSQLLocalDB`:
     ```text
     Instância LocalDB "MSSQLLocalDB" iniciada.
     ```
   - TCP Proxy (`tests/helpers/localdb-proxy.js`) started and listening on `127.0.0.1:1433`:
     ```text
     LocalDB TCP proxy listening on 127.0.0.1:1433 -> \\.\pipe\LOCALDB#034D9441\tsql\query
     ```

2. **Automated Test Suite Execution (`npm test`)**:
   ```text
   > popoapp@1.0.0 test
   > vitest run

    RUN  v2.1.9 C:/Users/Vinicius/PopoApp/PopoApp

    ✓ tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts (21 tests) 2562ms
    ✓ tests/tier5_adversarial/milestone2_client_adversarial.spec.ts (24 tests) 2414ms
    ✓ tests/tier4_workflows/scenarios_a_through_e.spec.ts (5 tests) 2444ms
    ✓ tests/tier3_combinations/appointment_attendance_d1.spec.ts (5 tests) 2312ms
    ✓ tests/tier1_features/f15_attachment_storage.spec.ts (7 tests) 2294ms
    ✓ tests/tier1_features/f03_client_service.spec.ts (10 tests) 4429ms
    ✓ tests/tier1_features/f14_procedure_catalog.spec.ts (7 tests) 2360ms
    ✓ tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts (4 tests) 2241ms
    ✓ tests/tier1_features/f02_auth_service.spec.ts (10 tests) 3356ms
    ✓ tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts (4 tests) 2264ms
    ✓ tests/tier1_features/f03_client_model.spec.ts (5 tests) 2239ms
    ✓ tests/tier2_boundaries/cpf_validation.spec.ts (12 tests) 3ms
    ✓ tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts (5 tests) 2ms
    ✓ tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts (1 test) 2255ms
    ✓ tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts (5 tests) 1ms
    ✓ tests/tier2_boundaries/middleware_session.spec.ts (6 tests) 9ms
    ✓ tests/tier2_boundaries/v06_procedure_positive_value.spec.ts (4 tests) 2ms
    ✓ tests/tier1_features/f01_tooling.spec.ts (5 tests) 1ms

    Test Files  18 passed (18)
         Tests  140 passed (140)
      Duration  43.94s
   ```
   *Repeatability run*: A second consecutive run of `npm test` passed 18/18 files and 140/140 tests in 32.48s with 0 failures.

3. **Linter Execution (`npm run lint`)**:
   ```text
   > popoapp@1.0.0 lint
   > next lint

   ✔ No ESLint warnings or errors
   ```
   Exit code: 0.

4. **Production Build Execution (`npm run build`)**:
   ```text
   > popoapp@1.0.0 build
   > next build

      ▲ Next.js 15.5.26
      - Environments: .env.local, .env

      Creating an optimized production build ...
    ✓ Compiled successfully in 46s
      Linting and checking validity of types ...
      Collecting page data ...
    ✓ Generating static pages (17/17)
      Finalizing page optimization ...
      Collecting build traces ...

   Route (app)                                    Size  First Load JS
   ┌ ○ /                                       4.09 kB         128 kB
   ├ ○ /_not-found                               153 B         103 kB
   ├ ○ /agenda                                 18.5 kB         166 kB
   ├ ƒ /api/attachments                          153 B         103 kB
   ├ ƒ /api/attachments/[id]                     153 B         103 kB
   ├ ƒ /api/auth/login                           153 B         103 kB
   ├ ƒ /api/auth/logout                          153 B         103 kB
   ├ ƒ /api/clients                              153 B         103 kB
   ├ ƒ /api/clients/[id]                         153 B         103 kB
   ├ ƒ /api/clients/[id]/contacts                153 B         103 kB
   ├ ƒ /api/clients/[id]/contacts/[contactId]    153 B         103 kB
   ├ ƒ /api/clients/[id]/photo                   153 B         103 kB
   ├ ƒ /api/procedures                           153 B         103 kB
   ├ ƒ /api/procedures/[id]                      153 B         103 kB
   ├ ○ /atendimentos                              6 kB         123 kB
   ├ ○ /clientes                               7.72 kB         131 kB
   ├ ○ /financeiro                              5.9 kB         131 kB
   ├ ○ /lembretes                              5.23 kB         131 kB
   ├ ○ /login                                  2.87 kB         114 kB
   ├ ○ /procedimentos                          3.94 kB         115 kB
   └ ○ /produtos                               5.63 kB         125 kB
   + First Load JS shared by all                103 kB
   ƒ Middleware                                37.4 kB
   ```
   Exit code: 0. Clean build with all 17 routes properly typed and emitted.

---

## 2. Logic Chain

### 2.1 Remediation 1: Database Split-Brain & D7 Isolation
- **Observation**:
  - In `src/lib/prisma.ts`:
    ```typescript
    function resolveDatabaseUrl(): string | undefined {
      const url = process.env.DATABASE_URL;
      if (process.env.NODE_ENV === 'test') {
        if (!url || !/database=PopoAppTest(;|$)/i.test(url)) {
          throw new Error(
            `[D7] Ambiente de teste deve usar o banco PopoAppTest. DATABASE_URL atual: ${url ?? '(vazio)'}`
          );
        }
      }
      return url;
    }
    const prismaClientSingleton = () => {
      const url = resolveDatabaseUrl();
      return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
    };
    ```
  - In `tests/helpers/db-client.ts`:
    ```typescript
    import prisma from '@/lib/prisma';
    export const prismaTest = prisma;
    export default prismaTest;
    ```
  - In `vitest.config.ts`:
    ```typescript
    const testEnv = dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true }).parsed ?? {};
    // ...
    env: { ...testEnv, NODE_ENV: 'test' }
    ```
- **Inference**:
  - Domain services (`src/services/*`) import `prisma` from `src/lib/prisma`.
  - Test fixtures (`tests/helpers/test-fixtures.ts`) and tests import `prismaTest` from `tests/helpers/db-client`, which references the exact same singleton instance.
  - In test runs (`NODE_ENV === 'test'`), `resolveDatabaseUrl()` guarantees that `DATABASE_URL` targets `PopoAppTest`, or throws an error.
  - Result: The split-brain condition where test setups wrote to `PopoAppTest` while services accessed `PopoApp` is completely eliminated. Decision D7 is strictly enforced.

### 2.2 Remediation 2: Database Cleaner Foreign Key Order
- **Observation**:
  - In `tests/helpers/db-cleaner.ts`:
    ```typescript
    await prismaTest.$executeRawUnsafe(
      'UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL'
    );
    await prismaTest.$executeRawUnsafe('UPDATE [Client] SET [profilePhotoId] = NULL');

    for (const table of tablesInOrder) {
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    }
    ```
  - No `catch { /* ignore */ }` swallows SQL errors.
- **Inference**:
  - Nulling out `rescheduledFromId`/`rescheduledToId` eliminates self-referencing foreign key locks in `Appointment`.
  - Nulling out `profilePhotoId` eliminates circular references between `Client` and `Attachment`.
  - Deletions execute in exact dependency order: child tables first (`Reminder`, `PixInstallment`, `Payment`, `ProductUsage`), down to root tables (`Client`, `Procedure`, `User`).
  - Result: No SQL Server Msg 547 errors occur. All tables are cleanly wiped between test suites, preventing duplicate CPF key collisions.

### 2.3 Remediation 3: Middleware Authentication Security
- **Observation**:
  - In `src/middleware.ts`:
    ```typescript
    async function hasValidSession(request: NextRequest): Promise<boolean> {
      const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
      if (!cookie) return false;
      try {
        const data = await unsealData<Partial<SessionData>>(cookie, {
          password: sessionOptions.password,
          ttl: sessionOptions.ttl,
        });
        return Boolean(data && data.isLoggedIn === true && data.userId);
      } catch {
        return false;
      }
    }
    ```
  - For unauthenticated or forged requests:
    ```typescript
    function reject(request: NextRequest, pathname: string) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    ```
  - Tested in `tests/tier2_boundaries/middleware_session.spec.ts` (6 tests).
- **Inference**:
  - Forged session tokens (e.g. `Cookie: popoapp-session=attacker_string`) fail cryptographic unsealing via `unsealData` and are rejected.
  - Sealed cookies with `isLoggedIn: false` or missing `userId` are rejected.
  - Validly sealed sessions unseal successfully and are permitted through.
  - Page routes redirect to `/login` (307), while API routes return 401 JSON.
  - Result: The previous cookie-presence bypass is completely resolved.

### 2.4 Remediation 4: CPF Imports & Fixture Non-Collision
- **Observation**:
  - In `tests/tier2_boundaries/cpf_validation.spec.ts`:
    `import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';`
  - In `tests/helpers/test-fixtures.ts`:
    `let fixtureCounter = Math.floor(Math.random() * 1_000_000) + 1;`
- **Inference**:
  - Tests directly exercise production business logic from `src/lib/cpf.ts` instead of mock/helper implementations.
  - Randomizing the counter base prevents collisions even if previous aborted runs leave residual records in the test database.
  - Result: Genuine unit and boundary verification with zero collision flakiness.

### 2.5 Remediation 5: Attachment MIME-to-Extension Mapping
- **Observation**:
  - In `src/services/attachment.service.ts`:
    ```typescript
    export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    // ...
    const ext = MIME_TO_EXTENSION[input.mimeType as AllowedMimeType];
    const storedFileName = `${fileId}${ext}`;
    ```
  - In `src/app/api/attachments/route.ts`:
    `await requireAuth(request);` in both `POST` and `GET`.
- **Inference**:
  - Disallows attacker-controlled file extensions via `originalName`. Files written to disk outside the web root (`./storage/uploads`) have UUID basenames and deterministic extensions strictly mapped from validated MIME types.
  - Both `/api/attachments` and `/api/attachments/[id]` consistently enforce `requireAuth(request)`.
  - Result: Secure file storage pipeline conforming to D6 and AC 60.

---

## 3. Adversarial Stress-Test Verification

| Scenario | Attack / Stress Vector | Expected Behavior | Actual Observed Behavior | Result |
|---|---|---|---|---|
| **A1** | Attacker sends `Cookie: popoapp-session=forged_token` to `/clientes` | Blocked & redirected to `/login` (307) | `unsealData` throws/fails; redirected to `/login` | **PASS (SECURE)** |
| **A2** | Attacker sends `Cookie: popoapp-session=forged_token` to `/api/clients` | Blocked with 401 JSON | Rejected with HTTP 401 `{ success: false, error: 'Não autorizado' }` | **PASS (SECURE)** |
| **A3** | Attacker uploads malicious file with name `malicious.exe` but MIME `image/jpeg` | Stored on disk with `.jpg` extension | `storedFileName` assigned `.jpg` extension based on `MIME_TO_EXTENSION` | **PASS (SECURE)** |
| **A4** | Test execution under `NODE_ENV === 'test'` without `PopoAppTest` in URL | Throws runtime isolation error (D7) | `resolveDatabaseUrl` throws `[D7] Ambiente de teste deve usar o banco PopoAppTest` | **PASS (SECURE)** |
| **A5** | Consecutive test runs executing appointments and rescheduled links | Test cleaner resets all tables without foreign key deadlock Msg 547 | Both test runs completed with 140/140 passes | **PASS (ROBUST)** |
| **A6** | Integrity Check: Inspect codebase for dummy/facade logic or fake passes | Real business logic throughout domain services | Verified real Prisma queries, bcrypt hashing, MOD 11 algorithm, iron-session crypto | **PASS (NO INTEGRITY VIOLATION)** |

---

## 4. Caveats

1. **Milestone 2 UI Scope**: UI components under `src/app/(authenticated)/*` still render mock data from `src/data/mock`. Per `PROJECT.md` and `RESUME_GUIDE.md`, replacing mock data in `/clientes`, `/procedimentos`, etc., with live API calls is scheduled as Milestone 2 UI tasks or Milestone 5 (Brazilian Portuguese UI Integration). The backend services and API layer are fully verified.
2. **`scenarios_a_through_e.spec.ts` (Spec §47)**: As documented in `ORIGINAL_REQUEST.md`, this suite currently exercises Prisma models directly because `AppointmentService`, `AttendanceService`, and `FinancialService` are planned for Milestones 3 & 4. When those services are implemented, these scenarios should be refactored to exercise the domain service layer while keeping the exact values from §47.

---

## 5. Conclusion

All 4 critical findings and 1 major finding from Iteration 1 have been completely remediated. The codebase now strictly respects binding decision D7 (database test isolation), eliminates foreign-key cleanup deadlocks, provides cryptographic session validation in Next.js middleware, securely maps file extensions from validated MIME types, and passes all 18 test files (140 tests) with 100% reliability, zero lint issues, and a clean Next.js build.

**Final Verdict**: **APPROVE**

---

## 6. Verification Method

To independently verify these results:

1. **Verify LocalDB & Proxy**:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   # In a separate background terminal if port 1433 is not already open:
   npm run db:proxy
   ```

2. **Execute Full Automated Test Suite**:
   ```powershell
   npm test
   # Expected result: Test Files 18 passed (18), Tests 140 passed (140)
   ```

3. **Execute Lint & Build**:
   ```powershell
   npm run lint
   # Expected result: ✔ No ESLint warnings or errors
   npm run build
   # Expected result: ✓ Generating static pages (17/17), clean build exit code 0
   ```
