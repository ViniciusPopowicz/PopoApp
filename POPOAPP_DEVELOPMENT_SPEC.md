# PopoApp — Master Development Specification

## 1. Purpose

Build PopoApp as a maintainable application for managing a personal aesthetic/clinical practice.

The implementation must prioritize:

- correctness of the business domain;
- clear separation between clients, appointments, attendances, procedures, products, medical records, attachments, and payments;
- preservation of historical values;
- traceability of actual service and product usage;
- simple, practical UX;
- strong data integrity;
- future maintainability without introducing unnecessary complexity.

Before changing the project, inspect the existing repository, stack, architecture, database, dependencies, conventions, and current implementation. Reuse the existing architecture when reasonable. Do not replace the technology stack without a strong technical reason.

This document is the source of truth for the product/domain requirements.

---

## 2. Terminology

Use the following domain terminology consistently:

- **Client** (`Cliente`): the person receiving services.
- **Appointment** (`Agendamento`): a scheduled occurrence associated with a Client.
- **Attendance** (`Atendimento`): the actual service/clinical encounter. Appointment and Attendance are distinct concepts.
- **Procedure** (`Procedimento`): an item from the procedure catalog.
- **Attendance-Procedure association**: the technical association connecting a Procedure to an Attendance. Do NOT create a business entity named "PerformedProcedure" / "Procedimento Realizado".
- **Product** (`Produto`): a catalog/product definition.
- **Lot** (`Lote`): a batch belonging to a Product.
- **Individual stock unit**: a traceable physical unit belonging to a Lot.
- **Product Usage** (`Uso de Produto`): a record that an individual physical product unit was used in an Attendance.
- **Medical Record** (`Prontuário`): the clinical record of an Attendance.
- **Attachment** (`Anexo`): a file belonging either to a Client or to an Attendance.

Do not silently rename or merge these concepts because they appear similar.

---

## 3. Client

Client is an independent domain entity.

The Client area must support the client's basic registration information defined by the existing product requirements, including the appropriate contact and identification fields.

The implementation should support:

- active/inactive client status when applicable;
- contact information;
- client notes where appropriate;
- profile photo;
- emergency contacts;
- direct client attachments;
- consolidated history based on actual domain records.

Do not create a separate artificial `ClientHistory` entity just to display history. History should be derived from real appointments, attendances, procedures, products, payments, attachments, and other domain records.

---

## 4. Emergency Contacts

A Client can have multiple emergency contacts.

Each emergency contact should support at least:

- name;
- phone;
- relationship;
- observation;
- active/inactive status.

The relationship is:

`Client 1:N EmergencyContact`

---

## 5. Profile Photo

The profile photo is a special type of Client attachment.

The Client may have one current profile photo.

When the profile photo is replaced, the previous profile photo does not need to be preserved as historical profile-photo data. It may be deleted/replaced.

Do not force historical profile-photo retention unless technically required by the storage implementation.

---

## 6. Attachments

Attachments are explicitly supported in two contexts:

1. Client-level attachments.
2. Attendance-level attachments.

Examples of Client-level documents include:

- photos;
- test results;
- signed terms;
- records/documents;
- other files belonging to the Client as a person.

Attendance-level attachments belong to a specific Attendance.

### Critical ownership rule

An attachment belongs to **exactly one context**:

- Client **OR**
- Attendance.

It must not simultaneously belong to both.

The data model must enforce this ownership clearly.

Attachment handling should include appropriate:

- file metadata;
- storage reference;
- file type/MIME type;
- original filename;
- timestamps;
- secure access rules.

Avoid unnecessary file-management complexity.

---

## 7. Appointment

An Appointment belongs to exactly one Client.

Appointment statuses are exactly:

- `Agendado`
- `Confirmado`
- `Concluído`
- `Cancelado`
- `Não compareceu`
- `Reagendado`

Do not create an `Em atendimento` appointment status.

`Confirmado` is manually assigned by the user.

Appointment should support the information needed for scheduling, including:

- Client;
- date/time;
- status;
- estimated value;
- payment/planning information where applicable;
- cancellation reason when cancelled;
- rescheduling relationship when applicable;
- other scheduling information required by the existing product requirements.

### Rescheduling

