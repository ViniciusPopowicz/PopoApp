import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import {
  listProcedures,
  createProcedure,
} from '@/services/procedure.service';
import {
  createProcedureSchema,
  procedureQuerySchema,
} from '@/schemas/procedure';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      active: searchParams.get('active') ?? searchParams.get('ativo') ?? undefined,
    };

    const parsedQuery = procedureQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros de busca inválidos',
          issues: parsedQuery.error.format(),
        },
        { status: 400 }
      );
    }

    const procedures = await listProcedures(parsedQuery.data);

    return NextResponse.json({
      success: true,
      data: procedures,
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao listar procedimentos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar procedimentos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const parsed = createProcedureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados do procedimento inválidos',
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const procedure = await createProcedure(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: procedure,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao criar procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar procedimento' },
      { status: 500 }
    );
  }
}
