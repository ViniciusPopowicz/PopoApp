# Dispatch: Explorer M2 3 (Authenticated File Storage Pipeline)

You are an exploration agent (`teamwork_preview_explorer`).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_3
Project Root: c:\Users\Vinicius\PopoApp\PopoApp
Parent Orchestrator Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\orchestrator_1

Authoritative Sources:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (Decision D6, AC 60, AC 61)
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§6, §32 V12–V14, §47 Example E)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md (Phase 11 🔴)
- c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma

Objective:
Investigate and design Phase 11 (Authenticated File Storage Pipeline):
1. Disk Storage Architecture (Decision D6):
   - Storage directory MUST live outside `public/` (e.g. `./storage/uploads/` in production, `./storage/test_uploads/` in test).
   - Random UUID filename generation (`${uuid()}${ext}`) preventing path traversal and name collisions.
2. Attachment Service (`src/services/attachment.service.ts`):
   - MIME type validation (allowed: image/jpeg, image/png, image/webp, application/pdf) (V12).
   - Maximum file size validation (10 MB limit) (V13).
   - Ownership exclusivity enforcement (Client XOR Attendance): exactly one must be provided (V14, AC 61).
   - Save file to disk, record metadata in `Attachment` Prisma model (`nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `mimeType`, `tamanhoBytes`, `categoria`).
   - File deletion: remove disk file and delete database record.
3. API Routes:
   - `POST /api/attachments`: Multipart file upload, session auth check, validation, returns attachment record.
   - `GET /api/attachments/[id]`: Authenticated streaming route. Checks iron-session (`session.isLoggedIn`). Unauthenticated returns 401 (AC 60). Streams file buffer with `X-Content-Type-Options: nosniff` and `Cache-Control: private`.
   - `DELETE /api/attachments/[id]`: Session check, deletes file and record.

Deliverables:
- Detailed design and implementation blueprint in `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_3\storage_spec.md`.
- Self-contained handoff.md in your working directory.
- Notify parent via send_message.


## 2026-10-06T03:33:36Z
You are Explorer M2 3 (Authenticated File Storage Pipeline).
Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_3
Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_3\DISPATCH.md first.

Authoritative source files:
- c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md (D6, AC 60, AC 61)
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§6, §32 V12–V14, §47 Example E)
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\IMPLEMENTATION_CHECKLIST.md (Phase 11 🔴)
- c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma

Investigate and design Phase 11 (Authenticated File Storage Pipeline: disk storage outside public root, attachment.service.ts with MIME & 10MB validation, XOR ownership, authenticated streaming /api/attachments/[id] returning 401 unauth).

Deliverables:
- Write storage_spec.md in your working directory.
- Write self-contained handoff.md in your working directory.
- Notify parent via send_message when done.
