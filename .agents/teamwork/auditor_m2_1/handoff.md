# Forensic Audit Report — Milestone 2 (Auth, Client, Procedure, Attachment)

**Work Product**: Milestone 2 Backend Services, API Routes, Database Schema, and Automated Test Suite
**Profile**: General Project
**Integrity Mode**: Development
**Target Database**: Microsoft SQL Server LocalDB (`PopoAppTest`)
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Static Analysis of Domain Services (`src/services/`)
- **`src/services/auth.service.ts`**:
  - Zero imports from `src/data/mock` or mock libraries.
  - Implements authentic `bcrypt` authentication: `bcrypt.compare(password, user.passwordHash)` and `bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS)` with `BCRYPT_SALT_ROUNDS = 12`.
  - Queries real Prisma database (`prisma.user.findUnique`), verifies account active state (`user.isActive`), and strips sensitive hash on user retrieval.
- **`src/services/client.service.ts`**:
  - Zero imports from `src/data/mock`.
  - Enforces mandatory CPF, valid checksum via `isValidCpf()`, and normalized storage via `normalizeCpf()`.
  - Enforces CPF uniqueness both pre-check and handles SQL Server Prisma unique constraint failure (`P2002`).
  - Supports 1:N emergency contacts (`prisma.emergencyContact.create`), preserves input ordering, and handles full CRUD.
  - Implements soft-deactivation toggle (`status: 'inativo'` / `status: 'ativo'`) per V05.
  - Implements deep relational history extraction (`getClientWithHistory`) derived purely from authentic relational records (appointments, attendances, procedures, medical records, stock units, lots, products, payments, attachments).
- **`src/services/procedure.service.ts`**:
  - Zero imports from `src/data/mock`.
  - Enforces standard value positive decimal (`valorPadrao > 0`), mandatory description, duration, and category (V06, V07).
  - Implements atomic M:N product associations via `prisma.$transaction`.
  - Preserves historical clinical records on deletion: if procedure has historical attendance or planned appointment links (`checkProcedureUsage`), automatically falls back to soft-deactivation (`isActive = false`) rather than hard deletion.
  - Modifying `valorPadrao` updates only the catalog row, leaving historical `AttendanceProcedure.standardValueSnapshot` untouched (V12, V24).
