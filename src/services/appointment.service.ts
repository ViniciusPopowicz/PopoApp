import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  CancelAppointmentInput,
  NoShowAppointmentInput,
  RescheduleAppointmentInput,
  AppointmentListQuery,
} from '@/schemas/appointment';
import { PROHIBITED_APPOINTMENT_STATUSES } from '@/types/appointment';

export class AppointmentService {
  private static withCompatAttendances<T>(
    appt: T
  ): T & { attendance: any; attendances: any[]; plannedProcedures?: any[] } {
    return {
      ...(appt as any),
      attendance: (appt as any)?.attendance ?? null,
      attendances: (appt as any)?.attendance ? [(appt as any).attendance] : [],
      plannedProcedures: (appt as any)?.plannedProcedures ?? [],
    };
  }

  /**
   * Creates an Appointment and automatically creates its single linked Attendance in status 'Pendente' (1:1, D1, V07).
   * Supports planned procedures (D3).
   */
  static async createAppointment(data: CreateAppointmentInput) {
    // 1. Verify client exists and is active (V01)
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, status: true, nome: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }
    if (client.status !== 'ativo') {
      throw new ValidationError('Não é possível agendar para um cliente inativo');
    }

    // 2. Validate planned procedures if provided
    let plannedProceduresToCreate: { procedureId: string; ordem: number; valorPadrao: Prisma.Decimal }[] = [];
    let calculatedEstimatedValue =
      data.valorEstimado !== undefined && data.valorEstimado !== null
        ? new Prisma.Decimal(data.valorEstimado)
        : new Prisma.Decimal(0);

    if (data.plannedProcedureIds && data.plannedProcedureIds.length > 0) {
      const procedures = await prisma.procedure.findMany({
        where: { id: { in: data.plannedProcedureIds }, isActive: true },
        select: { id: true, valorPadrao: true },
      });

      if (procedures.length !== data.plannedProcedureIds.length) {
        throw new ValidationError('Um ou mais procedimentos planejados são inválidos ou estão inativos');
      }

      const procMap = new Map(procedures.map((p) => [p.id, p.valorPadrao]));
      plannedProceduresToCreate = data.plannedProcedureIds.map((procId, index) => ({
        procedureId: procId,
        ordem: index,
        valorPadrao: procMap.get(procId)!,
      }));

      // If user did not provide an estimated value, auto-sum standard values of planned procedures
      if (data.valorEstimado === undefined || data.valorEstimado === null) {
        calculatedEstimatedValue = plannedProceduresToCreate.reduce(
          (acc, p) => acc.add(p.valorPadrao),
          new Prisma.Decimal(0)
        );
      }
    }

