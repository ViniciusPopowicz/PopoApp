# PopoApp MVP Stabilization & Global UI Improvements — Execution Plan

## 1. Executive Summary
This document defines the architectural plan, root cause analysis, and implementation strategy for stabilizing the PopoApp MVP (resolving 6 critical data/API/rendering bugs) and delivering 7 global UI/UX improvements powered by reusable design system primitives.

---

## 2. Phase 0: Baseline Reconnaissance & Root Cause Analysis

### 2.1 Critical Bugs Root Cause Matrix
| Bug ID | Module / Location | Root Cause Uncovered | Resolution Strategy |
| :--- | :--- | :--- | :--- |
| **BUG-001** | Dashboard Summary (`src/app/(authenticated)/page.tsx`, `src/app/api/dashboard/summary/route.ts`, `src/services/dashboard.service.ts`) | 1. **Database Schema Drift / Migration Defect**: Migration `20261024000000_remediation_phases_1_to_6/migration.sql` attempted `ALTER TABLE [dbo].[Attendance] ALTER COLUMN [appointmentId] NVARCHAR(1000) NULL` *before* dropping `[Attendance_appointmentId_idx]` (and similarly on `ProductUsage.stockUnitId`), causing SQL Server migration failure or unmigrated schema (`P2021`/`P2022` when querying `Product.trackingMode`, `FinancialObligation`, `FinancialMovement`, `Reminder.recurrenceId`).<br>2. **Service Aggregation Defect**: `DashboardService.getDashboardSummary()` used `attendances.realizadosCount` (today's attendances) instead of monthly attendances for `monthlyAttendancesCount` and `averageTicket`, and attached non-index properties (`totalAlerts`, `items`) to an `Array` (`lowStock`), which `JSON.stringify` strips. | 1. Fix `migration.sql` index drop/recreate order and add an idempotent runtime schema self-healing bootstrap (`ensureDatabaseSchema()`) + resilient query fallbacks.<br>2. Compute monthly attendance metrics (`monthRange`) for `monthlyCompletedCount` and `averageTicket`, guard all division-by-zero and null relations, and normalize response payload consumption in `page.tsx`. |
| **BUG-002** | Products List (`src/app/(authenticated)/produtos/page.tsx`, `src/app/api/products/route.ts`, `src/services/product.service.ts`) | 1. Queries `Product.trackingMode`, `Product.estoqueMinimo`, and `ProductLot.quantidadeDisponivel`, which throw `P2022` if migration 2 was not applied.<br>2. `GET /api/products` did not forward `trackingMode` query param to `listProducts`.<br>3. `handleOpenEditProduct` in `produtos/page.tsx` omitted `trackingMode` and `estoqueMinimo` when opening the edit modal. | 1. Ensure schema columns exist via `ensureDatabaseSchema()` and add null-safe lot/unit quantity calculations in `mapProductSummary`.<br>2. Pass `trackingMode` in `GET /api/products`.<br>3. Include `trackingMode` and `estoqueMinimo` in `editingProduct` state in `produtos/page.tsx`. |
| **BUG-003** | Reminders List (`src/app/(authenticated)/lembretes/page.tsx`, `src/app/api/reminders/route.ts`, `src/services/reminder.service.ts`) | 1. `ReminderService.listReminders` calls `syncPixInstallmentReminders` and queries `ReminderRecurrence` / `appointment` / `attendance` relations added in migration 2.<br>2. In `syncPixInstallmentReminders`, `inst.payment?.attendance?.clientId` was accessed without optional chaining.<br>3. Missing `search` and exact `date` (`?date=YYYY-MM-DD`) filtering in `reminderQuerySchema` and `ReminderService.listReminders`. | 1. Ensure schema via `ensureDatabaseSchema()` and wrap `syncPixInstallmentReminders` in a safe guard with optional chaining.<br>2. Add `search` and `date` query parameter support to `reminderQuerySchema`, `/api/reminders`, and `ReminderService.listReminders`. |
| **BUG-004** | Financial Summary (`src/app/(authenticated)/financeiro/page.tsx`, `src/app/api/financial/summary/route.ts`, `src/services/financial.service.ts`) | 1. Queries `FinancialObligation` and `FinancialMovement` tables from migration 2.<br>2. Custom date range parsing in `/api/financial/summary/route.ts`: empty or partial `startDate`/`endDate` strings or `YYYY-MM-DD` end dates (parsed at `00:00:00.000Z` instead of `23:59:59.999`) could produce `Invalid Date` (`RangeError: Invalid time value` on `.toISOString()`) or exclude same-day records. | 1. Ensure `FinancialObligation`, `FinancialSettlement`, and `FinancialMovement` tables via `ensureDatabaseSchema()`.<br>2. Harden date parsing in `/api/financial/summary/route.ts` and `DashboardService.getDateRange` so invalid/partial dates fall back gracefully and `endDate` spans through `23:59:59.999`. |
| **BUG-005** | Appointment Procedure Values (`src/app/(authenticated)/agenda/page.tsx`, `src/services/procedure.service.ts`) | `ProcedureService` returns `valorPadrao: Number(procedure.valorPadrao)`, whereas `agenda/page.tsx` expected `proc.precoPadrao`. Because `proc.precoPadrao` was `undefined`, every procedure displayed `R$ 0,00` and `valorEstimado` always summed to `0`. | 1. Expose both `valorPadrao` and `precoPadrao` in `ProcedureDto` (`src/services/procedure.service.ts`).<br>2. Update `agenda/page.tsx` to read `Number(proc.valorPadrao ?? proc.precoPadrao ?? 0)` and accurately recalculate `newValorEstimado` when procedures are toggled (including resetting when 0 procedures are selected). |
| **BUG-006** | Reminders Form Client Dropdown (`src/app/(authenticated)/lembretes/page.tsx`, `src/app/api/clients/route.ts`) | `GET /api/clients` returned `{ success: true, items: [...], pagination: {...} }`, whereas `lembretes/page.tsx` checked `if (json.success && json.data) setClients(json.data)`. Because `json.data` was `undefined`, `clients` remained `[]`. | 1. Update `GET /api/clients` to return both `items: result.items` and `data: result.items` (and support `active=true` as an alias for `status=ativo`).<br>2. Update `lembretes/page.tsx` to read `json.data || json.items || []` and use `AppCombobox` for client selection. |

---

## 3. Phase 2: Design System Primitives & Shared Utilities

1. **`src/hooks/use-debounce.ts`**:
   - Generic `useDebounce<T>(value: T, delay = 350): T` hook with timer cleanup on unmount/re-render.
2. **`src/lib/masks.ts`**:
   - **Currency (BRL)**: `maskCurrencyBRL(value)` (`R$ 1.234,56`), `unmaskCurrencyBRL(raw): number` (`1234.56`), and `numberToCurrencyInput(num)`.
   - **Phone (BR)**: `maskPhoneBR(value)` (`(00) 0000-0000` / `(00) 00000-0000`), `unmaskPhoneBR(raw): string`.
   - **Date (BR)**: `maskDateBR(value)` (`DD/MM/YYYY`), `dateBRToISO(masked): string | null` (`YYYY-MM-DD`), `isoToDateBR(iso): string` (`DD/MM/YYYY`).
   - **CPF**: `maskCPF(value)` (`000.000.000-00`), `unmaskCPF(raw): string` (11 digits).
3. **`src/components/ui/app-combobox.tsx`**:
   - Replicates the exact visual style of the "Modo de Rastreio" (`Select`) control (`h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`, popover container `z-50 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md`, item hover `hover:bg-accent hover:text-accent-foreground`, left `Check` icon, right `ChevronDown` icon).
   - Supports searchable filtering, optional free-text creation (`creatable`), keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), and outside-click close.
