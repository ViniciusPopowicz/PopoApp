import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { MedicalRecordService } from '@/services/medical-record.service';
import { ConflictError } from '@/lib/errors';

describe('Tier 2 Boundary: Validation V19 (Strict 1:1 Medical Record per Attendance)', () => {
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

  it('V19.1: permits creating exactly one medical record for an attendance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const record = await MedicalRecordService.createMedicalRecord({
      attendanceId,
      queixaPrincipal: 'Queixa dermatológica principal',
      avaliacaoClinica: 'Avaliação inicial detalhada',
    });

    expect(record.id).toBeDefined();
    expect(record.attendanceId).toBe(attendanceId);
  });

  it('V19.2: service layer strictly blocks creating a duplicate medical record for the same attendance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    // First record succeeds
    await MedicalRecordService.createMedicalRecord({
      attendanceId,
      queixaPrincipal: 'Registro inicial',
    });

    // Second record for same attendance throws ConflictError
    await expect(
      MedicalRecordService.createMedicalRecord({
        attendanceId,
        queixaPrincipal: 'Tentativa duplicada',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('V19.3: database layer strictly rejects duplicate attendanceId via unique constraint (bypassing service)', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    // Create first record directly via Prisma
    await (prismaTest as any).medicalRecord.create({
      data: {
        attendanceId,
        queixaPrincipal: 'Direto no banco 1',
      },
    });

    // Attempt second direct insert bypassing service layer -> must throw unique constraint error
    let dbError: any = null;
    try {
      await (prismaTest as any).medicalRecord.create({
        data: {
          attendanceId,
          queixaPrincipal: 'Direto no banco 2 duplicado',
        },
      });
    } catch (err: any) {
      dbError = err;
    }

    expect(dbError).not.toBeNull();
    // Prisma unique constraint code is P2002
    expect(dbError.code === 'P2002' || String(dbError).includes('MedicalRecord_attendanceId_key')).toBe(true);
  });
});