When an appointment is rescheduled:

1. the old Appointment becomes `Reagendado`;
2. a new Appointment is created;
3. the relationship between old and new appointments should be preserved when technically useful.

Do not overwrite the original appointment into the new date/time and lose the historical scheduling record.

---

## 8. Appointment vs Attendance

Appointment and Attendance are distinct.

An Appointment represents a scheduled event.

An Attendance represents the actual service/clinical encounter.

The implementation must support:

`Appointment 1:N Attendance`

A normal appointment may produce one Attendance, but the model must not enforce a strict 1:1 relationship because more than one Attendance may be associated with the same Appointment when the business requires it.

An Attendance is automatically created when an Appointment is created.

The Attendance waits until the actual service occurs and is manually marked as completed when the service actually occurs.

Do not interpret appointment creation as proof that the service happened.

Because appointments can also be cancelled, missed, or rescheduled, the implementation must provide a coherent Attendance lifecycle that does not falsely mark an unperformed service as completed. If the exact lifecycle for cancelled/no-show attendances is not already established in the project, keep the implementation explicit and documented rather than inventing a business rule silently.

---

## 9. Procedure Catalog

Procedure is a catalog entity.

At minimum it supports:

- name;
- description;
- standard/default value;
- estimated duration;
- active/inactive status.

The standard value is a reference/default value.

### Historical value rule

Changing the catalog's standard value must NOT change historical financial information in existing Attendances.

Whenever a Procedure is added to an Attendance, the relevant standard value must be captured as a snapshot.

---

## 10. Procedures Within an Attendance

A Procedure is associated with an Attendance through a technical association/line-item structure.

Do NOT create a domain entity called `PerformedProcedure` or `Procedimento Realizado`.

The technical association should support at least:

- its own identifier;
- `attendanceId`;
- `procedureId`;
- `standardValueSnapshot`;
- `practicedValue`;
- any necessary non-financial procedure-specific information;
- timestamps as appropriate.

The model may include additional fields only when justified by actual requirements.

---

## 11. CRITICAL: Practiced Value

Every Procedure associated with an Attendance MUST have its own practiced value.

This is mandatory.

The practiced value is the actual value assigned to that particular procedure in that particular Attendance.

It must NOT be assumed to be:

`standardValueSnapshot - discount`

This distinction is critical because a practiced value may differ from the standard value for many reasons and is not necessarily a discount.

For example, a procedure can have:

- standard value: R$ 500
- practiced value: R$ 400

without the system automatically calling R$ 100 a discount.

The system must preserve both values independently.

---

## 12. Attendance-Level Discount

Discount is a separate Attendance-level financial concept.

Do not infer an Attendance discount from differences between standard and practiced procedure values.

The Attendance must support an explicit discount where applicable.

The UI and financial logic must distinguish:

- Procedure standard/reference values;
- Procedure practiced values;
- explicit Attendance-level discount.

---

## 13. Attendance Financial Composition

Financial control is primarily at the Attendance level as a whole.

Procedure-level practiced values are preserved for detail and transparency.

The financial implementation must make it clear how the Attendance total is composed.

Avoid silently introducing a financial rule that conflicts with practiced procedure values or the explicit Attendance discount.

If the product needs an exact stored final amount in addition to a calculated amount, document why duplication is necessary and prevent inconsistent values.

Actual payments belong to the Attendance, not merely to the Appointment.

---

## 14. Products

Products are individually controlled.

The inventory model is:

`Product Catalog -> Lot -> Individual Physical Stock Unit`

A Product definition represents the catalog concept.

A Lot represents a batch.

An Individual Stock Unit represents a specific physical item that can be tracked.

Do not model inventory only as an aggregate quantity if the business requires individual traceability.

---

## 15. Product Reuse Rules

Products may be:

- single-use per Attendance;
- reusable by the same Client.

A specific physical product unit may be used by Client A across multiple Attendances when that product is reusable.

The same individual physical unit must NEVER be used by Client B.

This is a critical business rule.

The system does not need precise consumption measurement. Product usage is informational/traceability-oriented.

The Product model must therefore support a reusable/single-use property.

---

## 16. Product Usage

Actual product usage must be represented explicitly.

