import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { registerStockUnits } from '@/services/stock.service';
import { registerUnitsSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: lotId } = await params;
    const body = await request.json();
    const parsed = registerUnitsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de registro de unidades inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const units = await registerStockUnits(lotId, parsed.data);
    return NextResponse.json({ success: true, data: units }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar unidades' }, { status: 500 });
  }
}
