import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const result = await AttendanceService.prefillFromPlanned(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao pré-preencher procedimentos' }, { status: 500 });
  }
}
