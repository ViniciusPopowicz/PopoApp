# Original User Request

## Initial Request — 2026-10-06T02:20:56Z

Implement PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice, turning the existing Next.js skeleton into a working, tested product that matches the two specification files in the repository. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

Current state (found during inspection): Next.js 15 + React 19 + TypeScript + Tailwind/Radix UI, Prisma 6 on SQL Server LocalDB, iron-session login with bcrypt. The Prisma schema has only `User`. Every domain page (agenda, clientes, atendimentos, procedimentos, produtos, financeiro, lembretes, dashboard) renders mock data from `src/data/mock`. No tests exist. Mock appointment statuses lack `Reagendado`. Keep this stack unless there is a strong, documented reason not to.

## Business decisions already made by the user (binding)

- **D1. Attendance lifecycle:** Attendance has its own status: Pendente / Realizado / Cancelado. It is created as Pendente automatically when its Appointment is created. The user marks it Realizado manually when the service actually happens. When the Appointment becomes Cancelado, Não compareceu or Reagendado, its pending Attendance is set to Cancelado automatically. A rescheduled Appointment's new Appointment gets its own new Pendente Attendance.
- **D2. Attendance total:** total = sum of the practiced values of its procedures − the explicit Attendance discount. Outstanding = total − sum of payments with paid status. Both are computed, not stored.
- **D3. Planned procedures:** an Appointment may carry planned procedures, used for estimated value/duration and to pre-fill its Attendance. These stay distinct from the procedures actually recorded on the Attendance. There are no planned products on Appointments.
- **D4. Client fields:** nome, telefone, email, data de nascimento, endereço, observações and active/inactive status, plus **CPF, which is required and unique** (validated as a well-formed CPF, stored normalized). This is in addition to the emergency contacts, profile photo and attachments the spec requires.
- **D5. Reminders:** in-app only. A Lembretes page plus a dashboard list of upcoming and overdue PIX installments. Reminders can be marked done or dismissed. No email, WhatsApp or other external delivery.
- **D6. File storage:** uploaded files live on local disk outside the public folder and are served only through authenticated routes, never via predictable public URLs.
- **D7. Environment:** work in place in the existing git repository and commit as you go. SQL Server LocalDB is available. Migrations and integration tests may run against it, and tests must use a separate test database, never the development one.

## Open decisions

- None outstanding at launch. If any implementation decision could materially change specified behavior, do NOT invent it. Mark it `[?]` in the checklist, document it under Blockers / Decisions and report it back. Purely technical choices (e.g. test tooling) may be decided by the team when they satisfy the spec; record them in Decisions and Notes.

## Requirements

### R1. Persistent implementation checklist
Before any implementation, map the existing project against both specs. Then create `IMPLEMENTATION_CHECKLIST.md` in the working directory, with every section, phase, status marker, high-complexity marking, dependency, blocker and testing entry that the checklist spec requires. Keep it accurate throughout the work so another agent can resume from it alone. Record D1–D7 under Decisions and Notes.

### R2. Domain model and database
Replace the mock-only state with a real relational model covering every entity and relationship in the development spec (§31). Enforce critical rules server-side and, where practical, in the database (foreign keys, uniqueness, enums, transactions, snapshots). Use migrations, and provide seed data per §50.

### R3. Business logic and security
Implement the business rules in a domain/service layer, not only in the UI. This must include all 24 critical validations in §32 plus D1–D6. Authentication must protect all client and clinical data. Attachments and medical records must not be reachable through unauthenticated or predictable public URLs, and uploads must be validated.

### R4. User-facing application
Replace every mock-data screen with real, persisted workflows for each area in spec §§33–46: Clients (with detail page and derived history), Appointments/calendar, Attendances, Procedures, Products/stock, Payments/installments and Reminders. All user-facing text must be in Brazilian Portuguese, with responsive layouts, validation messages and empty, loading and error states.

### R5. Automated tests
Add an automated test suite covering the testing requirements in development spec §49, including every critical validation in §32 and D1–D6. Each test must exercise the real service/database layer, not mocks of the rules under test.

## Acceptance Criteria

