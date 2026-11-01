# PopoApp — Implementation Checklist & Context Management Specification

## 1. Purpose

This document defines how the development agent must organize, track, and preserve implementation progress while building PopoApp.

The goal is to prevent:

- loss of context;
- forgotten requirements;
- false claims of completion;
- large tasks being treated as if they were small;
- dependencies being overlooked;
- unfinished work being hidden inside broad checklist items;
- another agent being unable to resume the project.

The separate `POPOAPP_DEVELOPMENT_SPEC.md` defines WHAT the product must be.

This document defines HOW implementation work must be organized and tracked.

---

## 2. Required Persistent Checklist File

Create and continuously maintain:

`IMPLEMENTATION_CHECKLIST.md`

at the project root.

This file is the persistent source of truth for implementation progress.

It must be updated throughout development, not only at the end.

Another development agent should be able to open this file and understand:

- what has been completed;
- what is currently being worked on;
- what remains;
- what is blocked;
- what decisions have been made;
- what decisions still require clarification;
- what tests have been performed;
- what the next action should be.

---

## 3. Checklist Status System

Use exactly these status markers:

- `[ ]` Not Started
- `[~]` In Progress
- `[x]` Completed
- `[!]` Blocked
- `[?]` Needs Decision

Do not mark a task `[x]` merely because part of it exists.

A task is complete only when its meaningful implementation work, integration, validation, and relevant testing are complete.

---

## 4. Initial Checklist Structure

The generated `IMPLEMENTATION_CHECKLIST.md` should contain at least:

1. Project Status
2. Current Work
3. Implementation Phases
4. Detailed Task Checklist
5. Dependencies
6. High-Complexity Work
7. Blockers
8. Decisions and Notes
9. Testing Status
10. Change Log
11. Final Completion Audit

The exact formatting may be improved for readability, but do not remove these concepts.

---

## 5. Required Implementation Phases

Track implementation using these phases:

### Phase 1 — Project Discovery and Architecture

Tasks should include:

- inspect repository;
- inspect current stack;
- inspect database;
- inspect routing;
- inspect authentication;
- inspect storage/file handling;
- inspect existing domain models;
- inspect existing tests;
- identify conventions;
- identify existing reusable components;
- map existing implementation to the development specification;
- identify conflicts or ambiguities.

### Phase 2 — Database and Domain Model

Tasks should include:

- Client;
- EmergencyContact;
- Appointment;
- Attendance;
- Procedure;
- Attendance-Procedure association;
- Product;
- Lot;
- Individual Stock Unit;
- Product Usage;
- Medical Record;
- Attachment;
- Payment;
- Installment/schedule structures where required;
- Reminder structures where required;
- relationships;
- constraints;
- indexes;
- migrations;
- seed data where applicable.

### Phase 3 — Backend / Domain Logic

Track:

- domain services;
- business rules;
- validation;
- transactions;
- API/server actions;
- error handling;
- authorization;
- historical snapshots;
- critical inventory restrictions;
- financial calculations.

### Phase 4 — Authentication and Security

Track:

- authentication;
- authorization;
- secure attachment access;
- upload validation;
- input validation;
- sensitive-data protection;
- server-side enforcement.

### Phase 5 — Client Management

Track:

- CRUD;
- contact information;
- emergency contacts;
- profile photo;
- Client attachments;
- search;
- Client detail;
- history integration.

### Phase 6 — Appointments

Track:

- creation;
- Client association;
- date/time;
- statuses;
- manual confirmation;
- cancellation reason;
- no-show;
- rescheduling;
- new appointment creation;
- historical preservation;
- Attendance creation.

### Phase 7 — Attendances

Track:

- Attendance lifecycle;
- Appointment relationship;
- multiple Attendances per Appointment;
- procedure associations;
- practiced values;
- explicit discount;
- financial summary;
- completion;
- attachments;
- Medical Record;
- Product Usage;
- payments.

### Phase 8 — Procedures and Pricing

Track:

- Procedure catalog;
- standard value;
- estimated duration;
- active/inactive;
- historical standard-value snapshots;
- Attendance-Procedure association;
- practiced value;
- procedure-level detail;
- financial composition;
- explicit Attendance discount.

### Phase 9 — Products and Inventory

Track:

- Product catalog;
- reusable/single-use;
- Lots;
- individual physical units;
- Procedure-Product relationship;
- Product Usage;
- same-client reuse;
- cross-client reuse prevention;
- single-use prevention;
- usage history.

### Phase 10 — Medical Records

Track:

- one Medical Record per Attendance;
- clinical fields;
- editing;
- display;
- permissions;
- integration with Attendance.

