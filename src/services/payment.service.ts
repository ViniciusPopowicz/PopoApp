// src/services/payment.service.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { AttendanceService } from './attendance.service';
import { ReminderService } from './reminder.service';
import {
  RecordPaymentInput,
  CreatePixScheduleInput,
  PayPixInstallmentInput,
  UpdatePixInstallmentStatusInput,
} from '@/schemas/payment';
import {
  PaymentDto,
  PixInstallmentDto,
  AttendancePaymentSummaryDto,
  PixSchedulePreviewDto,
} from '@/types/payment';

export class PaymentService {
  /**
   * Helper to format raw Prisma Payment entity to PaymentDto.
   */
  private static formatPaymentDto(payment: any): PaymentDto {
    return {
      id: payment.id,
      attendanceId: payment.attendanceId,
      valor: Number(payment.valor),
      metodo: payment.metodo as any,
      status: payment.status as any,
      dataPagamento: payment.dataPagamento
        ? (payment.dataPagamento instanceof Date ? payment.dataPagamento.toISOString() : new Date(payment.dataPagamento).toISOString())
        : null,
      numeroParcelas: payment.numeroParcelas,
      identificadorTransacao: payment.identificadorTransacao ?? null,
      observacoes: payment.observacoes ?? null,
      createdAt: payment.createdAt instanceof Date ? payment.createdAt.toISOString() : new Date(payment.createdAt).toISOString(),
      updatedAt: payment.updatedAt instanceof Date ? payment.updatedAt.toISOString() : new Date(payment.updatedAt).toISOString(),
      pixInstallments: payment.pixInstallments
        ? payment.pixInstallments.map((inst: any) => this.formatPixInstallmentDto(inst))
        : undefined,
    };
  }

  /**
   * Helper to format raw Prisma PixInstallment entity to PixInstallmentDto.
   */
  private static formatPixInstallmentDto(inst: any): PixInstallmentDto {
    return {
      id: inst.id,
      paymentId: inst.paymentId,
      numeroParcela: inst.numeroParcela,
      totalParcelas: inst.totalParcelas,
      valor: Number(inst.valor),
      dataVencimento: inst.dataVencimento instanceof Date
        ? inst.dataVencimento.toISOString()
        : new Date(inst.dataVencimento).toISOString(),
      dataPagamento: inst.dataPagamento
        ? (inst.dataPagamento instanceof Date ? inst.dataPagamento.toISOString() : new Date(inst.dataPagamento).toISOString())
        : null,
      status: inst.status as any,
      createdAt: inst.createdAt instanceof Date ? inst.createdAt.toISOString() : new Date(inst.createdAt).toISOString(),
      updatedAt: inst.updatedAt instanceof Date ? inst.updatedAt.toISOString() : new Date(inst.updatedAt).toISOString(),
    };
  }

  /**
   * Records a direct payment for an attendance (cash, credit card, debit, single pix, etc.).
   * Handles full or partial payments across multiple methods (V20, D2).
   * For Credit Card (V21): stores numeroParcelas count (1..12) and generates strictly ZERO reminders.
   */
  static async recordPayment(
    attendanceId: string,
    input: RecordPaymentInput
  ): Promise<{ payment: PaymentDto; financials: AttendancePaymentSummaryDto }> {
    if (input.valor <= 0) {
      throw new ValidationError('O valor do pagamento deve ser maior que zero');
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        appointment: { select: { valorEstimado: true } },
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível registrar pagamento para um atendimento cancelado');
    }

    const financials = AttendanceService.computeFinancials(attendance);

    // If procedures exist, ceiling is outstandingBalance.
    // If no procedures yet (signal/advance payment on scheduled attendance), ceiling is appointment estimated value.
    const estimatedCeiling = Math.max(0, Number(attendance.appointment?.valorEstimado ?? 0) - financials.paidTotal);
    const maxAllowed = financials.netTotal > 0 ? financials.outstandingBalance : estimatedCeiling;

    if (input.valor > maxAllowed + 0.001) {
      const ceilingMsg = financials.netTotal > 0
        ? `ao saldo devedor (R$ ${financials.outstandingBalance.toFixed(2)})`
        : `ao valor estimado do agendamento (R$ ${estimatedCeiling.toFixed(2)})`;
      throw new ValidationError(
        `O valor do pagamento (R$ ${input.valor.toFixed(2)}) não pode ser superior ${ceilingMsg}.`
      );
    }

    const paymentStatus = input.status ?? 'Pago';
    const numeroParcelas = input.metodo === 'CartaoCredito' ? (input.numeroParcelas ?? 1) : 1;

    // V21 constraint: Credit card payments store installment count but create ZERO PixInstallment and ZERO Reminder rows.
    const createdPayment = await prisma.payment.create({
      data: {
        attendanceId,
        valor: new Prisma.Decimal(input.valor),
        metodo: input.metodo,
        status: paymentStatus,
        dataPagamento: paymentStatus === 'Pago' ? (input.dataPagamento ?? new Date()) : null,
        numeroParcelas,
        identificadorTransacao: input.identificadorTransacao ?? null,
        observacoes: input.observacoes ?? null,
      },
      include: {
        pixInstallments: true,
      },
    });

    // Recompute financials with new payment included
    const updatedAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const updatedFinancials = AttendanceService.computeFinancials(updatedAttendance!);
    const summary: AttendancePaymentSummaryDto = {
      attendanceId,
      standardTotal: updatedFinancials.standardTotal,
      practicedTotal: updatedFinancials.practicedTotal,
      explicitDiscount: updatedFinancials.explicitDiscount,
      netTotal: updatedFinancials.netTotal,
      paidTotal: updatedFinancials.paidTotal,
      outstandingBalance: updatedFinancials.outstandingBalance,
      isFullyPaid: updatedFinancials.isFullyPaid,
      payments: updatedAttendance!.payments.map((p) => this.formatPaymentDto(p)),
    };

    return {
      payment: this.formatPaymentDto(createdPayment),
      financials: summary,
    };
  }

