# Dispatch Task: Explorer 2 for Milestone 4 (In-App Reminder Service)

- Working Directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_2
- Workspace Root: c:\Users\Vinicius\PopoApp\PopoApp
- Role: teamwork_preview_explorer
- Identity: explorer_m4_2

## Task
Conduct technical exploration and architecture design for the In-App Reminder Service of Milestone 4 (Phase 13).

## Mandatory Reading Before Starting Work
1. `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md` (read fully — note D5, AC 68)
2. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md` (§23, §24, §25, §31, §32)
3. `c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` (Phase 13)
4. `c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md`
5. `c:\Users\Vinicius\PopoApp\PopoApp\TEST_INFRA.md`
6. `prisma/schema.prisma` (inspect `Reminder`, `PaymentInstallment`, `Payment`, and relations)

## Scope to Investigate & Specify
1. **Prisma Models**: Inspect `Reminder` in `schema.prisma`. Verify all fields, relations, foreign keys, and indexes.
2. **In-App Scope (D5)**:
   - Reminders are strictly in-app (NO WhatsApp, NO email, NO external notifications).
   - Serves the `/lembretes` page and dashboard alert feed.
3. **Generation & Derivation from PIX Installments (V22, V21)**:
   - Derivation of reminders from PIX installments (`PaymentInstallment` where status is `Pendente` and payment method is `PIX`).
   - Credit card installments do NOT generate collection reminders (D5, §22, V21).
   - How reminders are synchronized or created: automatic generation on PIX installment creation vs dynamic derivation query vs hybrid sync.
4. **Resolution & State Invariant (V23)**:
   - Reminder resolution toggle: marking a reminder as `Resolvido` or dismissed (`Descartado`).
   - V23: Reminder state must NOT replace payment truth! Marking a reminder done/resolved does NOT alter the payment or installment status. Payment status remains the sole financial source of truth (D5, V23, AC 68).
5. **Types and Zod Schemas**: Specify `src/types/reminder.ts` and `src/schemas/reminder.ts`.
6. **API Routes**: Plan App Router routes (`/api/reminders`, `/api/reminders/[id]`, `/api/reminders/[id]/resolve`, `/api/reminders/[id]/dismiss`, etc.) with Next.js 15 `await params` compliance.
7. **Test Requirements**: Define tests needed for F10, F26, V21, V22, V23, D5.

## Deliverable
Write `handoff.md` in your working directory with sections:
1. Observation
2. Logic Chain
3. Caveats
4. Conclusion (Turnkey specification and implementation plan for worker)
5. Verification Method

Send completion message back to orchestrator (`c5b5356d-f3b6-47c7-8717-5f065dc9873c`).


## 2026-10-16T03:10:08Z
[Message] timestamp=2026-10-16T03:10:08Z sender=c5b5356d-f3b6-47c7-8717-5f065dc9873c priority=MESSAGE_PRIORITY_HIGH content=You are explorer_m4_2. Your working directory is c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_2. Read c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m4_2\DISPATCH.md and c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md first. Perform technical exploration and architecture design for ReminderService (in-app per D5, derived from PIX installments, V22/V23, schemas, APIs, tests). Write handoff.md and send message back to orchestrator c5b5356d-f3b6-47c7-8717-5f065dc9873c.
