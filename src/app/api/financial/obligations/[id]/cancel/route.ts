import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/api-auth';
import { FinancialService } from '@/services/financial.service';
import { cancelFinancialObligationSchema } from '@/schemas/financial';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = cancelFinancialObligationSchema.parse(body);
    const cancelled = await FinancialService.cancelObligation(id, input);
    return NextResponse.json({ success: true, data: cancelled });
  } catch (err) {
    return handleApiError(err);
  }
}
