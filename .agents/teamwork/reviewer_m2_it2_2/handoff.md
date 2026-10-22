# Milestone 2 Iteration 2 Review & Adversarial Challenge Report

**Reviewer**: reviewer_m2_it2_2 (Roles: Reviewer, Critic)  
**Milestone**: Milestone 2 Iteration 2 (Security, Core Entities & Catalog Remediation — Commit `5a17482`)  
**Project Root**: `c:\Users\Vinicius\PopoApp\PopoApp`  
**Date**: 2026-10-16  
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 LocalDB and Database Infrastructure Verification
1. **LocalDB Instance Verification (`sqllocaldb start MSSQLLocalDB`)**:
   Executed command:
   ```text
   Instância LocalDB "MSSQLLocalDB" iniciada.
   ```
   Exit code: 0.

### 1.2 Automated Test Suite Execution (`npm test`)
Executed `npm test` against Microsoft SQL Server LocalDB test database `PopoAppTest`:
```text
> popoapp@1.0.0 test
> vitest run

The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.

 RUN  v2.1.9 C:/Users/Vinicius/PopoApp/PopoApp

 ✓ tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts (21 tests) 2477ms
 ✓ tests/tier5_adversarial/milestone2_client_adversarial.spec.ts (24 tests) 2396ms
 ✓ tests/tier4_workflows/scenarios_a_through_e.spec.ts (5 tests) 2393ms
 ✓ tests/tier3_combinations/appointment_attendance_d1.spec.ts (5 tests) 2274ms
 ✓ tests/tier1_features/f15_attachment_storage.spec.ts (7 tests) 2286ms
 ✓ tests/tier1_features/f03_client_service.spec.ts (10 tests) 4364ms
   ✓ Feature F03: Client Management Domain Service (Phase 4, D4, AC 62) > should list clients with search by name and normalized CPF 2102ms
 ✓ tests/tier1_features/f14_procedure_catalog.spec.ts (7 tests) 2310ms
 ✓ tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts (4 tests) 2239ms
 ✓ tests/tier1_features/f02_auth_service.spec.ts (10 tests) 3359ms
   ✓ Feature F02: Authentication Service & Security (Phase 3) > should generate valid bcrypt hash matching plaintext 449ms
 ✓ tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts (4 tests) 2249ms
 ✓ tests/tier1_features/f03_client_model.spec.ts (5 tests) 2242ms
 ✓ tests/tier2_boundaries/cpf_validation.spec.ts (12 tests) 3ms
 ✓ tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts (5 tests) 2ms
 ✓ tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts (1 test) 2298ms
 ✓ tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts (5 tests) 1ms
 ✓ tests/tier2_boundaries/middleware_session.spec.ts (6 tests) 6ms
 ✓ tests/tier2_boundaries/v06_procedure_positive_value.spec.ts (4 tests) 2ms
 ✓ tests/tier1_features/f01_tooling.spec.ts (5 tests) 1ms

 Test Files  18 passed (18)
      Tests  140 passed (140)
   Start at  21:35:32
   Duration  32.68s (transform 435ms, setup 0ms, collect 1.01s, tests 30.90s, environment 0ms, prepare 113ms)
```
Exit code: 0. All 18 test files passed cleanly with 140 passing tests and 0 failures.

### 1.3 Linter Execution (`npm run lint`)
Executed `npm run lint`:
```text
> popoapp@1.0.0 lint
> next lint

✔ No ESLint warnings or errors
```
Exit code: 0.

### 1.4 Production Build Execution (`npm run build`)
Executed `npm run build`:
```text
> popoapp@1.0.0 build
> next build

   ▲ Next.js 15.5.26
   - Environments: .env.local, .env

   Creating an optimized production build ...
 ✓ Compiled successfully in 23.4s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/17) ...
   Generating static pages (4/17) 
   Generating static pages (8/17) 
   Generating static pages (12/17) 
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
  ├ chunks/255-2dbbf79f36f0dfa2.js          46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js     54.2 kB
  └ other shared chunks (total)             1.99 kB

ƒ Middleware                                37.4 kB
```
Exit code: 0. Production build generated 17 static/dynamic pages with zero compilation or TypeScript errors.

---

## 2. Logic Chain

