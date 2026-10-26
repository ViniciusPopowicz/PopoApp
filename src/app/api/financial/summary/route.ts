// src/app/api/financial/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { DashboardService } from '@/services/dashboard.service';
import { FinancialService } from '@/services/financial.service';
import { dashboardQuerySchema } from '@/schemas/dashboard';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const rawQuery = {
      period: searchParams.get('period') ?? 'month',
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      refDate: searchParams.get('refDate') ?? undefined,
    };

    const parsed = dashboardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { startDate, endDate } = DashboardService.getDateRange(
      parsed.data.period,
      parsed.data.refDate,
      parsed.data.startDate,
      parsed.data.endDate
    );

    const [baseMetrics, baseReceivables, cashFlowSummary] = await Promise.all([
      DashboardService.getFinancialMetrics(startDate, endDate),
      DashboardService.getAccountsReceivableSummary(),
      FinancialService.getCashFlowSummary(startDate, endDate),
    ]);

    const transactionCount = cashFlowSummary.inflowsByMethod.reduce((acc, m) => acc + m.count, 0);
    const receivedRevenue = cashFlowSummary.totalInflows;
    const averageTicket =
      transactionCount > 0 ? Number((receivedRevenue / transactionCount).toFixed(2)) : 0;

    const totalOutstandingCombined = Number(
      (baseReceivables.totalOutstanding + cashFlowSummary.pendingReceivables).toFixed(2)
    );
    const overdueCombinedTotal = Number(
      (baseReceivables.overduePixInstallments.total + cashFlowSummary.overdueReceivables).toFixed(2)
    );

    const metrics = {
      ...baseMetrics,
      receivedRevenue,
      outstandingRevenue: Number(
        (baseMetrics.outstandingRevenue + cashFlowSummary.pendingReceivables).toFixed(2)
      ),
      averageTicket,
      transactionCount,
      totalInflows: cashFlowSummary.totalInflows,
      totalOutflows: cashFlowSummary.totalOutflows,
      netCashFlow: cashFlowSummary.netCashFlow,
    };

    const cashFlow = cashFlowSummary.inflowsByMethod.map((item) => ({
      metodo: item.metodo,
      method: item.method,
      label: item.label,
      total: item.total,
      count: item.count,
      percentage: item.percentage,
    }));

    const receivables = {
      ...baseReceivables,
      totalOutstanding: totalOutstandingCombined,
      totalReceivable: totalOutstandingCombined,
      countPendingInstallments:
        baseReceivables.overduePixInstallments.count +
        baseReceivables.upcomingPixInstallments.count,
      overdueTotal: overdueCombinedTotal,
      overdueCount: baseReceivables.overduePixInstallments.count,
      dueSoonTotal: baseReceivables.upcomingPixInstallments.total,
      dueSoonCount: baseReceivables.upcomingPixInstallments.count,
      obligationsPendingTotal: cashFlowSummary.pendingReceivables,
      obligationsOverdueTotal: cashFlowSummary.overdueReceivables,
    };

    const payables = {
      totalPending: cashFlowSummary.pendingPayables,
      totalOverdue: cashFlowSummary.overduePayables,
      outflowsByCategory: cashFlowSummary.outflowsByCategory,
    };

    const summaryPayload = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      metrics,
      cashFlow,
      cashFlowSummary,
      receivables,
      payables,
    };

    return NextResponse.json({
      success: true,
      data: summaryPayload,
      ...summaryPayload,
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao gerar resumo financeiro' }, { status: 500 });
  }
}