  /**
   * Generates a preview for a PIX installment schedule without writing to DB.
   */
  static previewPixSchedule(input: {
    valorTotal: number;
    numeroParcelas: number;
    primeiroVencimento: Date | string;
    intervaloDias?: number;
  }): PixSchedulePreviewDto {
    if (input.valorTotal <= 0) {
      throw new ValidationError('O valor total do parcelamento deve ser maior que zero');
    }
    if (input.numeroParcelas < 1) {
      throw new ValidationError('O número de parcelas deve ser de no mínimo 1');
    }

    const intervalo = input.intervaloDias ?? 30;
    const primeiroVenc = new Date(input.primeiroVencimento);
    const n = input.numeroParcelas;

    const baseValue = Math.floor((input.valorTotal / n) * 100) / 100;
    const firstValue = Number((input.valorTotal - baseValue * (n - 1)).toFixed(2));

    const parcelas = [];
    for (let i = 1; i <= n; i++) {
      const dueDate = new Date(primeiroVenc);
      dueDate.setDate(dueDate.getDate() + (i - 1) * intervalo);

      parcelas.push({
        numeroParcela: i,
        totalParcelas: n,
        valor: i === 1 ? firstValue : baseValue,
        dataVencimento: dueDate.toISOString(),
      });
    }

    return {
      valorTotal: input.valorTotal,
      numeroParcelas: n,
      parcelas,
    };
  }