### Build and run
- [ ] `npm install`, `npx prisma migrate deploy` (or `migrate dev`) against a fresh database, `npm run db:seed`, `npm run build` and `npm run lint` all succeed with zero errors.
- [ ] A single documented command (e.g. `npm test`) runs the full automated suite, and it passes with 0 failures.
- [ ] No page under the authenticated area imports from `src/data/mock`. The mock data is either removed or unused.

### Critical business rules (each backed by at least one named automated test that fails if the rule is removed)
- [ ] All 24 validations in development spec §32 each map to one or more tests. The checklist's Testing Status lists the test name(s) for each.
- [ ] Spec §47 examples A–E are each reproduced as a test with the exact values given (e.g. standard R$500, practiced R$400, discount R$0, with no automatic discount).
- [ ] D1: cancel, no-show and reschedule each move the pending Attendance to Cancelado. Reschedule leaves the old Appointment `Reagendado` and creates a new Appointment with a new Pendente Attendance. Creating an Appointment never produces a Realizado Attendance.
- [ ] D2: a test with several procedures, a discount and partial payments across two methods asserts the exact total and outstanding values.
- [ ] Cross-client reuse of a physical unit and a second use of a single-use unit are both rejected by the server/database layer, even when the UI is bypassed (direct service/API call).
- [ ] Unauthenticated requests to protected pages, APIs and attachment download routes are rejected (tested).
- [ ] The database rejects an attachment row owning both a Client and an Attendance (or neither). This is verified by a test that bypasses the service layer.
- [ ] D4: creating a Client without a CPF, with an invalid CPF, or with a CPF already used by another Client is rejected server-side, and the duplicate is also rejected by a database unique constraint (tested).

### End-to-end workflow (verified by an independent reviewer agent driving the running app in a browser)
- [ ] Log in → create a Client with CPF, 2 emergency contacts and a profile photo → create an Appointment with planned procedures → confirm it → open its Attendance → add 2 procedures with practiced values different from the standard → apply a discount → record product usage of a reusable unit → fill the Prontuário → upload an Attendance attachment → record a PIX installment payment plan and a partial credit-card payment → mark the Attendance Realizado. Every step persists after a page reload. The financial summary shows standard values, practiced values, discount, total, paid and outstanding as separate labeled figures.
- [ ] Attempting to use the same physical unit for a different Client shows a clear Portuguese error and is not saved.
- [ ] The Client detail page shows that Client's appointments, attendances, procedures, product usage, medical records, payments and attachments, organized (e.g. tabs or sections) and derived from real records.
- [ ] PIX installment reminders appear in the Lembretes area and on the dashboard (upcoming/overdue). Credit-card installments generate none. Marking a reminder done does not change any payment status.

### Checklist integrity (verified by an independent reviewer)
- [ ] `IMPLEMENTATION_CHECKLIST.md` exists with all 11 sections from checklist spec §4, phases 1–18, 🔴 high-complexity markings for the six areas in checklist spec §7, and only the five allowed status markers.
- [ ] Every `[x]` item is backed by code and, where testable, a passing test. Spot-checking 10 random `[x]` items finds no false completion.
- [ ] Any ambiguity discovered during the work appears as `[?]` with what is needed. The Final Completion Audit (checklist spec §§19–20) is filled in honestly.
- [ ] A final summary per development spec §53 is reported back: what was implemented, what was tested, what remains, known limitations and unresolved decisions.


## Follow-up — 2026-10-07T01:19:34Z

Resume implementing PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice. A previous run partially turned the existing Next.js skeleton into a working, tested product that matches the two specification files in the repository. Continue that work to completion. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

## Resume context (state left by the previous run)

