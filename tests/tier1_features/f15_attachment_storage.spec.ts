import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { attachmentService } from '@/services/attachment.service';
import { ValidationError } from '@/lib/errors';

describe('Feature F15: Authenticated File Storage Pipeline (Phase 11, D6, V12, V13, V14, AC 61)', () => {
  let testClientId: string;
  let testAttendanceId: string;
  const storageTestDir = path.resolve(process.cwd(), './storage/test_uploads');

  beforeAll(async () => {
    process.env.STORAGE_DIR = './storage/test_uploads';
    await cleanTestDatabase();

    const client = await createTestClient();
    testClientId = client.id;

    const appointment = await createTestAppointment(testClientId);
    testAttendanceId = appointment.attendances[0].id;
  });

  afterAll(async () => {
    // Clean up test upload files
    if (fsSync.existsSync(storageTestDir)) {
      try {
        await fs.rm(storageTestDir, { recursive: true, force: true });
      } catch (err) {
        // ignore cleanup error
      }
    }
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should save a valid PDF attachment for client outside web root with UUID filename', async () => {
    const fileContent = Buffer.from('%PDF-1.4 Test document content...');
    const originalName = 'termo_consentimento.pdf';

    const attachment = await attachmentService.saveAttachment({
      fileBuffer: fileContent,
      originalName,
      mimeType: 'application/pdf',
      sizeBytes: fileContent.length,
      clientId: testClientId,
      categoria: 'termo',
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.nomeOriginal).toBe(originalName);
    expect(attachment.nomeArquivo).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(attachment.clientId).toBe(testClientId);
    expect(attachment.attendanceId).toBeNull();

    // Verify physical file on disk
    const diskPath = attachmentService.getAbsoluteFilePath(attachment);
    expect(fsSync.existsSync(diskPath)).toBe(true);

    const readBuffer = await fs.readFile(diskPath);
    expect(readBuffer.toString()).toBe(fileContent.toString());
  });

  it('should reject invalid MIME types (V12)', async () => {
    const fileContent = Buffer.from('executable binary code');

    await expect(
      attachmentService.saveAttachment({
        fileBuffer: fileContent,
        originalName: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: fileContent.length,
        clientId: testClientId,
      })
    ).rejects.toThrow('Tipo de arquivo não permitido');

    await expect(
      attachmentService.saveAttachment({
        fileBuffer: fileContent,
        originalName: 'vector.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: fileContent.length,
        clientId: testClientId,
      })
    ).rejects.toThrow('Tipo de arquivo não permitido');
  });

  it('should reject files exceeding 10MB limit (V13)', async () => {
    const oversizedBytes = 10 * 1024 * 1024 + 1; // 10MB + 1 byte

    await expect(
      attachmentService.saveAttachment({
        fileBuffer: Buffer.alloc(100), // fake buffer for size test
        originalName: 'large_image.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: oversizedBytes,
        clientId: testClientId,
      })
    ).rejects.toThrow('Tamanho do arquivo excede o limite máximo permitido de 10 MB.');
  });

  it('should enforce XOR ownership: reject when BOTH clientId and attendanceId are provided (V14, AC 61)', async () => {
    const buffer = Buffer.from('test');

    await expect(
      attachmentService.saveAttachment({
        fileBuffer: buffer,
        originalName: 'exam.pdf',
        mimeType: 'application/pdf',
        sizeBytes: buffer.length,
        clientId: testClientId,
        attendanceId: testAttendanceId,
      })
    ).rejects.toThrow('O anexo deve pertencer exclusivamente a um Cliente ou a um Atendimento, nunca a ambos.');
  });

  it('should enforce XOR ownership: reject when NEITHER clientId nor attendanceId is provided (V14, AC 61)', async () => {
    const buffer = Buffer.from('test');

    await expect(
      attachmentService.saveAttachment({
        fileBuffer: buffer,
        originalName: 'exam.pdf',
        mimeType: 'application/pdf',
        sizeBytes: buffer.length,
      })
    ).rejects.toThrow('O anexo deve ser vinculado obrigatoriamente a um Cliente ou a um Atendimento.');
  });

  it('should manage profile photo lifecycle and delete previous photo (Spec §5 & §30)', async () => {
    const photo1Buffer = Buffer.from('foto-1-bytes');
    const photo2Buffer = Buffer.from('foto-2-bytes');

    // Set first profile photo
    const photo1 = await attachmentService.setClientProfilePhoto(
      testClientId,
      photo1Buffer,
      'foto1.jpg',
      'image/jpeg',
      photo1Buffer.length
    );

    const clientAfterPhoto1 = await (prismaTest as any).client.findUnique({
      where: { id: testClientId },
    });
    expect(clientAfterPhoto1.profilePhotoId).toBe(photo1.id);

    const pathPhoto1 = attachmentService.getAbsoluteFilePath(photo1);
    expect(fsSync.existsSync(pathPhoto1)).toBe(true);

    // Set second profile photo (should replace and clean up photo1)
    const photo2 = await attachmentService.setClientProfilePhoto(
      testClientId,
      photo2Buffer,
      'foto2.png',
      'image/png',
      photo2Buffer.length
    );

    const clientAfterPhoto2 = await (prismaTest as any).client.findUnique({
      where: { id: testClientId },
    });
    expect(clientAfterPhoto2.profilePhotoId).toBe(photo2.id);

    // Verify photo1 was deleted from disk and DB
    expect(fsSync.existsSync(pathPhoto1)).toBe(false);
    const photo1InDb = await attachmentService.getAttachmentById(photo1.id);
    expect(photo1InDb).toBeNull();

    // Verify photo2 exists on disk
    const pathPhoto2 = attachmentService.getAbsoluteFilePath(photo2);
    expect(fsSync.existsSync(pathPhoto2)).toBe(true);
  });

  it('should delete attachment from both disk and database', async () => {
    const buffer = Buffer.from('clinical notes attachment');
    const attachment = await attachmentService.saveAttachment({
      fileBuffer: buffer,
      originalName: 'registro_clinico.pdf',
      mimeType: 'application/pdf',
      sizeBytes: buffer.length,
      attendanceId: testAttendanceId,
    });

    const diskPath = attachmentService.getAbsoluteFilePath(attachment);
    expect(fsSync.existsSync(diskPath)).toBe(true);

    await attachmentService.deleteAttachment(attachment.id);

    expect(fsSync.existsSync(diskPath)).toBe(false);
    const inDb = await attachmentService.getAttachmentById(attachment.id);
    expect(inDb).toBeNull();
  });
});
