# Handoff Report — Explorer Milestone 2 Iteration 2 (Turnkey Remediation Strategy)

**Agent**: `explorer_m2_it2_2`  
**Working Directory**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_it2_2`  
**Milestone**: Milestone 2 Iteration 2 (Remediation of Gate Failures)  
**Date**: 2026-10-07T02:36:00Z  

---

## 1. Observation

Direct code inspections and empirical evidence across the five failed gate issues:

### 1.1 Issue 1 — Vitest Test Runner Configuration & Database Split-Brain
- **File**: `src/lib/prisma.ts` lines 4–17:
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
  `new PrismaClient()` is instantiated without passing an explicit `datasources.db.url` configuration. If `DATABASE_URL` is omitted or altered, Prisma defaults to reading `.env` (`database=PopoApp`).
- **File**: `tests/helpers/db-client.ts` lines 14–21:
  Instantiates a separate `prismaTest` client explicitly pointing to `PopoAppTest` via `datasources: { db: { url: TEST_DATABASE_URL } }`.
- **File**: `vitest.config.ts` lines 10–20:
  ```typescript
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
  ```
  Vitest lacked explicit `pool: 'forks'`, `threads: { singleThread: true }`, and did not inject `NODE_ENV: 'test'` or `DATABASE_URL` into `test.env`.
- **File**: `tests/helpers/test-fixtures.ts` lines 4–8:
  ```typescript
  let fixtureCounter = 1;
  export function getNextCounter(): number {
    return fixtureCounter++;
  }
  ```
  Static counter starting at `1` deterministically produces CPF `90000000175` on the first call to `createTestClient()` in every suite.

### 1.2 Issue 2 — `tests/helpers/db-cleaner.ts` Foreign Key Cycles on `Appointment`
- **File**: `tests/helpers/db-cleaner.ts` lines 29–35:
  ```typescript
  for (const table of tablesInOrder) {
    try {
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    } catch {
      // Table may not exist yet during early migration phases; ignore silently
    }
  }
  ```
- **File**: `prisma/schema.prisma` lines 78–85 and `prisma/migrations/20261006000000_init_domain_models/migration.sql` line 305:
  ```sql
  ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_rescheduledFromId_fkey]
  FOREIGN KEY ([rescheduledFromId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ```
  `Appointment` has a self-referencing foreign key `rescheduledFromId`. When tests execute rescheduling workflows, rows in `dbo.Appointment` reference other rows in `dbo.Appointment`. Executing `DELETE FROM [Appointment]` triggers SQL Server error `Msg 547` (SAME TABLE REFERENCE constraint). The silent `catch` suppresses the error, leaving `Appointment` rows in place. The subsequent `DELETE FROM [Client]` also fails with `Msg 547` (referenced by `Appointment.clientId`), leaving all clients in `dbo.Client`.

### 1.3 Issue 3 — `src/middleware.ts` Cookie Inspection vs Cryptographic Unsealing
- **File**: `src/middleware.ts` lines 17–28:
  ```typescript
  const sessionCookie = request.cookies.get('popoapp-session');
  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
  ```
  The middleware verifies only the existence of the `popoapp-session` cookie string (`request.cookies.get('popoapp-session')`). It does not verify the signature or payload with `iron-session`. A client with header `Cookie: popoapp-session=dummy` bypasses the redirect for all authenticated pages (`/clientes`, `/agenda`, `/procedimentos`, etc.).
- **File**: `src/app/api/attachments/route.ts` lines 8 and 54:
  Calls `getSession()` with zero arguments instead of `getSession(request)`, causing fallback to ambient `cookies()`, and duplicates session check logic.

### 1.4 Issue 4 — `tests/tier2_boundaries/cpf_validation.spec.ts` Import Target
- **File**: `tests/tier2_boundaries/cpf_validation.spec.ts` line 2:
  ```typescript
  import { isValidCpf, normalizeCpf, formatCpf, generateValidCpf } from '../helpers/cpf-validator';
  ```
  Imports `isValidCpf`, `normalizeCpf`, and `formatCpf` from `tests/helpers/cpf-validator.ts` instead of `@/lib/cpf`.

### 1.5 Issue 5 — `AttachmentService.saveAttachment` File Extension Derivation
- **File**: `src/services/attachment.service.ts` lines 113–115:
  ```typescript
  const fileId = crypto.randomUUID();
  const ext = path.extname(input.originalName).toLowerCase() || '.bin';
  const storedFileName = `${fileId}${ext}`;
  ```
  The disk file extension is derived from untrusted `input.originalName` rather than the validated MIME type. An attacker uploading a file with MIME `image/png` and filename `malicious.exe` causes `<uuid>.exe` to be saved on disk.

---

## 2. Logic Chain

1. **Test Concurrency and Isolation**:
   - Because SQL Server LocalDB operates against physical disk files, multiple worker processes executing `cleanTestDatabase()` (`DELETE FROM [...]`) concurrently cause race conditions where records inserted by Suite A are deleted by Suite B, causing `NotFoundError` and foreign key constraint violations.
   - Configuring `pool: 'forks'`, `poolOptions: { forks: { singleFork: true }, threads: { singleThread: true } }`, `fileParallelism: false`, and `maxConcurrency: 1` enforces serial suite execution.
   - Ensuring `vitest.config.ts` declares `test.env` with `NODE_ENV: 'test'`, `DATABASE_URL` pointing to `PopoAppTest`, and `STORAGE_DIR: './storage/test_uploads'` guarantees that every spawned test process has the test environment variables pre-loaded.
   - Updating `src/lib/prisma.ts` to explicitly pass `{ datasources: url ? { db: { url } } : undefined }` and adding a guard that throws `[CRITICAL ISOLATION ERROR]` if `NODE_ENV === 'test'` and the connection string does not point to `PopoAppTest` eliminates the possibility of split-brain or accidental writes to `PopoApp`.
   - Initializing `fixtureCounter` in `test-fixtures.ts` with a dynamic seed eliminates duplicate key collisions if previous runs leave state.

2. **Database Cleaner Referential Integrity**:
   - In SQL Server, deleting rows from a table with self-referencing foreign keys requires breaking the self-referencing links first or deleting in topological leaf-to-root order.
   - Executing `UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL WHERE [rescheduledFromId] IS NOT NULL OR [rescheduledToId] IS NOT NULL` before the deletion loop severs all self-referencing cycles.
   - With cycles broken, `DELETE FROM [Appointment]` successfully deletes all appointments. Consequently, `DELETE FROM [Client]` succeeds because no foreign keys reference `Client`. Old records no longer persist across test suites.

3. **Cryptographic Session Verification in Middleware**:
   - Edge and Node runtimes in Next.js support Web Crypto API, allowing `iron-session`'s `unsealData` to decrypt and verify sealed cookies inside `src/middleware.ts`.
   - By calling `await unsealData<SessionData>(sessionCookie.value, { password: sessionOptions.password })` and asserting `session && session.isLoggedIn && session.userId`, any forged, expired, or tampered cookie fails verification.
   - Unauthenticated requests are rejected: `/api/*` endpoints receive HTTP 401 JSON, and UI page routes receive HTTP 307 redirect to `/login`.
   - Standardizing `src/app/api/attachments/route.ts` to call `getSession(request)` guarantees consistent request cookie evaluation.

4. **Production Code Testing for CPF**:
   - `src/lib/cpf.ts` exports `isValidCpf`, `normalizeCpf`, and `formatCpf`.
   - Changing line 2 of `tests/tier2_boundaries/cpf_validation.spec.ts` to import `isValidCpf, normalizeCpf, formatCpf` from `@/lib/cpf` (and `generateValidCpf` from `../helpers/cpf-validator`) ensures that unit tests directly assert production code.

5. **Sanitized Disk Extensions from Validated MIME Types**:
   - `ALLOWED_MIME_TYPES` defines the four acceptable MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
   - Mapping each allowed MIME type to a canonical extension (`.jpg`, `.png`, `.webp`, `.pdf`) guarantees that the filename written to disk is strictly `<uuid>.<safe-ext>`, regardless of what extension the client provided in `originalName`.
   - `nomeOriginal` remains unchanged in the database to preserve the original display name for user downloads.

---

## 3. Caveats

- **LocalDB Dependency**: Running `npm test` requires Microsoft SQL Server LocalDB (`MSSQLLocalDB`) to be running and `npm run db:proxy` active on port 1433 if LocalDB is not listening natively on TCP 1433.
- **UI Mock Pages**: Frontend pages under `src/app/(authenticated)/*` still render mock data from `src/data/mock`. UI integration is scheduled for Milestone 5.
- **Prisma Client Generation**: Whenever modifying schema, `npx prisma generate` must be run, though no schema modifications are required for these fixes.

---

## 4. Conclusion & Turnkey Remediation Plan

The following turnkey patches provide exact, line-numbered changes for the Worker agent to implement:

### Plan Item 1: Fix Vitest Configuration, Prisma Client & Fixture Seeds

#### 1.1 `vitest.config.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\vitest.config.ts`
- **Lines to Replace**: Lines 8–26
- **Replacement Content**:
```typescript
export default defineConfig({
  plugins: [react()],
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
      threads: {
        singleThread: true,
      },
    },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT',
      STORAGE_DIR: './storage/test_uploads',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### 1.2 `src/lib/prisma.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\src\lib\prisma.ts`
- **Lines to Replace**: Lines 1–17
- **Replacement Content**:
```typescript
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL;

  // Decision D7 Safety Guard: Prevent tests from touching development database (PopoApp)
  if (process.env.NODE_ENV === 'test') {
    if (url && !url.includes('PopoAppTest')) {
      throw new Error(
        `[CRITICAL ISOLATION ERROR] Test environment must connect to PopoAppTest! Current DATABASE_URL: ${url}`
      );
    }
  }

  return new PrismaClient({
    datasources: url
      ? {
          db: {
            url,
          },
        }
      : undefined,
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

#### 1.3 `tests/helpers/test-fixtures.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\tests\helpers\test-fixtures.ts`
- **Lines to Replace**: Lines 4–8
- **Replacement Content**:
```typescript
let fixtureCounter = Math.floor(Date.now() % 1000000) * 100 + Math.floor(Math.random() * 100);

export function getNextCounter(): number {
  return fixtureCounter++;
}
```

---

### Plan Item 2: Fix Database Cleaner Self-Referencing Foreign Keys

#### 2.1 `tests/helpers/db-cleaner.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\tests\helpers\db-cleaner.ts`
- **Lines to Replace**: Lines 7–36
- **Replacement Content**:
```typescript
export async function cleanTestDatabase(): Promise<void> {
  // Break self-referencing foreign keys on Appointment before table deletion
  try {
    await prismaTest.$executeRawUnsafe(
      'UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL WHERE [rescheduledFromId] IS NOT NULL OR [rescheduledToId] IS NOT NULL'
    );
  } catch (err: any) {
    // Ignore if table does not exist yet (SQL Server code 208)
    if (!err?.message?.includes('Invalid object name') && !err?.message?.includes('208')) {
      console.warn('[db-cleaner] Warning breaking Appointment self-references:', err?.message || err);
    }
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
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    } catch (err: any) {
      // Table may not exist yet during early migration phases; ignore code 208
      if (!err?.message?.includes('Invalid object name') && !err?.message?.includes('208')) {
        console.warn(`[db-cleaner] Warning deleting from [${table}]:`, err?.message || err);
      }
    }
  }
}
```

---

### Plan Item 3: Implement Cryptographic Unsealing in Middleware & Clean API Routes

#### 3.1 `src/middleware.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\src\middleware.ts`
- **Lines to Replace**: Lines 1–32
- **Replacement Content**:
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

  // Check and cryptographically verify session cookie
  const sessionCookie = request.cookies.get(sessionOptions.cookieName);

  let isAuthenticated = false;
  if (sessionCookie?.value) {
    try {
      const session = await unsealData<SessionData>(sessionCookie.value, {
        password: sessionOptions.password,
      });
      if (session && session.isLoggedIn && session.userId) {
        isAuthenticated = true;
      }
    } catch {
      // Forged, tampered, or expired session token
      isAuthenticated = false;
    }
  }

  if (!isAuthenticated) {
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
```

#### 3.2 `src/app/api/attachments/route.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\src\app\api\attachments\route.ts`
- **Lines to Replace**:
  - Line 8: Replace `const session = await getSession();` with `const session = await getSession(request);`
  - Line 54: Replace `const session = await getSession();` with `const session = await getSession(request);`

---

### Plan Item 4: Fix CPF Validation Unit Test Target

#### 4.1 `tests/tier2_boundaries/cpf_validation.spec.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\tests\tier2_boundaries\cpf_validation.spec.ts`
- **Lines to Replace**: Line 2
- **Replacement Content**:
```typescript
import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';
import { generateValidCpf } from '../helpers/cpf-validator';
```

---

### Plan Item 5: Sanitize Attachment File Extensions from Validated MIME Type

#### 5.1 `src/services/attachment.service.ts`
- **Target File**: `c:\Users\Vinicius\PopoApp\PopoApp\src\services\attachment.service.ts`
- **Lines to Replace (under imports & constants)**: Lines 16–17
- **Replacement Content**:
```typescript
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
```
- **Lines to Replace (in `saveAttachment`)**: Line 114
- **Replacement Content**:
```typescript
    const ext = MIME_TO_EXTENSION[input.mimeType as AllowedMimeType] || '.bin';
```

#### 5.2 Add Adversarial Test in `tests/tier5_adversarial/milestone2_adversarial_challenge.spec.ts`
- Append tests verifying:
  1. File with `originalName: 'shell.php'` and `mimeType: 'image/png'` gets saved as `<uuid>.png` on disk.
  2. Middleware request to `/clientes` with `Cookie: popoapp-session=forged_token` returns HTTP 307 redirect to `/login`.

---

## 5. Verification Method

Once the Worker applies these modifications:

1. **Verify Linter**:
   ```powershell
   npm run lint
   ```
   *Expected outcome*: 0 warnings, 0 errors.

2. **Verify Full Automated Test Suite**:
   ```powershell
   npm test
   ```
   *Expected outcome*: All test files pass (17 test files, 134+ tests), 0 failed, 0 skipped, exit code 0.

3. **Verify Middleware Security**:
   - Send GET request to `http://localhost:3000/clientes` with header `Cookie: popoapp-session=malicious_attacker_dummy_token`.
   - Assert response status is 307 redirect to `/login`.
   - Send GET request to `http://localhost:3000/api/clients` with header `Cookie: popoapp-session=malicious_attacker_dummy_token`.
   - Assert response status is 401 JSON `{ success: false, error: 'Não autorizado' }`.

4. **Verify Database Isolation Guard**:
   - Verify that running tests never writes records to the `PopoApp` database.
   - Assert that if `NODE_ENV === 'test'` and `DATABASE_URL` is set to `PopoApp`, `prisma` throws `[CRITICAL ISOLATION ERROR]`.

5. **Verify Disk File Extension Safety**:
   - Save attachment with `originalName: "test.exe"` and `mimeType: "image/png"`.
   - Verify `attachment.nomeArquivo` ends with `.png`.

6. **Invalidation Condition**:
   This remediation strategy is invalidated if any test fails, if TypeScript fails compilation (`npm run build`), or if `npm run lint` reports any errors.
