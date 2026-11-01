# PopoApp MVP Stabilization & Global UI Improvements — Master Checklist

## Phase 0: Reconnaissance & Planning
- [x] Inspect repository structure, Prisma schema, migrations, services, API routes, and UI pages
- [x] Trace exact root causes for `BUG-001` through `BUG-006`
- [x] Create `PLANNING.md` with architectural plan and root cause matrix
- [x] Create `CHECKLIST.md` to track all deliverables in real time

## Phase 1: Critical Bug Fixes (Stabilization)
- [x] **Database Migration & Self-Healing Bootstrap**:
  - [x] Fix index dependency order in `prisma/migrations/20261024000000_remediation_phases_1_to_6/migration.sql`
  - [x] Create `src/lib/db-bootstrap.ts` (`ensureDatabaseSchema`) and wire into auth/services
- [x] **BUG-001 (Dashboard Internal Error)**:
  - [x] Fix `src/services/dashboard.service.ts` (monthly attendance count, safe division, serializable `lowStock`, null-safe metrics)
  - [x] Fix `src/app/api/dashboard/summary/route.ts` and `src/app/(authenticated)/page.tsx`
- [x] **BUG-002 (Products List Failure)**:
  - [x] Fix `src/services/product.service.ts` and `src/app/api/products/route.ts` (`trackingMode` filter & safe lot/unit aggregation)
  - [x] Fix `src/app/(authenticated)/produtos/page.tsx` (`trackingMode` and `estoqueMinimo` in edit dialog)
- [x] **BUG-003 (Reminders List Failure)**:
  - [x] Fix `src/services/reminder.service.ts`, `src/schemas/reminder.ts`, and `src/app/api/reminders/route.ts` (null safety, `search` and `date` filters)
  - [x] Fix `src/app/(authenticated)/lembretes/page.tsx`
- [x] **BUG-004 (Financial Summary Internal Error)**:
  - [x] Fix `src/app/api/financial/summary/route.ts` and `src/services/financial.service.ts` (safe custom date parsing, end-of-day boundary, null-safe aggregations)
  - [x] Add `search` support to `src/app/api/financial/transactions/route.ts`, `src/app/api/financial/obligations/route.ts`, and `src/app/api/financial/movements/route.ts`
- [x] **BUG-005 (Appointment Procedure Values Rendered as Zero)**:
  - [x] Expose `valorPadrao` and `precoPadrao` consistently in `src/services/procedure.service.ts`
  - [x] Fix procedure price display and estimated value sum calculation in `src/app/(authenticated)/agenda/page.tsx`
- [x] **BUG-006 (Reminders Form Client Dropdown Empty)**:
  - [x] Return both `items` and `data` in `src/app/api/clients/route.ts`, support `active=true` parameter, and increase `limit` max to `500` in `src/schemas/client.ts`
  - [x] Fix client list state hydration and combobox binding in `src/app/(authenticated)/lembretes/page.tsx`

## Phase 2: Design System Primitives & Shared Utilities
- [x] Create `src/hooks/use-debounce.ts` (`useDebounce<T>(value: T, delay = 350): T`)
- [x] Create `src/lib/masks.ts` (Currency BRL, Phone BR, Date `DD/MM/YYYY` <-> ISO, CPF `000.000.000-00` <-> raw digits)
- [x] Create `src/components/ui/app-combobox.tsx` matching "Tracking Mode" visual spec with keyboard navigation & outside-click close
- [x] Create `src/components/shared/listing-toolbar.tsx` (Left search slot, Right filters + primary action button slot)
- [x] Create `src/components/shared/row-status-toggle.tsx` (In-table active/inactive switch with optimistic update & rollback)

## Phase 3: Global UI Improvements Rollout
- [x] **IMPROVEMENT-001 (Input Masks & Raw Persistence)**:
  - [x] Apply masks to Client Form (`CPF`, `Telefone`, `Data de Nascimento`, emergency contact `Telefone`)
  - [x] Apply masks to Procedure Form (`Valor Padrão` currency)
  - [x] Apply masks to Product & Lot Intake Forms (`Custo Total`, `Custo Unitário`, `Data de Compra`, `Data de Validade`)
  - [x] Apply masks to Agenda, Reminders, Financial, and Attendance forms (`Valor Estimado`, `Valor`, `Valor Praticado`, `Desconto`, `Data` fields)
  - [x] Fix ClientFormDialog emergency contact (`/api/clients/[id]/contacts`) & profile photo (`/api/clients/[id]/photo`) endpoints, LotIntakeDialog payload schema alignment, and UnitActionDialog (`/api/stock/units/[id]`) endpoint
- [x] **IMPROVEMENT-002 (Active/Inactive Status Controls)**:
  - [x] Remove active/inactive controls from Product, Client, and Procedure create/edit modals
  - [x] Integrate `RowStatusToggle` into Products (`produtos/page.tsx`), Clients (`clientes/page.tsx`), and Procedures (`procedimentos/page.tsx`) listings
- [x] **IMPROVEMENT-003 (Debounced Search - 350ms)**:
  - [x] Apply `useDebounce` to Products, Clients, Reminders, Financials, Procedures, and Attendances search inputs
- [x] **IMPROVEMENT-004 & IMPROVEMENT-005 (ListingToolbar & Create Button Placement)**:
  - [x] Refactor Products, Clients, Reminders, Financials, Procedures, and Attendances listings to use `ListingToolbar` with search on left and filters + create button on right above the table/list
- [x] **IMPROVEMENT-006 (Agenda Reminder Indicators)**:
  - [x] Render compact reminder indicator in Agenda Month, Week, and Day views for days with active reminders
  - [x] Navigate to `/lembretes?date=YYYY-MM-DD` on click and filter Reminders page by that date
- [x] **IMPROVEMENT-007 (Combobox Standardization)**:
  - [x] Replace native/legacy selects & datalists with `AppCombobox` across Product Form, Lot Intake Form, Client Form, Client Workspace, Agenda Form, Attendance Workspace (Procedures, Product Usages, Financials, Attachments), Reminders Form/Filters, and Financial Form/Filters

## Phase 4: Verification & Quality Gate
- [x] TypeScript static check (`npx tsc --noEmit`) passes with 0 errors
- [x] Linter (`npm run lint`) passes with 0 warnings/errors
- [x] Automated test suite (`npx vitest run`) passes including new regression tests for `BUG-001..006`, Lot/Unit schemas, and Phase 2/3 utilities
- [x] Production build (`npm run build`) succeeds

## Phase 5: Final Delivery Report
- [x] Update `PLANNING.md` and `CHECKLIST.md` to 100% completion
- [x] Send final verification report to parent coordinator
