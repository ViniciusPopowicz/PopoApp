import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-auth';
import { FinancialService } from '@/services/financial.service';
import {
  createManualMovementSchema,
  movementListQuerySchema,
} from '@/schemas/financial';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const query = movementListQuerySchema.parse({
      tipo: searchParams.get('tipo') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      origem: searchParams.get('origem') ?? undefined,
      metodo: searchParams.get('metodo') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    const result = await FinancialService.listMovements(query);

    return NextResponse.json({
      success: true,
      data: result.items,
      movements: result.items,
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
    const input = createManualMovementSchema.parse(body);
    const created = await FinancialService.createManualMovement(input);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
