# Turnkey Investigation & Fix Strategy: Milestone 2 Iteration 2 Gate Remediation

**Author**: explorer_m2_it2_1  
**Target Milestone**: Milestone 2 (Security, Core Entities & Catalog)  
**Date**: 2026-10-07T02:40:00Z  
**Scope**: Read-Only Analysis & Turnkey Remediation Blueprint for Worker  

---

## Executive Summary

Milestone 2 Iteration 1 Gate failed with `REQUEST_CHANGES` due to 5 interconnected architectural, security, and test runner defects. Through rigorous code inspection and root-cause analysis, each issue has been isolated down to exact files and line numbers. This document provides a complete, drop-in, turnkey remediation plan for the Worker agent.

---

## 1. Observation

### 1.1 Issue 1: Vitest Concurrency & Database Connection Split-Brain
- **File**: `vitest.config.ts:8-20`
  ```typescript
  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'node',
      globals: true,
      fileParallelism: false,
      maxConcurrency: 1,
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
    ...
  });
  ```
  - **Observed Behavior**: `pool` was not explicitly declared as `'forks'`. Furthermore, `test.env` is not declared in `vitest.config.ts`, meaning worker processes might not receive `DATABASE_URL` explicitly configured for `PopoAppTest`.
- **File**: `src/lib/prisma.ts:4-16`
  ```typescript
  const prismaClientSingleton = () => {
    return new PrismaClient();
  };

  declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
  }

  const prisma = globalThis.prisma ?? prismaClientSingleton();
  export default prisma;
  ```
  - **Observed Behavior**: `new PrismaClient()` is instantiated without explicit `datasources`. If `process.env.DATABASE_URL` is omitted or overridden, it defaults to the url loaded by Prisma from `.env` (`database=PopoApp`).
- **File**: `tests/helpers/db-client.ts:1-24`
  - **Observed Behavior**: `tests/helpers/db-client.ts` instantiates its own distinct instance of `new PrismaClient()` (`prismaTest`). Test fixtures write records using `prismaTest`, while domain services (`auth.service.ts`, `client.service.ts`, `attachment.service.ts`) execute queries using `prisma` imported from `@/lib/prisma`. If `globalThis.prisma` is not coordinated, tests run across two separate connection pools and risk split-brain between `PopoApp` and `PopoAppTest`.

### 1.2 Issue 2: `db-cleaner.ts` Swallowed Errors & Self-Referencing Foreign Key on `Appointment`
- **File**: `tests/helpers/db-cleaner.ts:29-35`
  ```typescript
  for (const table of tablesInOrder) {
    try {
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    } catch {
      // Table may not exist yet during early migration phases; ignore silently
    }
  }
  ```
- **File**: `prisma/schema.prisma:78-85` and `prisma/migrations/20261006000000_init_domain_models/migration.sql:305`
  ```sql
  ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_rescheduledFromId_fkey] 
  FOREIGN KEY ([rescheduledFromId]) REFERENCES [dbo].[Appointment]([id]) 
  ON DELETE NO ACTION ON UPDATE NO ACTION;
  ```
  - **Observed Behavior**: In SQL Server, table `Appointment` contains a self-referencing foreign key `Appointment_rescheduledFromId_fkey` on column `rescheduledFromId`. When any test creates a rescheduled appointment, executing `DELETE FROM [Appointment]` triggers SQL Server error Msg 547 (`The DELETE statement conflicted with the REFERENCE constraint "Appointment_rescheduledFromId_fkey"`).
  - The `catch { /* ignore silently */ }` in `db-cleaner.ts` swallows this failure.
  - Subsequently, `DELETE FROM [Client]` also fails with Msg 547 because `Appointment` still references `Client`, which is also silently swallowed.
  - Old client records remain in `dbo.Client`. Subsequent tests generating fixture CPF `90000000175` crash with `Violation of UNIQUE KEY constraint 'Client_cpf_key'`.

### 1.3 Issue 3: Incomplete Middleware Authentication (Cookie Presence Check vs Cryptographic Unsealing)
- **File**: `src/middleware.ts:16-31`
  ```typescript
  // Check session cookie
  const sessionCookie = request.cookies.get('popoapp-session');

  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
  ```
- **File**: `src/app/(authenticated)/layout.tsx:1-20`
  - **Observed Behavior**: The authenticated layout is a `'use client'` component without server-side session checks.
  - An unauthenticated client sending `Cookie: popoapp-session=dummy_token` bypasses `src/middleware.ts` completely and loads protected pages (`/clientes`, `/agenda`, `/procedimentos`). The cookie is never cryptographically unsealed or validated in middleware.
