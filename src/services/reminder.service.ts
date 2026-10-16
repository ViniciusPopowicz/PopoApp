// src/services/reminder.service.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateReminderInput,
  UpdateReminderInput,
  ReminderQueryParams,
} from '@/schemas/reminder';
import {
  ReminderDto,
  ReminderStatus,
  DashboardPixRemindersDto,
  ReminderStatsDto,
} from '@/types/reminder';

export class ReminderService {
  /**
   * Formats a raw Prisma Reminder into a ReminderDto with serialized dates and numbers.
   */
  private static formatReminderDto(reminder: any, now: Date = new Date()): ReminderDto {
    const isOverdue = reminder.status === 'pendente' && new Date(reminder.dataVencimento) < now;

    return {
      id: reminder.id,
      clientId: reminder.clientId ?? null,
      pixInstallmentId: reminder.pixInstallmentId ?? null,
      titulo: reminder.titulo,
      descricao: reminder.descricao ?? null,
      dataVencimento: reminder.dataVencimento instanceof Date
        ? reminder.dataVencimento.toISOString()
        : new Date(reminder.dataVencimento).toISOString(),
      prioridade: reminder.prioridade as any,
      status: reminder.status as any,
      tipo: reminder.tipo,
      completedAt: reminder.completedAt
        ? (reminder.completedAt instanceof Date ? reminder.completedAt.toISOString() : new Date(reminder.completedAt).toISOString())
        : null,
      createdAt: reminder.createdAt instanceof Date ? reminder.createdAt.toISOString() : new Date(reminder.createdAt).toISOString(),
      updatedAt: reminder.updatedAt instanceof Date ? reminder.updatedAt.toISOString() : new Date(reminder.updatedAt).toISOString(),
      isOverdue,
      client: reminder.client
        ? {
            id: reminder.client.id,
            nome: reminder.client.nome,
            cpf: reminder.client.cpf,
            telefone: reminder.client.telefone,
          }
        : null,
      pixInstallment: reminder.pixInstallment
        ? {
            id: reminder.pixInstallment.id,
            paymentId: reminder.pixInstallment.paymentId,
            numeroParcela: reminder.pixInstallment.numeroParcela,
            totalParcelas: reminder.pixInstallment.totalParcelas,
            valor: Number(reminder.pixInstallment.valor),
            dataVencimento: reminder.pixInstallment.dataVencimento instanceof Date
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
   * Creates a manual or general reminder (tipo: 'retorno', 'geral', 'aniversario', etc.)
   */
  static async createReminder(data: CreateReminderInput, tx?: Prisma.TransactionClient): Promise<ReminderDto> {
    const db = tx ?? prisma;

    if (data.clientId) {
      const client = await db.client.findUnique({ where: { id: data.clientId } });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    if (data.pixInstallmentId) {
      const installment = await db.pixInstallment.findUnique({ where: { id: data.pixInstallmentId } });
      if (!installment) {
        throw new NotFoundError('Parcela PIX não encontrada');
      }
    }

    const created = await db.reminder.create({
      data: {
        clientId: data.clientId ?? null,
        pixInstallmentId: data.pixInstallmentId ?? null,
        titulo: data.titulo.trim(),
        descricao: data.descricao ? data.descricao.trim() : null,
        dataVencimento: data.dataVencimento,
        prioridade: data.prioridade ?? 'media',
        status: 'pendente',
        tipo: data.tipo ?? 'geral',
        completedAt: null,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
    });

    return this.formatReminderDto(created);
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
        include: {
          client: { select: { id: true, nome: true, cpf: true, telefone: true } },
          pixInstallment: {
            include: {
              payment: { select: { id: true, attendanceId: true } },
            },
          },
        },
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
          include: {
            client: { select: { id: true, nome: true, cpf: true, telefone: true } },
            pixInstallment: {
              include: {
                payment: { select: { id: true, attendanceId: true } },
              },
            },
          },
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
    if (query.pixInstallmentId) where.pixInstallmentId = query.pixInstallmentId;
    if (query.prioridade) where.prioridade = query.prioridade;
    if (query.tipo) where.tipo = query.tipo;

    // Status & overdue filtering
    if (query.status === 'atrasado' || query.overdueOnly) {
      where.status = 'pendente';
      where.dataVencimento = { lt: now };
    } else if (query.status && query.status !== 'todos') {
      where.status = query.status;
    }

    if (query.upcomingDays) {
      const futureLimit = new Date();
      futureLimit.setDate(futureLimit.getDate() + query.upcomingDays);
      where.status = 'pendente';
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
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
      orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.offset,
    });

    return items.map((item) => this.formatReminderDto(item, now));
  }

  /**
   * Retrieves single reminder by ID.
   */
  static async getReminderById(id: string): Promise<ReminderDto> {
    const reminder = await prisma.reminder.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
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
    await this.getReminderById(id);

    if (data.clientId) {
      const client = await prisma.client.findUnique({ where: { id: data.clientId } });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.titulo ? { titulo: data.titulo.trim() } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao ? data.descricao.trim() : null } : {}),
        ...(data.dataVencimento ? { dataVencimento: data.dataVencimento } : {}),
        ...(data.prioridade ? { prioridade: data.prioridade } : {}),
        ...(data.status ? {
          status: data.status,
          completedAt: (data.status === 'concluido' || data.status === 'dispensado') ? new Date() : null,
        } : {}),
        ...(data.tipo ? { tipo: data.tipo } : {}),
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
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
      throw new ValidationError(`Status inválido: ${status}. Permitidos: pendente, concluido, dispensado`);
    }

    await this.getReminderById(id);

    const completedAt = (status === 'concluido' || status === 'dispensado') ? new Date() : null;

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        status,
        completedAt,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
    });

    return this.formatReminderDto(updated);
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
        status: 'pendente',
        tipo: 'parcela_pix',
        dataVencimento: { lt: now },
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
      orderBy: { dataVencimento: 'asc' },
      take: limit,
    });

    const upcoming = await prisma.reminder.findMany({
      where: {
        status: 'pendente',
        tipo: 'parcela_pix',
        dataVencimento: { gte: now },
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true, telefone: true } },
        pixInstallment: {
          include: {
            payment: { select: { id: true, attendanceId: true } },
          },
        },
      },
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
      prisma.reminder.count({ where: { status: 'pendente' } }),
      prisma.reminder.count({ where: { status: 'concluido' } }),
      prisma.reminder.count({ where: { status: 'dispensado' } }),
      prisma.reminder.count({ where: { status: 'pendente', dataVencimento: { lt: now } } }),
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
