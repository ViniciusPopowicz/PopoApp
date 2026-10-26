// src/app/api/financial/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const status = searchParams.get('status') ?? undefined;
    const metodo = searchParams.get('metodo') ?? undefined;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'todos' && status !== 'ALL') where.status = status;
    if (metodo && metodo !== 'todos' && metodo !== 'ALL') where.metodo = metodo;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dataPagamento: 'desc' }, { createdAt: 'desc' }],
        include: {
          attendance: {
            select: {
              id: true,
              dataHora: true,
              status: true,
              desconto: true,
              client: { select: { id: true, nome: true, cpf: true } },
              procedures: {
                select: {
                  id: true,
                  practicedValue: true,
                  procedure: { select: { id: true, nome: true } },
                },
              },
            },
          },
          pixInstallments: {
            orderBy: { numeroParcela: 'asc' },
          },
        },
      }),
    ]);

    const formattedPayments = payments.map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      metodo: p.metodo,
      status: p.status,
      dataPagamento: p.dataPagamento?.toISOString() ?? p.createdAt.toISOString(),
      numeroParcelas: p.numeroParcelas,
      identificadorTransacao: p.identificadorTransacao,
      observacoes: p.observacoes,
      attendance: {
        id: p.attendance.id,
        dataHora: p.attendance.dataHora.toISOString(),
        status: p.attendance.status,
        desconto: Number(p.attendance.desconto),
        client: p.attendance.client,
        procedures: p.attendance.procedures.map((proc) => ({
          id: proc.id,
          nome: proc.procedure.nome,
          practicedValue: Number(proc.practicedValue),
          procedure: {
            id: proc.procedure.id,
            nome: proc.procedure.nome,
          },
        })),
      },
      pixInstallments: p.pixInstallments.map((inst) => ({
        id: inst.id,
        numeroParcela: inst.numeroParcela,
        totalParcelas: inst.totalParcelas,
        valor: Number(inst.valor),
        dataVencimento: inst.dataVencimento.toISOString(),
        dataPagamento: inst.dataPagamento?.toISOString() ?? null,
        status: inst.status,
      })),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      data: formattedPayments,
      payments: formattedPayments,
      page,
      limit,
      total,
      totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao buscar transações' }, { status: 500 });
  }
}
