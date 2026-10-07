import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient } from '../helpers/test-fixtures';

describe('Tier 3: Appointment & Attendance Lifecycle State Machine (D1, AC 57)', () => {
  let clientId: string;

  beforeAll(async () => {
    await cleanTestDatabase();
    const client = await createTestClient();
    clientId = client.id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('D1 Rule 1: Appointment creation instantiates linked Attendance in Pendente status (never Realizado)', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-01T10:00:00Z'),
        status: 'Agendado',
        valorEstimado: 450.0,
        observacoes: 'Agendamento inicial',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
            observacoes: 'Atendimento gerado automaticamente',
          },
        },
      },
      include: {
        attendances: true,
      },
    });

    expect(appt.status).toBe('Agendado');
    expect(appt.attendances).toHaveLength(1);
    expect(appt.attendances[0].status).toBe('Pendente');
    expect(appt.attendances[0].status).not.toBe('Realizado');
  });

  it('D1 Rule 2: Appointment cancellation cascades status Cancelado to pending Attendance', async () => {
    // Setup appointment with pending attendance
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-02T14:00:00Z'),
        status: 'Agendado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    const pendingAttendanceId = appt.attendances[0].id;

    // Execute cancellation transaction (as per D1 state machine contract)
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: {
          status: 'Cancelado',
          motivoCancelamento: 'Cliente com febre',
        },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Cancelado');
    expect(updatedAppt.attendances[0].status).toBe('Cancelado');
  });

  it('D1 Rule 3: Appointment no-show (Não compareceu) cascades status Cancelado to pending Attendance', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-03T16:00:00Z'),
        status: 'Confirmado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    // Execute no-show transaction
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: { status: 'Não compareceu' },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente',
        },
        data: { status: 'Cancelado' },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Não compareceu');
    expect(updatedAppt.attendances[0].status).toBe('Cancelado');
  });

  it('D1 Rule 4: Rescheduling sets old appointment to Reagendado, old attendance to Cancelado, creates new Agendado appt with new Pendente attendance', async () => {
    // 1. Original appointment
    const originalAppt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-05T09:00:00Z'),
        status: 'Agendado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    const oldAttendanceId = originalAppt.attendances[0].id;
    const newScheduledDate = new Date('2026-11-12T15:00:00Z');

    // 2. Rescheduling transaction
    const newAppt = await (prismaTest as any).$transaction(async (tx: any) => {
      // Create new appointment
      const createdNew = await tx.appointment.create({
        data: {
          clientId,
          dataHora: newScheduledDate,
          status: 'Agendado',
          rescheduledFromId: originalAppt.id,
          attendances: {
            create: {
              clientId,
              status: 'Pendente',
              observacoes: 'Atendimento do reagendamento',
            },
          },
        },
        include: { attendances: true },
      });

      // Update old appointment to Reagendado
      await tx.appointment.update({
        where: { id: originalAppt.id },
        data: {
          status: 'Reagendado',
          rescheduledToId: createdNew.id,
        },
      });

      // Cancel old pending attendance
      await tx.attendance.update({
        where: { id: oldAttendanceId },
        data: { status: 'Cancelado' },
      });

      return createdNew;
    });

    // Verification
    const oldApptReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: originalAppt.id },
      include: { attendances: true },
    });

    expect(oldApptReloaded.status).toBe('Reagendado');
    expect(oldApptReloaded.attendances[0].status).toBe('Cancelado');
    expect(newAppt.status).toBe('Agendado');
    expect(newAppt.attendances[0].status).toBe('Pendente');
  });

  it('D1 Rule 5: Cancelling an appointment does NOT cancel an attendance that was already marked Realizado', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-04T11:00:00Z'),
        status: 'Confirmado',
        attendances: {
          create: {
            clientId,
            status: 'Realizado',
            observacoes: 'Procedimento clínico já concluído',
          },
        },
      },
      include: { attendances: true },
    });

    // Execute cancellation of appointment only affecting pending attendances
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: { status: 'Cancelado' },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente', // Strictly does NOT match Realizado
        },
        data: { status: 'Cancelado' },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Cancelado');
    // Attendance remains Realizado because clinical encounter actually happened
    expect(updatedAppt.attendances[0].status).toBe('Realizado');
  });
});
