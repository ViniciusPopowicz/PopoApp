# PopoApp — Test Infrastructure Specification (TEST_INFRA.md)

**Document Version**: 1.0.0  
**Target Environment**: Microsoft SQL Server LocalDB (`PopoAppTest`)  
**Test Framework**: Vitest (TypeScript)  
**Authoritative Sources**:
- `POPOAPP_DEVELOPMENT_SPEC.md`
- `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
- `ORIGINAL_REQUEST.md` (Decisions D1–D7, Acceptance Criteria AC 51–68)
- `spec_miner_arch_1/arch_and_test_spec.md`
- `orchestrator_1/PROJECT.md`

---

## 1. Test Philosophy & Core Principles

The PopoApp test infrastructure is built upon the following non-negotiable architectural tenets:

1. **Opaque-Box, Requirement-Driven Testing**:
   - Tests treat the system as a black/opaque box governed strictly by domain specifications and business invariants.
   - Assertions test observable behavior and state mutations, never private implementation internals.
   - Expected outputs are derived authoritatively from `POPOAPP_DEVELOPMENT_SPEC.md`, binding decisions D1–D7, and the 24 Critical Validations (§32).
   - Zero facade testing: No dummy tests that pass trivially without exercising real validation or persistence logic.

2. **Real Database Testing with Zero Domain Mocks**:
   - Tests execute against a real, isolated Microsoft SQL Server LocalDB instance targeting the database `PopoAppTest`.
   - Domain rules, relational integrity, unique constraints, foreign key cascades, and the database CHECK constraint (`CK_Attachment_Ownership`) are tested against live SQL Server engine semantics.
   - Mocks are strictly prohibited for domain services, Prisma models, and database transactions.

3. **Strict Database Isolation (D7)**:
   - Development database: `PopoApp`
   - Test database: `PopoAppTest` (`DATABASE_URL="sqlserver://localhost;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLOCALDB"`)
   - Test suites MUST verify that the active connection string points to `PopoAppTest` and will hard-abort immediately if directed towards `PopoApp` or any production environment.
   - Database tables are truncated in dependency-safe reverse topological order before or after test suites, ensuring complete independence.

4. **Progressive Testability & Milestones**:
   - Tests are structured across progressive tiers so that foundational data models and services (M1, M2) are testable immediately, while higher-order clinical workflows (M3, M4, M5) become testable as their dependencies complete.

5. **Test Independence & Determinism**:
   - Every test case creates its own isolated fixture state using unique identifiers (UUIDs, distinct CPFs, unique lot numbers).
   - No test depends on execution order or side effects produced by prior tests.
   - Tests clean up their own resources or execute within isolated transactional blocks where supported.

6. **Single Command Verification**:
   - Executing `npm test` runs all automated test tiers and must produce 100% passing tests with 0 failures.

---

## 2. Test Environment & Database Isolation Setup

### 2.1 Connection Strings and Configuration
- **Configuration File**: `.env.test` at project root:
  ```env
  DATABASE_URL="sqlserver://localhost;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLOCALDB"
  PORT=3001
  NODE_ENV="test"
  UPLOAD_DIR="./storage/test-uploads"
  SESSION_SECRET="test-secret-must-be-at-least-32-characters-long-123456"
  ```
- **Connection Guard**: `tests/helpers/db-client.ts` verifies:
  ```typescript
  if (!process.env.DATABASE_URL?.includes('PopoAppTest')) {
    throw new Error('FATAL: Tests must strictly run against PopoAppTest! Aborting to prevent data corruption.');
  }
  ```

### 2.2 Test Database Lifecycle
1. **Provisioning**: Running `npm run test:setup` provisions `PopoAppTest` if missing, applies Prisma migrations, and executes custom SQL scripts creating `CK_Attachment_Ownership`.
2. **Reset/Truncation**: `cleanTestDatabase()` truncates all tables in safe reverse-FK order:
   - `PaymentInstallment`, `Reminder`, `Payment`
   - `ProductUsage`, `IndividualStockUnit`, `Lot`, `Product`
   - `AttendanceProcedure`, `PlannedProcedure`, `MedicalRecord`, `Attachment`
   - `Attendance`, `Appointment`, `EmergencyContact`, `Client`, `Procedure`, `User`

---

## 3. Complete Feature Inventory Mapping (F01–F42)

The 42 features from `PROJECT.md` are systematically mapped to their responsible test tiers, files, and minimum test quotas:

| Feature ID | Feature Name | Milestone | Tier Mapping | Target Test File | Min Quota |
|---|---|---|---|---|---|
| **F01** | Tooling & Linting | M1 | Tier 1 | `tests/tier1_features/f01_tooling.spec.ts` | 5 |
| **F02** | User & Authentication Data Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f02_user_auth_model.spec.ts` | 5 |
| **F03** | Client & Emergency Contact Data Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f03_client_model.spec.ts` | 5 |
| **F04** | Appointment & Attendance Relational Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f04_appointment_attendance_model.spec.ts` | 5 |
| **F05** | Procedure & Technical Association Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f05_procedure_model.spec.ts` | 5 |
| **F06** | Product, Lot & Stock Unit Relational Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f06_product_stock_model.spec.ts` | 5 |
| **F07** | Medical Record Data Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f07_medical_record_model.spec.ts` | 5 |
| **F08** | Attachment Relational Model & SQL CHECK Constraint | M1 | Tier 1, Tier 2 | `tests/tier1_features/f08_attachment_constraint.spec.ts` | 5 |
| **F09** | Financial Payment Data Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f09_payment_model.spec.ts` | 5 |
| **F10** | Reminder Data Model | M1 | Tier 1, Tier 2 | `tests/tier1_features/f10_reminder_model.spec.ts` | 5 |
| **F11** | Database Migrations & SQL Server LocalDB Setup | M1 | Tier 1 | `tests/tier1_features/f11_db_migration.spec.ts` | 5 |
| **F12** | Authenticated Session & Bcrypt Authentication | M2 | Tier 1, Tier 2 | `tests/tier1_features/f12_auth_session.spec.ts` | 5 |
| **F13** | Client Management Service & Validations | M2 | Tier 1, Tier 2 | `tests/tier1_features/f13_client_service.spec.ts` | 5 |
| **F14** | Procedure Catalog Service & Validations | M2 | Tier 1, Tier 2 | `tests/tier1_features/f14_procedure_service.spec.ts` | 5 |
| **F15** | Secure File Storage Engine | M2 | Tier 1, Tier 2 | `tests/tier1_features/f15_storage_engine.spec.ts` | 5 |
| **F16** | Authenticated File Streaming API | M2 | Tier 1, Tier 3 | `tests/tier1_features/f16_streaming_api.spec.ts` | 5 |
| **F17** | Appointment Scheduling Service & Lifecycle | M3 | Tier 1, Tier 3 | `tests/tier1_features/f17_appointment_service.spec.ts` | 5 |
| **F18** | Attendance Service & D1 State Machine | M3 | Tier 1, Tier 3 | `tests/tier1_features/f18_attendance_d1.spec.ts` | 5 |
| **F19** | Planned vs Actual Procedures Management | M3 | Tier 1, Tier 3 | `tests/tier1_features/f19_planned_procedures.spec.ts` | 5 |
| **F20** | Product Inventory & Lot Management Service | M3 | Tier 1, Tier 2 | `tests/tier1_features/f20_inventory_service.spec.ts` | 5 |
| **F21** | Individual Stock Unit Tracking & Usage Service | M3 | Tier 1, Tier 2 | `tests/tier1_features/f21_stock_unit_usage.spec.ts` | 5 |
| **F22** | Medical Record (Prontuário) Service | M3 | Tier 1, Tier 2 | `tests/tier1_features/f22_medical_record_service.spec.ts` | 5 |
| **F23** | Attendance Pricing & Financial Service | M4 | Tier 1, Tier 2 | `tests/tier1_features/f23_attendance_pricing.spec.ts` | 5 |
| **F24** | Dynamic Financial Calculations | M4 | Tier 1, Tier 2 | `tests/tier1_features/f24_financial_calc.spec.ts` | 5 |
| **F25** | Payment Processing Service & Installments | M4 | Tier 1, Tier 2 | `tests/tier1_features/f25_payment_service.spec.ts` | 5 |
| **F26** | In-App Reminder Service | M4 | Tier 1, Tier 3 | `tests/tier1_features/f26_reminder_service.spec.ts` | 5 |
| **F27** | Dashboard Metrics & Aggregation Engine | M4 | Tier 1, Tier 3 | `tests/tier1_features/f27_dashboard_service.spec.ts` | 5 |
| **F28** | Comprehensive Clinical Seed Data | M5 | Tier 1, Tier 4 | `tests/tier1_features/f28_seed_data.spec.ts` | 5 |
| **F29** | pt-BR Client UI Integration | M5 | Tier 1, Tier 4 | `tests/tier1_features/f29_client_ui_flow.spec.ts` | 5 |
| **F30** | pt-BR Agenda UI Integration | M5 | Tier 1, Tier 4 | `tests/tier1_features/f30_agenda_ui_flow.spec.ts` | 5 |
| **F31** | pt-BR Attendance UI & Clinical Workspace | M5 | Tier 1, Tier 4 | `tests/tier1_features/f31_attendance_workspace_flow.spec.ts` | 5 |
| **F32** | pt-BR Procedure Catalog UI Integration | M5 | Tier 1 | `tests/tier1_features/f32_procedure_ui_flow.spec.ts` | 5 |
| **F33** | pt-BR Product & Stock UI Integration | M5 | Tier 1 | `tests/tier1_features/f33_product_ui_flow.spec.ts` | 5 |
| **F34** | pt-BR Financial Dashboard & Payments UI | M5 | Tier 1, Tier 4 | `tests/tier1_features/f34_financial_ui_flow.spec.ts` | 5 |
| **F35** | pt-BR Reminders UI & Dashboard Widget | M5 | Tier 1, Tier 4 | `tests/tier1_features/f35_reminders_ui_flow.spec.ts` | 5 |
| **F36** | pt-BR Navigation, Layout & Error Feedback | M5 | Tier 1 | `tests/tier1_features/f36_layout_feedback.spec.ts` | 5 |
| **F37** | Test Runner Infrastructure Setup | Test Track | Tier 1 | `tests/tier1_features/f37_test_infra.spec.ts` | 5 |
| **F38** | Tier 1: Feature Coverage Test Suite | Test Track | Tier 1 | Meta-suite execution | >=210 |
| **F39** | Tier 2: Boundary & Corner Cases Test Suite | Test Track | Tier 2 | `tests/tier2_boundaries/*.spec.ts` | >=50 |
| **F40** | Tier 3: Cross-Feature Combination Tests | Test Track | Tier 3 | `tests/tier3_combinations/*.spec.ts` | >=20 |
| **F41** | Tier 4: Real-World Clinical Workflows | Test Track | Tier 4 | `tests/tier4_workflows/*.spec.ts` | >=15 |
| **F42** | Tier 5: Adversarial Coverage Hardening | M6 | Tier 5 | `tests/tier5_adversarial/*.spec.ts` | >=15 |

