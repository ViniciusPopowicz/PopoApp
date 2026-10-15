## 2026-10-07T02:38:47Z
You are worker_m2_it2_1.
Your working directory is:
c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_it2_1

Project Root:
c:\Users\Vinicius\PopoApp\PopoApp

Read these files first:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (MANDATORY: read completely)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_it2_2\handoff.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_it2_3\handoff.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_1\handoff.md
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\reviewer_m2_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership (You own and may edit these files):
- `vitest.config.ts`
- `src/lib/prisma.ts`
- `tests/helpers/db-client.ts`
- `tests/helpers/db-cleaner.ts`
- `tests/helpers/test-fixtures.ts`
- `src/middleware.ts`
- `tests/tier2_boundaries/cpf_validation.spec.ts`
- `src/services/attachment.service.ts`
- `src/app/api/attachments/route.ts` (if needed for session consistency)
- `IMPLEMENTATION_CHECKLIST.md`

Your Task:
Implement the complete turnkey remediation strategy formulated by Explorer 2 and Explorer 3:
1. Vitest Runner & Database Isolation:
   - Configure single-fork/single-worker execution in `vitest.config.ts` (`poolOptions: { forks: { singleFork: true } }`) and inject `test.env` with `DATABASE_URL` pointing to `PopoAppTest`, `STORAGE_DIR`, and `NODE_ENV: 'test'`.
   - In `src/lib/prisma.ts`, configure `new PrismaClient({ datasources: { db: { url: databaseUrl } } })`. Add D7 safety check: if `process.env.NODE_ENV === 'test'`, assert that `databaseUrl` contains `PopoAppTest` and throws immediately otherwise.
   - In `tests/helpers/db-client.ts`, export the singleton `prisma` instance from `@/lib/prisma` so that services and tests share the exact same client and connection pool.
2. Clean Database Fix & Fixture Seed:
   - In `tests/helpers/db-cleaner.ts`, execute `UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL;` before truncating/deleting tables, eliminating SQL Server Msg 547 errors on self-referencing foreign keys.
   - In `tests/helpers/test-fixtures.ts`, randomize `fixtureCounter` initial seed (e.g., `Math.floor(Math.random() * 100000) + 1`) to eliminate CPF seed collisions across test suites.
3. Cryptographic Middleware Unsealing:
   - In `src/middleware.ts`, unseal the `popoapp-session` cookie with `iron-session`'s `unsealData<SessionData>` using `sessionOptions.password`. If the cookie is invalid, missing, unsealed data is empty, or `!session.isLoggedIn`, reject:
     - For `/api/*`: return 401 JSON `{ success: false, error: 'Não autorizado' }`.
     - For pages: redirect to `/login`.
4. Production Code Import in CPF Boundary Test:
   - In `tests/tier2_boundaries/cpf_validation.spec.ts`, import `isValidCpf`, `normalizeCpf`, `formatCpf` directly from `@/lib/cpf` (production code), keeping `generateValidCpf` from the test helper.
5. Secure Attachment Disk Extension:
   - In `src/services/attachment.service.ts`, map disk filename extension from validated MIME type using `MIME_TO_EXTENSION` dictionary (`image/jpeg` -> `.jpg`, `image/png` -> `.png`, `image/webp` -> `.webp`, `application/pdf` -> `.pdf`).
6. Run Verification:
   - Run `npm test` and verify that ALL test suites pass cleanly with 0 failures against `PopoAppTest`.
   - Run `npm run lint` and verify 0 errors.
   - Run `npm run build` and verify successful compilation.
7. Update `IMPLEMENTATION_CHECKLIST.md` accurately reflecting these fixes and test results.
8. Commit changes to git (D7).

Document all actions, diffs, test outputs, and git commit SHA in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m2_it2_1\handoff.md` and send a message when complete.
