# Dispatch Task: Challenger 2 for Milestone 3 Gate

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m3_2
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_challenger
- Identity: challenger_m3_2

## Task
Empirically challenge and adversarially verify the correctness of Milestone 3 implementations (Clinical Workflows, Products & Inventory — Phases 6, 7, 9, 10).

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md`
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\worker_m3_1\handoff.md`

## Invariants to Stress-Test / Verify
- D1: Reschedule cascades (old appointment marked Reagendado, old attendance marked Cancelado, new appointment and new attendance created). Cancel and no-show cascade to pending attendance.
- V03: Rejection of `Em atendimento`.
- V08: Cannot complete appointment if attendance is not Realizado.
- V09: Snapshot immutability: procedure standard price update does not change attendance standard value snapshot.
- V15: Expiration date blocking for product lot.
- V16 vs V17 / AC 59 / AC 66: Same-client reuse allowed; cross-client reuse strictly rejected with exact message `"Esta unidade de estoque já está vinculada a outro cliente."`.
- V18: Second use of single-use unit rejected.
- V19: Medical record 1:1 uniqueness per attendance.
- D2: Attendance total dynamic computation (standardTotal, practicedTotal, explicitDiscount, netTotal, outstandingBalance).

## Verification Required
- Ensure proxy is active (`npm run db:proxy` if port 1433 not open; LocalDB running).
- Run `npm test` against `PopoAppTest`. Verify all 30 test files / 185 tests pass.
- Execute adversarial checks or inspect tests covering all these edge conditions.

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion (Must state clear verdict: **APPROVE** or **REJECT**)
5. Verification Method

Send completion message back to orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`).


## 2026-10-16T02:37:47Z
You are challenger_m3_2. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m3_2. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\challenger_m3_2\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Empirically verify and stress-test Milestone 3 invariants against LocalDB PopoAppTest, run tests, write handoff.md with verdict APPROVE or REJECT, and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c.