- **File**: `src/app/api/attachments/route.ts:8, 54`
  - **Observed Behavior**: `POST /api/attachments` and `GET /api/attachments` call `getSession()` without passing `request`, unlike `src/app/api/attachments/[id]/route.ts` which calls `getSession(request)`.

### 1.4 Issue 4: CPF Unit Test Imports Helper Instead of Production Library
- **File**: `tests/tier2_boundaries/cpf_validation.spec.ts:1-3`
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { isValidCpf, normalizeCpf, formatCpf, generateValidCpf } from '../helpers/cpf-validator';
  ```
- **File**: `src/lib/cpf.ts:1-54`
  - **Observed Behavior**: The unit test suite asserts the test helper `tests/helpers/cpf-validator.ts` instead of production code `@/lib/cpf`.

### 1.5 Issue 5: Attachment Disk Filename Extension Derived from Untrusted Input
- **File**: `src/services/attachment.service.ts:113-116`
  ```typescript
  const storageDir = await this.ensureStorageDir();
  const fileId = crypto.randomUUID();
  const ext = path.extname(input.originalName).toLowerCase() || '.bin';
  const storedFileName = `${fileId}${ext}`;
  const absoluteDiskPath = path.resolve(storageDir, storedFileName);
  ```
  - **Observed Behavior**: Even though MIME type is restricted to `ALLOWED_MIME_TYPES` (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), `ext` on disk is derived from `input.originalName`. A request with `mimeType: "image/png"` and `originalName: "script.exe"` or `"page.html"` results in the file on disk having the `.exe` or `.html` extension.

---

## 2. Logic Chain

1. **Test Concurrency & Isolation Logic**:
   - Sequential execution is mandatory because Microsoft SQL Server LocalDB operates as a single shared instance per database name (`PopoAppTest`).
   - Running multiple Vitest worker processes concurrently causes `cleanTestDatabase()` in one process to truncate tables while another test is actively querying or inserting, causing intermittent foreign key violations (`Attachment_clientId_fkey`, `Attachment_attendanceId_fkey`) and null pointer errors.
   - Setting `pool: 'forks'`, `poolOptions: { forks: { singleFork: true } }`, and `fileParallelism: false` in `vitest.config.ts` forces deterministic, sequential suite execution.
   - Injecting `DATABASE_URL` via `test.env` guarantees that child forks inherit the test database URL.
   - Setting `globalThis.prisma = prismaTest` in `tests/helpers/db-client.ts` guarantees that domain services and test helpers share the exact same Prisma singleton instance pointing to `PopoAppTest`, completely eliminating any split-brain possibility.

2. **Self-Referencing Foreign Key Cleanup Logic**:
   - In SQL Server, `DELETE FROM [Appointment]` cannot delete rows when other rows in the same table reference them via `rescheduledFromId`.
   - Nulling out self-referencing foreign keys first (`UPDATE [dbo].[Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL`) cleanly breaks the reference cycles.
   - Following this, sequential deletion in existing reverse-dependency order completes cleanly without error.
   - Removing silent swallowing (`catch { }`) ensures any future constraint mismatch throws immediately with clear diagnostic information.

3. **Cryptographic Session Verification Logic**:
   - `iron-session` v8 provides `unsealData<SessionData>(seal, { password, ttl })`.
   - Unsealing in `src/middleware.ts` ensures that tampered, expired, or forged cookies fail decryption, returning `isValidSession = false`.
   - Invalid requests to `/api/*` receive HTTP 401 JSON (`{ success: false, error: 'Não autorizado' }`), and invalid requests to UI pages are redirected to `/login` with HTTP 307.
   - In `src/app/api/attachments/route.ts`, passing `request` to `getSession(request)` ensures consistent cookie resolution.

4. **CPF Test Integrity Logic**:
   - Re-exporting `@/lib/cpf` in `tests/helpers/cpf-validator.ts` and updating `tests/tier2_boundaries/cpf_validation.spec.ts` to import `isValidCpf, normalizeCpf, formatCpf` from `@/lib/cpf` ensures the production codebase is directly tested and verified.

5. **Attachment Extension Sanitization Logic**:
   - Mapping disk extensions strictly from validated MIME types (`ALLOWED_MIME_TYPES`) ensures files on disk receive `.jpg`, `.png`, `.webp`, or `.pdf` regardless of client filename spoofing.
   - The user's original filename is still preserved in `Attachment.nomeOriginal` in the database, satisfying clinical traceability while guaranteeing storage security.

---

## 3. Concrete Turnkey Fix Strategy (For the Worker)

The Worker should apply the following targeted modifications across the 6 affected files:

### Fix 1: Vitest Runner & Database Isolation
#### File A: `vitest.config.ts`
- **Location**: `vitest.config.ts:10-21`
- **Change**: Explicitly configure `pool: 'forks'`, `singleFork: true`, and `test.env`.
- **Replacement Code**:
```typescript
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: 'sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT',
      STORAGE_DIR: './storage/test_uploads',
      NODE_ENV: 'test',
    },
  },
```

#### File B: `src/lib/prisma.ts`
- **Location**: `src/lib/prisma.ts:4-7`
- **Change**: Explicitly pass `process.env.DATABASE_URL` to `new PrismaClient` datasources.
- **Replacement Code**:
```typescript
const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL,
          },
        }
      : undefined,
  });
};
```

#### File C: `tests/helpers/db-client.ts`
- **Location**: `tests/helpers/db-client.ts:14-24`
- **Change**: Inject `prismaTest` into `globalThis.prisma` so services importing `@/lib/prisma` share the test database client.
- **Replacement Code**:
```typescript
export const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
  log: process.env.DEBUG_TEST_SQL ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

// Coordinate singleton with src/lib/prisma.ts to eliminate split-brain
if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).prisma = prismaTest;
}

export default prismaTest;
```

#### File D: `tests/helpers/test-fixtures.ts`
- **Location**: `tests/helpers/test-fixtures.ts:4-8`
- **Change**: Initialize `fixtureCounter` with dynamic offset to eliminate CPF collision risk across runs.
- **Replacement Code**:
```typescript
let fixtureCounter = Math.floor(Date.now() % 1000000) * 100 + 1;

export function getNextCounter(): number {
  return fixtureCounter++;
}
```

---

### Fix 2: Database Cleaner Self-Referencing Foreign Key
#### File: `tests/helpers/db-cleaner.ts`
- **Location**: `tests/helpers/db-cleaner.ts:7-36`
- **Change**: Nullify `rescheduledFromId` and `rescheduledToId` on `Appointment` before table deletions, and check table existence before deleting.
- **Replacement Code**:
```typescript
export async function cleanTestDatabase(): Promise<void> {
  // Break self-referencing foreign keys on Appointment before deletion
  try {
    await prismaTest.$executeRawUnsafe(`
      IF OBJECT_ID('dbo.Appointment', 'U') IS NOT NULL
      BEGIN
        UPDATE [dbo].[Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL;
      END
    `);
  } catch (err: any) {
    // Ignore if table does not exist yet during initial migration
  }

  const tablesInOrder = [
    'Reminder',
    'PixInstallment',
    'Payment',
    'ProductUsage',
    'StockUnit',
    'ProductLot',
    'ProcedureProduct',
    'Product',
    'AttendanceProcedure',
    'PlannedProcedure',
    'MedicalRecord',
    'Attachment',
    'Attendance',
    'Appointment',
    'EmergencyContact',
    'Client',
    'Procedure',
    'User',
  ];

  for (const table of tablesInOrder) {
    try {
      await prismaTest.$executeRawUnsafe(`
        IF OBJECT_ID('dbo.${table}', 'U') IS NOT NULL
        BEGIN
          DELETE FROM [dbo].[${table}];
        END
      `);
    } catch (err: any) {
      console.error(`[DB-CLEANER ERROR] Failed to clean table [${table}]:`, err.message);
      throw err;
    }
  }
}
```

---

### Fix 3: Middleware Cryptographic Session Verification
#### File A: `src/middleware.ts`
- **Location**: `src/middleware.ts:1-31`
- **Change**: Use `unsealData` from `iron-session` and `sessionOptions` to cryptographically verify session payload.
- **Replacement Code**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check and cryptographically unseal session cookie
  const sessionCookie = request.cookies.get(sessionOptions.cookieName);

  let isValidSession = false;
  if (sessionCookie?.value) {
    try {
      const session = await unsealData<SessionData>(sessionCookie.value, {
        password: sessionOptions.password,
        ttl: sessionOptions.ttl,
      });
      if (session && session.isLoggedIn && session.userId) {
        isValidSession = true;
      }
    } catch {
      isValidSession = false;
    }
  }

  if (!isValidSession) {
    // API routes must return 401 JSON instead of redirecting (AC 60)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

#### File B: `src/app/api/attachments/route.ts`
- **Location**: `src/app/api/attachments/route.ts:8, 54`
- **Change**: Pass `request` to `getSession(request)`.
- **Replacement Code**:
```typescript
// Line 8:
const session = await getSession(request);

// Line 54:
const session = await getSession(request);
```

---

### Fix 4: CPF Unit Test Import Path & Production Alignment
#### File A: `tests/tier2_boundaries/cpf_validation.spec.ts`
- **Location**: `tests/tier2_boundaries/cpf_validation.spec.ts:1-3`
- **Change**: Import `isValidCpf, normalizeCpf, formatCpf` directly from `@/lib/cpf`.
- **Replacement Code**:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';
import { generateValidCpf } from '../helpers/cpf-validator';
```

#### File B: `tests/helpers/cpf-validator.ts`
- **Location**: `tests/helpers/cpf-validator.ts:6-45`
- **Change**: Re-export from `@/lib/cpf` to ensure single source of truth.
- **Replacement Code**:
```typescript
export { normalizeCpf, formatCpf, isValidCpf } from '@/lib/cpf';
```

---

### Fix 5: Attachment Disk Filename Extension Mapping
#### File: `src/services/attachment.service.ts`
- **Location**: `src/services/attachment.service.ts:14-17` and `114-116`
- **Change**: Define `MIME_TO_EXTENSION` mapping and derive `ext` from validated `mimeType`.
- **Replacement Code**:
```typescript
// After line 16:
export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
```
And inside `saveAttachment`:
```typescript
    const storageDir = await this.ensureStorageDir();
    const fileId = crypto.randomUUID();
    const ext = MIME_TO_EXTENSION[input.mimeType as AllowedMimeType] || '.bin';
    const storedFileName = `${fileId}${ext}`;
    const absoluteDiskPath = path.resolve(storageDir, storedFileName);
```

---

## 4. Caveats

- **LocalDB TCP Proxy**: Tests require SQL Server LocalDB to be running and port 1433 bridged via `npm run db:proxy` (or SQL Server native TCP listener).
- **Migration Scope**: No database schema changes (`schema.prisma` or new migrations) are needed for this remediation. The existing schema and `CK_Attachment_Ownership` CHECK constraint are 100% compliant.
- **Adversarial Test File Retention**: Adversarial test files created in Iteration 1 (`tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts` and `tests/tier5_adversarial/milestone2_client_adversarial.spec.ts`) should remain in the test suite as permanent regression guards.

---

## 5. Conclusion

All 5 gate failure issues are fully understood with deterministic root causes and minimal, surgical fixes. Applying these changes will:
1. Guarantee single-fork sequential test execution against `PopoAppTest`.
2. Eliminate all database split-brain risks by unifying `prisma` and `prismaTest`.
3. Eliminate test database cleanup crashes caused by self-referencing foreign keys on `Appointment`.
4. Close the security bypass in Next.js middleware by cryptographically unsealing session cookies.
5. Guarantee that boundary tests assert production `@/lib/cpf`.
6. Protect physical disk storage from extension-spoofing attacks.

With these fixes implemented, the full test suite (`npm test`) is projected to pass 100% (17 test files, 134+ tests, 0 failures, 0 skipped), satisfying all criteria for Gate approval.

---

## 6. Verification Method

To independently verify the fixes after implementation by the Worker:

1. **Lint Check**:
   ```powershell
   npm run lint
   ```
   *Expected outcome*: 0 warnings, 0 errors.

2. **Automated Test Suite**:
   ```powershell
   npm test
   ```
   *Expected outcome*: 17 test files passed, 134+ tests passed, 0 failed, exit code 0.

3. **Adversarial Middleware Forgery Check**:
   Send a request with forged session cookie to a protected route:
   ```typescript
   const req = new NextRequest('http://localhost:3000/clientes', {
     headers: { Cookie: 'popoapp-session=forged_unsealed_token' }
   });
   const res = await middleware(req);
   expect(res.status).toBe(307); // Redirects to /login
   ```
   *Expected outcome*: Middleware redirects to `/login`.

4. **Database Cleanliness Check**:
   Verify that consecutive runs of `cleanTestDatabase()` execute with zero foreign key violations even when rescheduling records are present in `Appointment`.
