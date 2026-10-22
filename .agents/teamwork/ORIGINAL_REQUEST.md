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


## Resume Request — 2026-10-16T00:17:33Z

Resume implementing PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice. A previous run partially turned the existing Next.js skeleton into a working, tested product that matches the two specification files in the repository. Continue that work to completion. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

## Resume context (state left by the previous runs — updated 2026-10-15)

- Read `RESUME_GUIDE.md`, `IMPLEMENTATION_CHECKLIST.md` (§2 Current Work), `PROJECT.md` and `TEST_INFRA.md` first. Earlier team state is in `.agents/teamwork/` (notably `orchestrator_2/GATE_STATUS.md` and the `reviewer_m2_*`, `challenger_m2_*`, `auditor_m2_1` and `explorer_m2_it2_*` handoffs).
- Git: working tree clean. Latest commits are `dc33eb9` (baseline: migration applied to `PopoApp` and `PopoAppTest`, 15 test files / 89 tests passing, lint and build clean, premature `[x]` marks for Phases 5, 8 and 11 downgraded to `[~]`) and `5a17482` (Milestone 2 gate iteration-2 fixes: test DB isolation, DB cleaner self-referencing FKs, middleware session unsealing, MIME-to-extension mapping).
- **The Milestone 2 gate was stopped mid-iteration.** The auditor gave a CLEAN verdict and one challenger approved, but the iteration-2 fixes in `5a17482` have **not been re-reviewed**. Re-run the full test suite and the Milestone 2 gate before you start Milestone 3.
- Backend done so far: auth, clients (CPF), procedure catalog, attachments. The only services in `src/services/` are `auth`, `client`, `procedure` and `attachment`. No appointment, attendance, inventory, medical record, payment or reminder service exists yet. All UI screens still use mock data.
- **Known test weakness:** `tests/tier4_workflows/scenarios_a_through_e.spec.ts` builds and reads records directly through Prisma and computes totals inline in the test. It does not exercise any service, so its passing does NOT prove the §47 rules. Once the relevant services exist, rewrite these scenarios to go through the real service layer (exact §47 values unchanged) and do not count the current version toward any acceptance criterion.
- `localdb-proxy.js` is documented as a dev/test-only helper for LocalDB connectivity. Confirm that the app does not depend on it at runtime.
- Keep committing as you go (D7).

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


## Follow-up — 2026-10-16T01:35:44Z

Milestone 2 passed the gate, but nothing has been committed since 5a17482. git status shows 106 changed/untracked files. Per D7 (commit as you go), please have the orchestrator commit the gated Milestone 2 state now, before Milestone 3 changes pile on top of it. After that, commit at least at every milestone gate.


## Pause Request — 2026-10-16T01:39:13Z

