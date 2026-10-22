import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestProcedure,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
} from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { StockService } from '@/services/stock.service';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { DashboardService } from '@/services/dashboard.service';

describe('Tier 3 Combination: Milestone 4 Financial & Reminders End-to-End Workflow (AC 58, AC 65, AC 68)', () => {
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

  it('Executes complete clinical-financial journey from appointment to payment, PIX installments, reminders, and dashboard analytics', async () => {
    // 1. Create Client with valid CPF
    const client = await createTestClient({ nome: 'Juliana Paes' });

    // 2. Create Appointment with auto-created pending Attendance (D1)
    const appt = await AppointmentService.createAppointment({
      clientId: client.id,
      dataHora: new Date(),
      duracaoMinutos: 60,
    });
    expect(appt.attendances).toHaveLength(1);
    const attendanceId = appt.attendances[0].id;

    // 3. Add 2 procedures with practiced values R$ 600 + R$ 400 = R$ 1,000
    const proc1 = await createTestProcedure({ nome: 'Harmonização Facial', valorPadrao: 700.0 });
    const proc2 = await createTestProcedure({ nome: 'Preenchimento Labial', valorPadrao: 500.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc1.id, practicedValue: 600.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc2.id, practicedValue: 400.0 });

    // 4. Apply explicit discount R$ 100 -> Net total = R$ 900 (D2)
    await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

    const fin1 = (await AttendanceService.getAttendanceById(attendanceId)).financials;
    expect(fin1.standardTotal).toBe(1200.0);
    expect(fin1.practicedTotal).toBe(1000.0);
    expect(fin1.explicitDiscount).toBe(100.0);
    expect(fin1.netTotal).toBe(900.0);
    expect(fin1.paidTotal).toBe(0.0);
    expect(fin1.outstandingBalance).toBe(900.0);

    // 5. Product stock usage: consume 1 reusable unit for Client (V16)
    const prod = await createTestProduct({ nome: 'Cânula 22G', isReusable: true });
    const lot = await createTestLot(prod.id);
    const unit = await createTestStockUnit(lot.id);
    await StockService.recordProductUsage(attendanceId, {
      stockUnitId: unit.id,
    });

    // 6. Partial Credit Card payment R$ 300 (3 installments, 0 reminders) (V21)
    const cardPay = await PaymentService.recordPayment(attendanceId, {
      valor: 300.0,
      metodo: 'CartaoCredito',
      numeroParcelas: 3,
    });
    expect(cardPay.payment.numeroParcelas).toBe(3);
    expect(cardPay.financials.paidTotal).toBe(300.0);
    expect(cardPay.financials.outstandingBalance).toBe(600.0);

    const cardReminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
    expect(cardReminders).toHaveLength(0); // Strictly zero reminders for card payment (V21, AC 68)

    // 7. PIX installment plan for remaining R$ 600 (3 installments of R$ 200 with due dates) (V22)
    const firstDue = new Date();
    firstDue.setDate(firstDue.getDate() + 15);
    const pixSchedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 600.0,
      numeroParcelas: 3,
      primeiroVencimento: firstDue,
      intervaloDias: 30,
    });
    expect(pixSchedule.payment.pixInstallments).toHaveLength(3);

    // 8. In-app reminders generated for PIX installments (V22)
    const pixReminders = await ReminderService.listReminders({ clientId: client.id });
    expect(pixReminders).toHaveLength(3);

    // 9. Mark Attendance as Realizado and conclude Appointment
    await AttendanceService.completeAttendance(attendanceId);
    await AppointmentService.completeAppointment(appt.id);
    const apptCompleted = await prismaTest.appointment.findUnique({ where: { id: appt.id } });
    expect(apptCompleted!.status).toBe('Concluído');

    // 10. Verify Dashboard Metrics
    const metrics = await DashboardService.getFinancialMetrics(
      new Date('2020-01-01'),
      new Date('2030-12-31')
    );
    expect(metrics.grossRevenue).toBe(1000.0);
    expect(metrics.totalDiscounts).toBe(100.0);
    expect(metrics.netRevenue).toBe(900.0);
    expect(metrics.receivedRevenue).toBe(300.0);
    expect(metrics.outstandingRevenue).toBe(600.0);

    // 11. Decoupling Check: Resolve reminder 1 -> balance remains R$ 600 (V23, AC 68)
    await ReminderService.updateReminderStatus(pixReminders[0].id, 'concluido');
    const finAfterReminder = (await AttendanceService.getAttendanceById(attendanceId)).financials;
    expect(finAfterReminder.outstandingBalance).toBe(600.0);
    expect(finAfterReminder.paidTotal).toBe(300.0);

    // 12. Mark PIX installment 1 as paid -> balance drops to R$ 400, received increases to R$ 500
    const inst1 = pixSchedule.payment.pixInstallments![0];
    const payInstRes = await PaymentService.payPixInstallment(inst1.id);
    expect(payInstRes.installment.status).toBe('Pago');
    expect(payInstRes.financials.paidTotal).toBe(500.0);
    expect(payInstRes.financials.outstandingBalance).toBe(400.0);

    const metricsAfterInst = await DashboardService.getFinancialMetrics(
      new Date('2020-01-01'),
      new Date('2030-12-31')
    );
    expect(metricsAfterInst.receivedRevenue).toBe(500.0);
    expect(metricsAfterInst.outstandingRevenue).toBe(400.0);
  });
});
