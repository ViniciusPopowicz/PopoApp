# Worker Dispatch — UI Clinical (Agenda, Attendances, Financial, Reminders, Dashboard)
Working directory initialized.

## 2026-10-20T02:27:46Z
You are Worker M5 UI Clinical (Generation 5) for PopoApp.
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m5_ui_clinical
Your parent orchestrator is: 8d6c0e93-207a-4af1-807a-6b80b2ba7746

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mandatory Reading before starting work:
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read completely)
2. `POPOAPP_DEVELOPMENT_SPEC.md` (§28 UX/UI Requirements, §39–§46 Agenda, Atendimentos, Financeiro, Lembretes, Dashboard)
3. `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
4. `PROJECT.md`
5. `IMPLEMENTATION_CHECKLIST.md`

Your Exclusive File Write Boundaries:
- `src/app/(authenticated)/agenda/page.tsx`
- `src/app/(authenticated)/atendimentos/page.tsx`
- `src/app/(authenticated)/atendimentos/[id]/page.tsx`
- `src/app/(authenticated)/financeiro/page.tsx`
- `src/app/(authenticated)/lembretes/page.tsx`
- `src/app/(authenticated)/page.tsx`
- Any helper components under `src/components/agenda/`, `src/components/atendimentos/`, `src/components/financeiro/`, `src/components/lembretes/`, `src/components/dashboard/`
DO NOT touch files outside these boundaries.

Your Mission:
1. Replace all `@/data/mock/*` imports with genuine API interactions (`/api/appointments`, `/api/attendances`, `/api/payments`, `/api/reminders`, `/api/dashboard`, `/api/financial`).
2. `/agenda/page.tsx`:
   - Interactive calendar in Brazilian Portuguese (Day, Week, Month, or Agenda list).
   - Create appointment modal: client select, planned procedures (distinct from actual per D3), date/time, estimated duration/value.
   - Status actions: Confirmar (`/api/appointments/[id]/confirm`), Cancelar (`/api/appointments/[id]/cancel`), Não Compareceu (`/api/appointments/[id]/no-show`), Reagendar (`/api/appointments/[id]/reschedule` - creates new appointment and pending attendance per D1).
   - Direct button/link to open `/atendimentos/[id]`.
3. `/atendimentos/page.tsx`:
   - Attendance clinical execution list with status filters (Pendente, Realizado, Cancelado per D1).
   - Direct link to open clinical workspace `/atendimentos/[id]`.
4. `/atendimentos/[id]/page.tsx`:
   - Next.js 15 App Router dynamic route handler (`const { id } = await params;`).
   - Complete clinical execution workspace:
     - Header: Client info, appointment link, status badge (Pendente, Realizado, Cancelado).
     - Procedures section: pre-fill planned procedures (`/api/attendances/[id]/prefill`), add procedure with practiced value, explicit discount (`/api/attendances/[id]/discount`).
     - Product usage & traceability: record unit usage (`/api/attendances/[id]/usages`), barcode/unit selector, reusable same-client allowance, cross-client prevention with Portuguese error.
     - Prontuário section: 1:1 clinical record notes (`/api/attendances/[id]/record`) with anamnese, evolução clínica, orientações pós-procedimento, intercorrências.
     - Attachments section: upload before/after photos and documents (`/api/attachments`).
     - Financial breakdown (D2): standard total, practiced total, explicit discount, net total, paid total, outstanding balance.
     - Payment registration modal: Cash, Debit, Credit Card with installments, PIX schedule with installments (`/api/attendances/[id]/payments/pix-schedule`).
     - Finalize / Complete Attendance: marks Realizado via `/api/attendances/[id]/complete`.
5. `/financeiro/page.tsx`:
   - Accounts receivable summary, cash flow breakdown by payment method, transaction ledger with date/method filters.
6. `/lembretes/page.tsx`:
   - Reminder management feed with status filters (Pendente, Concluído, Dispensado) and priority filters.
   - Status toggles: Concluir or Dispensar (`/api/reminders/[id]/status`), strictly preserving payment truth (V23 / AC 68).
7. `/page.tsx` (Dashboard):
   - Real metrics cards from `/api/dashboard/summary`: faturamento do mês, ticket médio, atendimentos realizados, agendamentos hoje.
   - Low stock alert list, PIX installment reminder feed (overdue and upcoming), birthdays of the month.
8. Verify:
   - Check that ZERO `@/data/mock` imports remain in your owned files.
   - Run `npm run lint`.
   - Run `npm run build`.
   - Run `npx vitest run` to ensure tests continue passing.
9. Write `handoff.md` in your working directory with detailed observations, files modified, and command outputs verbatim.
10. Send completion message to parent (8d6c0e93-207a-4af1-807a-6b80b2ba7746).