4. **`src/components/shared/listing-toolbar.tsx`**:
   - Standardized responsive flex toolbar with a Left Slot (debounced search input) and Right Slot (secondary filter comboboxes/controls + primary creation CTA button).
5. **`src/components/shared/row-status-toggle.tsx`**:
   - In-table status switch/badge with optimistic state update, automatic rollback on error, and in-flight lock.

---

## 4. Phase 3: Global UI Improvements Rollout

- **IMPROVEMENT-001 (Input Masks)**: Apply BRL currency, Phone, Date (`DD/MM/YYYY`), and CPF masks across Client, Procedure, Product, Lot Intake, Agenda, Reminders, and Financial forms while persisting clean unmasked values (`float`, 11-digit CPF, raw phone/digits, ISO date).
- **IMPROVEMENT-002 (Active/Inactive Controls)**: Remove active/inactive switches from Product, Client, and Procedure creation/edit dialogs; add `RowStatusToggle` to Product, Client, and Procedure table rows (backed by `PATCH`/`PUT` endpoints).
- **IMPROVEMENT-003 (Debounced Search)**: Wire `useDebounce(search, 350)` into Products, Clients, Reminders, Financials, and Procedures listings (and add backend `search` support to Reminders and Financial Transactions/Obligations/Movements).
- **IMPROVEMENT-004 & IMPROVEMENT-005 (ListingToolbar & Create Button Placement)**: Refactor Products, Clients, Reminders, Financials, and Procedures header toolbars using `ListingToolbar` with search on the left and filters + primary create button on the right directly above the table/list.
- **IMPROVEMENT-006 (Agenda Reminder Indicators)**: Fetch reminders for the active calendar range in `agenda/page.tsx`; display a compact clickable reminder indicator badge/dot in Month, Week, and Day cells that navigates to `/lembretes?date=YYYY-MM-DD`; support `?date=YYYY-MM-DD` filtering in `lembretes/page.tsx`.
- **IMPROVEMENT-007 (Combobox Standardization)**: Standardize select/dropdown/datalist controls across Product, Lot Intake, Client, Agenda, Reminders, and Financial forms/filters using `AppCombobox`.

---

## 5. Phase 4 & 5: Verification & Delivery
- Typecheck (`npx tsc --noEmit`), Lint (`npm run lint`), Automated Tests (`npx vitest run`), and Production Build (`npm run build`).
