// src/services/reminder.service.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateReminderInput,
  UpdateReminderInput,
  CreateReminderRecurrenceInput,
  UpdateReminderRecurrenceInput,
  ReminderQueryParams,
} from '@/schemas/reminder';
import {
  ReminderDto,
  ReminderRecurrenceDto,
  ReminderStatus,
  RecurrenceFrequency,
  DashboardPixRemindersDto,
  ReminderStatsDto,
} from '@/types/reminder';

function daysInUtcMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

export class ReminderService {
  /**
   * Deterministically computes the due date of occurrence #occurrenceIndex (1-based)
   * anchored to dataInicio without month-end or leap-year drift.
   */
  static computeOccurrenceDate(
    anchorDate: Date,
    frequencia: RecurrenceFrequency,
    intervalo: number,
    occurrenceIndex: number
  ): Date {
    if (intervalo < 1) {
      throw new ValidationError('O intervalo de recorrência deve ser de no mínimo 1');
    }
    if (occurrenceIndex < 1) {
      throw new ValidationError('O índice de ocorrência deve ser de no mínimo 1');
    }

    const start = new Date(anchorDate);
    if (occurrenceIndex === 1) {
      return start;
    }

    const steps = (occurrenceIndex - 1) * intervalo;
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth();
    const day = start.getUTCDate();
    const hours = start.getUTCHours();
    const minutes = start.getUTCMinutes();
    const seconds = start.getUTCSeconds();
    const ms = start.getUTCMilliseconds();

    if (frequencia === 'DIARIA') {
      return new Date(Date.UTC(year, month, day + steps, hours, minutes, seconds, ms));
    }

    if (frequencia === 'SEMANAL') {
      return new Date(Date.UTC(year, month, day + steps * 7, hours, minutes, seconds, ms));
    }

    if (frequencia === 'MENSAL') {
      const totalMonths = year * 12 + month + steps;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;
      const clampedDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
      return new Date(Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds, ms));
    }

    if (frequencia === 'ANUAL') {
      const targetYear = year + steps;
      const clampedDay = Math.min(day, daysInUtcMonth(targetYear, month));
      return new Date(Date.UTC(targetYear, month, clampedDay, hours, minutes, seconds, ms));
    }

