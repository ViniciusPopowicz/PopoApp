import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { recordProductUsage } from '@/services/stock.service';
import { recordProductUsageSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;

    const usages = await prisma.productUsage.findMany({
      where: { attendanceId },
      include: {
        attendance: { include: { client: true } },
        stockUnit: {
          include: { lot: { include: { product: true } } },
        },
        attendanceProcedure: {
          include: { procedure: true },
        },
      },
      orderBy: { dataHora: 'asc' },
    });

    const data = usages.map((u) => ({
      id: u.id,
      attendanceId: u.attendanceId,
      attendanceDate: u.attendance.dataHora.toISOString(),
      clientId: u.attendance.clientId,
      clientName: u.attendance.client.nome,
      stockUnitId: u.stockUnitId,
      codigoSerial: u.stockUnit.codigoSerial,
      productName: u.stockUnit.lot.product.nome,
      isReusable: u.stockUnit.lot.product.isReusable,
      attendanceProcedureId: u.attendanceProcedureId,
      procedureName: u.attendanceProcedure?.procedure?.nome ?? null,
      dataHora: u.dataHora.toISOString(),
      observacoes: u.observacoes,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar usos de produtos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const body = await request.json();

    const parsed = recordProductUsageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de consumo do produto inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const usage = await recordProductUsage(attendanceId, parsed.data);
    return NextResponse.json({ success: true, data: usage }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar uso de produto' }, { status: 500 });
  }
}
