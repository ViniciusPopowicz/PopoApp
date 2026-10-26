import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-auth';
import { FinancialService } from '@/services/financial.service';
import { updateFinancialObligationSchema } from '@/schemas/financial';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const obligation = await FinancialService.getObligationById(id);
    return NextResponse.json({ success: true, data: obligation });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = updateFinancialObligationSchema.parse(body);
    const updated = await FinancialService.updateObligation(id, input);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