    throw new ValidationError(`Frequência de recorrência inválida: ${frequencia}`);
  }

  /**
   * Validates existence and relational consistency across optional clientId, appointmentId, attendanceId, and pixInstallmentId.
   */
  private static async validateAndResolveLinks(
    input: {
      clientId?: string | null;
      appointmentId?: string | null;
      attendanceId?: string | null;
      pixInstallmentId?: string | null;
    },
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{
    clientId: string | null;
    appointmentId: string | null;
    attendanceId: string | null;
    pixInstallmentId: string | null;
  }> {
    let resolvedClientId = input.clientId ?? null;
    let resolvedAppointmentId = input.appointmentId ?? null;
    let resolvedAttendanceId = input.attendanceId ?? null;
    const resolvedPixInstallmentId = input.pixInstallmentId ?? null;

    if (resolvedClientId) {
      const client = await db.client.findUnique({
        where: { id: resolvedClientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    if (resolvedAppointmentId) {
      const appointment = await db.appointment.findUnique({
        where: { id: resolvedAppointmentId },
        select: { id: true, clientId: true },
      });
      if (!appointment) {
        throw new NotFoundError('Agendamento não encontrado');
      }
      if (resolvedClientId && appointment.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do agendamento');
      }
      resolvedClientId = appointment.clientId;
    }

    if (resolvedAttendanceId) {
      const attendance = await db.attendance.findUnique({
        where: { id: resolvedAttendanceId },
        select: { id: true, clientId: true, appointmentId: true },
      });
      if (!attendance) {
        throw new NotFoundError('Atendimento não encontrado');
      }
      if (resolvedClientId && attendance.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do atendimento');
      }
      if (resolvedAppointmentId && attendance.appointmentId !== resolvedAppointmentId) {
        throw new ValidationError('O atendimento informado não pertence ao agendamento especificado');
      }
      resolvedClientId = attendance.clientId;
      if (!resolvedAppointmentId && attendance.appointmentId) {
        resolvedAppointmentId = attendance.appointmentId;
      }
    }

    if (resolvedPixInstallmentId) {
      const installment = await db.pixInstallment.findUnique({
        where: { id: resolvedPixInstallmentId },
        include: {
          payment: {
            include: {
              attendance: { select: { id: true, clientId: true, appointmentId: true } },
            },
          },
        },
      });
      if (!installment) {
        throw new NotFoundError('Parcela PIX não encontrada');
      }
      const instAttendance = installment.payment?.attendance;
      const instClientId = instAttendance?.clientId;
      const instAttendanceId = instAttendance?.id;
      const instAppointmentId = instAttendance?.appointmentId ?? null;

      if (resolvedClientId && instClientId && instClientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente da parcela PIX');
      }
      if (resolvedAttendanceId && instAttendanceId && instAttendanceId !== resolvedAttendanceId) {
        throw new ValidationError('O atendimento informado não corresponde ao atendimento da parcela PIX');
      }
      if (resolvedAppointmentId && instAppointmentId !== resolvedAppointmentId) {
        throw new ValidationError('O agendamento informado não corresponde ao agendamento da parcela PIX');
      }

      if (!resolvedClientId && instClientId) {
        resolvedClientId = instClientId;
      }
      if (!resolvedAttendanceId && instAttendanceId) {
        resolvedAttendanceId = instAttendanceId;
      }
      if (!resolvedAppointmentId && instAppointmentId) {
        resolvedAppointmentId = instAppointmentId;
      }
    }

    return {
      clientId: resolvedClientId,
      appointmentId: resolvedAppointmentId,
      attendanceId: resolvedAttendanceId,
      pixInstallmentId: resolvedPixInstallmentId,
    };
  }

  private static get defaultReminderInclude() {
    return {
      client: { select: { id: true, nome: true, cpf: true, telefone: true } },
      appointment: { select: { id: true, dataHora: true, status: true } },
      attendance: { select: { id: true, dataHora: true, status: true } },
      pixInstallment: {
        include: {
          payment: { select: { id: true, attendanceId: true } },
        },
      },
    };
  }

  /**
   * Formats a raw Prisma Reminder into a ReminderDto with serialized dates and numbers.
   */
  private static formatReminderDto(reminder: any, now: Date = new Date()): ReminderDto {
    const normalizedStatus = (reminder.status || 'pendente').toLowerCase() as ReminderStatus;
    const isOverdue = normalizedStatus === 'pendente' && new Date(reminder.dataVencimento) < now;

    return {
      id: reminder.id,
      clientId: reminder.clientId ?? null,
      appointmentId: reminder.appointmentId ?? null,
      attendanceId: reminder.attendanceId ?? null,
      pixInstallmentId: reminder.pixInstallmentId ?? null,
      recurrenceId: reminder.recurrenceId ?? null,
      occurrenceIndex: reminder.occurrenceIndex ?? null,
      titulo: reminder.titulo,
      descricao: reminder.descricao ?? null,
      dataVencimento:
        reminder.dataVencimento instanceof Date
          ? reminder.dataVencimento.toISOString()
          : new Date(reminder.dataVencimento).toISOString(),
      prioridade: reminder.prioridade as any,
      status: normalizedStatus,
      tipo: reminder.tipo,
      completedAt: reminder.completedAt
        ? reminder.completedAt instanceof Date
          ? reminder.completedAt.toISOString()
          : new Date(reminder.completedAt).toISOString()
        : null,
      createdAt:
        reminder.createdAt instanceof Date
          ? reminder.createdAt.toISOString()
          : new Date(reminder.createdAt).toISOString(),
      updatedAt:
        reminder.updatedAt instanceof Date
          ? reminder.updatedAt.toISOString()
          : new Date(reminder.updatedAt).toISOString(),
      isOverdue,
      client: reminder.client
        ? {
            id: reminder.client.id,
            nome: reminder.client.nome,
            cpf: reminder.client.cpf,
            telefone: reminder.client.telefone,
          }
        : null,
      appointment: reminder.appointment
        ? {
            id: reminder.appointment.id,
            dataHora:
              reminder.appointment.dataHora instanceof Date
                ? reminder.appointment.dataHora.toISOString()
                : new Date(reminder.appointment.dataHora).toISOString(),
            status: reminder.appointment.status,
          }
        : null,
      attendance: reminder.attendance
        ? {
            id: reminder.attendance.id,
            dataHora:
              reminder.attendance.dataHora instanceof Date
                ? reminder.attendance.dataHora.toISOString()
                : new Date(reminder.attendance.dataHora).toISOString(),
            status: reminder.attendance.status,
          }
        : null,
      pixInstallment: reminder.pixInstallment
        ? {
            id: reminder.pixInstallment.id,
            paymentId: reminder.pixInstallment.paymentId,
            numeroParcela: reminder.pixInstallment.numeroParcela,
            totalParcelas: reminder.pixInstallment.totalParcelas,
            valor: Number(reminder.pixInstallment.valor),
            dataVencimento:
              reminder.pixInstallment.dataVencimento instanceof Date
                ? reminder.pixInstallment.dataVencimento.toISOString()
                : new Date(reminder.pixInstallment.dataVencimento).toISOString(),
            status: reminder.pixInstallment.status,
            payment: reminder.pixInstallment.payment
              ? {
                  id: reminder.pixInstallment.payment.id,
                  attendanceId: reminder.pixInstallment.payment.attendanceId,
                }
              : undefined,
          }
        : null,
    };
  }

  /**
   * Formats a raw Prisma ReminderRecurrence into ReminderRecurrenceDto.
   */
  private static formatRecurrenceDto(raw: any, now: Date = new Date()): ReminderRecurrenceDto {
    return {
      id: raw.id,
      clientId: raw.clientId ?? null,
      appointmentId: raw.appointmentId ?? null,
      attendanceId: raw.attendanceId ?? null,
      titulo: raw.titulo,
      descricao: raw.descricao ?? null,
      tipo: raw.tipo,
      prioridade: raw.prioridade as any,
      frequencia: raw.frequencia as RecurrenceFrequency,
      intervalo: raw.intervalo,
      dataInicio: new Date(raw.dataInicio).toISOString(),
      dataFim: raw.dataFim ? new Date(raw.dataFim).toISOString() : null,
      maxOcorrencias: raw.maxOcorrencias ?? null,
      ocorrenciasGeradas: raw.ocorrenciasGeradas ?? 0,
      ultimaGeracaoEm: raw.ultimaGeracaoEm ? new Date(raw.ultimaGeracaoEm).toISOString() : null,
      proximaOcorrenciaEm: raw.proximaOcorrenciaEm
        ? new Date(raw.proximaOcorrenciaEm).toISOString()
        : null,
      isActive: Boolean(raw.isActive),
      createdAt: new Date(raw.createdAt).toISOString(),
      updatedAt: new Date(raw.updatedAt).toISOString(),
      client: raw.client ? { id: raw.client.id, nome: raw.client.nome } : null,
      appointment: raw.appointment
        ? {
            id: raw.appointment.id,
            dataHora: new Date(raw.appointment.dataHora).toISOString(),
            status: raw.appointment.status,
          }
        : null,
      attendance: raw.attendance
        ? {
            id: raw.attendance.id,
            dataHora: new Date(raw.attendance.dataHora).toISOString(),
            status: raw.attendance.status,
          }
        : null,
      occurrences: raw.reminders
        ? raw.reminders.map((r: any) => this.formatReminderDto(r, now))
        : undefined,
    };
  }

  /**
   * Creates a manual or general reminder (standalone, client-linked, appointment-linked, attendance-linked, or Pix-linked).
   */
  static async createReminder(
    data: CreateReminderInput,
    tx?: Prisma.TransactionClient
  ): Promise<ReminderDto> {
    const db = tx ?? prisma;

    const links = await this.validateAndResolveLinks(
      {
        clientId: data.clientId,
        appointmentId: data.appointmentId,
        attendanceId: data.attendanceId,
        pixInstallmentId: data.pixInstallmentId,
      },
      db
    );

    const created = await db.reminder.create({
      data: {
        clientId: links.clientId,
        appointmentId: links.appointmentId,
        attendanceId: links.attendanceId,
        pixInstallmentId: links.pixInstallmentId,
        titulo: data.titulo.trim(),
        descricao: data.descricao ? data.descricao.trim() : null,
        dataVencimento: data.dataVencimento,
        prioridade: data.prioridade ?? 'media',
        status: 'pendente',
        tipo: data.tipo ?? 'geral',
        completedAt: null,
      },
      include: this.defaultReminderInclude,
    });

    return this.formatReminderDto(created);
  }

  /**
   * Creates a recurring reminder definition (ReminderRecurrence) and generates any immediately due occurrences.
   */
  static async createRecurrence(
    input: CreateReminderRecurrenceInput,
    referenceDate: Date = new Date()
  ): Promise<ReminderRecurrenceDto> {
    const intervalo = input.intervalo ?? 1;
    if (intervalo < 1) {
      throw new ValidationError('O intervalo de recorrência deve ser de no mínimo 1');
    }
    if (input.dataFim && new Date(input.dataFim) < new Date(input.dataInicio)) {
      throw new ValidationError('A data de término não pode ser anterior à data de início');
    }
    if (input.maxOcorrencias !== undefined && input.maxOcorrencias !== null && input.maxOcorrencias < 1) {
      throw new ValidationError('O número máximo de ocorrências deve ser de no mínimo 1');
    }

    const links = await this.validateAndResolveLinks({
      clientId: input.clientId,
      appointmentId: input.appointmentId,
      attendanceId: input.attendanceId,
    });

    const created = await prisma.reminderRecurrence.create({
      data: {
        clientId: links.clientId,
        appointmentId: links.appointmentId,
        attendanceId: links.attendanceId,
        titulo: input.titulo.trim(),
        descricao: input.descricao ? input.descricao.trim() : null,
        tipo: input.tipo ?? 'retorno',
        prioridade: input.prioridade ?? 'media',
        frequencia: input.frequencia,
        intervalo: input.intervalo ?? 1,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim ?? null,
        maxOcorrencias: input.maxOcorrencias ?? null,
        ocorrenciasGeradas: 0,
        proximaOcorrenciaEm: input.dataInicio,
        isActive: input.isActive ?? true,
      },
    });

    if (created.isActive) {
      await this.generateDueOccurrencesForRecurrence(created.id, referenceDate);
    }

    return this.getRecurrenceById(created.id);
  }

  /**
   * Deterministically generates due occurrences up to referenceDate for a single recurrence definition.
   * Idempotent: checks existing (recurrenceId, occurrenceIndex) and never duplicates or alters past occurrences.
   */
  static async generateDueOccurrencesForRecurrence(
    recurrenceId: string,
    referenceDate: Date = new Date()
  ): Promise<{ createdCount: number; createdReminders: ReminderDto[] }> {
    const createdReminders: ReminderDto[] = [];

    await prisma.$transaction(async (tx) => {
      const rec = await tx.reminderRecurrence.findUnique({
        where: { id: recurrenceId },
        include: {
          reminders: {
            select: { id: true, occurrenceIndex: true },
          },
        },
      });

      if (!rec || !rec.isActive) {
        return;
      }

      const existingIndices = new Set<number>(
        rec.reminders
          .map((r) => r.occurrenceIndex)
          .filter((idx): idx is number => typeof idx === 'number')
      );

      const anchorDate = new Date(rec.dataInicio);
      const endDate = rec.dataFim ? new Date(rec.dataFim) : null;
      const maxOccurrences = rec.maxOcorrencias ?? null;
      const frequencia = rec.frequencia as RecurrenceFrequency;
      const intervalo = rec.intervalo;

      let index = 1;
      let nextFutureDueDate: Date | null = null;
      let highestIndex = existingIndices.size > 0 ? Math.max(...Array.from(existingIndices)) : 0;

      // Safety cap of 2000 iterations per call to prevent runaway loops
      const MAX_SAFETY_CAP = 2000;

      while (index <= MAX_SAFETY_CAP) {
        if (maxOccurrences !== null && index > maxOccurrences) {
          nextFutureDueDate = null;
          break;
        }

        const occurrenceDueDate = this.computeOccurrenceDate(
          anchorDate,
          frequencia,
          intervalo,
          index
        );

        if (endDate && occurrenceDueDate > endDate) {
          nextFutureDueDate = null;
          break;
        }

        if (occurrenceDueDate > referenceDate) {
          nextFutureDueDate = occurrenceDueDate;
          break;
        }

        if (!existingIndices.has(index)) {
          const created = await tx.reminder.create({
            data: {
              clientId: rec.clientId,
              appointmentId: rec.appointmentId,
              attendanceId: rec.attendanceId,
              recurrenceId: rec.id,
              occurrenceIndex: index,
              titulo: rec.titulo,
              descricao: rec.descricao,
              dataVencimento: occurrenceDueDate,
              prioridade: rec.prioridade,
              status: 'pendente',
              tipo: rec.tipo,
            },
            include: this.defaultReminderInclude,
          });
          existingIndices.add(index);
          if (index > highestIndex) highestIndex = index;
          createdReminders.push(this.formatReminderDto(created, referenceDate));
        }

        index++;
      }

      const totalGenerated = existingIndices.size;

      await tx.reminderRecurrence.update({
        where: { id: rec.id },
        data: {
          ocorrenciasGeradas: totalGenerated,
          ultimaGeracaoEm: createdReminders.length > 0 ? referenceDate : rec.ultimaGeracaoEm,
          proximaOcorrenciaEm: nextFutureDueDate,
        },
      });
    });

    return {
      createdCount: createdReminders.length,
      createdReminders,
    };
  }

  /**
   * Processes all active recurrence definitions and generates any due occurrences up to referenceDate.
   * Safe for missed runs and repeated/concurrent invocations.
   */
  static async generateDueOccurrences(referenceDate: Date = new Date()): Promise<{
    processedRecurrences: number;
    generatedCount: number;
    generatedReminders: ReminderDto[];
  }> {
    const activeRecurrences = await prisma.reminderRecurrence.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let generatedCount = 0;
    const generatedReminders: ReminderDto[] = [];

    for (const rec of activeRecurrences) {
      const res = await this.generateDueOccurrencesForRecurrence(rec.id, referenceDate);
      generatedCount += res.createdCount;
      generatedReminders.push(...res.createdReminders);
    }

    return {
      processedRecurrences: activeRecurrences.length,
      generatedCount,
      generatedReminders,
    };
  }

  /**
   * Retrieves a recurrence definition by ID with its generated reminder occurrences.
   */
  static async getRecurrenceById(id: string): Promise<ReminderRecurrenceDto> {
    const rec = await prisma.reminderRecurrence.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true } },
        appointment: { select: { id: true, dataHora: true, status: true } },
        attendance: { select: { id: true, dataHora: true, status: true } },
        reminders: {
          include: this.defaultReminderInclude,
          orderBy: { occurrenceIndex: 'asc' },
        },
      },
    });

    if (!rec) {
      throw new NotFoundError('Regra de recorrência não encontrada');
    }

    return this.formatRecurrenceDto(rec);
  }

  /**
   * Lists recurrence definitions.
   */
  static async listRecurrences(filters?: {
    clientId?: string;
    appointmentId?: string;
    attendanceId?: string;
    isActive?: boolean;
  }): Promise<ReminderRecurrenceDto[]> {
    const where: Prisma.ReminderRecurrenceWhereInput = {
      ...(filters?.clientId ? { clientId: filters.clientId } : {}),
      ...(filters?.appointmentId ? { appointmentId: filters.appointmentId } : {}),
      ...(filters?.attendanceId ? { attendanceId: filters.attendanceId } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };

    const items = await prisma.reminderRecurrence.findMany({
      where,
      include: {
        client: { select: { id: true, nome: true } },
        appointment: { select: { id: true, dataHora: true, status: true } },
        attendance: { select: { id: true, dataHora: true, status: true } },
        reminders: {
          include: this.defaultReminderInclude,
          orderBy: { occurrenceIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((r) => this.formatRecurrenceDto(r));
  }

  /**
   * Updates a recurrence definition.
   */
  static async updateRecurrence(
    id: string,
    input: UpdateReminderRecurrenceInput,
    referenceDate: Date = new Date()
  ): Promise<ReminderRecurrenceDto> {
    const existing = await prisma.reminderRecurrence.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Regra de recorrência não encontrada');
    }

    if (input.dataFim && new Date(input.dataFim) < new Date(existing.dataInicio)) {
      throw new ValidationError('A data de término não pode ser anterior à data de início');
    }

    const nextIsActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    await prisma.reminderRecurrence.update({
      where: { id },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo.trim() } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao ? input.descricao.trim() : null } : {}),
        ...(input.prioridade !== undefined ? { prioridade: input.prioridade } : {}),
        ...(input.frequencia !== undefined ? { frequencia: input.frequencia } : {}),
        ...(input.intervalo !== undefined ? { intervalo: input.intervalo } : {}),
        ...(input.dataFim !== undefined ? { dataFim: input.dataFim } : {}),
        ...(input.maxOcorrencias !== undefined ? { maxOcorrencias: input.maxOcorrencias } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(!nextIsActive ? { proximaOcorrenciaEm: null } : {}),
      },
    });

    if (nextIsActive) {
      await this.generateDueOccurrencesForRecurrence(id, referenceDate);
    }

    return this.getRecurrenceById(id);
  }

  /**
   * Disables/stops a recurrence rule so no future occurrences are generated while preserving historical occurrences.
   */
  static async disableRecurrence(id: string): Promise<ReminderRecurrenceDto> {
    const existing = await prisma.reminderRecurrence.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Regra de recorrência não encontrada');
    }

    await prisma.reminderRecurrence.update({
      where: { id },
      data: {
        isActive: false,
        proximaOcorrenciaEm: null,
      },
    });

    return this.getRecurrenceById(id);
  }

  /**
   * Generates reminders automatically for an agreed PIX installment plan (V22, D5).
   * Strictly idempotent: will not create duplicate reminders for the same installment.
   */
  static async generateRemindersForPixInstallments(
    installments: Array<{
      id: string;
      numeroParcela: number;
      totalParcelas: number;
      valor: number | Prisma.Decimal;
      dataVencimento: Date;
    }>,
    clientId: string,
    tx?: Prisma.TransactionClient
  ): Promise<ReminderDto[]> {
    const db = tx ?? prisma;
    const reminders: ReminderDto[] = [];

    for (const inst of installments) {
      const existing = await db.reminder.findFirst({
        where: { pixInstallmentId: inst.id },
        include: this.defaultReminderInclude,
      });

      if (!existing) {
        const valFormatted = Number(inst.valor).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });

        const created = await db.reminder.create({
          data: {
            clientId,
            pixInstallmentId: inst.id,
            titulo: `Parcela ${inst.numeroParcela}/${inst.totalParcelas} - PIX (${valFormatted})`,
            descricao: `Vencimento da parcela ${inst.numeroParcela} de ${inst.totalParcelas} acordada no valor de ${valFormatted}.`,
            dataVencimento: inst.dataVencimento,
            prioridade: 'media',
            status: 'pendente',
            tipo: 'parcela_pix',
          },
          include: this.defaultReminderInclude,
        });
        reminders.push(this.formatReminderDto(created));
      } else {
        reminders.push(this.formatReminderDto(existing));
      }
    }

    return reminders;
  }

  /**
   * Lists reminders with comprehensive filtering, status tabs, and overdue detection.
   */
  static async listReminders(query: ReminderQueryParams): Promise<ReminderDto[]> {
    const now = new Date();
    const where: Prisma.ReminderWhereInput = {};

    if (query.clientId) where.clientId = query.clientId;
    if (query.appointmentId) where.appointmentId = query.appointmentId;
    if (query.attendanceId) where.attendanceId = query.attendanceId;
    if (query.pixInstallmentId) where.pixInstallmentId = query.pixInstallmentId;
    if (query.recurrenceId) where.recurrenceId = query.recurrenceId;
    if (query.prioridade) where.prioridade = query.prioridade;
    if (query.tipo) where.tipo = query.tipo;

    // Status & overdue filtering
    if (query.status === 'atrasado' || query.overdueOnly) {
      where.status = { in: ['pendente', 'Pendente'] };
      where.dataVencimento = { lt: now };
    } else if (query.status && query.status !== 'todos') {
      if (query.status === 'pendente') {
        where.status = { in: ['pendente', 'Pendente'] };
      } else if (query.status === 'concluido') {
        where.status = { in: ['concluido', 'Concluido', 'Concluído'] };
      } else if (query.status === 'dispensado') {
        where.status = { in: ['dispensado', 'Dispensado'] };
      } else {
        where.status = query.status;
      }
    }

    if (query.upcomingDays) {
      const futureLimit = new Date();
      futureLimit.setDate(futureLimit.getDate() + query.upcomingDays);
      where.status = { in: ['pendente', 'Pendente'] };
      where.dataVencimento = { gte: now, lte: futureLimit };
    }

    if (query.startDate || query.endDate) {
      where.dataVencimento = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    const items = await prisma.reminder.findMany({
      where,
      include: this.defaultReminderInclude,
      orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });

    return items.map((item) => this.formatReminderDto(item, now));
  }

  /**
   * Retrieves single reminder by ID.
   */
  static async getReminderById(id: string): Promise<ReminderDto> {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: this.defaultReminderInclude,
    });

    if (!reminder) {
      throw new NotFoundError('Lembrete não encontrado');
    }

    return this.formatReminderDto(reminder);
  }

  /**
   * Updates reminder fields.
   */
  static async updateReminder(id: string, data: UpdateReminderInput): Promise<ReminderDto> {
    const existing = await this.getReminderById(id);

    const nextClientId = data.clientId !== undefined ? data.clientId : existing.clientId;
    const nextAppointmentId =
      data.appointmentId !== undefined ? data.appointmentId : existing.appointmentId;
    const nextAttendanceId =
      data.attendanceId !== undefined ? data.attendanceId : existing.attendanceId;

    const links = await this.validateAndResolveLinks({
      clientId: nextClientId,
      appointmentId: nextAppointmentId,
      attendanceId: nextAttendanceId,
      pixInstallmentId: existing.pixInstallmentId,
    });

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        clientId: links.clientId,
        appointmentId: links.appointmentId,
        attendanceId: links.attendanceId,
        ...(data.titulo ? { titulo: data.titulo.trim() } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao ? data.descricao.trim() : null } : {}),
        ...(data.dataVencimento ? { dataVencimento: data.dataVencimento } : {}),
        ...(data.prioridade ? { prioridade: data.prioridade } : {}),
        ...(data.status
          ? {
              status: data.status,
              completedAt:
                data.status === 'concluido' || data.status === 'dispensado' ? new Date() : null,
            }
          : {}),
        ...(data.tipo ? { tipo: data.tipo } : {}),
      },
      include: this.defaultReminderInclude,
    });

    return this.formatReminderDto(updated);
  }

  /**
   * CRITICAL INVARIANT (V23, D5, AC 68):
   * Marking a reminder as 'concluido' or 'dispensado' updates ONLY the reminder.
   * It strictly NEVER mutates PixInstallment.status, Payment.status, or any financial balance!
   */
  static async updateReminderStatus(id: string, status: ReminderStatus): Promise<ReminderDto> {
    const validStatuses = ['pendente', 'concluido', 'dispensado'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Status inválido: ${status}. Permitidos: pendente, concluido, dispensado`
      );
    }

    await this.getReminderById(id);

    const completedAt = status === 'concluido' || status === 'dispensado' ? new Date() : null;

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        status,
        completedAt,
      },
      include: this.defaultReminderInclude,
    });

    return this.formatReminderDto(updated);
  }

  static async completeReminder(id: string): Promise<ReminderDto> {
    return this.updateReminderStatus(id, 'concluido');
  }

  static async dismissReminder(id: string): Promise<ReminderDto> {
    return this.updateReminderStatus(id, 'dispensado');
  }

  /**
   * Deletes a reminder.
   */
  static async deleteReminder(id: string): Promise<{ success: boolean }> {
    await this.getReminderById(id);
    await prisma.reminder.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Fetches dashboard upcoming and overdue PIX installment reminders feed (D5, AC 68).
   */
  static async getDashboardPixReminders(limit = 10): Promise<DashboardPixRemindersDto> {
    const now = new Date();

    const overdue = await prisma.reminder.findMany({
      where: {
        status: { in: ['pendente', 'Pendente'] },
        tipo: 'parcela_pix',
        dataVencimento: { lt: now },
      },
      include: this.defaultReminderInclude,
      orderBy: { dataVencimento: 'asc' },
      take: limit,
    });

    const upcoming = await prisma.reminder.findMany({
      where: {
        status: { in: ['pendente', 'Pendente'] },
        tipo: 'parcela_pix',
        dataVencimento: { gte: now },
      },
      include: this.defaultReminderInclude,
      orderBy: { dataVencimento: 'asc' },
      take: limit,
    });

    return {
      overdue: overdue.map((r) => this.formatReminderDto(r, now)),
      upcoming: upcoming.map((r) => this.formatReminderDto(r, now)),
    };
  }

  /**
   * Returns statistics counts across reminder statuses for UI badges and tabs.
   */
  static async getReminderStats(): Promise<ReminderStatsDto> {
    const now = new Date();

    const [total, pendentes, concluidos, dispensados, atrasados] = await Promise.all([
      prisma.reminder.count(),
      prisma.reminder.count({ where: { status: { in: ['pendente', 'Pendente'] } } }),
      prisma.reminder.count({ where: { status: { in: ['concluido', 'Concluido', 'Concluído'] } } }),
      prisma.reminder.count({ where: { status: { in: ['dispensado', 'Dispensado'] } } }),
      prisma.reminder.count({
        where: { status: { in: ['pendente', 'Pendente'] }, dataVencimento: { lt: now } },
      }),
    ]);

    return {
      total,
      pendentes,
      concluidos,
      dispensados,
      atrasados,
    };
  }

  /**
   * Self-healing sync: scans all pending PixInstallments without reminders and generates them.
   */
  static async syncPixInstallmentReminders() {
    const unlinkedInstallments = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        reminders: { none: {} },
      },
      include: {
        payment: {
          include: {
            attendance: { select: { clientId: true } },
          },
        },
      },
    });

    let generatedCount = 0;
    for (const inst of unlinkedInstallments) {
      const clientId = inst.payment.attendance.clientId;
      await this.generateRemindersForPixInstallments([inst], clientId);
      generatedCount++;
    }

    return { generatedCount };
  }
}