Do not use a simple boolean such as `productUsed = true` on the Product.

A Product Usage record must identify the actual individual physical stock unit used and the Attendance in which it was used.

The model should support, where useful:

- individual stock unit;
- Attendance;
- optionally the specific Attendance-Procedure association;
- usage date/time;
- notes/observations;
- client traceability through the Attendance.

The system must be able to answer:

- which individual unit was used;
- for which Client;
- in which Attendance;
- when it was used;
- and, when applicable, for which Procedure within that Attendance.

---

## 17. Product and Procedure Relationship

Products and Procedures have a many-to-many relationship.

A Procedure may use multiple Products.

A Product may be associated with multiple Procedures.

This relationship is useful for expected/planned usage and catalog information.

Do not confuse catalog relationships with actual usage.

Actual physical usage belongs to an Attendance and Product Usage record.

---

## 18. Planned vs Actual Product Usage

If the Appointment or another scheduling layer needs to retain expected/planned products, keep that concept separate from actual product usage.

Actual usage must only be recorded against the Attendance.

Do not treat a planned product as proof that a product was actually used.

If an appointment-level planned-product requirement is implemented, it must remain distinguishable from the actual inventory traceability records.

---

## 19. Medical Record (`Prontuário`)

There is exactly one Medical Record per Attendance.

The Medical Record stores clinical information about that Attendance, such as:

- what the Client presented;
- what was observed;
- what was done;
- instructions/orientations;
- other clinical information relevant to the encounter.

Do not replace this domain concept with a generic notes field.

Relationship:

`Attendance 1:1 MedicalRecord`

---

## 20. Payments

Payments belong to an Attendance.

An Attendance may have multiple payment records.

Support:

- partial payments;
- advance/signal payments;
- multiple payment methods;
- installments;
- payment date;
- amount;
- method;
- status;
- identifier/transaction note where useful.

The payment model must support an Attendance being paid through more than one payment method.

---

## 21. Payment Methods

The system must support multiple payment methods per Attendance.

At minimum, support the payment methods required by the product, including:

- Credit Card;
- PIX;
- and other methods appropriate to the existing requirements.

Do not assume one Attendance has exactly one payment method.

---

## 22. Credit Card Installments

Credit card installments are supported.

For a credit-card payment, store:

- total amount;
- payment method = Credit Card;
- number of installments.

The user explicitly does NOT need collection reminders for credit-card installments.

Do not add unnecessary reminder workflows for credit-card installments.

---

## 23. PIX Installments

PIX installments have a special rule.

The user may agree to a schedule such as:

- total: R$ 1,000;
- 5 installments;
- R$ 200 each;
- every 10th day of the month.

The system should support installment scheduling and reminders for agreed PIX installment dates.

Important:

- PIX installment reminders are convenience/reminder functionality;
- reminders are NOT the financial source of truth;
- payment records and payment status remain the source of truth.

---

## 24. General Reminders

Reminder functionality should be useful but simple.

Support reminders where explicitly required by the business, especially PIX installment due dates.

Do not turn reminders into a complex accounting or collections subsystem.

Credit-card installments do not require reminders.

---

## 25. Financial Domain

Financial control should observe the Attendance as a whole.

The system must be able to distinguish:

- procedure standard values;
- practiced procedure values;
- explicit Attendance discount;
- total/final Attendance amount;
- payments received;
- outstanding amount where applicable;
- installment schedules.

Do not invent unnecessary financial entities merely to make the model appear more sophisticated.

---

## 26. Client History

The Client detail page should provide a consolidated history derived from real domain data.

History should make it easy to understand the Client's:

- appointments;
- attendances;
- procedures;
- product usage;
- medical records;
- payments/financial information where appropriate;
- attachments.

Do not create a duplicated `ClientHistory` table unless there is a compelling technical reason.

---

## 27. Status and Completion

An Appointment being created does not mean the service happened.

The user manually confirms when the actual service occurs and the Attendance is completed.

Do not create an appointment status called `Em atendimento`.

Use the exact appointment statuses defined in this specification.

For Attendance status/lifecycle, ensure the system cannot falsely represent an unperformed appointment as a completed clinical encounter.

---

## 28. Audit and Dates

A complex audit-trail subsystem is not required.

