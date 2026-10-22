import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { createAttendanceSchema, attendanceListQuerySchema } from '@/schemas/attendance';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      appointmentId: searchParams.get('appointmentId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    const parsedQuery = attendanceListQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de consulta inválidos', issues: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const result = await AttendanceService.listAttendances(parsedQuery.data);
    return NextResponse.json({ success: true, data: result.items, meta: { total: result.total, page: result.page, totalPages: result.totalPages } });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar atendimentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const parsed = createAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do atendimento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const attendance = await AttendanceService.createAttendance(parsed.data);
    return NextResponse.json({ success: true, data: attendance }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar atendimento' }, { status: 500 });
  }
}
