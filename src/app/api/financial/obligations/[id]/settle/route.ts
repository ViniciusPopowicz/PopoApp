import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-auth';
import { FinancialService } from '@/services/financial.service';
import { settleFinancialObligationSchema } from '@/schemas/financial';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = settleFinancialObligationSchema.parse(body);
    const updated = await FinancialService.settleObligation(id, input);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