    // 3. Execute atomic transaction (Appointment + PlannedProcedures + 1:1 Attendance [Pendente])
    return await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          clientId: data.clientId,
          dataHora: data.dataHora,
          status: 'Agendado',
          valorEstimado: calculatedEstimatedValue,
          observacoes: data.observacoes ? data.observacoes.trim() : null,
          plannedProcedures: {
            create: plannedProceduresToCreate.map((p) => ({
              procedureId: p.procedureId,
              ordem: p.ordem,
            })),
          },
          attendance: {
            create: {
              clientId: data.clientId,
              status: 'Pendente', // CRITICAL D1: Always starts as Pendente, never Realizado
              dataHora: data.dataHora,
              desconto: new Prisma.Decimal(0),
              observacoes: 'Atendimento gerado automaticamente pelo agendamento',
              ...(data.prefillAttendance && plannedProceduresToCreate.length > 0
                ? {
                    procedures: {
                      create: plannedProceduresToCreate.map((p) => ({
                        procedureId: p.procedureId,
                        standardValueSnapshot: p.valorPadrao, // Snapshot V09
                        practicedValue: p.valorPadrao, // Practiced value V08
                      })),
                    },
                  }
                : {}),
            },
          },
        },
        include: {
          client: { select: { id: true, nome: true, telefone: true, cpf: true } },
          plannedProcedures: {
            include: { procedure: { select: { id: true, nome: true, duracaoMinutos: true, valorPadrao: true } } },
            orderBy: { ordem: 'asc' },
          },
          attendance: true,
        },
      });

      return this.withCompatAttendances(appointment);
    });
  }

  /**
   * Retrieves an appointment by ID with full relational context.
   */
  static async getAppointmentById(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true, telefone: true, email: true, cpf: true } },
        plannedProcedures: {
          include: { procedure: true },
          orderBy: { ordem: 'asc' },
        },
        attendance: {
          include: {
            procedures: { include: { procedure: true } },
            payments: {
              include: { pixInstallments: true },
            },
          },
        },
        rescheduledFrom: { select: { id: true, dataHora: true, status: true } },
        rescheduledTo: { select: { id: true, dataHora: true, status: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    return this.withCompatAttendances(appointment);
  }

  /**
   * Lists appointments filtered by date range, client, and status.
   */
  static async listAppointments(query: AppointmentListQuery) {
    const where: Prisma.AppointmentWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.status && query.status !== 'todos' ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            dataHora: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [total, rawItems] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataHora: 'asc' },
        include: {
          client: { select: { id: true, nome: true, telefone: true, cpf: true } },
          plannedProcedures: {
            include: { procedure: { select: { id: true, nome: true, duracaoMinutos: true } } },
            orderBy: { ordem: 'asc' },
          },
          attendance: {
            select: { id: true, status: true, completedAt: true },
          },
        },
      }),
    ]);

    const items = rawItems.map((item) => this.withCompatAttendances(item));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Updates general fields of an appointment.
   */
  static async updateAppointment(id: string, input: UpdateAppointmentInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (input.status && PROHIBITED_APPOINTMENT_STATUSES.includes(input.status as any)) {
      throw new ValidationError('Status de agendamento inválido. "Em atendimento" não é permitido.');
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(input.dataHora ? { dataHora: input.dataHora } : {}),
        ...(input.valorEstimado !== undefined
          ? { valorEstimado: input.valorEstimado !== null ? new Prisma.Decimal(input.valorEstimado) : null }
          : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes ? input.observacoes.trim() : null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: {
        client: true,
        plannedProcedures: { include: { procedure: true } },
        attendance: true,
      },
    });

    return this.withCompatAttendances(updated);
  }

  /**
   * Manually confirms an appointment (transitions from 'Agendado' to 'Confirmado').
   */
  static async confirmAppointment(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { client: true, attendance: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appointment.status === 'Confirmado') {
      return this.withCompatAttendances(appointment); // Idempotent
    }

    if (appointment.status !== 'Agendado') {
      throw new ValidationError(`Não é possível confirmar um agendamento com status "${appointment.status}"`);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'Confirmado' },
      include: { client: true, attendance: true },
    });

    return this.withCompatAttendances(updated);
  }

  /**
   * Cancels an appointment and automatically cascades status 'Cancelado' to its linked pending attendance (D1 Rule 2).
   * Attendance already 'Realizado' is left intact (D1 Rule 5).
   */
  static async cancelAppointment(id: string, input: CancelAppointmentInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado'].includes(appointment.status)) {
      throw new ValidationError(`Agendamento não pode ser cancelado porque já está "${appointment.status}"`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update appointment to Cancelado with cancellation reason
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: 'Cancelado',
          motivoCancelamento: input.motivoCancelamento.trim(),
        },
      });

      // 2. Cascade Cancelado to pending attendance ONLY (D1 Rule 2 & 5)
      const pendingAtt = await tx.attendance.findFirst({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        select: { id: true },
      });

      await tx.attendance.updateMany({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      const reminderOrConditions: Prisma.ReminderWhereInput[] = [{ appointmentId: id }];
      const recurrenceOrConditions: Prisma.ReminderRecurrenceWhereInput[] = [{ appointmentId: id }];
      if (pendingAtt) {
        reminderOrConditions.push({ attendanceId: pendingAtt.id });
        recurrenceOrConditions.push({ attendanceId: pendingAtt.id });
      }

      // 3. Dismiss pending reminders and deactivate recurrences tied to this cancelled appointment or its cancelled pending attendance
      await tx.reminder.updateMany({
        where: {
          OR: reminderOrConditions,
          status: { in: ['pendente', 'Pendente'] },
        },
        data: {
          status: 'dispensado',
        },
      });
      await tx.reminderRecurrence.updateMany({
        where: {
          OR: recurrenceOrConditions,
          isActive: true,
        },
        data: {
          isActive: false,
          proximaOcorrenciaEm: null,
        },
      });

      return updated;
    });
  }

  /**
   * Marks an appointment as 'Não compareceu' (no-show) and cascades status 'Cancelado' to its pending attendance (D1 Rule 3).
   */
  static async markNoShow(id: string, input?: NoShowAppointmentInput) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true, observacoes: true },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado', 'Não compareceu'].includes(appointment.status)) {
      throw new ValidationError(`Agendamento não pode ser marcado como falta porque já está "${appointment.status}"`);
    }

    const updatedObs = input?.observacoes
      ? `${appointment.observacoes ? appointment.observacoes + ' | ' : ''}Falta: ${input.observacoes.trim()}`
      : appointment.observacoes;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: 'Não compareceu',
          observacoes: updatedObs,
        },
      });

      const pendingAtt = await tx.attendance.findFirst({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        select: { id: true },
      });

      // Cascade Cancelado to pending attendance ONLY
      await tx.attendance.updateMany({
        where: {
          appointmentId: id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      const reminderOrConditions: Prisma.ReminderWhereInput[] = [{ appointmentId: id }];
      const recurrenceOrConditions: Prisma.ReminderRecurrenceWhereInput[] = [{ appointmentId: id }];
      if (pendingAtt) {
        reminderOrConditions.push({ attendanceId: pendingAtt.id });
        recurrenceOrConditions.push({ attendanceId: pendingAtt.id });
      }

      // Dismiss pending reminders and deactivate recurrences tied to this no-show appointment or its cancelled pending attendance
      await tx.reminder.updateMany({
        where: {
          OR: reminderOrConditions,
          status: { in: ['pendente', 'Pendente'] },
        },
        data: {
          status: 'dispensado',
        },
      });
      await tx.reminderRecurrence.updateMany({
        where: {
          OR: recurrenceOrConditions,
          isActive: true,
        },
        data: {
          isActive: false,
          proximaOcorrenciaEm: null,
        },
      });

      return updated;
    });
  }

  /**
   * Reschedules an appointment atomically (D1 Rule 4, V04):
   * 1. Marks current appointment as 'Reagendado' and sets rescheduledToId to new appointment.
   * 2. Sets pending attendance of old appointment to 'Cancelado'.
   * 3. Creates new Appointment with status 'Agendado' and rescheduledFromId pointing to old appointment.
   * 4. Creates a new linked 1:1 Attendance with status 'Pendente'.
   */
  static async rescheduleAppointment(id: string, input: RescheduleAppointmentInput) {
    const oldAppt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        plannedProcedures: true,
        attendance: true,
      },
    });

    if (!oldAppt) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (['Concluído', 'Cancelado', 'Reagendado'].includes(oldAppt.status)) {
      throw new ValidationError(`Agendamento não pode ser reagendado porque já está "${oldAppt.status}"`);
    }

    // Determine planned procedures for new appointment
    const plannedProcIds = input.plannedProcedureIds ?? oldAppt.plannedProcedures.map((p) => p.procedureId);

    return await prisma.$transaction(async (tx) => {
      // 1. Create new Appointment with status 'Agendado' and its 1:1 Attendance
      const newAppt = await tx.appointment.create({
        data: {
          clientId: oldAppt.clientId,
          dataHora: input.novaDataHora,
          status: 'Agendado',
          valorEstimado:
            input.valorEstimado !== undefined && input.valorEstimado !== null
              ? new Prisma.Decimal(input.valorEstimado)
              : oldAppt.valorEstimado,
          observacoes: input.motivo
            ? `Reagendado a partir de ${oldAppt.dataHora.toISOString()}: ${input.motivo.trim()}`
            : oldAppt.observacoes,
          rescheduledFromId: oldAppt.id,
          plannedProcedures: {
            create: plannedProcIds.map((procId, index) => ({
              procedureId: procId,
              ordem: index,
            })),
          },
          attendance: {
            create: {
              clientId: oldAppt.clientId,
              status: 'Pendente', // New pending attendance for new appointment (D1 Rule 4)
              dataHora: input.novaDataHora,
              desconto: new Prisma.Decimal(0),
              observacoes: 'Atendimento do reagendamento',
            },
          },
        },
        include: {
          client: true,
          attendance: true,
          plannedProcedures: { include: { procedure: true } },
        },
      });

      // 2. Update old appointment to 'Reagendado' and link rescheduledToId
      await tx.appointment.update({
        where: { id: oldAppt.id },
        data: {
          status: 'Reagendado',
          rescheduledToId: newAppt.id,
        },
      });

      // 3. Cancel old pending attendance (D1 Rule 4)
      await tx.attendance.updateMany({
        where: {
          appointmentId: oldAppt.id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      });

      // 4. Dismiss pending reminders and deactivate recurrences tied to the old appointment or its cancelled pending attendance
      const reminderOrConditions: Prisma.ReminderWhereInput[] = [{ appointmentId: oldAppt.id }];
      const recurrenceOrConditions: Prisma.ReminderRecurrenceWhereInput[] = [{ appointmentId: oldAppt.id }];
      if (oldAppt.attendance && oldAppt.attendance.status === 'Pendente') {
        reminderOrConditions.push({ attendanceId: oldAppt.attendance.id });
        recurrenceOrConditions.push({ attendanceId: oldAppt.attendance.id });
      }

      await tx.reminder.updateMany({
        where: {
          OR: reminderOrConditions,
          status: { in: ['pendente', 'Pendente'] },
        },
        data: {
          status: 'dispensado',
        },
      });
      await tx.reminderRecurrence.updateMany({
        where: {
          OR: recurrenceOrConditions,
          isActive: true,
        },
        data: {
          isActive: false,
          proximaOcorrenciaEm: null,
        },
      });

      return this.withCompatAttendances(newAppt);
    });
  }

  /**
   * Concludes an appointment (Validation V08, §27):
   * Cannot complete appointment without completed attendance!
   */
  static async completeAppointment(id: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        attendance: true,
      },
    });

    if (!appointment) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appointment.status === 'Concluído') {
      return this.withCompatAttendances(appointment); // Idempotent
    }

    if (['Cancelado', 'Não compareceu', 'Reagendado'].includes(appointment.status)) {
      throw new ValidationError(`Não é possível concluir um agendamento com status "${appointment.status}"`);
    }

    // Validation V08 Guard: The 1:1 attendance must exist and be 'Realizado'
    if (!appointment.attendance || appointment.attendance.status !== 'Realizado') {
      throw new ValidationError('Não é possível concluir o agendamento sem que o atendimento esteja realizado');
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'Concluído' },
      include: {
        client: true,
        attendance: true,
      },
    });

    return this.withCompatAttendances(updated);
  }
}
