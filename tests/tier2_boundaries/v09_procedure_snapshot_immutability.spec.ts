import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { AttendanceService } from '@/services/attendance.service';
import { ProcedureService } from '@/services/procedure.service';
import { addAttendanceProcedureSchema } from '@/schemas/attendance';

describe('Tier 2 Boundary: Validation V09 (Procedure Standard Value Snapshot Immutability)', () => {
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

  it('V09.1 (Spec §47 Example A): standard value 500, practiced 400, discount 0, without automatic discount', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const procedure = await createTestProcedure({
      nome: 'Procedimento Exemplo A',
      valorPadrao: 500.0,
    });

    const assoc = await AttendanceService.addProcedure(attendanceId, {
      procedureId: procedure.id,
      practicedValue: 400.0,
    });

    expect(Number(assoc.standardValueSnapshot)).toBe(500.0);
    expect(Number(assoc.practicedValue)).toBe(400.0);

    const att = await AttendanceService.getAttendanceById(attendanceId);
    expect(Number(att.desconto)).toBe(0.0);
    expect(att.financials.standardTotal).toBe(500.0);
    expect(att.financials.practicedTotal).toBe(400.0);
    expect(att.financials.explicitDiscount).toBe(0.0);
    expect(att.financials.netTotal).toBe(400.0);
  });

  it('V09.2: catalog price changes do not mutate historical snapshots (V09, V12, V24)', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const procedure = await createTestProcedure({
      nome: 'Preenchimento Labial',
      valorPadrao: 1000.0,
    });

    const assoc = await AttendanceService.addProcedure(attendanceId, {
      procedureId: procedure.id,
      practicedValue: 1000.0,
    });

    // Procedure catalog price updated from 1000 to 1400
    await ProcedureService.updateProcedure(procedure.id, {
      valorPadrao: 1400.0,
    });

    // Check attendance record
    const reloaded = await (prismaTest as any).attendanceProcedure.findUnique({
      where: { id: assoc.id },
    });
    expect(Number(reloaded.standardValueSnapshot)).toBe(1000.0);
    expect(Number(reloaded.practicedValue)).toBe(1000.0);
  });

  it('V09.3: practiced value cannot be negative', () => {
    const invalidResult = addAttendanceProcedureSchema.safeParse({
      procedureId: '00000000-0000-0000-0000-000000000000',
      practicedValue: -50.0,
    });

    expect(invalidResult.success).toBe(false);
  });
});
