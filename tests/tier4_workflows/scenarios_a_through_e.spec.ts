import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestProcedure,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
} from '../helpers/test-fixtures';
import { ProcedureService } from '@/services/procedure.service';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { StockService } from '@/services/stock.service';
import { PaymentService } from '@/services/payment.service';
import { ValidationError, ConflictError } from '@/lib/errors';

describe('Tier 4: Clinical Workflows & Data Integrity Examples (§47 Scenarios A–E)', () => {
  let clientAId: string;
  let clientBId: string;

  beforeAll(async () => {
    await cleanTestDatabase();

    const clientA = await createTestClient({ nome: 'Paciente Alice' });
    clientAId = clientA.id;

    const clientB = await createTestClient({ nome: 'Paciente Bruno' });
    clientBId = clientB.id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('Example A (§47): Procedure practiced below standard value (no automatic discount)', async () => {
    // 1. Catalog procedure with Standard value: R$ 500.00
    const procedure = await ProcedureService.createProcedure({
      nome: 'Harmonização Facial - Botox A',
      descricao: 'Procedimento de harmonização facial',
      valorPadrao: 500.0,
      duracaoMinutos: 45,
      categoria: 'Facial',
    });

    // 2. Create Appointment via domain service (auto-creates pending attendance)
    const appt = await AppointmentService.createAppointment({
      clientId: clientAId,
      dataHora: new Date(),
    });
    const attendanceId = appt.attendances[0].id;

    // 3. Record procedure with Practiced value: R$ 400.00 and explicit discount: R$ 0.00
    const procAssoc = await AttendanceService.addProcedure(attendanceId, {
      procedureId: procedure.id,
      practicedValue: 400.0,
      observacoes: 'Valor promocional acordado',
    });

    // Verify snapshot immutability and practiced value
    expect(Number(procAssoc.standardValueSnapshot)).toBe(500.0);
    expect(Number(procAssoc.practicedValue)).toBe(400.0);

    // Dynamic Total computation per D2 & AttendanceService: sum(practicedValue) - discount
    const attendance = await AttendanceService.getAttendanceById(attendanceId);
    expect(attendance.financials.standardTotal).toBe(500.0);
    expect(attendance.financials.practicedTotal).toBe(400.0);
    // Explicit discount remains strictly 0.00 (NOT automatically computed as 100.00)
    expect(attendance.financials.explicitDiscount).toBe(0.0);
    expect(attendance.financials.netTotal).toBe(400.0);
    expect(attendance.financials.outstandingBalance).toBe(400.0);
  });

  it('Example B (§47): Explicit Attendance discount (distinct from practiced values)', async () => {
    const proc1 = await createTestProcedure({ nome: 'Preenchimento Labial B', valorPadrao: 500.0 });
    const proc2 = await createTestProcedure({ nome: 'Bioestimulador B', valorPadrao: 400.0 });

    const appt = await AppointmentService.createAppointment({
      clientId: clientAId,
      dataHora: new Date(),
    });
    const attendanceId = appt.attendances[0].id;

    // Two procedures with practiced total: R$ 800.00 (500 + 300)
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc1.id, practicedValue: 500.0 });
    await AttendanceService.addProcedure(attendanceId, { procedureId: proc2.id, practicedValue: 300.0 });

    // Explicit attendance discount: R$ 100.00
    await AttendanceService.setDiscount(attendanceId, { desconto: 100.0 });

    const attendance = await AttendanceService.getAttendanceById(attendanceId);
    expect(attendance.financials.practicedTotal).toBe(800.0);
    expect(attendance.financials.explicitDiscount).toBe(100.0);
    // Dynamic Net Total per D2: 800.00 - 100.00 = 700.00
    expect(attendance.financials.netTotal).toBe(700.0);

    // Pay with multiple methods: R$ 300 Dinheiro + R$ 400 CartaoDebito
    await PaymentService.recordPayment(attendanceId, { valor: 300.0, metodo: 'Dinheiro' });
    const resPay = await PaymentService.recordPayment(attendanceId, { valor: 400.0, metodo: 'CartaoDebito' });

    expect(resPay.financials.paidTotal).toBe(700.0);
    expect(resPay.financials.outstandingBalance).toBe(0.0);
    expect(resPay.financials.isFullyPaid).toBe(true);
  });

  it('Example C (§47): Reusable physical product allowed for same client, rejected for cross-client reuse', async () => {
    // 1. Reusable product (Frasco Multidose)
    const product = await createTestProduct({
      nome: 'Toxina Botulínica 100U C (Frasco Multidose)',
      isReusable: true,
      unidade: 'frasco',
    });

    const lot = await createTestLot(product.id, { numeroLote: 'LOTE-EX-C2' });
    const unit = await createTestStockUnit(lot.id, { codigoSerial: 'UNIT-001-C' });

    // 2. Client A uses UNIT-001 in Attendance 1
    const appt1 = await AppointmentService.createAppointment({ clientId: clientAId, dataHora: new Date() });
    const att1Id = appt1.attendances[0].id;

    const usage1 = await StockService.recordProductUsage(att1Id, {
      stockUnitId: unit.id,
      observacoes: 'Primeira aplicação de Alice',
    });
    expect(usage1.id).toBeDefined();

    // 3. Client A uses UNIT-001 again in Attendance 2 -> MUST BE ALLOWED (same client)
    const appt2 = await AppointmentService.createAppointment({ clientId: clientAId, dataHora: new Date() });
    const att2Id = appt2.attendances[0].id;

    const usage2 = await StockService.recordProductUsage(att2Id, {
      stockUnitId: unit.id,
      observacoes: 'Retoque de Alice (mesma cliente)',
    });
    expect(usage2.id).toBeDefined();

    // 4. Client B attempts to use UNIT-001 in Attendance 3 -> MUST BE REJECTED via domain service with ValidationError
    const appt3 = await AppointmentService.createAppointment({ clientId: clientBId, dataHora: new Date() });
    const att3Id = appt3.attendances[0].id;

    await expect(
      StockService.recordProductUsage(att3Id, {
        stockUnitId: unit.id,
        observacoes: 'Tentativa indevida de uso cruzado por Bruno',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('Example D (§47): Rescheduling workflow preserves historical linkage', async () => {
    const originalDate = new Date('2026-12-01T10:00:00Z');
    const newDate = new Date('2026-12-05T15:00:00Z');

    // 1. Original appointment
    const original = await AppointmentService.createAppointment({
      clientId: clientAId,
      dataHora: originalDate,
    });
    const oldAttendanceId = original.attendances[0].id;

    // 2. Rescheduling via domain service
    const rescheduled = await AppointmentService.rescheduleAppointment(original.id, {
      novaDataHora: newDate,
      motivo: 'Solicitação da paciente por viagem',
    });

    // Check old appointment
    const originalReloaded = await AppointmentService.getAppointmentById(original.id);
    expect(originalReloaded.status).toBe('Reagendado');
    expect(originalReloaded.rescheduledToId).toBe(rescheduled.id);

    // Old attendance was cancelled (D1)
    const oldAttendance = await AttendanceService.getAttendanceById(oldAttendanceId);
    expect(oldAttendance.status).toBe('Cancelado');

    // Check new appointment
    const newReloaded = await AppointmentService.getAppointmentById(rescheduled.id);
    expect(newReloaded.status).toBe('Agendado');
    expect(newReloaded.rescheduledFromId).toBe(original.id);
    expect(newReloaded.attendances[0].status).toBe('Pendente');
  });

  it('Example E (§47): Client vs Attendance attachment exclusivity', async () => {
    // 1. Client attachment
    const clientAttachment = await prismaTest.attachment.create({
      data: {
        nomeOriginal: 'exame_sangue_alice.pdf',
        nomeArquivo: 'uuid-exame-alice.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024,
        caminhoRelativo: './storage/uploads/uuid-exame-alice.pdf',
        clientId: clientAId,
        attendanceId: null,
      },
    });
    expect(clientAttachment.clientId).toBe(clientAId);
    expect(clientAttachment.attendanceId).toBeNull();

    // 2. Attendance attachment
    const appt = await AppointmentService.createAppointment({ clientId: clientAId, dataHora: new Date() });
    const attendanceId = appt.attendances[0].id;

    const attendanceAttachment = await prismaTest.attachment.create({
      data: {
        nomeOriginal: 'foto_procedimento_antes.jpg',
        nomeArquivo: 'uuid-foto-antes.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 2048,
        caminhoRelativo: './storage/uploads/uuid-foto-antes.jpg',
        clientId: null,
        attendanceId: attendanceId,
      },
    });
    expect(attendanceAttachment.attendanceId).toBe(attendanceId);
    expect(attendanceAttachment.clientId).toBeNull();

    // 3. Database CHECK constraint CK_Attachment_Ownership rejects both or neither at database level
    await expect(
      prismaTest.attachment.create({
        data: {
          nomeOriginal: 'violacao_ambos.pdf',
          nomeArquivo: 'uuid-violacao-ambos.pdf',
          mimeType: 'application/pdf',
          tamanhoBytes: 1024,
          caminhoRelativo: './storage/uploads/uuid-violacao-ambos.pdf',
          clientId: clientAId,
          attendanceId: attendanceId, // Both set -> violates CK_Attachment_Ownership
        },
      })
    ).rejects.toThrow();

    await expect(
      prismaTest.attachment.create({
        data: {
          nomeOriginal: 'violacao_nenhum.pdf',
          nomeArquivo: 'uuid-violacao-nenhum.pdf',
          mimeType: 'application/pdf',
          tamanhoBytes: 1024,
          caminhoRelativo: './storage/uploads/uuid-violacao-nenhum.pdf',
          clientId: null,
          attendanceId: null, // Neither set -> violates CK_Attachment_Ownership
        },
      })
    ).rejects.toThrow();
  });
});
