import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { createProcedure, updateProcedure } from '@/services/procedure.service';

describe('Critical Validation V12 & V24: Catalog Value Immutability Across Historical Records', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('modifying procedure standard value must NEVER alter historical standardValueSnapshot or practicedValue (V12, V24)', async () => {
    // 1. Create procedure in catalog with standard value R$ 500.00
    const procedure = await createProcedure({
      nome: 'Preenchimento Nasolabial',
      descricao: 'Preenchimento de sulcos nasolabiais',
      valorPadrao: 500.0,
      duracaoMinutos: 45,
      categoria: 'Preenchimento',
    });
    expect(procedure.valorPadrao).toBe(500.0);

    // 2. Client and attendance with snapshot of 500.00 and practiced value 450.00
    const client = await createTestClient();
    const appointment = await createTestAppointment(client.id);
    const attendanceId = appointment.attendances[0].id;

    const attendanceProc = await (prismaTest as any).attendanceProcedure.create({
      data: {
        attendanceId,
        procedureId: procedure.id,
        standardValueSnapshot: 500.0,
        practicedValue: 450.0,
        observacoes: 'Desconto de cortesia no valor praticado',
      },
    });

    // 3. Update catalog procedure standard value to R$ 850.00
    const updatedProcedure = await updateProcedure(procedure.id, {
      valorPadrao: 850.0,
    });
    expect(updatedProcedure.valorPadrao).toBe(850.0);

    // 4. Retrieve historical AttendanceProcedure record from database
    const historicalRecord = await (prismaTest as any).attendanceProcedure.findUnique({
      where: { id: attendanceProc.id },
    });

    expect(Number(historicalRecord.standardValueSnapshot)).toBe(500.0);
    expect(Number(historicalRecord.practicedValue)).toBe(450.0);
  });
});