  /**
   * Creates a PIX installment plan (V22, D5).
   * Creates a parent Payment with status 'Pendente', N child PixInstallment rows,
   * and automatically generates N in-app Reminders matching due dates.
   */
  static async createPixInstallmentSchedule(
    attendanceId: string,
    input: CreatePixScheduleInput
  ): Promise<{ payment: PaymentDto; financials: AttendancePaymentSummaryDto }> {
    if (input.valorTotal <= 0) {
      throw new ValidationError('O valor total do parcelamento deve ser maior que zero');
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        client: { select: { id: true, nome: true } },
        appointment: { select: { valorEstimado: true } },
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível criar parcelamento para um atendimento cancelado');
    }

    const financials = AttendanceService.computeFinancials(attendance);

    const estimatedCeiling = Math.max(0, Number(attendance.appointment?.valorEstimado ?? 0) - financials.paidTotal);
    const maxAllowed = financials.netTotal > 0 ? financials.outstandingBalance : estimatedCeiling;

    if (input.valorTotal > maxAllowed + 0.001) {
      const ceilingMsg = financials.netTotal > 0
        ? `ao saldo devedor (R$ ${financials.outstandingBalance.toFixed(2)})`
        : `ao valor estimado do agendamento (R$ ${estimatedCeiling.toFixed(2)})`;
      throw new ValidationError(
        `O valor total do parcelamento (R$ ${input.valorTotal.toFixed(2)}) não pode ser superior ${ceilingMsg}.`
      );
    }

    const preview = this.previewPixSchedule({
      valorTotal: input.valorTotal,
      numeroParcelas: input.numeroParcelas,
      primeiroVencimento: input.primeiroVencimento,
      intervaloDias: input.intervaloDias,
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create parent Payment with status 'Pendente'
      const payment = await tx.payment.create({
        data: {
          attendanceId,
          valor: new Prisma.Decimal(input.valorTotal),
          metodo: 'Pix',
          status: 'Pendente',
          numeroParcelas: input.numeroParcelas,
          dataPagamento: null,
          observacoes: input.observacoes ?? null,
        },
      });

      // 2. Create child PixInstallment records
      const createdInstallments = [];
      for (const p of preview.parcelas) {
        const inst = await tx.pixInstallment.create({
          data: {
            paymentId: payment.id,
            numeroParcela: p.numeroParcela,
            totalParcelas: p.totalParcelas,
            valor: new Prisma.Decimal(p.valor),
            dataVencimento: new Date(p.dataVencimento),
            status: 'Pendente',
          },
        });
        createdInstallments.push(inst);
      }

      // 3. Automatically generate in-app Reminders (V22, D5)
      await ReminderService.generateRemindersForPixInstallments(
        createdInstallments.map((inst) => ({
          id: inst.id,
          numeroParcela: inst.numeroParcela,
          totalParcelas: inst.totalParcelas,
          valor: inst.valor,
          dataVencimento: inst.dataVencimento,
        })),
        attendance.clientId,
        tx
      );

      return await tx.payment.findUnique({
        where: { id: payment.id },
        include: { pixInstallments: { orderBy: { numeroParcela: 'asc' } } },
      });
    });

    // Recompute financials
    const updatedAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const updatedFinancials = AttendanceService.computeFinancials(updatedAttendance!);
    const summary: AttendancePaymentSummaryDto = {
      attendanceId,
      standardTotal: updatedFinancials.standardTotal,
      practicedTotal: updatedFinancials.practicedTotal,
      explicitDiscount: updatedFinancials.explicitDiscount,
      netTotal: updatedFinancials.netTotal,
      paidTotal: updatedFinancials.paidTotal,
      outstandingBalance: updatedFinancials.outstandingBalance,
      isFullyPaid: updatedFinancials.isFullyPaid,
      payments: updatedAttendance!.payments.map((p) => this.formatPaymentDto(p)),
    };

    return {
      payment: this.formatPaymentDto(result),
      financials: summary,
    };
  }

  /**
   * Marks a specific PIX installment as paid.
   * Updates PixInstallment status to 'Pago', sets dataPagamento.
   * If all installments are paid, marks parent Payment status to 'Pago'.
   */
  static async payPixInstallment(
    installmentId: string,
    input?: PayPixInstallmentInput
  ): Promise<{ installment: PixInstallmentDto; financials: AttendancePaymentSummaryDto }> {
    const installment = await prisma.pixInstallment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: {
            pixInstallments: true,
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundError('Parcela PIX não encontrada');
    }

    const payDate = input?.dataPagamento ?? new Date();

    const updatedInstallment = await prisma.$transaction(async (tx) => {
      // 1. Update this installment
      const updated = await tx.pixInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'Pago',
          dataPagamento: payDate,
        },
      });

      // 2. Mark linked reminder as concluido if pending
      await tx.reminder.updateMany({
        where: {
          pixInstallmentId: installmentId,
          status: 'pendente',
        },
        data: {
          status: 'concluido',
          completedAt: payDate,
        },
      });

      // 3. Check if all sibling installments are now Pago
      const allSiblings = await tx.pixInstallment.findMany({
        where: { paymentId: installment.paymentId },
      });

      const allPaid = allSiblings.every((s) => s.id === installmentId || s.status === 'Pago');

      if (allPaid) {
        await tx.payment.update({
          where: { id: installment.paymentId },
          data: {
            status: 'Pago',
            dataPagamento: payDate,
          },
        });
      }

