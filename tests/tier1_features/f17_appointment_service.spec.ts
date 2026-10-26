import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F17: Appointment Domain Service (Phase 6, D1, D3, V01, V03, V08)', () => {
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

  it('F17.1 (D1 & V07): createAppointment creates appointment in Agendado and auto-creates linked Attendance in Pendente (never Realizado)', async () => {
    const client = await createTestClient();
    const apptDate = new Date(Date.now() + 86400000);

    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: apptDate,
      valorEstimado: 350.0,
      observacoes: 'Primeira consulta de avaliação',
    });

    expect(appt.id).toBeDefined();
    expect(appt.status).toBe('Agendado');
    expect(appt.clientId).toBe(client.id);
    expect(appt.attendances).toHaveLength(1);
    expect(appt.attendances[0].status).toBe('Pendente');
    expect(appt.attendances[0].status).not.toBe('Realizado');
    expect(appt.attendances[0].clientId).toBe(client.id);
  });

  it('F17.2 (V01): createAppointment rejects creation for an inactive client', async () => {
    const inactiveClient = await createTestClient({ status: 'inativo' });

    await expect(
      AppointmentService.createAppointment({
        clientId: inactiveClient.id,
        dataHora: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(ValidationError);
  });

  it('F17.3 (D3): createAppointment with planned procedures saves them and auto-calculates estimated value when omitted', async () => {
    const client = await createTestClient();
    const proc1 = await createTestProcedure({ nome: 'Botox Testa', valorPadrao: 400.0, duracaoMinutos: 30 });
    const proc2 = await createTestProcedure({ nome: 'Preenchimento Labial', valorPadrao: 800.0, duracaoMinutos: 45 });

    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
      plannedProcedureIds: [proc1.id, proc2.id],
      // valorEstimado omitted -> should sum 400 + 800 = 1200
    });

    expect(Number(appt.valorEstimado)).toBe(1200.0);
    expect(appt.plannedProcedures).toHaveLength(2);
    expect(appt.plannedProcedures[0].procedureId).toBe(proc1.id);
    expect(appt.plannedProcedures[1].procedureId).toBe(proc2.id);
  });

  it('F17.4: confirmAppointment transitions status from Agendado to Confirmado', async () => {
    const client = await createTestClient();
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    const confirmed = await AppointmentService.confirmAppointment(appt.id);
    expect(confirmed.status).toBe('Confirmado');

    // Confirming again is idempotent
    const confirmedAgain = await AppointmentService.confirmAppointment(appt.id);
    expect(confirmedAgain.status).toBe('Confirmado');
  });

  it('F17.5 (D1 Rule 2 & 5 & 1:1): cancelAppointment cascades Cancelado to pending attendance, preserves Realizado attendance, and rejects duplicate attendance on same appointment', async () => {
    const client = await createTestClient();
    const appt1 = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    const pendingAttId = appt1.attendances[0].id;

    // 1:1 invariant: attempting to create a second attendance on appt1 is rejected
    await expect(
      AttendanceService.createAttendance({
        appointmentId: appt1.id,
        clientId: client.id,
      })
    ).rejects.toThrow();

    // Cancel appointment 1 -> pending attendance becomes Cancelado
    const cancelled = await AppointmentService.cancelAppointment(appt1.id, {
      motivoCancelamento: 'Cliente solicitou cancelamento por motivos pessoais',
    });

    expect(cancelled.status).toBe('Cancelado');
    expect(cancelled.motivoCancelamento).toBe('Cliente solicitou cancelamento por motivos pessoais');

    const updatedPendingAtt = await (prismaTest as any).attendance.findUnique({
      where: { id: pendingAttId },
    });
    expect(updatedPendingAtt.status).toBe('Cancelado');

    // Appointment 2 with Realizado attendance: cancelling appointment preserves Realizado attendance (D1 Rule 5)
    const appt2 = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 172800000),
    });
    const realizedAttId = appt2.attendances[0].id;
    await AttendanceService.completeAttendance(realizedAttId);

    await AppointmentService.cancelAppointment(appt2.id, {
      motivoCancelamento: 'Cancelamento administrativo posterior',
    });

    const updatedRealizedAtt = await (prismaTest as any).attendance.findUnique({
      where: { id: realizedAttId },
    });
    expect(updatedRealizedAtt.status).toBe('Realizado');
  });

  it('F17.6 (D1 Rule 3): markNoShow marks appointment as Não compareceu and cascades Cancelado to pending attendance', async () => {
    const client = await createTestClient();
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    const pendingAttId = appt.attendances[0].id;

    const noShow = await AppointmentService.markNoShow(appt.id, {
      observacoes: 'Cliente não atendeu o telefone e não apareceu no horário',
    });

    expect(noShow.status).toBe('Não compareceu');
    expect(noShow.observacoes).toContain('Cliente não atendeu o telefone');

    const updatedAtt = await (prismaTest as any).attendance.findUnique({
      where: { id: pendingAttId },
    });
    expect(updatedAtt.status).toBe('Cancelado');
  });

  it('F17.7 (D1 Rule 4, V04): rescheduleAppointment executes atomic cascade', async () => {
    const client = await createTestClient();
    const oldDate = new Date(Date.now() + 86400000);
    const newDate = new Date(Date.now() + 2 * 86400000);

    const oldAppt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: oldDate,
      valorEstimado: 500.0,
      observacoes: 'Consulta inicial',
    });

    const oldAttId = oldAppt.attendances[0].id;

    const newAppt = await AppointmentService.rescheduleAppointment(oldAppt.id, {
      novaDataHora: newDate,
      motivo: 'Mudança de horário a pedido da paciente',
    });

    // 1. New appointment is Agendado with rescheduledFromId pointing to old
    expect(newAppt.id).toBeDefined();
    expect(newAppt.status).toBe('Agendado');
    expect(newAppt.rescheduledFromId).toBe(oldAppt.id);
    expect(new Date(newAppt.dataHora).getTime()).toBe(newDate.getTime());
    expect(newAppt.attendances).toHaveLength(1);
    expect(newAppt.attendances[0].status).toBe('Pendente');

    // 2. Old appointment is Reagendado with rescheduledToId pointing to new
    const reloadedOldAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: oldAppt.id },
    });
    expect(reloadedOldAppt.status).toBe('Reagendado');
    expect(reloadedOldAppt.rescheduledToId).toBe(newAppt.id);

    // 3. Old pending attendance was cancelled
    const reloadedOldAtt = await (prismaTest as any).attendance.findUnique({
      where: { id: oldAttId },
    });
    expect(reloadedOldAtt.status).toBe('Cancelado');
  });

  it('F17.8: listAppointments filters correctly by client and status', async () => {
    const client1 = await createTestClient();
    const client2 = await createTestClient();

    const appt1 = await AppointmentService.createAppointment({
      clientId: client1.id,
      dataHora: new Date(Date.now() + 86400000),
    });
    await AppointmentService.confirmAppointment(appt1.id);

    await AppointmentService.createAppointment({
      clientId: client2.id,
      dataHora: new Date(Date.now() + 86400000),
    });

    const listClient1 = await AppointmentService.listAppointments({
      clientId: client1.id,
      status: 'Confirmado',
    });

    expect(listClient1.total).toBe(1);
    expect(listClient1.items[0].id).toBe(appt1.id);
  });
});
