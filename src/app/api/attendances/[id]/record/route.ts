import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { MedicalRecordService } from '@/services/medical-record.service';
import { createMedicalRecordSchema, updateMedicalRecordSchema } from '@/schemas/medical-record';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const record = await MedicalRecordService.getByAttendanceId(attendanceId);
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar prontuário' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const body = await request.json();

    const parsed = createMedicalRecordSchema.safeParse({
      ...body,
      attendanceId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do prontuário inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const record = await MedicalRecordService.createMedicalRecord(parsed.data);
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar prontuário' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const body = await request.json();

    const parsed = updateMedicalRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização do prontuário inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await MedicalRecordService.updateByAttendanceId(attendanceId, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar prontuário' }, { status: 500 });
  }
}
