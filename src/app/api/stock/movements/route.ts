import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { listInventoryMovements, recordStockMovement } from '@/services/stock.service';
import { inventoryMovementQuerySchema, stockAdjustmentSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const parsed = inventoryMovementQuerySchema.safeParse({
      productId: searchParams.get('productId') ?? undefined,
      lotId: searchParams.get('lotId') ?? undefined,
      stockUnitId: searchParams.get('stockUnitId') ?? undefined,
      attendanceId: searchParams.get('attendanceId') ?? undefined,
      tipo: searchParams.get('tipo') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de consulta inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await listInventoryMovements(parsed.data);

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
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao listar movimentações de estoque' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const parsed = stockAdjustmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de movimentação de estoque inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const created = await recordStockMovement(parsed.data);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao registrar movimentação de estoque' },
      { status: 500 }
    );
  }
}
