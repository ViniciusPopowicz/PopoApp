import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestAppointment,
  createTestProcedure,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
} from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { AttendanceService } from '@/services/attendance.service';
import { DashboardService } from '@/services/dashboard.service';
import { recordPaymentSchema } from '@/schemas/payment';

describe('Tier 5 Adversarial Challenge: Milestone 4 Gate (challenger_m4_g5_2)', () => {
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

  // =========================================================================
  // 1. INVARIANT V23 & AC 68: ADVERSARIAL REMINDER STATUS TRANSITIONS & DECOUPLING
  // =========================================================================
  describe('1. Invariant V23 & AC 68: Rapid Reminder Status Transitions & Ledger Decoupling', () => {
    it('Oracle 1.1: Rapid jitter cycle (pendente -> concluido -> dispensado -> concluido -> dispensado -> pendente) NEVER mutates payment truth or outstanding balance', async () => {
      const client = await createTestClient({ nome: 'Jitter Decoupling Client' });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      // Add procedures worth R$ 1,500, discount R$ 300 -> netTotal = R$ 1,200
      const proc = await createTestProcedure({ valorPadrao: 1500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 1500.0 });
      await AttendanceService.setDiscount(attendanceId, { desconto: 300.0 });

      // Create PIX installment schedule: 3 installments of R$ 400
      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 1200.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
        intervaloDias: 30,
      });

      const paymentId = schedule.payment.id;
      const inst1 = schedule.payment.pixInstallments![0];
      const reminders = await ReminderService.listReminders({ pixInstallmentId: inst1.id });
      expect(reminders).toHaveLength(1);
      const reminderId = reminders[0].id;

      // Rapid sequence of 5 status transitions
      const sequence = ['concluido', 'dispensado', 'concluido', 'dispensado', 'pendente'] as const;

      for (const targetStatus of sequence) {
        const updated = await ReminderService.updateReminderStatus(reminderId, targetStatus);
        expect(updated.status).toBe(targetStatus);

        if (targetStatus === 'pendente') {
          expect(updated.completedAt).toBeNull();
        } else {
          expect(updated.completedAt).not.toBeNull();
        }

        // Invariant Assertions: Ledger state must remain absolutely invariant
        const dbPayment = await PaymentService.getPaymentById(paymentId);
        expect(dbPayment.status).toBe('Pendente');

        const dbInstallment = await prismaTest.pixInstallment.findUnique({ where: { id: inst1.id } });
        expect(dbInstallment!.status).toBe('Pendente');
        expect(dbInstallment!.dataPagamento).toBeNull();

        const attendanceRecord = await AttendanceService.getAttendanceById(attendanceId);
        const financials = attendanceRecord.financials;
        expect(financials.practicedTotal).toBe(1500.0);
        expect(financials.explicitDiscount).toBe(300.0);
        expect(financials.netTotal).toBe(1200.0);
        expect(financials.paidTotal).toBe(0.0);
        expect(financials.outstandingBalance).toBe(1200.0);
        expect(financials.isFullyPaid).toBe(false);
      }
    });

    it('Oracle 1.2: Multi-reminder status mutations across installments preserve strict financial decoupling', async () => {
      const client = await createTestClient({ nome: 'Concurrent Reminders Client' });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 900.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 900.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 900.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      const reminders = await ReminderService.listReminders({ clientId: client.id });
      expect(reminders).toHaveLength(3);

      // Mutate all 3 reminders to different administrative states
      await ReminderService.updateReminderStatus(reminders[0].id, 'concluido');
      await ReminderService.updateReminderStatus(reminders[1].id, 'dispensado');
      await ReminderService.updateReminderStatus(reminders[2].id, 'concluido');

      // Assert all installments are still Pendente and paidTotal is still 0
      const allInstallments = await prismaTest.pixInstallment.findMany({
        where: { paymentId: schedule.payment.id },
      });
      expect(allInstallments).toHaveLength(3);
      for (const inst of allInstallments) {
        expect(inst.status).toBe('Pendente');
        expect(inst.dataPagamento).toBeNull();
      }

      const parentPayment = await PaymentService.getPaymentById(schedule.payment.id);
      expect(parentPayment.status).toBe('Pendente');

      const financials = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(financials.paidTotal).toBe(0.0);
      expect(financials.outstandingBalance).toBe(900.0);
      expect(financials.isFullyPaid).toBe(false);
    });

    it('Oracle 1.3: Real payment truth is immune to subsequent reminder mutations or rollbacks', async () => {
      const client = await createTestClient({ nome: 'Real Payment Immune Client' });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 1000.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 1000.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date(),
      });

      const inst1 = schedule.payment.pixInstallments![0];
      const inst2 = schedule.payment.pixInstallments![1];

      // Pay installment 1 legitimately
      const payResult = await PaymentService.payPixInstallment(inst1.id, {
        dataPagamento: new Date('2026-11-01T12:00:00Z'),
      });

      expect(payResult.installment.status).toBe('Pago');
      expect(payResult.financials.paidTotal).toBe(500.0);
      expect(payResult.financials.outstandingBalance).toBe(500.0);

      // Now adversarially revert the linked reminder for installment 1 to 'pendente'
      const reminder1 = (await ReminderService.listReminders({ pixInstallmentId: inst1.id }))[0];
      await ReminderService.updateReminderStatus(reminder1.id, 'pendente');

      // Assert installment 1 is STILL 'Pago' and paidTotal is STILL 500
      const inst1Reloaded = await prismaTest.pixInstallment.findUnique({ where: { id: inst1.id } });
      expect(inst1Reloaded!.status).toBe('Pago');
      expect(inst1Reloaded!.dataPagamento).not.toBeNull();

      // Now adversarially mark reminder 2 as 'concluido'
      const reminder2 = (await ReminderService.listReminders({ pixInstallmentId: inst2.id }))[0];
      await ReminderService.updateReminderStatus(reminder2.id, 'concluido');

      // Assert installment 2 is STILL 'Pendente' and paidTotal is STILL 500 (NOT 1000)
      const inst2Reloaded = await prismaTest.pixInstallment.findUnique({ where: { id: inst2.id } });
      expect(inst2Reloaded!.status).toBe('Pendente');

      const finalFinancials = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(finalFinancials.paidTotal).toBe(500.0);
      expect(finalFinancials.outstandingBalance).toBe(500.0);
      expect(finalFinancials.isFullyPaid).toBe(false);
    });

    it('Oracle 1.4: Deleting reminder does NOT delete or mutate PixInstallment or payment', async () => {
      const client = await createTestClient({ nome: 'Reminder Deletion Client' });
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

      // Delete the reminder
      await ReminderService.deleteReminder(reminder.id);

      // Installment and Payment still exist untouched
      const instAfter = await prismaTest.pixInstallment.findUnique({ where: { id: inst1.id } });
      expect(instAfter).not.toBeNull();
      expect(instAfter!.status).toBe('Pendente');
      expect(Number(instAfter!.valor)).toBe(300.0);

      const paymentAfter = await PaymentService.getPaymentById(schedule.payment.id);
      expect(paymentAfter).not.toBeNull();
      expect(paymentAfter.status).toBe('Pendente');
    });
  });

  // =========================================================================
  // 2. INVARIANT V21: CREDIT CARD EXTREME INSTALLMENT COUNTS REJECTION
  // =========================================================================
  describe('2. Invariant V21: Extreme Installment Counts Rejection on Credit Card Payments', () => {
    it('V21-ADV-1: Zod schema rejects non-positive installment counts (0, -1, -5)', () => {
      const resZero = recordPaymentSchema.safeParse({
        valor: 500.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 0,
      });
      expect(resZero.success).toBe(false);

      const resNegative = recordPaymentSchema.safeParse({
        valor: 500.0,
        metodo: 'CartaoCredito',
        numeroParcelas: -1,
      });
      expect(resNegative.success).toBe(false);

      const resExtremeNegative = recordPaymentSchema.safeParse({
        valor: 500.0,
        metodo: 'CartaoCredito',
        numeroParcelas: -5,
      });
      expect(resExtremeNegative.success).toBe(false);
    });

    it('V21-ADV-2: Zod schema rejects non-integer installment counts (e.g. 2.5)', () => {
      const resFloat = recordPaymentSchema.safeParse({
        valor: 500.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 2.5,
      });
      expect(resFloat.success).toBe(false);
    });

    it('V21-ADV-3: Zod schema accepts valid boundary installment counts (1 and 12)', () => {
      const resMin = recordPaymentSchema.safeParse({
        valor: 100.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 1,
      });
      expect(resMin.success).toBe(true);
      if (resMin.success) {
        expect(resMin.data.numeroParcelas).toBe(1);
      }

      const resMax = recordPaymentSchema.safeParse({
        valor: 1200.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 12,
      });
      expect(resMax.success).toBe(true);
      if (resMax.success) {
        expect(resMax.data.numeroParcelas).toBe(12);
      }
    });

    it('V21-ADV-4: Rejection analysis for extreme count > 24 and verification of valid boundary 12', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 2000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 2000.0 });

      // Schema rejects extreme count > 24
      const schemaCheck25 = recordPaymentSchema.safeParse({
        valor: 1000.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 25,
      });
      expect(schemaCheck25.success).toBe(false);

      // Boundary count 12 succeeds in service layer
      const payment12 = await PaymentService.recordPayment(attendanceId, {
        valor: 1000.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 12,
      });
      expect(payment12.payment.numeroParcelas).toBe(12);
      expect(payment12.payment.status).toBe('Pago');

      // Zero PixInstallment and zero reminders generated
      const pixRows = await prismaTest.pixInstallment.findMany({ where: { paymentId: payment12.payment.id } });
      expect(pixRows).toHaveLength(0);
      const reminderRows = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
      expect(reminderRows).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. ADVERSARIAL DASHBOARD AGGREGATIONS: EMPTY STATES, DATE RANGES & MIXED STATUS
  // =========================================================================
  describe('3. Adversarial Dashboard Aggregations: Empty States, Date Ranges & Mixed Status Records', () => {
    it('Oracle 3.1: Empty data state does NOT throw, does NOT return NaN, and produces well-formed zeroes', async () => {
      const summary = await DashboardService.getDashboardSummary({ period: 'month' });

      // Period structure
      expect(summary.period.name).toBe('month');
      expect(summary.period.startDate).toBeDefined();
      expect(summary.period.endDate).toBeDefined();

      // Financials in empty DB
      expect(summary.financial.currentPeriod.grossRevenue).toBe(0);
      expect(summary.financial.currentPeriod.totalDiscounts).toBe(0);
      expect(summary.financial.currentPeriod.netRevenue).toBe(0);
      expect(summary.financial.currentPeriod.receivedRevenue).toBe(0);
      expect(summary.financial.currentPeriod.outstandingRevenue).toBe(0);
      expect(Number.isNaN(summary.financial.currentPeriod.grossRevenue)).toBe(false);

      // Cash flow breakdown is empty array
      expect(summary.financial.cashFlowByMethod).toEqual([]);

      // Accounts receivable
      expect(summary.financial.accountsReceivable.totalOutstanding).toBe(0);
      expect(summary.financial.accountsReceivable.attendancesCount).toBe(0);
      expect(summary.financial.accountsReceivable.clientsCount).toBe(0);
      expect(summary.financial.accountsReceivable.topDebtors).toEqual([]);

      // Operations
      expect(summary.operations.appointments.todayTotal).toBe(0);
      expect(summary.operations.appointments.upcomingList).toEqual([]);
      expect(summary.operations.attendances.todayTotal).toBe(0);
      expect(summary.operations.attendances.completionRate).toBe(0);
      expect(Number.isNaN(summary.operations.attendances.completionRate)).toBe(false);

      // Alerts
      expect(summary.alerts.lowStock).toEqual([]);
      expect(summary.alerts.reminders.items).toEqual([]);
      expect(summary.alerts.reminders.summary.totalPending).toBe(0);
      expect(summary.alerts.birthdays).toEqual([]);
    });

    it('Oracle 3.2: Date range precision strictly includes exact boundaries and excludes out-of-range receipts', async () => {
      const client = await createTestClient();

      const start = new Date('2026-06-01T00:00:00.000Z');
      const end = new Date('2026-06-30T23:59:59.999Z');

      const appt = await createTestAppointment(client.id, {
        dataHora: new Date('2026-06-15T12:00:00Z'),
      });
      const attendanceId = appt.attendances[0].id;
      const proc = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 1000.0 });
      await AttendanceService.completeAttendance(attendanceId);

      // 1. Payment exactly at start timestamp (included)
      await prismaTest.payment.create({
        data: {
          attendanceId,
          valor: 100.0,
          metodo: 'Dinheiro',
          status: 'Pago',
          dataPagamento: start,
        },
      });

      // 2. Payment exactly at end timestamp (included)
      await prismaTest.payment.create({
        data: {
          attendanceId,
          valor: 200.0,
          metodo: 'Dinheiro',
          status: 'Pago',
          dataPagamento: end,
        },
      });

      // 3. Payment 1 ms before start (excluded)
      const beforeStart = new Date(start.getTime() - 1000);
      await prismaTest.payment.create({
        data: {
          attendanceId,
          valor: 50.0,
          metodo: 'Dinheiro',
          status: 'Pago',
          dataPagamento: beforeStart,
        },
      });

      // 4. Payment 1 ms after end (excluded)
      const afterEnd = new Date(end.getTime() + 1000);
      await prismaTest.payment.create({
        data: {
          attendanceId,
          valor: 75.0,
          metodo: 'Dinheiro',
          status: 'Pago',
          dataPagamento: afterEnd,
        },
      });

      const metrics = await DashboardService.getFinancialMetrics(start, end);
      // Only 100 + 200 = 300 should be received
      expect(metrics.receivedRevenue).toBe(300.0);

      const cashFlow = await DashboardService.getCashFlowByMethod(start, end);
      expect(cashFlow).toHaveLength(1);
      expect(cashFlow[0].total).toBe(300.0);
    });

    it('Oracle 3.3: Mixed status records in Financial Metrics & Cash Flow filter strictly by operational state', async () => {
      const client = await createTestClient();

      const start = new Date('2026-07-01T00:00:00.000Z');
      const end = new Date('2026-07-31T23:59:59.999Z');
      const d1 = new Date('2026-07-10T10:00:00.000Z');

      // Attendance 1: Realizado with R$ 800 practiced, R$ 100 discount (net R$ 700)
      const appt1 = await createTestAppointment(client.id, { dataHora: d1 });
      const att1 = appt1.attendances[0].id;
      await prismaTest.attendance.update({ where: { id: att1 }, data: { dataHora: d1 } });

      const proc1 = await createTestProcedure({ valorPadrao: 800.0 });
      await AttendanceService.addProcedure(att1, { procedureId: proc1.id, practicedValue: 800.0 });
      await AttendanceService.setDiscount(att1, { desconto: 100.0 });
      await AttendanceService.completeAttendance(att1);

      // Realizado payment: R$ 400
      await PaymentService.recordPayment(att1, { valor: 400.0, metodo: 'Dinheiro', dataPagamento: d1 });

      // Attendance 2: Pendente with R$ 500 practiced (must NOT contribute to gross/net revenue yet)
      const d2 = new Date('2026-07-15T14:00:00.000Z');
      const appt2 = await createTestAppointment(client.id, { dataHora: d2 });
      const att2 = appt2.attendances[0].id;
      await prismaTest.attendance.update({ where: { id: att2 }, data: { dataHora: d2 } });

      const proc2 = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(att2, { procedureId: proc2.id, practicedValue: 500.0 });

      // Attendance 3: Cancelado with R$ 1000 practiced (must NOT contribute to revenue)
      const d3 = new Date('2026-07-20T16:00:00.000Z');
      const appt3 = await createTestAppointment(client.id, { dataHora: d3 });
      const att3 = appt3.attendances[0].id;
      await prismaTest.attendance.update({ where: { id: att3 }, data: { dataHora: d3 } });

      const proc3 = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(att3, { procedureId: proc3.id, practicedValue: 1000.0 });
      await AttendanceService.cancelAttendance(att3);

      const metrics = await DashboardService.getFinancialMetrics(start, end);

      // Only att1 (Realizado) counts for gross/net revenue:
      expect(metrics.grossRevenue).toBe(800.0);
      expect(metrics.totalDiscounts).toBe(100.0);
      expect(metrics.netRevenue).toBe(700.0);
      expect(metrics.receivedRevenue).toBe(400.0);
      expect(metrics.outstandingRevenue).toBe(300.0); // 700 net - 400 paid
    });

    it('Oracle 3.4: Accounts receivable summary strictly ignores Cancelado attendances and fully paid records', async () => {
      const client1 = await createTestClient({ nome: 'Cliente Com Divida' });
      const client2 = await createTestClient({ nome: 'Cliente Cancelado' });
      const client3 = await createTestClient({ nome: 'Cliente Quitado' });

      // 1. Debt attendance (net R$ 600, paid R$ 200 -> outstanding R$ 400)
      const appt1 = await createTestAppointment(client1.id);
      const att1 = appt1.attendances[0].id;
      const proc1 = await createTestProcedure({ valorPadrao: 600.0 });
      await AttendanceService.addProcedure(att1, { procedureId: proc1.id, practicedValue: 600.0 });
      await PaymentService.recordPayment(att1, { valor: 200.0, metodo: 'Dinheiro' });

      // 2. Cancelled attendance with procedures (should NOT be in accounts receivable)
      const appt2 = await createTestAppointment(client2.id);
      const att2 = appt2.attendances[0].id;
      const proc2 = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(att2, { procedureId: proc2.id, practicedValue: 1000.0 });
      await AttendanceService.cancelAttendance(att2, 'Cancelamento');

      // 3. Fully paid attendance (should NOT be in accounts receivable)
      const appt3 = await createTestAppointment(client3.id);
      const att3 = appt3.attendances[0].id;
      const proc3 = await createTestProcedure({ valorPadrao: 300.0 });
      await AttendanceService.addProcedure(att3, { procedureId: proc3.id, practicedValue: 300.0 });
      await PaymentService.recordPayment(att3, { valor: 300.0, metodo: 'Pix' });

      const ar = await DashboardService.getAccountsReceivableSummary();

      expect(ar.totalOutstanding).toBe(400.0);
      expect(ar.attendancesCount).toBe(1);
      expect(ar.clientsCount).toBe(1);
      expect(ar.topDebtors).toHaveLength(1);
      expect(ar.topDebtors[0].clientName).toBe('Cliente Com Divida');
      expect(ar.topDebtors[0].outstandingBalance).toBe(400.0);
    });

    it('Oracle 3.5: Low stock alerts discount expired lots and exclude inactive products', async () => {
      const now = new Date('2026-10-20T12:00:00Z');

      // Product 1: Has 6 units, but 4 are in an EXPIRED lot -> available = 2 -> BAIXO
      const prodExpired = await createTestProduct({ nome: 'Toxina Botulínica 100U' });
      const lotValid = await createTestLot(prodExpired.id, {
        dataValidade: new Date('2027-01-01T00:00:00Z'),
      });
      await createTestStockUnit(lotValid.id);
      await createTestStockUnit(lotValid.id);

      const lotExpired = await createTestLot(prodExpired.id, {
        dataValidade: new Date('2026-05-01T00:00:00Z'), // Expired
      });
      for (let i = 0; i < 4; i++) {
        await createTestStockUnit(lotExpired.id);
      }

      // Product 2: Inactive product with 0 units -> strictly excluded from alerts
      const prodInactive = await createTestProduct({
        nome: 'Produto Descontinuado',
        isActive: false,
      });
      await createTestLot(prodInactive.id);

      // Product 3: Active product with 10 valid units -> normal (excluded from alerts)
      const prodNormal = await createTestProduct({ nome: 'Gaze Estéril' });
      const lotNormal = await createTestLot(prodNormal.id, {
        dataValidade: new Date('2028-01-01T00:00:00Z'),
      });
      for (let i = 0; i < 10; i++) {
        await createTestStockUnit(lotNormal.id);
      }

      const alerts = await DashboardService.getLowStockAlerts(now);

      const alertExpiredProd = alerts.find((a) => a.productId === prodExpired.id);
      expect(alertExpiredProd).toBeDefined();
      expect(alertExpiredProd!.availableUnits).toBe(2);
      expect(alertExpiredProd!.alertLevel).toBe('BAIXO');

      const alertInactive = alerts.find((a) => a.productId === prodInactive.id);
      expect(alertInactive).toBeUndefined();

      const alertNormal = alerts.find((a) => a.productId === prodNormal.id);
      expect(alertNormal).toBeUndefined();
    });
  });
});