---

## 4. The 24 Critical Validations Matrix (§32 & Acceptance Criteria)

Each of the 24 critical validations must map to at least one dedicated test file and assertion that fails if the validation rule is omitted:

| # | Validation Rule | Domain Entities | Verification Strategy & Enforcement | Test File & Function | Acceptance Criteria |
|---|---|---|---|---|---|
| **V01** | Appointment belongs to exactly 1 Client | Appointment, Client | Foreign key `clientId` non-nullable; rejects null/empty or nonexistent client | `tests/tier1_features/f04_appointment_attendance_model.spec.ts`<br>`tests/tier2_boundaries/v01_appointment_client_link.spec.ts` | AC 55 |
| **V02** | Appointment status in defined 6 statuses | Appointment | Enum string union validation (`Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`) | `tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts` | AC 55 |
| **V03** | `Em atendimento` strictly forbidden | Appointment | Rejection of `Em atendimento` at schema and service layers | `tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts` | AC 55 |
| **V04** | Rescheduling preserves old as `Reagendado` & creates new `Agendado` | Appointment, Attendance | Atomic transaction: old appointment -> `Reagendado`, old attendance -> `Cancelado`, new appointment -> `Agendado`, new attendance -> `Pendente` | `tests/tier3_combinations/v04_reschedule_workflow.spec.ts` | AC 57 |
| **V05** | Attendance distinct from Appointment | Attendance, Appointment | Distinct DB entities with separate primary keys and lifecycles | `tests/tier1_features/f04_appointment_attendance_model.spec.ts` | AC 55 |
| **V06** | Appointment supports multiple Attendances (1:N) | Appointment, Attendance | 1:N cardinality without unique constraint on `appointmentId` | `tests/tier2_boundaries/v06_multiple_attendances.spec.ts` | AC 55 |
| **V07** | Attendance not completed merely on appointment creation | Attendance | Status defaults to `Pendente`; requires explicit completion action; never created as `Realizado` | `tests/tier2_boundaries/v07_attendance_not_auto_completed.spec.ts` | AC 57 |
| **V08** | Every Procedure on Attendance has practiced value | AttendanceProcedure | `practicedValue` is required non-nullable Decimal | `tests/tier2_boundaries/v08_v09_procedure_pricing.spec.ts` | AC 55 |
| **V09** | Standard snapshot & practiced value stored separately | AttendanceProcedure | Dual columns: `standardValueSnapshot` and `practicedValue` preserved independently | `tests/tier2_boundaries/v08_v09_procedure_pricing.spec.ts` | AC 56 |
| **V10** | Standard vs practiced delta is NOT auto-discount | Attendance, AttendanceProcedure | When practiced < standard, `desconto` remains 0.00; total = practiced sum | `tests/tier4_workflows/scenario_a_pricing.spec.ts` | AC 56 |
| **V11** | Attendance discount must be explicit | Attendance | `desconto` column entered explicitly by user; total = practiced sum - discount | `tests/tier4_workflows/scenario_b_discount.spec.ts` | AC 56 |
| **V12** | Historical values immutable upon catalog edits | Procedure, AttendanceProcedure | Altering `Procedure.standardValue` leaves existing `standardValueSnapshot` unmodified | `tests/tier2_boundaries/v12_catalog_immutability.spec.ts` | AC 56 |
| **V13** | Client supports multiple emergency contacts | Client, EmergencyContact | 1:N relationship with relationship type and phone | `tests/tier1_features/f03_client_model.spec.ts` | AC 55 |
| **V14** | Attachment XOR: Client OR Attendance, never both/neither | Attachment | SQL Server CHECK constraint `CK_Attachment_Ownership` verified by bypassing service layer | `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` | AC 61 |
| **V15** | Reusable unit can be reused by SAME client | ProductUsage, StockUnit | Multiple `ProductUsage` for same `unitId` permitted when all attendances belong to same `clientId` | `tests/tier4_workflows/scenario_c_reuse.spec.ts` | AC 59, AC 65 |
| **V16** | Unit must NEVER be reused by another client | ProductUsage, StockUnit | Transaction rejects usage if previous usage belongs to different `clientId` with Portuguese error message | `tests/tier2_boundaries/v16_cross_client_reuse_rejected.spec.ts` | AC 59, AC 66 |
| **V17** | Single-use unit cannot be reused | ProductUsage, StockUnit | Rejects secondary `ProductUsage` when `Product.isReusable == false` | `tests/tier2_boundaries/v17_single_use_reuse_rejected.spec.ts` | AC 59 |
| **V18** | ProductUsage identifies individual physical unit | ProductUsage, StockUnit | Foreign key `unitId` mandatory and non-nullable | `tests/tier1_features/f06_product_stock_model.spec.ts` | AC 55 |
| **V19** | Medical Record exactly 1:1 with Attendance | MedicalRecord, Attendance | Database unique constraint on `attendanceId`; rejects duplicate record | `tests/tier2_boundaries/v19_medical_record_unique.spec.ts` | AC 55 |
| **V20** | Attendance supports multiple payments across methods | Attendance, Payment | 1:N cardinality; partial payments via PIX, Credit Card, Cash | `tests/tier3_combinations/v20_multi_method_payments.spec.ts` | AC 58 |
| **V21** | Credit card installments generate 0 reminders | Payment, Reminder | Stored installment count ($1..12$); creates exactly zero reminders in database | `tests/tier2_boundaries/v21_credit_card_zero_reminders.spec.ts` | AC 68 |
| **V22** | PIX installment schedule generates reminders | PaymentInstallment, Reminder | N reminders created matching agreed PIX installment due dates | `tests/tier2_boundaries/v22_pix_reminders_generated.spec.ts` | AC 68 |
| **V23** | Reminder status decoupling from payment truth | Reminder, Payment | Marking reminder done/dismissed leaves `Payment.status` and outstanding balance unchanged | `tests/tier2_boundaries/v23_reminder_decoupling.spec.ts` | AC 68 |
| **V24** | Historical product/procedure records not rewritten | Product, Lot, Attendance | Catalog updates do not rewrite historical `ProductUsage` or `AttendanceProcedure` | `tests/tier2_boundaries/v24_historical_catalog_changes.spec.ts` | AC 56 |

