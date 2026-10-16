// src/app/api/attendances/[id]/payments/pix-schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { PaymentService } from '@/services/payment.service';
import { createPixScheduleSchema } from '@/schemas/payment';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = createPixScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do parcelamento PIX inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await PaymentService.createPixInstallmentSchedule(id, parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar parcelamento PIX' }, { status: 500 });
  }
}