- **`src/services/attachment.service.ts`**:
  - Zero imports from `src/data/mock`.
  - Secure physical disk storage outside web root (`process.env.STORAGE_DIR || './storage/uploads'`).
  - Filenames generated with cryptographic UUIDs (`crypto.randomUUID()`).
  - Path traversal defense: validates `absoluteDiskPath.startsWith(storageDir)`.
  - Validates allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and enforces 10MB size limit (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`).
  - Enforces Client XOR Attendance exclusivity in business logic (`V14`, `AC 61`).
  - Atomic database insertion with file rollback: if Prisma insert throws, written disk file is unlinked immediately.
  - Profile photo lifecycle: replacing profile photo atomically deletes previous physical file and metadata row.

### 1.2 Static Analysis of API Layer (`src/app/api/`)
- Analyzed all Milestone 2 endpoints:
  - `/api/auth/login`, `/api/auth/logout`
  - `/api/clients`, `/api/clients/[id]`, `/api/clients/[id]/contacts`, `/api/clients/[id]/contacts/[contactId]`, `/api/clients/[id]/photo`
  - `/api/procedures`, `/api/procedures/[id]`
  - `/api/attachments`, `/api/attachments/[id]`
- Zero mock imports across all route files.
- Zero hardcoded responses or dummy facades.
- All protected routes enforce `requireAuth(request)` or `getSession(request)`.
- `src/middleware.ts` enforces authentication across all `/api/*` endpoints, returning JSON 401 (`{ success: false, error: 'Não autorizado' }`) instead of redirection (`AC 60`).
- `/api/attachments/[id]` streams files directly from disk with security headers (`nosniff`, `private, no-cache, no-store, must-revalidate`).

### 1.3 Database Constraints & Migration Analysis
- Located in `prisma/migrations/20261006000000_init_domain_models/migration.sql:329-330`:
  ```sql
  -- Business Constraint: Attachment ownership exclusivity (Client XOR Attendance)
  ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
  CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
  ```
- Tested raw SQL insert bypassing the service layer directly against SQL Server LocalDB (`PopoAppTest`):
  - Attempting to insert an attachment with both `clientId` and `attendanceId` throws:
    `The INSERT statement conflicted with the CHECK constraint "CK_Attachment_Ownership". The conflict occurred in database "PopoAppTest", table "dbo.Attachment". Raw query failed. Code: 547.`
  - Attempting to insert an attachment with neither throws the exact same constraint violation error.

### 1.4 Test Suite Execution & Assertion Rigor
- Executed `npm test` against `PopoAppTest`:
  - Command: `vitest run`
  - Execution Result: **16 test files passed (16), 110 tests passed (110)**.
  - Duration: **50.49s**.
  - All test files passed with 0 failures, 0 skipped, 0 trivialized assertions.
  - Tests verify authentic database states in SQL Server LocalDB, verifying unique constraints, check constraints, foreign keys, transaction rollbacks, and file system creations/deletions.

---

## 2. Logic Chain

1. **Absence of Mock Imports**: A search for `mock` in `src/services/`, `src/app/api/`, and `src/lib/` returned 0 matches. Production runtime code imports only `@/lib/prisma`, `@/lib/session`, `@/lib/cpf`, `bcrypt`, `node:fs/promises`, `node:crypto`, and official domain schemas.
2. **Absence of Dummy Facades or Hardcoding**: Examination of all service methods confirmed that all CRUD and domain operations execute genuine database queries and filesystem actions. Responses are mapped from actual database records.
3. **Cryptographic Authenticity**: `auth.service.ts` uses real `bcrypt` with salt rounds = 12. Plaintext passwords are never stored or returned in DTOs.
4. **Algorithmic Authenticity**: `src/lib/cpf.ts` implements the complete Receita Federal MOD 11 algorithm, calculating both check digits using appropriate mathematical weights, checking for 11 identical digits, and normalizing inputs.
5. **Storage Security & Integrity**: `attachment.service.ts` writes files to `./storage/uploads` (isolated outside `public/`), names them using `crypto.randomUUID()`, validates path boundaries to prevent traversal, restricts MIME types to four allowed types, enforces 10MB limits, and removes physical files when database inserts fail.
6. **Relational & Database Integrity**: The SQL Server `CK_Attachment_Ownership` CHECK constraint exists in the migration script and is actively enforced by the SQL Server engine, as verified by direct raw SQL execution resulting in error code `547`.
7. **Empirical Test Verification**: Running `npm test` executed 110 tests against `PopoAppTest`. Every test exercised live SQL Server LocalDB queries and real service methods. All assertions checked observable domain invariants, exact decimal values, and error types without trivial assertions.

---

## 3. Caveats

- **UI Integration Scope**: Frontend pages under `src/app/(authenticated)/` still render mock data from `src/data/mock` as scheduled for Milestone 5 (UI Integration). Milestone 2 scope is strictly backend services, API routes, data models, and storage engine.
- **LocalDB Dependency**: Running tests requires SQL Server LocalDB (`MSSQLLocalDB`) and the TCP proxy helper (`localdb-proxy.js`) listening on `127.0.0.1:1433`.

---

## 4. Conclusion

Milestone 2 (Authentication, Client, Procedure, and Attachment services and APIs) is implemented with **100% authenticity and architectural rigor**. No mock imports, no dummy facades, no hardcoded test outputs, and no bypassed database constraints were found.

**Verdict**: **CLEAN** (Approved for Milestone 2 completion).

---

## 5. Verification Method

To independently verify this audit:
1. Verify no mock imports in services or APIs:
   ```powershell
   git grep "src/data/mock" src/services/ src/app/api/
   ```
   (Must return 0 results).
2. Verify `CK_Attachment_Ownership` CHECK constraint in migration SQL:
   ```powershell
   Select-String -Path "prisma/migrations/20261006000000_init_domain_models/migration.sql" -Pattern "CK_Attachment_Ownership"
   ```
3. Run the automated test suite against LocalDB:
   ```powershell
   npm test
   ```
   (Must output 16 test files passed, 110 tests passed with 0 failures).
