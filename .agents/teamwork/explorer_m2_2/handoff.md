# Handoff Report — Explorer M2 2 (Procedure Catalog)

**Task**: Phase 5 / Feature F14 — Procedure Catalog Architecture, Validation & API Design  
**Author**: Explorer M2 2  
**Target Milestone**: Milestone 2 (Security, Core Entities & Catalog)  
**Deliverable Document**: `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_2\procedure_spec.md`  

---

## 1. Observation

1. **Prisma Schema (`prisma/schema.prisma` lines 154–189)**:
   - The `Procedure` model is defined as:
     ```prisma
     model Procedure {
       id             String                 @id @default(uuid())
       nome           String
       descricao      String?                @db.NVarChar(Max)
       valorPadrao    Decimal                @db.Decimal(10, 2)
       duracaoMinutos Int
       categoria      String?
       isActive       Boolean                @default(true)
       createdAt      DateTime               @default(now())
       updatedAt      DateTime               @updatedAt

       attendanceProcedures AttendanceProcedure[]
       plannedAppointments  PlannedProcedure[]
       productAssociations  ProcedureProduct[]

       @@index([nome])
       @@index([isActive])
     }
     ```
   - Downstream models reference `Procedure`:
     - `AttendanceProcedure.procedure`: `@relation(fields: [procedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)`
     - `PlannedProcedure.procedure`: `@relation(fields: [procedureId], references: [id], onDelete: NoAction)`
     - `ProcedureProduct.procedure`: `@relation(fields: [procedureId], references: [id], onDelete: Cascade)`

2. **Master Specification (`POPOAPP_DEVELOPMENT_SPEC.md` §9, §11, §32)**:
   - §9 (Procedure Catalog): "Procedure is a catalog entity. At minimum it supports: name; description; standard/default value; estimated duration; active/inactive status. The standard value is a reference/default value. Changing the catalog's standard value must NOT change historical financial information in existing Attendances. Whenever a Procedure is added to an Attendance, the relevant standard value must be captured as a snapshot."
   - §11 (Practiced Value): "Every Procedure associated with an Attendance MUST have its own practiced value. This is mandatory. The practiced value is the actual value assigned to that particular procedure in that particular Attendance."
   - §32 (Critical Validations):
     - Rule 8: Every Procedure attached to an Attendance must have a practiced value.
     - Rule 9: Standard procedure value and practiced value must be stored separately.
     - Rule 12 & Rule 24: Historical procedure values and records must not change when catalog values change.

3. **Project Feature Inventory (`PROJECT.md` line 29)**:
   - Feature `F14`: "Procedure Catalog Service & Validations — CRUD for aesthetic procedures, active flag, positive standard values | M2 | Dev Spec §9 / §32 (V06, V07)".
   - Validation Rule V06: strictly positive standard value (`valorPadrao > 0`, `@db.Decimal(10, 2)`).
   - Validation Rule V07: mandatory fields (`nome`, `descricao`, `duracaoMinutos > 0`, `categoria`).

4. **Existing Code & UI State**:
   - `src/services/`: currently contains only `auth.service.ts`. `procedure.service.ts` does not yet exist.
   - `src/schemas/`: currently contains only `auth.ts`. `procedure.ts` does not yet exist.
   - `src/app/api/procedures/`: does not exist yet.
   - `src/app/(authenticated)/procedimentos/page.tsx`: currently consumes static mock data from `src/data/mock/procedimentos.ts`. Expects fields `id`, `nome`, `categoria`, `duracao`, `preco`, `status` (`'ativo' | 'inativo'`), `descricao`.
   - `tests/helpers/test-fixtures.ts`: `createTestProcedure` helper exists using fields `nome`, `descricao`, `valorPadrao`, `duracaoMinutos`, `categoria`, `isActive`.

---

## 2. Logic Chain

1. **Relational Constraints to Soft Deactivation Requirement**:
   - From Observation 1, both `AttendanceProcedure` and `PlannedProcedure` define foreign keys with `onDelete: NoAction`.
   - If an application attempts a raw SQL `DELETE FROM Procedure WHERE id = ?` on a procedure that is referenced in any existing clinical encounter or appointment, SQL Server LocalDB will reject the query with foreign key constraint violation error `Msg 547`.
   - Therefore, the deletion logic in `src/services/procedure.service.ts` must inspect usage count (`attendanceProcedures` and `plannedAppointments`). If usage is greater than zero, the service must perform a **soft deactivation** (`isActive = false`) rather than hard deletion.
   - If usage count is zero, a hard delete is safe and permissible.

2. **Domain Invariants to Zod Schema Validation**:
   - From Observation 2 and 3, validation rule V06 requires `valorPadrao > 0`. Zero and negative numbers are prohibited.
   - Validation rule V07 requires `nome`, `descricao`, `duracaoMinutos > 0`, and `categoria`.
   - Even though Prisma allows null for `descricao` and `categoria`, the Zod schema (`createProcedureSchema`) must enforce non-empty string constraints (`min(3)` for `descricao`, `min(2)` for `categoria`).
   - The schema must also coerce numeric strings (such as `"1500,00"` or `"1500.50"`) from form inputs to numbers to prevent serialization bugs.

