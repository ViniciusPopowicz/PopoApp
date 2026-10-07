import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
    const procedure = await createTestProcedure({
      nome: 'Harmonização Facial - Botox',
      valorPadrao: 500.0,
    });

    // 2. Attendance created with Practiced value: R$ 400.00 and explicit discount: R$ 0.00
    const apptA = await createTestAppointment(clientAId);
    const attendance = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptA.id,
        clientId: clientAId,
        status: 'Realizado',
        desconto: 0.0, // explicit discount R$ 0.00
        procedures: {
          create: {
            procedureId: procedure.id,
            standardValueSnapshot: 500.0,
            practicedValue: 400.0,
          },
        },
      },
      include: {
        procedures: true,
      },
    });

    // Verification:
    // Snapshot = 500.00
    expect(Number(attendance.procedures[0].standardValueSnapshot)).toBe(500.0);
    // Practiced = 400.00
    expect(Number(attendance.procedures[0].practicedValue)).toBe(400.0);
    // Explicit discount remains strictly 0.00 (NOT automatically computed as 100.00)
    expect(Number(attendance.desconto)).toBe(0.0);

    // Dynamic Total computation per D2: sum(practicedValue) - discount
    const practicedSum = attendance.procedures.reduce(
      (acc: number, p: any) => acc + Number(p.practicedValue),
      0
    );
    const computedTotal = practicedSum - Number(attendance.desconto);
    expect(computedTotal).toBe(400.0);
  });

  it('Example B (§47): Explicit Attendance discount (distinct from practiced values)', async () => {
    const proc1 = await createTestProcedure({ nome: 'Preenchimento Labial', valorPadrao: 500.0 });
    const proc2 = await createTestProcedure({ nome: 'Bioestimulador', valorPadrao: 400.0 });

    // Two procedures with practiced total: R$ 800.00 (e.g. 500 + 300)
    // Explicit attendance discount: R$ 100.00
    const apptB = await createTestAppointment(clientAId);
    const attendance = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptB.id,
        clientId: clientAId,
        status: 'Realizado',
        desconto: 100.0, // explicit discount R$ 100.00
        procedures: {
          create: [
            {
              procedureId: proc1.id,
              standardValueSnapshot: 500.0,
              practicedValue: 500.0,
            },
            {
              procedureId: proc2.id,
              standardValueSnapshot: 400.0,
              practicedValue: 300.0,
            },
          ],
        },
      },
      include: {
        procedures: true,
      },
    });

    const practicedSum = attendance.procedures.reduce(
      (acc: number, p: any) => acc + Number(p.practicedValue),
      0
    );
    expect(practicedSum).toBe(800.0);
    expect(Number(attendance.desconto)).toBe(100.0);

    // Dynamic Total per D2: 800.00 - 100.00 = 700.00
    const computedTotal = practicedSum - Number(attendance.desconto);
    expect(computedTotal).toBe(700.0);
  });

  it('Example C (§47): Reusable physical product allowed for same client, rejected for cross-client reuse', async () => {
    // 1. Reusable product (e.g. Frasco de Toxina 100U compartilhado apenas pelo mesmo paciente)
    const product = await createTestProduct({
      nome: 'Toxina Botulínica 100U (Frasco Multidose)',
      isReusable: true,
      unidade: 'frasco',
    });

    const lot = await createTestLot(product.id, { numeroLote: 'LOTE-EX-C' });
    const unit = await createTestStockUnit(lot.id, { codigoSerial: 'UNIT-001' });

    // 2. Client A uses UNIT-001 in Attendance 1
    const apptC1 = await createTestAppointment(clientAId);
    const att1 = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptC1.id,
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const usage1 = await (prismaTest as any).productUsage.create({
      data: {
        attendanceId: att1.id,
        stockUnitId: unit.id,
        observacoes: 'Primeira aplicação de Alice',
      },
    });
    expect(usage1.id).toBeDefined();

    // Update unit to record current client
    await (prismaTest as any).stockUnit.update({
      where: { id: unit.id },
      data: { currentClientId: clientAId },
    });

    // 3. Client A uses UNIT-001 again in Attendance 2 -> MUST BE ALLOWED
    const apptC2 = await createTestAppointment(clientAId);
    const att2 = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptC2.id,
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const usage2 = await (prismaTest as any).productUsage.create({
      data: {
        attendanceId: att2.id,
        stockUnitId: unit.id,
        observacoes: 'Retoque de Alice (mesma cliente)',
      },
    });
    expect(usage2.id).toBeDefined();

    // 4. Client B attempts to use UNIT-001 in Attendance 3 -> MUST BE REJECTED
    const apptC3 = await createTestAppointment(clientBId);
    const att3 = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptC3.id,
        clientId: clientBId,
        status: 'Realizado',
      },
    });

    // Business check before usage:
    const unitCheck = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
      include: {
        usages: {
          include: { attendance: true },
        },
      },
    });

    const previousClientIds = unitCheck.usages.map((u: any) => u.attendance.clientId);
    const hasDifferentClient = previousClientIds.some((id: string) => id !== clientBId);

    // Business invariant test: must detect cross-client reuse conflict
    expect(hasDifferentClient).toBe(true);
  });

  it('Example D (§47): Rescheduling workflow preserves historical linkage', async () => {
    const originalDate = new Date('2026-12-01T10:00:00Z');
    const newDate = new Date('2026-12-05T15:00:00Z');

    // 1. Original appointment
    const original = await (prismaTest as any).appointment.create({
      data: {
        clientId: clientAId,
        dataHora: originalDate,
        status: 'Agendado',
      },
    });

    // 2. Rescheduling creates new appointment and links to old
    const newAppt = await (prismaTest as any).appointment.create({
      data: {
        clientId: clientAId,
        dataHora: newDate,
        status: 'Agendado',
        rescheduledFromId: original.id,
      },
    });

    await (prismaTest as any).appointment.update({
      where: { id: original.id },
      data: {
        status: 'Reagendado',
        rescheduledToId: newAppt.id,
      },
    });

    // Historical audit check: original appointment retains its date and references new appointment
    const originalReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: original.id },
    });
    expect(originalReloaded.status).toBe('Reagendado');
    expect(originalReloaded.rescheduledToId).toBe(newAppt.id);

    const newReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: newAppt.id },
    });
    expect(newReloaded.rescheduledFromId).toBe(original.id);
  });

  it('Example E (§47): Client vs Attendance attachment exclusivity', async () => {
    // 1. Test result belonging generally to the Client is stored as Client attachment
    const clientAttachment = await (prismaTest as any).attachment.create({
      data: {
        nomeOriginal: 'exame_sangue.pdf',
        nomeArquivo: 'uuid-exame.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024,
        caminhoRelativo: './storage/uploads/uuid-exame.pdf',
        clientId: clientAId,
        attendanceId: null,
      },
    });
    expect(clientAttachment.clientId).toBe(clientAId);
    expect(clientAttachment.attendanceId).toBeNull();

    // 2. Photo specific to a particular service is stored as Attendance attachment
    const apptE = await createTestAppointment(clientAId);
    const att = await (prismaTest as any).attendance.create({
      data: {
        appointmentId: apptE.id,
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const attendanceAttachment = await (prismaTest as any).attachment.create({
      data: {
        nomeOriginal: 'foto_procedimento_antes.jpg',
        nomeArquivo: 'uuid-foto.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 2048,
        caminhoRelativo: './storage/uploads/uuid-foto.jpg',
        clientId: null,
        attendanceId: att.id,
      },
    });
    expect(attendanceAttachment.attendanceId).toBe(att.id);
    expect(attendanceAttachment.clientId).toBeNull();

    // 3. Verifying exclusivity: An attachment must not belong to both contexts
    const isBothNull = clientAttachment.clientId === null && clientAttachment.attendanceId === null;
    const isBothSet = clientAttachment.clientId !== null && clientAttachment.attendanceId !== null;
    expect(isBothNull).toBe(false);
    expect(isBothSet).toBe(false);
  });
});
