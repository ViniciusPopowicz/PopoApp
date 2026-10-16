import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AddAttendanceProcedureInput,
  UpdateAttendanceProcedureInput,
  SetDiscountInput,
  AttendanceListQuery,
} from '@/schemas/attendance';
import { AttendanceFinancialsDto } from '@/types/attendance';

export class AttendanceService {
  /**
   * Computes dynamic financials for an attendance according to D2 rules (not stored in DB).
   */
  static computeFinancials(attendance: {
    desconto?: Prisma.Decimal | number | null;
    procedures?: { standardValueSnapshot?: Prisma.Decimal | number; practicedValue?: Prisma.Decimal | number }[];
    payments?: { valor?: Prisma.Decimal | number; status?: string }[];
  }): AttendanceFinancialsDto {
    const procs = attendance.procedures ?? [];
    const standardTotal = procs.reduce(
      (acc, p) => acc + Number(p.standardValueSnapshot ?? 0),
      0
    );

    const practicedTotal = procs.reduce(
      (acc, p) => acc + Number(p.practicedValue ?? 0),
      0
    );

    const explicitDiscount = Number(attendance.desconto ?? 0);
    const netTotal = Math.max(0, practicedTotal - explicitDiscount);

    const paidTotal = (attendance.payments ?? [])
      .filter((pay) => pay.status === 'Pago')
      .reduce((acc, pay) => acc + Number(pay.valor ?? 0), 0);

    const outstandingBalance = Math.max(0, netTotal - paidTotal);
    const isFullyPaid = netTotal > 0 && paidTotal >= netTotal;

    return {
      standardTotal,
      practicedTotal,
      explicitDiscount,
      netTotal,
      paidTotal,
      outstandingBalance,
      isFullyPaid,
    };
  }

