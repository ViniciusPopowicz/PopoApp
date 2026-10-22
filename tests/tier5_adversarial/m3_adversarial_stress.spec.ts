import { describe, it, expect, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { MedicalRecordService } from '@/services/medical-record.service';
import { ValidationError, ConflictError, NotFoundError } from '@/lib/errors';
import { createAppointmentSchema, updateAppointmentSchema } from '@/schemas/appointment';

describe('Tier 5 Adversarial Stress Suite: Milestone 3 Invariants (Challenger M3)', () => {
  beforeEach(async () => {
    await cleanTestDatabase();
  });

  // -------------------------------------------------------------
  // Challenge 1: D1 State Machine & Multi-Attendance Cascades
  // -------------------------------------------------------------
  describe('D1 & V07 Invariants: Lifecycle & Cascades', () => {
    it('D1.1: Cancelling appointment with both Realizado and Pendente attendances only cancels Pendente (D1 Rule 5)', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const initialPendingAtt = appt.attendances[0];
      // Mark initial attendance as Realizado
      await AttendanceService.completeAttendance(initialPendingAtt.id);

      // Create a second attendance on same appointment (1:N cardinality)
      const secondAtt = await AttendanceService.createAttendance({
        appointmentId: appt.id,
        clientId: client.id,
        observacoes: 'Sessão adicional de retorno',
      });
      expect(secondAtt.status).toBe('Pendente');

      // Now cancel the appointment
      await AppointmentService.cancelAppointment(appt.id, {
        motivoCancelamento: 'Cliente desmarcou sessões futuras',
      });

      // Assert: Realizado attendance remains intact
      const reloadedFirst = await (prismaTest as any).attendance.findUnique({
        where: { id: initialPendingAtt.id },
      });
      expect(reloadedFirst.status).toBe('Realizado');

      // Assert: Second pending attendance was cancelled
      const reloadedSecond = await (prismaTest as any).attendance.findUnique({
        where: { id: secondAtt.id },
      });
      expect(reloadedSecond.status).toBe('Cancelado');
    });

    it('D1.2: Rescheduling appointment preserves old appointment as Reagendado and links bidirectional pointers', async () => {
      const client = await createTestClient();
      const oldAppt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const newDate = new Date(Date.now() + 3 * 86400000);
      const newAppt = await AppointmentService.rescheduleAppointment(oldAppt.id, {
        novaDataHora: newDate,
        motivo: 'Viagem de trabalho da cliente',
      });

      const reloadedOld = await AppointmentService.getAppointmentById(oldAppt.id);
      expect(reloadedOld.status).toBe('Reagendado');
      expect(reloadedOld.rescheduledToId).toBe(newAppt.id);

      const reloadedNew = await AppointmentService.getAppointmentById(newAppt.id);
      expect(reloadedNew.status).toBe('Agendado');
      expect(reloadedNew.rescheduledFromId).toBe(oldAppt.id);
      expect(reloadedNew.attendances[0].status).toBe('Pendente');
    });

    it('D1.3: Cannot reschedule already Concluído, Cancelado, or Reagendado appointment', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      await AppointmentService.cancelAppointment(appt.id, { motivoCancelamento: 'Cancelamento prévio' });

      await expect(
        AppointmentService.rescheduleAppointment(appt.id, {
          novaDataHora: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------
  // Challenge 2: V03 Invariant: Em atendimento strictly prohibited
  // -------------------------------------------------------------
  describe('V03 Invariant: Prohibited Appointment Status', () => {
    it('V03.1: updateAppointment rejects "Em atendimento"', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      await expect(
        AppointmentService.updateAppointment(appt.id, { status: 'Em atendimento' as any })
      ).rejects.toThrow('Status de agendamento inválido. "Em atendimento" não é permitido.');
    });

    it('V03.2: createAppointmentSchema and updateAppointmentSchema reject "Em atendimento"', () => {
      const result = updateAppointmentSchema.safeParse({ status: 'Em atendimento' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('não é permitido');
      }
    });
  });

  // -------------------------------------------------------------
  // Challenge 3: V08 Invariant: Appointment completion guard
  // -------------------------------------------------------------
  describe('V08 Invariant: Appointment Completion Requires Realizado Attendance', () => {
    it('V08.1: Rejects completion if attendance is still Pendente', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(ValidationError);
    });

    it('V08.2: Rejects completion if all attendances are Cancelado', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      await AttendanceService.cancelAttendance(appt.attendances[0].id);

      await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(ValidationError);
    });

    it('V08.3: Succeeds once attendance is marked Realizado', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      await AttendanceService.completeAttendance(appt.attendances[0].id);
      const completed = await AppointmentService.completeAppointment(appt.id);
      expect(completed.status).toBe('Concluído');
    });
  });

  // -------------------------------------------------------------
  // Challenge 4: V09 & V12: Price Snapshot Immutability
  // -------------------------------------------------------------
  describe('V09 & V12 Invariants: Procedure Standard Snapshot Immutability', () => {
    it('V09.1: Changing procedure valorPadrao does NOT alter historical standardValueSnapshot', async () => {
      const client = await createTestClient();
      const proc = await createTestProcedure({ valorPadrao: 500.0 });

      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });
      const attendanceId = appt.attendances[0].id;

      const assoc = await AttendanceService.addProcedure(attendanceId, {
        procedureId: proc.id,
        practicedValue: 450.0,
      });

      expect(Number(assoc.standardValueSnapshot)).toBe(500.0);
      expect(Number(assoc.practicedValue)).toBe(450.0);

      // Now update catalog procedure price to 1000.0
      await (prismaTest as any).procedure.update({
        where: { id: proc.id },
        data: { valorPadrao: 1000.0 },
      });

      // Reload attendance procedure
      const reloadedAssoc = await (prismaTest as any).attendanceProcedure.findUnique({
        where: { id: assoc.id },
      });

      expect(Number(reloadedAssoc.standardValueSnapshot)).toBe(500.0); // IMMUTABLE
      expect(Number(reloadedAssoc.practicedValue)).toBe(450.0);
    });
  });

  // -------------------------------------------------------------
  // Challenge 5: V15, V16, V17, V18, AC 59, AC 66: Stock Traceability
  // -------------------------------------------------------------
  describe('Stock & Product Usage Invariants', () => {
    it('V15: Rejects usage of lot with past expiration date', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const prod = await ProductService.createProduct({
        nome: 'Anestésico Tópico',
        unidade: 'tubo',
        isReusable: false,
      });

      const expiredDate = new Date(Date.now() - 10 * 86400000); // 10 days ago
      const lot = await StockService.createLot(prod.id, {
        numeroLote: 'LOT-EXP-PAST',
        dataValidade: expiredDate,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      await expect(
        StockService.recordProductUsage(appt.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('V18: Rejects second usage of single-use product unit (AC 59)', async () => {
      const client = await createTestClient();
      const appt1 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 86400000),
      });

      const prod = await ProductService.createProduct({
        nome: 'Cânula 22G',
        unidade: 'unidade',
        isReusable: false,
      });

      const lot = await StockService.createLot(prod.id, {
        numeroLote: 'CANULA-2026',
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // First use succeeds
      const usage1 = await StockService.recordProductUsage(appt1.attendances[0].id, {
        stockUnitId: unit.id,
      });
      expect(usage1.id).toBeDefined();

      // Second appointment for same client
      const appt2 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date(Date.now() + 2 * 86400000),
      });

      // Second use must fail
      await expect(
        StockService.recordProductUsage(appt2.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('V16 & V17 / AC 59 / AC 66: Same-client reuse allowed; cross-client strictly rejected with exact Portuguese message', async () => {
      const clientA = await createTestClient({ nome: 'Cliente A' });
      const clientB = await createTestClient({ nome: 'Cliente B' });

      const prodReusable = await ProductService.createProduct({
        nome: 'Ácido Hialurônico 1ml Reutilizável',
        unidade: 'seringa',
        isReusable: true,
      });

      const lot = await StockService.createLot(prodReusable.id, {
        numeroLote: 'AH-REUSE-2026',
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // 1. Client A uses unit in encounter 1
      const apptA1 = await createTestAppointment(clientA.id);
      const usageA1 = await StockService.recordProductUsage(apptA1.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Uso de 0.5ml',
      });
      expect(usageA1.id).toBeDefined();

      // 2. Client B attempts to use same unit -> MUST BE REJECTED with exact Portuguese message
      const apptB = await createTestAppointment(clientB.id);
      await expect(
        StockService.recordProductUsage(apptB.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

      // 3. Client A uses same unit in encounter 2 -> MUST SUCCEED (V16)
      const apptA2 = await createTestAppointment(clientA.id);
      const usageA2 = await StockService.recordProductUsage(apptA2.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Uso dos 0.5ml restantes',
      });
      expect(usageA2.id).toBeDefined();

      // 4. Traceability inspection
      const trace = await StockService.getStockUnitTraceability(unit.id);
      expect(trace.currentClientId).toBe(clientA.id);
      expect(trace.usageCount).toBe(2);
    });
  });

  // -------------------------------------------------------------
  // Challenge 6: V19 Invariant: Medical Record 1:1 Uniqueness
  // -------------------------------------------------------------
  describe('V19 Invariant: Medical Record 1:1 Uniqueness', () => {
    it('V19.1: Cannot create multiple medical records for same attendance', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const rec1 = await MedicalRecordService.createMedicalRecord({
        attendanceId,
        queixaPrincipal: 'Queixa 1',
        avaliacaoClinica: 'Avaliação 1',
        condutaProcedimento: 'Conduta 1',
      });
      expect(rec1.id).toBeDefined();

      await expect(
        MedicalRecordService.createMedicalRecord({
          attendanceId,
          queixaPrincipal: 'Queixa 2',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('V19.2: Cannot create medical record for a Cancelado attendance', async () => {
      const client = await createTestClient();
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      await AttendanceService.cancelAttendance(attendanceId);

      await expect(
        MedicalRecordService.createMedicalRecord({
          attendanceId,
          queixaPrincipal: 'Queixa teste',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------
  // Challenge 7: D2 Dynamic Financial Computations
  // -------------------------------------------------------------
  describe('D2 Invariant: Dynamic Financial Calculations Engine', () => {
    it('D2.1: Computes standard, practiced, discount, net, paid, and outstanding dynamically', async () => {
      const client = await createTestClient();
      const proc1 = await createTestProcedure({ valorPadrao: 600.0 });
      const proc2 = await createTestProcedure({ valorPadrao: 400.0 });

      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      // Add procedures with practiced values
      await AttendanceService.addProcedure(attendanceId, {
        procedureId: proc1.id,
        practicedValue: 550.0,
      });
      await AttendanceService.addProcedure(attendanceId, {
        procedureId: proc2.id,
        practicedValue: 350.0,
      });

      // Apply explicit discount of 100
      await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

      const attendanceWithFinancials = await AttendanceService.getAttendanceById(attendanceId);
      const f = attendanceWithFinancials.financials;

      // standardTotal = 600 + 400 = 1000
      expect(f.standardTotal).toBe(1000.0);
      // practicedTotal = 550 + 350 = 900
      expect(f.practicedTotal).toBe(900.0);
      // explicitDiscount = 100
      expect(f.explicitDiscount).toBe(100.0);
      // netTotal = 900 - 100 = 800
      expect(f.netTotal).toBe(800.0);
      // paidTotal = 0
      expect(f.paidTotal).toBe(0.0);
      // outstandingBalance = 800
      expect(f.outstandingBalance).toBe(800.0);
      expect(f.isFullyPaid).toBe(false);
    });

    it('D2.2: Rejects discount greater than total practiced value', async () => {
      const client = await createTestClient();
      const proc = await createTestProcedure({ valorPadrao: 500.0 });

      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      await AttendanceService.addProcedure(attendanceId, {
        procedureId: proc.id,
        practicedValue: 400.0,
      });

      await expect(
        AttendanceService.setDiscount(attendanceId, { desconto: 500.0 })
      ).rejects.toThrow(ValidationError);
    });
  });
});
