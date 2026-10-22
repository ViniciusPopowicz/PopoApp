import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ValidationError } from '@/lib/errors';

describe('Tier 2 Boundary: Validation V08 (Appointment Completion Requires Completed Attendance)', () => {
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

  it('V08.1: strictly blocks concluding an appointment while its attendance is still Pendente', async () => {
    const client = await createTestClient();
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    expect(appt.attendances[0].status).toBe('Pendente');

    // Attempting to conclude appointment while attendance is pending must throw ValidationError
    await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(
      /Não é possível concluir o agendamento sem que o atendimento esteja realizado/i
    );

    // Verify appointment status was NOT changed
    const reloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
    });
    expect(reloaded.status).toBe('Agendado');
  });

  it('V08.2: permits concluding an appointment once its attendance is marked Realizado', async () => {
    const client = await createTestClient();
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    const attendanceId = appt.attendances[0].id;

    // Transition attendance to Realizado
    await AttendanceService.completeAttendance(attendanceId);

    // Concluding appointment now succeeds!
    const concluded = await AppointmentService.completeAppointment(appt.id);
    expect(concluded.status).toBe('Concluído');

    // Re-verifying database state
    const reloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
    });
    expect(reloaded.status).toBe('Concluído');
  });

  it('V08.3: rejects concluding an appointment with status Cancelado, Não compareceu, or Reagendado', async () => {
    const client = await createTestClient();
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    await AppointmentService.cancelAppointment(appt.id, {
      motivoCancelamento: 'Paciente desmarcou',
    });

    await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(ValidationError);
  });
});
