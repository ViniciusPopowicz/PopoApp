# Dispatch Task: Worker 1 for Milestone 4 (Financial Engine, Payments, Reminders & Dashboard)

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m4_1
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_worker
- Identity: worker_m4_1

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully — D2, D5, AC 58, AC 65, AC 68)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md` (§20, §21, §22, §23, §24, §25, §26, §31, §32)
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Phases 12, 13, 14)
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_1\handoff.md` (PaymentService architecture)
7. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_2\handoff.md` (ReminderService architecture)
8. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_3\handoff.md` (DashboardService & Test Plan)

## Scope of Implementation

### 1. Test Harness Optimization
- Update `vitest.config.ts`: add `pool: 'forks'` inside the test configuration object so that `poolOptions.forks.singleFork: true` executes sequentially and deterministically without multi-threaded worker collisions against LocalDB.

### 2. Types & Zod Validation Schemas
- Create `src/types/payment.ts` & `src/schemas/payment.ts`:
  - Methods: `CartaoCredito`, `Pix`, `Dinheiro`, `CartaoDebito`, `Boleto`, `Transferencia`
  - Credit Card input: total amount, payment method = `CartaoCredito`, `numeroParcelas` (1..12).
  - PIX input: total amount, installments schedule with due dates (`PixInstallment`).
  - Signal / partial payment schemas.
- Create `src/types/reminder.ts` & `src/schemas/reminder.ts`:
  - In-app reminder types: `pendente`, `concluido`, `dispensado`.
  - Priorities: `baixa`, `media`, `alta`.
  - Types: `parcela_pix`, `retorno`, `geral`.
- Create `src/types/dashboard.ts` & `src/schemas/dashboard.ts`:
  - Metric aggregates, cash flow by method, low stock alerts, reminders feed.

### 3. Domain Services (`src/services/`)
- `src/services/payment.service.ts`:
  - `createPayment`: handles full, partial, advance/signal payments.
  - Credit Card payments: store `numeroParcelas` count ($1..12$); strictly ZERO `PixInstallment` records and strictly ZERO reminders (D5, §22, V21).
  - PIX installment payments: creates `Payment` and linked `PixInstallment` records for each installment with `numeroParcela`, `totalParcelas`, `valor`, `dataVencimento`. Automatically generates corresponding in-app `Reminder` records with matching due dates (D5, §23, V22).
  - `payPixInstallment`: marks an individual PIX installment as paid (`status: 'Pago'`, `dataPagamento: now()`).
  - Attendance financials coordination: coordinates with `AttendanceService.computeFinancials` (D2 dynamic calculation: Total = sum(practicedValue) - discount; Outstanding = Total - paid).
  - Overpayment validation: rejects payment exceeding outstanding balance.
  - Multiple payments per Attendance (V20).
- `src/services/reminder.service.ts`:
  - Strictly in-app (D5: no WhatsApp, no email).
  - `listReminders`: filter by status (`pendente`, `concluido`, `dispensado`, `todos`), overdue, client.
  - `updateReminderStatus`: mark reminder `concluido` or `dispensado`.
  - **Decoupling Invariant (V23 & AC 68)**: marking a reminder done or dismissed mutates ONLY `Reminder` (`status` and `completedAt`), strictly NEVER altering `PixInstallment.status`, `Payment.status`, or attendance financial totals!
- `src/services/dashboard.service.ts`:
  - `getDashboardMetrics`: gross revenue, net revenue, received revenue, outstanding receivables.
  - Cash flow breakdown across payment methods.
  - Low stock alerts: products with $\le 5$ available units (`StockUnit.status === 'Disponivel'`).
  - Reminders widget feed: upcoming and overdue PIX installments.
  - Upcoming appointments and pending attendances.

### 4. Next.js 15 App Router API Routes (`src/app/api/`)
- `/api/attendances/[id]/payments/route.ts` (GET list payments for attendance, POST create payment)
- `/api/payments/[id]/route.ts` (GET detail, DELETE payment)
- `/api/payments/installments/[id]/pay/route.ts` (POST mark PIX installment as paid)
- `/api/reminders/route.ts` (GET list with status filter, POST create general reminder)
- `/api/reminders/[id]/route.ts` (GET, DELETE)
- `/api/reminders/[id]/status/route.ts` (PATCH update status to `concluido` or `dispensado`)
- `/api/reminders/dashboard/route.ts` (GET upcoming & overdue reminders feed)
- `/api/dashboard/summary/route.ts` (GET metrics payload)
- `/api/financial/summary/route.ts` (GET cash flow & accounts receivable)
- Ensure all dynamic routes declare `{ params }: { params: Promise<{ id: string }> }` and `await params`.

### 5. Automated Tests Against SQL Server LocalDB (`PopoAppTest`)
- Implement:
  - `tests/tier1_features/f09_payment_service.spec.ts` (>=5 tests: payment creation, credit card count, PIX schedule, partial payments, list payments)
  - `tests/tier1_features/f10_reminder_service.spec.ts` (>=5 tests: reminder generation from PIX, list reminders, filter pending/overdue, resolve/dismiss)
  - `tests/tier1_features/f27_dashboard_service.spec.ts` (>=5 tests: revenue aggregates, cash flow by method, low stock alert <=5, reminders feed)
  - `tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts` (>=3 tests: multiple payment methods on single attendance, partial payment, signal payment)
  - `tests/tier2_boundaries/v21_card_installment_no_reminders.spec.ts` (>=3 tests: credit card installments store count 1..12 and generate ZERO reminders)
  - `tests/tier2_boundaries/v22_pix_installment_reminders.spec.ts` (>=3 tests: PIX installments generate in-app reminders matching due dates)
  - `tests/tier2_boundaries/v23_reminder_state_payment_truth.spec.ts` (>=3 tests: resolving/dismissing reminder does not change payment status or attendance balance)
  - `tests/tier3_combinations/m4_financial_reminders_e2e.spec.ts` (>=1 test: full clinical attendance to payment to PIX installment to reminder resolution)
- Refactor `tests/tier4_workflows/scenarios_a_through_e.spec.ts`:
  - Rewrite Scenarios A through E to exercise real domain services (`ClientService`, `AppointmentService`, `AttendanceService`, `PaymentService`, `ReminderService`) with exact §47 values.

### 6. Checklist & Documentation Updates
- Update `PROJECT.md` (mark M3 DONE, M4 IN_PROGRESS).
- Update `IMPLEMENTATION_CHECKLIST.md` (mark Phases 12, 13, 14 as `[~]`, update test mapping).

## Verification Requirements
- Run `npm test` against `PopoAppTest` (all tests passing, 0 failures).
- Run `npm run lint` (0 errors, 0 warnings).
- Run `npm run build` (clean Next.js 15 production build).

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion
5. Verification Method

Send completion message back to orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`).


## 2026-10-16T03:22:08Z
[Message] timestamp=2026-10-16T03:22:08Z sender=c5b5356d-f3b6-47c7-8717-5f065dc9873c priority=MESSAGE_PRIORITY_HIGH content=You are worker_m4_1. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m4_1. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m4_1\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Implement Milestone 4 (PaymentService, ReminderService, DashboardService, Next.js 15 route handlers, vitest.config.ts pool fix, automated test suites, and refactored scenarios_a_through_e.spec.ts). Run tests against LocalDB PopoAppTest, verify lint and build, write handoff.md, and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c. DO NOT CHEAT. All implementations must be genuine.