### Phase 11 — Attachments

Track:

- Client attachments;
- Attendance attachments;
- ownership exclusivity;
- profile photo;
- secure storage;
- file metadata;
- upload validation;
- download/view access.

### Phase 12 — Payments and Installments

Track:

- multiple payments;
- partial payments;
- payment methods;
- payment status;
- credit-card installments;
- PIX installments;
- due dates;
- outstanding amounts;
- financial consistency;
- reminder integration.

### Phase 13 — Reminders

Track:

- PIX installment reminders;
- reminder scheduling;
- reminder state;
- source/payment linkage;
- safe repeatability;
- no credit-card collection reminders.

### Phase 14 — Financial Features

Track:

- Attendance financial summary;
- practiced procedure values;
- explicit discount;
- payments;
- installments;
- remaining balance;
- consistency validations.

### Phase 15 — Client History

Track:

- appointments;
- attendances;
- procedures;
- products;
- medical records;
- payments;
- attachments;
- navigation;
- chronological/consolidated presentation.

### Phase 16 — Frontend / UX

Track:

- navigation;
- forms;
- lists;
- calendar;
- Client detail;
- Attendance page;
- product/stock screens;
- payment screens;
- responsive behavior;
- validation messages;
- loading states;
- empty states;
- error states;
- accessibility;
- Brazilian Portuguese labels.

### Phase 17 — Validation and Testing

Track:

- unit tests;
- integration tests;
- API/backend tests;
- database constraints;
- critical business rules;
- UI flows;
- security-sensitive flows;
- file uploads;
- payment flows;
- inventory traceability;
- regression testing.

### Phase 18 — Final Review and Stabilization

Track:

- specification audit;
- database audit;
- backend audit;
- frontend audit;
- test audit;
- UX audit;
- security/privacy audit;
- unresolved decisions;
- blockers;
- cleanup;
- documentation;
- final checklist verification.

---

## 6. Task Granularity

Do not create vague checklist items such as:

- "Implement inventory"
- "Implement payments"
- "Finish frontend"
- "Implement appointments"

These are too broad.

Break them into actionable units.

For example:

Instead of:

`[ ] Implement inventory`

use:

- `[ ] Create Product catalog model`
- `[ ] Create Lot model`
- `[ ] Create Individual Stock Unit model`
- `[ ] Add reusable/single-use classification`
- `[ ] Create Product Usage model`
- `[ ] Enforce same-client reuse rule`
- `[ ] Enforce cross-client reuse prevention`
- `[ ] Enforce single-use restrictions`
- `[ ] Implement usage history`
- `[ ] Implement inventory UI`
- `[ ] Add inventory business-rule tests`

The checklist must make remaining work obvious.

---

## 7. High-Complexity Tasks

Any task that is likely to require substantial reasoning, multiple models, multiple screens, migrations, business rules, or extensive testing must be explicitly marked as high complexity.

Use a notation such as:

`[ ] 🔴 HIGH COMPLEXITY — ...`

or another equally obvious convention.

Do not hide large work inside a single checklist item.

At minimum, treat these as high-complexity areas:

### Database / Domain Model

Why:

- many entities;
- non-trivial cardinalities;
- historical snapshots;
- inventory traceability;
- financial relationships;
- attachment ownership.

Break down into:

- entity design;
- relationships;
- constraints;
- migrations;
- indexes;
- seed data;
- integrity tests.

### Product Inventory and Individual Unit Traceability

Why:

- Product -> Lot -> physical unit;
- reusable vs single-use;
- same-client reuse;
- cross-client prohibition;
- actual usage history.

Break down into:

- catalog;
- lots;
- units;
- usage;
- validation;
- UI;
- tests.

### Attendance + Procedure Pricing

Why:

- Appointment and Attendance are distinct;
- Appointment may have multiple Attendances;
- each Attendance has multiple procedures;
- standard value snapshot;
- practiced value;
- explicit Attendance discount.

Break down into:

- Attendance model;
- procedure association;
- historical value snapshot;
- practiced value;
- financial calculation;
- UI;
- validations;
- tests.

### Payments and Installments

Why:

- multiple payments;
- partial payments;
- multiple methods;
- credit-card installments;
- PIX installments;
- reminders;
- financial consistency.

Break down into:

- payment model;
- methods;
- installments;
- credit-card behavior;
- PIX schedule;
- reminders;
- balance;
- UI;
- tests.

### Attachment / File Management

Why:

- two ownership contexts;
- profile photo;
- secure access;
- storage;
- metadata;
- upload validation.