The user wants to pause soon. Please relay to the orchestrator:
1. Let the subagents that are already dispatched finish their current tasks. Do NOT dispatch any new work, explorers, workers or gates after that.
2. Commit everything (the gated Milestone 2 state first if it isn't committed yet, then any finished Milestone 3 work as a separate commit). Partial or unverified work may be committed only if it's clearly labelled WIP in the commit message, and the checklist must not mark it [x].
3. Update IMPLEMENTATION_CHECKLIST.md §2 Current Work and RESUME_GUIDE.md with the exact stopping point: what is done and verified, what is partially done (file paths), what was in flight, which gates have and haven't run, and the immediate next action. Another agent must be able to resume from those files alone.
4. Make sure git status is clean, then send me a short final status (latest commit SHA, test count and pass/fail, stopping point) and stop all subagents and crons.


## Resume Request — 2026-10-16T02:33:13Z

Resume implementing PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice. A previous run partially turned the existing Next.js skeleton into a working, tested product that matches the two specification files in the repository. Continue that work to completion. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

## Resume context (state left by the previous runs — updated 2026-10-15)

- Read `RESUME_GUIDE.md`, `IMPLEMENTATION_CHECKLIST.md` (§2 Current Work), `PROJECT.md` and `TEST_INFRA.md` first. Earlier team state is in `.agents/teamwork/` (notably `orchestrator_3/` and `worker_m3_1/`).
- Git: working tree clean. Latest commits are `dc33eb9` (baseline), `5a17482` (Milestone 2 remediation) and `f5d9592` (Milestone 2 gate unanimously approved + Milestone 3 backend, API routes, and 12 new test files implemented). `.next/` and `tsconfig.tsbuildinfo` were untracked from git index so builds do not dirty the working tree.
- **Milestone 2 Gate is PASSED.** Verified by 2 reviewers, 2 challengers and 1 forensic auditor.
- **Milestone 3 Backend is 100% implemented and tested, awaiting Milestone 3 Gate.** Services in `src/services/` now cover `auth`, `client`, `procedure`, `attachment`, `appointment`, `attendance`, `product`, `stock`, and `medical-record`, plus all corresponding App Router API routes (`/api/appointments/*`, `/api/attendances/*`, `/api/products/*`, `/api/lots/*`, `/api/stock/*`, `/api/clients/[id]/history`). 30 test files / 185 tests pass against `PopoAppTest`, with clean lint and build.
- **Immediate next steps on resume:**
  1. Run the **Milestone 3 Gate** (2 Reviewers, 2 Challengers, 1 Forensic Auditor) to audit Phases 6, 7, 9, 10 and record in `GATE_STATUS.md`.
  2. Implement **Milestone 4** (Payments, Credit Card vs PIX Installments, In-App Reminders, Financial Summary & Dashboard — Phases 12, 13, 14).
  3. Implement **Milestone 5** (Complete Brazilian Portuguese UI replacing all `src/data/mock/*` imports across all pages + clinical seed script `prisma/seed.ts` covering §47 Examples A–E — Phases 15, 16).
  4. **Known test weakness to fix once Milestone 4 services exist:** `tests/tier4_workflows/scenarios_a_through_e.spec.ts` builds and reads records directly through Prisma and computes totals inline in the test. Rewrite these scenarios to execute through the real domain services (exact §47 values unchanged).
  5. Complete **Milestones 6 & 7** (E2E browser verification, adversarial hardening, and Final Completion Audit in `IMPLEMENTATION_CHECKLIST.md`).
- `localdb-proxy.js` is documented as a dev/test-only helper for LocalDB connectivity. Confirm that the app does not depend on it at runtime.
- Keep committing as you go (D7), at least at every milestone gate.

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


## Resume Request — 2026-10-20T01:16:52Z

Resume implementing PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice. Previous runs implemented and verified the entire backend domain, database, API routes, and 257 automated tests through Milestone 4. Continue that work to completion. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

## Resume context (state left by the previous runs — updated 2026-10-16)

- Read `RESUME_GUIDE.md`, `IMPLEMENTATION_CHECKLIST.md` (§2 Current Work), `PROJECT.md` and `TEST_INFRA.md` first. Earlier team state is in `.agents/teamwork/` (notably `orchestrator_4/` and `worker_m4_1/handoff.md`).
- Git: working tree clean. Latest commits are `dc33eb9` (baseline), `5a17482` (Milestone 2 remediation), `f5d9592` (Milestone 2 Gate + Milestone 3 backend) and `892d280` (Milestone 3 Gate unanimously approved + Milestone 4 backend, API routes, 8 new test suites, and Scenarios A–E refactored to use real domain services).
- **Milestones 1, 2 & 3 Gates are PASSED.** Each verified by 2 reviewers, 2 challengers and 1 forensic auditor.
- **Milestone 4 Backend is 100% implemented and tested (all backend phases 1–15 complete), awaiting Milestone 4 Gate.** Services in `src/services/` cover `auth`, `client`, `procedure`, `attachment`, `appointment`, `attendance`, `product`, `stock`, `medical-record`, `payment`, `reminder`, and `dashboard`, plus all corresponding App Router API routes. **40 test files / 257 tests pass (0 failures)** against `PopoAppTest`, with clean ESLint and Next.js 15 production build. `tests/tier4_workflows/scenarios_a_through_e.spec.ts` now executes 100% through the real domain services with exact §47 values.
- **Immediate next steps on resume:**
  1. Run the **Milestone 4 Gate** (2 Reviewers, 2 Challengers, 1 Forensic Auditor — interrupted at start by quota limit) to audit Phases 12, 13, 14 and record in `GATE_STATUS.md`.
  2. Implement **Milestone 5** (Complete Brazilian Portuguese UI replacing all `src/data/mock/*` imports across all pages `/`, `/clientes`, `/clientes/[id]`, `/agenda`, `/atendimentos`, `/atendimentos/[id]`, `/procedimentos`, `/produtos`, `/financeiro`, `/lembretes` + clinical seed script `prisma/seed.ts` covering §47 Examples A–E — Phases 15, 16).
  3. Complete **Milestones 6 & 7** (E2E browser verification, adversarial hardening, and Final Completion Audit in `IMPLEMENTATION_CHECKLIST.md`).
- `localdb-proxy.js` is documented as a dev/test-only helper for LocalDB connectivity. Confirm that the app does not depend on it at runtime.
- Keep committing as you go (D7), at least at every milestone gate.

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


## Pause Request — 2026-10-20T02:57:27Z

The user wants to pause after the currently running Milestone 5 Gate workers finish. Please relay to Orchestrator Gen 5:
1. Let the 5 active Milestone 5 Gate subagents (Reviewers 1 & 2, Challengers 1 & 2, Auditor) finish their current evaluations and record the verdict in `GATE_STATUS.md`. Do NOT dispatch any new work (no Milestone 6/7 workers or remediation rounds) after they finish.
2. Update `IMPLEMENTATION_CHECKLIST.md` (§2 Current Work & phase statuses) and `RESUME_GUIDE.md` with the exact stopping point, test/build results, and step-by-step instructions to continue later with Milestones 6 & 7.
3. Commit all work to git so `git status` is clean, then send me a final pause summary (latest commit SHA, M5 gate verdict, test count, and remaining steps) and stop all subagents and crons.


## Resume Request — 2026-10-22T00:26:20Z

Resume implementing PopoApp, a single-professional management app for a Brazilian aesthetic/clinical practice. Previous runs implemented, tested, and passed independent gates for Milestones 1 through 5 (Phases 1–16: full backend, database migrations, clinical seed script, 100% of Brazilian Portuguese UI screens with zero mock imports, and 335 automated tests). Continue that work through the final two milestones (Milestones 6 & 7: Phases 17 & 18) to completion. Purpose: production use by one professional.

Working directory: c:\Users\Vinicius\PopoApp\PopoApp
Integrity mode: development

Reference material (persistent project instructions; read both fully before doing anything else and treat them as binding):
- `POPOAPP_DEVELOPMENT_SPEC.md` — WHAT must be built: business rules, domain model, relationships, the 24 critical validations (§32), UX, security, testing and seed-data requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md` — HOW work is organized and tracked: phases 1–18, status markers, high-complexity decomposition, dependencies, blockers, definition of done, testing status and final audit.

## Resume context (state left by the previous runs — updated 2026-10-20)

- Read `RESUME_GUIDE.md`, `IMPLEMENTATION_CHECKLIST.md` (§2 Current Work), `PROJECT.md` and `TEST_INFRA.md` first. Earlier team state is in `.agents/teamwork/` (notably `orchestrator_5/GATE_STATUS.md`).
- Git: working tree completely clean (`git status --short` is empty). Latest commits are `dc33eb9` (baseline), `5a17482` (M2 remediation), `f5d9592` (M2 Gate + M3 backend), `892d280` (M3 Gate + M4 backend), `76089a7` (M4 Gate + M5 clinical seed script), and `cdfcc8b` (M5 pt-BR UI integration across all 9 views + M5 Gate unanimously approved).
- **Milestones 1, 2, 3, 4 & 5 Gates are ALL PASSED UNANIMOUSLY (5/5 each).**
  - Phases 1–16 are `[x]` Completed.
  - All 12 domain services and all Next.js 15 App Router API routes are implemented and tested.
  - `prisma/seed.ts` (1,180 lines) reproduces §47 Examples A–E and §50 against `PopoApp` while keeping `PopoAppTest` isolated (D7).
  - All 9 authenticated screens and detail workspaces (`/`, `/clientes`, `/clientes/[id]`, `/agenda`, `/atendimentos`, `/atendimentos/[id]`, `/procedimentos`, `/produtos`, `/financeiro`, `/lembretes`) are wired to real APIs in Brazilian Portuguese with **0 imports from `src/data/mock/*`**.
  - **44 test files / 335 tests pass (100%, 0 failures)** against `PopoAppTest`, with 0 ESLint warnings/errors and a clean Next.js 15 production build (26/26 routes).
- **Immediate next steps on resume (only Milestones 6 & 7 remain):**
  1. **Milestone 6 (Phase 17 — E2E Verification & Hardening)**:
     - Remove the unused `src/data/mock/` directory (or verify it is completely unused per AC) and ensure all acceptance criteria under "Build and run", "Critical business rules", and "End-to-end workflow" are verified against the running application seeded via `npm run db:seed`.
     - Run the Milestone 6 Gate.
  2. **Milestone 7 (Phase 18 — Final Review, Stabilization & Completion Audit)**:
     - Complete all 22 items of the Final Completion Audit in `IMPLEMENTATION_CHECKLIST.md` (§§19–20), spot-check `[x]` items for zero false completions, verify `git status` is clean, and report back the final summary per `POPOAPP_DEVELOPMENT_SPEC.md` §53.
- `localdb-proxy.js` is documented as a dev/test-only helper for LocalDB connectivity.
- Keep committing as you go (D7), at least at every milestone gate.

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