3. **Schema Compatibility to Bidirectional DTO Mapping**:
   - From Observation 1, the Prisma column is `isActive: Boolean`.
   - From Observation 4, existing UI components (`StatusBadge`) and Portuguese specifications reference `status: 'ativo' | 'inativo'` and `ativo: boolean`.
   - Therefore, DTO mappers must return `isActive: boolean`, `ativo: boolean`, and `status: 'ativo' | 'inativo'`, and accept either `isActive` or `ativo` on create/update/patch.

4. **Snapshot Immutability Verification**:
   - From Observation 2 (Rules 8, 9, 12, 24), changing `valorPadrao` in the catalog only updates the catalog entry.
   - Previously recorded `AttendanceProcedure` records store an independent `standardValueSnapshot` and `practicedValue`.
   - The service and test specs must explicitly assert that updating `valorPadrao` on a procedure leaves existing `AttendanceProcedure.standardValueSnapshot` completely unaffected.

---

## 3. Caveats

1. **Milestone Phase Numbering**: In `ORIGINAL_REQUEST.md` and the dispatch message, this task is designated as "Phase 5 (Procedure Catalog)", whereas in the broader `IMPLEMENTATION_CHECKLIST.md` table, Phase 5 is labeled "Client Management" and Phase 8 is "Procedures and Pricing". The scope of this deliverable is strictly Feature `F14` / Procedure Catalog (M2).
2. **Next.js App Router Dynamic Params**: In Next.js 15, route parameters in `src/app/api/procedures/[id]/route.ts` are asynchronous (`context.params: Promise<{ id: string }>`). The design blueprint explicitly accounts for this by `await context.params`.
3. **Product Catalog Association**: The `ProcedureProduct` M:N relation links procedures to products. Since Product Catalog implementation is scheduled for M3 (Phase 9), the procedure service accepts optional `productIds?: string[]` and gracefully handles empty associations.

---

## 4. Conclusion

The Procedure Catalog specification is completely designed, fully documented in `procedure_spec.md`, and ready for immediate implementation by the coding agent.

The deliverables specified in `procedure_spec.md` provide:
1. **Zod Validation Schemas (`src/schemas/procedure.ts`)**:
   - `createProcedureSchema`: Enforces V06 (`valorPadrao > 0`), V07 (`nome`, `descricao`, `duracaoMinutos > 0`, `categoria`), and `isActive`.
   - `updateProcedureSchema`: Enforces field rules on partial updates.
   - `procedureQuerySchema`: Handles search, category filtering, and active toggle query strings.
2. **Domain Service (`src/services/procedure.service.ts`)**:
   - 8 canonical methods: `listProcedures`, `getProcedureById`, `createProcedure`, `updateProcedure`, `toggleProcedureActive`, `checkProcedureUsage`, `deleteProcedure` (with automatic soft-deactivation fallback for in-use records), and `getProcedureCategories`.
3. **API Route Handlers**:
   - `GET /api/procedures` & `POST /api/procedures` in `src/app/api/procedures/route.ts`.
   - `GET /api/procedures/[id]`, `PUT /api/procedures/[id]`, `PATCH /api/procedures/[id]`, and `DELETE /api/procedures/[id]` in `src/app/api/procedures/[id]/route.ts`.
4. **Complete Automated Test Suites**:
   - `tests/tier2_boundaries/v06_procedure_positive_value.spec.ts` (V06 boundary tests).
   - `tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts` (V07 boundary tests).
   - `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts` (V12 & V24 snapshot immutability).
   - `tests/tier1_features/f14_procedure_catalog.spec.ts` (Feature F14 CRUD & soft-deactivation).

---

## 5. Verification Method

To independently verify this specification and its future implementation:

1. **Inspect Blueprint Files**:
   - View `c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m2_2\procedure_spec.md` and check that all DTOs, schemas, service methods, API routes, and test specs are defined without placeholders or pseudo-code.
2. **Execute Schema & Type Verification**:
   - Run:
     ```powershell
     npx tsc --noEmit
     ```
3. **Execute Automated Test Suite against `PopoAppTest`**:
   - Run Vitest for the dedicated boundary and feature tests:
     ```powershell
     npx vitest run tests/tier2_boundaries/v06_procedure_positive_value.spec.ts tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts tests/tier1_features/f14_procedure_catalog.spec.ts
     ```
4. **Invalidation Conditions**:
   - Any acceptance of `valorPadrao <= 0` invalidates V06.
   - Any omission or blank acceptance of `nome`, `descricao`, `duracaoMinutos <= 0`, or `categoria` invalidates V07.
   - Any direct hard delete of an in-use procedure resulting in SQL Server error Msg 547 or loss of historical snapshot data invalidates the soft-deactivation requirement.
