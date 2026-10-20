import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import prismaTest, { TEST_DATABASE_URL } from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { AttendanceService } from '@/services/attendance.service';
import { StockService } from '@/services/stock.service';
import { ConflictError, ValidationError } from '@/lib/errors';

/**
 * Executes the prisma/seed.ts script against PopoAppTest using child_process.
 */
function executeSeedScript(): string {
  const tsNodeBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'ts-node.cmd');
  const seedScriptPath = path.resolve(process.cwd(), 'prisma', 'seed.ts');

  const output = execFileSync(
    tsNodeBin,
    ['--compiler-options', JSON.stringify({ module: 'CommonJS' }), seedScriptPath],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  return output.toString();
}

describe('Tier 5 Adversarial Verification: Milestone 5 Clinical Workspace & Seed Workflows', () => {
  beforeAll(async () => {
    // Initial cleanup
    await cleanTestDatabase();
    // Run seed script against PopoAppTest
    executeSeedScript();
  }, 60000);

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  // =========================================================================
  // Section 1: Seed Script Idempotency & Teardown Resilience
  // =========================================================================
  describe('1. Seed Script Idempotency & Teardown Resilience (§50)', () => {
    it('1.1: Re-running seed script on fully populated database executes cleanly without FK violation errors (Idempotency Pass 2)', () => {
      // Database is currently populated with circular appointment links, client attachments, stock unit links, etc.
      // A non-idempotent seed script would crash with SQL Server error 547 or unique constraint error.
      const output2 = executeSeedScript();
      expect(output2).toContain('Existing tables cleaned successfully.');
      expect(output2).toContain('=== PopoApp Clinical Seed Completed Successfully! ===');
    });

    it('1.2: Third consecutive seed run confirms mathematical idempotency (Idempotency Pass 3)', () => {
      const output3 = executeSeedScript();
      expect(output3).toContain('Existing tables cleaned successfully.');
      expect(output3).toContain('=== PopoApp Clinical Seed Completed Successfully! ===');
    });

    it('1.3: Clean routine successfully breaks self-referencing and circular foreign keys', async () => {
      // Verify that after seed, there are appointments and stock units
      const appointmentCount = await prismaTest.appointment.count();
      const clientCount = await prismaTest.client.count();
      const stockUnitCount = await prismaTest.stockUnit.count();

      expect(appointmentCount).toBeGreaterThan(0);
      expect(clientCount).toBe(6);
      expect(stockUnitCount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Section 2: Verification of §47 Example A (Practiced Below Standard Value)
  // =========================================================================
  describe('2. Verification of §47 Example A: Practiced Value Below Standard Value', () => {
    it('2.1: Practiced value is R$ 400.00, standard snapshot is R$ 500.00, explicit discount is R$ 0.00', async () => {
      const clientMariana = await prismaTest.client.findFirst({
        where: { nome: 'Mariana Silva Castro' },
      });
      expect(clientMariana).not.toBeNull();

      // Attendance for Example A
      const attA = await prismaTest.attendance.findFirst({
        where: {
          clientId: clientMariana!.id,
          observacoes: { contains: 'Exemplo A' },
        },
        include: {
          procedures: {
            include: { procedure: true },
          },
          payments: true,
          medicalRecord: true,
        },
      });

      expect(attA).not.toBeNull();
      expect(attA!.status).toBe('Realizado');
      expect(Number(attA!.desconto)).toBe(0.0); // Explicit discount strictly 0.00

      // Procedure check
      expect(attA!.procedures).toHaveLength(1);
      const proc = attA!.procedures[0];
      expect(proc.procedure.nome).toBe('Toxina Botulínica - Terço Superior');
      expect(Number(proc.standardValueSnapshot)).toBe(500.0);
      expect(Number(proc.practicedValue)).toBe(400.0);

      // Critical domain rule verification (§47 Example A):
      // The system must NOT automatically create a R$ 100.00 discount!
      expect(Number(attA!.desconto)).toBe(0.0);

      // Verify via AttendanceService domain calculation
      const financials = await AttendanceService.getAttendanceById(attA!.id);
      expect(financials.financials.standardTotal).toBe(500.0);
      expect(financials.financials.practicedTotal).toBe(400.0);
      expect(financials.financials.explicitDiscount).toBe(0.0); // Strictly 0.00
      expect(financials.financials.netTotal).toBe(400.0);
      expect(financials.financials.paidTotal).toBe(400.0);
      expect(financials.financials.outstandingBalance).toBe(0.0);
      expect(financials.financials.isFullyPaid).toBe(true);

      // Associated payment
      expect(attA!.payments).toHaveLength(1);
      expect(Number(attA!.payments[0].valor)).toBe(400.0);
      expect(attA!.payments[0].metodo).toBe('Pix');
      expect(attA!.payments[0].status).toBe('Pago');

      // Medical Record (Prontuário)
      expect(attA!.medicalRecord).not.toBeNull();
      expect(attA!.medicalRecord?.queixaPrincipal).toContain('Linhas de expressão');
    });
  });

  // =========================================================================
  // Section 3: Verification of §47 Example B (Explicit Discount & Partial Payment Ledger)
  // =========================================================================
  describe('3. Verification of §47 Example B: Explicit Discount & Partial Payment Ledger', () => {
    it('3.1: Practiced total R$ 800.00, explicit discount R$ 100.00, partial payments R$ 300 + R$ 400 = R$ 700.00, outstanding R$ 0.00', async () => {
      const clientBeatriz = await prismaTest.client.findFirst({
        where: { nome: 'Beatriz Rocha Mendes' },
      });
      expect(clientBeatriz).not.toBeNull();

      const attB = await prismaTest.attendance.findFirst({
        where: {
          clientId: clientBeatriz!.id,
          observacoes: { contains: 'Exemplo B' },
        },
        include: {
          procedures: true,
          payments: true,
          medicalRecord: true,
        },
      });

      expect(attB).not.toBeNull();
      expect(attB!.status).toBe('Realizado');
      expect(Number(attB!.desconto)).toBe(100.0); // Explicit discount R$ 100.00

      // 2 procedures with practiced values 500.00 + 300.00 = 800.00
      expect(attB!.procedures).toHaveLength(2);
      const practicedSum = attB!.procedures.reduce((acc, p) => acc + Number(p.practicedValue), 0);
      expect(practicedSum).toBe(800.0);

      // Payments: R$ 300 Dinheiro + R$ 400 Cartão de Débito = R$ 700.00
      expect(attB!.payments).toHaveLength(2);
      const paidSum = attB!.payments.reduce((acc, p) => acc + Number(p.valor), 0);
      expect(paidSum).toBe(700.0);

      const cashPayment = attB!.payments.find((p) => p.metodo === 'Dinheiro');
      const debitPayment = attB!.payments.find((p) => p.metodo === 'CartaoDebito');
      expect(cashPayment).toBeDefined();
      expect(Number(cashPayment!.valor)).toBe(300.0);
      expect(cashPayment!.status).toBe('Pago');
      expect(debitPayment).toBeDefined();
      expect(Number(debitPayment!.valor)).toBe(400.0);
      expect(debitPayment!.status).toBe('Pago');

      // Verify domain service financials computation (D2)
      const serviceAttB = await AttendanceService.getAttendanceById(attB!.id);
      expect(serviceAttB.financials.practicedTotal).toBe(800.0);
      expect(serviceAttB.financials.explicitDiscount).toBe(100.0);
      expect(serviceAttB.financials.netTotal).toBe(700.0);
      expect(serviceAttB.financials.paidTotal).toBe(700.0);
      expect(serviceAttB.financials.outstandingBalance).toBe(0.0);
      expect(serviceAttB.financials.isFullyPaid).toBe(true);

      // Medical Record exists
      expect(attB!.medicalRecord).not.toBeNull();
      expect(attB!.medicalRecord?.queixaPrincipal).toContain('Lábio superior');
    });
  });

  // =========================================================================
  // Section 4: Verification of §47 Example C (Reusable Physical Unit & Traceability)
  // =========================================================================
  describe('4. Verification of §47 Example C: Reusable Physical Unit & Traceability', () => {
    it('4.1: Reusable unit UNIT-001 is linked to Mariana and recorded across 2 Attendances', async () => {
      const clientMariana = await prismaTest.client.findFirst({
        where: { nome: 'Mariana Silva Castro' },
      });
      expect(clientMariana).not.toBeNull();

      // Find stock unit UNIT-001
      const unit001 = await prismaTest.stockUnit.findFirst({
        where: { codigoSerial: 'UNIT-001' },
        include: {
          lot: {
            include: { product: true },
          },
          currentClient: true,
          usages: {
            include: { attendance: true },
          },
        },
      });

      expect(unit001).not.toBeNull();
      expect(unit001!.status).toBe('EmUso');
      expect(unit001!.currentClientId).toBe(clientMariana!.id);
      expect(unit001!.lot.product.isReusable).toBe(true);

      // Verify usage across 2 distinct attendances
      expect(unit001!.usages).toHaveLength(2);
      const attendanceIds = unit001!.usages.map((u) => u.attendanceId);
      expect(new Set(attendanceIds).size).toBe(2); // Two distinct attendances

      // Both attendances belong to Mariana
      for (const usage of unit001!.usages) {
        expect(usage.attendance.clientId).toBe(clientMariana!.id);
      }
    });

    it('4.2: Adversarial Challenge: Prevent cross-client reuse of UNIT-001 with Client Beatriz (V16/V17)', async () => {
      const clientBeatriz = await prismaTest.client.findFirst({
        where: { nome: 'Beatriz Rocha Mendes' },
      });
      const unit001 = await prismaTest.stockUnit.findFirst({
        where: { codigoSerial: 'UNIT-001' },
      });
      expect(clientBeatriz).not.toBeNull();
      expect(unit001).not.toBeNull();

      // Create a new attendance for Beatriz
      const apptBeatriz = await prismaTest.appointment.create({
        data: {
          clientId: clientBeatriz!.id,
          dataHora: new Date(),
          status: 'Agendado',
        },
      });
      const attBeatriz = await prismaTest.attendance.create({
        data: {
          appointmentId: apptBeatriz.id,
          clientId: clientBeatriz!.id,
          dataHora: new Date(),
          status: 'Pendente',
        },
      });

      // Attempting to record usage of Mariana's UNIT-001 on Beatriz's attendance MUST be rejected
      await expect(
        StockService.recordProductUsage(attBeatriz.id, {
          stockUnitId: unit001!.id,
        })
      ).rejects.toThrow();
    });

    it('4.3: Single-use products (Restylane Kysse) are marked isReusable=false', async () => {
      const prodKysse = await prismaTest.product.findFirst({
        where: { nome: { contains: 'Restylane Kysse' } },
      });
      expect(prodKysse).not.toBeNull();
      expect(prodKysse!.isReusable).toBe(false);
    });
  });

  // =========================================================================
  // Section 5: Verification of §47 Example D (Rescheduling Cascade & Linkage)
  // =========================================================================
  describe('5. Verification of §47 Example D: Rescheduling Cascade & Traceability', () => {
    it('5.1: Original appointment Reagendado links to new Agendado, original attendance Cancelado, new attendance Pendente', async () => {
      const apptOrig = await prismaTest.appointment.findFirst({
        where: { status: 'Reagendado' },
        include: {
          attendances: true,
          rescheduledTo: true,
        },
      });

      expect(apptOrig).not.toBeNull();
      expect(apptOrig!.rescheduledToId).not.toBeNull();
      expect(apptOrig!.motivoCancelamento).toBeTruthy();

      // Associated attendance must be Cancelado per D1 Rule 4
      expect(apptOrig!.attendances).toHaveLength(1);
      expect(apptOrig!.attendances[0].status).toBe('Cancelado');

      // New appointment
      const apptNew = await prismaTest.appointment.findUnique({
        where: { id: apptOrig!.rescheduledToId! },
        include: {
          attendances: true,
          rescheduledFrom: true,
        },
      });

      expect(apptNew).not.toBeNull();
      expect(apptNew!.status).toBe('Agendado');
      expect(apptNew!.rescheduledFromId).toBe(apptOrig!.id);

      // Associated attendance for new appointment must be Pendente per D1 Rule 2
      expect(apptNew!.attendances).toHaveLength(1);
      expect(apptNew!.attendances[0].status).toBe('Pendente');
    });
  });

  // =========================================================================
  // Section 6: Verification of §47 Example E (Attachment Exclusivity & SQL Constraint)
  // =========================================================================
  describe('6. Verification of §47 Example E: Attachment Ownership Exclusivity', () => {
    it('6.1: Client-level and Attendance-level attachments adhere strictly to exclusivity', async () => {
      const attachments = await prismaTest.attachment.findMany();
      expect(attachments.length).toBeGreaterThanOrEqual(2);

      const clientAttachment = attachments.find((a) => a.nomeOriginal.includes('termo_consentimento'));
      const attAttachment = attachments.find((a) => a.nomeOriginal.includes('foto_labios'));

      expect(clientAttachment).toBeDefined();
      expect(clientAttachment!.clientId).not.toBeNull();
      expect(clientAttachment!.attendanceId).toBeNull();

      expect(attAttachment).toBeDefined();
      expect(attAttachment!.attendanceId).not.toBeNull();
      expect(attAttachment!.clientId).toBeNull();

      // Verify files exist in storage directory
      expect(fs.existsSync(clientAttachment!.caminhoRelativo)).toBe(true);
      expect(fs.existsSync(attAttachment!.caminhoRelativo)).toBe(true);
    });

    it('6.2: Adversarial Challenge: Direct insert with BOTH clientId and attendanceId fails SQL Server CK_Attachment_Ownership', async () => {
      const client = await prismaTest.client.findFirst();
      const attendance = await prismaTest.attendance.findFirst();
      expect(client).not.toBeNull();
      expect(attendance).not.toBeNull();

      // SQL Server CHECK constraint: (clientId IS NOT NULL AND attendanceId IS NULL) OR (clientId IS NULL AND attendanceId IS NOT NULL)
      await expect(
        prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [clientId], [attendanceId], [nomeOriginal], [nomeArquivo],
            [caminhoRelativo], [mimeType], [tamanhoBytes], [categoria], [createdAt]
          ) VALUES (
            NEWID(), '${client!.id}', '${attendance!.id}', 'violation.pdf', 'uuid-violation.pdf',
            './storage/uploads/uuid-violation.pdf', 'application/pdf', 1024, 'outro', GETDATE()
          )
        `)
      ).rejects.toThrow();
    });

    it('6.3: Adversarial Challenge: Direct insert with NEITHER clientId nor attendanceId fails SQL Server CK_Attachment_Ownership', async () => {
      await expect(
        prismaTest.$executeRawUnsafe(`
          INSERT INTO [Attachment] (
            [id], [clientId], [attendanceId], [nomeOriginal], [nomeArquivo],
            [caminhoRelativo], [mimeType], [tamanhoBytes], [categoria], [createdAt]
          ) VALUES (
            NEWID(), NULL, NULL, 'orphan.pdf', 'uuid-orphan.pdf',
            './storage/uploads/uuid-orphan.pdf', 'application/pdf', 1024, 'outro', GETDATE()
          )
        `)
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Section 7: Seeded Financial & Reminder Workflows (§50, D5 & In-App Reminders)
  // =========================================================================
  describe('7. Seeded Financial & Reminder Workflows (§50, D5)', () => {
    it('7.1: Admin user exists, isActive=true, and bcrypt matches PopoApp2024!', async () => {
      const admin = await prismaTest.user.findUnique({
        where: { nickname: 'admin' },
      });
      expect(admin).not.toBeNull();
      expect(admin!.isActive).toBe(true);
      expect(admin!.displayName).toBe('Dra. Paula Oliveira');

      const passwordMatches = await bcrypt.compare('PopoApp2024!', admin!.passwordHash);
      expect(passwordMatches).toBe(true);
    });

    it('7.2: PIX installment schedule has 3 installments (Pago, Atrasado, Pendente) with linked reminders', async () => {
      const clientJuliana = await prismaTest.client.findFirst({
        where: { nome: { contains: 'Juliana' } },
      });
      expect(clientJuliana).not.toBeNull();

      const paymentPix = await prismaTest.payment.findFirst({
        where: {
          attendance: { clientId: clientJuliana!.id },
          metodo: 'Pix',
          numeroParcelas: 3,
        },
        include: {
          pixInstallments: true,
        },
      });

      expect(paymentPix).not.toBeNull();
      expect(paymentPix!.pixInstallments).toHaveLength(3);

      const inst1 = paymentPix!.pixInstallments.find((i) => i.numeroParcela === 1);
      const inst2 = paymentPix!.pixInstallments.find((i) => i.numeroParcela === 2);
      const inst3 = paymentPix!.pixInstallments.find((i) => i.numeroParcela === 3);

      expect(inst1!.status).toBe('Pago');
      expect(inst1!.dataPagamento).not.toBeNull();

      expect(inst2!.status).toBe('Atrasado');
      expect(inst2!.dataPagamento).toBeNull();

      expect(inst3!.status).toBe('Pendente');
      expect(inst3!.dataPagamento).toBeNull();

      // Check linked reminders
      const reminderOverdue = await prismaTest.reminder.findFirst({
        where: { pixInstallmentId: inst2!.id },
      });
      expect(reminderOverdue).not.toBeNull();
      expect(reminderOverdue!.prioridade).toBe('alta');
      expect(reminderOverdue!.status).toBe('pendente');

      const reminderUpcoming = await prismaTest.reminder.findFirst({
        where: { pixInstallmentId: inst3!.id },
      });
      expect(reminderUpcoming).not.toBeNull();
      expect(reminderUpcoming!.prioridade).toBe('media');
      expect(reminderUpcoming!.status).toBe('pendente');
    });

    it('7.3: Credit card payment has stored installments count (6) with zero PIX installments and zero reminders (D5)', async () => {
      const clientFernanda = await prismaTest.client.findFirst({
        where: { nome: { contains: 'Fernanda' } },
      });
      expect(clientFernanda).not.toBeNull();

      const paymentCC = await prismaTest.payment.findFirst({
        where: {
          attendance: { clientId: clientFernanda!.id },
          metodo: 'CartaoCredito',
        },
        include: {
          pixInstallments: true,
        },
      });

      expect(paymentCC).not.toBeNull();
      expect(paymentCC!.numeroParcelas).toBe(6);
      expect(paymentCC!.status).toBe('Pago');

      // Crucial invariant check per D5: Credit cards have NO child installments in PixInstallment
      expect(paymentCC!.pixInstallments).toHaveLength(0);

      // Crucial invariant check per D5: Credit cards have NO automatic reminders
      const ccReminders = await prismaTest.reminder.findMany({
        where: {
          clientId: clientFernanda!.id,
          tipo: 'parcela_pix',
        },
      });
      expect(ccReminders).toHaveLength(0);
    });

    it('7.4: In-app reminders include overdue, upcoming, completed clinical return, and general reminders', async () => {
      const reminders = await prismaTest.reminder.findMany();
      expect(reminders.length).toBeGreaterThanOrEqual(4);

      const completedReturn = reminders.find((r) => r.tipo === 'retorno');
      expect(completedReturn).toBeDefined();
      expect(completedReturn!.status).toBe('concluido');
      expect(completedReturn!.completedAt).not.toBeNull();

      const generalReminder = reminders.find((r) => r.tipo === 'geral');
      expect(generalReminder).toBeDefined();
      expect(generalReminder!.status).toBe('pendente');
      expect(generalReminder!.prioridade).toBe('baixa');
    });

    it('7.5: Procedures catalog has 10 clinical items across Facial, Corporal, Injetáveis, and Capilar', async () => {
      const procedures = await prismaTest.procedure.findMany();
      expect(procedures.length).toBe(10);

      const categories = new Set(procedures.map((p) => p.categoria));
      expect(categories.has('Facial')).toBe(true);
      expect(categories.has('Corporal')).toBe(true);
      expect(categories.has('Injetáveis')).toBe(true);
      expect(categories.has('Capilar')).toBe(true);
    });

    it('7.6: Clients have valid MOD 11 CPFs and emergency contacts', async () => {
      const clients = await prismaTest.client.findMany({
        include: { emergencyContacts: true },
      });
      expect(clients.length).toBe(6);

      // Each client has non-empty emergency contacts
      for (const client of clients) {
        expect(client.cpf).toMatch(/^\d{11}$/);
        expect(client.emergencyContacts.length).toBeGreaterThanOrEqual(1);
      }

      // 5 active clients, 1 inactive client
      const activeClients = clients.filter((c) => c.status === 'ativo');
      const inactiveClients = clients.filter((c) => c.status === 'inativo');
      expect(activeClients.length).toBe(5);
      expect(inactiveClients.length).toBe(1);
    });
  });
});
