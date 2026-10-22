import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { createLot } from '@/services/stock.service';
import { createLotSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: productId } = await params;
    const body = await request.json();
    const parsed = createLotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do lote inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const lot = await createLot(productId, parsed.data);
    return NextResponse.json({ success: true, data: lot }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar lote' }, { status: 500 });
  }
}
