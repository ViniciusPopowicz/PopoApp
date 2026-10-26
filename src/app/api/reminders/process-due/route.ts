// src/app/api/reminders/process-due/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * Scheduled / Cron entry point for generating due recurring reminder occurrences
 * and self-healing Pix installment reminders.
 * Supports authentication via active user session OR x-cron-secret / Authorization Bearer token.
 */
async function handleProcessDue(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret =
      request.headers.get('x-cron-secret') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const isCronAuthorized = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);
    if (!isCronAuthorized) {
      await requireAuth(request);
    }

    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const refDateParam =
      body.referenceDate ?? request.nextUrl.searchParams.get('referenceDate') ?? undefined;
    const referenceDate = refDateParam ? new Date(refDateParam) : new Date();

    if (isNaN(referenceDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Data de referência (referenceDate) inválida' },
        { status: 400 }
      );
    }

    const [recurrenceResult, pixSyncResult] = await Promise.all([
      ReminderService.generateDueOccurrences(referenceDate),
      ReminderService.syncPixInstallmentReminders(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        referenceDate: referenceDate.toISOString(),
        processedRecurrences: recurrenceResult.processedRecurrences,
        generatedCount: recurrenceResult.generatedCount,
        generatedReminders: recurrenceResult.generatedReminders,
        pixRemindersSynced: pixSyncResult.generatedCount,
      },
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('[ProcessDueReminders Error]', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar lembretes recorrentes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleProcessDue(request);
}

export async function GET(request: NextRequest) {
  return handleProcessDue(request);
}
