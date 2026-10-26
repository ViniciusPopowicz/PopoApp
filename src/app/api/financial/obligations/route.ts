import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-auth';
import { FinancialService } from '@/services/financial.service';
import {
  createFinancialObligationSchema,
  obligationListQuerySchema,
} from '@/schemas/financial';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const query = obligationListQuerySchema.parse({
      tipo: searchParams.get('tipo') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      attendanceId: searchParams.get('attendanceId') ?? undefined,
      appointmentId: searchParams.get('appointmentId') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      overdueOnly: searchParams.get('overdueOnly') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    const result = await FinancialService.listObligations(query);

    return NextResponse.json({
      success: true,
      data: result.items,
      obligations: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const input = createFinancialObligationSchema.parse(body);
    const created = await FinancialService.createObligation(input);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
