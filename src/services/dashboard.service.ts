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

import { ensureDatabaseSchema } from '@/lib/db-bootstrap';

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
    const parsedRef = refDateInput ? new Date(refDateInput) : new Date();
    const ref = isNaN(parsedRef.getTime()) ? new Date() : parsedRef;

    if (period === 'custom' && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        // If customEnd is a date-only string (YYYY-MM-DD), extend to 23:59:59.999
        if (/^\d{4}-\d{2}-\d{2}$/.test(customEnd.trim())) {
          e.setUTCHours(23, 59, 59, 999);
        }
        return { startDate: s, endDate: e };
      }
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
      const practicedSum = (att.procedures || []).reduce((acc, p) => acc + Number(p.practicedValue), 0);
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
      for (const p of att.payments || []) {
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
      attendancesCount: attendances.length,
      averageTicket: attendances.length > 0 ? Number((netRevenue / attendances.length).toFixed(2)) : 0,
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
      const practicedTotal = (att.procedures || []).reduce((acc, p) => acc + Number(p.practicedValue), 0);
      const explicitDiscount = Number(att.desconto ?? 0);
      const netTotal = Math.max(0, practicedTotal - explicitDiscount);

      let paidTotal = 0;
      for (const p of att.payments || []) {
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
          clientName: att.client?.nome || 'Cliente',
          clientPhone: att.client?.telefone || null,
          clientCpf: att.client?.cpf || '',
          attendanceDate: (att.dataHora instanceof Date ? att.dataHora : new Date(att.dataHora)).toISOString(),
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
      clientName: a.client?.nome || 'Cliente não identificado',
      clientPhotoUrl: a.client?.profilePhotoId ? `/api/attachments/${a.client.profilePhotoId}` : null,
      dataHora: (a.dataHora instanceof Date ? a.dataHora : new Date(a.dataHora)).toISOString(),
      status: a.status,
      duracaoMinutos: (a.plannedProcedures || []).reduce((sum, p) => sum + (p.procedure?.duracaoMinutos || 0), 0),
      procedimentosPlanejados: (a.plannedProcedures || []).map((p) => p.procedure?.nome || 'Procedimento').filter(Boolean),
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
   * Computes low stock alerts for active products with <= threshold available units.
   */
  static async getLowStockAlerts(now: Date, lowStockThreshold = 5): Promise<LowStockAlertDto[]> {
    let products: any[] = [];
    try {
      products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          nome: true,
          marca: true,
          categoria: true,
          unidade: true,
          trackingMode: true,
          estoqueMinimo: true,
          isReusable: true,
          lots: {
            select: {
              dataValidade: true,
              quantidadeInicial: true,
              quantidadeDisponivel: true,
              stockUnits: {
                where: { status: 'Disponivel' },
                select: { id: true },
              },
            },
          },
        },
      });
    } catch {
      products = await prisma.product.findMany({
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
    }

    const alerts: LowStockAlertDto[] = [];

    for (const prod of products) {
      let availableUnits = 0;
      let totalQty = 0;
      for (const lot of prod.lots || []) {
        const expDate = lot.dataValidade ? new Date(lot.dataValidade) : null;
        if (!expDate || isNaN(expDate.getTime()) || expDate > now) {
          const lotAvail =
            lot.quantidadeDisponivel != null
              ? Number(lot.quantidadeDisponivel)
              : Number(lot.quantidadeInicial ?? lot.quantidadeOriginal ?? 0);
          totalQty += lotAvail;
          availableUnits += Array.isArray(lot.stockUnits) ? lot.stockUnits.length : 0;
        }
      }

      const effectiveUnits =
        prod.trackingMode === 'QUANTITY' ? Number(totalQty.toFixed(4)) : availableUnits;
      const threshold = Number(prod.estoqueMinimo ?? lowStockThreshold) || lowStockThreshold;

      if (effectiveUnits <= threshold) {
        alerts.push({
          productId: prod.id,
          productName: prod.nome,
          marca: prod.marca,
          categoria: prod.categoria,
          unidade: prod.unidade,
          isReusable: prod.isReusable,
          availableUnits: effectiveUnits,
          alertLevel: effectiveUnits <= 0 ? 'CRITICO' : 'BAIXO',
          estoqueMinimo: threshold,
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
      const due = r.dataVencimento instanceof Date ? r.dataVencimento : new Date(r.dataVencimento);
      const isOverdue = due < todayStart;
      const isToday = due >= todayStart && due <= todayEnd;

      if (isOverdue) overdueCount++;
      else if (isToday) todayCount++;
      else upcomingCount++;

      return {
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        dataVencimento: isNaN(due.getTime()) ? new Date().toISOString() : due.toISOString(),
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
    const todayStart = new Date(currentYear, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const results: BirthdayItemDto[] = [];

    for (const client of clients) {
      if (!client.dataNascimento) continue;
      const bday = new Date(client.dataNascimento);
      if (isNaN(bday.getTime())) continue;

      const bdayMonth = bday.getUTCMonth();
      const bdayDate = bday.getUTCDate();
      let bdayThisYear = new Date(currentYear, bdayMonth, bdayDate, 0, 0, 0, 0);

      // If already passed this year, look at next year
      if (bdayThisYear < todayStart) {
        bdayThisYear = new Date(currentYear + 1, bdayMonth, bdayDate, 0, 0, 0, 0);
      }

      const diffTime = bdayThisYear.getTime() - todayStart.getTime();
      const diasFaltando = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

      if (diasFaltando <= 30) {
        results.push({
          id: client.id,
          nome: client.nome,
          dataNascimento: bday.toISOString(),
          dataAniversario: `${String(bdayDate).padStart(2, '0')}/${String(bdayMonth + 1).padStart(2, '0')}`,
          diasFaltando,
          telefone: client.telefone,
          proximoAniversario: bdayThisYear.toISOString(),
          diasRestantes: diasFaltando,
        });
      }
    }

    return results.sort((a, b) => a.diasFaltando - b.diasFaltando).slice(0, 5);
  }

  /**
   * Master aggregator for executive dashboard payload.
   */
  static async getDashboardSummary(input?: DashboardQueryInput): Promise<DashboardSummaryResponseDto> {
    await ensureDatabaseSchema();
    const period = input?.period ?? 'month';
    const parsedRef = input?.refDate ? new Date(input.refDate) : new Date();
    const refDate = isNaN(parsedRef.getTime()) ? new Date() : parsedRef;
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
      monthlyAttendances,
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
      this.getAttendancesMetrics(monthRange.startDate, monthRange.endDate),
      this.getLowStockAlerts(now, (input as any)?.lowStockThreshold ?? 5),
      this.getRemindersWidget(todayRange.startDate, todayRange.endDate),
      this.getBirthdays(now),
    ]);

    const monthlyAttendancesCount = monthlyAttendances.realizadosCount || attendances.realizadosCount || 0;
    const monthlyRevenue = monthlyFinancial.receivedRevenue;
    const averageTicket = monthlyAttendancesCount > 0
      ? Number((monthlyRevenue / monthlyAttendancesCount).toFixed(2))
      : 0;

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
        monthly: {
          ...monthlyFinancial,
          averageTicket,
          totalRevenue: monthlyRevenue,
        },
        cashFlowByMethod,
        accountsReceivable,
      },
      operations: {
        appointments: {
          ...appointments,
          nextAppointments: appointments.upcomingList.map((a) => ({
            id: a.id,
            dataHora: a.dataHora,
            status: a.status,
            client: { id: a.clientId, nome: a.clientName },
            plannedProcedures: a.procedimentosPlanejados.map((nome) => ({ procedure: { nome } })),
          })),
        },
        attendances: {
          ...attendances,
          completedCount: monthlyAttendancesCount,
          pendingCount: monthlyAttendances.pendentesCount,
        },
      },
      alerts: {
        lowStock: Object.assign(lowStock, {
          totalAlerts: lowStock.length,
          items: lowStock.map((item) => ({
            id: item.productId,
            nome: item.productName,
            estoqueAtual: item.availableUnits,
            estoqueMinimo: item.estoqueMinimo ?? 5,
            unidade: item.unidade,
            isCritical: item.alertLevel === 'CRITICO',
          })),
        }),
        reminders: {
          ...reminders,
          totalPending: reminders.summary.totalPending,
          totalOverdue: reminders.summary.overdueCount,
          overdueItems: reminders.items
            .filter((i) => i.isOverdue)
            .map((i) => ({
              id: i.id,
              titulo: i.titulo,
              dataVencimento: i.dataVencimento,
              prioridade: i.prioridade,
              client: i.clientName ? { nome: i.clientName } : null,
              pixInstallment: i.installmentValor ? { valor: i.installmentValor } : null,
            })),
          upcomingItems: reminders.items
            .filter((i) => !i.isOverdue)
            .map((i) => ({
              id: i.id,
              titulo: i.titulo,
              dataVencimento: i.dataVencimento,
              prioridade: i.prioridade,
              client: i.clientName ? { nome: i.clientName } : null,
              pixInstallment: i.installmentValor ? { valor: i.installmentValor } : null,
            })),
        },
        birthdays: Object.assign(birthdays, {
          count: birthdays.length,
          items: birthdays.map((b) => ({
            id: b.id,
            nome: b.nome,
            diasRestantes: b.diasFaltando,
            proximoAniversario: b.proximoAniversario || b.dataNascimento,
          })),
        }),
      },
      legacyCompat: {
        receitasMes: monthlyFinancial.receivedRevenue,
        despesasMes: 0,
        saldoMes: monthlyFinancial.receivedRevenue,
      },
    };
  }
}
