import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { AttendanceService } from '@/services/attendance.service';

describe('Tier 2 Boundary V21: Credit Card Installment Count & Zero Reminders Invariant (Dev Spec §22, D5, V21, AC 68)', () => {
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

  it('V21.1: 1-installment credit card payment stores count 1 and creates zero reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 200.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 200.0 });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 200.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 1,
    });

    expect(res.payment.numeroParcelas).toBe(1);

    const installments = await prismaTest.pixInstallment.findMany({ where: { paymentId: res.payment.id } });
    expect(installments).toHaveLength(0);

    const reminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
    expect(reminders).toHaveLength(0);
  });

  it('V21.2: 6-installment credit card payment stores count 6 and creates zero reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 600.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 600.0 });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 600.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 6,
    });

    expect(res.payment.numeroParcelas).toBe(6);

    const installments = await prismaTest.pixInstallment.findMany({ where: { paymentId: res.payment.id } });
    expect(installments).toHaveLength(0);

    const reminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
    expect(reminders).toHaveLength(0);
  });

  it('V21.3: Boundary 12-installment credit card payment stores count 12 and creates zero reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 2400.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 2400.0 });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 2400.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 12,
    });

    expect(res.payment.numeroParcelas).toBe(12);
    expect(res.payment.status).toBe('Pago');

    const installments = await prismaTest.pixInstallment.findMany({ where: { paymentId: res.payment.id } });
    expect(installments).toHaveLength(0);

    const reminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
    expect(reminders).toHaveLength(0);
  });

  it('V21.4: Reminder synchronization completely ignores credit card payments', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 500.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

    await PaymentService.recordPayment(attendanceId, {
      valor: 500.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 4,
    });

    // Run sync
    const syncRes = await ReminderService.syncPixInstallmentReminders();
    expect(syncRes.generatedCount).toBe(0);

    const reminders = await ReminderService.listReminders({ clientId: client.id });
    expect(reminders).toHaveLength(0);
  });

  it('V21.5: Cash or debit payment with numeroParcelas set in input normalizes to 1 with zero reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 300.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 300.0 });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 300.0,
      metodo: 'Dinheiro',
      numeroParcelas: 5, // Non-card method
    });

    expect(res.payment.numeroParcelas).toBe(1);

    const reminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
    expect(reminders).toHaveLength(0);
  });
});