- `IMPLEMENTATION_CHECKLIST.md`, `PROJECT.md` and `TEST_INFRA.md` exist in the working directory and record the progress so far. Read them first. The `.agents/` folder may contain more state from the previous run.
- The checklist reports: Phase 1 done. Phase 2 (schema, 18 models, migration SQL with `CK_Attachment_Ownership`) in progress, with **the migration not yet applied and the Prisma client not regenerated**, and the seed not written. Phase 3 partly done. Phases 4, 5, 8 and 11 are marked done at the service/API level, but their UI items are open. Phases 6, 7, 9, 10 and 12–18 have not started. Vitest and `.env.test` (PopoAppTest) are configured, and test files exist under `tests/`.
- **None of this work has been committed.** It sits as uncommitted changes and untracked files on top of commit `6385f5e`.
- **Do not trust the existing `[x]` marks.** The migration was never applied, so the existing tests probably never ran against a real database. Before building on any earlier work, apply the migration to the dev and test databases, run the existing suite, and re-verify every `[x]` item. Downgrade any item that is not actually backed by working code and passing tests. Then commit a baseline and continue committing as you go (D7).

Original stack (keep unless there is a strong, documented reason not to): Next.js 15 + React 19 + TypeScript + Tailwind/Radix UI, Prisma 6 on SQL Server LocalDB, iron-session login with bcrypt. The authenticated pages still render mock data from `src/data/mock`.

## Business decisions already made by the user (binding)

- **D1. Attendance lifecycle:** Attendance has its own status: Pendente / Realizado / Cancelado. It is created as Pendente automatically when its Appointment is created. The user marks it Realizado manually when the service actually happens. When the Appointment becomes Cancelado, Não compareceu or Reagendado, its pending Attendance is set to Cancelado automatically. A rescheduled Appointment's new Appointment gets its own new Pendente Attendance.
- **D2. Attendance total:** total = sum of the practiced values of its procedures − the explicit Attendance discount. Outstanding = total − sum of payments with paid status. Both are computed, not stored.
- **D3. Planned procedures:** an Appointment may carry planned procedures, used for estimated value/duration and to pre-fill its Attendance. These stay distinct from the procedures actually recorded on the Attendance. There are no planned products on Appointments.
- **D4. Client fields:** nome, telefone, email, data de nascimento, endereço, observações and active/inactive status, plus **CPF, which is required and unique** (validated as a well-formed CPF, stored normalized). This is in addition to the emergency contacts, profile photo and attachments the spec requires.
- **D5. Reminders:** in-app only. A Lembretes page plus a dashboard list of upcoming and overdue PIX installments. Reminders can be marked done or dismissed. No email, WhatsApp or other external delivery.
- **D6. File storage:** uploaded files live on local disk outside the public folder and are served only through authenticated routes, never via predictable public URLs.
- **D7. Environment:** work in place in the existing git repository and commit as you go. SQL Server LocalDB is available. Migrations and integration tests may run against it, and tests must use a separate test database, never the development one.

## Open decisions

- None outstanding. If any implementation decision could materially change specified behavior, do NOT invent it. Mark it `[?]` in the checklist, document it under Blockers / Decisions and report it back. Purely technical choices may be decided by the team when they satisfy the spec; record them in Decisions and Notes.

## Requirements

### R1. Persistent implementation checklist
Keep `IMPLEMENTATION_CHECKLIST.md` accurate throughout the work, with every section, phase, status marker, high-complexity marking, dependency, blocker and testing entry that the checklist spec requires, so that another agent can resume from it alone. Correct any earlier inaccuracies.

### R2. Domain model and database
Replace the mock-only state with a real relational model covering every entity and relationship in the development spec (§31). Enforce critical rules server-side and, where practical, in the database (foreign keys, uniqueness, enums, transactions, snapshots). Use migrations, and provide seed data per §50.

### R3. Business logic and security
Implement the business rules in a domain/service layer, not only in the UI. This must include all 24 critical validations in §32 plus D1–D6. Authentication must protect all client and clinical data. Attachments and medical records must not be reachable through unauthenticated or predictable public URLs, and uploads must be validated.

### R4. User-facing application
Replace every mock-data screen with real, persisted workflows for each area in spec §§33–46: Clients (with detail page and derived history), Appointments/calendar, Attendances, Procedures, Products/stock, Payments/installments and Reminders. All user-facing text must be in Brazilian Portuguese, with responsive layouts, validation messages and empty, loading and error states.