Basic timestamps are sufficient unless the existing project already has a broader audit mechanism.

Use timestamps consistently for important records, especially:

- created;
- updated;
- scheduled;
- completed;
- payment;
- usage;
- attachment.

Do not build an unnecessarily complex event-sourcing/audit architecture.

---

## 29. Professional/User Responsibility

The application is currently intended for a single user/professional.

Do not add a professional-responsible field to every Attendance or Appointment merely for future-proofing.

Authentication/security should still be implemented appropriately for the application.

If the architecture naturally supports future multi-user expansion, keep it clean, but do not introduce unnecessary multi-professional workflows now.

---

## 30. Historical Data

Historical information must remain historically accurate.

Examples:

- changing a Procedure catalog standard value must not change old Attendances;
- changing Product catalog information must not rewrite historical Product Usage;
- replacing a Client profile photo does not require preserving old profile photos;
- rescheduling creates a new Appointment rather than rewriting the old appointment's history;
- practiced procedure values remain tied to their Attendance.

When a catalog value is used in a historical record and may later change, snapshot the value when required.

---

## 31. Recommended Core Relationships

The core model should approximately support:

- Client `1:N` EmergencyContact
- Client `1:N` Attachment
- Client `1:N` Appointment
- Appointment `1:N` Attendance
- Attendance `1:1` MedicalRecord
- Attendance `1:N` Attendance-Procedure associations
- Procedure `1:N` Attendance-Procedure associations
- Attendance `1:N` ProductUsage
- IndividualStockUnit `1:N` ProductUsage, subject to reuse rules
- Attendance `1:N` Payment
- Product `1:N` Lot
- Lot `1:N` IndividualStockUnit
- Product `N:N` Procedure

The exact database naming may follow the existing project conventions.

---

## 32. Critical Validations

At minimum, implement and test these rules:

1. An Appointment must belong to exactly one Client.
2. Appointment status must be one of the defined statuses.
3. `Em atendimento` must not exist as an Appointment status.
4. Rescheduling must preserve the old appointment as `Reagendado` and create a new Appointment.
5. An Attendance is distinct from its Appointment.
6. An Appointment may have more than one Attendance.
7. An Attendance must not be considered completed merely because an Appointment exists.
8. Every Procedure attached to an Attendance must have a practiced value.
9. Standard procedure value and practiced value must be stored separately.
10. A difference between standard and practiced values must not automatically become an Attendance discount.
11. Attendance discount must be explicit.
12. Historical procedure values must not change when catalog values change.
13. A Client can have multiple emergency contacts.
14. An Attachment belongs to Client OR Attendance, never both.
15. A specific reusable physical Product unit may be reused by the same Client across Attendances.
16. The same physical Product unit must never be used by another Client.
17. Single-use products must not be reused according to the business rule.
18. Product Usage must identify an individual physical stock unit.
19. Medical Record is exactly one per Attendance.
20. Attendance may have multiple payments.
21. Credit-card installments do not generate collection reminders.
22. PIX installment schedules may generate reminders.
23. Reminder state must not replace payment truth.
24. Historical records must not be rewritten by catalog changes.

---

## 33. UX Requirements

The application should be practical for a professional using it during normal work.

Prioritize:

- fast navigation;
- clear forms;
- minimal unnecessary clicks;
- obvious status;
- readable financial summaries;
- easy access to Client history;
- easy access to Attendance records;
- clear separation between planned and actual information;
- responsive behavior;
- accessible controls;
- useful empty states;
- meaningful validation messages.

Do not overload the interface with technical domain terminology when a simpler label is appropriate.

Use Brazilian Portuguese for user-facing application language unless the existing project has a different established localization strategy.

---

## 34. Procedure Entry UX

When adding Procedures to an Attendance, the UI must make the following explicit:

- selected Procedure;
- standard/reference value;
- practiced value;
- any relevant non-financial information.

The practiced value must be editable independently of the standard value.

The user must be able to understand the financial composition without confusing practiced value differences with a discount.

---

## 35. Financial Summary UX

Attendance financial UI should clearly distinguish:

- procedure values;
- practiced values;
- explicit discount;
- total;
- payments;
- installments;
- remaining amount where applicable.

