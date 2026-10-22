// src/services/dashboard.service.ts
import prisma from '@/lib/prisma';
import {
  DashboardQueryInput,
} from '@/schemas/dashboard';
import {
  DashboardPeriod,
  DashboardSummaryResponseDto,
  FinancialMetricDto,
  PaymentMethodBreakdownDto,
  AccountsReceivableSummaryDto,
  AppointmentsMetricsDto,
  AttendancesMetricsDto,
  LowStockAlertDto,
  RemindersWidgetDto,
  BirthdayItemDto,
} from '@/types/dashboard';

const METHOD_LABELS: Record<string, string> = {
  Dinheiro: 'Dinheiro',
  Pix: 'PIX',
  CartaoDebito: 'Cartão de Débito',
  CartaoCredito: 'Cartão de Crédito',
  Boleto: 'Boleto Bancário',
  Transferencia: 'Transferência Bancária',
  Outro: 'Outro',
};

export class DashboardService {
  /**
   * Helper to compute start and end timestamps based on period type and reference date.
   */
  static getDateRange(
    period: DashboardPeriod = 'month',
    refDateInput?: string | Date,
    customStart?: string,
    customEnd?: string
  ): { startDate: Date; endDate: Date } {
    const ref = refDateInput ? new Date(refDateInput) : new Date();

    if (period === 'custom' && customStart && customEnd) {
      return {
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      };
    }

    if (period === 'today') {
      const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
      const endDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'week') {
      const day = ref.getDay(); // 0 is Sunday
      const diffToSunday = day;
      const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - diffToSunday, 0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'year') {
      const startDate = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
      const endDate = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'all') {
      return {
        startDate: new Date('2000-01-01T00:00:00.000Z'),
        endDate: new Date('2099-12-31T23:59:59.999Z'),
      };
    }

    // Default 'month'
    const startDate = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const lastDayOfMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const endDate = new Date(ref.getFullYear(), ref.getMonth(), lastDayOfMonth, 23, 59, 59, 999);
    return { startDate, endDate };
  }

