# Handoff Report — worker_baseline_1

**Milestone**: Baseline Verification & Migration Deployment  
**Project Root**: `c:\Users\Vinicius\PopoApp\PopoApp`  
**Git Commit SHA**: `dc33eb9bd4b8086a127e1f016cb7fcae47667a9b`  
**Timestamp**: 2026-10-07T02:08:30Z  

---

## 1. Observation

### 1.1 LocalDB and Database Provisioning
- **Initial Instance State**:
  Executing `sqllocaldb info MSSQLLocalDB` showed:
  ```text
  Nome: "MSSQLLocalDB"
  Versão: 15.0.4153.1
  Estado: Parado
  ```
- **Connection Test**:
  Executing `sqlcmd -S "(localdb)\MSSQLLocalDB" -Q "SELECT @@VERSION"` returned:
  ```text
  Microsoft SQL Server 2019 (RTM-CU12) (KB5004524) - 15.0.4153.1 (X64)
  Express Edition (64-bit) on Windows 10 Pro 10.0 <X64> (Build 26200)
  ```
- **Database Creation**:
  Executed SQL query creating databases:
  `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'PopoApp') CREATE DATABASE PopoApp;`
  `IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'PopoAppTest') CREATE DATABASE PopoAppTest;`
  Verified both databases exist in `sys.databases`.

### 1.2 Prisma Validation & Generation
- Executed `npx prisma validate`:
  ```text
  Environment variables loaded from .env
  Prisma schema loaded from prisma\schema.prisma
  The schema at prisma\schema.prisma is valid 🚀
  ```
- Executed `npx prisma generate`:
  ```text
  ✔ Generated Prisma Client (v6.19.3) to .\node_modules\@prisma\client in 232ms
  ```

### 1.3 LocalDB Protocol & Proxy Discovery
- When running `npx prisma migrate deploy` initially, Prisma failed with:
  ```text
  Error: P1001: Can't reach database server at `localhost:1433`
  ```
- Checked LocalDB instance error log (`%LOCALAPPDATA%\Microsoft\Microsoft SQL Server Local DB\Instances\MSSQLLocalDB\error.log`):
  ```text
  Server local connection provider is ready to accept connection on [ \\.\pipe\LOCALDB#D4CC9314\tsql\query ].
  ```
  LocalDB on Windows only creates dynamic Named Pipes and does not listen on TCP.
- Prisma's underlying Rust driver (`tiberius`) connects exclusively via TCP.
- Created `tests/helpers/localdb-proxy.js` which listens on `127.0.0.1:1433` and pipes duplex streams directly to the active LocalDB named pipe.
- When connecting via the proxy, Prisma failed TLS negotiation with `unexpected EOF during handshake` because LocalDB over Named Pipes does not perform TLS handshakes.
- Adding `encrypt=DANGER_PLAINTEXT` and `trustServerCertificate=true` to the connection string allowed Prisma to connect and execute queries against LocalDB via Windows Integrated Security.

### 1.4 Migration Deployment & CHECK Constraint
- Prisma `migration_lock.toml` initially had `provider = "sqlserver"`. Prisma 6 raised:
  ```text
  Error: P3019
  The datasource provider `mssql` specified in your schema does not match the one specified in the migration_lock.toml, `sqlserver`.
  ```
  Updated `migration_lock.toml` to `provider = "mssql"`.
- Ran `npx prisma migrate deploy` on `PopoApp`:
  ```text
  1 migration found in prisma/migrations
  Applying migration `20261006000000_init_domain_models`
  All migrations have been successfully applied.
  ```
- Ran `npx prisma migrate deploy` on `PopoAppTest`:
  ```text
  1 migration found in prisma/migrations
  Applying migration `20261006000000_init_domain_models`
  All migrations have been successfully applied.
  ```
- Verified `CK_Attachment_Ownership` CHECK constraint exists in both databases. Direct raw SQL tests in `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` attempted invalid inserts (both clientId and attendanceId set, and neither set); LocalDB engine raised verbatim error:
  ```text
  The INSERT statement conflicted with the CHECK constraint "CK_Attachment_Ownership". The conflict occurred in database "PopoAppTest", table "dbo.Attachment".
  ```

### 1.5 Test Suite Resolution & Execution
- Initial `npm test` failed with:
  ```text
  'vitest' não é reconhecido como um comando interno ou externo
  ```
  `vitest` was in `package.json` devDependencies but `npm install` had never been run. Executed `npm install`.
- Next run failed on test isolation guard:
  ```text
  Error: [CRITICAL ISOLATION ERROR] Database connection string must point to PopoAppTest! Received: ...database=PopoApp...
  ```
  `vitest.config.ts` did not load `.env.test`. Updated `vitest.config.ts` with `dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true })`.
- Multiple test files failed when run concurrently due to race conditions on `cleanTestDatabase()` (`DELETE FROM [User]`, `DELETE FROM [Client]`) and duplicate CPF seed generation (`let fixtureCounter = 1`). Configured `fileParallelism: false` and `maxConcurrency: 1` in `vitest.config.ts` so tests execute sequentially against the shared test database.
- `tests/tier4_workflows/scenarios_a_through_e.spec.ts` failed on `attendance.create()`:
  ```text
  Argument `appointment` is missing.
  ```
  In `schema.prisma`, `Appointment 1:N Attendance` requires a non-null `appointmentId`. Updated the test fixture to create an appointment via `createTestAppointment` and link the attendance. Did NOT modify any scenario values or assertions.
- `tests/tier1_features/f03_client_service.spec.ts` failed on emergency contacts order:
  ```text
  expected 'Irmão' to be 'Filha'
  ```
  SQL Server inserted emergency contacts in the same millisecond, and without an order preserved, returned them out of the caller-supplied order. Updated `ClientService.createClient` to preserve caller-supplied array order.
