import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { NextRequest } from 'next/server';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestAppointment,
  createTestProcedure,
} from '../helpers/test-fixtures';
import { createMockSessionCookie } from '../helpers/auth-helper';
import { attachmentService } from '@/services/attachment.service';
import { ValidationError } from '@/lib/errors';
import {
  createProcedureSchema,
  updateProcedureSchema,
} from '@/schemas/procedure';
import {
  deleteProcedure,
  toggleProcedureActive,
  listProcedures,
  getProcedureById,
} from '@/services/procedure.service';
import {
  GET as getAttachmentRoute,
  DELETE as deleteAttachmentRoute,
} from '@/app/api/attachments/[id]/route';
import {
  GET as getClientsRoute,
  POST as postClientsRoute,
} from '@/app/api/clients/route';
import {
  GET as getClientByIdRoute,
  PUT as putClientByIdRoute,
  DELETE as deleteClientByIdRoute,
} from '@/app/api/clients/[id]/route';
import {
  GET as getProceduresRoute,
  POST as postProceduresRoute,
} from '@/app/api/procedures/route';
import {
  GET as getProcedureByIdRoute,
  PUT as putProcedureByIdRoute,
  PATCH as patchProcedureByIdRoute,
  DELETE as deleteProcedureByIdRoute,
} from '@/app/api/procedures/[id]/route';
import { middleware } from '@/middleware';