---

## 5. Tiered Test Architecture

### 5.1 Tier 1: Feature Coverage (>=5 Tests Per Core Feature)
Every feature F01 through F37 implements at least 5 isolated tests verifying:
- Happy path data creation and validation.
- Required field validation (rejection of null/undefined inputs).
- Foreign key integrity and associations.
- Retrieval and filtering operations.
- Update and soft-deletion operations.

### 5.2 Tier 2: Boundary & Corner Cases (>=5 Tests Per Feature)
Focuses on edge conditions, mathematical boundaries, and constraint stress:
- **CPF Verification Algorithm (MOD 11)**:
  - Valid formatted CPF (`123.456.789-09`) -> true
  - Valid unformatted CPF (`12345678909`) -> true
  - Repeating digits (`000.000.000-00`, `111.111.111-11`, etc.) -> rejected
  - Check digit 1 corrupted -> rejected
  - Check digit 2 corrupted -> rejected
  - Boundary lengths (10 digits, 12 digits, non-numeric characters) -> rejected
  - Duplicate CPF insert -> rejected by SQL Server unique constraint `UQ_Client_CPF` (AC 62)
- **Attachment XOR Constraint (AC 61)**:
  - Both `clientId` AND `attendanceId` populated -> throws SQL Server check constraint violation.
  - Neither `clientId` NOR `attendanceId` populated -> throws SQL Server check constraint violation.
  - Only `clientId` populated -> succeeds.
  - Only `attendanceId` populated -> succeeds.
