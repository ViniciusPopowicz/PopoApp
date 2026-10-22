import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestAppointment,
  getNextCounter,
} from '../helpers/test-fixtures';
import { generateValidCpf } from '../helpers/cpf-validator';
import { createMockSessionCookie, getAuthHeaders } from '../helpers/auth-helper';
import { middleware } from '@/middleware';
import { ClientService } from '@/services/client.service';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { attachmentService } from '@/services/attachment.service';
import { ValidationError, ConflictError } from '@/lib/errors';

// Direct Route Handler Imports for Defense-in-Depth verification
import { GET as clientsGet, POST as clientsPost } from '@/app/api/clients/route';
import { GET as appointmentsGet, POST as appointmentsPost } from '@/app/api/appointments/route';
import { GET as attendancesGet, POST as attendancesPost } from '@/app/api/attendances/route';
import { GET as proceduresGet, POST as proceduresPost } from '@/app/api/procedures/route';
import { GET as productsGet, POST as productsPost } from '@/app/api/products/route';
import { GET as financialSummaryGet } from '@/app/api/financial/summary/route';
import { GET as financialTransactionsGet } from '@/app/api/financial/transactions/route';
import { POST as attachmentsPost } from '@/app/api/attachments/route';
import { GET as attachmentIdGet } from '@/app/api/attachments/[id]/route';
import { POST as attendanceUsagePost } from '@/app/api/attendances/[id]/usages/route';

function createUnauthRequest(pathname: string, method = 'GET', body?: any): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as any);
}

function createRequestWithCookie(pathname: string, cookieValue: string, method = 'GET', body?: any): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  const init: RequestInit = {
    method,
    headers: {
      cookie: cookieValue,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as any);
}

