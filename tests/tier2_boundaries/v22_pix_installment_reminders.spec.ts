import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { AttendanceService } from '@/services/attendance.service';

describe('Tier 2 Boundary V22: PIX Installment Schedule & In-App Reminders (Dev Spec §23, D5, V22, AC 68)', () => {
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

  it('V22.1: 1-installment PIX schedule creates 1 installment and 1 in-app reminder with matching due date', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 200.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 200.0 });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const res = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 200.0,
      numeroParcelas: 1,
      primeiroVencimento: dueDate,
    });

    expect(res.payment.pixInstallments).toHaveLength(1);

    const reminders = await prismaTest.reminder.findMany({
      where: { pixInstallmentId: res.payment.pixInstallments![0].id },
    });

    expect(reminders).toHaveLength(1);
    expect(new Date(reminders[0].dataVencimento).toDateString()).toBe(dueDate.toDateString());
    expect(reminders[0].tipo).toBe('parcela_pix');
    expect(reminders[0].status).toBe('pendente');
  });

  it('V22.2: 3-installment PIX schedule creates 3 installments and 3 in-app reminders with sequential titles', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 600.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 600.0 });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 10);

    const res = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 600.0,
      numeroParcelas: 3,
      primeiroVencimento: startDate,
      intervaloDias: 30,
    });

    expect(res.payment.pixInstallments).toHaveLength(3);

    const reminders = await ReminderService.listReminders({ clientId: client.id });
    expect(reminders).toHaveLength(3);

    expect(reminders[0].titulo).toContain('Parcela 1/3');
    expect(reminders[1].titulo).toContain('Parcela 2/3');
    expect(reminders[2].titulo).toContain('Parcela 3/3');
  });

  it('V22.3: 5-installment PIX schedule creates 5 installments with precise due dates and reminder linkages', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 1000.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 1000.0 });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 15);

    const res = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 1000.0,
      numeroParcelas: 5,
      primeiroVencimento: startDate,
      intervaloDias: 30,
    });

    expect(res.payment.pixInstallments).toHaveLength(5);

    const reminders = await prismaTest.reminder.findMany({
      where: { clientId: client.id },
      orderBy: { dataVencimento: 'asc' },
    });

    expect(reminders).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(reminders[i].pixInstallmentId).toBe(res.payment.pixInstallments![i].id);
    }
  });

  it('V22.4: Cascade deletion of Payment cleanly deletes child PixInstallment and Reminder records', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 400.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 400.0 });

    const res = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 400.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    // Delete payment
    await PaymentService.deletePayment(res.payment.id);

    const remainingInstallments = await prismaTest.pixInstallment.findMany({
      where: { paymentId: res.payment.id },
    });
    expect(remainingInstallments).toHaveLength(0);

    const remainingReminders = await prismaTest.reminder.findMany({
      where: { clientId: client.id },
    });
    expect(remainingReminders).toHaveLength(0);
  });

  it('V22.5: Multi-client isolation guarantees reminders for Client A and Client B do not collide', async () => {
    const clientA = await createTestClient({ nome: 'Cliente A' });
    const clientB = await createTestClient({ nome: 'Cliente B' });

    const apptA = await createTestAppointment(clientA.id);
    const apptB = await createTestAppointment(clientB.id);

    const proc = await createTestProcedure({ valorPadrao: 300.0 });
    await AttendanceService.addProcedure(apptA.attendances[0].id, { procedureId: proc.id, practicedValue: 300.0 });
    await AttendanceService.addProcedure(apptB.attendances[0].id, { procedureId: proc.id, practicedValue: 300.0 });

    await PaymentService.createPixInstallmentSchedule(apptA.attendances[0].id, {
      valorTotal: 300.0,
      numeroParcelas: 3,
      primeiroVencimento: new Date(),
    });

    await PaymentService.createPixInstallmentSchedule(apptB.attendances[0].id, {
      valorTotal: 300.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const remindersA = await ReminderService.listReminders({ clientId: clientA.id });
    const remindersB = await ReminderService.listReminders({ clientId: clientB.id });

    expect(remindersA).toHaveLength(3);
    expect(remindersB).toHaveLength(2);
    expect(remindersA.every((r) => r.clientId === clientA.id)).toBe(true);
    expect(remindersB.every((r) => r.clientId === clientB.id)).toBe(true);
  });
});
