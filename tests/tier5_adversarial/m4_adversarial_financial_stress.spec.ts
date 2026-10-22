import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { getAuthHeaders } from '../helpers/auth-helper';
import { PaymentService } from '@/services/payment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ReminderService } from '@/services/reminder.service';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { setDiscountSchema, createAttendanceSchema } from '@/schemas/attendance';
import { recordPaymentSchema, createPixScheduleSchema } from '@/schemas/payment';
import { POST as postDiscountRoute } from '@/app/api/attendances/[id]/discount/route';

describe('Tier 5 Adversarial Stress Suite: Milestone 4 Financial Engine & Edge Cases (Challenger M4)', () => {
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
  // Challenge 1: Currency Division Edge Cases & Remainder Cent Distribution
  // =========================================================================
  describe('Challenge 1: Currency Division Edge Cases & Remainder Cent Distribution in PIX Schedules', () => {
    it('1.1: previewPixSchedule distributes remainder cent to the first installment (R$ 100.00 / 3 installments -> exactly 100.00)', () => {
      const preview = PaymentService.previewPixSchedule({
        valorTotal: 100.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      expect(preview.numeroParcelas).toBe(3);
      expect(preview.parcelas).toHaveLength(3);

      // Verify rounding and remainder cent allocation
      expect(preview.parcelas[0].valor).toBe(33.34);
      expect(preview.parcelas[1].valor).toBe(33.33);
      expect(preview.parcelas[2].valor).toBe(33.33);

      const sum = preview.parcelas.reduce((acc, p) => acc + p.valor, 0);
      expect(Number(sum.toFixed(2))).toBe(100.0);
    });

    it('1.2: Complex division edge cases (6, 7, 11 installments) preserve exact currency balance without losing cents', () => {
      // Case A: 6 installments of R$ 100.00 (100 / 6 = 16.666... base 16.66, first 16.70)
      const preview6 = PaymentService.previewPixSchedule({
        valorTotal: 100.0,
        numeroParcelas: 6,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });
      const sum6 = preview6.parcelas.reduce((acc, p) => acc + p.valor, 0);
      expect(Number(sum6.toFixed(2))).toBe(100.0);
      expect(preview6.parcelas[0].valor).toBe(16.70);
      for (let i = 1; i < 6; i++) {
        expect(preview6.parcelas[i].valor).toBe(16.66);
      }

      // Case B: 7 installments of R$ 100.00 (100 / 7 = 14.2857... base 14.28, first 14.32)
      const preview7 = PaymentService.previewPixSchedule({
        valorTotal: 100.0,
        numeroParcelas: 7,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });
      const sum7 = preview7.parcelas.reduce((acc, p) => acc + p.valor, 0);
      expect(Number(sum7.toFixed(2))).toBe(100.0);
      expect(preview7.parcelas[0].valor).toBe(14.32);
      for (let i = 1; i < 7; i++) {
        expect(preview7.parcelas[i].valor).toBe(14.28);
      }

      // Case C: Odd total R$ 77.77 in 3 installments (77.77 / 3 = 25.9233... base 25.92, first 25.93)
      const previewOdd = PaymentService.previewPixSchedule({
        valorTotal: 77.77,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });
      const sumOdd = previewOdd.parcelas.reduce((acc, p) => acc + p.valor, 0);
      expect(Number(sumOdd.toFixed(2))).toBe(77.77);
      expect(previewOdd.parcelas[0].valor).toBe(25.93);
      expect(previewOdd.parcelas[1].valor).toBe(25.92);
      expect(previewOdd.parcelas[2].valor).toBe(25.92);

      // Case D: Micro-fraction R$ 0.10 in 3 installments (0.10 / 3 -> base 0.03, first 0.04)
      const previewMicro = PaymentService.previewPixSchedule({
        valorTotal: 0.10,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });
      const sumMicro = previewMicro.parcelas.reduce((acc, p) => acc + p.valor, 0);
      expect(Number(sumMicro.toFixed(2))).toBe(0.10);
      expect(previewMicro.parcelas[0].valor).toBe(0.04);
      expect(previewMicro.parcelas[1].valor).toBe(0.03);
      expect(previewMicro.parcelas[2].valor).toBe(0.03);
    });

    it('1.3: Real DB persistence of R$ 100.00 in 3 PIX installments records exact cent distribution in PixInstallment and Reminder rows', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 100.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 100.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 100.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-15T12:00:00Z'),
        intervaloDias: 30,
      });

      const paymentId = schedule.payment.id;
      const dbInstallments = await prismaTest.pixInstallment.findMany({
        where: { paymentId },
        orderBy: { numeroParcela: 'asc' },
      });

      expect(dbInstallments).toHaveLength(3);
      expect(Number(dbInstallments[0].valor)).toBe(33.34);
      expect(Number(dbInstallments[1].valor)).toBe(33.33);
      expect(Number(dbInstallments[2].valor)).toBe(33.33);

      const dbReminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
        orderBy: { dataVencimento: 'asc' },
      });

      expect(dbReminders).toHaveLength(3);
      expect(dbReminders[0].descricao).toMatch(/33[,.]34/);
      expect(dbReminders[1].descricao).toMatch(/33[,.]33/);
      expect(dbReminders[2].descricao).toMatch(/33[,.]33/);
    });

    it('1.4: Sequential payment of remainder-cent installments maintains exact dynamic ledger balance without drift', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 100.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 100.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 100.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-15T12:00:00Z'),
      });

      const insts = schedule.payment.pixInstallments!;

      // Step 1: Pay installment 1 (R$ 33.34)
      const pay1 = await PaymentService.payPixInstallment(insts[0].id, { dataPagamento: new Date() });
      expect(pay1.financials.paidTotal).toBe(33.34);
      expect(pay1.financials.outstandingBalance).toBe(66.66);
      expect(pay1.financials.isFullyPaid).toBe(false);

      // Step 2: Pay installment 2 (R$ 33.33)
      const pay2 = await PaymentService.payPixInstallment(insts[1].id, { dataPagamento: new Date() });
      expect(pay2.financials.paidTotal).toBe(66.67);
      expect(pay2.financials.outstandingBalance).toBe(33.33);
      expect(pay2.financials.isFullyPaid).toBe(false);

      // Step 3: Pay installment 3 (R$ 33.33)
      const pay3 = await PaymentService.payPixInstallment(insts[2].id, { dataPagamento: new Date() });
      expect(pay3.financials.paidTotal).toBe(100.0);
      expect(pay3.financials.outstandingBalance).toBe(0.0);
      expect(pay3.financials.isFullyPaid).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 2: Zero Discount vs Negative Discount Rejection
  // =========================================================================
  describe('Challenge 2: Zero Discount vs Negative Discount Rejection', () => {
    it('2.1: Explicit zero discount (desconto: 0.00) is accepted and preserves full netTotal = practicedTotal', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

      // Explicitly set zero discount
      await AttendanceService.setDiscount(attendanceId, { desconto: 0 });

      const attendance = await AttendanceService.getAttendanceById(attendanceId);
      expect(attendance.financials.standardTotal).toBe(500.0);
      expect(attendance.financials.practicedTotal).toBe(500.0);
      expect(attendance.financials.explicitDiscount).toBe(0.0);
      expect(attendance.financials.netTotal).toBe(500.0);
      expect(attendance.financials.outstandingBalance).toBe(500.0);
    });

    it('2.2: Resetting an existing discount to zero restores netTotal to full practiced amount', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 600.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 600.0 });

      // Apply initial discount of R$ 150.00
      await AttendanceService.setDiscount(attendanceId, { desconto: 150.0 });
      const midState = await AttendanceService.getAttendanceById(attendanceId);
      expect(midState.financials.netTotal).toBe(450.0);
      expect(midState.financials.explicitDiscount).toBe(150.0);

      // Reset discount to zero
      await AttendanceService.setDiscount(attendanceId, { desconto: 0.0 });
      const finalState = await AttendanceService.getAttendanceById(attendanceId);
      expect(finalState.financials.netTotal).toBe(600.0);
      expect(finalState.financials.explicitDiscount).toBe(0.0);
      expect(finalState.financials.outstandingBalance).toBe(600.0);
    });

    it('2.3: Schema validation strictly rejects negative discount values (setDiscountSchema)', () => {
      const negativeResult = setDiscountSchema.safeParse({ desconto: -50.0 });
      expect(negativeResult.success).toBe(false);
      if (!negativeResult.success) {
        expect(negativeResult.error.flatten().fieldErrors.desconto).toBeDefined();
        expect(negativeResult.error.flatten().fieldErrors.desconto![0]).toContain('não pode ser negativo');
      }

      const microNegative = setDiscountSchema.safeParse({ desconto: -0.01 });
      expect(microNegative.success).toBe(false);

      const zeroResult = setDiscountSchema.safeParse({ desconto: 0 });
      expect(zeroResult.success).toBe(true);
      if (zeroResult.success) {
        expect(zeroResult.data.desconto).toBe(0);
      }
    });

    it('2.4: Schema validation strictly rejects negative discount values on attendance creation (createAttendanceSchema)', () => {
      const negativeCreation = createAttendanceSchema.safeParse({
        appointmentId: '11111111-1111-1111-1111-111111111111',
        clientId: '22222222-2222-2222-2222-222222222222',
        desconto: -100.0,
      });
      expect(negativeCreation.success).toBe(false);
      if (!negativeCreation.success) {
        expect(negativeCreation.error.flatten().fieldErrors.desconto).toBeDefined();
        expect(negativeCreation.error.flatten().fieldErrors.desconto![0]).toContain('não pode ser negativo');
      }
    });

    it('2.5: API Route POST /api/attendances/[id]/discount returns 400 Bad Request on negative discount attempt', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const authHeaders = await getAuthHeaders();

      // Negative discount request
      const req = new NextRequest(`http://localhost:3000/api/attendances/${attendanceId}/discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ desconto: -25.0 }),
      });

      const response = await postDiscountRoute(req, {
        params: Promise.resolve({ id: attendanceId }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Dados do desconto inválidos');
    });

    it('2.6: Excessive discount greater than total practiced value is strictly rejected by domain service', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 300.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 300.0 });

      // Attempt discount of R$ 350.00 on a R$ 300.00 service
      await expect(
        AttendanceService.setDiscount(attendanceId, { desconto: 350.0 })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // Challenge 3: Multiple Mixed Payment Methods & Dynamic Ledger Invariants
  // =========================================================================
  describe('Challenge 3: Mixed Payment Methods & Dynamic Ledger Invariants (D2, V20, V21, V22)', () => {
    it('3.1: Combining Dinheiro + Cartão de Crédito + PIX on a single attendance maintains exact dynamic ledger balance', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      // Two procedures: R$ 700 + R$ 500 = R$ 1,200. Explicit discount = R$ 200 -> Net Total = R$ 1,000
      const proc1 = await createTestProcedure({ valorPadrao: 700.0 });
      const proc2 = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc1.id, practicedValue: 700.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc2.id, practicedValue: 500.0 });
      await AttendanceService.setDiscount(attendanceId, { desconto: 200.0 });

      // Initial verification
      const initFinancials = await AttendanceService.getAttendanceById(attendanceId);
      expect(initFinancials.financials.practicedTotal).toBe(1200.0);
      expect(initFinancials.financials.explicitDiscount).toBe(200.0);
      expect(initFinancials.financials.netTotal).toBe(1000.0);
      expect(initFinancials.financials.paidTotal).toBe(0.0);
      expect(initFinancials.financials.outstandingBalance).toBe(1000.0);
      expect(initFinancials.financials.isFullyPaid).toBe(false);

      // Payment 1: Cash R$ 200.00 (Method: Dinheiro, Status: Pago)
      const pay1 = await PaymentService.recordPayment(attendanceId, {
        valor: 200.0,
        metodo: 'Dinheiro',
      });
      expect(pay1.financials.paidTotal).toBe(200.0);
      expect(pay1.financials.outstandingBalance).toBe(800.0);
      expect(pay1.financials.isFullyPaid).toBe(false);

      // Payment 2: Credit Card R$ 300.00 in 3 installments (Method: CartaoCredito, Status: Pago)
      const pay2 = await PaymentService.recordPayment(attendanceId, {
        valor: 300.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 3,
      });
      expect(pay2.payment.numeroParcelas).toBe(3);
      expect(pay2.financials.paidTotal).toBe(500.0);
      expect(pay2.financials.outstandingBalance).toBe(500.0);
      expect(pay2.financials.isFullyPaid).toBe(false);

      // Verify V21 invariant: Credit Card creates 0 PixInstallments and 0 Reminders
      const ccInstallments = await prismaTest.pixInstallment.findMany({ where: { paymentId: pay2.payment.id } });
      expect(ccInstallments).toHaveLength(0);
      const remindersAfterCC = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
      expect(remindersAfterCC).toHaveLength(0);

      // Payment 3: PIX schedule of remaining R$ 500.00 in 2 installments (R$ 250 each)
      const scheduleRes = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 500.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date('2026-11-20T10:00:00Z'),
      });
      expect(scheduleRes.payment.status).toBe('Pendente');
      expect(scheduleRes.payment.pixInstallments).toHaveLength(2);

      // Invariant: Schedule is Pendente, so paidTotal is STILL 500.0 and outstandingBalance is STILL 500.0
      expect(scheduleRes.financials.paidTotal).toBe(500.0);
      expect(scheduleRes.financials.outstandingBalance).toBe(500.0);
      expect(scheduleRes.financials.isFullyPaid).toBe(false);

      // Verify V22: Exactly 2 Reminders were created for the PIX installments
      const pixReminders = await prismaTest.reminder.findMany({ where: { clientId: client.id } });
      expect(pixReminders).toHaveLength(2);

      // Step 4: Pay PIX installment 1 (R$ 250.00)
      const inst1Id = scheduleRes.payment.pixInstallments![0].id;
      const settle1 = await PaymentService.payPixInstallment(inst1Id);
      expect(settle1.financials.paidTotal).toBe(750.0);
      expect(settle1.financials.outstandingBalance).toBe(250.0);
      expect(settle1.financials.isFullyPaid).toBe(false);

      // Step 5: Pay PIX installment 2 (R$ 250.00)
      const inst2Id = scheduleRes.payment.pixInstallments![1].id;
      const settle2 = await PaymentService.payPixInstallment(inst2Id);
      expect(settle2.financials.paidTotal).toBe(1000.0);
      expect(settle2.financials.outstandingBalance).toBe(0.0);
      expect(settle2.financials.isFullyPaid).toBe(true);

      // Final ledger check across all payments
      const finalLedger = await PaymentService.getPaymentsByAttendance(attendanceId);
      expect(finalLedger.payments).toHaveLength(3);
      expect(finalLedger.paidTotal).toBe(1000.0);
      expect(finalLedger.outstandingBalance).toBe(0.0);
      expect(finalLedger.isFullyPaid).toBe(true);
    });

    it('3.2: Overpayment ceiling is strictly enforced for direct payments and PIX schedules', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 400.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 400.0 });

      // Direct payment equal to R$ 400.00
      await PaymentService.recordPayment(attendanceId, { valor: 400.0, metodo: 'Dinheiro' });

      // Attempt to record even R$ 0.01 more
      await expect(
        PaymentService.recordPayment(attendanceId, { valor: 0.01, metodo: 'Dinheiro' })
      ).rejects.toThrow(ValidationError);

      // Attempt to create a PIX schedule on fully settled attendance
      await expect(
        PaymentService.createPixInstallmentSchedule(attendanceId, {
          valorTotal: 50.0,
          numeroParcelas: 2,
          primeiroVencimento: new Date(),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('3.3: Invariant V23: Mutating reminder status never mutates payment truth or outstanding balance', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 500.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date(),
      });

      const instId = schedule.payment.pixInstallments![0].id;
      const reminders = await ReminderService.listReminders({ pixInstallmentId: instId });
      expect(reminders).toHaveLength(1);

      // Clinician marks reminder done
      await ReminderService.updateReminderStatus(reminders[0].id, 'concluido');

      // Assert installment is STILL Pendente
      const installmentAfter = await prismaTest.pixInstallment.findUnique({ where: { id: instId } });
      expect(installmentAfter!.status).toBe('Pendente');

      // Assert attendance financial totals are completely UNCHANGED
      const attendanceAfter = await AttendanceService.getAttendanceById(attendanceId);
      expect(attendanceAfter.financials.paidTotal).toBe(0.0);
      expect(attendanceAfter.financials.outstandingBalance).toBe(500.0);
      expect(attendanceAfter.financials.isFullyPaid).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 4: Payment Deletion & Dynamic Recalculation
  // =========================================================================
  describe('Challenge 4: Payment Deletion Effects on Dynamic Totals', () => {
    it('4.1: Deleting a confirmed payment immediately restores outstandingBalance and clears isFullyPaid', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

      const pay = await PaymentService.recordPayment(attendanceId, { valor: 500.0, metodo: 'Dinheiro' });
      expect(pay.financials.paidTotal).toBe(500.0);
      expect(pay.financials.outstandingBalance).toBe(0.0);
      expect(pay.financials.isFullyPaid).toBe(true);

      // Now delete the payment
      const deleteRes = await PaymentService.deletePayment(pay.payment.id);
      expect(deleteRes.success).toBe(true);

      // Re-fetch attendance financials dynamically
      const recalculated = await AttendanceService.getAttendanceById(attendanceId);
      expect(recalculated.financials.netTotal).toBe(500.0);
      expect(recalculated.financials.paidTotal).toBe(0.0);
      expect(recalculated.financials.outstandingBalance).toBe(500.0);
      expect(recalculated.financials.isFullyPaid).toBe(false);
    });

    it('4.2: Deleting a PIX installment schedule cascade-deletes child installments and reminders and reverts balances', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 800.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 800.0 });

      // Direct payment 1: R$ 300.00
      const pay1 = await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'Dinheiro' });

      // PIX schedule: R$ 500.00 in 2 installments
      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 500.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date(),
      });

      // Pay installment 1 (R$ 250.00)
      await PaymentService.payPixInstallment(schedule.payment.pixInstallments![0].id);

      const midState = await AttendanceService.getAttendanceById(attendanceId);
      expect(midState.financials.paidTotal).toBe(550.0);
      expect(midState.financials.outstandingBalance).toBe(250.0);

      // Delete the PIX schedule payment
      await PaymentService.deletePayment(schedule.payment.id);

      // Verify cascading database deletion
      const childInstallments = await prismaTest.pixInstallment.findMany({
        where: { paymentId: schedule.payment.id },
      });
      expect(childInstallments).toHaveLength(0);

      const reminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
      });
      expect(reminders).toHaveLength(0);

      // Verify dynamic recalculation: only the R$ 300 cash payment remains
      const finalState = await AttendanceService.getAttendanceById(attendanceId);
      expect(finalState.financials.paidTotal).toBe(300.0);
      expect(finalState.financials.outstandingBalance).toBe(500.0);
      expect(finalState.financials.isFullyPaid).toBe(false);
    });

    it('4.3: Deleting all payments resets paidTotal to 0.00 and allows new full payment', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 450.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 450.0 });

      const p1 = await PaymentService.recordPayment(attendanceId, { valor: 200.0, metodo: 'Dinheiro' });
      const p2 = await PaymentService.recordPayment(attendanceId, { valor: 250.0, metodo: 'CartaoDebito' });

      const state1 = await AttendanceService.getAttendanceById(attendanceId);
      expect(state1.financials.isFullyPaid).toBe(true);

      // Delete both payments
      await PaymentService.deletePayment(p1.payment.id);
      await PaymentService.deletePayment(p2.payment.id);

      const state2 = await AttendanceService.getAttendanceById(attendanceId);
      expect(state2.financials.paidTotal).toBe(0.0);
      expect(state2.financials.outstandingBalance).toBe(450.0);
      expect(state2.financials.isFullyPaid).toBe(false);

      // Now record a fresh payment of the full amount
      const p3 = await PaymentService.recordPayment(attendanceId, { valor: 450.0, metodo: 'CartaoCredito', numeroParcelas: 2 });
      expect(p3.financials.paidTotal).toBe(450.0);
      expect(p3.financials.outstandingBalance).toBe(0.0);
      expect(p3.financials.isFullyPaid).toBe(true);
    });

    it('4.4: Deleting a non-existent payment ID throws NotFoundError', async () => {
      await expect(
        PaymentService.deletePayment('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // Challenge 5: Cancellation & Edge State Security
  // =========================================================================
  describe('Challenge 5: Cancellation & Edge State Security', () => {
    it('5.1: Cancelled attendance strictly forbids recording new payments or PIX schedules', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      await AttendanceService.cancelAttendance(attendanceId);

      await expect(
        PaymentService.recordPayment(attendanceId, { valor: 100.0, metodo: 'Dinheiro' })
      ).rejects.toThrow(ValidationError);

      await expect(
        PaymentService.createPixInstallmentSchedule(attendanceId, {
          valorTotal: 100.0,
          numeroParcelas: 2,
          primeiroVencimento: new Date(),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('5.2: Cancelling a payment via cancelPayment dismisses reminders and excludes amount from paidTotal', async () => {
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

      // Cancel the payment
      const cancelled = await PaymentService.cancelPayment(schedule.payment.id);
      expect(cancelled.status).toBe('Cancelado');

      // Reminders should now be marked 'dispensado'
      const reminders = await ReminderService.listReminders({ clientId: client.id });
      expect(reminders).toHaveLength(2);
      expect(reminders.every((r) => r.status === 'dispensado')).toBe(true);

      // Financials should show 0 paid
      const financials = await AttendanceService.getAttendanceById(attendanceId);
      expect(financials.financials.paidTotal).toBe(0.0);
      expect(financials.financials.outstandingBalance).toBe(400.0);
    });
  });
});
