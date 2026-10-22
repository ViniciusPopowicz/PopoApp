// src/app/api/financial/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { DashboardService } from '@/services/dashboard.service';
import { dashboardQuerySchema } from '@/schemas/dashboard';
import { DomainError } from '@/lib/errors';

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

    const [metrics, cashFlow, receivables] = await Promise.all([
      DashboardService.getFinancialMetrics(startDate, endDate),
      DashboardService.getCashFlowByMethod(startDate, endDate),
      DashboardService.getAccountsReceivableSummary(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        metrics,
        cashFlow,
        receivables,
      },
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao gerar resumo financeiro' }, { status: 500 });
  }
}