### 2.1 Database Split-Brain and Test Isolation (D7)
- **Direct Observations**:
  - In `src/lib/prisma.ts` lines 8–18: `resolveDatabaseUrl()` inspects `process.env.NODE_ENV === 'test'` and strictly enforces that `process.env.DATABASE_URL` matches `/database=PopoAppTest(;|$)/i`. If not, an explicit error is thrown: `[D7] Ambiente de teste deve usar o banco PopoAppTest`.
  - In `src/lib/prisma.ts` lines 20–33: `prisma` is instantiated via a global singleton (`globalThis.prisma`).
  - In `tests/helpers/db-client.ts` lines 1–18: imports `prisma` directly from `@/lib/prisma` and defines `export const prismaTest = prisma`.
- **Reasoning**:
  - Previously, tests instantiated a separate PrismaClient from services, creating connection split-brain and potential writes to the wrong database.
  - Now, test helpers and production services share the exact same Prisma singleton instance and connection pool, guarded by an active regex assertion that forces all test operations strictly onto `PopoAppTest`.
  - **Verdict on Defect 1**: Fully Resolved.

### 2.2 Database Cleaner FK Ordering and Circular Deletion Handling
- **Direct Observations**:
  - In `tests/helpers/db-cleaner.ts` lines 31–35:
    ```typescript
    await prismaTest.$executeRawUnsafe(
      'UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL'
    );
    await prismaTest.$executeRawUnsafe('UPDATE [Client] SET [profilePhotoId] = NULL');
    ```
  - Followed by table deletions in reverse-dependency order: `Reminder`, `PixInstallment`, `Payment`, `ProductUsage`, `StockUnit`, `ProductLot`, `ProcedureProduct`, `Product`, `AttendanceProcedure`, `PlannedProcedure`, `MedicalRecord`, `Attachment`, `Attendance`, `Appointment`, `EmergencyContact`, `Client`, `Procedure`, `User`.
- **Reasoning**:
  - SQL Server enforces strict referential integrity. In Iteration 1, deletions failed with Msg 547 because `Appointment` has self-referencing foreign keys (`rescheduledFromId`, `rescheduledToId`) and `Client` has an optional foreign key to `Attachment` (`profilePhotoId`) while `Attachment` has a foreign key to `Client` (`clientId`).
  - Nullifying both self-referencing links and profile photo FK pointers prior to `DELETE` breaks the circular dependency graph cleanly without needing to disable database constraints.
  - **Verdict on Defect 2**: Fully Resolved.

### 2.3 Middleware Session Security and Token Unsealing
- **Direct Observations**:
  - In `src/lib/session-config.ts` lines 7–30: Defines edge-compatible session configuration with `SessionData` interface and `sessionOptions` (cookieName: `popoapp-session`, 24h TTL, secure in production).
  - In `src/middleware.ts` lines 18–30:
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
  - In `src/middleware.ts` lines 5–11: If invalid/unauthenticated, API requests return `401 JSON` (`{ success: false, error: 'Não autorizado' }`), while page requests are redirected to `/login` with 307. Public routes (`/login`, `/api/auth`, `/_next`, `/favicon.ico`) remain accessible.
  - In `tests/tier2_boundaries/middleware_session.spec.ts`: 6 tests cover all boundary states (unauthenticated page -> 307 redirect, unauthenticated API -> 401 JSON, forged cookie -> 307/401, unlogged session -> 401, authenticated session -> 200 pass, public routes -> 200 pass).
- **Reasoning**:
  - In Iteration 1, middleware merely checked cookie presence (`Boolean(request.cookies.get(...))`), permitting forged cookie values to load protected pages.
  - The implementation now cryptographically decrypts and validates session integrity at the middleware boundary using `unsealData`, while remaining fully edge-runtime compatible.
  - **Verdict on Defect 3**: Fully Resolved.

### 2.4 CPF Production Import & Fixture Collision Prevention
- **Direct Observations**:
  - In `tests/tier2_boundaries/cpf_validation.spec.ts` line 2:
    ```typescript
    import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';
    ```
  - In `tests/helpers/test-fixtures.ts` line 5:
    ```typescript
    let fixtureCounter = Math.floor(Math.random() * 1_000_000) + 1;
    ```
  - In `vitest.config.ts` lines 14–26:
    ```typescript
    fileParallelism: false,
    maxConcurrency: 1,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    ```
