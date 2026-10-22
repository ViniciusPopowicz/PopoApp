# BRIEFING — 2026-10-16T01:12:00Z

## Mission
Investigate and produce a complete, turnkey implementation specification for Product, Lot, and Stock Unit domain services, API routes, Zod schemas, and test suites with rigorous single-use vs reusable cross-client traceability rules.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m3_2
- Original parent: 07a8cd7d-13bd-4863-aa7f-f890fa8d06c8
- Milestone: M3 (Products, Lots & Stock Unit Traceability)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in production source files
- Deliver turnkey implementation spec for ProductService, StockService, Zod schemas, API routes, and test specs
- Strictly enforce V15 (expired lots), V16 (reusable same client), V17 / AC 59 / AC 66 (cross-client blocked server-side & DB), V18 (single-use blocked)

## Current Parent
- Conversation ID: 07a8cd7d-13bd-4863-aa7f-f890fa8d06c8
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `prisma/schema.prisma` (Product, ProductLot, StockUnit, ProductUsage, ProcedureProduct)
  - `prisma/migrations/20261006000000_init_domain_models/migration.sql` (SQL Server table definitions, foreign keys, cascade paths)
  - `POPOAPP_DEVELOPMENT_SPEC.md` (§§14–18, §31, §32 V15–V18)
  - `ORIGINAL_REQUEST.md` (AC 59, AC 66, D1–D7)
  - `IMPLEMENTATION_CHECKLIST.md` (Phase 9 high complexity, V15–V18, Scenario C)
  - Existing patterns in `src/services/procedure.service.ts`, `src/services/client.service.ts`, `src/schemas/procedure.ts`, `src/lib/errors.ts`, `src/lib/session.ts`
  - Existing tests in `tests/tier4_workflows/scenarios_a_through_e.spec.ts` (Scenario C)
- **Key findings**:
  - Relational model uses `Product` -> `ProductLot` -> `StockUnit` -> `ProductUsage`.
  - `Product.isReusable`: single-use units can only be consumed once (V18), subsequent uses strictly rejected; reusable units can be reused by same client across attendances (V16), but cross-client reuse is strictly blocked server-side and in DB with exact Portuguese error (V17, AC 59, AC 66).
  - Validation V15: expired lots (`dataValidade < now`) cannot be dispensed or used in clinical encounters.
  - Multi-layer defense: Domain Service validation in Prisma transaction + SQL Server trigger `TR_ProductUsage_ValidateReuse` guarantees DB-level rejection even if UI / service is bypassed (AC 59).
  - Delivered complete turnkey code for DTOs (`src/types/product.ts`), Zod schemas (`src/schemas/product.ts`), `ProductService` (`src/services/product.service.ts`), `StockService` (`src/services/stock.service.ts`), 7 API routes, and 4 test suites.
- **Unexplored areas**: None for M3 Product and Stock Unit scope.

## Key Decisions Made
- DTOs and validation schemas structured in `src/types/product.ts` and `src/schemas/product.ts`.
- `estoqueMinimo` handled at service/DTO level (default 5 units) without requiring non-backward-compatible database schema migrations.
- Lot intake supports automatic sequential unit code generation (`${numeroLote}-001`, etc.) or custom serial barcodes.
- Clinical unit selection endpoint `/api/stock/units` actively filters out expired lots and cross-client reusable units.
- Scenario C in `scenarios_a_through_e.spec.ts` upgraded to call `StockService.recordUsage()` directly.

## Artifact Index
- `DISPATCH.md` — record of initial dispatch message
- `BRIEFING.md` — working memory and situational awareness
- `progress.md` — liveness heartbeat
- `handoff.md` — comprehensive turnkey technical specification and implementation handoff report
