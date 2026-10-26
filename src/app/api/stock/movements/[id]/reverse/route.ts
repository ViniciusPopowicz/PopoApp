import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { reverseInventoryMovement } from '@/services/stock.service';
import { reverseProductUsageSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const parsed = reverseProductUsageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Motivo de estorno inválido', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const reversed = await reverseInventoryMovement(id, parsed.data.motivo);
    return NextResponse.json({ success: true, data: reversed });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao estornar movimentação de estoque' },
      { status: 500 }
    );
  }
}