- **Reasoning**:
  - `cpf_validation.spec.ts` now tests the production implementation in `src/lib/cpf.ts` instead of helper code.
  - Fixture counter randomization combined with single-fork sequential execution in Vitest eliminates duplicate key collisions on unique SQL Server constraints (`Client_cpf_key`).
  - **Verdict on Defect 4**: Fully Resolved.

### 2.5 AttachmentService File Extension Whitelisting
- **Direct Observations**:
  - In `src/services/attachment.service.ts` lines 18–23:
    ```typescript
    export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    ```
  - In `src/services/attachment.service.ts` lines 122–123:
    ```typescript
    const ext = MIME_TO_EXTENSION[input.mimeType as AllowedMimeType];
    const storedFileName = `${fileId}${ext}`;
    ```
- **Reasoning**:
  - Previously, `path.extname(input.originalName)` was used, allowing potentially misleading or executable file extensions on disk even if MIME types were checked.
  - Now, file extensions on local disk are derived deterministically and exclusively from the validated MIME whitelist (`ALLOWED_MIME_TYPES`), preventing extension tampering.
  - **Verdict on Defect 5**: Fully Resolved.

### 2.6 Adversarial & Integrity Verification
- Checked for hardcoded test results, facade logic, or test cheats:
  - `src/lib/cpf.ts` implements standard mathematical MOD 11 verification.
  - Database-level CHECK constraint `CK_Attachment_Ownership` was independently verified by direct SQL inserts bypassing service layers (`v14_attachment_xor_constraint.spec.ts`).
  - Auth service uses real bcrypt hash comparison with 12 salt rounds (`auth.service.ts`).
  - Storage engine validates path boundaries preventing directory traversal (`attachment.service.ts`).
  - No integrity violations or shortcuts detected.

---

## 3. Caveats

1. **Milestone Scope Boundary**:
   - Milestone 2 covers the backend domain and security services for Auth, Clients, Procedures, and Attachments.
   - Front-end user interface screens (`/clientes`, `/clientes/[id]`, `/procedimentos`) currently display placeholder/mock structures; their full integration with live APIs is scheduled for subsequent milestones (M5 / Phase 15).
2. **Clinical Workflows (§47 Scenarios A–E)**:
   - As documented in `ORIGINAL_REQUEST.md` and `PROJECT.md`, `tests/tier4_workflows/scenarios_a_through_e.spec.ts` exercises direct Prisma data creation because Milestone 3 domain services (`AppointmentService`, `AttendanceService`, `ProductService`) have not yet been implemented. Once those services are built in Milestone 3, these scenarios will be refactored to go through domain services.

---

## 4. Conclusion

**Verdict: APPROVE**

All five defects identified during Iteration 1 have been remediated with high code quality, robust security practices, and zero regressions:
1. **D7 Test DB Isolation & Singleton**: Validated and working with single shared connection pool.
2. **DB Cleaner Referencing Nullification**: Validated; clean teardown between all test suites.
3. **Cryptographic Middleware Session Validation**: Validated with complete 401/307 rejection coverage.
4. **CPF Production Library Target**: Validated; direct import from `@/lib/cpf`.
5. **Deterministic Attachment File Extensions**: Validated; strictly mapped from MIME whitelist.

The automated test suite passes 100% (18/18 files, 140/140 tests), linting reports 0 errors/warnings, and the Next.js production build succeeds cleanly.

---

## 5. Verification Method

To independently verify this assessment:
1. **Verify Database Proxy & LocalDB**:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   ```
2. **Execute Full Test Suite**:
   ```powershell
   npm test
   ```
   *Expected*: 18 test files passed, 140 tests passed, 0 failures.
3. **Execute Linter**:
   ```powershell
   npm run lint
   ```
   *Expected*: `✔ No ESLint warnings or errors`.
4. **Execute Production Build**:
   ```powershell
   npm run build
   ```
   *Expected*: `✓ Compiled successfully`, `✓ Generating static pages (17/17)`.
5. **Invalidation Condition**:
   This approval would be invalidated if any automated test in `npm test` fails, if `npm run lint` yields errors, or if untrusted cookies bypass `/api/*` or page middleware without valid session signatures.
