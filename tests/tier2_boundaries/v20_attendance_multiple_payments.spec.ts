import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { PaymentService } from '@/services/payment.service';
import { AttendanceService } from '@/services/attendance.service';

describe('Tier 2 Boundary V20: Attendance Multiple Payments & Dynamic Ledger (Phase 12, D2, V20, AC 58)', () => {
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

  it('V20.1: Multiple partial payments across 3 distinct methods dynamically update balances', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    // Two procedures: R$ 600 and R$ 400, explicit discount R$ 100 -> Net R$ 900
    const proc1 = await createTestProcedure({ valorPadrao: 600.0 });
    const proc2 = await createTestProcedure({ valorPadrao: 400.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc1.id, practicedValue: 600.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc2.id, practicedValue: 400.0 });
    await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

    // Method 1: Cash R$ 200
    await PaymentService.recordPayment(attendanceId, { valor: 200.0, metodo: 'Dinheiro' });
    // Method 2: Debit R$ 300
    await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'CartaoDebito' });
    // Method 3: PIX R$ 250
    const res3 = await PaymentService.recordPayment(attendanceId, { valor: 250.0, metodo: 'Pix' });

    expect(res3.financials.standardTotal).toBe(1000.0);
    expect(res3.financials.practicedTotal).toBe(1000.0);
    expect(res3.financials.explicitDiscount).toBe(100.0);
    expect(res3.financials.netTotal).toBe(900.0);
    expect(res3.financials.paidTotal).toBe(750.0);
    expect(res3.financials.outstandingBalance).toBe(150.0);
    expect(res3.financials.isFullyPaid).toBe(false);
  });

  it('V20.2: Final settlement payment clears outstanding balance to exactly 0.00', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 500.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

    // Partial payment 1: R$ 300
    await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'Dinheiro' });

    // Settlement payment: R$ 200
    const resFinal = await PaymentService.recordPayment(attendanceId, { valor: 200.0, metodo: 'Transferencia' });

    expect(resFinal.financials.paidTotal).toBe(500.0);
    expect(resFinal.financials.outstandingBalance).toBe(0.0);
    expect(resFinal.financials.isFullyPaid).toBe(true);
  });

  it('V20.3: Advance / signal payment recorded on pending attendance applies to subsequent procedures', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    // Advance signal payment of R$ 100 before procedure is performed
    await PaymentService.recordPayment(attendanceId, { valor: 100.0, metodo: 'Pix' });

    // Procedures added later: R$ 450
    const proc = await createTestProcedure({ valorPadrao: 450.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 450.0 });

    const attendanceWithFin = await AttendanceService.getAttendanceById(attendanceId);
    expect(attendanceWithFin.financials.netTotal).toBe(450.0);
    expect(attendanceWithFin.financials.paidTotal).toBe(100.0);
    expect(attendanceWithFin.financials.outstandingBalance).toBe(350.0);
  });

  it('V20.4: Cancelled payments are excluded from paidTotal', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 300.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 300.0 });

    const pay1 = await PaymentService.recordPayment(attendanceId, { valor: 150.0, metodo: 'Dinheiro' });
    expect(pay1.financials.paidTotal).toBe(150.0);

    // Cancel pay1
    await PaymentService.cancelPayment(pay1.payment.id);

    const afterCancel = await PaymentService.getPaymentsByAttendance(attendanceId);
    expect(afterCancel.paidTotal).toBe(0.0);
    expect(afterCancel.outstandingBalance).toBe(300.0);
  });

  it('V20.5: Fractional cents across multiple payments preserve precision without drift', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 100.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 100.0 });

    await PaymentService.recordPayment(attendanceId, { valor: 33.33, metodo: 'Pix' });
    await PaymentService.recordPayment(attendanceId, { valor: 33.33, metodo: 'Pix' });
    const res3 = await PaymentService.recordPayment(attendanceId, { valor: 33.34, metodo: 'Pix' });

    expect(res3.financials.paidTotal).toBe(100.0);
    expect(res3.financials.outstandingBalance).toBe(0.0);
    expect(res3.financials.isFullyPaid).toBe(true);
  });
});
