import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { listProducts, createProduct } from '@/services/product.service';
import { createProductSchema, productQuerySchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      isReusable: searchParams.get('isReusable') ?? searchParams.get('reutilizavel') ?? undefined,
      active: searchParams.get('active') ?? searchParams.get('ativo') ?? undefined,
    };

    const parsedQuery = productQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de consulta inválidos', issues: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const products = await listProducts(parsedQuery.data);
    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar produtos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do produto inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const product = await createProduct(parsed.data);
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar produto' }, { status: 500 });
  }
}