- **Financial Decimal Precision & Rounding**:
  - Precision up to two decimals (`Decimal(10, 2)`).
  - Explicit discount equal to total practiced value -> outstanding balance R$ 0.00.
  - Explicit discount greater than total practiced value -> rejected by validation.
  - Fractional cent sums and multiple installments rounding consistency.
- **Inventory & Reuse Boundaries (AC 59, AC 66)**:
  - Single-use unit second usage attempt -> rejected with clear error.
  - Reusable unit cross-client reuse attempt -> rejected with clear Portuguese error.
  - Lot with expiration date in the past -> cannot intake or allocate to attendances.
- **Credit Card vs PIX Reminders (AC 68)**:
  - Card payment with 1, 6, 12 installments -> exactly 0 reminders created.
  - PIX payment with 1..12 installments -> exactly N reminders created.

### 5.3 Tier 3: Pairwise Cross-Feature Interactions
Tests interaction points across distinct domain boundaries:
1. **Appointment Lifecycle ↔ Attendance D1 State Machine**:
   - Appointment marked `Cancelado` -> pending Attendance automatically marked `Cancelado`.
   - Appointment marked `Não compareceu` -> pending Attendance automatically marked `Cancelado`.
   - Appointment rescheduled -> old appointment `Reagendado`, old attendance `Cancelado`, new appointment `Agendado`, new attendance `Pendente`.
   - Completed Attendance (`Realizado`) -> Appointment status updated to `Concluído`.
   - Cancellation of an Appointment whose Attendance was ALREADY completed (`Realizado`) -> does NOT cancel the completed attendance (clinical encounter occurred).