  /**
   * Creates an additional Attendance for an existing Appointment (supports 1:N cardinality).
   * Status always defaults to 'Pendente' (D1, V07).
   */
  static async createAttendance(data: CreateAttendanceInput) {
    const appt = await prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      select: { id: true, clientId: true, status: true },
    });

    if (!appt) {
      throw new NotFoundError('Agendamento não encontrado');
    }

    if (appt.clientId !== data.clientId) {
      throw new ValidationError('O cliente informado não corresponde ao cliente do agendamento');
    }

    if (['Cancelado', 'Reagendado'].includes(appt.status)) {
      throw new ValidationError(`Não é possível criar atendimento para um agendamento "${appt.status}"`);
    }

    return await prisma.attendance.create({
      data: {
        appointmentId: data.appointmentId,
        clientId: data.clientId,
        status: 'Pendente', // Never created as Realizado
        dataHora: data.dataHora ?? new Date(),
        desconto: new Prisma.Decimal(data.desconto ?? 0),
        observacoes: data.observacoes ? data.observacoes.trim() : null,
      },
      include: {
        client: { select: { id: true, nome: true, cpf: true } },
        appointment: { select: { id: true, dataHora: true, status: true } },
      },
    });
  }

  /**
   * Retrieves an attendance with full clinical context and dynamic financial summary (D2).
   */
  static async getAttendanceById(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        client: true,
        appointment: {
          include: {
            plannedProcedures: { include: { procedure: true } },
          },
        },
        procedures: {
          include: {
            procedure: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        medicalRecord: true,
        attachments: true,
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
        productUsages: {
          include: {
            stockUnit: {
              include: { lot: { include: { product: true } } },
            },
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const financials = this.computeFinancials(attendance);

    return {
      ...attendance,
      financials,
    };
  }

  /**
   * Lists attendances with filtering and pagination.
   */
  static async listAttendances(query: AttendanceListQuery) {
    const where: Prisma.AttendanceWhereInput = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
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

    const [total, items] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataHora: 'desc' },
        include: {
          client: { select: { id: true, nome: true, telefone: true } },
          appointment: { select: { id: true, dataHora: true, status: true } },
          procedures: {
            include: { procedure: { select: { id: true, nome: true } } },
          },
          payments: { select: { id: true, valor: true, status: true } },
        },
      }),
    ]);

    const mappedItems = items.map((item) => ({
      ...item,
      financials: this.computeFinancials(item),
    }));

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Updates basic fields of an attendance.
   */
  static async updateAttendance(id: string, input: UpdateAttendanceInput) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    return await prisma.attendance.update({
      where: { id },
      data: {
        ...(input.dataHora ? { dataHora: input.dataHora } : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes ? input.observacoes.trim() : null } : {}),
      },
      include: {
        client: true,
        procedures: { include: { procedure: true } },
      },
    });
  }

  /**
   * Associates a procedure to an Attendance:
   * 1. Snapshots procedure standard value (standardValueSnapshot) at this instant (V09, V12).
   * 2. Records explicit practiced value (practicedValue) (V08).
   */
  static async addProcedure(attendanceId: string, input: AddAttendanceProcedureInput) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível adicionar procedimentos a um atendimento cancelado');
    }

    const procedure = await prisma.procedure.findUnique({
      where: { id: input.procedureId },
      select: { id: true, nome: true, valorPadrao: true, isActive: true },
    });

    if (!procedure) {
      throw new NotFoundError('Procedimento não encontrado');
    }

    if (!procedure.isActive) {
      throw new ValidationError('Procedimento está inativo no catálogo');
    }

    const created = await prisma.attendanceProcedure.create({
      data: {
        attendanceId,
        procedureId: input.procedureId,
        standardValueSnapshot: procedure.valorPadrao, // Snapshot imutável (V09, V12)
        practicedValue: new Prisma.Decimal(input.practicedValue), // Valor praticado obrigatório (V08)
        observacoes: input.observacoes ? input.observacoes.trim() : null,
      },
      include: {
        procedure: true,
      },
    });

    return created;
  }

  /**
   * Removes an associated procedure from an Attendance.
   */
  static async removeProcedure(attendanceId: string, attendanceProcedureId: string) {
    const record = await prisma.attendanceProcedure.findUnique({
      where: { id: attendanceProcedureId },
      select: { id: true, attendanceId: true },
    });

    if (!record || record.attendanceId !== attendanceId) {
      throw new NotFoundError('Procedimento do atendimento não encontrado');
    }

    await prisma.attendanceProcedure.delete({
      where: { id: attendanceProcedureId },
    });

    return { success: true };
  }

  /**
   * Updates practiced value or notes for an associated procedure.
   */
  static async updateProcedurePracticedValue(
    attendanceId: string,
    attendanceProcedureId: string,
    input: UpdateAttendanceProcedureInput
  ) {
    const record = await prisma.attendanceProcedure.findUnique({
      where: { id: attendanceProcedureId },
      select: { id: true, attendanceId: true },
    });

    if (!record || record.attendanceId !== attendanceId) {
      throw new NotFoundError('Procedimento do atendimento não encontrado');
    }

    return await prisma.attendanceProcedure.update({
      where: { id: attendanceProcedureId },
      data: {
        practicedValue: new Prisma.Decimal(input.practicedValue),
        observacoes:
          input.observacoes !== undefined ? (input.observacoes ? input.observacoes.trim() : null) : undefined,
      },
      include: { procedure: true },
    });
  }

  /**
   * Pre-fills attendance procedures from the linked appointment's planned procedures (D3).
   */
  static async prefillFromPlanned(attendanceId: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        appointment: {
          include: {
            plannedProcedures: {
              include: { procedure: true },
              orderBy: { ordem: 'asc' },
            },
          },
        },
        procedures: true,
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const planned = attendance.appointment.plannedProcedures;
    if (planned.length === 0) {
      return { addedCount: 0, procedures: attendance.procedures };
    }

    // Add procedures from planned that aren't already added
    const createdProcedures = await prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const p of planned) {
        const created = await tx.attendanceProcedure.create({
          data: {
            attendanceId,
            procedureId: p.procedureId,
            standardValueSnapshot: p.procedure.valorPadrao,
            practicedValue: p.procedure.valorPadrao,
            observacoes: 'Pré-preenchido a partir dos procedimentos planejados',
          },
          include: { procedure: true },
        });
        results.push(created);
      }
      return results;
    });

    return { addedCount: createdProcedures.length, procedures: createdProcedures };
  }

  /**
   * Sets the explicit discount for the attendance (Validation V11, Example B).
   * Validates that discount <= total of practiced values.
   */
  static async setDiscount(attendanceId: string, input: SetDiscountInput) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { procedures: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const totalPracticed = attendance.procedures.reduce(
      (acc, p) => acc + Number(p.practicedValue),
      0
    );

    if (input.desconto > totalPracticed && totalPracticed > 0) {
      throw new ValidationError(
        `O desconto (R$ ${input.desconto.toFixed(2)}) não pode ser superior ao valor total praticado dos procedimentos (R$ ${totalPracticed.toFixed(2)})`
      );
    }

    return await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        desconto: new Prisma.Decimal(input.desconto),
      },
    });
  }

  /**
   * Manually marks an attendance as 'Realizado' when the clinical encounter occurs (D1).
   */
  static async completeAttendance(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Realizado') {
      return attendance; // Idempotent
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível concluir um atendimento cancelado');
    }

    return await prisma.attendance.update({
      where: { id },
      data: {
        status: 'Realizado',
        completedAt: new Date(),
      },
    });
  }

  /**
   * Manually cancels an attendance.
   */
  static async cancelAttendance(id: string) {
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    return await prisma.attendance.update({
      where: { id },
      data: { status: 'Cancelado' },
    });
  }
}
