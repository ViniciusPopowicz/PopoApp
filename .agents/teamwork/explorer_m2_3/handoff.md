# Handoff Report: Explorer M2 3 (Authenticated File Storage Pipeline)

## 1. Observation
1. **Decision D6 & Acceptance Criteria AC 60 & AC 61 (`ORIGINAL_REQUEST.md`)**:
   - Line 23: *"D6. File storage: uploaded files live on local disk outside the public folder and are served only through authenticated routes, never via predictable public URLs."*
   - Line 60: *"Unauthenticated requests to protected pages, APIs and attachment download routes are rejected (tested)."* (AC 60)
   - Line 61: *"The database rejects an attachment row owning both a Client and an Attendance (or neither). This is verified by a test that bypasses the service layer."* (AC 61)
2. **Domain Specification Requirements (`POPOAPP_DEVELOPMENT_SPEC.md`)**:
   - Lines 81–89 (§5 Profile Photo): Profile photo is a Client attachment. When replaced, previous photo does not need to be preserved as historical data and should be cleaned up.
   - Lines 93–131 (§6 Attachments): Client-level vs Attendance-level attachments; critical ownership exclusivity rule (Client XOR Attendance).
   - Line 631 (§32 Critical Validation V14): *"14. An Attachment belongs to Client OR Attendance, never both."*
   - Lines 946–953 (§47 Example E): Concrete scenario contrasting Client-level attachments with Attendance-level attachments.
3. **Checklist & Implementation Phases (`IMPLEMENTATION_CHECKLIST.md`)**:
   - Lines 163–166 (Phase 4): Disk storage outside `public/` with UUID filenames, 10MB limit, allowed MIME types (JPEG, PNG, WebP, PDF), authenticated streaming `/api/attachments/[id]`, path traversal prevention.
   - Lines 248–258 (Phase 11 🔴): Comprehensive breakdown of secure local file storage, ownership exclusivity (`CK_Attachment_Ownership`), streaming endpoint, and profile photo integration.
4. **Relational Schema & Database Constraint (`prisma/schema.prisma` & `migration.sql`)**:
   - `Attachment` model contains `id`, `clientId`, `attendanceId`, `nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `mimeType`, `tamanhoBytes`, `categoria`, `createdAt`, `updatedAt`.
   - `Client` model contains `profilePhotoId String?`.
   - Migration `prisma/migrations/20261006000000_init_domain_models/migration.sql` lines 329–330 defines:
     `ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership] CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));`
5. **Existing Environment & Test Harness**:
   - `.env.test` line 3 configures `STORAGE_DIR="./storage/test_uploads"`.
   - `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` already tests and passes database-level CHECK constraint rejection.
   - `tests/helpers/auth-helper.ts` provides `createMockSessionCookie()` for authenticated HTTP route testing.
   - `src/lib/session.ts` provides `getSession()` using `iron-session`.

## 2. Logic Chain
1. From Observation 1 (D6) and Observation 4, uploaded binary files must never be placed in Next.js `public/` directory where predictable URLs could be accessed anonymously. The storage root is isolated at `./storage/uploads` (or `./storage/test_uploads` in test).
2. From Observation 3 and Observation 4, generating UUID-based disk filenames (`${crypto.randomUUID()}${extension}`) guarantees collision freedom and eliminates path traversal vulnerabilities by ignoring client-supplied filenames for disk operations.
3. From Observation 2 (Spec §6 & §32 V14) and Observation 4, attachment ownership is strictly XOR: exactly one of `clientId` or `attendanceId` must be non-null. The service layer (`attachment.service.ts`) must enforce this with descriptive Portuguese errors, and the SQL Server `CK_Attachment_Ownership` constraint guarantees data integrity at the database layer (AC 61).
4. From Observation 1 (AC 60) and Observation 5 (`src/lib/session.ts`), all attachment retrieval and streaming must pass through `/api/attachments/[id]` which inspects `session.isLoggedIn`. Unauthenticated requests immediately receive HTTP `401 Unauthorized`.
5. For clinical confidentiality and browser security, the streaming response must attach `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-cache, no-store, must-revalidate` to prevent intermediate cache poisoning and MIME-type confusion attacks.
6. From Observation 2 (Spec §5) and Observation 4 (`Client.profilePhotoId`), replacing a profile photo triggers an atomic update: saving the new attachment, updating `Client.profilePhotoId`, and deleting the old photo file from disk and database.

## 3. Caveats
- Direct raw SQL insertions without `clientId` and `attendanceId` are already rejected by SQL Server LocalDB via `CK_Attachment_Ownership`. However, SQLite (if ever used in memory) would require triggers, but per PROJECT.md and D7, the authoritative stack is strictly SQL Server LocalDB.
- `STORAGE_DIR` directory must be created dynamically if it does not yet exist on disk before writing files.

## 4. Conclusion
Phase 11 is fully investigated and specified in `storage_spec.md`. The design comprises:
1. `src/services/attachment.service.ts`: Disk storage engine, MIME & 10MB validators, XOR ownership guards, and profile photo lifecycle.
2. `src/app/api/attachments/route.ts`: Multipart upload handler (`POST`) and list handler (`GET`).
3. `src/app/api/attachments/[id]/route.ts`: Authenticated streaming handler (`GET`) returning 401 unauthenticated (AC 60), nosniff, and private caching; and deletion handler (`DELETE`).
4. `src/app/api/clients/[id]/photo/route.ts`: Dedicated profile photo management endpoint.
5. Automated test specifications covering both service features (Tier 1) and authenticated streaming boundaries (Tier 2).

## 5. Verification Method
1. **Database Constraint Verification**:
   - Run existing Tier 2 test:
     ```powershell
     npm test tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts
     ```
   - Must pass 4 assertions verifying rejection of dual-ownership and null-ownership.
2. **Service Layer & Storage Pipeline Verification (Upon Implementation)**:
   - Run Tier 1 feature suite:
     ```powershell
     npm test tests/tier1_features/f15_attachment_storage.spec.ts
     ```
   - Verify upload, 10MB rejection, MIME type rejection, XOR validation, and file deletion.
3. **Authenticated Streaming Route Verification (Upon Implementation)**:
   - Run Tier 2 AC 60 suite:
     ```powershell
     npm test tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts
     ```
   - Verify unauthenticated GET returns status 401; authenticated GET returns 200 with headers `X-Content-Type-Options: nosniff` and `Cache-Control: private`.
