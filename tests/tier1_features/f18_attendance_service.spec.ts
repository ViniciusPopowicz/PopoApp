import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { AttendanceService } from '@/services/attendance.service';
import { ProcedureService } from '@/services/procedure.service';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F18: Attendance Domain Service (Phase 7, D1, D2, D3, V08, V09, V11)', () => {
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

  it('F18.1 (V08 & V09): addProcedure snapshots procedure standard value and records explicit practiced value', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const procedure = await createTestProcedure({
      nome: 'Toxina Botulínica 50U',
      valorPadrao: 500.0,
      duracaoMinutos: 30,
    });

    const assoc = await AttendanceService.addProcedure(attendanceId, {
      procedureId: procedure.id,
      practicedValue: 400.0, // Practiced value different from standard (Example A)
      observacoes: 'Preço promocional acordado',
    });

    expect(assoc.id).toBeDefined();
    expect(Number(assoc.standardValueSnapshot)).toBe(500.0);
    expect(Number(assoc.practicedValue)).toBe(400.0);
    expect(assoc.observacoes).toBe('Preço promocional acordado');

    const attendanceWithFin = await AttendanceService.getAttendanceById(attendanceId);
    expect(attendanceWithFin.financials.standardTotal).toBe(500.0);
    expect(attendanceWithFin.financials.practicedTotal).toBe(400.0);
    expect(attendanceWithFin.financials.explicitDiscount).toBe(0.0);
    expect(attendanceWithFin.financials.netTotal).toBe(400.0);
  });

  it('F18.2 (V12 & V24): catalog standard value alteration does NOT mutate historical standardValueSnapshot', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const procedure = await createTestProcedure({
      nome: 'Preenchimento Malar',
      valorPadrao: 1200.0,
    });

    const assoc = await AttendanceService.addProcedure(attendanceId, {
      procedureId: procedure.id,
      practicedValue: 1200.0,
    });

    // Update procedure catalog price to 1500.0
    await ProcedureService.updateProcedure(procedure.id, {
      valorPadrao: 1500.0,
    });

    // Verify snapshot in attendance procedure remains 1200.0
    const reloadedAssoc = await (prismaTest as any).attendanceProcedure.findUnique({
      where: { id: assoc.id },
    });
    expect(Number(reloadedAssoc.standardValueSnapshot)).toBe(1200.0);
    expect(Number(reloadedAssoc.practicedValue)).toBe(1200.0);
  });

  it('F18.3 (D2 & V11): setDiscount updates explicit discount and dynamically computes net total and outstanding balance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const p1 = await createTestProcedure({ valorPadrao: 600.0 });
    const p2 = await createTestProcedure({ valorPadrao: 400.0 });

    await AttendanceService.addProcedure(attendanceId, {
      procedureId: p1.id,
      practicedValue: 600.0,
    });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: p2.id,
      practicedValue: 400.0,
    });

    // Practiced total = 1000. Apply discount = 150.
    const updated = await AttendanceService.setDiscount(attendanceId, { desconto: 150.0 });
    expect(Number(updated.desconto)).toBe(150.0);

    const att = await AttendanceService.getAttendanceById(attendanceId);
    expect(att.financials.practicedTotal).toBe(1000.0);
    expect(att.financials.explicitDiscount).toBe(150.0);
    expect(att.financials.netTotal).toBe(850.0);
    expect(att.financials.outstandingBalance).toBe(850.0);
    expect(att.financials.isFullyPaid).toBe(false);
  });

  it('F18.4 (V11): setDiscount throws ValidationError if discount exceeds practiced total', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 300.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 300.0,
    });

    // Attempting discount of 500 on total practiced of 300
    await expect(
      AttendanceService.setDiscount(attendanceId, { desconto: 500.0 })
    ).rejects.toThrow(ValidationError);
  });

  it('F18.5 (D1): completeAttendance sets status to Realizado and completedAt', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const completed = await AttendanceService.completeAttendance(attendanceId);
    expect(completed.status).toBe('Realizado');
    expect(completed.completedAt).toBeInstanceOf(Date);

    // Calling complete again is idempotent
    const completedAgain = await AttendanceService.completeAttendance(attendanceId);
    expect(completedAgain.status).toBe('Realizado');
  });

  it('F18.6: cancelAttendance sets status to Cancelado and prevents adding procedures', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const cancelled = await AttendanceService.cancelAttendance(attendanceId);
    expect(cancelled.status).toBe('Cancelado');

    const proc = await createTestProcedure();
    await expect(
      AttendanceService.addProcedure(attendanceId, {
        procedureId: proc.id,
        practicedValue: 200.0,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('F18.7 (D3): prefillFromPlanned copies planned procedures into attendance', async () => {
    const client = await createTestClient();
    const proc1 = await createTestProcedure({ nome: 'Peeling Químico', valorPadrao: 250.0 });
    const proc2 = await createTestProcedure({ nome: 'Máscara LED', valorPadrao: 150.0 });

    // Create appointment with planned procedures
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId: client.id,
        dataHora: new Date(),
        plannedProcedures: {
          create: [
            { procedureId: proc1.id, ordem: 0 },
            { procedureId: proc2.id, ordem: 1 },
          ],
        },
        attendances: {
          create: {
            clientId: client.id,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    const attendanceId = appt.attendances[0].id;

    const result = await AttendanceService.prefillFromPlanned(attendanceId);
    expect(result.addedCount).toBe(2);

    const att = await AttendanceService.getAttendanceById(attendanceId);
    expect(att.procedures).toHaveLength(2);
    const foundProc1 = att.procedures.find((p) => p.procedure.nome === 'Peeling Químico')!;
    const foundProc2 = att.procedures.find((p) => p.procedure.nome === 'Máscara LED')!;
    expect(foundProc1).toBeDefined();
    expect(foundProc2).toBeDefined();
    expect(Number(foundProc1.standardValueSnapshot)).toBe(250.0);
    expect(Number(foundProc2.standardValueSnapshot)).toBe(150.0);
  });
});
