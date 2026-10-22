import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import prisma from '@/lib/prisma';
import { NotFoundError, DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const lot = await prisma.productLot.findUnique({
      where: { id },
      include: {
        product: true,
        stockUnits: {
          include: {
            currentClient: { select: { id: true, nome: true } },
            usages: true,
          },
        },
      },
    });

    if (!lot) {
      throw new NotFoundError('Lote não encontrado');
    }

    const now = new Date();
    const isExpired = lot.dataValidade !== null && new Date(lot.dataValidade) < now;

    const data = {
      id: lot.id,
      productId: lot.productId,
      productName: lot.product.nome,
      isReusable: lot.product.isReusable,
      numeroLote: lot.numeroLote,
      dataValidade: lot.dataValidade ? lot.dataValidade.toISOString() : null,
      dataAquisicao: lot.dataAquisicao ? lot.dataAquisicao.toISOString() : null,
      precoCusto: lot.precoCusto ? Number(lot.precoCusto) : null,
      observacoes: lot.observacoes,
      isExpired,
      stockUnits: lot.stockUnits.map((u) => ({
        id: u.id,
        codigoSerial: u.codigoSerial,
        status: u.status,
        currentClientId: u.currentClientId,
        currentClientName: u.currentClient?.nome ?? null,
        usageCount: u.usages.length,
      })),
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar lote' }, { status: 500 });
  }
}