describe('Tier 5 Adversarial Verification: Milestone 6 Security & Business Integrity Rules', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  // =========================================================================
  // Challenge 1: Unauthenticated Requests & Session Tampering Defense
  // =========================================================================
  describe('Challenge 1: Route Authentication & Tampering Hardening (AC 60)', () => {
    const protectedRoutes = [
      { path: '/api/clients', methods: ['GET', 'POST'] },
      { path: '/api/appointments', methods: ['GET', 'POST'] },
      { path: '/api/attendances', methods: ['GET', 'POST'] },
      { path: '/api/procedures', methods: ['GET', 'POST'] },
      { path: '/api/products', methods: ['GET', 'POST'] },
      { path: '/api/financial/summary', methods: ['GET'] },
      { path: '/api/financial/transactions', methods: ['GET'] },
      { path: '/api/attachments', methods: ['POST'] },
      { path: '/api/attachments/test-attachment-uuid', methods: ['GET'] },
    ];

    it.each(protectedRoutes)(
      '1.1: Middleware rejects unauthenticated request to $path with 401',
      async ({ path }) => {
        const req = createUnauthRequest(path);
        const res = await middleware(req);

        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toMatch(/não autorizado/i);
      }
    );

    it('1.2: Middleware rejects forged/corrupt session cookie tokens with 401', async () => {
      const forgedCookies = [
        'popoapp-session=forged_ciphertext_attacker_string',
        'popoapp-session=null',
        'popoapp-session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake',
        'popoapp-session=1234567890abcdef',
      ];

      for (const cookie of forgedCookies) {
        const req = createRequestWithCookie('/api/clients', cookie);
        const res = await middleware(req);
        expect(res.status).toBe(401);
      }
    });

    it('1.3: Middleware rejects validly sealed cookie when isLoggedIn is false or userId is empty', async () => {
      const loggedOutCookie = await createMockSessionCookie({ isLoggedIn: false });
      const reqLoggedOut = createRequestWithCookie('/api/financial/summary', loggedOutCookie);
      const resLoggedOut = await middleware(reqLoggedOut);
      expect(resLoggedOut.status).toBe(401);

      const emptyUserCookie = await createMockSessionCookie({ isLoggedIn: true, userId: '' });
      const reqEmptyUser = createRequestWithCookie('/api/appointments', emptyUserCookie);
      const resEmptyUser = await middleware(reqEmptyUser);
      expect(resEmptyUser.status).toBe(401);
    });

    it('1.4: Route Handlers enforce defense-in-depth: directly rejecting unauthenticated requests with 401', async () => {
      // Direct call to route handlers without passing session cookie
      const reqGet = createUnauthRequest('/api/clients');
      const reqPost = createUnauthRequest('/api/clients', 'POST', { nome: 'Invasor' });

      // Clients route handlers
      const clientGetRes = await clientsGet(reqGet);
      expect(clientGetRes.status).toBe(401);
      const clientPostRes = await clientsPost(reqPost);
      expect(clientPostRes.status).toBe(401);

      // Appointments route handlers
      const apptGetRes = await appointmentsGet(createUnauthRequest('/api/appointments'));
      expect(apptGetRes.status).toBe(401);
      const apptPostRes = await appointmentsPost(createUnauthRequest('/api/appointments', 'POST', {}));
      expect(apptPostRes.status).toBe(401);

      // Attendances route handlers
      const attGetRes = await attendancesGet(createUnauthRequest('/api/attendances'));
      expect(attGetRes.status).toBe(401);
      const attPostRes = await attendancesPost(createUnauthRequest('/api/attendances', 'POST', {}));
      expect(attPostRes.status).toBe(401);

      // Procedures route handlers
      const procGetRes = await proceduresGet(createUnauthRequest('/api/procedures'));
      expect(procGetRes.status).toBe(401);
      const procPostRes = await proceduresPost(createUnauthRequest('/api/procedures', 'POST', {}));
      expect(procPostRes.status).toBe(401);

      // Products route handlers
      const prodGetRes = await productsGet(createUnauthRequest('/api/products'));
      expect(prodGetRes.status).toBe(401);
      const prodPostRes = await productsPost(createUnauthRequest('/api/products', 'POST', {}));
      expect(prodPostRes.status).toBe(401);

      // Financial routes
      const finSumRes = await financialSummaryGet(createUnauthRequest('/api/financial/summary'));
      expect(finSumRes.status).toBe(401);
      const finTxRes = await financialTransactionsGet(createUnauthRequest('/api/financial/transactions'));
      expect(finTxRes.status).toBe(401);

      // Attachments route handlers
      const attUploadRes = await attachmentsPost(createUnauthRequest('/api/attachments', 'POST'));
      expect(attUploadRes.status).toBe(401);
      const attStreamRes = await attachmentIdGet(
        createUnauthRequest('/api/attachments/some-uuid'),
        { params: Promise.resolve({ id: 'some-uuid' }) }
      );
      expect(attStreamRes.status).toBe(401);
    });
  });

  // =========================================================================
  // Challenge 2: Attachment XOR Constraint Against Live SQL Server Engine
  // =========================================================================
  describe('Challenge 2: Attachment XOR Exclusivity at SQL Server Engine Level (AC 61, V14)', () => {
    let testClientId: string;
    let testAttendanceId: string;

    beforeEach(async () => {
      const client = await createTestClient();
      testClientId = client.id;
      const appt = await createTestAppointment(testClientId);
      testAttendanceId = appt.attendances[0].id;
    });

    it('2.1: Rejects INSERT with BOTH clientId and attendanceId populated (CK_Attachment_Ownership)', async () => {
      const attId = `att-both-${getNextCounter()}`;

      let errorThrown: any = null;
      try {
        await prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
            [createdAt], [updatedAt], [clientId], [attendanceId]
          ) VALUES (
            '${attId}', 'exam.pdf', 'file.pdf', 'application/pdf', 1024, './storage/uploads/file.pdf',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', '${testAttendanceId}'
          )
        `);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const msg = String(errorThrown?.message || errorThrown);
      expect(msg.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
    });

    it('2.2: Rejects INSERT with NEITHER clientId nor attendanceId populated (both NULL)', async () => {
      const attId = `att-neither-${getNextCounter()}`;

      let errorThrown: any = null;
      try {
        await prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
            [createdAt], [updatedAt], [clientId], [attendanceId]
          ) VALUES (
            '${attId}', 'orphan.pdf', 'orphan.pdf', 'application/pdf', 1024, './storage/uploads/orphan.pdf',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL
          )
        `);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const msg = String(errorThrown?.message || errorThrown);
      expect(msg.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
    });

    it('2.3: Accepts INSERT with ONLY clientId populated and attendanceId NULL', async () => {
      const attId = `att-client-${getNextCounter()}`;

      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attId}', 'client_doc.pdf', 'client_doc.pdf', 'application/pdf', 2048, './storage/uploads/client_doc.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', NULL
        )
      `);

      const rows: any[] = await prismaTest.$queryRawUnsafe(`
        SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attId}'
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].clientId).toBe(testClientId);
      expect(rows[0].attendanceId).toBeNull();
    });

    it('2.4: Accepts INSERT with ONLY attendanceId populated and clientId NULL', async () => {
      const attId = `att-att-${getNextCounter()}`;

      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attId}', 'photo_before.jpg', 'photo_before.jpg', 'image/jpeg', 4096, './storage/uploads/photo_before.jpg',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, '${testAttendanceId}'
        )
      `);

      const rows: any[] = await prismaTest.$queryRawUnsafe(`
        SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attId}'
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].attendanceId).toBe(testAttendanceId);
      expect(rows[0].clientId).toBeNull();
    });

    it('2.5: Rejects UPDATE that mutates a valid Client attachment to also set attendanceId', async () => {
      const attId = `att-mut-both-${getNextCounter()}`;

      // Insert valid client-only attachment first
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attId}', 'doc.pdf', 'doc.pdf', 'application/pdf', 1024, './storage/uploads/doc.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', NULL
        )
      `);

      // Attempt to violate constraint by setting attendanceId
      let errorThrown: any = null;
      try {
        await prismaTest.$executeRawUnsafe(`
          UPDATE [Attachment]
          SET [attendanceId] = '${testAttendanceId}'
          WHERE [id] = '${attId}'
        `);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const msg = String(errorThrown?.message || errorThrown);
      expect(msg.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
    });

    it('2.6: Rejects UPDATE that clears both foreign keys to NULL', async () => {
      const attId = `att-mut-null-${getNextCounter()}`;

      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attId}', 'doc.pdf', 'doc.pdf', 'application/pdf', 1024, './storage/uploads/doc.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, '${testAttendanceId}'
        )
      `);

      let errorThrown: any = null;
      try {
        await prismaTest.$executeRawUnsafe(`
          UPDATE [Attachment]
          SET [attendanceId] = NULL
          WHERE [id] = '${attId}'
        `);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const msg = String(errorThrown?.message || errorThrown);
      expect(msg.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
    });

    it('2.7: Service layer pre-validates XOR exclusivity and throws ValidationError', async () => {
      const dummyBuffer = Buffer.from('fake pdf content');

      // Both clientId and attendanceId
      await expect(
        attachmentService.saveAttachment({
          fileBuffer: dummyBuffer,
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: dummyBuffer.length,
          clientId: testClientId,
          attendanceId: testAttendanceId,
        })
      ).rejects.toThrow(ValidationError);

      // Neither clientId nor attendanceId
      await expect(
        attachmentService.saveAttachment({
          fileBuffer: dummyBuffer,
          originalName: 'test.pdf',
          mimeType: 'application/pdf',
          sizeBytes: dummyBuffer.length,
          clientId: null,
          attendanceId: null,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // Challenge 3: Adversarial CPF Validation & Uniqueness Hardening
  // =========================================================================
  describe('Challenge 3: CPF Checksum, Malformed Input & Database Uniqueness (AC 62, D4)', () => {
    it('3.1: Service and Schema reject mathematically invalid MOD 11 checksums', async () => {
      const validCpf = generateValidCpf(12345);
      const cleanDigits = validCpf.replace(/\D/g, '');

      // Corrupt 1st check digit
      const corruptedD1 =
        cleanDigits.slice(0, 9) +
        ((parseInt(cleanDigits[9], 10) + 1) % 10) +
        cleanDigits[10];

      await expect(
        ClientService.createClient({
          nome: 'Cliente Digito 1 Corrompido',
          cpf: corruptedD1,
          telefone: '11988887777',
        })
      ).rejects.toThrow(ValidationError);

      // Corrupt 2nd check digit
      const corruptedD2 =
        cleanDigits.slice(0, 10) +
        ((parseInt(cleanDigits[10], 10) + 1) % 10);

      await expect(
        ClientService.createClient({
          nome: 'Cliente Digito 2 Corrompido',
          cpf: corruptedD2,
          telefone: '11988887777',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('3.2: Service and Schema reject all 10 repeating digit CPF patterns', async () => {
      const repeatingPatterns = [
        '000.000.000-00',
        '111.111.111-11',
        '222.222.222-22',
        '333.333.333-33',
        '444.444.444-44',
        '555.555.555-55',
        '666.666.666-66',
        '777.777.777-77',
        '888.888.888-88',
        '999.999.999-99',
      ];

      for (const pattern of repeatingPatterns) {
        await expect(
          ClientService.createClient({
            nome: `Cliente Repetitivo ${pattern}`,
            cpf: pattern,
            telefone: '11988887777',
          })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('3.3: Service rejects malformed CPFs (length != 11, alphanumeric, SQL injection)', async () => {
      const malformedCpfs = [
        '123.456.789-0', // 10 digits
        '123.456.789-012', // 12 digits
        'ABC.456.789-01', // Letters
        '1234567890', // 10 digits unformatted
        '123456789012', // 12 digits unformatted
        "12345678901' OR '1'='1", // SQL injection payload
        '<script>alert(1)</script>',
        '', // Empty
      ];

      for (const badCpf of malformedCpfs) {
        await expect(
          ClientService.createClient({
            nome: 'Cliente Input Malformado',
            cpf: badCpf,
            telefone: '11988887777',
          })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('3.4: Service layer rejects duplicate CPF with ConflictError (409)', async () => {
      const validCpf = generateValidCpf(777);

      // Create first client
      const clientA = await ClientService.createClient({
        nome: 'Cliente Original',
        cpf: validCpf,
        telefone: '11988881111',
      });
      expect(clientA.id).toBeDefined();

      // Attempt to register second client with identical CPF
      await expect(
        ClientService.createClient({
          nome: 'Cliente Duplicado',
          cpf: validCpf,
          telefone: '11988882222',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('3.5: Duplicate detection is normalization-invariant (masked vs unmasked match)', async () => {
      const validCpf = generateValidCpf(888);
      const cleanDigits = validCpf.replace(/\D/g, '');
      const maskedCpf = `${cleanDigits.slice(0, 3)}.${cleanDigits.slice(3, 6)}.${cleanDigits.slice(6, 9)}-${cleanDigits.slice(9, 11)}`;

      // Register with unmasked digits
      await ClientService.createClient({
        nome: 'Cliente Sem Mascara',
        cpf: cleanDigits,
        telefone: '11988883333',
      });

      // Attempt to register with masked digits -> must detect duplicate
      await expect(
        ClientService.createClient({
          nome: 'Cliente Com Mascara',
          cpf: maskedCpf,
          telefone: '11988884444',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('3.6: Client update rejects mutating CPF to match another existing client', async () => {
      const cpf1 = generateValidCpf(991);
      const cpf2 = generateValidCpf(992);

      const client1 = await ClientService.createClient({
        nome: 'Cliente 1',
        cpf: cpf1,
        telefone: '11988881111',
      });

      const client2 = await ClientService.createClient({
        nome: 'Cliente 2',
        cpf: cpf2,
        telefone: '11988882222',
      });

      // Try to change client2's CPF to client1's CPF
      await expect(
        ClientService.updateClient(client2.id, {
          cpf: cpf1,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('3.7: Database engine strictly rejects duplicate CPF via UNIQUE constraint [Client_cpf_key]', async () => {
      const validCpf = generateValidCpf(55555).replace(/\D/g, '');
      const clientId1 = `cli-raw-1-${getNextCounter()}`;
      const clientId2 = `cli-raw-2-${getNextCounter()}`;

      // Insert first client via raw SQL bypassing service
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Client] (
          [id], [nome], [cpf], [telefone], [status], [createdAt], [updatedAt]
        ) VALUES (
          '${clientId1}', 'Cliente Raw 1', '${validCpf}', '11999990001', 'ativo',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      // Attempt second raw insert with duplicate CPF
      let errorThrown: any = null;
      try {
        await prismaTest.$executeRawUnsafe(`
          INSERT INTO [Client] (
            [id], [nome], [cpf], [telefone], [status], [createdAt], [updatedAt]
          ) VALUES (
            '${clientId2}', 'Cliente Raw 2', '${validCpf}', '11999990002', 'ativo',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const msg = String(errorThrown?.message || errorThrown);
      expect(msg.toLowerCase()).toMatch(/unique|duplicate key|client_cpf_key|uq_client_cpf/i);
    });
  });

  // =========================================================================
  // Challenge 4: Stock Unit Lifecycle & Anti-Reuse Adversarial Hardening
  // =========================================================================
  describe('Challenge 4: Stock Unit Reuse & Exclusivity (AC 59, AC 66, V16, V17, V18)', () => {
    it('4.1: Reusable unit permits multi-session reuse by the SAME client', async () => {
      const clientA = await createTestClient({ nome: 'Carolina Silva' });
      const appt1 = await createTestAppointment(clientA.id);
      const appt2 = await createTestAppointment(clientA.id);

      const product = await ProductService.createProduct({
        nome: 'Ácido Polilático Reutilizável 5ml',
        unidade: 'frasco',
        isReusable: true,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-REUSE-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // Encounter 1 for Client A -> SUCCEEDS
      const usage1 = await StockService.recordProductUsage(appt1.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Aplicação 1: 2ml em glúteo',
      });
      expect(usage1.id).toBeDefined();

      const unitAfter1 = await (prismaTest as any).stockUnit.findUnique({
        where: { id: unit.id },
      });
      expect(unitAfter1.status).toBe('EmUso');
      expect(unitAfter1.currentClientId).toBe(clientA.id);

      // Encounter 2 for same Client A -> SUCCEEDS
      const usage2 = await StockService.recordProductUsage(appt2.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Aplicação 2: restante de 3ml no mesmo cliente',
      });
      expect(usage2.id).toBeDefined();

      const totalUsages = await (prismaTest as any).productUsage.count({
        where: { stockUnitId: unit.id },
      });
      expect(totalUsages).toBe(2);
    });

    it('4.2: Reusable unit strictly blocks cross-client reuse with Portuguese error', async () => {
      const clientA = await createTestClient({ nome: 'Cliente A Dono' });
      const clientB = await createTestClient({ nome: 'Cliente B Invasor' });

      const apptA = await createTestAppointment(clientA.id);
      const apptB = await createTestAppointment(clientB.id);

      const product = await ProductService.createProduct({
        nome: 'Toxina Botulínica 100U Frasco Reutilizável',
        unidade: 'frasco',
        isReusable: true,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-TOX-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // Client A consumes unit
      await StockService.recordProductUsage(apptA.attendances[0].id, {
        stockUnitId: unit.id,
      });

      // Client B attempts to consume the same unit -> MUST BE REJECTED
      await expect(
        StockService.recordProductUsage(apptB.attendances[0].id, {
          stockUnitId: unit.id,
          observacoes: 'Tentativa indevida de uso em outra cliente',
        })
      ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

      // Verify no records created for Client B
      const clientBUsages = await (prismaTest as any).productUsage.findMany({
        where: {
          stockUnitId: unit.id,
          attendance: { clientId: clientB.id },
        },
      });
      expect(clientBUsages).toHaveLength(0);

      // Unit remains locked to Client A
      const unitFinal = await (prismaTest as any).stockUnit.findUnique({
        where: { id: unit.id },
      });
      expect(unitFinal.currentClientId).toBe(clientA.id);
      expect(unitFinal.status).toBe('EmUso');
    });

    it('4.3: API route POST /api/attendances/[id]/usages returns 409 Conflict when authenticated user attempts cross-client reuse', async () => {
      const clientA = await createTestClient();
      const clientB = await createTestClient();

      const apptA = await createTestAppointment(clientA.id);
      const apptB = await createTestAppointment(clientB.id);

      const product = await ProductService.createProduct({
        nome: 'Bioestimulador Reutilizável API Test',
        unidade: 'frasco',
        isReusable: true,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-API-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // Associate with Client A first
      await StockService.recordProductUsage(apptA.attendances[0].id, {
        stockUnitId: unit.id,
      });

      // Now invoke the authenticated API route handler directly targeting Client B's attendance
      const authCookie = await createMockSessionCookie();
      const req = createRequestWithCookie(
        `/api/attendances/${apptB.attendances[0].id}/usages`,
        authCookie,
        'POST',
        {
          stockUnitId: unit.id,
          observacoes: 'Tentativa via API direta',
        }
      );

      const res = await attendanceUsagePost(req, {
        params: Promise.resolve({ id: apptB.attendances[0].id }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toMatch(/vinculada a outro cliente/i);
    });

    it('4.4: Single-use product unit transitions to Esgotado upon first usage', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);

      const product = await ProductService.createProduct({
        nome: 'Fio de PDO Espiculado (Descartável)',
        unidade: 'unidade',
        isReusable: false, // Single-use
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-SINGLE-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      const usage = await StockService.recordProductUsage(appt.attendances[0].id, {
        stockUnitId: unit.id,
      });
      expect(usage.id).toBeDefined();

      const reloadedUnit = await (prismaTest as any).stockUnit.findUnique({
        where: { id: unit.id },
      });
      expect(reloadedUnit.status).toBe('Esgotado');
      expect(reloadedUnit.currentClientId).toBe(client.id);
    });

    it('4.5: Single-use product unit strictly rejects second usage for the SAME client', async () => {
      const client = await createTestClient();
      const appt1 = await createTestAppointment(client.id);
      const appt2 = await createTestAppointment(client.id);

      const product = await ProductService.createProduct({
        nome: 'Microcânula Descartável 22G',
        unidade: 'unidade',
        isReusable: false,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-CAN-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // First use succeeds
      await StockService.recordProductUsage(appt1.attendances[0].id, {
        stockUnitId: unit.id,
      });

      // Second use for SAME client must fail
      await expect(
        StockService.recordProductUsage(appt2.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(/uso único.*V18/i);

      // Exactly 1 usage recorded
      const usages = await (prismaTest as any).productUsage.findMany({
        where: { stockUnitId: unit.id },
      });
      expect(usages).toHaveLength(1);
    });

    it('4.6: Single-use product unit strictly rejects second usage for a DIFFERENT client', async () => {
      const clientA = await createTestClient();
      const clientB = await createTestClient();

      const apptA = await createTestAppointment(clientA.id);
      const apptB = await createTestAppointment(clientB.id);

      const product = await ProductService.createProduct({
        nome: 'Agulha Hipodérmica Descartável',
        unidade: 'unidade',
        isReusable: false,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-AGU-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // First use for client A
      await StockService.recordProductUsage(apptA.attendances[0].id, {
        stockUnitId: unit.id,
      });

      // Second use for client B must fail
      await expect(
        StockService.recordProductUsage(apptB.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(/uso único/i);

      const usages = await (prismaTest as any).productUsage.findMany({
        where: { stockUnitId: unit.id },
      });
      expect(usages).toHaveLength(1);
    });

    it('4.7: API route POST /api/attendances/[id]/usages returns 409 Conflict when attempting second usage of single-use unit', async () => {
      const client = await createTestClient();
      const appt1 = await createTestAppointment(client.id);
      const appt2 = await createTestAppointment(client.id);

      const product = await ProductService.createProduct({
        nome: 'Seringa Descartável 3ml',
        unidade: 'unidade',
        isReusable: false,
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: `LOTE-SER-${getNextCounter()}`,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // First use succeeds
      await StockService.recordProductUsage(appt1.attendances[0].id, {
        stockUnitId: unit.id,
      });

      // Attempt second usage via API route
      const authCookie = await createMockSessionCookie();
      const req = createRequestWithCookie(
        `/api/attendances/${appt2.attendances[0].id}/usages`,
        authCookie,
        'POST',
        {
          stockUnitId: unit.id,
        }
      );

      const res = await attendanceUsagePost(req, {
        params: Promise.resolve({ id: appt2.attendances[0].id }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/uso único/i);
    });
  });
});
