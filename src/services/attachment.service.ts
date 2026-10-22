import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import { Attachment } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CATEGORIES = [
  'foto_perfil',
  'documento',
  'termo',
  'exame',
  'clinico',
] as const;

export type AttachmentCategory = typeof ALLOWED_CATEGORIES[number];

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
   * Validates MIME type, file size, and Client XOR Attendance exclusivity (V12, V13, V14, AC 61).
   */
  public validateAttachmentMetadata(data: {
    mimeType: string;
    sizeBytes: number;
    clientId?: string | null;
    attendanceId?: string | null;
  }): void {
    // 1. MIME Type validation (V12)
    if (!ALLOWED_MIME_TYPES.includes(data.mimeType as any)) {
      throw new ValidationError(
        'Tipo de arquivo não permitido. Tipos aceitos: JPEG, PNG, WebP e PDF.'
      );
    }

    // 2. File size limit validation (V13: 10MB)
    if (data.sizeBytes <= 0 || data.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        'Tamanho do arquivo excede o limite máximo permitido de 10 MB.'
      );
    }

    // 3. Ownership exclusivity (Client XOR Attendance) (V14, AC 61)
    const hasClient = Boolean(data.clientId && data.clientId.trim().length > 0);
    const hasAttendance = Boolean(data.attendanceId && data.attendanceId.trim().length > 0);

    if (hasClient && hasAttendance) {
      throw new ValidationError(
        'O anexo deve pertencer exclusivamente a um Cliente ou a um Atendimento, nunca a ambos.'
      );
    }

    if (!hasClient && !hasAttendance) {
      throw new ValidationError(
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
    // Extension derives from the validated MIME type, never from the client-supplied name
    const ext = MIME_TO_EXTENSION[input.mimeType as AllowedMimeType];
    const storedFileName = `${fileId}${ext}`;
    const absoluteDiskPath = path.resolve(storageDir, storedFileName);

    // Path traversal safety check
    if (!absoluteDiskPath.startsWith(storageDir)) {
      throw new ValidationError('Tentativa de caminho de arquivo inválido detectada.');
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
      throw new ValidationError('Caminho de arquivo inseguro detectado.');
    }
    return resolvedPath;
  }

  /**
   * Deletes an attachment from disk and database.
   */
  public async deleteAttachment(id: string): Promise<void> {
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      throw new NotFoundError('Anexo não encontrado.');
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
      throw new NotFoundError('Cliente não encontrado.');
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
