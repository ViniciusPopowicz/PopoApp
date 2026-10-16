import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestProcedure,
  createTestAppointment,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
} from '../helpers/test-fixtures';
import { DashboardService } from '@/services/dashboard.service';
import { AttendanceService } from '@/services/attendance.service';
import { PaymentService } from '@/services/payment.service';

describe('Tier 1 Feature F27: Dashboard Domain Service & Analytics Engine (Phase 14, D2, D5)', () => {
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

  it('F27.1: Calculates gross, discount, net, and received revenue accurately', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc1 = await createTestProcedure({ valorPadrao: 600.0 });
    const proc2 = await createTestProcedure({ valorPadrao: 400.0 });

    await AttendanceService.addProcedure(attendanceId, { procedureId: proc1.id, practicedValue: 550.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc2.id, practicedValue: 450.0 });
    await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

    // Mark attendance as Realizado
    await AttendanceService.completeAttendance(attendanceId);

    // Pay R$ 400 in cash
    await PaymentService.recordPayment(attendanceId, {
      valor: 400.0,
      metodo: 'Dinheiro',
    });

    const metrics = await DashboardService.getFinancialMetrics(
      new Date('2020-01-01'),
      new Date('2030-12-31')
    );

    // Gross = 550 + 450 = 1000
    expect(metrics.grossRevenue).toBe(1000.0);
    expect(metrics.totalDiscounts).toBe(100.0);
    // Net = 1000 - 100 = 900
    expect(metrics.netRevenue).toBe(900.0);
    // Received = 400
    expect(metrics.receivedRevenue).toBe(400.0);
    // Outstanding = 900 - 400 = 500
    expect(metrics.outstandingRevenue).toBe(500.0);
  });

  it('F27.2: Cash flow breakdown groups receipts by payment method with correct totals and percentages', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 1000.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 1000.0 });

    // R$ 300 Dinheiro + R$ 700 CartaoCredito
    await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'Dinheiro' });
    await PaymentService.recordPayment(attendanceId, { valor: 700.0, metodo: 'CartaoCredito', numeroParcelas: 2 });

    const breakdown = await DashboardService.getCashFlowByMethod(
      new Date('2020-01-01'),
      new Date('2030-12-31')
    );

    expect(breakdown).toHaveLength(2);

    const card = breakdown.find((b) => b.metodo === 'CartaoCredito');
    const cash = breakdown.find((b) => b.metodo === 'Dinheiro');

    expect(card).toBeDefined();
    expect(card!.total).toBe(700.0);
    expect(card!.percentage).toBe(70.0);

    expect(cash).toBeDefined();
    expect(cash!.total).toBe(300.0);
    expect(cash!.percentage).toBe(30.0);
  });

  it('F27.3: Accounts receivable computes total debt and debtor client details', async () => {
    const client = await createTestClient({ nome: 'Devedor Teste' });
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 800.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 800.0 });
    await AttendanceService.setDiscount(attendanceId, { desconto: 50.0 });
    // Net total = 750, paid = 250 -> outstanding = 500
    await PaymentService.recordPayment(attendanceId, { valor: 250.0, metodo: 'Pix' });

    const ar = await DashboardService.getAccountsReceivableSummary();
    expect(ar.totalOutstanding).toBe(500.0);
    expect(ar.clientsCount).toBe(1);
    expect(ar.attendancesCount).toBe(1);
    expect(ar.topDebtors[0].clientName).toBe('Devedor Teste');
    expect(ar.topDebtors[0].outstandingBalance).toBe(500.0);
  });

  it('F27.4: Low stock alerts identify products with <= 5 available units and assign alert levels', async () => {
    const now = new Date();

    // Product 1: 0 units -> CRITICO
    const prod0 = await createTestProduct({ nome: 'Ácido Hialurônico 1ml' });
    const lot0 = await createTestLot(prod0.id);

    // Product 2: 3 units -> BAIXO
    const prod3 = await createTestProduct({ nome: 'Agulha 30G' });
    const lot3 = await createTestLot(prod3.id);
    await createTestStockUnit(lot3.id);
    await createTestStockUnit(lot3.id);
    await createTestStockUnit(lot3.id);

    // Product 3: 8 units -> Normal (not in alerts)
    const prod8 = await createTestProduct({ nome: 'Luva de Procedimento P' });
    const lot8 = await createTestLot(prod8.id);
    for (let i = 0; i < 8; i++) {
      await createTestStockUnit(lot8.id);
    }

    const alerts = await DashboardService.getLowStockAlerts(now);

    const alert0 = alerts.find((a) => a.productId === prod0.id);
    const alert3 = alerts.find((a) => a.productId === prod3.id);
    const alert8 = alerts.find((a) => a.productId === prod8.id);

    expect(alert0).toBeDefined();
    expect(alert0!.availableUnits).toBe(0);
    expect(alert0!.alertLevel).toBe('CRITICO');

    expect(alert3).toBeDefined();
    expect(alert3!.availableUnits).toBe(3);
    expect(alert3!.alertLevel).toBe('BAIXO');

    expect(alert8).toBeUndefined();
  });

  it('F27.5: Reminders widget accurately feeds pending reminders with overdue status', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 500.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);

    await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 500.0,
      numeroParcelas: 2,
      primeiroVencimento: pastDate,
      intervaloDias: 30,
    });

    const todayRange = DashboardService.getDateRange('today');
    const widget = await DashboardService.getRemindersWidget(todayRange.startDate, todayRange.endDate);

    expect(widget.summary.totalPending).toBe(2);
    expect(widget.summary.overdueCount).toBeGreaterThanOrEqual(1);
    expect(widget.items).toHaveLength(2);
  });

  it('F27.6: Master dashboard summary returns complete executive response payload', async () => {
    const summary = await DashboardService.getDashboardSummary({ period: 'month' });

    expect(summary.period).toBeDefined();
    expect(summary.financial).toBeDefined();
    expect(summary.operations).toBeDefined();
    expect(summary.alerts).toBeDefined();
    expect(summary.legacyCompat).toBeDefined();
  });
});