### R5. Automated tests
Add an automated test suite covering the testing requirements in development spec §49, including every critical validation in §32 and D1–D6. Each test must exercise the real service/database layer, not mocks of the rules under test.

## Acceptance Criteria

### Build and run
- [ ] `npm install`, `npx prisma migrate deploy` (or `migrate dev`) against a fresh database, `npm run db:seed`, `npm run build` and `npm run lint` all succeed with zero errors.
- [ ] A single documented command (e.g. `npm test`) runs the full automated suite, and it passes with 0 failures.
- [ ] No page under the authenticated area imports from `src/data/mock`. The mock data is either removed or unused.
- [ ] All work is committed to git. `git status` is clean at the end, apart from ignored files.

### Critical business rules (each backed by at least one named automated test that fails if the rule is removed)
- [ ] All 24 validations in development spec §32 each map to one or more tests. The checklist's Testing Status lists the test name(s) for each.
- [ ] Spec §47 examples A–E are each reproduced as a test with the exact values given (e.g. standard R$500, practiced R$400, discount R$0, with no automatic discount).
- [ ] D1: cancel, no-show and reschedule each move the pending Attendance to Cancelado. Reschedule leaves the old Appointment `Reagendado` and creates a new Appointment with a new Pendente Attendance. Creating an Appointment never produces a Realizado Attendance.
- [ ] D2: a test with several procedures, a discount and partial payments across two methods asserts the exact total and outstanding values.
- [ ] Cross-client reuse of a physical unit and a second use of a single-use unit are both rejected by the server/database layer, even when the UI is bypassed (direct service/API call).
- [ ] Unauthenticated requests to protected pages, APIs and attachment download routes are rejected (tested).
- [ ] The database rejects an attachment row owning both a Client and an Attendance (or neither). This is verified by a test that bypasses the service layer.
- [ ] D4: creating a Client without a CPF, with an invalid CPF, or with a CPF already used by another Client is rejected server-side, and the duplicate is also rejected by a database unique constraint (tested).

### End-to-end workflow (verified by an independent reviewer agent driving the running app in a browser)
- [ ] Log in → create a Client with CPF, 2 emergency contacts and a profile photo → create an Appointment with planned procedures → confirm it → open its Attendance → add 2 procedures with practiced values different from the standard → apply a discount → record product usage of a reusable unit → fill the Prontuário → upload an Attendance attachment → record a PIX installment payment plan and a partial credit-card payment → mark the Attendance Realizado. Every step persists after a page reload. The financial summary shows standard values, practiced values, discount, total, paid and outstanding as separate labeled figures.
- [ ] Attempting to use the same physical unit for a different Client shows a clear Portuguese error and is not saved.
- [ ] The Client detail page shows that Client's appointments, attendances, procedures, product usage, medical records, payments and attachments, organized (e.g. tabs or sections) and derived from real records.
- [ ] PIX installment reminders appear in the Lembretes area and on the dashboard (upcoming/overdue). Credit-card installments generate none. Marking a reminder done does not change any payment status.

### Checklist integrity (verified by an independent reviewer)
- [ ] `IMPLEMENTATION_CHECKLIST.md` exists with all 11 sections from checklist spec §4, phases 1–18, 🔴 high-complexity markings for the six areas in checklist spec §7, and only the five allowed status markers.
- [ ] Every `[x]` item is backed by code and, where testable, a passing test. Spot-checking 10 random `[x]` items finds no false completion.
- [ ] Any ambiguity discovered during the work appears as `[?]` with what is needed. The Final Completion Audit (checklist spec §§19–20) is filled in honestly.
- [ ] A final summary per development spec §53 is reported back: what was implemented, what was tested, what remains, known limitations and unresolved decisions.


## Reminder — 2026-10-07T01:48:56Z

Reminder for the orchestrator: fixture fixes in scenarios_a_through_e.spec.ts may only make the setup data valid for the schema (required fields, FKs). The scenario inputs and expected values must remain exactly as in dev spec §47, and assertions must not be loosened or removed. If a test fails because a rule is missing or wrong, fix the code, not the test. Please also note in the checklist whether localdb-proxy.js is dev/test-only or something the app needs at runtime.
