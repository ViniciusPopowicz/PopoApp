import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { updateAttendanceSchema } from '@/schemas/attendance';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const attendance = await AttendanceService.getAttendanceById(id);
    return NextResponse.json({ success: true, data: attendance });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar atendimento' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await AttendanceService.updateAttendance(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar atendimento' }, { status: 500 });
  }
}
