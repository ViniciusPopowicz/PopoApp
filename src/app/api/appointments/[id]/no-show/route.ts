import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AppointmentService } from '@/services/appointment.service';
import { noShowAppointmentSchema } from '@/schemas/appointment';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const parsed = noShowAppointmentSchema.safeParse(body);
    const noShow = await AppointmentService.markNoShow(id, parsed.success ? parsed.data : undefined);
    return NextResponse.json({ success: true, data: noShow });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar falta' }, { status: 500 });
  }
}
