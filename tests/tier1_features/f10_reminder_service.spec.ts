import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestAppointment } from '../helpers/test-fixtures';
import { ReminderService } from '@/services/reminder.service';
import { PaymentService } from '@/services/payment.service';
import { AttendanceService } from '@/services/attendance.service';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F10: Reminder Domain Service (Phase 13, D5, V21, V22, V23, AC 68)', () => {
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

  it('F10.1: Create manual reminder with client link and valid fields', async () => {
    const client = await createTestClient();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const reminder = await ReminderService.createReminder({
      clientId: client.id,
      titulo: 'Retorno para avaliação de Botox',
      descricao: 'Verificar simetria e necessidade de retoque após 15 dias',
      dataVencimento: dueDate,
      prioridade: 'alta',
      tipo: 'retorno',
    });

    expect(reminder.id).toBeDefined();
    expect(reminder.titulo).toBe('Retorno para avaliação de Botox');
    expect(reminder.prioridade).toBe('alta');
    expect(reminder.status).toBe('pendente');
    expect(reminder.tipo).toBe('retorno');
    expect(reminder.client?.nome).toBe(client.nome);
  });

  it('F10.2 (V22): Generate reminders for PIX installment schedule', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 600.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 600.0,
    });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 600.0,
      numeroParcelas: 3,
      primeiroVencimento: dueDate,
    });

    const reminders = await ReminderService.listReminders({
      clientId: client.id,
    });

    expect(reminders).toHaveLength(3);
    for (const r of reminders) {
      expect(r.tipo).toBe('parcela_pix');
      expect(r.status).toBe('pendente');
      expect(r.pixInstallmentId).toBeDefined();
    }
  });

  it('F10.3: Idempotency of generateRemindersForPixInstallments prevents duplicate reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 400.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 400.0,
    });

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 400.0,
      numeroParcelas: 2,
      primeiroVencimento: new Date(),
    });

    const installments = await prismaTest.pixInstallment.findMany({
      where: { paymentId: schedule.payment.id },
    });

    // Re-run generation explicitly
    await ReminderService.generateRemindersForPixInstallments(
      installments.map((i) => ({
        id: i.id,
        numeroParcela: i.numeroParcela,
        totalParcelas: i.totalParcelas,
        valor: i.valor,
        dataVencimento: i.dataVencimento,
      })),
      client.id
    );

    const reminders = await ReminderService.listReminders({
      clientId: client.id,
    });

    // Still exactly 2 reminders
    expect(reminders).toHaveLength(2);
  });

  it('F10.4: List reminders filters by status and computes isOverdue', async () => {
    const client = await createTestClient();

    // Past due date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    // Future due date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    await ReminderService.createReminder({
      clientId: client.id,
      titulo: 'Lembrete vencido',
      dataVencimento: pastDate,
      tipo: 'geral',
    });

    await ReminderService.createReminder({
      clientId: client.id,
      titulo: 'Lembrete futuro',
      dataVencimento: futureDate,
      tipo: 'geral',
    });

    const overdueList = await ReminderService.listReminders({
      status: 'atrasado',
    });
    expect(overdueList.some((r) => r.titulo === 'Lembrete vencido' && r.isOverdue === true)).toBe(true);

    const pendingList = await ReminderService.listReminders({
      status: 'pendente',
    });
    expect(pendingList.length).toBeGreaterThanOrEqual(2);
  });

  it('F10.5: Mark reminder as concluido or dispensado updates completedAt', async () => {
    const client = await createTestClient();
    const reminder = await ReminderService.createReminder({
      clientId: client.id,
      titulo: 'Teste de conclusão',
      dataVencimento: new Date(),
    });

    expect(reminder.status).toBe('pendente');
    expect(reminder.completedAt).toBeNull();

    const resolved = await ReminderService.updateReminderStatus(reminder.id, 'concluido');
    expect(resolved.status).toBe('concluido');
    expect(resolved.completedAt).not.toBeNull();

    const dismissed = await ReminderService.updateReminderStatus(reminder.id, 'dispensado');
    expect(dismissed.status).toBe('dispensado');
    expect(dismissed.completedAt).not.toBeNull();
  });

  it('F10.6: getDashboardPixReminders separates overdue and upcoming PIX installment reminders', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const proc = await createTestProcedure({ valorPadrao: 800.0 });
    await AttendanceService.addProcedure(attendanceId, {
      procedureId: proc.id,
      practicedValue: 800.0,
    });

    // Schedule with first installment in the past and second in the future
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const schedule = await PaymentService.createPixInstallmentSchedule(attendanceId, {
      valorTotal: 800.0,
      numeroParcelas: 2,
      primeiroVencimento: pastDate,
      intervaloDias: 30,
    });

    const dashboardFeed = await ReminderService.getDashboardPixReminders();
    expect(dashboardFeed.overdue.length).toBeGreaterThanOrEqual(1);
    expect(dashboardFeed.upcoming.length).toBeGreaterThanOrEqual(1);

    expect(dashboardFeed.overdue.some((r) => r.isOverdue === true)).toBe(true);
    expect(dashboardFeed.upcoming.some((r) => r.isOverdue === false)).toBe(true);
  });
});