2. **Attendance Procedures ↔ Pricing ↔ Payments (D2)**:
   - Dynamic balance calculation: Total = sum(practicedValue) - discount; Outstanding = Total - sum(paidPayments).
   - Partial payments via multiple methods: Credit Card (R$ 500) + PIX (R$ 300) on R$ 1000 total -> Outstanding R$ 200.
3. **Inventory Usage ↔ Client Switching**:
   - Unit 1 used by Client A; attempt to allocate Unit 1 to Client B within an Attendance transaction -> rollback, zero records saved.
4. **Reminders ↔ Payment Ledger Decoupling**:
   - Marking PIX installment reminder as `done` or `dismissed` -> zero changes to payment status; outstanding balance remains identical.

### 5.4 Tier 4: Real-World Clinical Workflows (§47 Scenarios A–E)
Tests the end-to-end clinical scenarios with the exact values specified in §47:
- **Scenario A (Procedure Below Standard Value)**:
  - Procedure standard catalog price: R$ 500.00.
  - Attendance linked with practiced price: R$ 400.00.
  - Explicit discount: R$ 0.00.
  - Verification: Standard snapshot = 500.00, practiced = 400.00, discount = 0.00, computed total = 400.00. No automatic R$ 100.00 discount generated.
- **Scenario B (Explicit Attendance Discount)**:
  - Procedure 1 practiced: R$ 500.00.
  - Procedure 2 practiced: R$ 300.00 (sum = R$ 800.00).
  - Explicit attendance discount: R$ 100.00.
  - Verification: Computed total = R$ 700.00. Financial UI clearly reflects R$ 100.00 labeled explicitly as discount.