  /**
   * Computes gross, discounts, net, and received revenue for a specific time range.
   */
  static async getFinancialMetrics(startDate: Date, endDate: Date): Promise<FinancialMetricDto> {
    // 1. Completed attendances in period
    const attendances = await prisma.attendance.findMany({
      where: {
        status: 'Realizado',
        dataHora: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        desconto: true,
        procedures: { select: { practicedValue: true } },
        payments: {
          select: {
            valor: true,
            status: true,
            pixInstallments: { select: { valor: true, status: true } },
          },
        },
      },
    });

    let grossRevenue = 0;
    let totalDiscounts = 0;
    let netRevenue = 0;

    for (const att of attendances) {
      const practicedSum = att.procedures.reduce((acc, p) => acc + Number(p.practicedValue), 0);
      const discount = Number(att.desconto ?? 0);
      const net = Math.max(0, practicedSum - discount);

      grossRevenue += practicedSum;
      totalDiscounts += discount;
      netRevenue += net;
    }

    // 2. Realized cash receipts in period (actual payments and installments paid in range)
    const directPayments = await prisma.payment.findMany({
      where: {
        status: 'Pago',
        pixInstallments: { none: {} },
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true },
    });

    const paidInstallments = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pago',
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true },
    });

    const receivedRevenue =
      directPayments.reduce((acc, p) => acc + Number(p.valor), 0) +
      paidInstallments.reduce((acc, i) => acc + Number(i.valor), 0);

    // 3. Outstanding revenue for attendances executed in this period
    let paidForTheseAttendances = 0;
    for (const att of attendances) {
      for (const p of att.payments) {
        if (p.pixInstallments && p.pixInstallments.length > 0) {
          paidForTheseAttendances += p.pixInstallments
            .filter((i) => i.status === 'Pago')
            .reduce((sum, i) => sum + Number(i.valor), 0);
        } else if (p.status === 'Pago') {
          paidForTheseAttendances += Number(p.valor);
        }
      }
    }
    const outstandingRevenue = Math.max(0, netRevenue - paidForTheseAttendances);

    return {
      grossRevenue,
      totalDiscounts,
      netRevenue,
      receivedRevenue,
      outstandingRevenue,
    };
  }

  /**
   * Computes cash flow breakdown grouped by payment method.
   */
  static async getCashFlowByMethod(startDate: Date, endDate: Date): Promise<PaymentMethodBreakdownDto[]> {
    const directPayments = await prisma.payment.findMany({
      where: {
        status: 'Pago',
        pixInstallments: { none: {} },
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true, metodo: true },
    });

    const paidInstallments = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pago',
        dataPagamento: { gte: startDate, lte: endDate },
      },
      select: { valor: true },
    });

    const methodMap = new Map<string, { total: number; count: number }>();

    for (const p of directPayments) {
      const current = methodMap.get(p.metodo) || { total: 0, count: 0 };
      current.total += Number(p.valor);
      current.count += 1;
      methodMap.set(p.metodo, current);
    }

    if (paidInstallments.length > 0) {
      const current = methodMap.get('Pix') || { total: 0, count: 0 };
      current.total += paidInstallments.reduce((sum, i) => sum + Number(i.valor), 0);
      current.count += paidInstallments.length;
      methodMap.set('Pix', current);
    }

    let totalReceived = 0;
    methodMap.forEach((data) => {
      totalReceived += data.total;
    });

    const result: PaymentMethodBreakdownDto[] = [];
    methodMap.forEach((data, metodo) => {
      result.push({
        metodo,
        label: METHOD_LABELS[metodo] || metodo,
        total: data.total,
        count: data.count,
        percentage: totalReceived > 0 ? Number(((data.total / totalReceived) * 100).toFixed(2)) : 0,
      });
    });

    return result.sort((a, b) => b.total - a.total);
  }

  /**
   * Computes accounts receivable summary across all active attendances (D2).
   */
  static async getAccountsReceivableSummary(): Promise<AccountsReceivableSummaryDto> {
    const activeAttendances = await prisma.attendance.findMany({
      where: { status: { not: 'Cancelado' } },
      select: {
        id: true,
        clientId: true,
        dataHora: true,
        desconto: true,
        client: { select: { id: true, nome: true, telefone: true, cpf: true } },
        procedures: { select: { practicedValue: true } },
        payments: {
          select: {
            valor: true,
            status: true,
            pixInstallments: { select: { valor: true, status: true } },
          },
        },
      },
    });

    let totalOutstanding = 0;
    const clientSet = new Set<string>();
    const debtorsList: AccountsReceivableSummaryDto['topDebtors'] = [];

    for (const att of activeAttendances) {
      const practicedTotal = att.procedures.reduce((acc, p) => acc + Number(p.practicedValue), 0);
      const explicitDiscount = Number(att.desconto ?? 0);
      const netTotal = Math.max(0, practicedTotal - explicitDiscount);

      let paidTotal = 0;
      for (const p of att.payments) {
        if (p.pixInstallments && p.pixInstallments.length > 0) {
          paidTotal += p.pixInstallments
            .filter((i) => i.status === 'Pago')
            .reduce((sum, i) => sum + Number(i.valor), 0);
        } else if (p.status === 'Pago') {
          paidTotal += Number(p.valor);
        }
      }

      const outstandingBalance = Math.max(0, netTotal - paidTotal);

      if (outstandingBalance > 0) {
        totalOutstanding += outstandingBalance;
        clientSet.add(att.clientId);
        debtorsList.push({
          attendanceId: att.id,
          clientId: att.clientId,
          clientName: att.client.nome,
          clientPhone: att.client.telefone,
          clientCpf: att.client.cpf,
          attendanceDate: att.dataHora.toISOString(),
          netTotal,
          paidTotal,
          outstandingBalance,
        });
      }
    }

    debtorsList.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // PIX Installment status
    const now = new Date();
    const overduePix = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        dataVencimento: { lt: now },
      },
      select: { valor: true },
    });
    const upcomingPix = await prisma.pixInstallment.findMany({
      where: {
        status: 'Pendente',
        dataVencimento: { gte: now },
      },
      select: { valor: true },
    });

    return {
      totalOutstanding,
      attendancesCount: debtorsList.length,
      clientsCount: clientSet.size,
      overduePixInstallments: {
        total: overduePix.reduce((acc, p) => acc + Number(p.valor), 0),
        count: overduePix.length,
      },
      upcomingPixInstallments: {
        total: upcomingPix.reduce((acc, p) => acc + Number(p.valor), 0),
        count: upcomingPix.length,
      },
      topDebtors: debtorsList.slice(0, 10),
    };
  }

  /**
   * Computes appointment metrics and upcoming list for today.
   */
  static async getAppointmentsMetrics(todayStart: Date, todayEnd: Date, now: Date): Promise<AppointmentsMetricsDto> {
    const todayAppointments = await prisma.appointment.findMany({
      where: {
        dataHora: { gte: todayStart, lte: todayEnd },
      },
      select: { status: true },
    });

    const byStatus = {
      agendado: 0,
      confirmado: 0,
      concluido: 0,
      cancelado: 0,
      naoCompareceu: 0,
      reagendado: 0,
    };

    for (const appt of todayAppointments) {
      if (appt.status === 'Agendado') byStatus.agendado++;
      else if (appt.status === 'Confirmado') byStatus.confirmado++;
      else if (appt.status === 'Concluído') byStatus.concluido++;
      else if (appt.status === 'Cancelado') byStatus.cancelado++;
      else if (appt.status === 'Não compareceu') byStatus.naoCompareceu++;
      else if (appt.status === 'Reagendado') byStatus.reagendado++;
    }

    const upcomingRaw = await prisma.appointment.findMany({
      where: {
        dataHora: { gte: now },
        status: { notIn: ['Cancelado', 'Não compareceu', 'Concluído'] },
      },
      orderBy: { dataHora: 'asc' },
      take: 5,
      include: {
        client: { select: { id: true, nome: true, profilePhotoId: true } },
        plannedProcedures: { include: { procedure: { select: { nome: true, duracaoMinutos: true } } } },
      },
    });

    const upcomingList = upcomingRaw.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: a.client.nome,
      clientPhotoUrl: a.client.profilePhotoId ? `/api/attachments/${a.client.profilePhotoId}` : null,
      dataHora: a.dataHora.toISOString(),
      status: a.status,
      duracaoMinutos: a.plannedProcedures.reduce((sum, p) => sum + (p.procedure?.duracaoMinutos || 0), 0),
      procedimentosPlanejados: a.plannedProcedures.map((p) => p.procedure.nome),
    }));

    return {
      todayTotal: todayAppointments.length,
      byStatus,
      upcomingList,
    };
  }

  /**
   * Computes attendance volume and completion rate for today.
   */
  static async getAttendancesMetrics(todayStart: Date, todayEnd: Date): Promise<AttendancesMetricsDto> {
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        dataHora: { gte: todayStart, lte: todayEnd },
      },
      select: { status: true },
    });

    let realizadosCount = 0;
    let pendentesCount = 0;
    let canceladosCount = 0;

    for (const att of todayAttendances) {
      if (att.status === 'Realizado') realizadosCount++;
      else if (att.status === 'Pendente') pendentesCount++;
      else if (att.status === 'Cancelado') canceladosCount++;
    }

    const totalActive = realizadosCount + pendentesCount;
    const completionRate = totalActive > 0 ? Number(((realizadosCount / totalActive) * 100).toFixed(1)) : 0;

    return {
      todayTotal: todayAttendances.length,
      realizadosCount,
      pendentesCount,
      canceladosCount,
      completionRate,
    };
  }

  /**
   * Computes low stock alerts for active products with <= 5 available units.
   */
  static async getLowStockAlerts(now: Date): Promise<LowStockAlertDto[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        nome: true,
        marca: true,
        categoria: true,
        unidade: true,
        isReusable: true,
        lots: {
          select: {
            dataValidade: true,
            stockUnits: {
              where: { status: 'Disponivel' },
              select: { id: true },
            },
          },
        },
      },
    });

    const alerts: LowStockAlertDto[] = [];

    for (const prod of products) {
      let availableUnits = 0;
      for (const lot of prod.lots) {
        // Exclude expired lots
        if (!lot.dataValidade || lot.dataValidade > now) {
          availableUnits += lot.stockUnits.length;
        }
      }

      if (availableUnits <= 5) {
        alerts.push({
          productId: prod.id,
          productName: prod.nome,
          marca: prod.marca,
          categoria: prod.categoria,
          unidade: prod.unidade,
          isReusable: prod.isReusable,
          availableUnits,
          alertLevel: availableUnits === 0 ? 'CRITICO' : 'BAIXO',
        });
      }
    }

    return alerts.sort((a, b) => a.availableUnits - b.availableUnits);
  }

  /**
   * Computes in-app reminders feed for pending reminders.
   */
  static async getRemindersWidget(todayStart: Date, todayEnd: Date): Promise<RemindersWidgetDto> {
    const pendingReminders = await prisma.reminder.findMany({
      where: { status: 'pendente' },
      orderBy: { dataVencimento: 'asc' },
      take: 10,
      include: {
        client: { select: { id: true, nome: true } },
        pixInstallment: { select: { id: true, valor: true, numeroParcela: true, totalParcelas: true } },
      },
    });

    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;

    const items = pendingReminders.map((r) => {
      const isOverdue = r.dataVencimento < todayStart;
      const isToday = r.dataVencimento >= todayStart && r.dataVencimento <= todayEnd;

      if (isOverdue) overdueCount++;
      else if (isToday) todayCount++;
      else upcomingCount++;

      return {
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        dataVencimento: r.dataVencimento.toISOString(),
        prioridade: r.prioridade,
        status: r.status,
        tipo: r.tipo,
        clientId: r.clientId,
        clientName: r.client?.nome ?? null,
        pixInstallmentId: r.pixInstallmentId,
        installmentValor: r.pixInstallment ? Number(r.pixInstallment.valor) : null,
        isOverdue,
      };
    });

    return {
      summary: {
        totalPending: pendingReminders.length,
        overdueCount,
        todayCount,
        upcomingCount,
      },
      items,
    };
  }

  /**
   * Computes upcoming birthdays within current month or next 30 days.
   */
  static async getBirthdays(now: Date): Promise<BirthdayItemDto[]> {
    const clients = await prisma.client.findMany({
      where: {
        status: 'ativo',
        dataNascimento: { not: null },
      },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        telefone: true,
      },
    });

    const currentYear = now.getFullYear();
    const results: BirthdayItemDto[] = [];

    for (const client of clients) {
      if (!client.dataNascimento) continue;
      const bday = new Date(client.dataNascimento);
      const bdayThisYear = new Date(currentYear, bday.getMonth(), bday.getDate());

      // If already passed this year, look at next year
      if (bdayThisYear < now) {
        bdayThisYear.setFullYear(currentYear + 1);
      }

      const diffTime = bdayThisYear.getTime() - now.getTime();
      const diasFaltando = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diasFaltando <= 30) {
        results.push({
          id: client.id,
          nome: client.nome,
          dataNascimento: client.dataNascimento.toISOString(),
          dataAniversario: `${String(bday.getDate()).padStart(2, '0')}/${String(bday.getMonth() + 1).padStart(2, '0')}`,
          diasFaltando,
          telefone: client.telefone,
        });
      }
    }

    return results.sort((a, b) => a.diasFaltando - b.diasFaltando).slice(0, 5);
  }

  /**
   * Master aggregator for executive dashboard payload.
   */
  static async getDashboardSummary(input?: DashboardQueryInput): Promise<DashboardSummaryResponseDto> {
    const period = input?.period ?? 'month';
    const refDate = input?.refDate ? new Date(input.refDate) : new Date();
    const { startDate, endDate } = this.getDateRange(period, refDate, input?.startDate, input?.endDate);

    const now = new Date();
    const todayRange = this.getDateRange('today', now);
    const weekRange = this.getDateRange('week', now);
    const monthRange = this.getDateRange('month', now);

    const [
      currentPeriodFinancial,
      dailyFinancial,
      weeklyFinancial,
      monthlyFinancial,
      cashFlowByMethod,
      accountsReceivable,
      appointments,
      attendances,
      lowStock,
      reminders,
      birthdays,
    ] = await Promise.all([
      this.getFinancialMetrics(startDate, endDate),
      this.getFinancialMetrics(todayRange.startDate, todayRange.endDate),
      this.getFinancialMetrics(weekRange.startDate, weekRange.endDate),
      this.getFinancialMetrics(monthRange.startDate, monthRange.endDate),
      this.getCashFlowByMethod(startDate, endDate),
      this.getAccountsReceivableSummary(),
      this.getAppointmentsMetrics(todayRange.startDate, todayRange.endDate, now),
      this.getAttendancesMetrics(todayRange.startDate, todayRange.endDate),
      this.getLowStockAlerts(now),
      this.getRemindersWidget(todayRange.startDate, todayRange.endDate),
      this.getBirthdays(now),
    ]);

    return {
      period: {
        name: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      financial: {
        currentPeriod: currentPeriodFinancial,
        daily: dailyFinancial,
        weekly: weeklyFinancial,
        monthly: monthlyFinancial,
        cashFlowByMethod,
        accountsReceivable,
      },
      operations: {
        appointments,
        attendances,
      },
      alerts: {
        lowStock,
        reminders,
        birthdays,
      },
      legacyCompat: {
        receitasMes: monthlyFinancial.receivedRevenue,
        despesasMes: 0,
        saldoMes: monthlyFinancial.receivedRevenue,
      },
    };
  }
}
