import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import {
  getProcedureById,
  updateProcedure,
  toggleProcedureActive,
  deleteProcedure,
} from '@/services/procedure.service';
import { updateProcedureSchema } from '@/schemas/procedure';
import { DomainError } from '@/lib/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(request);

    const { id } = await context.params;
    const procedure = await getProcedureById(id);

    if (!procedure) {
      return NextResponse.json(
        { success: false, error: 'Procedimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: procedure,
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao consultar procedimento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar procedimento' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(request);

    const { id } = await context.params;
    const body = await request.json();

    const parsed = updateProcedureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados de atualização inválidos',
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const updated = await updateProcedure(id, parsed.data);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao atualizar procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar procedimento' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(request);

    const { id } = await context.params;
    const body = await request.json();

    const targetState =
      body.isActive !== undefined
        ? Boolean(body.isActive)
        : body.ativo !== undefined
        ? Boolean(body.ativo)
        : undefined;

    const toggled = await toggleProcedureActive(id, targetState);

    return NextResponse.json({
      success: true,
      data: toggled,
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao alternar status do procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao alternar status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(request);

    const { id } = await context.params;
    const result = await deleteProcedure(id);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Erro ao remover procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao processar exclusão' },
      { status: 500 }
    );
  }
}
