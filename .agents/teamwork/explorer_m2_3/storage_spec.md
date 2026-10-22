# PopoApp — Phase 11: Authenticated File Storage Pipeline Specification

## 1. Executive Summary & Objective

This specification provides the architectural and implementation blueprint for **Phase 11 (Authenticated File Storage Pipeline)** of PopoApp, satisfying:
- **Decision D6**: Local disk storage outside the web root (`public/`), served exclusively via authenticated API routes with non-predictable UUID filenames.
- **Acceptance Criteria AC 60**: Unauthenticated requests to attachment streaming and download routes return HTTP `401 Unauthorized`.
- **Acceptance Criteria AC 61 & Validation V14**: Database and service layers enforce strict attachment ownership exclusivity (Client XOR Attendance).
- **Validation V12 & V13**: Validation of allowed MIME types (JPEG, PNG, WebP, PDF) and 10 MB maximum file size limit.
- **Spec §5 & §30**: Client profile photo management, instant replacement, and automatic cleanup of previous photo files.
- **Spec §6 & §47 Example E**: Clear separation between Client-level attachments (exams, terms, general docs) and Attendance-level attachments (clinical photos, session records).

---

## 2. Disk Storage Architecture (Decision D6)

### 2.1 Storage Root Isolation
Uploaded binary files MUST NEVER be stored in `public/` or any web-accessible directory.
- **Production / Default Path**: `./storage/uploads` (resolved relative to the project root: `path.resolve(process.cwd(), process.env.STORAGE_DIR || './storage/uploads')`).
- **Test Environment Path**: `./storage/test_uploads` (configured in `.env.test` via `STORAGE_DIR="./storage/test_uploads"`).
- **Directory Bootstrapping**: The storage subsystem automatically ensures the destination directory exists recursively (`mkdir(storageDir, { recursive: true })`) prior to writing files.

