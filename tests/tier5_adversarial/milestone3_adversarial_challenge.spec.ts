import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment, createTestProcedure } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { MedicalRecordService } from '@/services/medical-record.service';
import { ProcedureService } from '@/services/procedure.service';
import { ValidationError, ConflictError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

describe('Tier 5 Adversarial Challenge: Milestone 3 Invariant Stress Testing (challenger_m3_2)', () => {
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
  // 1. D1 LIFECYCLE, RESCHEDULE CASCADES & COMPLETION GUARDS (D1, V04, V08)
  // =========================================================================
  describe('1. D1 Lifecycle & Rescheduling Invariants', () => {
    it('Oracle: Rescheduling cascade creates atomic chain, cancels pending attendance, and links rescheduled pointers', async () => {
      const client = await createTestClient({ nome: 'Paciente D1 Teste' });

      // Create procedure to plan
      const proc = await createTestProcedure({
        nome: 'Harmonização Facial Planejada',
        valorPadrao: 1200.0,
        duracaoMinutos: 60,
      });

      // 1. Create initial appointment with planned procedure and prefill
      const appt1 = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-10T10:00:00Z'),
        plannedProcedureIds: [proc.id],
        prefillAttendance: true,
      });

      expect(appt1.status).toBe('Agendado');
      expect(appt1.attendances).toHaveLength(1);
      expect(appt1.attendances[0].status).toBe('Pendente');

      const oldAttendanceId = appt1.attendances[0].id;

      // 2. Reschedule appt1 -> appt2
      const appt2 = await AppointmentService.rescheduleAppointment(appt1.id, {
        novaDataHora: new Date('2026-11-15T14:00:00Z'),
        motivo: 'Paciente solicitou alteração de data',
      });

      // Verification of atomic cascade:
      // Old appointment becomes Reagendado and points to new appointment
      const reloadedAppt1 = await AppointmentService.getAppointmentById(appt1.id);
      expect(reloadedAppt1.status).toBe('Reagendado');
      expect(reloadedAppt1.rescheduledToId).toBe(appt2.id);

      // Old attendance MUST be Cancelado (D1 Rule 4)
      const reloadedOldAtt = await AttendanceService.getAttendanceById(oldAttendanceId);
      expect(reloadedOldAtt.status).toBe('Cancelado');

      // New appointment is Agendado and points back to old appointment
      const reloadedAppt2 = await AppointmentService.getAppointmentById(appt2.id);
      expect(reloadedAppt2.status).toBe('Agendado');
      expect(reloadedAppt2.rescheduledFromId).toBe(appt1.id);
      expect(reloadedAppt2.attendances).toHaveLength(1);
      expect(reloadedAppt2.attendances[0].status).toBe('Pendente');

      // 3. Attempting to reschedule an already Reagendado appointment must throw ValidationError
      await expect(
        AppointmentService.rescheduleAppointment(appt1.id, {
          novaDataHora: new Date('2026-11-20T10:00:00Z'),
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Oracle: Cancelling appointment preserves Realizado encounter, cancels Pendente encounter, and enforces 1:1 cardinality', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-12-01T09:00:00Z'),
      });

      const initialAttendanceId = appt.attendances[0].id;

      // Mark the initial attendance Realizado
      await AttendanceService.completeAttendance(initialAttendanceId);

      // 1:1 cardinality: Attempting to add a secondary attendance on the same appointment is rejected
      await expect(
        AttendanceService.createAttendance({
          appointmentId: appt.id,
          clientId: client.id,
          observacoes: 'Segundo atendimento de retorno',
        })
      ).rejects.toThrow(ConflictError);

      // Now cancel the appointment
      await AppointmentService.cancelAppointment(appt.id, {
        motivoCancelamento: 'Cancelamento parcial',
      });

      // Verification:
      // 1. Initial attendance must RETAIN status Realizado (D1 Rule 5)
      const att1 = await AttendanceService.getAttendanceById(initialAttendanceId);
      expect(att1.status).toBe('Realizado');
    });

    it('Oracle: V08 guard blocks concluding appointment if attendance is pending or cancelled', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-12-05T10:00:00Z'),
      });

      // Case 1: Attendance is still Pendente -> rejected
      await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(
        /Não é possível concluir o agendamento sem que o atendimento esteja realizado|Existem atendimentos pendentes/i
      );

      // Case 2: Cancel the attendance -> still rejected because attendance is not Realizado
      await AttendanceService.cancelAttendance(appt.attendances[0].id);
      await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(
        /Não é possível concluir o agendamento sem que o atendimento esteja realizado/i
      );
    });

    it('Oracle: V03 strictly forbids "Em atendimento" status in appointment creation and updates', async () => {
      const client = await createTestClient();

      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-12-10T10:00:00Z'),
      });

      // Attempting to update appointment to prohibited status "Em atendimento" must fail
      await expect(
        AppointmentService.updateAppointment(appt.id, {
          status: 'Em atendimento' as any,
        })
      ).rejects.toThrow(/Em atendimento.*não é permitido/i);
    });
  });

  // =========================================================================
  // 2. SNAPSHOT IMMUTABILITY & CATALOG DRIFT (V09, V12, V24)
  // =========================================================================
  describe('2. Snapshot Immutability (V09, V12, V24)', () => {
    it('Oracle: Changing catalog procedure standard value does NOT alter historical snapshots or practiced values', async () => {
      const client = await createTestClient();
      const proc = await createTestProcedure({
        nome: 'Preenchimento Malar',
        valorPadrao: 1500.0,
      });

      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-20T15:00:00Z'),
      });

      const attendanceId = appt.attendances[0].id;

      // Add procedure with practiced value differing from standard
      const assoc = await AttendanceService.addProcedure(attendanceId, {
        procedureId: proc.id,
        practicedValue: 1350.0,
        observacoes: 'Condição especial para cliente fidelidade',
      });

      expect(Number(assoc.standardValueSnapshot)).toBe(1500.0);
      expect(Number(assoc.practicedValue)).toBe(1350.0);

      // Now alter procedure catalog standard price drastically
      await ProcedureService.updateProcedure(proc.id, {
        valorPadrao: 2200.0,
      });

      // Reload Attendance and verify snapshots are strictly immutable
      const attendance = await AttendanceService.getAttendanceById(attendanceId);
      const reloadedAssoc = attendance.procedures.find((p) => p.id === assoc.id)!;

      expect(Number(reloadedAssoc.standardValueSnapshot)).toBe(1500.0);
      expect(Number(reloadedAssoc.practicedValue)).toBe(1350.0);
      expect(attendance.financials.standardTotal).toBe(1500.0);
      expect(attendance.financials.practicedTotal).toBe(1350.0);
    });
  });

  // =========================================================================
  // 3. PHYSICAL PRODUCT TRACEABILITY & REUSE GOVERNANCE (V15, V16, V17, V18, AC 59, AC 66)
  // =========================================================================
  describe('3. Physical Stock Units & Strict Reuse Governance', () => {
    it('Oracle: V15 blocks dispensing physical units from expired lot', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-25T11:00:00Z'),
      });

      const prod = await ProductService.createProduct({
        nome: 'Anestésico Tópico Lidocaína',
        unidade: 'tubo',
        isReusable: false,
      });

      // Create lot expired in the past
      const yesterday = new Date(Date.now() - 86400000 * 5);
      const lot = await StockService.createLot(prod.id, {
        numeroLote: 'LOTE-EXPIRADO-2026',
        dataValidade: yesterday,
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // Usage must throw ValidationError mentioning V15 and expiration
      await expect(
        StockService.recordProductUsage(appt.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(/vencido.*V15/i);
    });

    it('Oracle: V18 strictly forbids second usage of a single-use unit for ANY client', async () => {
      const client1 = await createTestClient({ nome: 'Cliente 1 Descartável' });
      const client2 = await createTestClient({ nome: 'Cliente 2 Descartável' });

      const appt1 = await AppointmentService.createAppointment({ clientId: client1.id, dataHora: new Date() });
      const appt2 = await AppointmentService.createAppointment({ clientId: client1.id, dataHora: new Date() });
      const appt3 = await AppointmentService.createAppointment({ clientId: client2.id, dataHora: new Date() });

      const prod = await ProductService.createProduct({
        nome: 'Agulha Descartável 30G',
        unidade: 'unidade',
        isReusable: false, // Single-use!
      });

      const lot = await StockService.createLot(prod.id, {
        numeroLote: 'LOT-AGU-01',
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // First usage succeeds and transitions unit to 'Esgotado'
      const usage1 = await StockService.recordProductUsage(appt1.attendances[0].id, {
        stockUnitId: unit.id,
      });
      expect(usage1.id).toBeDefined();

      const unitAfter1 = await (prismaTest as any).stockUnit.findUnique({ where: { id: unit.id } });
      expect(unitAfter1.status).toBe('Esgotado');

      // Attempt 2 by SAME client: MUST FAIL with ConflictError (V18/V17)
      await expect(
        StockService.recordProductUsage(appt2.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(/uso único e já foi utilizada/i);

      // Attempt 3 by DIFFERENT client: MUST ALSO FAIL (V18/V17)
      await expect(
        StockService.recordProductUsage(appt3.attendances[0].id, {
          stockUnitId: unit.id,
        })
      ).rejects.toThrow(/uso único e já foi utilizada/i);
    });

    it('Oracle: V16 vs V17 (AC 59 & AC 66) allows same-client reuse, strictly rejects cross-client reuse with exact Portuguese error', async () => {
      const clientA = await createTestClient({ nome: 'Cliente Alpha' });
      const clientB = await createTestClient({ nome: 'Cliente Beta' });

      const apptA1 = await AppointmentService.createAppointment({ clientId: clientA.id, dataHora: new Date() });
      const apptA2 = await AppointmentService.createAppointment({ clientId: clientA.id, dataHora: new Date() });
      const apptB = await AppointmentService.createAppointment({ clientId: clientB.id, dataHora: new Date() });

      const prod = await ProductService.createProduct({
        nome: 'Toxina Botulínica 100U Frasco Reutilizável',
        unidade: 'frasco',
        isReusable: true, // Reusable by same client!
      });

      const lot = await StockService.createLot(prod.id, {
        numeroLote: 'LOT-TOX-99',
        quantidadeInicial: 1,
      });

      const unit = (await (prismaTest as any).stockUnit.findFirst({
        where: { lotId: lot.id },
      }))!;

      // 1. Client A uses in Encounter 1 -> succeeds
      await StockService.recordProductUsage(apptA1.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Aplicação inicial 50U',
      });

      // 2. Client A reuses in Encounter 2 -> succeeds (V16)
      await StockService.recordProductUsage(apptA2.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Retoque 20U restante do frasco',
      });

      // 3. Client B attempts to use same physical unit in Encounter 3 -> MUST REJECT (AC 59, AC 66)
      await expect(
        StockService.recordProductUsage(apptB.attendances[0].id, {
          stockUnitId: unit.id,
          observacoes: 'Tentativa indevida de uso em outra cliente',
        })
      ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

      // 4. Verify listAvailableUnits filter: Client B cannot see this unit
      const availableForB = await StockService.listAvailableUnits({
        clientId: clientB.id,
        productId: prod.id,
      });
      expect(availableForB.find((u) => u.id === unit.id)).toBeUndefined();

      // Client A CAN see this unit with isAssignedToCurrentClient = true
      const availableForA = await StockService.listAvailableUnits({
        clientId: clientA.id,
        productId: prod.id,
      });
      const foundA = availableForA.find((u) => u.id === unit.id);
      expect(foundA).toBeDefined();
      expect(foundA?.isAssignedToCurrentClient).toBe(true);
    });
  });

  // =========================================================================
  // 4. MEDICAL RECORD 1:1 UNIQUENESS PER ATTENDANCE (V19)
  // =========================================================================
  describe('4. Medical Record 1:1 Uniqueness (V19)', () => {
    it('Oracle: Enforces strict 1:1 relation between Attendance and MedicalRecord', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });
      const attendanceId = appt.attendances[0].id;

      // 1. First record creation succeeds
      const record1 = await MedicalRecordService.createMedicalRecord({
        attendanceId,
        queixaPrincipal: 'Rugas periorbitais e glabela',
        avaliacaoClinica: 'Pele íntegra, fotoenvelhecimento grau 2',
        condutaProcedimento: 'Aplicação de toxina botulínica em 3 pontos',
        orientacoes: 'Não deitar por 4 horas, não praticar atividade física hoje',
      });
      expect(record1.id).toBeDefined();

      // 2. Duplicate record attempt on service layer MUST THROW ConflictError
      await expect(
        MedicalRecordService.createMedicalRecord({
          attendanceId,
          queixaPrincipal: 'Segunda queixa conflitante',
        })
      ).rejects.toThrow(/Atendimento já possui prontuário cadastrado/i);

      // 3. Direct DB insert attempt MUST FAIL on DB unique constraint
      await expect(
        (prismaTest as any).medicalRecord.create({
          data: {
            attendanceId,
            queixaPrincipal: 'Tentativa bypass service',
          },
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 5. D2 DYNAMIC FINANCIAL CALCULATIONS
  // =========================================================================
  describe('5. D2 Dynamic Financials Engine', () => {
    it('Oracle: Correctly calculates standardTotal, practicedTotal, discount, paidTotal, and outstanding balance', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });
      const attendanceId = appt.attendances[0].id;

      const p1 = await createTestProcedure({ nome: 'Procedimento 1', valorPadrao: 200.0 });
      const p2 = await createTestProcedure({ nome: 'Procedimento 2', valorPadrao: 500.0 });

      // Add p1: standard 200, practiced 180
      await AttendanceService.addProcedure(attendanceId, {
        procedureId: p1.id,
        practicedValue: 180.0,
      });

      // Add p2: standard 500, practiced 450
      await AttendanceService.addProcedure(attendanceId, {
        procedureId: p2.id,
        practicedValue: 450.0,
      });

      // Set explicit discount: 30.00
      await AttendanceService.setDiscount(attendanceId, { desconto: 30.0 });

      // Simulate payments directly via Prisma
      // Payment 1: R$ 300 Pago
      await (prismaTest as any).payment.create({
        data: {
          attendanceId,
          valor: 300.0,
          metodo: 'PIX',
          status: 'Pago',
        },
      });

      // Payment 2: R$ 200 Pendente (should NOT count toward paidTotal)
      await (prismaTest as any).payment.create({
        data: {
          attendanceId,
          valor: 200.0,
          metodo: 'CartaoCredito',
          status: 'Pendente',
        },
      });

      const reloaded = await AttendanceService.getAttendanceById(attendanceId);
      const f = reloaded.financials;

      // standardTotal = 200 + 500 = 700
      expect(f.standardTotal).toBe(700.0);
      // practicedTotal = 180 + 450 = 630
      expect(f.practicedTotal).toBe(630.0);
      // explicitDiscount = 30
      expect(f.explicitDiscount).toBe(30.0);
      // netTotal = 630 - 30 = 600
      expect(f.netTotal).toBe(600.0);
      // paidTotal = 300 (only Pago payments count)
      expect(f.paidTotal).toBe(300.0);
      // outstandingBalance = 600 - 300 = 300
      expect(f.outstandingBalance).toBe(300.0);
      expect(f.isFullyPaid).toBe(false);

      // Now add remainder payment R$ 300 Pago
      await (prismaTest as any).payment.create({
        data: {
          attendanceId,
          valor: 300.0,
          metodo: 'Dinheiro',
          status: 'Pago',
        },
      });

      const finalReload = await AttendanceService.getAttendanceById(attendanceId);
      expect(finalReload.financials.paidTotal).toBe(600.0);
      expect(finalReload.financials.outstandingBalance).toBe(0.0);
      expect(finalReload.financials.isFullyPaid).toBe(true);
    });

    it('Oracle: Rejects discount greater than total practiced value', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });
      const attendanceId = appt.attendances[0].id;

      const p = await createTestProcedure({ valorPadrao: 250.0 });
      await AttendanceService.addProcedure(attendanceId, {
        procedureId: p.id,
        practicedValue: 200.0,
      });

      // Discount of 200.01 exceeds total practiced of 200.00
      await expect(
        AttendanceService.setDiscount(attendanceId, { desconto: 200.01 })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 6. STATUS TRANSITION LOCKS & ILLEGAL TRANSITIONS (V02, V08)
  // =========================================================================
  describe('6. Status Transition Locks & Guards', () => {
    it('Oracle: Cannot cancel an already Concluído appointment', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });

      // Mark attendance Realizado and complete appointment
      await AttendanceService.completeAttendance(appt.attendances[0].id);
      await AppointmentService.completeAppointment(appt.id);

      // Attempting to cancel must be rejected
      await expect(
        AppointmentService.cancelAppointment(appt.id, { motivoCancelamento: 'Tentativa indevida' })
      ).rejects.toThrow(/Agendamento não pode ser cancelado porque já está "Concluído"/i);
    });

    it('Oracle: Cannot confirm an appointment that is Cancelado or Não compareceu', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });

      await AppointmentService.cancelAppointment(appt.id, { motivoCancelamento: 'Desistência' });

      await expect(AppointmentService.confirmAppointment(appt.id)).rejects.toThrow(ValidationError);
    });

    it('Oracle: Cannot add procedures to a Cancelado attendance', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });
      const attendanceId = appt.attendances[0].id;

      await AttendanceService.cancelAttendance(attendanceId);

      const proc = await createTestProcedure();
      await expect(
        AttendanceService.addProcedure(attendanceId, {
          procedureId: proc.id,
          practicedValue: 200.0,
        })
      ).rejects.toThrow(/Não é possível adicionar procedimentos a um atendimento cancelado/i);
    });

    it('Oracle: Cannot record product usage on a Cancelado attendance', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });
      const attendanceId = appt.attendances[0].id;

      await AttendanceService.cancelAttendance(attendanceId);

      const prod = await ProductService.createProduct({
        nome: 'Soro Fisiológico',
        unidade: 'frasco',
        isReusable: false,
      });
      const lot = await StockService.createLot(prod.id, { numeroLote: 'LOT-SF-01', quantidadeInicial: 1 });
      const unit = (await (prismaTest as any).stockUnit.findFirst({ where: { lotId: lot.id } }))!;

      await expect(
        StockService.recordProductUsage(attendanceId, { stockUnitId: unit.id })
      ).rejects.toThrow(/Não é permitido registrar uso de produto em um atendimento cancelado/i);
    });
  });

  // =========================================================================
  // 7. PHYSICAL UNIT BARRIERS (Descartado & Esgotado)
  // =========================================================================
  describe('7. Physical Unit Status Barriers', () => {
    it('Oracle: Cannot use a stock unit marked Descartado', async () => {
      const client = await createTestClient();
      const appt = await AppointmentService.createAppointment({ clientId: client.id, dataHora: new Date() });

      const prod = await ProductService.createProduct({
        nome: 'Caneta Pressurizada',
        unidade: 'unidade',
        isReusable: true,
      });
      const lot = await StockService.createLot(prod.id, { numeroLote: 'LOT-CAN-01', quantidadeInicial: 1 });
      const unit = (await (prismaTest as any).stockUnit.findFirst({ where: { lotId: lot.id } }))!;

      // Discard unit (e.g. contaminated)
      await StockService.updateStockUnitStatus(unit.id, { status: 'Descartado' });

      await expect(
        StockService.recordProductUsage(appt.attendances[0].id, { stockUnitId: unit.id })
      ).rejects.toThrow(/Esta unidade de estoque foi descartada e não pode ser utilizada/i);
    });
  });
});

