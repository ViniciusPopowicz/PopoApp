# Dispatch Task: Explorer 1 for Milestone 4 (Payment Service & Installments Engine)

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_1
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_explorer
- Identity: explorer_m4_1

## Task
Conduct technical exploration and architecture design for the Payment Service & Installments Engine of Milestone 4 (Phase 12).

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully — note D2, D5, AC 58, AC 65, AC 68)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md` (§20, §21, §22, §23, §25, §31, §32)
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Phase 12)
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `prisma/schema.prisma` (inspect `Payment`, `PaymentInstallment`, `Attendance`, and related models)
7. `src/services/attendance.service.ts` (inspect current `computeFinancials` and payment interactions)

## Scope to Investigate & Specify
1. **Prisma Models**: Inspect `Payment` and `PaymentInstallment` in `schema.prisma`. Verify all fields, enums, relations, and nullabilities.
2. **Payment Methods**: Dinheiro, PIX, Cartão Débito, Cartão Crédito (and Outro).
3. **Credit Card vs PIX Installments**:
   - Credit Card: total amount, payment method = Cartão Crédito, number of installments stored as an integer count (`numeroParcelas`). Does NOT create installment records with individual due dates, and does NOT generate reminders (D5, §22, V21).
   - PIX: agreed installment schedule with individual installment records (`PaymentInstallment`), each with `numeroParcela`, `valor`, `dataVencimento`, and `status`. Used by ReminderService to generate in-app reminders (D5, §23, V22).
4. **Attendance Financial Coordination (D2, V20)**:
   - Multiple payments per Attendance supported (e.g. advance signal payment + partial card + partial PIX).
   - Dynamic synchronization with `AttendanceService.computeFinancials` (total = sum(practicedValue) - discount; outstanding = total - sum(paid)).
   - Verification that payments cannot exceed outstanding balance unless explicitly permitted, or how overpayment is handled.
5. **Types and Zod Schemas**: Specify `src/types/payment.ts` and `src/schemas/payment.ts`.
6. **API Routes**: Plan App Router routes (`/api/attendances/[id]/payments`, `/api/payments/[id]`, etc.) ensuring Next.js 15 `await params` compliance.
7. **Test Requirements**: Define tests needed for F09, F23, F24, F25, V20, V21, V22.

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion (Turnkey specification and implementation plan for worker)
5. Verification Method

Send completion message back to orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`).


## 2026-10-16T03:10:08Z
[Message] timestamp=2026-10-16T03:10:08Z sender=c5b5356d-f3b6-47c7-8717-5f065dc9873c priority=MESSAGE_PRIORITY_HIGH content=You are explorer_m4_1. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_1. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_1\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Perform technical exploration and architecture design for PaymentService, Credit Card count vs PIX installments, schemas, APIs, and tests. Write handoff.md and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c.
