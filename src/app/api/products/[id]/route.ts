import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getProductById, updateProduct, deleteProduct } from '@/services/product.service';
import { updateProductSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const product = await getProductById(id);
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar produto' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateProduct(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar produto' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PUT(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const result = await deleteProduct(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao remover produto' }, { status: 500 });
  }
}
