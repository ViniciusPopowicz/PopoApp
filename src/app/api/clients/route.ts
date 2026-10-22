import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { createClientSchema, clientListQuerySchema } from '@/schemas/client';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = clientListQuerySchema.parse(searchParams);

    const result = await ClientService.listClients(query);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/clients:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const client = await ClientService.createClient(parsed.data);
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in POST /api/clients:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