- **Scenario C (Reusable Physical Product Across Encounters)**:
  - Product classified as reusable (`isReusable = true`).
  - Lot intake with serial unit `UNIT-001`.
  - Client A attends Attendance 1 -> `UNIT-001` recorded in `ProductUsage`.
  - Client A attends Attendance 2 -> `UNIT-001` reused and recorded in `ProductUsage`.
  - Client B attends Attendance 3 -> Attempt to record `UNIT-001` throws domain error `"Esta unidade de estoque já está vinculada a outro cliente."` and is not saved.
- **Scenario D (Rescheduling Scheduling Cascade)**:
  - Original Appointment A on 2026-10-10 at 10:00 -> Attendance A created as `Pendente`.
  - Reschedule to 2026-10-12 at 14:00 with reason `"Cliente solicitou mudança"`.
  - Verification: Appointment A status = `Reagendado`. Attendance A status = `Cancelado`. New Appointment B created with status `Agendado`. New Attendance B created with status `Pendente`.
- **Scenario E (Client vs Attendance Attachment Exclusivity)**:
  - File 1 (General exam/consent term) saved as Client attachment (`clientId` set, `attendanceId` null).
  - File 2 (Clinical procedure photo) saved as Attendance attachment (`attendanceId` set, `clientId` null).
  - Verification: Exclusivity preserved; querying client attachments returns File 1; querying attendance attachments returns File 2.

---

## 6. Directory Layout & File Organization

