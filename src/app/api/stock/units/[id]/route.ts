import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getStockUnitTraceability, updateStockUnitStatus } from '@/services/stock.service';
import { updateStockUnitStatusSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const traceability = await getStockUnitTraceability(id);
    return NextResponse.json({ success: true, data: traceability });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar unidade' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateStockUnitStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateStockUnitStatus(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar status da unidade' }, { status: 500 });
  }
}