Avoid misleading labels such as calling every difference between catalog and practiced values a discount.

---

## 36. No Unnecessary Complexity

Do not implement features merely because they might be useful someday.

Do not introduce:

- complex accounting;
- complex audit trails;
- multi-professional workflows;
- unnecessary event sourcing;
- unnecessary microservices;
- unnecessary abstractions;
- redundant history tables.

Prefer a coherent, well-tested, maintainable implementation.

---

## 37. Technical Architecture

Inspect the existing project first.

Then implement using the project's established stack and conventions whenever reasonable.

Priorities:

1. domain correctness;
2. relational integrity;
3. maintainability;
4. type safety;
5. validation;
6. security/privacy;
7. testability;
8. UX quality;
9. performance where relevant.

Avoid premature optimization.

Keep business rules in an appropriate domain/service layer rather than scattering critical rules across UI components.

---

## 38. Database Design

The database must enforce important relationships and constraints wherever practical.

Use:

- foreign keys;
- appropriate uniqueness constraints;
- appropriate indexes;
- explicit status values/enums where appropriate;
- transactional operations for multi-record business operations;
- historical snapshots where required.

Do not rely exclusively on frontend validation for critical business rules.

---

## 39. Security and Privacy

The application handles sensitive client and clinical information.

Implement appropriate:

- authentication;
- authorization;
- secure file access;
- input validation;
- server-side validation;
- protection against unauthorized access;
- safe handling of uploaded files;
- secure storage references;
- reasonable privacy controls.

Do not expose private attachments or medical records through predictable public URLs without appropriate protection.

---

## 40. Search and Navigation

Provide practical navigation for:

- Clients;
- Appointments/calendar;
- Attendances;
- Procedures;
- Products/stock;
- Payments/financial information.

Client search should be fast and useful.

The user should be able to move from a Client to relevant appointments, attendances, records, attachments, products, and financial information without excessive navigation.

---

## 41. Client Detail Page

The Client detail experience should provide access to:

- core client information;
- profile photo;
- emergency contacts;
- client attachments;
- appointment history;
- attendance history;
- procedure history;
- product usage history;
- medical records;
- financial/payment history where appropriate.

Keep the presentation organized rather than creating one extremely long undifferentiated page.

---

## 42. Appointment Calendar

The appointment experience should make status and scheduling clear.

Support:

- creating an appointment;
- selecting a Client;
- selecting date/time;
- status management;
- confirming manually;
- cancellation reason;
- rescheduling;
- navigation to the related Attendance.

Do not imply that an appointment being present in the calendar means the service occurred.

---

## 43. Attendance Page

The Attendance page is one of the core workflows.

It should make it easy to:

- identify the Client;
- understand the linked Appointment;
- manage procedures;
- record practiced values;
- apply an explicit discount;
- record product usage;
- access/create the Medical Record;
- add Attendance attachments;
- manage payments;
- view financial summary;
- complete the Attendance when the service actually occurs.

---

## 44. Product and Stock Page

The product/stock area should support:

- Product catalog;
- active/inactive status;
- reusable/single-use classification;
- Lots;
- individual physical stock units;
- association of Products with Procedures;
- usage history;
- traceability by Client and Attendance.

The UI should make it difficult to accidentally reuse a physical unit for another Client.

---

## 45. Payment Page

Payment UI should support:

- multiple payments per Attendance;
- partial payments;
- different payment methods;
- installments;
- credit-card installment count;
- PIX installment schedule;
- payment status;
- amount received;
- outstanding amount where applicable.

Keep reminders separate from financial truth.

---

## 46. Reminder System

Implement only the reminder functionality actually required.

The key initial use case is PIX installment due-date reminders.

Reminders should be:

- traceable to their source schedule/payment;
- safe to repeat or regenerate without corrupting financial data;
- independent from the actual payment ledger/status.

---

## 47. Data Integrity Examples

The implementation should be able to represent scenarios such as:

### Example A — Procedure practiced below standard value

Procedure catalog:
- Standard: R$ 500

Attendance:
- Standard snapshot: R$ 500
- Practiced: R$ 400
- Attendance discount: R$ 0

The system must NOT automatically create a R$ 100 discount.

