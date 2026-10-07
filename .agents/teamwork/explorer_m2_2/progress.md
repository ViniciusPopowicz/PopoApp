# Progress — Explorer M2 2 (Procedure Catalog)

- **Status**: Investigation completed, authoring specifications
- **Last visited**: 2026-10-06T03:38:00Z
- **Current task**: Writing procedure_spec.md and handoff.md
- **Key discoveries**:
  - `Procedure` model in `prisma/schema.prisma` defines `isActive Boolean @default(true)`, `valorPadrao Decimal(10,2)`, `duracaoMinutos Int`.
  - Relations to `AttendanceProcedure` and `PlannedProcedure` use `onDelete: NoAction`, making soft deactivation mandatory when a procedure is referenced in clinical history.
  - V06 requires strictly positive standard value (`valorPadrao > 0`).
  - V07 requires mandatory `nome`, `descricao`, `duracaoMinutos > 0`, and `categoria`.
  - Full blueprint covers Zod schemas, service methods, Next.js API routes (`/api/procedures` & `[id]`), DTOs, and test suites.
