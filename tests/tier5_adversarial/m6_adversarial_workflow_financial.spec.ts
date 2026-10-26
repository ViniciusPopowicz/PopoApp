import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

describe('Tier 5 Adversarial Test Suite: M6 Clinical & Financial Workflows Hardening', () => {
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
  // Challenge D1: Attendance State Machine & Lifecycle Transitions
  // =========================================================================
  describe('Challenge D1: Attendance State Machine & Lifecycle Transitions', () => {
    it('D1.1: Creating an appointment NEVER creates a Realizado Attendance under any configuration (always Pendente)', async () => {
      const client = await createTestClient();
      const proc1 = await createTestProcedure({ valorPadrao: 300.0 });
      const proc2 = await createTestProcedure({ valorPadrao: 200.0 });

      // Configuration A: Plain appointment without planned procedures
      const apptA = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      expect(apptA.status).toBe('Agendado');
      expect(apptA.attendances).toHaveLength(1);
      expect(apptA.attendances[0].status).toBe('Pendente');
      expect(apptA.attendances[0].status).not.toBe('Realizado');

      // Configuration B: Appointment with planned procedures and prefillAttendance=true
      const apptB = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 2 * 86400000),
        plannedProcedureIds: [proc1.id, proc2.id],
        prefillAttendance: true,
      });
      expect(apptB.status).toBe('Agendado');
      expect(apptB.attendances).toHaveLength(1);
      expect(apptB.attendances[0].status).toBe('Pendente');
      expect(apptB.attendances[0].status).not.toBe('Realizado');

      // Configuration C: Appointment with explicit custom estimated value
      const apptC = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 3 * 86400000),
        valorEstimado: 1500.0,
      });
      expect(apptC.status).toBe('Agendado');
      expect(apptC.attendances).toHaveLength(1);
      expect(apptC.attendances[0].status).toBe('Pendente');
      expect(apptC.attendances[0].status).not.toBe('Realizado');

      // Verify directly from the database table (bypass service caching)
      const persistedAttendances = await prismaTest.attendance.findMany({
        where: { clientId: client.id },
      });
      expect(persistedAttendances).toHaveLength(3);
      for (const att of persistedAttendances) {
        expect(att.status).toBe('Pendente');
        expect(att.completedAt).toBeNull();
      }
    });

    it('D1.2: Cancelling an appointment automatically transitions its pending attendance to Cancelado', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const pendingAttId = appt.attendances[0].id;
      expect(appt.attendances[0].status).toBe('Pendente');

      const cancelledAppt = await AppointmentService.cancelAppointment(appt.id, {
        motivoCancelamento: 'Cliente impossibilitada de comparecer',
      });

      expect(cancelledAppt.status).toBe('Cancelado');
      expect(cancelledAppt.motivoCancelamento).toBe('Cliente impossibilitada de comparecer');

      // Verify attendance moved to Cancelado in DB
      const reloadedAtt = await prismaTest.attendance.findUnique({
        where: { id: pendingAttId },
      });
      expect(reloadedAtt!.status).toBe('Cancelado');
      expect(reloadedAtt!.completedAt).toBeNull();
    });

    it('D1.3: Cancelling an appointment cancels Pendente attendance, leaves Realizado intact (D1 Rule 5), and enforces 1:1 cardinality', async () => {
      const client = await createTestClient();
      const appt1 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const attRealizado = appt1.attendances[0];
      // Mark first attendance as Realizado
      await AttendanceService.completeAttendance(attRealizado.id);

      // 1:1 cardinality: Attempting to create an additional attendance on same appointment is rejected
      await expect(
        AttendanceService.createAttendance({
          appointmentId: appt1.id,
          clientId: client.id,
          observacoes: 'Sessão adicional 1',
        })
      ).rejects.toThrow(ConflictError);

      // Cancel appt1 -> completed attendance remains Realizado
      await AppointmentService.cancelAppointment(appt1.id, {
        motivoCancelamento: 'Cancelamento das sessões restantes',
      });

      const dbRealizado = await prismaTest.attendance.findUnique({ where: { id: attRealizado.id } });
      expect(dbRealizado!.status).toBe('Realizado');
      expect(dbRealizado!.completedAt).not.toBeNull();

      // Separate appointment with Pendente attendance -> cancelled when appointment is cancelled
      const appt2 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 172800000),
      });
      const attPendente = appt2.attendances[0];
      await AppointmentService.cancelAppointment(appt2.id, {
        motivoCancelamento: 'Cancelamento antes do atendimento',
      });

      const dbPendente = await prismaTest.attendance.findUnique({ where: { id: attPendente.id } });
      expect(dbPendente!.status).toBe('Cancelado');
    });

    it('D1.4: Marking an appointment as no-show (Não compareceu) transitions pending attendance to Cancelado while preserving Realizado', async () => {
      const client = await createTestClient();
      const appt1 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const att1 = appt1.attendances[0];
      await AttendanceService.completeAttendance(att1.id);

      const updated1 = await AppointmentService.markNoShow(appt1.id, {
        observacoes: 'Observação administrativa pós-atendimento',
      });
      expect(updated1.status).toBe('Não compareceu');

      const reloaded1 = await prismaTest.attendance.findUnique({ where: { id: att1.id } });
      expect(reloaded1!.status).toBe('Realizado');

      // Pending attendance case
      const appt2 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 172800000),
      });
      const att2 = appt2.attendances[0];

      const updated2 = await AppointmentService.markNoShow(appt2.id, {
        observacoes: 'Cliente não atendeu telefone nem compareceu',
      });
      expect(updated2.status).toBe('Não compareceu');

      const reloaded2 = await prismaTest.attendance.findUnique({ where: { id: att2.id } });
      expect(reloaded2!.status).toBe('Cancelado');
    });

    it('D1.5: Rescheduling an appointment sets old appt to Reagendado, old attendance to Cancelado, creates new Agendado appt with new Pendente attendance', async () => {
      const client = await createTestClient();
      const proc = await createTestProcedure({ valorPadrao: 400.0 });

      const oldAppt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-10T10:00:00Z'),
        plannedProcedureIds: [proc.id],
      });

      const oldAttendanceId = oldAppt.attendances[0].id;
      const newDate = new Date('2026-11-17T14:00:00Z');

      const newAppt = await AppointmentService.rescheduleAppointment(oldAppt.id, {
        novaDataHora: newDate,
        motivo: 'Paciente solicitou alteração de data',
      });

      // 1. Verify new appointment properties
      expect(newAppt.id).not.toBe(oldAppt.id);
      expect(newAppt.status).toBe('Agendado');
      expect(newAppt.dataHora.toISOString()).toBe(newDate.toISOString());
      expect(newAppt.rescheduledFromId).toBe(oldAppt.id);
      expect(newAppt.attendances).toHaveLength(1);
      expect(newAppt.attendances[0].status).toBe('Pendente');
      expect(newAppt.plannedProcedures).toHaveLength(1);
      expect(newAppt.plannedProcedures[0].procedureId).toBe(proc.id);

      // 2. Verify old appointment properties in DB
      const reloadedOldAppt = await AppointmentService.getAppointmentById(oldAppt.id);
      expect(reloadedOldAppt.status).toBe('Reagendado');
      expect(reloadedOldAppt.rescheduledToId).toBe(newAppt.id);

      // 3. Verify old attendance in DB was transitioned to Cancelado
      const reloadedOldAtt = await prismaTest.attendance.findUnique({
        where: { id: oldAttendanceId },
      });
      expect(reloadedOldAtt!.status).toBe('Cancelado');
    });

    it('D1.6: Rescheduling cascade with pre-completed attendance leaves completed attendance Realizado and creates new Pendente attendance on new appointment', async () => {
      const client = await createTestClient();
      const oldAppt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-01T10:00:00Z'),
      });

      const completedAtt = oldAppt.attendances[0];
      await AttendanceService.completeAttendance(completedAtt.id);

      const newAppt = await AppointmentService.rescheduleAppointment(oldAppt.id, {
        novaDataHora: new Date('2026-11-08T10:00:00Z'),
        motivo: 'Reagendando retorno',
      });

      const dbCompleted = await prismaTest.attendance.findUnique({ where: { id: completedAtt.id } });

      expect(dbCompleted!.status).toBe('Realizado');
      expect(newAppt.attendances[0].status).toBe('Pendente');
    });

    it('D1.7: Multi-hop rescheduling chain (A -> B -> C) preserves complete audit lineage', async () => {
      const client = await createTestClient();

      // Appt A
      const apptA = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-01T10:00:00Z'),
      });

      // Reschedule A -> B
      const apptB = await AppointmentService.rescheduleAppointment(apptA.id, {
        novaDataHora: new Date('2026-11-05T10:00:00Z'),
        motivo: 'Primeiro reagendamento',
      });

      // Reschedule B -> C
      const apptC = await AppointmentService.rescheduleAppointment(apptB.id, {
        novaDataHora: new Date('2026-11-10T10:00:00Z'),
        motivo: 'Segundo reagendamento',
      });

      const reloadedA = await AppointmentService.getAppointmentById(apptA.id);
      const reloadedB = await AppointmentService.getAppointmentById(apptB.id);
      const reloadedC = await AppointmentService.getAppointmentById(apptC.id);

      expect(reloadedA.status).toBe('Reagendado');
      expect(reloadedA.rescheduledFromId).toBeNull();
      expect(reloadedA.rescheduledToId).toBe(apptB.id);

      expect(reloadedB.status).toBe('Reagendado');
      expect(reloadedB.rescheduledFromId).toBe(apptA.id);
      expect(reloadedB.rescheduledToId).toBe(apptC.id);

      expect(reloadedC.status).toBe('Agendado');
      expect(reloadedC.rescheduledFromId).toBe(apptB.id);
      expect(reloadedC.rescheduledToId).toBeNull();
      expect(reloadedC.attendances[0].status).toBe('Pendente');
    });

    it('D1.8: State machine invariants: rejects illegal actions and invalid transitions', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const attId = appt.attendances[0].id;

      // Cancel appointment
      await AppointmentService.cancelAppointment(appt.id, {
        motivoCancelamento: 'Cancelamento formal',
      });

      // 1. Cannot cancel again
      await expect(
        AppointmentService.cancelAppointment(appt.id, { motivoCancelamento: 'Tentativa redundante' })
      ).rejects.toThrow(ValidationError);

      // 2. Cannot mark no-show on cancelled appointment
      await expect(AppointmentService.markNoShow(appt.id)).rejects.toThrow(ValidationError);

      // 3. Cannot reschedule cancelled appointment
      await expect(
        AppointmentService.rescheduleAppointment(appt.id, { novaDataHora: new Date() })
      ).rejects.toThrow(ValidationError);

      // 4. Cannot complete cancelled attendance
      await expect(AttendanceService.completeAttendance(attId)).rejects.toThrow(ValidationError);

      // 5. Cannot add procedure to cancelled attendance
      const proc = await createTestProcedure();
      await expect(
        AttendanceService.addProcedure(attId, { procedureId: proc.id, practicedValue: 100.0 })
      ).rejects.toThrow(ValidationError);

      // 6. Cannot record payment for cancelled attendance
      await expect(
        PaymentService.recordPayment(attId, { valor: 50.0, metodo: 'Dinheiro' })
      ).rejects.toThrow(ValidationError);

      // 7. Cannot create new attendance on cancelled appointment
      await expect(
        AttendanceService.createAttendance({ appointmentId: appt.id, clientId: client.id })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // Challenge D2: Complex Financial Composition & Multi-Method Ledger
  // =========================================================================
  describe('Challenge D2: Complex Financial Composition & Multi-Method Ledger', () => {
    it('D2.1: Complex multi-procedure attendance with practiced != standard (practiced > standard, < standard, == standard) asserts exact totals without implicit discount', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      // Procedure 1: Standard 500, Practiced 400 (practiced < standard)
      const p1 = await createTestProcedure({ nome: 'Procedimento A', valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p1.id, practicedValue: 400.0 });

      // Procedure 2: Standard 300, Practiced 450 (practiced > standard: premium technique)
      const p2 = await createTestProcedure({ nome: 'Procedimento B', valorPadrao: 300.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p2.id, practicedValue: 450.0 });

      // Procedure 3: Standard 250, Practiced 250 (practiced == standard)
      const p3 = await createTestProcedure({ nome: 'Procedimento C', valorPadrao: 250.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p3.id, practicedValue: 250.0 });

      // Procedure 4: Standard 150, Practiced 100 (practiced < standard)
      const p4 = await createTestProcedure({ nome: 'Procedimento D', valorPadrao: 150.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p4.id, practicedValue: 100.0 });

      // Recompute and verify financials
      const attendance = await AttendanceService.getAttendanceById(attendanceId);
      const financials = attendance.financials;

      // Standard Total: 500 + 300 + 250 + 150 = 1200.00
      expect(financials.standardTotal).toBe(1200.0);

      // Practiced Total: 400 + 450 + 250 + 100 = 1200.00
      expect(financials.practicedTotal).toBe(1200.0);

      // Crucial D2 / V10: Explicit discount must remain strictly 0.00!
      // (Difference of 500-400=100 and 150-100=50 is NOT automatically converted to discount)
      expect(financials.explicitDiscount).toBe(0.0);
      expect(financials.netTotal).toBe(1200.0);
      expect(financials.paidTotal).toBe(0.0);
      expect(financials.outstandingBalance).toBe(1200.0);
      expect(financials.isFullyPaid).toBe(false);
    });

    it('D2.2: Explicit discount application preserves standard and practiced figures and computes exact net total', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p1 = await createTestProcedure({ valorPadrao: 700.0 });
      const p2 = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p1.id, practicedValue: 700.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p2.id, practicedValue: 500.0 });

      // Practiced total = 1200.00. Now apply explicit discount of R$ 150.00
      await AttendanceService.setDiscount(attendanceId, { desconto: 150.0 });

      const attendance = await AttendanceService.getAttendanceById(attendanceId);
      const fin = attendance.financials;

      expect(fin.standardTotal).toBe(1200.0);
      expect(fin.practicedTotal).toBe(1200.0);
      expect(fin.explicitDiscount).toBe(150.0);
      expect(fin.netTotal).toBe(1050.0); // 1200 - 150 = 1050
      expect(fin.paidTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(1050.0);
      expect(fin.isFullyPaid).toBe(false);
    });

    it('D2.3: Multi-method payment progression (Dinheiro + Cartão de Crédito parcelado + PIX parcelado) asserts exact Total and Saldo Devedor at each step', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      // Setup procedures: total practiced = 1200.00, explicit discount = 150.00 -> Net Total = 1050.00
      const p1 = await createTestProcedure({ valorPadrao: 800.0 });
      const p2 = await createTestProcedure({ valorPadrao: 400.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p1.id, practicedValue: 800.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p2.id, practicedValue: 400.0 });
      await AttendanceService.setDiscount(attendanceId, { desconto: 150.0 });

      // Initial state: Net Total = 1050.00, Saldo Devedor = 1050.00
      let fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.netTotal).toBe(1050.0);
      expect(fin.paidTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(1050.0);

      // Step 1: Cash payment (Dinheiro) of R$ 250.00
      const pay1 = await PaymentService.recordPayment(attendanceId, {
        valor: 250.0,
        metodo: 'Dinheiro',
        status: 'Pago',
      });
      expect(pay1.financials.paidTotal).toBe(250.0);
      expect(pay1.financials.outstandingBalance).toBe(800.0);
      expect(pay1.financials.isFullyPaid).toBe(false);

      // Step 2: Credit Card payment (CartaoCredito) of R$ 400.00 in 4 installments
      const pay2 = await PaymentService.recordPayment(attendanceId, {
        valor: 400.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 4,
        status: 'Pago',
      });
      expect(pay2.financials.paidTotal).toBe(650.0); // 250 + 400 = 650
      expect(pay2.financials.outstandingBalance).toBe(400.0); // 1050 - 650 = 400
      expect(pay2.financials.isFullyPaid).toBe(false);

      // Step 3: PIX Installment Schedule for the remaining R$ 400.00 in 2 installments (R$ 200.00 each)
      const pixSchedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 400.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
        intervaloDias: 30,
      });

      // At creation, PIX installments are Pendente. Paid total is still 650.00, outstanding is still 400.00.
      expect(pixSchedule.financials.paidTotal).toBe(650.0);
      expect(pixSchedule.financials.outstandingBalance).toBe(400.0);
      expect(pixSchedule.financials.isFullyPaid).toBe(false);

      const inst1 = pixSchedule.payment.pixInstallments![0];
      const inst2 = pixSchedule.payment.pixInstallments![1];
      expect(inst1.valor).toBe(200.0);
      expect(inst2.valor).toBe(200.0);
      expect(inst1.status).toBe('Pendente');
      expect(inst2.status).toBe('Pendente');

      // Step 4: Pay PIX installment 1 (R$ 200.00)
      const payInst1 = await PaymentService.payPixInstallment(inst1.id);
      expect(payInst1.financials.paidTotal).toBe(850.0); // 650 + 200 = 850
      expect(payInst1.financials.outstandingBalance).toBe(200.0); // 1050 - 850 = 200
      expect(payInst1.financials.isFullyPaid).toBe(false);

      const parentPaymentMid = await PaymentService.getPaymentById(pixSchedule.payment.id);
      expect(parentPaymentMid.status).toBe('Pendente'); // Sibling installment is still pending

      // Step 5: Pay PIX installment 2 (R$ 200.00)
      const payInst2 = await PaymentService.payPixInstallment(inst2.id);
      expect(payInst2.financials.paidTotal).toBe(1050.0); // 850 + 200 = 1050
      expect(payInst2.financials.outstandingBalance).toBe(0.0); // 1050 - 1050 = 0
      expect(payInst2.financials.isFullyPaid).toBe(true);

      // Now all installments are paid, parent payment must be 'Pago'
      const parentPaymentEnd = await PaymentService.getPaymentById(pixSchedule.payment.id);
      expect(parentPaymentEnd.status).toBe('Pago');
    });

    it('D2.4: Decimal precision, penny distribution, and exact cent balance across fractional installments', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      // Procedure with practiced = R$ 100.00
      const p = await createTestProcedure({ valorPadrao: 100.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 100.0 });

      // Split R$ 100.00 into 3 installments (100 / 3 = 33.333...)
      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 100.0,
        numeroParcelas: 3,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      const installments = schedule.payment.pixInstallments!;
      expect(installments).toHaveLength(3);
      // Remainder penny goes to first installment
      expect(installments[0].valor).toBe(33.34);
      expect(installments[1].valor).toBe(33.33);
      expect(installments[2].valor).toBe(33.33);

      // Pay installment 1 (33.34)
      const after1 = await PaymentService.payPixInstallment(installments[0].id);
      expect(after1.financials.paidTotal).toBe(33.34);
      expect(after1.financials.outstandingBalance).toBe(66.66);

      // Pay installment 2 (33.33)
      const after2 = await PaymentService.payPixInstallment(installments[1].id);
      expect(after2.financials.paidTotal).toBe(66.67);
      expect(after2.financials.outstandingBalance).toBe(33.33);

      // Pay installment 3 (33.33)
      const after3 = await PaymentService.payPixInstallment(installments[2].id);
      expect(after3.financials.paidTotal).toBe(100.0);
      expect(after3.financials.outstandingBalance).toBe(0.0);
      expect(after3.financials.isFullyPaid).toBe(true);
    });

    it('D2.5: Overpayment rejection: attempting to pay even R$ 0.01 above outstanding balance throws ValidationError', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 500.0 });

      // Outstanding balance is exactly R$ 500.00. Attempting to record R$ 500.01 must fail.
      await expect(
        PaymentService.recordPayment(attendanceId, {
          valor: 500.01,
          metodo: 'Pix',
        })
      ).rejects.toThrow(ValidationError);

      // Partial payment of 300.00 succeeds
      await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'Dinheiro' });

      // Remaining outstanding balance is 200.00. Attempting to record 200.02 must fail.
      await expect(
        PaymentService.recordPayment(attendanceId, {
          valor: 200.02,
          metodo: 'CartaoDebito',
        })
      ).rejects.toThrow(ValidationError);

      // Attempting PIX installment schedule of 200.01 must also fail
      await expect(
        PaymentService.createPixInstallmentSchedule(attendanceId, {
          valorTotal: 200.01,
          numeroParcelas: 2,
          primeiroVencimento: new Date(),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('D2.6: Excessive discount rejection & 100% discount edge case', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 400.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 400.0 });

      // Attempting discount of 400.01 must fail
      await expect(
        AttendanceService.setDiscount(attendanceId, { desconto: 400.01 })
      ).rejects.toThrow(ValidationError);

      // 100% discount (R$ 400.00) is valid (courtesy service)
      await AttendanceService.setDiscount(attendanceId, { desconto: 400.0 });
      const fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.practicedTotal).toBe(400.0);
      expect(fin.explicitDiscount).toBe(400.0);
      expect(fin.netTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(0.0);

      // Any positive payment on a 0.00 balance must fail
      await expect(
        PaymentService.recordPayment(attendanceId, { valor: 10.0, metodo: 'Dinheiro' })
      ).rejects.toThrow(ValidationError);
    });

    it('D2.7: Advance/signal payment without procedures enforces ceiling against appointment estimated value', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
        valorEstimado: 600.0,
      });
      const attendanceId = appt.attendances[0].id;

      // No procedures added yet. Advance payment of R$ 200.00 succeeds
      const pay1 = await PaymentService.recordPayment(attendanceId, {
        valor: 200.0,
        metodo: 'Pix',
      });
      expect(pay1.financials.paidTotal).toBe(200.0);

      // Remaining estimated ceiling is 400.00. Attempting to pay 400.01 fails
      await expect(
        PaymentService.recordPayment(attendanceId, { valor: 400.01, metodo: 'Dinheiro' })
      ).rejects.toThrow(ValidationError);
    });

    it('D2.8: Persistence invariant: Attendance table has NO stored columns for total or saldo devedor (pure dynamic reduction per D2)', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 500.0 });
      await AttendanceService.setDiscount(attendanceId, { desconto: 50.0 });

      // Direct raw query of columns in SQL Server table [Attendance]
      const rawAttendance: any = await prismaTest.$queryRawUnsafe(
        `SELECT * FROM [Attendance] WHERE [id] = '${attendanceId}'`
      );
      expect(rawAttendance).toHaveLength(1);
      const row = rawAttendance[0];

      // Verify that total, netTotal, paidTotal, and outstandingBalance do NOT exist as database columns
      expect(row.total).toBeUndefined();
      expect(row.netTotal).toBeUndefined();
      expect(row.paidTotal).toBeUndefined();
      expect(row.outstandingBalance).toBeUndefined();
      expect(row.saldoDevedor).toBeUndefined();

      // Only desconto, status, observacoes, dataHora, completedAt, clientId, appointmentId, createdAt, updatedAt exist
      expect(row.desconto).toBeDefined();
      expect(row.status).toBe('Pendente');
    });
  });

  // =========================================================================
  // Challenge D5: Reminder State Decoupling from Payment Truth (V23)
  // =========================================================================
  describe('Challenge D5: Reminder State Decoupling from Payment Truth (V23)', () => {
    it('D5.1: Marking PIX reminder as concluido strictly NEVER updates PixInstallment.status, Payment.status, or Attendance saldo devedor', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 600.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 600.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 600.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      const inst = schedule.payment.pixInstallments![0];
      const reminders = await ReminderService.listReminders({ pixInstallmentId: inst.id });
      expect(reminders).toHaveLength(1);
      const reminder = reminders[0];

      // Mark reminder as 'concluido'
      const updatedReminder = await ReminderService.updateReminderStatus(reminder.id, 'concluido');
      expect(updatedReminder.status).toBe('concluido');
      expect(updatedReminder.completedAt).not.toBeNull();

      // Verify installment in DB remains strictly Pendente
      const dbInst = await prismaTest.pixInstallment.findUnique({ where: { id: inst.id } });
      expect(dbInst!.status).toBe('Pendente');
      expect(dbInst!.dataPagamento).toBeNull();

      // Verify parent payment remains strictly Pendente
      const dbPayment = await prismaTest.payment.findUnique({ where: { id: schedule.payment.id } });
      expect(dbPayment!.status).toBe('Pendente');
      expect(dbPayment!.dataPagamento).toBeNull();

      // Verify attendance financials: paidTotal remains 0, saldo devedor remains 600
      const fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.paidTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(600.0);
      expect(fin.isFullyPaid).toBe(false);
    });

    it('D5.2: Marking PIX reminder as dispensado strictly NEVER updates PixInstallment.status, Payment.status, or Attendance saldo devedor', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 400.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 400.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 400.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      const inst = schedule.payment.pixInstallments![0];
      const reminders = await ReminderService.listReminders({ pixInstallmentId: inst.id });
      const reminder = reminders[0];

      // Mark reminder as 'dispensado'
      const updatedReminder = await ReminderService.updateReminderStatus(reminder.id, 'dispensado');
      expect(updatedReminder.status).toBe('dispensado');

      const dbInst = await prismaTest.pixInstallment.findUnique({ where: { id: inst.id } });
      expect(dbInst!.status).toBe('Pendente');

      const fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.paidTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(400.0);
    });

    it('D5.3: Rapid bidirectional reminder status flips (pendente -> concluido -> dispensado -> pendente) leave the ledger completely frozen', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 300.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 300.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 300.0,
        numeroParcelas: 1,
        primeiroVencimento: new Date(),
      });

      const instId = schedule.payment.pixInstallments![0].id;
      const reminder = (await ReminderService.listReminders({ pixInstallmentId: instId }))[0];

      // Flips: concluido -> dispensado -> pendente -> concluido
      await ReminderService.updateReminderStatus(reminder.id, 'concluido');
      await ReminderService.updateReminderStatus(reminder.id, 'dispensado');
      await ReminderService.updateReminderStatus(reminder.id, 'pendente');
      await ReminderService.updateReminderStatus(reminder.id, 'concluido');

      // Verify complete decoupling
      const dbInst = await prismaTest.pixInstallment.findUnique({ where: { id: instId } });
      expect(dbInst!.status).toBe('Pendente');
      expect(dbInst!.dataPagamento).toBeNull();

      const fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.paidTotal).toBe(0.0);
      expect(fin.outstandingBalance).toBe(300.0);
    });

    it('D5.4: Deleting a reminder entirely from the database leaves the linked PixInstallment and Payment intact and saldo devedor unchanged', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 500.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 500.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 500.0,
        numeroParcelas: 2,
        primeiroVencimento: new Date(),
      });

      const inst = schedule.payment.pixInstallments![0];
      const reminder = (await ReminderService.listReminders({ pixInstallmentId: inst.id }))[0];

      // Delete the reminder
      await ReminderService.deleteReminder(reminder.id);

      // Verify reminder deleted
      const checkReminder = await prismaTest.reminder.findUnique({ where: { id: reminder.id } });
      expect(checkReminder).toBeNull();

      // Verify PixInstallment and Payment still exist untouched
      const dbInst = await prismaTest.pixInstallment.findUnique({ where: { id: inst.id } });
      expect(dbInst).not.toBeNull();
      expect(dbInst!.status).toBe('Pendente');

      const fin = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(fin.outstandingBalance).toBe(500.0);
    });

    it('D5.5: Paying the PIX installment via PaymentService updates payment truth, but subsequent reminder status edits never alter payment truth', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const proc = await createTestProcedure({ valorPadrao: 200.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: proc.id, practicedValue: 200.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 200.0,
        numeroParcelas: 1,
        primeiroVencimento: new Date(),
      });

      const instId = schedule.payment.pixInstallments![0].id;
      const reminder = (await ReminderService.listReminders({ pixInstallmentId: instId }))[0];

      // Pay the installment legitimately through PaymentService
      const payResult = await PaymentService.payPixInstallment(instId);
      expect(payResult.installment.status).toBe('Pago');
      expect(payResult.financials.paidTotal).toBe(200.0);
      expect(payResult.financials.outstandingBalance).toBe(0.0);

      // Reminder was marked concluido automatically
      const remAfterPay = await ReminderService.getReminderById(reminder.id);
      expect(remAfterPay.status).toBe('concluido');

      // Now an adversarial action: someone reverts the reminder to 'pendente' or marks it 'dispensado'
      await ReminderService.updateReminderStatus(reminder.id, 'pendente');

      // Payment truth MUST NOT be reverted
      const dbInst = await prismaTest.pixInstallment.findUnique({ where: { id: instId } });
      expect(dbInst!.status).toBe('Pago');
      expect(dbInst!.dataPagamento).not.toBeNull();

      const finAfter = (await AttendanceService.getAttendanceById(attendanceId)).financials;
      expect(finAfter.paidTotal).toBe(200.0);
      expect(finAfter.outstandingBalance).toBe(0.0);
      expect(finAfter.isFullyPaid).toBe(true);
    });
  });

  // =========================================================================
  // Challenge Credit Card vs PIX Installments: Reminder Generation Policies
  // =========================================================================
  describe('Challenge Credit Card vs PIX Installments: Reminder Generation Policies', () => {
    it('C1.1: Credit card payments with 1, 6, and 12 installments store numeroParcelas but generate strictly 0 reminders and 0 PixInstallment rows', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 2000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 2000.0 });

      // Payment 1: Credit Card 1 installment (à vista)
      const pay1 = await PaymentService.recordPayment(attendanceId, {
        valor: 200.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 1,
      });
      expect(pay1.payment.numeroParcelas).toBe(1);

      // Payment 2: Credit Card 6 installments
      const pay2 = await PaymentService.recordPayment(attendanceId, {
        valor: 600.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 6,
      });
      expect(pay2.payment.numeroParcelas).toBe(6);

      // Payment 3: Credit Card 12 installments
      const pay3 = await PaymentService.recordPayment(attendanceId, {
        valor: 1200.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 12,
      });
      expect(pay3.payment.numeroParcelas).toBe(12);

      // Crucial V21 Verification: Query database directly via Prisma
      // 1. Zero PixInstallment rows exist for any of these payments
      const pixRows = await prismaTest.pixInstallment.findMany({
        where: { paymentId: { in: [pay1.payment.id, pay2.payment.id, pay3.payment.id] } },
      });
      expect(pixRows).toHaveLength(0);

      // 2. Zero Reminder rows exist anywhere for this client or attendance
      const clientReminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
      });
      expect(clientReminders).toHaveLength(0);
    });

    it('C1.2: PIX installment schedules generate reminders matching due dates (3 installments with remainder cent)', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 1000.0 });

      const startDate = new Date('2026-11-10T10:00:00Z');
      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 1000.0,
        numeroParcelas: 3,
        primeiroVencimento: startDate,
        intervaloDias: 30,
      });

      const installments = schedule.payment.pixInstallments!;
      expect(installments).toHaveLength(3);

      // Verify installments
      expect(installments[0].numeroParcela).toBe(1);
      expect(installments[0].valor).toBe(333.34);
      expect(new Date(installments[0].dataVencimento).toISOString()).toBe(startDate.toISOString());

      const expDate2 = new Date(startDate);
      expDate2.setDate(expDate2.getDate() + 30);
      expect(installments[1].numeroParcela).toBe(2);
      expect(installments[1].valor).toBe(333.33);
      expect(new Date(installments[1].dataVencimento).toISOString()).toBe(expDate2.toISOString());

      const expDate3 = new Date(startDate);
      expDate3.setDate(expDate3.getDate() + 60);
      expect(installments[2].numeroParcela).toBe(3);
      expect(installments[2].valor).toBe(333.33);
      expect(new Date(installments[2].dataVencimento).toISOString()).toBe(expDate3.toISOString());

      // Verify reminders in database
      const reminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
        orderBy: { dataVencimento: 'asc' },
      });
      expect(reminders).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        expect(reminders[i].pixInstallmentId).toBe(installments[i].id);
        expect(reminders[i].tipo).toBe('parcela_pix');
        expect(reminders[i].status).toBe('pendente');
        expect(new Date(reminders[i].dataVencimento).toISOString()).toBe(
          new Date(installments[i].dataVencimento).toISOString()
        );
        expect(reminders[i].titulo).toContain(`Parcela ${i + 1}/3 - PIX`);
      }
    });

    it('C1.3: PIX installment schedule with 12 installments over 1 year generates exactly 12 installments and 12 reminders', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 1200.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 1200.0 });

      const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 1200.0,
        numeroParcelas: 12,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
        intervaloDias: 30,
      });

      expect(schedule.payment.pixInstallments).toHaveLength(12);

      const reminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
      });
      expect(reminders).toHaveLength(12);

      const reminderInstallmentIds = new Set(reminders.map((r) => r.pixInstallmentId));
      for (const inst of schedule.payment.pixInstallments!) {
        expect(reminderInstallmentIds.has(inst.id)).toBe(true);
      }
    });

    it('C1.4: Concurrent encounter with Credit Card and PIX installments: only PIX generates reminders, total equals PIX count', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 1000.0 });
      await AttendanceService.addProcedure(attendanceId, { procedureId: p.id, practicedValue: 1000.0 });

      // 1. Credit Card payment of 600.00 in 6 installments
      await PaymentService.recordPayment(attendanceId, {
        valor: 600.0,
        metodo: 'CartaoCredito',
        numeroParcelas: 6,
      });

      // 2. PIX installment schedule of remaining 400.00 in 4 installments
      await PaymentService.createPixInstallmentSchedule(attendanceId, {
        valorTotal: 400.0,
        numeroParcelas: 4,
        primeiroVencimento: new Date('2026-11-01T10:00:00Z'),
      });

      // Assert: Exactly 4 reminders exist in total in the entire database for this client and attendance
      const allReminders = await prismaTest.reminder.findMany({
        where: { clientId: client.id },
      });
      expect(allReminders).toHaveLength(4);

      // All 4 reminders point to PIX installments
      for (const rem of allReminders) {
        expect(rem.pixInstallmentId).not.toBeNull();
        expect(rem.tipo).toBe('parcela_pix');
      }
    });
  });
});
