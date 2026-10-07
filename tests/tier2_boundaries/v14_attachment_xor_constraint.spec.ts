import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';

describe('Critical Validation V14 & AC 61: Attachment XOR Constraint (Database Level)', () => {
  let testClientId: string;
  let testAttendanceId: string;

  beforeAll(async () => {
    await cleanTestDatabase();

    // Create client and attendance for attachment ownership references
    const client = await createTestClient();
    testClientId = client.id;

    const appointment = await createTestAppointment(testClientId);
    testAttendanceId = appointment.attendances[0].id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should REJECT an attachment row with BOTH clientId and attendanceId populated (bypassing service layer)', async () => {
    const attachmentId = 'test-att-both-0001';

    // Direct raw SQL insert bypassing any application/service validation
    let errorThrown: any = null;
    try {
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attachmentId}', 'exam.pdf', 'uuid-stored.pdf', 'application/pdf', 1024, './storage/uploads/uuid-stored.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', '${testAttendanceId}'
        )
      `);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    // Verify violation of CK_Attachment_Ownership check constraint
    const errorMessage = String(errorThrown?.message || errorThrown);
    expect(errorMessage.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
  });

  it('should REJECT an attachment row with NEITHER clientId nor attendanceId populated (bypassing service layer)', async () => {
    const attachmentId = 'test-att-neither-0002';

    let errorThrown: any = null;
    try {
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attachmentId}', 'exam.pdf', 'uuid-stored.pdf', 'application/pdf', 1024, './storage/uploads/uuid-stored.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL
        )
      `);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    const errorMessage = String(errorThrown?.message || errorThrown);
    expect(errorMessage.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
  });

  it('should ACCEPT an attachment row with ONLY clientId populated', async () => {
    const attachmentId = 'test-att-client-0003';

    await prismaTest.$executeRawUnsafe(`
      INSERT INTO [Attachment] (
        [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
        [createdAt], [updatedAt], [clientId], [attendanceId]
      ) VALUES (
        '${attachmentId}', 'termo.pdf', 'uuid-termo.pdf', 'application/pdf', 2048, './storage/uploads/uuid-termo.pdf',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', NULL
      )
    `);

    const records: any[] = await prismaTest.$queryRawUnsafe(`
      SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attachmentId}'
    `);

    expect(records).toHaveLength(1);
    expect(records[0].clientId).toBe(testClientId);
    expect(records[0].attendanceId).toBeNull();
  });

  it('should ACCEPT an attachment row with ONLY attendanceId populated', async () => {
    const attachmentId = 'test-att-attendance-0004';

    await prismaTest.$executeRawUnsafe(`
      INSERT INTO [Attachment] (
        [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
        [createdAt], [updatedAt], [clientId], [attendanceId]
      ) VALUES (
        '${attachmentId}', 'foto_antes.jpg', 'uuid-foto.jpg', 'image/jpeg', 4096, './storage/uploads/uuid-foto.jpg',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, '${testAttendanceId}'
      )
    `);

    const records: any[] = await prismaTest.$queryRawUnsafe(`
      SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attachmentId}'
    `);

    expect(records).toHaveLength(1);
    expect(records[0].attendanceId).toBe(testAttendanceId);
    expect(records[0].clientId).toBeNull();
  });
});
