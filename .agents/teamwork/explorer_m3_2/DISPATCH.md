## 2026-10-16T00:57:57Z

You are explorer_m3_2, an exploration agent for PopoApp Milestone 3 (Products, Lots & Stock Unit Traceability).
Your working directory is: c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m3_2
Project root: c:\Users\Vinicius\PopoApp\PopoApp
Parent conversation ID: 07a8cd7d-13bd-4863-aa7f-f890fa8d06c8

MANDATORY FIRST STEP: Read the full binding user requirements at:
c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\ORIGINAL_REQUEST.md

Also read:
- c:\Users\Vinicius\PopoApp\PopoApp\PROJECT.md
- c:\Users\Vinicius\PopoApp\PopoApp\POPOAPP_DEVELOPMENT_SPEC.md (§13–§17, §31, §32 V15–V18, AC 59, AC 66)
- c:\Users\Vinicius\PopoApp\PopoApp\prisma\schema.prisma (models Product, Lot, IndividualStockUnit, ProductUsage)

Your Mission:
Investigate and produce a complete, turnkey implementation specification for the Product, Lot, and Stock Unit domain services and API routes:
1. Product & Lot Management:
   - Product catalog with name, description, unit of measure, minimum stock threshold, reusable flag.
   - Lot intake with batch number, expiration date, cost, acquisition date, initial quantity.
   - Unit generation: generating `IndividualStockUnit` rows for each lot with unique identifier/barcode.
   - Validation V15: expired lots cannot be dispensed or used.
2. Physical Unit Traceability & Usage Rules (Crucial AC 59 & AC 66):
   - Single-use unit: can only be used once. Attempting a second usage must be strictly rejected (V18).
   - Reusable unit: can be reused, but ONLY for the same client (V16).
   - Cross-client reuse of a physical unit MUST be strictly blocked server-side and in the database, even if UI is bypassed (V17, AC 59, AC 66).
3. Concrete deliverables:
   - Method signatures, types, and Prisma queries for `ProductService` (`src/services/product.service.ts`) and `StockService` (`src/services/stock.service.ts`).
   - Zod schemas in `src/schemas/product.ts`.
   - API route handlers in `src/app/api/products/*`.
   - Test specifications verifying V15, V16, V17 (cross-client blocked), V18 (single-use blocked), AC 59, AC 66.

DO NOT write code to production source files. Write your structured technical design to:
`c:\Users\Vinicius\PopoApp\PopoApp\.agents\teamwork\explorer_m3_2\handoff.md`

When complete, send a message to parent (07a8cd7d-13bd-4863-aa7f-f890fa8d06c8).