Break down into:

- storage;
- metadata;
- Client ownership;
- Attendance ownership;
- profile photo;
- access control;
- upload validation;
- UI;
- tests.

### Reminder System

Why:

- scheduled events;
- source financial records;
- PIX-specific behavior;
- idempotency/safety.

Break down into:

- reminder model;
- scheduling;
- generation;
- delivery mechanism if applicable;
- status;
- deduplication;
- tests.

---

## 8. Dependencies

Track dependencies between tasks.

Examples:

- Database models before backend services.
- Backend validation before final frontend forms.
- Product/Lot/Unit model before Product Usage.
- Attendance-Procedure association before practiced-value UI.
- Payment model before financial summary.
- PIX installment model before PIX reminders.
- Attachment storage/access before attachment UI.
- Authentication before protected Client/Attendance data.

If a task is blocked by another task, mark it `[!]` or `[?]` as appropriate and document the dependency.

---

## 9. Definition of Done

A task should only be marked `[x]` when applicable:

1. implementation exists;
2. it is integrated with the surrounding system;
3. business validation exists;
4. database constraints exist where appropriate;
5. relevant UI exists when the task is user-facing;
6. relevant tests have been performed;
7. no known business-rule violation remains;
8. checklist documentation has been updated.

If only part of the work is complete, use `[~]`.

---

## 10. Never Fake Completion

Never mark something `[x]` just because:

- a database table exists;
- a screen exists;
- a button exists;
- a migration runs;
- one happy-path test passes;
- the feature compiles.

A feature is complete only when the meaningful workflow works end-to-end and the relevant business rules are enforced.

If uncertain, use `[~]`.

If blocked by missing information, use `[?]`.

If blocked by a technical issue, use `[!]`.

---

## 11. Current Work Section

Always maintain a `Current Work` section near the top of `IMPLEMENTATION_CHECKLIST.md`.

It should state:

- current phase;
- current task;
- task status;
- what has just been completed;
- what remains for the current task;
- immediate next action;
- blockers;
- pending decisions.

Example:

```md
## Current Work

- Phase: 9 — Products and Inventory
- Current task: Enforce cross-client physical-unit reuse restriction
- Status: [~] In Progress
- Completed:
  - Individual stock unit model
  - Product Usage model
  - Same-client reuse validation
- Remaining:
  - Cross-client validation
  - Integration test
- Next action:
  - Add server-side transaction validation
- Blockers:
  - None
```

Keep this section accurate.

---

## 12. Change Log

Maintain a concise change log in `IMPLEMENTATION_CHECKLIST.md`.

Record meaningful implementation milestones.

Examples:

```md
## Change Log

- 2026-10-05 — Created initial domain model and migrations.
- 2026-10-05 — Implemented Client attachments.
- 2026-10-06 — Added Attendance-Procedure practiced values.
- 2026-10-06 — Added same-client Product Unit reuse validation.
```

Do not record every tiny code edit.

---

## 13. Decisions and Notes

Maintain a section for decisions that may matter to future agents.

Record:

- architectural decisions;
- interpretations of requirements;
- technical trade-offs;
- resolved ambiguities;
- reasons for non-obvious implementation choices.

Example:

```md
## Decisions and Notes

- Appointment and Attendance are separate concepts.
- Appointment has a 1:N relationship with Attendance.
- Procedure is not directly attached to Appointment.
- Procedure pricing inside Attendance uses a technical association, not a domain entity called PerformedProcedure.
- Practiced procedure value is independent from Attendance discount.
```

Do not silently change business rules.

---

## 14. Blockers

Maintain a dedicated blockers section.

For each blocker, record:

- description;
- affected task;
- why it is blocked;
- what is needed;
- current status.

Example:

```md
## Blockers

- [!] Need clarification about Attendance lifecycle for cancelled/no-show appointments.
  - Affected: Phase 7
  - Needed: business decision
```

When a blocker is resolved, move the information into Decisions and Notes and update the relevant task.

---

## 15. Testing Status

Maintain a testing section that tracks important validation work.

At minimum, track:

### Client

- [ ] Client CRUD
- [ ] Multiple emergency contacts
- [ ] Profile photo replacement
- [ ] Client attachments

### Appointments

- [ ] Appointment creation
- [ ] Status transitions
- [ ] Manual confirmation
- [ ] Cancellation reason
- [ ] No-show
- [ ] Rescheduling
- [ ] Historical preservation
- [ ] Attendance creation

### Attendances

