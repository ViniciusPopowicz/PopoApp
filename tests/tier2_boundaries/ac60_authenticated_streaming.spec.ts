import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { NextRequest } from 'next/server';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient } from '../helpers/test-fixtures';
import { attachmentService } from '@/services/attachment.service';
import { createMockSessionCookie } from '../helpers/auth-helper';
import { GET, DELETE } from '@/app/api/attachments/[id]/route';

describe('Critical AC 60: Authenticated Streaming & Security Boundary Tests', () => {
  let testClientId: string;
  let validAttachmentId: string;
  const storageTestDir = path.resolve(process.cwd(), './storage/test_uploads');

  beforeAll(async () => {
    process.env.STORAGE_DIR = './storage/test_uploads';
    await cleanTestDatabase();

    const client = await createTestClient();
    testClientId = client.id;

    // Create a real attachment on disk and database
    const fileContent = Buffer.from('%PDF-1.4 Relatório de atendimento médico e estético...');
    const attachment = await attachmentService.saveAttachment({
      fileBuffer: fileContent,
      originalName: 'prontuario_confidencial.pdf',
      mimeType: 'application/pdf',
      sizeBytes: fileContent.length,
      clientId: testClientId,
      categoria: 'documento',
    });
    validAttachmentId = attachment.id;
  });

  afterAll(async () => {
    if (fsSync.existsSync(storageTestDir)) {
      try {
        await fs.rm(storageTestDir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should return 401 Unauthorized for unauthenticated GET request (AC 60)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/attachments/${validAttachmentId}`);
    const response = await GET(req, {
      params: Promise.resolve({ id: validAttachmentId }),
    });

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Não autorizado');
  });

  it('should return 401 Unauthorized for unauthenticated DELETE request (AC 60)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/attachments/${validAttachmentId}`, {
      method: 'DELETE',
    });
    const response = await DELETE(req, {
      params: Promise.resolve({ id: validAttachmentId }),
    });

    expect(response.status).toBe(401);
  });

  it('should stream file with security headers for authenticated GET request', async () => {
    const sessionCookie = await createMockSessionCookie({
      userId: 'test-admin-uuid',
      isLoggedIn: true,
    });

    const req = new NextRequest(`http://localhost:3000/api/attachments/${validAttachmentId}`, {
      headers: {
        cookie: sessionCookie,
      },
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: validAttachmentId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('content-disposition')).toContain('inline');

    const streamedBody = await response.text();
    expect(streamedBody).toContain('Relatório de atendimento');
  });

  it('should return 404 Not Found for non-existent attachment ID', async () => {
    const sessionCookie = await createMockSessionCookie({
      userId: 'test-admin-uuid',
      isLoggedIn: true,
    });

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const req = new NextRequest(`http://localhost:3000/api/attachments/${fakeId}`, {
      headers: {
        cookie: sessionCookie,
      },
    });

    const response = await GET(req, {
      params: Promise.resolve({ id: fakeId }),
    });

    expect(response.status).toBe(404);
  });
});
