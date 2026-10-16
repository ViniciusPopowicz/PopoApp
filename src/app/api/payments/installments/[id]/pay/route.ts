// src/app/api/payments/installments/[id]/pay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { PaymentService } from '@/services/payment.service';
import { payPixInstallmentSchema } from '@/schemas/payment';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if paying with default now()
    }

    const parsed = payPixInstallmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos para baixa da parcela', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await PaymentService.payPixInstallment(id, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao baixar parcela PIX' }, { status: 500 });
  }
}
