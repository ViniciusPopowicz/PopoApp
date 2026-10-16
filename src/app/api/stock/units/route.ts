import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { listAvailableUnits } from '@/services/stock.service';
import { availableUnitsQuerySchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      productId: searchParams.get('productId') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
    };

    const parsedQuery = availableUnitsQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de busca inválidos', issues: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const units = await listAvailableUnits(parsedQuery.data);
    return NextResponse.json({ success: true, data: units });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar unidades de estoque' }, { status: 500 });
  }
}
