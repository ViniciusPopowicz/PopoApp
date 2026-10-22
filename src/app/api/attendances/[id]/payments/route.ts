// src/app/api/attendances/[id]/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { PaymentService } from '@/services/payment.service';
import { recordPaymentSchema, createPixScheduleSchema } from '@/schemas/payment';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const data = await PaymentService.getPaymentsByAttendance(id);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao buscar pagamentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // If body indicates PIX installment schedule
    if (body.metodo === 'Pix' && (body.numeroParcelas > 1 || body.primeiroVencimento || body.valorTotal)) {
      const parsedSchedule = createPixScheduleSchema.safeParse({
        valorTotal: body.valorTotal ?? body.valor,
        numeroParcelas: body.numeroParcelas,
        primeiroVencimento: body.primeiroVencimento ?? body.dataPagamento ?? new Date(),
        intervaloDias: body.intervaloDias,
        observacoes: body.observacoes,
      });

      if (!parsedSchedule.success) {
        return NextResponse.json(
          { success: false, error: 'Dados do parcelamento PIX inválidos', issues: parsedSchedule.error.format() },
          { status: 400 }
        );
      }

      const result = await PaymentService.createPixInstallmentSchedule(id, parsedSchedule.data);
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    // Direct payment
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do pagamento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await PaymentService.recordPayment(id, parsed.data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar pagamento' }, { status: 500 });
  }
}
