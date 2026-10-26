import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import {
  CreateFinancialObligationInput,
  UpdateFinancialObligationInput,
  SettleFinancialObligationInput,
  CancelFinancialObligationInput,
  CreateManualMovementInput,
  ReverseFinancialRecordInput,
  ObligationListQuery,
  MovementListQuery,
} from '@/schemas/financial';
import {
  FinancialObligationDto,
  FinancialMovementDto,
  CashFlowSummaryDto,
  ObligationStatus,
} from '@/types/financial';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export class FinancialService {
  /**
   * Computes dynamic status, paid amount, remaining balance, and overdue flag for an obligation.
   */
  static computeObligationState(
    obligation: {
      valorOriginal: Prisma.Decimal | number;
      dataVencimento: Date;
      status: string;
      settlements?: { valor: Prisma.Decimal | number; status: string }[];
    },
    referenceDate: Date = new Date()
  ): {
    valorOriginal: number;
    paidAmount: number;
    remainingBalance: number;
    status: ObligationStatus;
    isOverdue: boolean;
  } {
    const valorOriginal = round2(Number(obligation.valorOriginal));
    const activeSettlements = (obligation.settlements ?? []).filter((s) => s.status === 'Ativo');
    const paidAmount = round2(
      activeSettlements.reduce((acc, s) => acc + Number(s.valor), 0)
    );

    if (obligation.status === 'Cancelado') {
      return {
        valorOriginal,
        paidAmount,
        remainingBalance: 0,
        status: 'Cancelado',
        isOverdue: false,
      };
    }

    const remainingBalance = round2(Math.max(0, valorOriginal - paidAmount));
    if (remainingBalance <= 0.001) {
      return {
        valorOriginal,
        paidAmount,
        remainingBalance: 0,
        status: 'Pago',
        isOverdue: false,
      };
    }

    const todayStart = startOfDay(referenceDate);
    const dueStart = startOfDay(new Date(obligation.dataVencimento));
    const isOverdue = dueStart < todayStart;

    let status: ObligationStatus = 'Pendente';
    if (isOverdue) {
      status = 'Atrasado';
    } else if (paidAmount > 0.001) {
      status = 'Parcial';
    }

    return {
      valorOriginal,
      paidAmount,
      remainingBalance,
      status,
      isOverdue,
    };
  }

  /**
   * Formats a raw Prisma FinancialObligation record into FinancialObligationDto.
   */
  static formatObligation(raw: any, referenceDate: Date = new Date()): FinancialObligationDto {
    const state = this.computeObligationState(raw, referenceDate);
    return {
      id: raw.id,
      tipo: raw.tipo,
      descricao: raw.descricao,
      categoria: raw.categoria ?? null,
      fornecedor: raw.fornecedor ?? null,
      clientId: raw.clientId ?? null,
      clientName: raw.client?.nome ?? null,
      appointmentId: raw.appointmentId ?? null,
      attendanceId: raw.attendanceId ?? null,
      valorOriginal: state.valorOriginal,
      paidAmount: state.paidAmount,
      remainingBalance: state.remainingBalance,
      dataVencimento: new Date(raw.dataVencimento).toISOString(),
      metodo: raw.metodo ?? null,
      status: state.status,
      isOverdue: state.isOverdue,
      observacoes: raw.observacoes ?? null,
      cancelledAt: raw.cancelledAt ? new Date(raw.cancelledAt).toISOString() : null,
      cancellationReason: raw.cancellationReason ?? null,
      settlements: (raw.settlements ?? []).map((s: any) => ({
        id: s.id,
        obligationId: s.obligationId,
        valor: round2(Number(s.valor)),
        dataLiquidacao: new Date(s.dataLiquidacao).toISOString(),
        metodo: s.metodo,
        observacoes: s.observacoes ?? null,
        status: s.status,
        reversedAt: s.reversedAt ? new Date(s.reversedAt).toISOString() : null,
        reversalReason: s.reversalReason ?? null,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
      createdAt: new Date(raw.createdAt).toISOString(),
      updatedAt: new Date(raw.updatedAt).toISOString(),
    };
  }

  /**
   * Creates an Account Receivable (RECEIVABLE) or Account Payable (PAYABLE).
   */
  static async createObligation(input: CreateFinancialObligationInput, referenceDate: Date = new Date()) {
    if (input.valorOriginal <= 0) {
      throw new ValidationError('O valor da obrigação deve ser maior que zero');
    }

    let resolvedClientId = input.clientId ?? null;
    let resolvedAppointmentId = input.appointmentId ?? null;
    const resolvedAttendanceId = input.attendanceId ?? null;

    if (resolvedClientId) {
      const client = await prisma.client.findUnique({
        where: { id: resolvedClientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    if (resolvedAppointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: resolvedAppointmentId },
        select: { id: true, clientId: true },
      });
      if (!appt) {
        throw new NotFoundError('Agendamento não encontrado');
      }
      if (resolvedClientId && appt.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do agendamento');
      }
      resolvedClientId = appt.clientId;
    }

    if (resolvedAttendanceId) {
      const att = await prisma.attendance.findUnique({
        where: { id: resolvedAttendanceId },
        select: { id: true, clientId: true, appointmentId: true },
      });
      if (!att) {
        throw new NotFoundError('Atendimento não encontrado');
      }
      if (resolvedClientId && att.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do atendimento');
      }
      if (resolvedAppointmentId && att.appointmentId !== resolvedAppointmentId) {
        throw new ValidationError('O atendimento informado não pertence ao agendamento especificado');
      }
      resolvedClientId = att.clientId;
      if (!resolvedAppointmentId && att.appointmentId) {
        resolvedAppointmentId = att.appointmentId;
      }
    }

    const isOverdue = startOfDay(new Date(input.dataVencimento)) < startOfDay(referenceDate);
    const initialStatus: ObligationStatus = isOverdue ? 'Atrasado' : 'Pendente';

    const created = await prisma.financialObligation.create({
      data: {
        tipo: input.tipo,
        descricao: input.descricao.trim(),
        categoria: input.categoria ? input.categoria.trim() : null,
        fornecedor: input.fornecedor ? input.fornecedor.trim() : null,
        clientId: resolvedClientId,
        appointmentId: resolvedAppointmentId,
        attendanceId: resolvedAttendanceId,
        valorOriginal: new Prisma.Decimal(input.valorOriginal),
        dataVencimento: input.dataVencimento,
        metodo: input.metodo ? input.metodo.trim() : null,
        status: initialStatus,
        observacoes: input.observacoes ? input.observacoes.trim() : null,
      },
      include: {
        client: { select: { id: true, nome: true } },
        settlements: { orderBy: { dataLiquidacao: 'asc' } },
      },
    });

    return this.formatObligation(created, referenceDate);
  }

  /**
   * Retrieves a single obligation by ID with computed settlement and overdue metrics.
   */
  static async getObligationById(id: string, referenceDate: Date = new Date()) {
    const obligation = await prisma.financialObligation.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, nome: true } },
        settlements: { orderBy: { dataLiquidacao: 'asc' } },
      },
    });

    if (!obligation) {
      throw new NotFoundError('Obrigação financeira não encontrada');
    }

    return this.formatObligation(obligation, referenceDate);
  }

  /**
   * Lists financial obligations with filtering by type, dynamic status, date range, and overdue flag.
   */
  static async listObligations(query: Partial<ObligationListQuery> = {}, referenceDate: Date = new Date()) {
    const where: Prisma.FinancialObligationWhereInput = {
      ...(query.tipo && query.tipo !== 'todos' ? { tipo: query.tipo } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.attendanceId ? { attendanceId: query.attendanceId } : {}),
      ...(query.appointmentId ? { appointmentId: query.appointmentId } : {}),
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.startDate || query.endDate
        ? {
            dataVencimento: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const rawItems = await prisma.financialObligation.findMany({
      where,
      orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
      include: {
        client: { select: { id: true, nome: true } },
        settlements: { orderBy: { dataLiquidacao: 'asc' } },
      },
    });

    let formatted = rawItems.map((item) => this.formatObligation(item, referenceDate));

    if (query.status && query.status !== 'todos') {
      formatted = formatted.filter((item) => item.status === query.status);
    }

    if (query.overdueOnly) {
      formatted = formatted.filter((item) => item.isOverdue);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const total = formatted.length;
    const items = formatted.slice((page - 1) * limit, page * limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Updates editable metadata of an obligation.
   */
  static async updateObligation(
    id: string,
    input: UpdateFinancialObligationInput,
    referenceDate: Date = new Date()
  ) {
    const existing = await prisma.financialObligation.findUnique({
      where: { id },
      include: { settlements: true },
    });

    if (!existing) {
      throw new NotFoundError('Obrigação financeira não encontrada');
    }

    if (existing.status === 'Cancelado') {
      throw new ValidationError('Não é possível editar uma obrigação cancelada');
    }

    const updated = await prisma.financialObligation.update({
      where: { id },
      data: {
        ...(input.descricao !== undefined ? { descricao: input.descricao.trim() } : {}),
        ...(input.categoria !== undefined ? { categoria: input.categoria ? input.categoria.trim() : null } : {}),
        ...(input.fornecedor !== undefined ? { fornecedor: input.fornecedor ? input.fornecedor.trim() : null } : {}),
        ...(input.dataVencimento !== undefined ? { dataVencimento: input.dataVencimento } : {}),
        ...(input.metodo !== undefined ? { metodo: input.metodo ? input.metodo.trim() : null } : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes ? input.observacoes.trim() : null } : {}),
      },
      include: {
        client: { select: { id: true, nome: true } },
        settlements: { orderBy: { dataLiquidacao: 'asc' } },
      },
    });

    const computed = this.computeObligationState(updated, referenceDate);
    if (updated.status !== computed.status) {
      await prisma.financialObligation.update({
        where: { id },
        data: { status: computed.status },
      });
    }

    return this.formatObligation(updated, referenceDate);
  }

  /**
   * Settles an obligation partially or in full.
   * Rejects negative/zero amounts, cancelled/already-paid obligations, and overpayments (> remainingBalance).
   * Atomically creates FinancialSettlement + FinancialMovement and updates obligation status.
   */
  static async settleObligation(
    obligationId: string,
    input: SettleFinancialObligationInput,
    referenceDate: Date = new Date()
  ) {
    if (input.valor <= 0) {
      throw new ValidationError('O valor da liquidação deve ser maior que zero');
    }

    const settlementDate = input.dataLiquidacao ?? new Date();

    const updatedObligation = await prisma.$transaction(async (tx) => {
      const obligation = await tx.financialObligation.findUnique({
        where: { id: obligationId },
        include: {
          settlements: true,
        },
      });

      if (!obligation) {
        throw new NotFoundError('Obrigação financeira não encontrada');
      }

      if (obligation.status === 'Cancelado') {
        throw new ValidationError('Não é possível liquidar uma obrigação cancelada');
      }

      const currentState = this.computeObligationState(obligation, referenceDate);
      if (currentState.remainingBalance <= 0.001) {
        throw new ValidationError('Esta obrigação já está integralmente quitada');
      }

      if (input.valor > currentState.remainingBalance + 0.001) {
        throw new ValidationError(
          `O valor de liquidação (R$ ${input.valor.toFixed(2)}) excede o saldo restante da obrigação (R$ ${currentState.remainingBalance.toFixed(2)})`
        );
      }

      const settlement = await tx.financialSettlement.create({
        data: {
          obligationId: obligation.id,
          valor: new Prisma.Decimal(round2(input.valor)),
          dataLiquidacao: settlementDate,
          metodo: input.metodo.trim(),
          observacoes: input.observacoes ? input.observacoes.trim() : null,
          status: 'Ativo',
        },
      });

      const movementType = obligation.tipo === 'RECEIVABLE' ? 'ENTRADA' : 'SAIDA';
      const movementOrigin =
        obligation.tipo === 'RECEIVABLE' ? 'LIQUIDACAO_RECEBER' : 'LIQUIDACAO_PAGAR';

      await tx.financialMovement.create({
        data: {
          tipo: movementType,
          origem: movementOrigin,
          descricao: `Liquidação: ${obligation.descricao}`,
          categoria: obligation.categoria,
          valor: new Prisma.Decimal(round2(input.valor)),
          dataMovimentacao: settlementDate,
          metodo: input.metodo.trim(),
          status: 'Ativo',
          clientId: obligation.clientId,
          appointmentId: obligation.appointmentId,
          attendanceId: obligation.attendanceId,
          obligationId: obligation.id,
          settlementId: settlement.id,
          observacoes: input.observacoes ? input.observacoes.trim() : null,
        },
      });

      const newRemaining = round2(Math.max(0, currentState.remainingBalance - input.valor));
      let nextStatus: ObligationStatus = 'Parcial';
      if (newRemaining <= 0.001) {
        nextStatus = 'Pago';
      } else if (startOfDay(new Date(obligation.dataVencimento)) < startOfDay(referenceDate)) {
        nextStatus = 'Atrasado';
      }

      return await tx.financialObligation.update({
        where: { id: obligation.id },
        data: { status: nextStatus },
        include: {
          client: { select: { id: true, nome: true } },
          settlements: { orderBy: { dataLiquidacao: 'asc' } },
        },
      });
    });

    return this.formatObligation(updatedObligation, referenceDate);
  }

  /**
   * Reverses a specific settlement with a full audit trail and updates the parent obligation status.
   */
  static async reverseSettlement(
    settlementId: string,
    input: ReverseFinancialRecordInput,
    referenceDate: Date = new Date()
  ) {
    const updatedObligation = await prisma.$transaction(async (tx) => {
      const settlement = await tx.financialSettlement.findUnique({
        where: { id: settlementId },
        include: {
          obligation: {
            include: { settlements: true },
          },
          movement: true,
        },
      });

      if (!settlement) {
        throw new NotFoundError('Liquidação financeira não encontrada');
      }

      if (settlement.status === 'Estornado') {
        throw new ValidationError('Esta liquidação já foi estornada');
      }

      const now = new Date();
      const reason = input.motivo.trim();

      await tx.financialSettlement.update({
        where: { id: settlementId },
        data: {
          status: 'Estornado',
          reversedAt: now,
          reversalReason: reason,
        },
      });

      if (settlement.movement && settlement.movement.status !== 'Estornado') {
        await tx.financialMovement.update({
          where: { id: settlement.movement.id },
          data: {
            status: 'Estornado',
            reversedAt: now,
            reversalReason: reason,
          },
        });

        await tx.financialMovement.create({
          data: {
            tipo: settlement.movement.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA',
            origem: 'ESTORNO',
            descricao: `Estorno de ${settlement.movement.descricao}: ${reason}`,
            categoria: settlement.movement.categoria,
            valor: settlement.movement.valor,
            dataMovimentacao: now,
            metodo: settlement.movement.metodo,
            status: 'Ativo',
            clientId: settlement.movement.clientId,
            appointmentId: settlement.movement.appointmentId,
            attendanceId: settlement.movement.attendanceId,
            obligationId: settlement.obligationId,
            reversedFromId: settlement.movement.id,
            observacoes: reason,
          },
        });
      }

      const refreshedObligation = await tx.financialObligation.findUnique({
        where: { id: settlement.obligationId },
        include: { settlements: true },
      });

      const nextState = this.computeObligationState(refreshedObligation!, referenceDate);

      return await tx.financialObligation.update({
        where: { id: settlement.obligationId },
        data: { status: nextState.status },
        include: {
          client: { select: { id: true, nome: true } },
          settlements: { orderBy: { dataLiquidacao: 'asc' } },
        },
      });
    });

    return this.formatObligation(updatedObligation, referenceDate);
  }

  /**
   * Cancels an obligation. If active settlements exist, requires reverseSettlements=true to reverse them atomically.
   */
  static async cancelObligation(
    obligationId: string,
    input: CancelFinancialObligationInput,
    referenceDate: Date = new Date()
  ) {
    const cancelled = await prisma.$transaction(async (tx) => {
      const obligation = await tx.financialObligation.findUnique({
        where: { id: obligationId },
        include: {
          client: { select: { id: true, nome: true } },
          settlements: {
            include: { movement: true },
            orderBy: { dataLiquidacao: 'asc' },
          },
        },
      });

      if (!obligation) {
        throw new NotFoundError('Obrigação financeira não encontrada');
      }

      if (obligation.status === 'Cancelado') {
        return obligation;
      }

      const activeSettlements = obligation.settlements.filter((s) => s.status === 'Ativo');
      if (activeSettlements.length > 0 && !input.reverseSettlements) {
        throw new ValidationError(
          'Esta obrigação possui liquidações ativas. Confirme o estorno das liquidações (reverseSettlements=true) para cancelar.'
        );
      }

      const now = new Date();
      const reason = (input.motivo || 'Cancelamento de obrigação').trim();

      for (const settlement of activeSettlements) {
        await tx.financialSettlement.update({
          where: { id: settlement.id },
          data: {
            status: 'Estornado',
            reversedAt: now,
            reversalReason: reason,
          },
        });

        if (settlement.movement && settlement.movement.status !== 'Estornado') {
          await tx.financialMovement.update({
            where: { id: settlement.movement.id },
            data: {
              status: 'Estornado',
              reversedAt: now,
              reversalReason: reason,
            },
          });

          await tx.financialMovement.create({
            data: {
              tipo: settlement.movement.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA',
              origem: 'ESTORNO',
              descricao: `Estorno por cancelamento (${obligation.descricao}): ${reason}`,
              categoria: settlement.movement.categoria,
              valor: settlement.movement.valor,
              dataMovimentacao: now,
              metodo: settlement.movement.metodo,
              status: 'Ativo',
              clientId: settlement.movement.clientId,
              appointmentId: settlement.movement.appointmentId,
              attendanceId: settlement.movement.attendanceId,
              obligationId: obligation.id,
              reversedFromId: settlement.movement.id,
              observacoes: reason,
            },
          });
        }
      }

      return await tx.financialObligation.update({
        where: { id: obligationId },
        data: {
          status: 'Cancelado',
          cancelledAt: now,
          cancellationReason: reason,
        },
        include: {
          client: { select: { id: true, nome: true } },
          settlements: { orderBy: { dataLiquidacao: 'asc' } },
        },
      });
    });

    return this.formatObligation(cancelled, referenceDate);
  }

  /**
   * Formats a raw FinancialMovement record into FinancialMovementDto.
   */
  static formatMovement(raw: any): FinancialMovementDto {
    return {
      id: raw.id,
      tipo: raw.tipo,
      origem: raw.origem,
      descricao: raw.descricao,
      categoria: raw.categoria ?? null,
      valor: round2(Number(raw.valor)),
      dataMovimentacao: new Date(raw.dataMovimentacao).toISOString(),
      metodo: raw.metodo,
      status: raw.status,
      clientId: raw.clientId ?? null,
      clientName: raw.client?.nome ?? null,
      appointmentId: raw.appointmentId ?? null,
      attendanceId: raw.attendanceId ?? null,
      paymentId: raw.paymentId ?? null,
      pixInstallmentId: raw.pixInstallmentId ?? null,
      obligationId: raw.obligationId ?? null,
      settlementId: raw.settlementId ?? null,
      reversedFromId: raw.reversedFromId ?? null,
      reversedAt: raw.reversedAt ? new Date(raw.reversedAt).toISOString() : null,
      reversalReason: raw.reversalReason ?? null,
      observacoes: raw.observacoes ?? null,
      createdAt: new Date(raw.createdAt).toISOString(),
      updatedAt: new Date(raw.updatedAt).toISOString(),
    };
  }

  /**
   * Creates a manual cash movement (income ENTRADA or expense SAIDA).
   */
  static async createManualMovement(input: CreateManualMovementInput) {
    if (input.valor <= 0) {
      throw new ValidationError('O valor da movimentação deve ser maior que zero');
    }

    let resolvedClientId = input.clientId ?? null;
    let resolvedAppointmentId = input.appointmentId ?? null;
    const resolvedAttendanceId = input.attendanceId ?? null;

    if (resolvedClientId) {
      const client = await prisma.client.findUnique({
        where: { id: resolvedClientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundError('Cliente não encontrado');
      }
    }

    if (resolvedAppointmentId) {
      const appt = await prisma.appointment.findUnique({
        where: { id: resolvedAppointmentId },
        select: { id: true, clientId: true },
      });
      if (!appt) {
        throw new NotFoundError('Agendamento não encontrado');
      }
      if (resolvedClientId && appt.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do agendamento');
      }
      resolvedClientId = appt.clientId;
    }

    if (resolvedAttendanceId) {
      const att = await prisma.attendance.findUnique({
        where: { id: resolvedAttendanceId },
        select: { id: true, clientId: true, appointmentId: true },
      });
      if (!att) {
        throw new NotFoundError('Atendimento não encontrado');
      }
      if (resolvedClientId && att.clientId !== resolvedClientId) {
        throw new ValidationError('O cliente informado não corresponde ao cliente do atendimento');
      }
      if (resolvedAppointmentId && att.appointmentId !== resolvedAppointmentId) {
        throw new ValidationError('O atendimento informado não pertence ao agendamento especificado');
      }
      resolvedClientId = att.clientId;
      if (!resolvedAppointmentId && att.appointmentId) {
        resolvedAppointmentId = att.appointmentId;
      }
    }

    const created = await prisma.financialMovement.create({
      data: {
        tipo: input.tipo,
        origem: 'MANUAL',
        descricao: input.descricao.trim(),
        categoria: input.categoria ? input.categoria.trim() : null,
        valor: new Prisma.Decimal(round2(input.valor)),
        dataMovimentacao: input.dataMovimentacao ?? new Date(),
        metodo: input.metodo.trim(),
        status: 'Ativo',
        clientId: resolvedClientId,
        appointmentId: resolvedAppointmentId,
        attendanceId: resolvedAttendanceId,
        observacoes: input.observacoes ? input.observacoes.trim() : null,
      },
      include: {
        client: { select: { id: true, nome: true } },
      },
    });

    return this.formatMovement(created);
  }

  /**
   * Reverses a financial movement, preserving the original record as 'Estornado' and creating a compensating 'ESTORNO' entry.
   */
  static async reverseMovement(
    movementId: string,
    input: ReverseFinancialRecordInput,
    referenceDate: Date = new Date()
  ) {
    const existing = await prisma.financialMovement.findUnique({
      where: { id: movementId },
    });

    if (!existing) {
      throw new NotFoundError('Movimentação financeira não encontrada');
    }

    if (existing.status === 'Estornado') {
      throw new ValidationError('Esta movimentação já foi estornada');
    }

    if (existing.origem === 'ESTORNO') {
      throw new ValidationError('Não é possível estornar um lançamento de estorno');
    }

    if (existing.settlementId) {
      await this.reverseSettlement(existing.settlementId, input, referenceDate);
      const updated = await prisma.financialMovement.findUnique({
        where: { id: movementId },
        include: { client: { select: { id: true, nome: true } } },
      });
      return this.formatMovement(updated!);
    }

    const now = new Date();
    const reason = input.motivo.trim();

    const updated = await prisma.$transaction(async (tx) => {
      const orig = await tx.financialMovement.update({
        where: { id: movementId },
        data: {
          status: 'Estornado',
          reversedAt: now,
          reversalReason: reason,
        },
        include: {
          client: { select: { id: true, nome: true } },
        },
      });

      await tx.financialMovement.create({
        data: {
          tipo: orig.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA',
          origem: 'ESTORNO',
          descricao: `Estorno de ${orig.descricao}: ${reason}`,
          categoria: orig.categoria,
          valor: orig.valor,
          dataMovimentacao: now,
          metodo: orig.metodo,
          status: 'Ativo',
          clientId: orig.clientId,
          appointmentId: orig.appointmentId,
          attendanceId: orig.attendanceId,
          obligationId: orig.obligationId,
          reversedFromId: orig.id,
          observacoes: reason,
        },
      });

      return orig;
    });

    return this.formatMovement(updated);
  }

  /**
   * Lists cash movements with filtering and pagination.
   */
  static async listMovements(query: Partial<MovementListQuery> = {}) {
    const where: Prisma.FinancialMovementWhereInput = {
      ...(query.tipo && query.tipo !== 'todos' ? { tipo: query.tipo } : {}),
      ...(query.status && query.status !== 'todos' ? { status: query.status } : {}),
      ...(query.origem ? { origem: query.origem } : {}),
      ...(query.metodo ? { metodo: query.metodo } : {}),
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.startDate || query.endDate
        ? {
            dataMovimentacao: {
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
      prisma.financialMovement.count({ where }),
      prisma.financialMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
        include: {
          client: { select: { id: true, nome: true } },
        },
      }),
    ]);

    return {
      items: rawItems.map((m) => this.formatMovement(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Computes actual realized cash flow and pending/overdue receivables & payables without double-counting.
   */
  static async getCashFlowSummary(
    startDate: Date,
    endDate: Date,
    referenceDate: Date = new Date()
  ): Promise<CashFlowSummaryDto> {
    // 1. Realized cash ledger movements within [startDate, endDate]
    const movements = await prisma.financialMovement.findMany({
      where: {
        status: { in: ['Ativo', 'Realizado', 'Estornado'] },
        dataMovimentacao: { gte: startDate, lte: endDate },
      },
    });

    // Track which Payment IDs and PixInstallment IDs are already represented in FinancialMovement (across all time)
    const allLinkedMovements = await prisma.financialMovement.findMany({
      where: {
        OR: [{ paymentId: { not: null } }, { pixInstallmentId: { not: null } }],
      },
      select: { paymentId: true, pixInstallmentId: true },
    });
    const coveredPaymentIds = new Set(
      allLinkedMovements.map((m) => m.paymentId).filter(Boolean) as string[]
    );
    const coveredInstallmentIds = new Set(
      allLinkedMovements.map((m) => m.pixInstallmentId).filter(Boolean) as string[]
    );

    // 2. Include any paid Payments (without pixInstallments) and paid PixInstallments in [startDate, endDate]
    // that were created directly in DB without a FinancialMovement row (zero double-counting)
    const [paidSinglePayments, paidPixInstallments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: 'Pago',
          pixInstallments: { none: {} },
          OR: [
            { dataPagamento: { gte: startDate, lte: endDate } },
            { dataPagamento: null, createdAt: { gte: startDate, lte: endDate } },
          ],
        },
        select: { id: true, valor: true, metodo: true },
      }),
      prisma.pixInstallment.findMany({
        where: {
          status: 'Pago',
          OR: [
            { dataPagamento: { gte: startDate, lte: endDate } },
            { dataPagamento: null, updatedAt: { gte: startDate, lte: endDate } },
          ],
        },
        select: { id: true, valor: true },
      }),
    ]);

    let totalInflows = 0;
    let totalOutflows = 0;

    const inflowsByMethodMap = new Map<string, { total: number; count: number }>();
    const outflowsByCategoryMap = new Map<string, { total: number; count: number }>();

    const addInflow = (metodo: string, valor: number) => {
      totalInflows += valor;
      const cur = inflowsByMethodMap.get(metodo) ?? { total: 0, count: 0 };
      cur.total += valor;
      cur.count += 1;
      inflowsByMethodMap.set(metodo, cur);
    };

    const addOutflow = (categoria: string, valor: number) => {
      totalOutflows += valor;
      const cat = categoria || 'Geral';
      const cur = outflowsByCategoryMap.get(cat) ?? { total: 0, count: 0 };
      cur.total += valor;
      cur.count += 1;
      outflowsByCategoryMap.set(cat, cur);
    };

    for (const mov of movements) {
      const val = Number(mov.valor);
      if (mov.tipo === 'ENTRADA') {
        addInflow(mov.metodo, val);
      } else if (mov.tipo === 'SAIDA') {
        addOutflow(mov.categoria || 'Geral', val);
      }
    }

    for (const pay of paidSinglePayments) {
      if (!coveredPaymentIds.has(pay.id)) {
        addInflow(pay.metodo, Number(pay.valor));
      }
    }

    for (const inst of paidPixInstallments) {
      if (!coveredInstallmentIds.has(inst.id)) {
        addInflow('pix_parcelado', Number(inst.valor));
      }
    }

    totalInflows = round2(totalInflows);
    totalOutflows = round2(totalOutflows);
    const netCashFlow = round2(totalInflows - totalOutflows);

    // 3. Compute Pending & Overdue Obligations (RECEIVABLE & PAYABLE)
    const allOpenObligations = await prisma.financialObligation.findMany({
      where: {
        status: { notIn: ['Cancelado', 'Pago'] },
      },
      include: { settlements: true },
    });

    let pendingReceivables = 0;
    let overdueReceivables = 0;
    let pendingPayables = 0;
    let overduePayables = 0;

    for (const ob of allOpenObligations) {
      const state = this.computeObligationState(ob, referenceDate);
      if (state.remainingBalance <= 0.001) continue;

      if (ob.tipo === 'RECEIVABLE') {
        pendingReceivables += state.remainingBalance;
        if (state.isOverdue) {
          overdueReceivables += state.remainingBalance;
        }
      } else if (ob.tipo === 'PAYABLE') {
        pendingPayables += state.remainingBalance;
        if (state.isOverdue) {
          overduePayables += state.remainingBalance;
        }
      }
    }

    const inflowsByMethod = Array.from(inflowsByMethodMap.entries()).map(([metodo, stats]) => ({
      metodo,
      method: metodo,
      label: PAYMENT_METHOD_LABELS[metodo] ?? metodo,
      total: round2(stats.total),
      count: stats.count,
      percentage: totalInflows > 0 ? round2((stats.total / totalInflows) * 100) : 0,
    }));

    const outflowsByCategory = Array.from(outflowsByCategoryMap.entries()).map(
      ([categoria, stats]) => ({
        categoria,
        total: round2(stats.total),
        count: stats.count,
      })
    );

    return {
      totalInflows,
      totalOutflows,
      netCashFlow,
      pendingReceivables: round2(pendingReceivables),
      overdueReceivables: round2(overdueReceivables),
      pendingPayables: round2(pendingPayables),
      overduePayables: round2(overduePayables),
      inflowsByMethod,
      outflowsByCategory,
    };
  }
}
