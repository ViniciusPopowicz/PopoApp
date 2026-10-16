# Dispatch Task: Explorer 3 for Milestone 4 (Dashboard Metrics, Financial Aggregation & Test Architecture)

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_3
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_explorer
- Identity: explorer_m4_3

## Task
Conduct technical exploration and architecture design for the Dashboard Metrics Service, Financial Aggregations, and Master Milestone 4 Test Suite Architecture (Phases 12, 13, 14).

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully — note D2, D5, AC 58, AC 65, AC 68)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md` (§25, §26, §31, §32)
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Phases 12, 13, 14)
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `vitest.config.ts` (review pool configuration and reviewer_m3_2's concurrency recommendation)

## Scope to Investigate & Specify
1. **Dashboard Metrics & Aggregation Service (`DashboardService`)**:
   - Daily, weekly, monthly gross and net revenue metrics.
   - Cash flow breakdown across payment methods (Dinheiro, PIX, Cartão Débito, Cartão Crédito).
   - Accounts receivable / outstanding balances summary across all active attendances.
   - Appointment & attendance volume: today's schedule, pending attendances, completed rate.
   - Low stock alert feed: products with $\le 5$ available physical units.
   - In-app reminders widget feed: upcoming and overdue PIX installments for quick action.
2. **API Routes**:
   - `/api/dashboard/summary` or `/api/dashboard/metrics` providing aggregated payload for frontend.
   - Ensure clean Next.js 15 App Router dynamic route design.
3. **Vitest Configuration Optimization**:
   - Address the test concurrency finding noted by `reviewer_m3_2`: updating `vitest.config.ts` to include `pool: 'forks'` so that `npm test` runs deterministically with single worker across the 32+ test files.
4. **Master Milestone 4 Test Architecture**:
   - Map all test files to be implemented in Milestone 4:
     - Tier 1: `tests/tier1_features/f09_payment_service.spec.ts`, `tests/tier1_features/f10_reminder_service.spec.ts`, `tests/tier1_features/f27_dashboard_service.spec.ts`.
     - Tier 2 Boundaries: `tests/tier2_boundaries/v20_attendance_multiple_payments.spec.ts`, `tests/tier2_boundaries/v21_card_installment_no_reminders.spec.ts`, `tests/tier2_boundaries/v22_pix_installment_reminders.spec.ts`, `tests/tier2_boundaries/v23_reminder_state_payment_truth.spec.ts`.
     - Tier 3 Combinations: `tests/tier3_combinations/m4_financial_reminders_e2e.spec.ts`.
     - Tier 4: Review `tests/tier4_workflows/scenarios_a_through_e.spec.ts` for updating from mock/raw calls to real domain services once Milestone 4 services exist.

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion (Turnkey specification and implementation plan for worker)
5. Verification Method

Send completion message back to orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`).


## 2026-10-16T03:10:09Z
You are explorer_m4_3. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_3. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_3\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Perform technical exploration and architecture design for DashboardService, financial aggregations, vitest.config.ts pool fix, and master Milestone 4 test architecture. Write handoff.md and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c.
