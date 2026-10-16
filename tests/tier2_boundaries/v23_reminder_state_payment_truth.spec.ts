import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { AttendanceService } from '@/services/attendance.service';
import { ValidationError } from '@/lib/errors';

describe('Tier 2 Boundary V23: Reminder State Decoupled from Payment Truth (Dev Spec §23, D5, V23, AC 68)', () => {
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

  it('V23.1 (AC 68): Marking reminder as concluido does NOT change installment status or payment status', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 600.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 600.0 });

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 600.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const inst1 = schedule.payment.pixInstallments![0];
    const reminder = (await ReminderService.listReminders({ pixInstallmentId: inst1.id }))[0];

    // Mark reminder as 'concluido'
    const updatedReminder = await ReminderService.updateReminderStatus(reminder.id, 'concluido');
    expect(updatedReminder.status).toBe('concluido');
    expect(updatedReminder.completedAt).not.toBeNull();

    // Verify installment and payment remain strictly 'Pendente'
    const instAfter = await prismaTest.pixInstallment.findUnique({ where: { id: inst1.id } });
    expect(instAfter!.status).toBe('Pendente');
    expect(instAfter!.dataPagamento).toBeNull();

    const paymentAfter = await PaymentService.getPaymentById(schedule.payment.id);
    expect(paymentAfter.status).toBe('Pendente');

    // Verify outstanding balance is still 600.0
    const financials = await AttendanceService.getAttendanceById(attendanceId);
    expect(financials.financials.paidTotal).toBe(0.0);
    expect(financials.financials.outstandingBalance).toBe(600.0);
  });

  it('V23.2: Dismissing reminder (dispensado) leaves installment, payment, and balance unchanged', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 400.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 400.0 });

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 400.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const inst = schedule.payment.pixInstallments![0];
    const reminder = (await ReminderService.listReminders({ pixInstallmentId: inst.id }))[0];

    await ReminderService.updateReminderStatus(reminder.id, 'dispensado');

    const instAfter = await prismaTest.pixInstallment.findUnique({ where: { id: inst.id } });
    expect(instAfter!.status).toBe('Pendente');

    const attAfter = await AttendanceService.getAttendanceById(attendanceId);
    expect(attAfter.financials.paidTotal).toBe(0.0);
    expect(attAfter.financials.outstandingBalance).toBe(400.0);
  });

  it('V23.3: Reverting reminder to pendente clears completedAt without ledger side-effects', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 300.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 300.0 });

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 300.0,
      numeroParcelas: 1,
      primeiroVencimento: new Date(),
    });

    const reminder = (await ReminderService.listReminders({ clientId: client.id }))[0];
    await ReminderService.updateReminderStatus(reminder.id, 'concluido');

    const reverted = await ReminderService.updateReminderStatus(reminder.id, 'pendente');
    expect(reverted.status).toBe('pendente');
    expect(reverted.completedAt).toBeNull();
  });

  it('V23.4: Attendance computeFinancials yields identical results regardless of reminder states', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 1000.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 900.0 });
    await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 800.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const finInitial = (await AttendanceService.getAttendanceById(attendanceId)).financials;

    const reminders = await ReminderService.listReminders({ clientId: client.id });
    await ReminderService.updateReminderStatus(reminders[0].id, 'concluido');
    await ReminderService.updateReminderStatus(reminders[1].id, 'dispensado');

    const finAfter = (await AttendanceService.getAttendanceById(attendanceId)).financials;

    expect(finAfter.netTotal).toBe(finInitial.netTotal);
    expect(finAfter.paidTotal).toBe(finInitial.paidTotal);
    expect(finAfter.outstandingBalance).toBe(finInitial.outstandingBalance);
    expect(finAfter.isFullyPaid).toBe(finInitial.isFullyPaid);
  });

  it('V23.5: Reject invalid reminder status transition with ValidationError', async () => {
    const client = await createTestClient();
    const reminder = await ReminderService.createReminder({
      clientId: client.id,
      titulo: 'Lembrete teste',
      dataVencimento: new Date(),
    });

    await expect(
      ReminderService.updateReminderStatus(reminder.id, 'status_invalido' as any)
    ).rejects.toThrow(ValidationError);
  });
});
