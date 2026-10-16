import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { MedicalRecordService } from '@/services/medical-record.service';
import { ClientService } from '@/services/client.service';
import { ConflictError, ValidationError } from '@/lib/errors';

describe('Tier 3 Combination: Milestone 3 Clinical Workflow End-to-End (Phases 6, 7, 9, 10, AC 65, AC 66)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('executes the full clinical encounter lifecycle across appointments, attendances, procedures, inventory, prontuário and history', async () => {
    // 1. Create primary client (Client A) with CPF and emergency contact
    const clientA = await createTestClient({
      nome: 'Camila Pitanga',
      emergencyContacts: [
        { nome: 'Marcos Pitanga', telefone: '11999991111', parentesco: 'Irmão' },
      ],
    });
    expect(clientA.id).toBeDefined();

    // Create client B for cross-client boundary tests
    const clientB = await createTestClient({
      nome: 'Juliana Paes',
    });

    // 2. Setup Procedure Catalog items
    const procBotox = await createTestProcedure({
      nome: 'Toxina Botulínica 3 Regiões',
      valorPadrao: 900.0,
      duracaoMinutos: 45,
    });
    const procPreenchimento = await createTestProcedure({
      nome: 'Preenchimento Labial',
      valorPadrao: 1100.0,
      duracaoMinutos: 60,
    });

    // 3. Setup Product Catalog and Stock Units
    // 3a. Single-use product (e.g. needle/anesthetic)
    const prodSingle = await ProductService.createProduct({
      nome: 'Agulha Descartável 30G',
      unidade: 'unidade',
      isReusable: false,
    });
    const lotSingle = await StockService.createLot(prodSingle.id, {
      numeroLote: 'AG-LOTE-2026',
      quantidadeInicial: 2,
    });
    const singleUnit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lotSingle.id },
    }))!;

    // 3b. Reusable product (e.g. 1ml hyaluronic acid syringe)
    const prodReusable = await ProductService.createProduct({
      nome: 'Ácido Hialurônico 1ml Reutilizável',
      unidade: 'seringa',
      isReusable: true,
    });
    const lotReusable = await StockService.createLot(prodReusable.id, {
      numeroLote: 'AH-LOTE-2026',
      quantidadeInicial: 2,
    });
    const reusableUnit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lotReusable.id },
    }))!;

    // 4. Create Appointment with Planned Procedures (D3) -> Auto-creates Pendente Attendance (D1, V07)
    const apptDate = new Date(Date.now() + 86400000);
    const appt1 = await AppointmentService.createAppointment({
      clientId: clientA.id,
      dataHora: apptDate,
      plannedProcedureIds: [procBotox.id, procPreenchimento.id],
      observacoes: 'Procedimentos combinados para rejuvenescimento',
    });

    expect(appt1.status).toBe('Agendado');
    expect(Number(appt1.valorEstimado)).toBe(2000.0); // 900 + 1100
    expect(appt1.attendances).toHaveLength(1);
    expect(appt1.attendances[0].status).toBe('Pendente');

    const attendanceId1 = appt1.attendances[0].id;

    // 5. Confirm Appointment
    const confirmedAppt = await AppointmentService.confirmAppointment(appt1.id);
    expect(confirmedAppt.status).toBe('Confirmado');

    // 6. Clinical Encounter Begins: Add practiced procedures to Attendance
    // Procedure 1: Botox with practiced value 850 (discounted from 900 standard, no auto discount)
    const procAssoc1 = await AttendanceService.addProcedure(attendanceId1, {
      procedureId: procBotox.id,
      practicedValue: 850.0,
      observacoes: 'Aplicação em testa, glabela e pés de galinha',
    });
    expect(Number(procAssoc1.standardValueSnapshot)).toBe(900.0);
    expect(Number(procAssoc1.practicedValue)).toBe(850.0);

    // Procedure 2: Preenchimento with practiced value 1050 (discounted from 1100 standard)
    const procAssoc2 = await AttendanceService.addProcedure(attendanceId1, {
      procedureId: procPreenchimento.id,
      practicedValue: 1050.0,
      observacoes: 'Preenchimento labial com técnica em leque',
    });
    expect(Number(procAssoc2.standardValueSnapshot)).toBe(1100.0);
    expect(Number(procAssoc2.practicedValue)).toBe(1050.0);

    // 7. Apply explicit attendance discount of R$ 100 (D2)
    const updatedAtt = await AttendanceService.setDiscount(attendanceId1, {
      desconto: 100.0,
    });
    expect(Number(updatedAtt.desconto)).toBe(100.0);

    const attFinancials = await AttendanceService.getAttendanceById(attendanceId1);
    // standardTotal: 900 + 1100 = 2000
    // practicedTotal: 850 + 1050 = 1900
    // explicitDiscount: 100
    // netTotal: 1800
    expect(attFinancials.financials.standardTotal).toBe(2000.0);
    expect(attFinancials.financials.practicedTotal).toBe(1900.0);
    expect(attFinancials.financials.explicitDiscount).toBe(100.0);
    expect(attFinancials.financials.netTotal).toBe(1800.0);

    // 8. Record Product Usages
    // 8a. Single-use unit
    const usageSingle = await StockService.recordProductUsage(attendanceId1, {
      stockUnitId: singleUnit.id,
      attendanceProcedureId: procAssoc1.id,
      observacoes: 'Agulha descartável utilizada na aplicação',
    });
    expect(usageSingle.id).toBeDefined();

    // 8b. Reusable unit
    const usageReusable1 = await StockService.recordProductUsage(attendanceId1, {
      stockUnitId: reusableUnit.id,
      attendanceProcedureId: procAssoc2.id,
      observacoes: '0.6ml aplicados em lábios. 0.4ml restantes na seringa para retoque',
    });
    expect(usageReusable1.id).toBeDefined();

    // 9. Document Clinical Encounter in Medical Record (V19)
    const medicalRecord = await MedicalRecordService.createMedicalRecord({
      attendanceId: attendanceId1,
      queixaPrincipal: 'Incomodo com linhas de expressão e perda de volume labial',
      avaliacaoClinica: 'Pele íntegra, linhas hipercinéticas moderadas no terço superior',
      condutaProcedimento: 'Realizada antissepsia rigorosa. Aplicadas 45U de toxina e 0.6ml de AH',
      orientacoes: 'Evitar exposição solar e calor intenso nas primeiras 48h. Retorno em 15 dias.',
      observacoes: 'Paciente tolerou bem os procedimentos sem intercorrências',
    });
    expect(medicalRecord.id).toBeDefined();
    expect(medicalRecord.attendanceId).toBe(attendanceId1);

    // Attempting duplicate medical record must be rejected (V19)
    await expect(
      MedicalRecordService.createMedicalRecord({
        attendanceId: attendanceId1,
        queixaPrincipal: 'Segunda tentativa',
      })
    ).rejects.toThrow(ConflictError);

    // 10. Attempting to conclude Appointment BEFORE marking Attendance Realizado must be blocked (V08)
    await expect(AppointmentService.completeAppointment(appt1.id)).rejects.toThrow(ValidationError);

    // 11. Manually mark Attendance as Realizado (D1)
    const completedAtt = await AttendanceService.completeAttendance(attendanceId1);
    expect(completedAtt.status).toBe('Realizado');
    expect(completedAtt.completedAt).toBeInstanceOf(Date);

    // 12. Conclude Appointment now succeeds (V08)
    const completedAppt = await AppointmentService.completeAppointment(appt1.id);
    expect(completedAppt.status).toBe('Concluído');

    // 13. Test Boundary: Cross-client reuse of reusable unit on Client B MUST FAIL (V17, AC 59, AC 66)
    const apptB = await createTestAppointment(clientB.id);
    await expect(
      StockService.recordProductUsage(apptB.attendances[0].id, {
        stockUnitId: reusableUnit.id,
      })
    ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

    // 14. Test Boundary: Second use of single-use unit on Client A MUST FAIL (V18, AC 59)
    const apptA2 = await createTestAppointment(clientA.id);
    await expect(
      StockService.recordProductUsage(apptA2.attendances[0].id, {
        stockUnitId: singleUnit.id,
      })
    ).rejects.toThrow();

    // 15. Same-client reuse of reusable unit in second appointment of Client A MUST SUCCEED (V16)
    const usageReusable2 = await StockService.recordProductUsage(apptA2.attendances[0].id, {
      stockUnitId: reusableUnit.id,
      observacoes: 'Retoque de 0.4ml restantes',
    });
    expect(usageReusable2.id).toBeDefined();

    // 16. Verify Consolidated Client History Timeline (§41)
    const clientHistory = await ClientService.getClientWithHistory(clientA.id);
    expect(clientHistory.attendances).toHaveLength(2);
    expect(clientHistory.appointments).toHaveLength(2);

    const firstAttHistory = clientHistory.attendances.find((a) => a.id === attendanceId1)!;
    expect(firstAttHistory.status).toBe('Realizado');
    expect(firstAttHistory.procedures).toHaveLength(2);
    expect(firstAttHistory.productUsages).toHaveLength(2);
    expect(firstAttHistory.medicalRecord).not.toBeNull();
    expect(firstAttHistory.medicalRecord?.queixaPrincipal).toContain('Incomodo com linhas de expressão');
  });
});