- [ ] Attendance creation
- [ ] Multiple Attendances per Appointment
- [ ] Procedure association
- [ ] Practiced values
- [ ] Explicit discount
- [ ] Completion
- [ ] Medical Record
- [ ] Attendance attachments
- [ ] Product Usage

### Inventory

- [ ] Product
- [ ] Lot
- [ ] Individual unit
- [ ] Reusable product
- [ ] Single-use product
- [ ] Same-client reuse
- [ ] Cross-client reuse prevention
- [ ] Usage traceability

### Payments

- [ ] Multiple payments
- [ ] Partial payments
- [ ] Multiple methods
- [ ] Credit-card installments
- [ ] PIX installments
- [ ] PIX reminders
- [ ] Financial balance

### Attachments

- [ ] Client ownership
- [ ] Attendance ownership
- [ ] Ownership exclusivity
- [ ] Upload validation
- [ ] Secure access

Do not mark tests complete without actually running or otherwise validating them.

---

## 16. Context Preservation

The checklist exists specifically to preserve development context.

Whenever meaningful work is completed, update:

- task status;
- current work;
- dependencies if changed;
- decisions if made;
- blockers if discovered/resolved;
- testing status;
- change log when appropriate.

Another agent should be able to continue the project without needing the previous agent's hidden memory.

Do not rely on chat history as the only source of implementation context.

---

## 17. Do Not Duplicate the Main Specification

`IMPLEMENTATION_CHECKLIST.md` should NOT contain a full copy of `POPOAPP_DEVELOPMENT_SPEC.md`.

The files have different purposes:

- `POPOAPP_DEVELOPMENT_SPEC.md` = product/business/technical requirements.
- `POPOAPP_IMPLEMENTATION_CHECKLIST.md` = rules for managing implementation.
- `IMPLEMENTATION_CHECKLIST.md` = live project progress/state.

Use concise references and task descriptions instead of duplicating the full specification.

---

## 18. Feature Completion Summary

Only declare a major feature complete when its meaningful subtasks are complete.

For example, do not write:

`[x] Payments`

while any of these are unfinished:

- payment records;
- multiple payment methods;
- partial payments;
- credit-card installments;
- PIX installments;
- financial balance;
- relevant reminders;
- tests.

Instead, mark the parent task `[~]` until the required subtasks are completed.

---

## 19. Final Completion Criteria

The project should not be declared fully complete until the checklist confirms all major domains have been reviewed:

- [ ] Project architecture reviewed
- [ ] Database/domain model complete
- [ ] Client management complete
- [ ] Appointments complete
- [ ] Attendances complete
- [ ] Procedures and practiced values complete
- [ ] Explicit Attendance discount complete
- [ ] Products/Lots/individual units complete
- [ ] Product Usage and traceability complete
- [ ] Medical Records complete
- [ ] Attachments complete
- [ ] Payments complete
- [ ] Credit-card installments complete
- [ ] PIX installments complete
- [ ] PIX reminders complete
- [ ] Client history complete
- [ ] Frontend/UX complete
- [ ] Security/privacy reviewed
- [ ] Critical validations tested
- [ ] Regression tests completed
- [ ] No unresolved blockers
- [ ] No unresolved business decisions
- [ ] Final specification audit completed

---

## 20. Final Audit

Before declaring the implementation complete, compare:

1. `POPOAPP_DEVELOPMENT_SPEC.md`
2. domain model
3. database schema/migrations
4. backend/domain logic
5. frontend/UI
6. tests
7. `IMPLEMENTATION_CHECKLIST.md`

Look specifically for:

- requirements present in the specification but absent in code;
- business rules implemented only on the frontend;
- historical values that can accidentally change;
- inventory units that can be reused incorrectly;
- payments that can become inconsistent;
- attachments with ambiguous ownership;
- appointment/attendance confusion;
- practiced values being treated as discounts;
- incomplete UX flows;
- missing tests.

Document any remaining issue instead of silently ignoring it.

---

## 21. Working Rule for the Development Agent

Work incrementally.

For each meaningful feature:

1. inspect;
2. break down;
3. mark the task `[~]`;
4. implement;
5. validate;
6. test;
7. mark completed subtasks `[x]`;
8. update `Current Work`;
9. update decisions/blockers;
10. continue to the next dependency.

Do not attempt to hide a large amount of unfinished work behind one broad "done" statement.

When a task is high complexity, explicitly decompose it before implementation.

When a requirement is materially ambiguous, mark it `[?]` and ask for clarification rather than inventing a business rule.

When technical work is blocked, mark it `[!]` and document the blocker.

The checklist must remain useful throughout the entire project lifecycle, including after context loss, handoff to another agent, or interruption of implementation.