### Example B — Explicit Attendance discount

Two procedures:
- Practiced total: R$ 800
- Explicit Attendance discount: R$ 100

The financial UI should clearly show the R$ 100 as a discount.

### Example C — Reusable physical product

Individual unit `UNIT-001` is used by Client A in Attendance A.

Later, the same unit may be used by Client A in Attendance B if the product is reusable.

The same unit must not be used by Client B.

### Example D — Rescheduling

Original Appointment:
- status becomes `Reagendado`.

New Appointment:
- created for the new date/time.

The original scheduling history remains available.

### Example E — Client vs Attendance attachment

A test result belonging generally to the Client is stored as a Client attachment.

A photo/document specific to a particular service is stored as an Attendance attachment.

An attachment must not belong to both contexts.

---

## 48. Development Process

Before implementing:

1. inspect the existing repository;
2. understand the current architecture;
3. identify what already exists;
4. identify missing pieces;
5. map existing code to this specification;
6. identify conflicts or ambiguities;
7. only then implement.

Do not rewrite working functionality without reason.

For every major domain feature:

1. model;
2. database;
3. domain/business logic;
4. validation;
5. backend/API;
6. frontend/UI;
7. tests;
8. integration;
9. checklist update.

---

## 49. Testing Requirements

Testing must cover both happy paths and critical business rules.

At minimum test:

### Client
- create/edit client;
- multiple emergency contacts;
- profile photo replacement;
- Client attachments.

### Appointments
- creation;
- status transitions;
- confirmation;
- cancellation reason;
- no-show;
- rescheduling;
- historical preservation.

### Attendances
- automatic creation;
- completion;
- multiple attendances per appointment;
- procedure associations;
- practiced values;
- explicit discount;
- attachments;
- Medical Record.

### Products
- Product/Lot/unit creation;
- single-use vs reusable;
- individual unit traceability;
- same-client reuse;
- cross-client reuse prevention;
- actual Product Usage.

### Payments
- multiple payments;
- partial payments;
- multiple methods;
- credit-card installments;
- PIX installments;
- reminder scheduling;
- financial consistency.

### Attachments
- Client ownership;
- Attendance ownership;
- ownership exclusivity;
- secure access;
- upload validation.

---

## 50. Seed Data

If the project uses seed/demo data, create realistic examples that exercise the critical domain rules.

Include examples for:

- Clients;
- emergency contacts;
- Appointments in different statuses;
- rescheduled Appointment;
- Attendances;
- multiple Procedures with different practiced values;
- explicit Attendance discount;
- Products/Lots/individual units;
- reusable and single-use products;
- Product Usage;
- Medical Records;
- multiple payments;
- credit-card installments;
- PIX installments;
- Client and Attendance attachments.

Do not use seed data to hide incomplete functionality.

---

## 51. User-Facing Language

The application should use clear Brazilian Portuguese terminology.

Use the domain terms consistently.

Examples:

- Cliente
- Agendamento
- Atendimento
- Procedimento
- Prontuário
- Produto
- Lote
- Pagamento
- Parcela
- Anexo

Do not expose internal technical names such as database table names or implementation-specific association names to the user.

---

## 52. Final Product Principles

The finished PopoApp should feel:

- simple;
- reliable;
- coherent;
- traceable;
- practical;
- financially transparent;
- clinically organized;
- maintainable.

The system must never sacrifice business correctness for implementation convenience.

When a requirement is ambiguous and the decision could materially change the business behavior, ask for clarification instead of inventing a rule.

---

## 53. Expected Output from the Development Agent

During implementation, the agent should:

1. inspect the existing project;
2. explain relevant findings when necessary;
3. create/update the domain model;
4. implement database changes;
5. implement business logic;
6. implement UI;
7. implement validations;
8. implement tests;
9. update the implementation checklist continuously;
10. clearly report blockers and unresolved decisions;
11. never claim a feature is complete when important pieces are missing.

At the end, provide a concise implementation summary including:

- what was implemented;
- what was tested;
- what remains;
- known limitations;
- unresolved decisions, if any;
- where the implementation checklist is located.

This specification defines WHAT PopoApp must be. The separate implementation-checklist specification defines HOW implementation progress and context must be managed.