### 2.2 Filename & Path Generation
To prevent path traversal, filename collisions, and unpredictable filesystem behavior:
1. **Filename Generation**: A standard cryptographically random UUID v4 string is generated via `crypto.randomUUID()`.
2. **Extension Sanitization**: The file extension is extracted from the original filename (`path.extname(originalName).toLowerCase()`) and validated against allowed extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`).
3. **Stored Filename (`nomeArquivo`)**: Format `${uuid}${safeExtension}` (e.g. `e5a6f8b2-3c1d-4f7e-9a0b-1c2d3e4f5a6b.pdf`).
4. **Relative Path (`caminhoRelativo`)**: Format `storage/uploads/${nomeArquivo}` or `uploads/${nomeArquivo}` for portable DB storage.
5. **Path Traversal Protection**: File disk paths are ALWAYS resolved strictly using `path.resolve(storageDir, nomeArquivo)`. The system verifies that the resolved path is contained directly within `storageDir`.

---

## 3. Data Model & Schema Alignment

The Prisma `Attachment` model in `prisma/schema.prisma`:

```prisma
model Attachment {
  id              String      @id @default(uuid())
  clientId        String?     // Pertence a Cliente OU Atendimento (exclusivo via CHECK)
  attendanceId    String?     // Pertence a Cliente OU Atendimento (exclusivo via CHECK)
  nomeOriginal    String
  nomeArquivo     String      // Nome do arquivo gerado no disco (UUID)
  caminhoRelativo String      // Caminho relativo dentro do STORAGE_ROOT
  mimeType        String
  tamanhoBytes    Int
  categoria       String?     // 'foto_perfil', 'documento', 'termo', 'exame', 'clinico'
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  client     Client?     @relation(fields: [clientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([clientId])
  @@index([attendanceId])
}
```

### 3.1 Database XOR Constraint (AC 61)
Enforced in SQL Server migration `20261006000000_init_domain_models`:
```sql
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
```

---

## 4. Attachment Service Blueprint (`src/services/attachment.service.ts`)

### 4.1 Constants and Validation Rules
```typescript
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CATEGORIES = [
  'foto_perfil',
  'documento',
  'termo',
  'exame',
  'clinico',
] as const;

export type AttachmentCategory = typeof ALLOWED_CATEGORIES[number];
```

### 4.2 Interfaces
```typescript
export interface SaveAttachmentInput {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  clientId?: string | null;
  attendanceId?: string | null;
  categoria?: AttachmentCategory | string | null;
}

export interface AttachmentFilter {
  clientId?: string;
  attendanceId?: string;
  categoria?: string;
}
```

### 4.3 Service Implementation Details
```typescript
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import { Attachment } from '@prisma/client';

export class AttachmentService {
  private getStorageDir(): string {
    const configuredDir = process.env.STORAGE_DIR || './storage/uploads';
    return path.resolve(process.cwd(), configuredDir);
  }

  private async ensureStorageDir(): Promise<string> {
    const dir = this.getStorageDir();
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Validates MIME type, file size, and Client XOR Attendance exclusivity.
   */
  public validateAttachmentMetadata(data: {
    mimeType: string;
    sizeBytes: number;
    clientId?: string | null;
    attendanceId?: string | null;
  }): void {
    // 1. MIME Type validation (V12)
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType as any)) {
      throw new Error(
        'Tipo de arquivo não permitido. Tipos aceitos: JPEG, PNG, WebP e PDF.'
      );
    }

    // 2. File size limit validation (V13: 10MB)
    if (data.sizeBytes <= 0 || data.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        'Tamanho do arquivo excede o limite máximo permitido de 10 MB.'
      );
    }

    // 3. Ownership exclusivity (Client XOR Attendance) (V14, AC 61)
    const hasClient = Boolean(data.clientId && data.clientId.trim().length > 0);
    const hasAttendance = Boolean(data.attendanceId && data.attendanceId.trim().length > 0);

    if (hasClient && hasAttendance) {
      throw new Error(
        'O anexo deve pertencer exclusivamente a um Cliente ou a um Atendimento, nunca a ambos.'
      );
    }

    if (!hasClient && !hasAttendance) {
      throw new Error(
        'O anexo deve ser vinculado obrigatoriamente a um Cliente ou a um Atendimento.'
      );
    }
  }

  /**
   * Saves a file to disk and records its metadata in Prisma.
   * If DB insertion fails, the written file on disk is immediately cleaned up.
   */
  public async saveAttachment(input: SaveAttachmentInput): Promise<Attachment> {
    this.validateAttachmentMetadata({
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      clientId: input.clientId,
      attendanceId: input.attendanceId,
    });

    const storageDir = await this.ensureStorageDir();
    const fileId = crypto.randomUUID();
    const ext = path.extname(input.originalName).toLowerCase() || '.bin';
    const storedFileName = `${fileId}${ext}`;
    const absoluteDiskPath = path.resolve(storageDir, storedFileName);

    // Path traversal safety check
    if (!absoluteDiskPath.startsWith(storageDir)) {
      throw new Error('Tentativa de caminho de arquivo inválido detectada.');
    }

    const relativePath = path.posix.join('storage', 'uploads', storedFileName);

    // 1. Write file to disk
    await fs.writeFile(absoluteDiskPath, input.fileBuffer);

    try {
      // 2. Insert into database
      const attachment = await prisma.attachment.create({
        data: {
          id: fileId,
          nomeOriginal: input.originalName,
          nomeArquivo: storedFileName,
          caminhoRelativo: relativePath,
          mimeType: input.mimeType,
          tamanhoBytes: input.sizeBytes,
          categoria: input.categoria ?? null,
          clientId: input.clientId ?? null,
          attendanceId: input.attendanceId ?? null,
        },
      });

      return attachment;
    } catch (dbError) {
      // Rollback: delete disk file if database record creation fails
      try {
        await fs.unlink(absoluteDiskPath);
      } catch (cleanupError) {
        console.error('Falha ao remover arquivo após erro no banco:', cleanupError);
      }
      throw dbError;
    }
  }

  /**
   * Retrieves attachment metadata by ID.
   */
  public async getAttachmentById(id: string): Promise<Attachment | null> {
    return prisma.attachment.findUnique({
      where: { id },
    });
  }

  /**
   * Resolves the absolute path on disk for a given attachment.
   */
  public getAbsoluteFilePath(attachment: Attachment): string {
    const storageDir = this.getStorageDir();
    const resolvedPath = path.resolve(storageDir, attachment.nomeArquivo);
    if (!resolvedPath.startsWith(storageDir)) {
      throw new Error('Caminho de arquivo inseguro detectado.');
    }
    return resolvedPath;
  }

  /**
   * Deletes an attachment from disk and database.
   */
  public async deleteAttachment(id: string): Promise<void> {
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      throw new Error('Anexo não encontrado.');
    }

    // If client has this attachment as profilePhotoId, unlink it
    if (attachment.clientId) {
      await prisma.client.updateMany({
        where: { id: attachment.clientId, profilePhotoId: id },
        data: { profilePhotoId: null },
      });
    }

    // Delete disk file
    const filePath = this.getAbsoluteFilePath(attachment);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Erro ao deletar arquivo físico:', err);
      }
    }

    // Delete database record
    await prisma.attachment.delete({
      where: { id },
    });
  }

  /**
   * Lists attachments by client or attendance.
   */
  public async listAttachments(filter: AttachmentFilter): Promise<Attachment[]> {
    return prisma.attachment.findMany({
      where: {
        ...(filter.clientId ? { clientId: filter.clientId } : {}),
        ...(filter.attendanceId ? { attendanceId: filter.attendanceId } : {}),
        ...(filter.categoria ? { categoria: filter.categoria } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Replaces or sets a client's profile photo (Spec §5 & §30).
   * Automatically deletes previous profile photo file and attachment record.
   */
  public async setClientProfilePhoto(
    clientId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<Attachment> {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, profilePhotoId: true },
    });

    if (!client) {
      throw new Error('Cliente não encontrado.');
    }

    const previousPhotoId = client.profilePhotoId;

    // Save new attachment
    const newAttachment = await this.saveAttachment({
      fileBuffer,
      originalName,
      mimeType,
      sizeBytes,
      clientId,
      categoria: 'foto_perfil',
    });

    // Update client profile photo reference
    await prisma.client.update({
      where: { id: clientId },
      data: { profilePhotoId: newAttachment.id },
    });

    // Clean up previous profile photo if exists
    if (previousPhotoId) {
      try {
        await this.deleteAttachment(previousPhotoId);
      } catch (err) {
        console.error('Falha ao remover foto de perfil anterior:', err);
      }
    }

    return newAttachment;
  }
}

export const attachmentService = new AttachmentService();
```

---

## 5. API Routes Architecture

### 5.1 Route 1: `POST /api/attachments` (Upload)
- **File**: `src/app/api/attachments/route.ts`
- **Session Check**:
  ```typescript
  const session = await getSession();
  if (!session || !session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  ```
- **Multipart Processing**:
  ```typescript
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const clientId = formData.get('clientId') as string | null;
  const attendanceId = formData.get('attendanceId') as string | null;
  const categoria = formData.get('categoria') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const attachment = await attachmentService.saveAttachment({
    fileBuffer,
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    clientId,
    attendanceId,
    categoria,
  });

  return NextResponse.json({ success: true, attachment }, { status: 201 });
  ```

### 5.2 Route 2: `GET /api/attachments` (List)
- **Query Params**: `?clientId=...` or `?attendanceId=...`
- **Session Check**: HTTP 401 if unauthenticated.
- **Handler**: Calls `attachmentService.listAttachments({ clientId, attendanceId })`.

### 5.3 Route 3: `GET /api/attachments/[id]` (Authenticated Streaming Route - AC 60)
- **File**: `src/app/api/attachments/[id]/route.ts`
- **Security Check (AC 60)**:
  - Check `session.isLoggedIn`. If false or missing, return **HTTP 401 Unauthorized** with `{ error: 'Não autorizado' }`.
- **Database Lookup**:
  - `attachmentService.getAttachmentById(id)`. If null, return **HTTP 404 Not Found**.
- **File Verification**:
  - Check file existence on disk (`fsSync.existsSync(filePath)`). If missing, return **HTTP 404 Not Found**.
- **Response Headers**:
  - `Content-Type: ${attachment.mimeType}`
  - `Content-Length: ${attachment.tamanhoBytes}`
  - `Content-Disposition: inline; filename="${encodeURIComponent(attachment.nomeOriginal)}"`
  - `X-Content-Type-Options: nosniff` (Mandatory security header against MIME sniffing)
  - `Cache-Control: private, no-cache, no-store, must-revalidate` (Prevents proxy/browser cache leakage of medical records)
- **Streaming Implementation**:
  ```typescript
  const fileBuffer = await fs.readFile(filePath);
  return new Response(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.tamanhoBytes.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.nomeOriginal)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  });
  ```

### 5.4 Route 4: `DELETE /api/attachments/[id]`
- **File**: `src/app/api/attachments/[id]/route.ts`
- **Session Check**: HTTP 401 if unauthenticated.
- **Handler**:
  ```typescript
  await attachmentService.deleteAttachment(id);
  return NextResponse.json({ success: true, message: 'Anexo removido com sucesso.' });
  ```

### 5.5 Profile Photo Endpoint: `POST /api/clients/[id]/photo`
- **File**: `src/app/api/clients/[id]/photo/route.ts`
- **Session Check**: HTTP 401 if unauthenticated.
- **Handler**: Calls `attachmentService.setClientProfilePhoto(clientId, fileBuffer, file.name, file.type, file.size)`.

---

## 6. Security Analysis & Threat Model

| Threat / Risk | Mitigation Mechanism | Verification Point |
|---|---|---|
| **Path Traversal (`../../etc/passwd`)** | User-supplied filename is never used as disk filename. Disk filename is always `${crypto.randomUUID()}${safeExt}`. Path resolution asserts `resolvedPath.startsWith(storageDir)`. | Unit test passing `../../` in filename. |
| **Unauthenticated File Access (AC 60)** | File is outside `public/`. Streaming route strictly verifies `session.isLoggedIn === true`. Returns 401 otherwise. | Automated test checking GET without cookie. |
| **MIME Sniffing Attack (XSS via SVG/HTML)** | Strict MIME allowlist: JPEG, PNG, WebP, PDF only. SVG and HTML are prohibited. Header `X-Content-Type-Options: nosniff`. | Validation rejection of `image/svg+xml`, `text/html`. |
| **Denial of Service (Oversized uploads)** | 10 MB strict limit (`MAX_FILE_SIZE_BYTES = 10485760`). Rejection before disk persistence. | Validation test passing 11 MB payload. |
| **Data Integrity Leakage (Dual Ownership / Orphan)** | XOR check in service layer + SQL Server CHECK constraint `CK_Attachment_Ownership`. Atomic rollback deleting disk file if DB insert fails. | `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`. |
| **Shared Cache Leakage** | Header `Cache-Control: private, no-cache, no-store, must-revalidate` prevents reverse proxies / CDNs from caching aesthetic medical images. | Header verification in API response test. |

---

## 7. Test Strategy & Test Suite Blueprint

### 7.1 Tier 1: Service Feature Tests (`tests/tier1_features/f15_attachment_storage.spec.ts`)
1. **Valid Upload**: Saves JPEG/PDF file, writes disk file in `./storage/test_uploads/`, creates Prisma record with UUID filename.
2. **MIME Validation (V12)**: Rejects `.exe`, `.svg`, `.txt`, `.zip` with Portuguese error message.
3. **File Size Validation (V13)**: Rejects buffer larger than 10 MB.
4. **Ownership Exclusivity (V14)**:
   - Rejects payload with both `clientId` and `attendanceId`.
   - Rejects payload with neither `clientId` nor `attendanceId`.
   - Accepts payload with only `clientId`.
   - Accepts payload with only `attendanceId`.
5. **Profile Photo Lifecycle (Spec §5 & §30)**:
   - Sets profile photo for client.
   - Sets second profile photo: asserts new photo is active and old photo file + DB record are deleted.
6. **Deletion**: Calling `deleteAttachment` removes DB record and removes physical disk file.

### 7.2 Tier 2: Authenticated Streaming & Boundary Tests (`tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts`)
1. **Unauthenticated Streaming Request (AC 60)**:
   - `GET /api/attachments/[id]` without session cookie returns `401 Unauthorized`.
2. **Authenticated Streaming Request**:
   - `GET /api/attachments/[id]` with valid session cookie returns `200 OK`, valid file content, `X-Content-Type-Options: nosniff`, and `Cache-Control: private`.
3. **Non-existent Attachment**:
   - `GET /api/attachments/invalid-id` returns `404 Not Found`.
4. **Unauthenticated Delete Request**:
   - `DELETE /api/attachments/[id]` without session returns `401 Unauthorized`.

---

## 8. Implementation Steps & File Manifest

| File Path | Purpose |
|---|---|
| `src/services/attachment.service.ts` | Core service: file disk operations, MIME/size/XOR validations, Prisma operations, profile photo management. |
| `src/app/api/attachments/route.ts` | Route handler for `POST` (upload) and `GET` (list). |
| `src/app/api/attachments/[id]/route.ts` | Route handler for `GET` (streaming file with AC 60 auth) and `DELETE` (clean deletion). |
| `src/app/api/clients/[id]/photo/route.ts` | Dedicated profile photo upload endpoint for instant photo updates. |
| `tests/tier1_features/f15_attachment_storage.spec.ts` | Comprehensive service layer test suite covering validations and storage mechanics. |
| `tests/tier2_boundaries/ac60_authenticated_streaming.spec.ts` | HTTP API integration test verifying 401 unauthenticated response and secure streaming headers. |