The test directory layout is structured as follows:

```
tests/
├── helpers/
│   ├── db-client.ts                # Prisma client connected to PopoAppTest with isolation guard
│   ├── db-cleaner.ts               # Database truncation helper in safe FK order
│   ├── auth-helper.ts              # Session mock / iron-session cookie generator
│   ├── test-fixtures.ts            # Builders for clients, appointments, attendances, products
│   └── assertions.ts               # Custom domain assertion helpers
├── tier1_features/                 # Feature Coverage (>=5 tests per core feature)
│   ├── f01_tooling.spec.ts
│   ├── f02_user_auth_model.spec.ts
│   ├── f03_client_model.spec.ts
│   ├── f04_appointment_attendance_model.spec.ts
│   ├── f05_procedure_model.spec.ts
│   ├── f06_product_stock_model.spec.ts
│   ├── f07_medical_record_model.spec.ts
│   ├── f08_attachment_constraint.spec.ts
│   ├── f09_payment_model.spec.ts
│   ├── f10_reminder_model.spec.ts
│   └── ... (f11 through f37)
├── tier2_boundaries/               # Boundary & Corner Cases (>=5 tests per feature)
│   ├── cpf_validation.spec.ts      # CPF MOD 11 algorithm & UQ_Client_CPF
│   ├── v01_appointment_client.spec.ts
│   ├── v02_v03_appointment_statuses.spec.ts
│   ├── v06_multiple_attendances.spec.ts
│   ├── v07_attendance_not_auto_completed.spec.ts
│   ├── v08_v09_procedure_pricing.spec.ts
│   ├── v12_catalog_immutability.spec.ts
│   ├── v14_attachment_xor_constraint.spec.ts # SQL Server CHECK constraint bypass test
│   ├── v16_cross_client_reuse_rejected.spec.ts
│   ├── v17_single_use_reuse_rejected.spec.ts
│   ├── v19_medical_record_unique.spec.ts
│   ├── v21_credit_card_zero_reminders.spec.ts
│   ├── v22_pix_reminders_generated.spec.ts
│   └── v23_reminder_decoupling.spec.ts
├── tier3_combinations/             # Pairwise Cross-Feature Interactions
│   ├── appointment_attendance_state_machine.spec.ts
│   ├── dynamic_financial_calculations.spec.ts
│   ├── inventory_client_traceability.spec.ts
│   └── reminder_payment_sync.spec.ts
├── tier4_workflows/                # Real-World Clinical Scenarios (§47 A–E)
│   ├── scenario_a_procedure_below_standard.spec.ts
│   ├── scenario_b_explicit_discount.spec.ts
│   ├── scenario_c_reusable_stock_unit.spec.ts
│   ├── scenario_d_reschedule_cascade.spec.ts
│   └── scenario_e_attachment_exclusivity.spec.ts
└── vitest.config.ts                # Vitest runner configuration with .env.test loading
```

---

## 7. Execution Commands & CI Pipeline

- `npm test`: Runs the entire test suite across all tiers.
- `npm run test:tier1`: Runs Tier 1 Feature Coverage tests.
- `npm run test:tier2`: Runs Tier 2 Boundary & Corner Case tests.
- `npm run test:tier3`: Runs Tier 3 Interaction tests.
- `npm run test:tier4`: Runs Tier 4 Real-World Clinical Workflows.
- `npm run test:db:reset`: Truncates `PopoAppTest` tables without resetting migrations.

---

## 8. Definition of Done for Test Suite
The test infrastructure is complete and ready to publish `TEST_READY.md` when:
1. `TEST_INFRA.md` is approved and published.
2. Directory structure `tests/` with all subdirectories and helpers is created.
3. Database isolation is guaranteed with the guard preventing execution outside `PopoAppTest`.
4. Initial fixtures and critical validation test cases compile and run against `PopoAppTest`.
5. All 24 Critical Validations (§32) and Scenarios A–E (§47) have dedicated, non-facade test cases.