      return updated;
    });

    // Recompute financials for the attendance
    const attendance = await prisma.attendance.findUnique({
      where: { id: installment.payment.attendanceId },
      include: {
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const updatedFinancials = AttendanceService.computeFinancials(attendance!);
    const summary: AttendancePaymentSummaryDto = {
      attendanceId: installment.payment.attendanceId,
      standardTotal: updatedFinancials.standardTotal,
      practicedTotal: updatedFinancials.practicedTotal,
      explicitDiscount: updatedFinancials.explicitDiscount,
      netTotal: updatedFinancials.netTotal,
      paidTotal: updatedFinancials.paidTotal,
      outstandingBalance: updatedFinancials.outstandingBalance,
      isFullyPaid: updatedFinancials.isFullyPaid,
      payments: attendance!.payments.map((p) => this.formatPaymentDto(p)),
    };

    return {
      installment: this.formatPixInstallmentDto(updatedInstallment),
      financials: summary,
    };
  }

  /**
   * Updates a PIX installment's status (e.g. Atrasado, Pendente, Cancelado, Pago).
   */
  static async updatePixInstallmentStatus(
    installmentId: string,
    input: UpdatePixInstallmentStatusInput
  ): Promise<{ installment: PixInstallmentDto; financials: AttendancePaymentSummaryDto }> {
    if (input.status === 'Pago') {
      return this.payPixInstallment(installmentId, { dataPagamento: input.dataPagamento ?? new Date() });
    }

    const installment = await prisma.pixInstallment.findUnique({
      where: { id: installmentId },
      include: {
        payment: true,
      },
    });

    if (!installment) {
      throw new NotFoundError('Parcela PIX não encontrada');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.pixInstallment.update({
        where: { id: installmentId },
        data: {
          status: input.status,
          dataPagamento: input.status === 'Pago' ? (input.dataPagamento ?? new Date()) : null,
        },
      });

      // If status reverted from Pago to Pendente/Atrasado, ensure parent payment is not 'Pago'
      if (input.status !== 'Pago') {
        await tx.payment.update({
          where: { id: installment.paymentId },
          data: { status: 'Pendente' },
        });
      }

      return res;
    });

    const attendance = await prisma.attendance.findUnique({
      where: { id: installment.payment.attendanceId },
      include: {
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const updatedFinancials = AttendanceService.computeFinancials(attendance!);
    const summary: AttendancePaymentSummaryDto = {
      attendanceId: installment.payment.attendanceId,
      standardTotal: updatedFinancials.standardTotal,
      practicedTotal: updatedFinancials.practicedTotal,
      explicitDiscount: updatedFinancials.explicitDiscount,
      netTotal: updatedFinancials.netTotal,
      paidTotal: updatedFinancials.paidTotal,
      outstandingBalance: updatedFinancials.outstandingBalance,
      isFullyPaid: updatedFinancials.isFullyPaid,
      payments: attendance!.payments.map((p) => this.formatPaymentDto(p)),
    };

    return {
      installment: this.formatPixInstallmentDto(updated),
      financials: summary,
    };
  }

  /**
   * Retrieves all payments for an attendance with dynamic financials.
   */
  static async getPaymentsByAttendance(attendanceId: string): Promise<AttendancePaymentSummaryDto> {
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        procedures: { select: { standardValueSnapshot: true, practicedValue: true } },
        payments: {
          include: { pixInstallments: { orderBy: { numeroParcela: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    const financials = AttendanceService.computeFinancials(attendance);

    return {
      attendanceId,
      standardTotal: financials.standardTotal,
      practicedTotal: financials.practicedTotal,
      explicitDiscount: financials.explicitDiscount,
      netTotal: financials.netTotal,
      paidTotal: financials.paidTotal,
      outstandingBalance: financials.outstandingBalance,
      isFullyPaid: financials.isFullyPaid,
      payments: attendance.payments.map((p) => this.formatPaymentDto(p)),
    };
  }

  /**
   * Retrieves a single payment by ID.
   */
  static async getPaymentById(paymentId: string): Promise<PaymentDto> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        pixInstallments: { orderBy: { numeroParcela: 'asc' } },
      },
    });

    if (!payment) {
      throw new NotFoundError('Pagamento não encontrado');
    }

    return this.formatPaymentDto(payment);
  }

  /**
   * Cancels a payment, cancelling all child PIX installments and dismissing linked reminders.
   */
  static async cancelPayment(paymentId: string): Promise<PaymentDto> {
    const payment = await this.getPaymentById(paymentId);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Cancel payment
      const p = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'Cancelado' },
        include: { pixInstallments: true },
      });

      // 2. Cancel child installments
      await tx.pixInstallment.updateMany({
        where: { paymentId },
        data: { status: 'Cancelado' },
      });

      // 3. Dismiss linked reminders
      if (payment.pixInstallments && payment.pixInstallments.length > 0) {
        const instIds = payment.pixInstallments.map((i) => i.id);
        await tx.reminder.updateMany({
          where: { pixInstallmentId: { in: instIds } },
          data: { status: 'dispensado', completedAt: new Date() },
        });
      }

      return p;
    });

    return this.formatPaymentDto(updated);
  }

  /**
   * Deletes a payment record.
   * Due to database cascade constraints, deleting payment automatically deletes child PixInstallment rows.
   */
  static async deletePayment(paymentId: string): Promise<{ success: boolean }> {
    await this.getPaymentById(paymentId);
    await prisma.payment.delete({ where: { id: paymentId } });
    return { success: true };
  }
}
