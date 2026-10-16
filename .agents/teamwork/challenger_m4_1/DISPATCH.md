# Dispatch Task: Challenger 1 for Milestone 4 Gate

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m4_1
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_challenger
- Identity: challenger_m4_1

## Task
Empirically verify and stress-test the correctness and business invariants of Milestone 4 (Financial Engine, Payments, Reminders & Dashboard — Phases 12, 13, 14).

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully — note D2, D5, AC 58, AC 65, AC 68)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md` (§20–§26, §31, §32)
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Phases 12, 13, 14)
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m4_1\handoff.md`

## Invariants to Empirically Challenge / Stress-Test
- D2: Attendance dynamic financials: total = sum(practicedValue) - explicitDiscount, outstanding = total - sum(paid). Outstanding and totals are never persisted.
- V20: Attendance with multiple payment methods (e.g. advance signal in cash + credit card + PIX installments).
- V21: Credit card payment records installment count (1..12) and generates STRICTLY 0 PixInstallments and STRICTLY 0 Reminders.
- V22: PIX installment plan creates correct rounded installments (handling fractional cents remainder) and spawns matching in-app Reminders with identical due dates.
- V23 & AC 68: Resolving or dismissing a reminder strictly mutates only `Reminder.status`/`completedAt`, strictly NEVER altering `PixInstallment.status`, `Payment.status`, or attendance financial totals!
- Scenario E from §47: verify full scenario end-to-end through domain services with exact numbers and assert financial figures.

## Verification Required
- Ensure LocalDB and proxy are running.
- Run `npm test` against `PopoAppTest`. Verify all 40 test files / 257 tests pass.
- Write/run targeted empirical checks or challenge tests if needed.

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion (Must state clear verdict: **APPROVE** or **REJECT**)
5. Verification Method



## 2026-10-16T03:59:23Z
[Message] sender=c5b5356d-f3b6-47c7-8717-5f065dc9873c
You are challenger_m4_1. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m4_1. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m4_1\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Empirically verify and stress-test Milestone 4 invariants against LocalDB PopoAppTest, run tests, write handoff.md with verdict APPROVE or REJECT, and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c.
