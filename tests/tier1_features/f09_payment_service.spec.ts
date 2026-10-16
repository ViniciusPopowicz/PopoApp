import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F09: Payment Domain Service & Installments Engine (Phase 12, D2, V20, V21, V22)', () => {
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

  it('F09.1: Record single payment in full clears outstanding balance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 350.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 350.0,
    });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 350.0,
      metodo: 'Dinheiro',
    });

    expect(res.payment.id).toBeDefined();
    expect(res.payment.valor).toBe(350.0);
    expect(res.payment.metodo).toBe('Dinheiro');
    expect(res.payment.status).toBe('Pago');
    expect(res.financials.paidTotal).toBe(350.0);
    expect(res.financials.outstandingBalance).toBe(0.0);
    expect(res.financials.isFullyPaid).toBe(true);
  });

  it('F09.2 (V20): Multiple partial payments across methods dynamically update balance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 600.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 600.0,
    });

    // Payment 1: Cash R$ 200
    const res1 = await PaymentService.recordPayment(attendanceId, {
      valor: 200.0,
      metodo: 'Dinheiro',
    });
    expect(res1.financials.paidTotal).toBe(200.0);
    expect(res1.financials.outstandingBalance).toBe(400.0);
    expect(res1.financials.isFullyPaid).toBe(false);

    // Payment 2: Debit card R$ 400
    const res2 = await PaymentService.recordPayment(attendanceId, {
      valor: 400.0,
      metodo: 'CartaoDebito',
    });
    expect(res2.financials.paidTotal).toBe(600.0);
    expect(res2.financials.outstandingBalance).toBe(0.0);
    expect(res2.financials.isFullyPaid).toBe(true);

    const summary = await PaymentService.getPaymentsByAttendance(attendanceId);
    expect(summary.payments).toHaveLength(2);
  });

  it('F09.3 (V21): Credit card payment stores installment count and generates strictly ZERO reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 1200.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 1200.0,
    });

    const res = await PaymentService.recordPayment(attendanceId, {
      valor: 1200.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 6,
    });

    expect(res.payment.metodo).toBe('CartaoCredito');
    expect(res.payment.numeroParcelas).toBe(6);
    expect(res.payment.status).toBe('Pago');

    // Invariant check: strictly 0 PixInstallment rows and 0 Reminder rows
    const installments = await prismaTest.pixInstallment.findMany({
      where: { paymentId: res.payment.id },
    });
    expect(installments).toHaveLength(0);

    const reminders = await prismaTest.reminder.findMany({
      where: { clientId: client.id },
    });
    expect(reminders).toHaveLength(0);
  });

  it('F09.4 (V22): PIX installment schedule creates installments and matching reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 900.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 900.0,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 10);

    const res = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 900.0,
      numeroParcelas: 3,
      primeiroVencimento: dueDate,
      intervaloDias: 30,
    });

    expect(res.payment.status).toBe('Pendente');
    expect(res.payment.numeroParcelas).toBe(3);
    expect(res.payment.pixInstallments).toHaveLength(3);

    const installments = res.payment.pixInstallments!;
    expect(installments[0].numeroParcela).toBe(1);
    expect(installments[0].valor).toBe(300.0);
    expect(installments[0].status).toBe('Pendente');

    // Verify reminders generated in DB
    const reminders = await prismaTest.reminder.findMany({
      where: { clientId: client.id },
      orderBy: { dataVencimento: 'asc' },
    });
    expect(reminders).toHaveLength(3);
    expect(reminders[0].pixInstallmentId).toBe(installments[0].id);
    expect(reminders[0].status).toBe('pendente');
    expect(reminders[0].tipo).toBe('parcela_pix');
  });

  it('F09.5: Paying PIX installments dynamically recalculates paidTotal and resolves parent payment', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 400.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 400.0,
    });

    const resSchedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 400.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const inst1 = resSchedule.payment.pixInstallments![0];
    const inst2 = resSchedule.payment.pixInstallments![1];

    // Initially paid total is 0
    expect(resSchedule.financials.paidTotal).toBe(0.0);
    expect(resSchedule.financials.outstandingBalance).toBe(400.0);

    // Pay installment 1
    const resPay1 = await PaymentService.payPixInstallment(inst1.id);
    expect(resPay1.installment.status).toBe('Pago');
    expect(resPay1.financials.paidTotal).toBe(200.0);
    expect(resPay1.financials.outstandingBalance).toBe(200.0);

    const parentAfterPay1 = await PaymentService.getPaymentById(resSchedule.payment.id);
    expect(parentAfterPay1.status).toBe('Pendente');

    // Pay installment 2
    const resPay2 = await PaymentService.payPixInstallment(inst2.id);
    expect(resPay2.installment.status).toBe('Pago');
    expect(resPay2.financials.paidTotal).toBe(400.0);
    expect(resPay2.financials.outstandingBalance).toBe(0.0);
    expect(resPay2.financials.isFullyPaid).toBe(true);

    const parentAfterPay2 = await PaymentService.getPaymentById(resSchedule.payment.id);
    expect(parentAfterPay2.status).toBe('Pago');
  });

  it('F09.6: Overpayment is strictly rejected with ValidationError', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 200.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 200.0,
    });

    await expect(
      PaymentService.recordPayment(attendanceId, {
        valor: 250.0,
        metodo: 'Dinheiro',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('F09.7: Cent rounding distributes remainder to first installment without drift', async () => {
    const preview = PaymentService.previewPixSchedule({
      valorTotal: 1000.0,
      numeroParcelas: 3,
      primeiroVencimento: new Date(),
    });

    expect(preview.parcelas).toHaveLength(3);
    expect(preview.parcelas[0].valor).toBe(333.34);
    expect(preview.parcelas[1].valor).toBe(333.33);
    expect(preview.parcelas[2].valor).toBe(333.33);

    const sum = preview.parcelas.reduce((acc, p) => acc + p.valor, 0);
    expect(Number(sum.toFixed(2))).toBe(1000.0);
  });
});