- Re-ran `npm test`:
  ```text
  Test Files  15 passed (15)
       Tests  89 passed (89)
    Duration  44.89s
  ```

### 1.6 Build and Lint Verification
- `npm run lint` passed with `✔ No ESLint warnings or errors`.
- `npm run build` failed initially with:
  ```text
  ./src/app/api/procedures/[id]/route.ts:123:7
  Type error: 'success' is specified more than once, so this usage will be overwritten.
  ```
  `deleteProcedure(id)` already returns `{ success: true, ... }`. Fixed route handler to `return NextResponse.json(result);`.
- Re-ran `npm run build`: successfully generated 17/17 pages (exit code 0).

---

## 2. Logic Chain

1. **LocalDB Protocol**:
   - Observation: LocalDB provides a Named Pipe (`np:\\.\pipe\...`) and no TCP listener. Prisma connects via TCP.
   - Deduction: Direct connection to LocalDB via Prisma URL fails without a protocol bridge.
   - Solution: Created `tests/helpers/localdb-proxy.js` listening on `127.0.0.1:1433` and forwarding to LocalDB pipe. Configured `.env`, `.env.test`, `.env.local` to `sqlserver://localhost:1433;database=...;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT`.

2. **Schema & Migration Deployment**:
   - Observation: `migration.sql` contains all 18 models, indexes, and `CK_Attachment_Ownership`.
   - Deduction: Deploying via `npx prisma migrate deploy` establishes both development (`PopoApp`) and test (`PopoAppTest`) database baselines deterministically.
   - Result: Both databases migrated and synchronized. Verified via direct constraint violation tests.

3. **Test Infrastructure Hardening**:
   - Observation: Running test files concurrently wiped data out from under other tests via `cleanTestDatabase()`.
   - Deduction: Single-database integration suites must run sequentially across files.
   - Solution: Configured `fileParallelism: false` in `vitest.config.ts`. All 15 test files and 89 tests passed with zero concurrency conflicts.

4. **Integrity Audit of Checklist Marks**:
   - Observation: Phases 5, 8, 11 were marked `[x]` at the phase level in `IMPLEMENTATION_CHECKLIST.md`, but their UI tasks are `[ ]` (Not Started).
   - Deduction: Per `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` §3 ("Do not mark a task [x] merely because part of it exists"), a phase cannot be marked `[x]` when its user-facing UI screens are not implemented.
   - Solution: Downgraded Phases 5, 8, 11 to `[~]` (In Progress), accurately reflecting completed backend services and pending UI. Marked Phase 2 migration deploy as `[x]`.

---

## 3. Caveats

1. **`localdb-proxy.js` is strictly a Local Development / Test Tool**:
   - **Dev / Test**: On Windows machines using SQL Server LocalDB, LocalDB does not expose a TCP port. `tests/helpers/localdb-proxy.js` bridges TCP:1433 to the active LocalDB Named Pipe.
   - **Production Runtime**: In production/staging, SQL Server or Azure SQL is a network service listening natively on TCP port 1433. The proxy is **NOT needed** and must NOT be used in production.
2. **Clinical Seed Data**:
   - `prisma/seed.ts` currently creates only the default admin user. The comprehensive clinical seed data representing Scenarios A–E (§50) remains to be implemented in Milestone 5.
3. **UI Migration from Mock Data**:
   - All authenticated pages in `src/app/(authenticated)/*` still import mock data from `src/data/mock/*`. Replacing these with real API integrations is scheduled for Milestone 5 (Phase 16).

---

## 4. Conclusion

The repository now stands on a fully verified, genuine baseline:
- Microsoft SQL Server LocalDB instance `MSSQLLocalDB` is running with both `PopoApp` and `PopoAppTest` databases.
- The 18 domain models and custom SQL Server `CK_Attachment_Ownership` CHECK constraint are applied and verified in both databases.
- The automated test suite contains 15 test files with 89 tests passing with 0 failures (100% pass rate) against live LocalDB.
- `npm run build` and `npm run lint` compile cleanly with 0 errors.
- `IMPLEMENTATION_CHECKLIST.md` accurately reflects project status with zero false completions.
- The verified baseline is committed to git at commit `dc33eb9bd4b8086a127e1f016cb7fcae47667a9b`.

---

## 5. Verification Method

To independently verify this baseline:

1. **Check Git Commit**:
   ```bash
   git log -n 1 --oneline
   # Output must be: dc33eb9 chore: baseline verified against LocalDB migrations and passing test suite
   ```

2. **Verify LocalDB & Proxy**:
   Ensure `MSSQLLocalDB` is started and proxy is active:
   ```powershell
   sqllocaldb start MSSQLLocalDB
   npm run db:proxy # in a background terminal if not already running on port 1433
   ```

3. **Verify Prisma Schema & Migration**:
   ```bash
   npx prisma validate
   npx prisma migrate status
   ```

4. **Verify Check Constraint in Database**:
   ```powershell
   sqlcmd -S "(localdb)\MSSQLLocalDB" -d PopoApp -Q "SELECT name, definition FROM sys.check_constraints WHERE name = 'CK_Attachment_Ownership'"
   sqlcmd -S "(localdb)\MSSQLLocalDB" -d PopoAppTest -Q "SELECT name, definition FROM sys.check_constraints WHERE name = 'CK_Attachment_Ownership'"
   ```

5. **Run Full Test Suite**:
   ```bash
   npm test
   # Expected output: 15 passed (15), 89 passed (89), 0 failed
   ```

6. **Run Build & Lint**:
   ```bash
   npm run lint
   npm run build
   # Expected output: Compiled successfully, 17/17 pages generated
   ```