describe('Tier 5 Adversarial Challenge: Milestone 2 (Attachment, Procedures, Route Security)', () => {
  let testClientId: string;
  let testAttendanceId: string;
  const storageTestDir = path.resolve(process.cwd(), './storage/adversarial_uploads');

  beforeAll(async () => {
    process.env.STORAGE_DIR = './storage/adversarial_uploads';
    await cleanTestDatabase();

    const client = await createTestClient();
    testClientId = client.id;

    const appointment = await createTestAppointment(testClientId);
    testAttendanceId = appointment.attendances[0].id;
  });

  afterAll(async () => {
    if (fsSync.existsSync(storageTestDir)) {
      try {
        await fs.rm(storageTestDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  // =========================================================================
  // 1. ATTACHMENT XOR CONSTRAINT ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('1. Attachment XOR Constraint (Database & Service Invariants)', () => {
    it('DB Constraint: raw insert with BOTH clientId and attendanceId set MUST fail with CHECK constraint violation', async () => {
      const rawId = 'adv-raw-both-001';
      let caughtError: any = null;

      try {
        await prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
            [createdAt], [updatedAt], [clientId], [attendanceId]
          ) VALUES (
            '${rawId}', 'both.pdf', 'both.pdf', 'application/pdf', 1024, './storage/adversarial_uploads/both.pdf',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', '${testAttendanceId}'
          )
        `);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      const msg = String(caughtError?.message || caughtError).toLowerCase();
      expect(msg).toMatch(/check constraint|ck_attachment_ownership|conflict/i);

      // Verify row was never persisted
      const count = await (prismaTest as any).attachment.count({ where: { id: rawId } });
      expect(count).toBe(0);
    });

    it('DB Constraint: raw insert with NEITHER clientId nor attendanceId set MUST fail with CHECK constraint violation', async () => {
      const rawId = 'adv-raw-neither-002';
      let caughtError: any = null;

      try {
        await prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
            [createdAt], [updatedAt], [clientId], [attendanceId]
          ) VALUES (
            '${rawId}', 'neither.pdf', 'neither.pdf', 'application/pdf', 1024, './storage/adversarial_uploads/neither.pdf',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL
          )
        `);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      const msg = String(caughtError?.message || caughtError).toLowerCase();
      expect(msg).toMatch(/check constraint|ck_attachment_ownership|conflict/i);

      const count = await (prismaTest as any).attachment.count({ where: { id: rawId } });
      expect(count).toBe(0);
    });

    it('Service Layer: saveAttachment with BOTH clientId and attendanceId MUST throw ValidationError', async () => {
      const buffer = Buffer.from('adversarial test payload');

      await expect(
        attachmentService.saveAttachment({
          fileBuffer: buffer,
          originalName: 'violating_both.pdf',
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          clientId: testClientId,
          attendanceId: testAttendanceId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Service Layer: saveAttachment with NEITHER clientId nor attendanceId MUST throw ValidationError', async () => {
      const buffer = Buffer.from('adversarial test payload');

      await expect(
        attachmentService.saveAttachment({
          fileBuffer: buffer,
          originalName: 'violating_neither.pdf',
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          clientId: null,
          attendanceId: null,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Service Layer: saveAttachment with empty/whitespace string IDs MUST throw ValidationError', async () => {
      const buffer = Buffer.from('adversarial test payload');

      await expect(
        attachmentService.saveAttachment({
          fileBuffer: buffer,
          originalName: 'empty_ids.pdf',
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          clientId: '   ',
          attendanceId: '   ',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 2. ATTACHMENT FILE BOUNDARIES & PATH TRAVERSAL ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('2. Attachment File Boundaries & Path Traversal Resistance', () => {
    it('File size boundary: file exceeding 10MB (10MB + 1 byte) MUST be rejected', async () => {
      const oversized = 10 * 1024 * 1024 + 1;
      await expect(
        attachmentService.saveAttachment({
          fileBuffer: Buffer.alloc(10),
          originalName: 'oversized.pdf',
          mimeType: 'application/pdf',
          sizeBytes: oversized,
          clientId: testClientId,
        })
      ).rejects.toThrow('Tamanho do arquivo excede o limite máximo permitido de 10 MB.');
    });

    it('File size boundary: file with 0 bytes or negative size MUST be rejected', async () => {
      await expect(
        attachmentService.saveAttachment({
          fileBuffer: Buffer.alloc(0),
          originalName: 'empty.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 0,
          clientId: testClientId,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        attachmentService.saveAttachment({
          fileBuffer: Buffer.alloc(0),
          originalName: 'negative.pdf',
          mimeType: 'application/pdf',
          sizeBytes: -5,
          clientId: testClientId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('MIME type boundary: executable, shell script, HTML, JS and PHP files MUST be strictly rejected', async () => {
      const buffer = Buffer.from('malicious payload');

      const forbiddenTypes = [
        { name: 'malware.exe', mime: 'application/x-msdownload' },
        { name: 'malware.exe', mime: 'application/x-dosexec' },
        { name: 'script.sh', mime: 'application/x-sh' },
        { name: 'script.sh', mime: 'text/x-shellscript' },
        { name: 'phish.html', mime: 'text/html' },
        { name: 'payload.js', mime: 'application/javascript' },
        { name: 'shell.php', mime: 'application/x-httpd-php' },
        { name: 'vector.svg', mime: 'image/svg+xml' },
        { name: 'archive.zip', mime: 'application/zip' },
      ];

      for (const item of forbiddenTypes) {
        await expect(
          attachmentService.saveAttachment({
            fileBuffer: buffer,
            originalName: item.name,
            mimeType: item.mime,
            sizeBytes: buffer.length,
            clientId: testClientId,
          })
        ).rejects.toThrow('Tipo de arquivo não permitido');
      }
    });

    it('Path traversal defense: filename with relative path sequence MUST NOT escape storage directory', async () => {
      const buffer = Buffer.from('%PDF-1.4 safe pdf bytes');
      const traversalFilenames = [
        '../../../../etc/passwd.pdf',
        '..\\..\\..\\windows\\system32\\calc.exe.pdf',
        '....//....//deep/nested.pdf',
        './../../malicious.pdf',
      ];

      for (const maliciousName of traversalFilenames) {
        const attachment = await attachmentService.saveAttachment({
          fileBuffer: buffer,
          originalName: maliciousName,
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          clientId: testClientId,
        });

        const diskPath = attachmentService.getAbsoluteFilePath(attachment);
        const resolvedStorageDir = path.resolve(process.cwd(), storageTestDir);

        // Assert file is safely confined to storage directory
        expect(diskPath.startsWith(resolvedStorageDir)).toBe(true);
        expect(fsSync.existsSync(diskPath)).toBe(true);
        // Assert stored file name uses sanitized UUID, not malicious traversal path
        expect(attachment.nomeArquivo).toMatch(/^[0-9a-f-]{36}\.pdf$/);

        // Clean up
        await attachmentService.deleteAttachment(attachment.id);
      }
    });

    it('Path traversal defense: getAbsoluteFilePath MUST reject forged/tampered stored filename', () => {
      const fakeTamperedAttachment = {
        id: 'fake-id',
        nomeArquivo: '../../etc/passwd',
      } as any;

      expect(() => {
        attachmentService.getAbsoluteFilePath(fakeTamperedAttachment);
      }).toThrow('Caminho de arquivo inseguro detectado.');
    });
  });

  // =========================================================================
  // 3. PROCEDURE BOUNDARIES & SOFT DEACTIVATION ADVERSARIAL CHALLENGES
  // =========================================================================
  describe('3. Procedure Boundaries (Pricing & Soft Deactivation)', () => {
    it('Procedure pricing: standard value = 0 MUST be rejected by schema and API route', async () => {
      // 1. Zod schema validation
      const parseResult = createProcedureSchema.safeParse({
        nome: 'Procedimento Zero',
        descricao: 'Teste com valor zero',
        valorPadrao: 0,
        duracaoMinutos: 30,
        categoria: 'Facial',
      });
      expect(parseResult.success).toBe(false);

      // 2. API route POST /api/procedures with valorPadrao = 0
      const sessionCookie = await createMockSessionCookie();
      const req = new NextRequest('http://localhost:3000/api/procedures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          nome: 'Procedimento Zero',
          descricao: 'Teste com valor zero',
          valorPadrao: 0,
          duracaoMinutos: 30,
          categoria: 'Facial',
        }),
      });

      const response = await postProceduresRoute(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/inválidos/i);
    });

    it('Procedure pricing: standard value < 0 MUST be rejected by schema and API route', async () => {
      // 1. Zod schema validation
      const parseResult = createProcedureSchema.safeParse({
        nome: 'Procedimento Negativo',
        descricao: 'Teste com valor negativo',
        valorPadrao: -150.0,
        duracaoMinutos: 30,
        categoria: 'Facial',
      });
      expect(parseResult.success).toBe(false);

      // 2. API route POST /api/procedures with negative value
      const sessionCookie = await createMockSessionCookie();
      const req = new NextRequest('http://localhost:3000/api/procedures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          nome: 'Procedimento Negativo',
          descricao: 'Teste com valor negativo',
          valorPadrao: -50.0,
          duracaoMinutos: 30,
          categoria: 'Facial',
        }),
      });

      const response = await postProceduresRoute(req);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('Procedure category: missing or empty category MUST be rejected by schema and API route', async () => {
      // 1. Zod schema validation
      const r1 = createProcedureSchema.safeParse({
        nome: 'Procedimento Sem Categoria',
        descricao: 'Teste sem categoria',
        valorPadrao: 300,
        duracaoMinutos: 30,
      });
      expect(r1.success).toBe(false);

      const r2 = createProcedureSchema.safeParse({
        nome: 'Procedimento Categoria Vazia',
        descricao: 'Teste categoria vazia',
        valorPadrao: 300,
        duracaoMinutos: 30,
        categoria: '   ',
      });
      expect(r2.success).toBe(false);

      // 2. API route POST /api/procedures without category
      const sessionCookie = await createMockSessionCookie();
      const req = new NextRequest('http://localhost:3000/api/procedures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          nome: 'Procedimento Sem Categoria',
          descricao: 'Teste sem categoria',
          valorPadrao: 300,
          duracaoMinutos: 30,
        }),
      });

      const response = await postProceduresRoute(req);
      expect(response.status).toBe(400);
    });

    it('Soft deactivation: unused procedure is HARD deleted, but procedure in use is SOFT deactivated', async () => {
      const sessionCookie = await createMockSessionCookie();

      // Case A: Unused procedure
      const unusedProcedure = await createTestProcedure({
        nome: 'Procedimento Nunca Usado',
        valorPadrao: 200,
      });

      const deleteResultUnused = await deleteProcedure(unusedProcedure.id);
      expect(deleteResultUnused.success).toBe(true);
      expect(deleteResultUnused.softDeactivated).toBe(false);

      // Verify it was permanently removed
      const checkUnused = await (prismaTest as any).procedure.findUnique({
        where: { id: unusedProcedure.id },
      });
      expect(checkUnused).toBeNull();

      // Case B: Procedure in clinical use (linked to AttendanceProcedure)
      const usedProcedure = await createTestProcedure({
        nome: 'Procedimento Em Uso Clínico',
        valorPadrao: 450,
      });

      // Link procedure to attendance
      await (prismaTest as any).attendanceProcedure.create({
        data: {
          attendanceId: testAttendanceId,
          procedureId: usedProcedure.id,
          standardValueSnapshot: 450.0,
          practicedValue: 400.0,
        },
      });

      // Attempt to delete used procedure via service
      const deleteResultUsed = await deleteProcedure(usedProcedure.id);
      expect(deleteResultUsed.success).toBe(true);
      expect(deleteResultUsed.softDeactivated).toBe(true);
      expect(deleteResultUsed.message).toContain('desativado em vez de excluído');

      // Verify it STILL exists in DB with isActive = false (preserving history)
      const checkUsed = await (prismaTest as any).procedure.findUnique({
        where: { id: usedProcedure.id },
      });
      expect(checkUsed).not.toBeNull();
      expect(checkUsed.isActive).toBe(false);

      // Verify active filtering in listProcedures
      const activeList = await listProcedures({ active: true });
      expect(activeList.some((p) => p.id === usedProcedure.id)).toBe(false);

      const allList = await listProcedures({ active: false });
      expect(allList.some((p) => p.id === usedProcedure.id)).toBe(true);

      // Verify toggle reactivation
      const reactivated = await toggleProcedureActive(usedProcedure.id, true);
      expect(reactivated.isActive).toBe(true);

      // Verify DELETE via API route returns softDeactivated: true
      const reqDelete = new NextRequest(`http://localhost:3000/api/procedures/${usedProcedure.id}`, {
        method: 'DELETE',
        headers: { Cookie: sessionCookie },
      });
      const routeRes = await deleteProcedureByIdRoute(reqDelete, {
        params: Promise.resolve({ id: usedProcedure.id }),
      });
      expect(routeRes.status).toBe(200);
      const routeJson = await routeRes.json();
      expect(routeJson.softDeactivated).toBe(true);
    });
  });

  // =========================================================================
  // 4. ROUTE SECURITY ADVERSARIAL CHALLENGES (UNAUTHENTICATED ACCESS)
  // =========================================================================
  describe('4. Route Security: Unauthenticated Requests MUST Return 401 JSON', () => {
    let dummyProcedureId: string;

    beforeAll(async () => {
      const p = await createTestProcedure({ nome: 'Procedimento Auth Test' });
      dummyProcedureId = p.id;
    });

    it('GET & DELETE /api/attachments/[id] without session cookie MUST return 401 JSON', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/attachments/some-attachment-id`);
      const getRes = await getAttachmentRoute(getReq, {
        params: Promise.resolve({ id: 'some-attachment-id' }),
      });
      expect(getRes.status).toBe(401);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(false);
      expect(getJson.error).toBe('Não autorizado');

      const delReq = new NextRequest(`http://localhost:3000/api/attachments/some-attachment-id`, {
        method: 'DELETE',
      });
      const delRes = await deleteAttachmentRoute(delReq, {
        params: Promise.resolve({ id: 'some-attachment-id' }),
      });
      expect(delRes.status).toBe(401);
      const delJson = await delRes.json();
      expect(delJson.success).toBe(false);
      expect(delJson.error).toBe('Não autorizado');
    });

    it('GET & POST /api/clients without session cookie MUST return 401 JSON', async () => {
      // 1. GET /api/clients
      const getReq = new NextRequest('http://localhost:3000/api/clients');
      const getRes = await getClientsRoute(getReq);
      expect(getRes.status).toBe(401);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(false);
      expect(getJson.error).toMatch(/não autorizad|sessão expirada/i);

      // 2. POST /api/clients
      const postReq = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Hacker Client' }),
      });
      const postRes = await postClientsRoute(postReq);
      expect(postRes.status).toBe(401);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(false);
      expect(postJson.error).toMatch(/não autorizad|sessão expirada/i);
    });

    it('GET, PUT, DELETE /api/clients/[id] without session cookie MUST return 401 JSON', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/clients/${testClientId}`);
      const getRes = await getClientByIdRoute(getReq, {
        params: Promise.resolve({ id: testClientId }),
      });
      expect(getRes.status).toBe(401);

      const putReq = new NextRequest(`http://localhost:3000/api/clients/${testClientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Updated Without Auth' }),
      });
      const putRes = await putClientByIdRoute(putReq, {
        params: Promise.resolve({ id: testClientId }),
      });
      expect(putRes.status).toBe(401);

      const delReq = new NextRequest(`http://localhost:3000/api/clients/${testClientId}`, {
        method: 'DELETE',
      });
      const delRes = await deleteClientByIdRoute(delReq, {
        params: Promise.resolve({ id: testClientId }),
      });
      expect(delRes.status).toBe(401);
    });

    it('GET & POST /api/procedures without session cookie MUST return 401 JSON', async () => {
      const getReq = new NextRequest('http://localhost:3000/api/procedures');
      const getRes = await getProceduresRoute(getReq);
      expect(getRes.status).toBe(401);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(false);
      expect(getJson.error).toMatch(/não autorizad|sessão expirada/i);

      const postReq = new NextRequest('http://localhost:3000/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: 'Unauthorized Procedure',
          descricao: 'Desc',
          valorPadrao: 100,
          duracaoMinutos: 30,
          categoria: 'Geral',
        }),
      });
      const postRes = await postProceduresRoute(postReq);
      expect(postRes.status).toBe(401);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(false);
      expect(postJson.error).toMatch(/não autorizad|sessão expirada/i);
    });

    it('GET, PUT, PATCH, DELETE /api/procedures/[id] without session cookie MUST return 401 JSON', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/procedures/${dummyProcedureId}`);
      const getRes = await getProcedureByIdRoute(getReq, {
        params: Promise.resolve({ id: dummyProcedureId }),
      });
      expect(getRes.status).toBe(401);

      const putReq = new NextRequest(`http://localhost:3000/api/procedures/${dummyProcedureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Changed Name' }),
      });
      const putRes = await putProcedureByIdRoute(putReq, {
        params: Promise.resolve({ id: dummyProcedureId }),
      });
      expect(putRes.status).toBe(401);

      const patchReq = new NextRequest(`http://localhost:3000/api/procedures/${dummyProcedureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      const patchRes = await patchProcedureByIdRoute(patchReq, {
        params: Promise.resolve({ id: dummyProcedureId }),
      });
      expect(patchRes.status).toBe(401);

      const delReq = new NextRequest(`http://localhost:3000/api/procedures/${dummyProcedureId}`, {
        method: 'DELETE',
      });
      const delRes = await deleteProcedureByIdRoute(delReq, {
        params: Promise.resolve({ id: dummyProcedureId }),
      });
      expect(delRes.status).toBe(401);
    });

    it('Corrupted session cookie (tampered iron-session token) MUST return 401 JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/clients', {
        headers: {
          Cookie: 'popoapp-session=forged-corrupted-token-signature-invalid',
        },
      });

      const res = await getClientsRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('Next.js Middleware: unauthenticated requests to protected API endpoints return 401 JSON directly', async () => {
      const testPaths = [
        '/api/attachments/some-attachment-uuid',
        '/api/clients',
        '/api/clients/some-client-uuid',
        '/api/procedures',
        '/api/procedures/some-procedure-uuid',
      ];

      for (const p of testPaths) {
        const req = new NextRequest(`http://localhost:3000${p}`);
        const res = await middleware(req);

        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toBe('Não autorizado');
      }
    });
  });
});
