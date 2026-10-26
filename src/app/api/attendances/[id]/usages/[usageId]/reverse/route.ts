import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { reverseProductUsage, correctProductUsage } from '@/services/stock.service';
import { reverseProductUsageSchema, correctProductUsageSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; usageId: string }> }
) {
  try {
    await requireAuth(request);
    const { usageId } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.novaQuantidade !== undefined) {
      const parsed = correctProductUsageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Dados de correção inválidos', issues: parsed.error.format() },
          { status: 400 }
        );
      }
      const corrected = await correctProductUsage(usageId, parsed.data);
      return NextResponse.json({ success: true, data: corrected });
    }

    const parsed = reverseProductUsageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Motivo de estorno inválido', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const reversed = await reverseProductUsage(usageId, parsed.data);
    return NextResponse.json({ success: true, data: reversed });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao estornar consumo de produto' },
      { status: 500 }
    );
  }
}
