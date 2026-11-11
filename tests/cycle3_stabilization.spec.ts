import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { cleanTestDatabase, closeTestDatabase } from './helpers/db-cleaner';
import { createTestClient, createTestProcedure } from './helpers/test-fixtures';
import { MedicalRecordService } from '@/services/medical-record.service';
import {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
} from '@/schemas/medical-record';
import {
  createLot,
  recordProductUsage,
  reverseProductUsage,
} from '@/services/stock.service';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ClientService } from '@/services/client.service';
import { ReminderService } from '@/services/reminder.service';
import { groupRemindersByKanbanColumn } from '@/schemas/reminder';
import {
  calculateEstimatedDurationMinutes,
  formatDurationMinutes,
} from '@/lib/format';
import { ValidationError } from '@/lib/errors';

describe('PopoApp — 3º Ciclo de Estabilização do MVP (Cycle 3 Stabilization)', () => {
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
  // BUG-010: Medical Record — Adverse Reactions / Intercurrences Persistence
  // =========================================================================
  describe('BUG-010: Medical Record Adverse Reactions & Intercurrences Persistence and Retrieval', () => {
    it('persists, retrieves, preserves across partial updates, and clears "Intercorrências ou Reações Adversas"', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      // 1. Create record via schema + service as the API route does
      const createPayload = createMedicalRecordSchema.parse({
        attendanceId: attendance.id,
        anamnese: 'Paciente relata sensibilidade cutânea.',
        evolucaoClinica: 'Aplicação tópica realizada sem sangramento.',
        orientacoesPosProcedimento: 'Aplicar compressa fria 2x ao dia.',
        intercorrencias: 'Eritema leve transitório na região zigomática direita.',
      });

      const created = await MedicalRecordService.createMedicalRecord(createPayload);
      expect(created.intercorrencias).toBe(
        'Eritema leve transitório na região zigomática direita.'
      );
      expect(created.observacoes).toContain(
        '[Intercorrências]: Eritema leve transitório na região zigomática direita.'
      );

      // 2. Retrieve record via actual retrieval flow (GET /api/attendances/[id]/record -> getByAttendanceId)
      const fetched = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(fetched.intercorrencias).toBe(
        'Eritema leve transitório na região zigomática direita.'
      );
      expect(fetched.anamnese).toBe('Paciente relata sensibilidade cutânea.');
      expect(fetched.evolucaoClinica).toBe('Aplicação tópica realizada sem sangramento.');

      // 3. Updating another field must NOT erase or overwrite intercorrencias
      const partialUpdate = updateMedicalRecordSchema.parse({
        orientacoesPosProcedimento: 'Usar FPS 50 e evitar exposição solar por 7 dias.',
      });
      await MedicalRecordService.updateByAttendanceId(attendance.id, partialUpdate);

      const afterPartial = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterPartial.orientacoesPosProcedimento).toBe(
        'Usar FPS 50 e evitar exposição solar por 7 dias.'
      );
      expect(afterPartial.intercorrencias).toBe(
        'Eritema leve transitório na região zigomática direita.'
      );

      // 4. Clearing intercorrencias (empty string "") persists null without affecting other fields
      const clearIntercorrencias = updateMedicalRecordSchema.parse({
        anamnese: 'Paciente relata sensibilidade cutânea.',
        evolucaoClinica: 'Aplicação tópica realizada sem sangramento.',
        orientacoesPosProcedimento: 'Usar FPS 50 e evitar exposição solar por 7 dias.',
        intercorrencias: '',
      });
      await MedicalRecordService.updateByAttendanceId(attendance.id, clearIntercorrencias);

      const afterClear = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterClear.intercorrencias).toBeNull();
      expect(afterClear.anamnese).toBe('Paciente relata sensibilidade cutânea.');
      expect(afterClear.evolucaoClinica).toBe('Aplicação tópica realizada sem sangramento.');
      expect(afterClear.orientacoesPosProcedimento).toBe(
        'Usar FPS 50 e evitar exposição solar por 7 dias.'
      );
    });

    it('preserves base observacoes when updating intercorrencias alone, and preserves intercorrencias when updating observacoes alone; also enriches AttendanceService and ClientService responses', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      await MedicalRecordService.createMedicalRecord(
        createMedicalRecordSchema.parse({
          attendanceId: attendance.id,
          anamnese: 'Queixa inicial de manchas solares.',
          evolucaoClinica: 'Peeling químico superficial realizado.',
          observacoes: 'Observação base inicial do atendimento.',
          intercorrencias: 'Ardência moderada controlada com ventilação.',
        })
      );

      // Update ONLY intercorrencias via updateMedicalRecordSchema -> base observacoes must be preserved
      await MedicalRecordService.updateByAttendanceId(
        attendance.id,
        updateMedicalRecordSchema.parse({
          intercorrencias: 'Descamação leve no 2º dia.',
        })
      );

      const afterInterUpdate = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterInterUpdate.intercorrencias).toBe('Descamação leve no 2º dia.');
      expect(afterInterUpdate.observacoesLimpa).toBe('Observação base inicial do atendimento.');

      // Update ONLY observacoes via updateMedicalRecordSchema -> intercorrencias must be preserved
      await MedicalRecordService.updateByAttendanceId(
        attendance.id,
        updateMedicalRecordSchema.parse({
          observacoes: 'Observação base atualizada.',
        })
      );

      const afterObsUpdate = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterObsUpdate.observacoesLimpa).toBe('Observação base atualizada.');
      expect(afterObsUpdate.intercorrencias).toBe('Descamação leve no 2º dia.');

      // Verify AttendanceService.getAttendanceById and ClientService.getClientWithHistory return enriched medicalRecord
      const fullAtt = await AttendanceService.getAttendanceById(attendance.id);
      expect(fullAtt.medicalRecord?.anamnese).toBe('Queixa inicial de manchas solares.');
      expect(fullAtt.medicalRecord?.evolucaoClinica).toBe('Peeling químico superficial realizado.');
      expect(fullAtt.medicalRecord?.intercorrencias).toBe('Descamação leve no 2º dia.');
      expect(fullAtt.medicalRecord?.observacoesLimpa).toBe('Observação base atualizada.');

      const clientHistory = await ClientService.getClientWithHistory(client.id);
      const clientAtt = clientHistory.attendances.find((a) => a.id === attendance.id);
      expect(clientAtt?.medicalRecord?.anamnese).toBe('Queixa inicial de manchas solares.');
      expect(clientAtt?.medicalRecord?.evolucaoClinica).toBe(
        'Peeling químico superficial realizado.'
      );
      expect(clientAtt?.medicalRecord?.intercorrencias).toBe('Descamação leve no 2º dia.');
      expect(clientAtt?.medicalRecord?.observacoesLimpa).toBe('Observação base atualizada.');
    });
  });

  // =========================================================================
  // BUG-011: Medical Record — Anamnesis vs. Clinical Evolution Field Mapping
  // =========================================================================
  describe('BUG-011: Medical Record Independent Mapping for Anamnesis and Clinical Evolution', () => {
    it('keeps "Anamnese / Queixa Principal" and "Evolução Clínica e Conduta" strictly independent on save, reload, and update', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      const anamneseText = 'ANAMNESE_UNICA_011: Queixa principal de linhas de expressão na glabela.';
      const evolucaoText = 'EVOLUCAO_UNICA_011: Assepsia com clorexidina e aplicação de 25U em 5 pontos.';

      // 1. Save distinct identifiable strings in both fields
      const parsedCreate = createMedicalRecordSchema.parse({
        attendanceId: attendance.id,
        anamnese: anamneseText,
        evolucaoClinica: evolucaoText,
      });
      await MedicalRecordService.createMedicalRecord(parsedCreate);

      // 2. Retrieve and verify no field swapping or overwriting occurred
      const retrieved = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(retrieved.anamnese).toBe(anamneseText);
      expect(retrieved.queixaPrincipal).toBe(anamneseText);
      expect(retrieved.evolucaoClinica).toBe(evolucaoText);
      expect(retrieved.condutaProcedimento).toBe(evolucaoText);
      expect(retrieved.evolucaoClinica).not.toContain('ANAMNESE_UNICA_011');
      expect(retrieved.anamnese).not.toContain('EVOLUCAO_UNICA_011');

      // 3. Update only anamnese and verify evolucaoClinica remains untouched
      const updatedAnamneseText = 'ANAMNESE_ATUALIZADA_011: Paciente acrescentou histórico de enxaqueca.';
      await MedicalRecordService.updateByAttendanceId(
        attendance.id,
        updateMedicalRecordSchema.parse({ anamnese: updatedAnamneseText })
      );

      const afterAnamneseUpdate = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterAnamneseUpdate.anamnese).toBe(updatedAnamneseText);
      expect(afterAnamneseUpdate.queixaPrincipal).toBe(updatedAnamneseText);
      expect(afterAnamneseUpdate.evolucaoClinica).toBe(evolucaoText);
      expect(afterAnamneseUpdate.condutaProcedimento).toBe(evolucaoText);

      // 4. Update only evolucaoClinica and verify anamnese remains untouched
      const updatedEvolucaoText = 'EVOLUCAO_ATUALIZADA_011: Aplicação concluída com agulha 32G.';
      await MedicalRecordService.updateByAttendanceId(
        attendance.id,
        updateMedicalRecordSchema.parse({ evolucaoClinica: updatedEvolucaoText })
      );

      const afterEvolucaoUpdate = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(afterEvolucaoUpdate.anamnese).toBe(updatedAnamneseText);
      expect(afterEvolucaoUpdate.evolucaoClinica).toBe(updatedEvolucaoText);
    });

    it('does not leak anamnesis into empty clinical evolution when only anamnesis is filled', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Pendente',
        },
      });

      const parsedCreate = createMedicalRecordSchema.parse({
        attendanceId: attendance.id,
        anamnese: 'Apenas anamnese preenchida inicialmente.',
        evolucaoClinica: '',
      });
      await MedicalRecordService.createMedicalRecord(parsedCreate);

      const retrieved = await MedicalRecordService.getByAttendanceId(attendance.id);
      expect(retrieved.anamnese).toBe('Apenas anamnese preenchida inicialmente.');
      expect(retrieved.evolucaoClinica).toBeNull();
      expect(retrieved.condutaProcedimento).toBeNull();
    });
  });

  // =========================================================================
  // BUG-012: Product Consumption Reversal — Atomicity, Concurrency & Rollback
  // =========================================================================
  describe('BUG-012: Reliable, Idempotent, and Atomic Product Consumption Reversal', () => {
    it('reverses consumption, restores lot and unit balances, updates traceability, and blocks duplicate or concurrent reversals', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      const product = await prisma.product.create({
        data: {
          nome: 'Ácido Hialurônico 1ml Teste BUG-012',
          categoria: 'Preenchedores',
          marca: 'Allergan',
          unidade: 'seringa',
          trackingMode: 'UNIT',
          estoqueMinimo: 2,
          isReusable: false,
          isActive: true,
        },
      });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const lot = await createLot(product.id, {
        numeroLote: 'LOTE-BUG012-A',
        quantidadeInicial: 3,
        dataValidade: futureDate,
        codigosSeriais: ['SER-012-001', 'SER-012-002', 'SER-012-003'],
      });

      const units = await prisma.stockUnit.findMany({
        where: { lotId: lot.id },
        orderBy: { codigoSerial: 'asc' },
      });
      const unit1 = units[0];
      expect(lot.quantidadeDisponivel).toBe(3);

      // 1. Record product consumption
      const usage = await recordProductUsage(attendance.id, {
        stockUnitId: unit1.id,
        quantidade: 1,
        observacoes: 'Aplicação labial',
      });

      const lotAfterUsage = await prisma.productLot.findUnique({ where: { id: lot.id } });
      const unitAfterUsage = await prisma.stockUnit.findUnique({ where: { id: unit1.id } });
      expect(Number(lotAfterUsage?.quantidadeDisponivel)).toBe(2);
      expect(unitAfterUsage?.status).toBe('Esgotado');
      expect(Number(unitAfterUsage?.quantidadeDisponivel)).toBe(0);

      // 2. Execute concurrent reversal requests against the same usageId
      const concurrentResults = await Promise.allSettled([
        reverseProductUsage(usage.id, { motivo: 'Estorno concorrente #1' }),
        reverseProductUsage(usage.id, { motivo: 'Estorno concorrente #2' }),
        reverseProductUsage(usage.id, { motivo: 'Estorno concorrente #3' }),
      ]);

      const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
      const rejected = concurrentResults.filter((r) => r.status === 'rejected');

      // Exactly 1 request must succeed; the other 2 must fail with domain ValidationError
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(2);

      // 3. Verify inventory balance was restored ONLY ONCE (back to 3, never 4 or 5)
      const lotAfterReversal = await prisma.productLot.findUnique({ where: { id: lot.id } });
      const unitAfterReversal = await prisma.stockUnit.findUnique({ where: { id: unit1.id } });
      const usageAfterReversal = await prisma.productUsage.findUnique({ where: { id: usage.id } });
      const movements = await prisma.inventoryMovement.findMany({
        where: { productUsageId: usage.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(Number(lotAfterReversal?.quantidadeDisponivel)).toBe(3);
      expect(unitAfterReversal?.status).toBe('Disponivel');
      expect(Number(unitAfterReversal?.quantidadeDisponivel)).toBe(1);
      expect(usageAfterReversal?.status).toBe('Estornado');
      expect(usageAfterReversal?.reversedAt).not.toBeNull();

      // Verify movements: 1 original CONSUMO (now Estornado) + 1 compensating REVERSAO (Ativo)
      expect(movements.length).toBe(2);
      const consumoMov = movements.find((m) => m.tipo === 'CONSUMO');
      const reversaoMov = movements.find((m) => m.tipo === 'REVERSAO');
      expect(consumoMov?.status).toBe('Estornado');
      expect(reversaoMov?.status).toBe('Ativo');
      expect(Number(reversaoMov?.saldoAnterior)).toBe(2);
      expect(Number(reversaoMov?.saldoPosterior)).toBe(3);

      // 4. Subsequent sequential reversal attempt must also fail cleanly with ValidationError (400)
      await expect(
        reverseProductUsage(usage.id, { motivo: 'Tentativa repetida após estorno' })
      ).rejects.toThrow(ValidationError);

      const lotFinal = await prisma.productLot.findUnique({ where: { id: lot.id } });
      expect(Number(lotFinal?.quantidadeDisponivel)).toBe(3);
    });

    it('rolls back all changes atomically if an error occurs mid-transaction during reversal', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      const product = await prisma.product.create({
        data: {
          nome: 'Bioestimulador Teste Rollback BUG-012',
          categoria: 'Bioestimuladores',
          unidade: 'ml',
          trackingMode: 'QUANTITY',
          estoqueMinimo: 5,
          isReusable: true,
          isActive: true,
        },
      });

      const lot = await createLot(product.id, {
        numeroLote: 'LOTE-ROLLBACK-012',
        quantidadeInicial: 10,
      });

      const usage = await recordProductUsage(attendance.id, {
        lotId: lot.id,
        quantidade: 4,
      });

      // Simulate a failure mid-transaction by temporarily breaking FK reference on productUsage.productId
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.productUsage.updateMany({
            where: { id: usage.id, status: { not: 'Estornado' } },
            data: { status: 'Estornado', reversedAt: new Date(), reversalReason: 'Falha simulada' },
          });
          await tx.productLot.update({
            where: { id: lot.id },
            data: { quantidadeDisponivel: 10 },
          });
          // Force failure inside transaction
          throw new Error('Falha simulada no meio da transação de estorno');
        })
      ).rejects.toThrow('Falha simulada no meio da transação de estorno');

      // Verify zero partial updates persisted
      const usageCheck = await prisma.productUsage.findUnique({ where: { id: usage.id } });
      const lotCheck = await prisma.productLot.findUnique({ where: { id: lot.id } });
      expect(usageCheck?.status).toBe('Ativo');
      expect(usageCheck?.reversedAt).toBeNull();
      expect(Number(lotCheck?.quantidadeDisponivel)).toBe(6);
    });

    it('does not over-inflate ProductLot.quantidadeDisponivel when reversing a non-depleting reusable StockUnit usage', async () => {
      const client = await createTestClient();
      const attendance = await prisma.attendance.create({
        data: {
          clientId: client.id,
          dataHora: new Date(),
          status: 'Realizado',
        },
      });

      const reusableProduct = await prisma.product.create({
        data: {
          nome: 'Ponteira Reutilizável Laser BUG-012',
          categoria: 'Ponteiras',
          unidade: 'un',
          trackingMode: 'UNIT',
          estoqueMinimo: 1,
          isReusable: true,
          isActive: true,
        },
      });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const lot = await createLot(reusableProduct.id, {
        numeroLote: 'LOTE-REUSABLE-012',
        quantidadeInicial: 2,
        dataValidade: futureDate,
        codigosSeriais: ['PONT-012-01', 'PONT-012-02'],
      });

      const unit = await prisma.stockUnit.findFirstOrThrow({
        where: { lotId: lot.id, codigoSerial: 'PONT-012-01' },
      });

      // Record reusable unit usage without fractional quantity (standard UNIT mode check-out)
      const usage = await recordProductUsage(attendance.id, {
        stockUnitId: unit.id,
      });

      const lotDuringUse = await prisma.productLot.findUnique({ where: { id: lot.id } });
      const unitDuringUse = await prisma.stockUnit.findUnique({ where: { id: unit.id } });
      expect(Number(lotDuringUse?.quantidadeDisponivel)).toBe(2);
      expect(unitDuringUse?.status).toBe('EmUso');
      expect(unitDuringUse?.currentClientId).toBe(client.id);

      // Reverse usage -> unit returns to Disponivel and lot balance stays at 2 (never inflated to 3)
      await reverseProductUsage(usage.id, { motivo: 'Sessão reagendada' });

      const lotAfterReversal = await prisma.productLot.findUnique({ where: { id: lot.id } });
      const unitAfterReversal = await prisma.stockUnit.findUnique({ where: { id: unit.id } });
      expect(Number(lotAfterReversal?.quantidadeDisponivel)).toBe(2);
      expect(unitAfterReversal?.status).toBe('Disponivel');
      expect(unitAfterReversal?.currentClientId).toBeNull();
    });
  });

  // =========================================================================
  // MELHORIA-019: Appointment Total Estimated Duration Calculation
  // =========================================================================
  describe('MELHORIA-019: Appointment Total Estimated Duration Calculation and Persistence', () => {
    it('calculates total duration accurately for 0, 1, multiple procedures, removals, and missing durations', async () => {
      const p1 = { id: '1', nome: 'Botox', duracaoMinutos: 30 };
      const p2 = { id: '2', nome: 'Preenchimento Labial', duracaoMinutos: 45 };
      const p3 = { id: '3', nome: 'Limpeza de Pele', duracaoMinutos: 60 };
      const pZero = { id: '4', nome: 'Avaliação Rápida', duracaoMinutos: 0 };
      const pMissing = { id: '5', nome: 'Retorno', duracaoMinutos: null };

      // 1. Empty selection
      expect(calculateEstimatedDurationMinutes([])).toBe(0);
      expect(formatDurationMinutes(0)).toBe('0 min');

      // 2. Single procedure
      expect(calculateEstimatedDurationMinutes([p2])).toBe(45);
      expect(formatDurationMinutes(45)).toBe('45 min');

      // 3. Multiple procedures (30 + 45 + 60 = 135 min)
      const multiTotal = calculateEstimatedDurationMinutes([p1, p2, p3]);
      expect(multiTotal).toBe(135);
      expect(formatDurationMinutes(multiTotal)).toBe('135 min (2h 15min)');

      // 4. Removing a procedure (remove p2 -> 30 + 60 = 90 min)
      const afterRemoval = calculateEstimatedDurationMinutes([p1, p3]);
      expect(afterRemoval).toBe(90);
      expect(formatDurationMinutes(afterRemoval)).toBe('90 min (1h 30min)');

      // 5. Procedures with 0 or null/missing duration
      expect(calculateEstimatedDurationMinutes([p1, pZero, pMissing])).toBe(30);

      // 6. Integration with AppointmentService and plannedProcedures relation
      const client = await createTestClient();
      const dbProc1 = await createTestProcedure({ nome: 'Procedimento 30m', duracaoMinutos: 30 });
      const dbProc2 = await createTestProcedure({ nome: 'Procedimento 60m', duracaoMinutos: 60 });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(14, 0, 0, 0);

      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: futureDate,
        plannedProcedureIds: [dbProc1.id, dbProc2.id],
      });

      const fetchedAppt = await AppointmentService.getAppointmentById(appt.id);
      const totalFromSaved = calculateEstimatedDurationMinutes(fetchedAppt.plannedProcedures);
      expect(totalFromSaved).toBe(90);
      expect(formatDurationMinutes(totalFromSaved)).toBe('90 min (1h 30min)');
    });
  });

  // =========================================================================
  // MELHORIA-020: Reminder List & Kanban View Grouping and Transitions
  // =========================================================================
  describe('MELHORIA-020: Reminder Kanban Grouping and Status Transitions', () => {
    it('groups reminders into pendente, concluido, and dispensado columns, moves items on status update, and handles empty columns', async () => {
      const client = await createTestClient();

      // 1. Empty state check
      const emptyGrouped = groupRemindersByKanbanColumn([]);
      expect(emptyGrouped.pendente).toEqual([]);
      expect(emptyGrouped.concluido).toEqual([]);
      expect(emptyGrouped.dispensado).toEqual([]);

      // 2. Create 3 reminders in isolated DB
      const r1 = await ReminderService.createReminder({
        clientId: client.id,
        titulo: 'Lembrete 1 - Retorno Botox',
        descricao: 'Agendar avaliação de 15 dias',
        dataVencimento: new Date('2026-12-01T12:00:00Z'),
        prioridade: 'alta',
        tipo: 'retorno',
      });

      const r2 = await ReminderService.createReminder({
        clientId: client.id,
        titulo: 'Lembrete 2 - Confirmar Estoque',
        descricao: 'Verificar lote de ácido hialurônico',
        dataVencimento: new Date('2026-12-02T12:00:00Z'),
        prioridade: 'media',
        tipo: 'geral',
      });

      const r3 = await ReminderService.createReminder({
        clientId: client.id,
        titulo: 'Lembrete 3 - Contato Pós-Procedimento',
        descricao: 'Checar recuperação do paciente',
        dataVencimento: new Date('2026-12-03T12:00:00Z'),
        prioridade: 'baixa',
        tipo: 'geral',
      });

      // Initially all 3 are pendente; concluido and dispensado are empty
      let allList = await ReminderService.listReminders({ status: 'todos', limit: 50, offset: 0 });
      let grouped = groupRemindersByKanbanColumn(allList);
      expect(grouped.pendente.map((i) => i.id)).toEqual([r1.id, r2.id, r3.id]);
      expect(grouped.concluido).toHaveLength(0);
      expect(grouped.dispensado).toHaveLength(0);

      // 3. Transition r1 -> concluido and r2 -> dispensado
      await ReminderService.updateReminderStatus(r1.id, 'concluido');
      await ReminderService.updateReminderStatus(r2.id, 'dispensado');

      allList = await ReminderService.listReminders({ status: 'todos', limit: 50, offset: 0 });
      grouped = groupRemindersByKanbanColumn(allList);

      expect(grouped.pendente.map((i) => i.id)).toEqual([r3.id]);
      expect(grouped.concluido.map((i) => i.id)).toEqual([r1.id]);
      expect(grouped.dispensado.map((i) => i.id)).toEqual([r2.id]);

      // 4. Reopen r2 back to pendente -> moves from dispensado column to pendente column
      await ReminderService.updateReminderStatus(r2.id, 'pendente');

      allList = await ReminderService.listReminders({ status: 'todos', limit: 50, offset: 0 });
      grouped = groupRemindersByKanbanColumn(allList);

      expect(grouped.pendente.map((i) => i.id)).toEqual([r2.id, r3.id]);
      expect(grouped.concluido.map((i) => i.id)).toEqual([r1.id]);
      expect(grouped.dispensado).toHaveLength(0);
    });
  });
});
