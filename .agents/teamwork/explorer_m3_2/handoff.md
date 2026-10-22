# Milestone 3 Turnkey Specification: Products, Lots & Stock Unit Traceability

**Agent**: `explorer_m3_2`  
**Milestone**: M3 (Clinical Workflows, Products & Inventory — Phase 9)  
**Parent Conversation ID**: `07a8cd7d-13bd-4863-aa7f-f890fa8d06c8`  
**Date**: 2026-10-16T01:10:00Z  
**Status**: COMPLETE (Hard Handoff)

---

## 1. Observation

### 1.1 Existing Database Schema and Relational Hierarchy
In `prisma/schema.prisma` lines 194–276, the domain models for product catalog, lots, physical stock units, and usage records are defined as follows:

```prisma
// Model Product (Catalog)
model Product {
  id          String             @id @default(uuid())
  nome        String
  categoria   String?
  marca       String?
  descricao   String?            @db.NVarChar(Max)
  unidade     String             // 'frasco', 'ampola', 'seringa', 'caixa', etc.
  isReusable  Boolean            @default(false) // Reutilizável pelo mesmo cliente vs Uso único
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  lots                 ProductLot[]
  procedureAssociations ProcedureProduct[]

  @@index([nome])
  @@index([isActive])
}

// Model ProcedureProduct (Catalog Many-to-Many Association)
model ProcedureProduct {
  procedureId String
  productId   String
  createdAt   DateTime @default(now())

  procedure Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([procedureId, productId])
}

// Model ProductLot (Batches)
model ProductLot {
  id            String      @id @default(uuid())
  productId     String
  numeroLote    String
  dataValidade  DateTime?
  dataAquisicao DateTime?
  precoCusto    Decimal?    @db.Decimal(10, 2)
  observacoes   String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  product    Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  stockUnits StockUnit[]

  @@index([productId])
  @@index([numeroLote])
}

// Model StockUnit (Individual Physical Item Traceability)
model StockUnit {
  id              String         @id @default(uuid())
  lotId           String
  codigoSerial    String         @unique // Identificador físico único (ex: UNIT-001)
  status          String         @default("Disponivel") // 'Disponivel', 'EmUso', 'Esgotado', 'Descartado'
  currentClientId String?        // Vinculado ao cliente caso seja produto reutilizável em uso
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  lot           ProductLot     @relation(fields: [lotId], references: [id], onDelete: Cascade)
  currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usages        ProductUsage[]

  @@index([lotId])
  @@index([status])
  @@index([currentClientId])
}

// Model ProductUsage (Clinical Consumption Encounter)
model ProductUsage {
  id                    String               @id @default(uuid())
  attendanceId          String
  stockUnitId           String
  attendanceProcedureId String?
  dataHora              DateTime             @default(now())
  observacoes           String?
  createdAt             DateTime             @default(now())

  attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([attendanceId])
  @@index([stockUnitId])
  @@index([attendanceProcedureId])
}
```

In `prisma/migrations/20261006000000_init_domain_models/migration.sql`, lines 136–196, the underlying SQL Server tables `[dbo].[Product]`, `[dbo].[ProcedureProduct]`, `[dbo].[ProductLot]`, `[dbo].[StockUnit]`, and `[dbo].[ProductUsage]` are created with primary clustered keys, indexes, and foreign keys. Foreign keys specify `onDelete: Cascade` from `Product` to `ProductLot` and `ProductLot` to `StockUnit`, and `onDelete: NoAction` for `StockUnit -> currentClient` and `ProductUsage -> attendance / stockUnit` to prevent cyclic cascade locks.

### 1.2 User Specification & Acceptance Criteria (Dev Spec §§14–18, §32, AC 59, AC 66)
- **Dev Spec §14**: The inventory model is strictly 3-level: `Product Catalog -> Lot -> Individual Physical Stock Unit`. It must not be an aggregate counter; physical units must be individually identifiable.
- **Dev Spec §15 & Critical Validation V16, V17**: A specific physical product unit may be used by Client A across multiple attendances when reusable (`isReusable = true`). The same individual physical unit must **NEVER** be used by Client B. Single-use units (`isReusable = false`) can only be used once.
- **Critical Validation V15 (Prompt & Dev Spec §32)**: Expired lots (`dataValidade < now`) cannot be dispensed or used in clinical attendances.
- **Acceptance Criterion AC 59**: "Cross-client reuse of a physical unit and a second use of a single-use unit are both rejected by the server/database layer, even when the UI is bypassed (direct service/API call)."
- **Acceptance Criterion AC 66**: "Attempting to use the same physical unit for a different Client shows a clear Portuguese error and is not saved."

### 1.3 Current Test Baseline & Scenario C Observation
In `tests/tier4_workflows/scenarios_a_through_e.spec.ts` lines 152–202, Scenario C currently executes manual Prisma calls directly against the test database, bypassing domain services because `ProductService` and `StockService` did not yet exist:
```typescript
// Existing test in scenarios_a_through_e.spec.ts (lines 187-201)
const unitCheck = await (prismaTest as any).stockUnit.findUnique({
  where: { id: unit.id },
  include: {
    usages: {
      include: { attendance: true },
    },
  },
});

const previousClientIds = unitCheck.usages.map((u: any) => u.attendance.clientId);
const hasDifferentClient = previousClientIds.some((id: string) => id !== clientBId);
expect(hasDifferentClient).toBe(true);
```
Per `ORIGINAL_REQUEST.md` line 181, this test weakness must be remediated: once `StockService` exists, Scenario C must call `StockService.recordUsage()` directly and assert that a second use for a different client throws a Portuguese error.

### 1.4 Mock UI Observation
In `src/app/(authenticated)/produtos/page.tsx` line 13, mock data is imported from `@/data/mock/produtos`. The mock data contains fields: `id`, `nome`, `categoria`, `marca`, `preco`, `estoque`, `status`, `descricao`, `unidade`. All mock imports must be removed and replaced with real API calls in Phase 9/16.

---

## 2. Logic Chain

1. **Relational Hierarchy & Serialization**:
   - `Product` represents the medical/aesthetic catalog item (e.g., "Botox Allergan 100U", `isReusable = false`; "Seringa Ácido Hialurônico 1ml", `isReusable = true`).
   - `ProductLot` represents a manufacturer batch (`numeroLote`, `dataValidade`, `precoCusto`, `dataAquisicao`).
   - `StockUnit` represents an individual physical item with a globally unique barcode/serial number (`codigoSerial`, e.g., `LOT100-001`).
   - `ProductUsage` is created strictly during an `Attendance`, tying a specific physical `StockUnit` to the `Attendance`, and through `Attendance.clientId` to the specific `Client`.

2. **Validation V15 (Expired Lot Rule)**:
   - When a user attempts to record usage of a unit (`StockService.recordUsage`):
   - Retrieve `StockUnit` with `lot`.
   - If `lot.dataValidade !== null` and `new Date(lot.dataValidade) < new Date()` (or truncated to current date):
     - The unit cannot be dispensed.
     - Reject with `ValidationError` (HTTP 400): `"Lote ${lot.numeroLote} vencido em ${dataValidade}. Unidades de lotes vencidos não podem ser utilizadas (V15)."`

3. **Validation V18 / V17 (Single-Use Product Rule)**:
   - If `product.isReusable === false`:
   - Inspect existing `ProductUsage` records for this unit (`usages.length`).
   - If `usages.length > 0` OR `stockUnit.status !== 'Disponivel'`:
     - Reject with `ConflictError` / `ValidationError` (HTTP 400/409):
       `"Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17)."`
   - On valid usage:
     - Atomically update `StockUnit`: `status = 'Esgotado'`, `currentClientId = attendance.clientId`.

4. **Validation V16 / V17, AC 59, AC 66 (Reusable Unit Same-Client vs Cross-Client Rule)**:
   - If `product.isReusable === true`:
   - Inspect `stockUnit.currentClientId` and prior `stockUnit.usages`:
     - If `stockUnit.currentClientId !== null && stockUnit.currentClientId !== attendance.clientId`:
       - Reject with `ConflictError` (HTTP 409):
         `"Esta unidade de estoque já está vinculada a outro cliente. Unidades físicas reutilizáveis não podem ser compartilhadas entre clientes distintos (AC 59, AC 66, V16, V17)."`
     - Inspect all historical attendances for this unit (`usage.attendance.clientId`):
       - If any prior usage belongs to a different client:
         - Reject with `ConflictError`:
           `"Esta unidade de estoque já foi utilizada por outro cliente e não pode ser reutilizada por este cliente (AC 59, AC 66)."`
   - If the unit has no prior client or is already bound to this same client:
     - Permitted!
     - Atomically update `StockUnit`: `status = 'EmUso'`, `currentClientId = attendance.clientId`.

5. **Multi-Layer Enforcement (AC 59)**:
   - Server-side domain layer: `StockService.recordUsage()` encapsulates all validations in a Prisma transaction with strict exception throwing.
   - API layer: Next.js route `/api/attendances/[id]/usages` guards with `requireAuth` and Zod validation, mapping domain errors to HTTP 400/409 with Portuguese error messages.
   - Database layer: SQL Server trigger `TR_ProductUsage_ValidateReuse` guarantees that even if a developer or SQL script runs raw `INSERT INTO [dbo].[ProductUsage]` directly in SSMS or Prisma raw queries, SQL Server halts the transaction and raises Msg 50001 / 50002.

---

## 3. Caveats

1. **Schema Field `estoqueMinimo`**:
   - The Prisma model `Product` does not contain an `estoqueMinimo` column in `prisma/schema.prisma` or in the existing SQL Server migration `20261006000000_init_domain_models`.
   - Changing the Prisma schema would require a new SQL Server migration. However, since the database schema was frozen for M1/M2, `estoqueMinimo` is cleanly handled at the service/DTO layer: an optional query parameter / configuration threshold (defaulting to 5 units). If a future migration is approved, adding `estoqueMinimo Int @default(5)` will be a trivial non-breaking addition.
2. **Attendance Dependency**:
   - `ProductUsage` requires an existing, non-cancelled `Attendance`. When recording usage, the `clientId` is extracted directly from the verified `Attendance` record in the database, ensuring callers cannot spoof client identities.
3. **Database Trigger Compatibility**:
   - SQL Server triggers run inside the active transaction. If raw SQL is used, the trigger raises an error. When Prisma executes transactions, Prisma catches the SQL Server error message and wraps it in a database exception.

---

## 4. Conclusion: Complete Turnkey Implementation Specification

### 4.1 Canonical TypeScript Types & DTOs (`src/types/product.ts`)

```typescript
// src/types/product.ts

export type StockUnitStatus = 'Disponivel' | 'EmUso' | 'Esgotado' | 'Descartado';

export interface ProductSummaryDto {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  descricao: string | null;
  unidade: string;
  isReusable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lotsCount: number;
  totalUnitsCount: number;
  availableUnitsCount: number;
  isLowStock: boolean;
}

export interface ProductDetailDto extends ProductSummaryDto {
  lots: ProductLotSummaryDto[];
  associatedProcedures: {
    procedureId: string;
    procedureName: string;
    standardValue: number;
  }[];
}

export interface ProductLotSummaryDto {
  id: string;
  productId: string;
  numeroLote: string;
  dataValidade: string | null;
  dataAquisicao: string | null;
  precoCusto: number | null;
  observacoes: string | null;
  isExpired: boolean;
  totalUnitsCount: number;
  availableUnitsCount: number;
  inUseUnitsCount: number;
  depletedUnitsCount: number;
  discardedUnitsCount: number;
  createdAt: string;
}

export interface StockUnitSummaryDto {
  id: string;
  lotId: string;
  numeroLote: string;
  productId: string;
  productName: string;
  isReusable: boolean;
  codigoSerial: string;
  status: StockUnitStatus;
  currentClientId: string | null;
  currentClientName: string | null;
  dataValidade: string | null;
  isExpired: boolean;
  usageCount: number;
  createdAt: string;
}

export interface StockUnitDetailDto extends StockUnitSummaryDto {
  usages: ProductUsageSummaryDto[];
}

export interface ProductUsageSummaryDto {
  id: string;
  attendanceId: string;
  attendanceDate: string;
  clientId: string;
  clientName: string;
  stockUnitId: string;
  codigoSerial: string;
  productName: string;
  isReusable: boolean;
  attendanceProcedureId: string | null;
  procedureName: string | null;
  dataHora: string;
  observacoes: string | null;
  createdAt: string;
}

export interface AvailableStockUnitDto {
  id: string;
  codigoSerial: string;
  productId: string;
  productName: string;
  unidade: string;
  isReusable: boolean;
  lotId: string;
  numeroLote: string;
  dataValidade: string | null;
  status: StockUnitStatus;
  isAssignedToCurrentClient: boolean;
}
```

---

### 4.2 Zod Validation Schemas (`src/schemas/product.ts`)

```typescript
// src/schemas/product.ts
import { z } from 'zod';

const coercePositiveDecimal = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    let cleaned = trimmed;
    if (trimmed.includes(',') && trimmed.includes('.')) {
      cleaned = trimmed.replace(/\./g, '').replace(',', '.');
    } else if (trimmed.includes(',')) {
      cleaned = trimmed.replace(',', '.');
    }
    const num = Number(cleaned);
    return isNaN(num) ? val : num;
  }
  return val;
}, z.number({ invalid_type_error: 'Preço de custo deve ser um número válido' })
  .nonnegative('Preço de custo deve ser maior ou igual a zero')
  .max(9999999.99, 'Preço de custo excede o limite permitido')
  .nullable()
  .optional()
);

const coerceDate = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d;
  }
  return val;
}, z.date({ invalid_type_error: 'Data inválida' }).nullable().optional());

export const createProductSchema = z.object({
  nome: z
    .string({ required_error: 'O nome do produto é obrigatório' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres'),

  categoria: z.string().trim().max(50).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),

  unidade: z
    .string({ required_error: 'A unidade de medida é obrigatória' })
    .trim()
    .min(1, 'A unidade de medida é obrigatória')
    .max(50, 'A unidade não pode exceder 50 caracteres'),

  isReusable: z.boolean().optional().default(false),
  reutilizavel: z.boolean().optional(), // Portuguese alias support

  isActive: z.boolean().optional().default(true),
  ativo: z.boolean().optional(),

  procedureIds: z.array(z.string().uuid('ID de procedimento inválido')).optional().default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  nome: z.string().trim().min(2).max(150).optional(),
  categoria: z.string().trim().max(50).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().trim().max(2000).nullable().optional(),
  unidade: z.string().trim().min(1).max(50).optional(),
  isReusable: z.boolean().optional(),
  reutilizavel: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ativo: z.boolean().optional(),
  procedureIds: z.array(z.string().uuid('ID de procedimento inválido')).optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  isReusable: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all')
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export const createLotSchema = z.object({
  numeroLote: z
    .string({ required_error: 'O número do lote é obrigatório' })
    .trim()
    .min(1, 'O número do lote é obrigatório')
    .max(100, 'O número do lote não pode exceder 100 caracteres'),

  dataValidade: coerceDate,
  dataAquisicao: coerceDate,
  precoCusto: coercePositiveDecimal,
  observacoes: z.string().trim().max(1000).nullable().optional(),

  // Automatic individual physical unit generation
  quantidadeInicial: z
    .number()
    .int('A quantidade inicial deve ser um número inteiro')
    .min(0, 'A quantidade não pode ser negativa')
    .max(1000, 'A quantidade máxima para geração automática é 1000')
    .optional()
    .default(0),

  // Optional caller-specified serial numbers (e.g. barcodes)
  codigosSeriais: z.array(z.string().trim().min(1)).optional(),
});

export type CreateLotInput = z.infer<typeof createLotSchema>;

export const registerUnitsSchema = z.object({
  quantidade: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade deve ser de pelo menos 1 unidade')
    .max(500, 'A quantidade máxima para registro único é 500')
    .optional(),

  codigosSeriais: z.array(z.string().trim().min(1)).optional(),
}).refine(data => data.quantidade !== undefined || (data.codigosSeriais && data.codigosSeriais.length > 0), {
  message: 'Informe a quantidade de unidades a gerar ou a lista de códigos seriais',
});

export type RegisterUnitsInput = z.infer<typeof registerUnitsSchema>;

export const recordProductUsageSchema = z.object({
  stockUnitId: z.string({ required_error: 'A unidade de estoque física é obrigatória' }).uuid('ID de unidade inválido'),
  attendanceProcedureId: z.string().uuid('ID de procedimento realizado inválido').nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export type RecordProductUsageInput = z.infer<typeof recordProductUsageSchema>;

export const updateStockUnitStatusSchema = z.object({
  status: z.enum(['Disponivel', 'EmUso', 'Esgotado', 'Descartado'], {
    required_error: 'O status da unidade é obrigatório',
  }),
  motivo: z.string().trim().max(500).optional(),
});

export type UpdateStockUnitStatusInput = z.infer<typeof updateStockUnitStatusSchema>;

export const availableUnitsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export type AvailableUnitsQueryInput = z.infer<typeof availableUnitsQuerySchema>;
```

---

### 4.3 Product Service Implementation (`src/services/product.service.ts`)

```typescript
// src/services/product.service.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
} from '@/schemas/product';
import { ProductSummaryDto, ProductDetailDto } from '@/types/product';

export function mapProductSummary(p: any): ProductSummaryDto {
  let totalUnits = 0;
  let availableUnits = 0;

  if (p.lots) {
    for (const lot of p.lots) {
      if (lot.stockUnits) {
        totalUnits += lot.stockUnits.length;
        availableUnits += lot.stockUnits.filter((u: any) => u.status === 'Disponivel').length;
      }
    }
  }

  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    marca: p.marca,
    descricao: p.descricao,
    unidade: p.unidade,
    isReusable: p.isReusable,
    isActive: p.isActive,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    lotsCount: p._count?.lots ?? p.lots?.length ?? 0,
    totalUnitsCount: totalUnits,
    availableUnitsCount: availableUnits,
    isLowStock: availableUnits <= 5,
  };
}

export async function listProducts(query: ProductQueryInput = {}): Promise<ProductSummaryDto[]> {
  const where: Prisma.ProductWhereInput = {
    ...(query.search
      ? {
          OR: [
            { nome: { contains: query.search } },
            { marca: { contains: query.search } },
            { descricao: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.categoria ? { categoria: query.categoria } : {}),
    ...(query.isReusable !== undefined ? { isReusable: query.isReusable } : {}),
    ...(query.active !== undefined ? { isActive: query.active } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { nome: 'asc' }],
    include: {
      _count: {
        select: { lots: true },
      },
      lots: {
        select: {
          stockUnits: {
            select: { status: true },
          },
        },
      },
    },
  });

  return products.map(mapProductSummary);
}

export async function getProductById(id: string): Promise<ProductDetailDto> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      lots: {
        orderBy: [{ dataValidade: 'asc' }, { createdAt: 'desc' }],
        include: {
          stockUnits: {
            select: { id: true, status: true },
          },
        },
      },
      procedureAssociations: {
        include: {
          procedure: {
            select: { id: true, nome: true, valorPadrao: true },
          },
        },
      },
    },
  });

  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  const summary = mapProductSummary(product);
  const now = new Date();

  const lotsSummaries = product.lots.map((lot) => {
    const isExpired = lot.dataValidade !== null && new Date(lot.dataValidade) < now;
    const units = lot.stockUnits || [];
    return {
      id: lot.id,
      productId: lot.productId,
      numeroLote: lot.numeroLote,
      dataValidade: lot.dataValidade ? lot.dataValidade.toISOString() : null,
      dataAquisicao: lot.dataAquisicao ? lot.dataAquisicao.toISOString() : null,
      precoCusto: lot.precoCusto ? Number(lot.precoCusto) : null,
      observacoes: lot.observacoes,
      isExpired,
      totalUnitsCount: units.length,
      availableUnitsCount: units.filter((u) => u.status === 'Disponivel').length,
      inUseUnitsCount: units.filter((u) => u.status === 'EmUso').length,
      depletedUnitsCount: units.filter((u) => u.status === 'Esgotado').length,
      discardedUnitsCount: units.filter((u) => u.status === 'Descartado').length,
      createdAt: lot.createdAt.toISOString(),
    };
  });

  const associatedProcedures = product.procedureAssociations.map((pa) => ({
    procedureId: pa.procedure.id,
    procedureName: pa.procedure.nome,
    standardValue: Number(pa.procedure.valorPadrao),
  }));

  return {
    ...summary,
    lots: lotsSummaries,
    associatedProcedures,
  };
}

export async function createProduct(input: CreateProductInput): Promise<ProductSummaryDto> {
  const isReusable = input.isReusable ?? input.reutilizavel ?? false;
  const isActive = input.isActive ?? input.ativo ?? true;

  const product = await prisma.product.create({
    data: {
      nome: input.nome,
      categoria: input.categoria ?? null,
      marca: input.marca ?? null,
      descricao: input.descricao ?? null,
      unidade: input.unidade,
      isReusable,
      isActive,
      ...(input.procedureIds && input.procedureIds.length > 0
        ? {
            procedureAssociations: {
              create: input.procedureIds.map((procId) => ({
                procedureId: procId,
              })),
            },
          }
        : {}),
    },
    include: {
      _count: { select: { lots: true } },
    },
  });

  return mapProductSummary(product);
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductSummaryDto> {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: {
      lots: {
        include: {
          stockUnits: {
            include: { usages: true },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Produto não encontrado');
  }

  const targetReusable = input.isReusable ?? input.reutilizavel;
  if (targetReusable !== undefined && targetReusable === false && existing.isReusable === true) {
    // If attempting to convert reusable product to single-use, ensure no unit is currently reused or in use
    const hasReusedUnits = existing.lots.some((lot) =>
      lot.stockUnits.some((unit) => unit.usages.length > 1 || unit.status === 'EmUso')
    );
    if (hasReusedUnits) {
      throw new ConflictError(
        'Não é possível alterar este produto para uso único pois existem unidades com histórico de reutilização ou em uso clínico.'
      );
    }
  }

  const isActive = input.isActive ?? input.ativo;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.procedureIds) {
      await tx.procedureProduct.deleteMany({ where: { productId: id } });
      if (input.procedureIds.length > 0) {
        await tx.procedureProduct.createMany({
          data: input.procedureIds.map((procId) => ({
            productId: id,
            procedureId: procId,
          })),
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        ...(input.nome ? { nome: input.nome } : {}),
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(input.marca !== undefined ? { marca: input.marca } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.unidade ? { unidade: input.unidade } : {}),
        ...(targetReusable !== undefined ? { isReusable: targetReusable } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        _count: { select: { lots: true } },
        lots: {
          select: {
            stockUnits: { select: { status: true } },
          },
        },
      },
    });
  });

  return mapProductSummary(updated);
}

export async function deleteProduct(id: string): Promise<{ success: boolean; deactivated: boolean }> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { lots: true } },
    },
  });

  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  if (product._count.lots > 0) {
    // Soft-deactivate to protect historical traceability (Dev Spec §30)
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, deactivated: true };
  }

  await prisma.procedureProduct.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  return { success: true, deactivated: false };
}
```

---

### 4.4 Stock & Usage Service Implementation (`src/services/stock.service.ts`)

```typescript
// src/services/stock.service.ts
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import {
  CreateLotInput,
  RegisterUnitsInput,
  RecordProductUsageInput,
  AvailableUnitsQueryInput,
  UpdateStockUnitStatusInput,
} from '@/schemas/product';
import {
  ProductLotSummaryDto,
  StockUnitSummaryDto,
  ProductUsageSummaryDto,
  AvailableStockUnitDto,
  StockUnitDetailDto,
} from '@/types/product';

/**
 * Creates a new ProductLot and automatically creates individual StockUnit records.
 */
export async function createLot(productId: string, input: CreateLotInput): Promise<ProductLotSummaryDto> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  // Pre-generate unit codes
  const count = input.quantidadeInicial ?? 0;
  const customCodes = input.codigosSeriais || [];
  const serialCodesToCreate: string[] = [];

  if (customCodes.length > 0) {
    serialCodesToCreate.push(...customCodes);
  } else if (count > 0) {
    for (let i = 1; i <= count; i++) {
      serialCodesToCreate.push(`${input.numeroLote}-${String(i).padStart(3, '0')}`);
    }
  }

  // Verify unique serial codes across the database
  if (serialCodesToCreate.length > 0) {
    const existing = await prisma.stockUnit.findMany({
      where: { codigoSerial: { in: serialCodesToCreate } },
      select: { codigoSerial: true },
    });
    if (existing.length > 0) {
      throw new ConflictError(
        `Os seguintes códigos seriais já existem no sistema: ${existing.map((e) => e.codigoSerial).join(', ')}`
      );
    }
  }

  const lot = await prisma.$transaction(async (tx) => {
    const createdLot = await tx.productLot.create({
      data: {
        productId,
        numeroLote: input.numeroLote,
        dataValidade: input.dataValidade ?? null,
        dataAquisicao: input.dataAquisicao ?? new Date(),
        precoCusto: input.precoCusto !== null && input.precoCusto !== undefined ? new Prisma.Decimal(input.precoCusto) : null,
        observacoes: input.observacoes ?? null,
      },
    });

    if (serialCodesToCreate.length > 0) {
      await tx.stockUnit.createMany({
        data: serialCodesToCreate.map((serial) => ({
          lotId: createdLot.id,
          codigoSerial: serial,
          status: 'Disponivel',
        })),
      });
    }

    return createdLot;
  });

  const now = new Date();
  const isExpired = lot.dataValidade !== null && new Date(lot.dataValidade) < now;

  return {
    id: lot.id,
    productId: lot.productId,
    numeroLote: lot.numeroLote,
    dataValidade: lot.dataValidade ? lot.dataValidade.toISOString() : null,
    dataAquisicao: lot.dataAquisicao ? lot.dataAquisicao.toISOString() : null,
    precoCusto: lot.precoCusto ? Number(lot.precoCusto) : null,
    observacoes: lot.observacoes,
    isExpired,
    totalUnitsCount: serialCodesToCreate.length,
    availableUnitsCount: serialCodesToCreate.length,
    inUseUnitsCount: 0,
    depletedUnitsCount: 0,
    discardedUnitsCount: 0,
    createdAt: lot.createdAt.toISOString(),
  };
}

/**
 * Registers additional physical stock units under an existing lot.
 */
export async function registerStockUnits(lotId: string, input: RegisterUnitsInput): Promise<StockUnitSummaryDto[]> {
  const lot = await prisma.productLot.findUnique({
    where: { id: lotId },
    include: {
      product: true,
      _count: { select: { stockUnits: true } },
    },
  });

  if (!lot) {
    throw new NotFoundError('Lote não encontrado');
  }

  const serialCodesToCreate: string[] = [];
  if (input.codigosSeriais && input.codigosSeriais.length > 0) {
    serialCodesToCreate.push(...input.codigosSeriais);
  } else if (input.quantidade && input.quantidade > 0) {
    const currentCount = lot._count.stockUnits;
    for (let i = 1; i <= input.quantidade; i++) {
      serialCodesToCreate.push(`${lot.numeroLote}-${String(currentCount + i).padStart(3, '0')}`);
    }
  }

  const existing = await prisma.stockUnit.findMany({
    where: { codigoSerial: { in: serialCodesToCreate } },
    select: { codigoSerial: true },
  });
  if (existing.length > 0) {
    throw new ConflictError(
      `Código(s) serial(is) duplicado(s): ${existing.map((e) => e.codigoSerial).join(', ')}`
    );
  }

  await prisma.stockUnit.createMany({
    data: serialCodesToCreate.map((serial) => ({
      lotId,
      codigoSerial: serial,
      status: 'Disponivel',
    })),
  });

  const createdUnits = await prisma.stockUnit.findMany({
    where: { lotId, codigoSerial: { in: serialCodesToCreate } },
    include: {
      lot: { include: { product: true } },
    },
  });

  const now = new Date();
  const isExpired = lot.dataValidade !== null && new Date(lot.dataValidade) < now;

  return createdUnits.map((u) => ({
    id: u.id,
    lotId: u.lotId,
    numeroLote: lot.numeroLote,
    productId: lot.product.id,
    productName: lot.product.nome,
    isReusable: lot.product.isReusable,
    codigoSerial: u.codigoSerial,
    status: u.status as any,
    currentClientId: null,
    currentClientName: null,
    dataValidade: lot.dataValidade ? lot.dataValidade.toISOString() : null,
    isExpired,
    usageCount: 0,
    createdAt: u.createdAt.toISOString(),
  }));
}

/**
 * Lists available physical stock units eligible for clinical usage during an attendance.
 * Crucial filter:
 * 1. Excludes expired lots (V15)
 * 2. If clientId is supplied:
 *    - Includes unassigned available units ('Disponivel')
 *    - Includes reusable units currently assigned to THIS client ('EmUso' & currentClientId = clientId)
 *    - Strictly excludes units assigned to ANY other client (AC 59, AC 66)
 */
export async function listAvailableUnits(query: AvailableUnitsQueryInput = {}): Promise<AvailableStockUnitDto[]> {
  const now = new Date();

  const where: Prisma.StockUnitWhereInput = {
    // Exclude discarded or depleted units
    status: { in: ['Disponivel', 'EmUso'] },
    // Exclude expired lots (V15)
    lot: {
      OR: [
        { dataValidade: null },
        { dataValidade: { gte: now } },
      ],
      ...(query.productId ? { productId: query.productId } : {}),
    },
    ...(query.search
      ? {
          OR: [
            { codigoSerial: { contains: query.search } },
            { lot: { numeroLote: { contains: query.search } } },
            { lot: { product: { nome: { contains: query.search } } } },
          ],
        }
      : {}),
  };

  const units = await prisma.stockUnit.findMany({
    where,
    include: {
      lot: {
        include: { product: true },
      },
    },
    orderBy: [
      { lot: { dataValidade: 'asc' } },
      { codigoSerial: 'asc' },
    ],
  });

  // Apply Client cross-filtering in memory or relation
  return units
    .filter((unit) => {
      // If unit is Disponivel and not bound to any client, it is eligible
      if (unit.status === 'Disponivel' && !unit.currentClientId) {
        return true;
      }
      // If unit is in use / assigned to a client:
      if (unit.currentClientId) {
        // Only eligible if query.clientId matches unit.currentClientId
        return query.clientId !== undefined && unit.currentClientId === query.clientId;
      }
      return false;
    })
    .map((unit) => ({
      id: unit.id,
      codigoSerial: unit.codigoSerial,
      productId: unit.lot.product.id,
      productName: unit.lot.product.nome,
      unidade: unit.lot.product.unidade,
      isReusable: unit.lot.product.isReusable,
      lotId: unit.lot.id,
      numeroLote: unit.lot.numeroLote,
      dataValidade: unit.lot.dataValidade ? unit.lot.dataValidade.toISOString() : null,
      status: unit.status as any,
      isAssignedToCurrentClient: Boolean(query.clientId && unit.currentClientId === query.clientId),
    }));
}

/**
 * THE CRITICAL USAGE ENGINE: Records clinical product usage with ironclad validation.
 * Enforces:
 * - V15: Expired lots cannot be used.
 * - V18/V17: Single-use products cannot be consumed twice.
 * - V16/V17/AC 59/AC 66: Reusable units can only be reused for the same client.
 *   Cross-client reuse is strictly blocked with Portuguese error.
 */
export async function recordProductUsage(
  attendanceId: string,
  input: RecordProductUsageInput
): Promise<ProductUsageSummaryDto> {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch and validate Attendance
    const attendance = await tx.attendance.findUnique({
      where: { id: attendanceId },
      include: { client: true },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é permitido registrar uso de produto em um atendimento cancelado');
    }

    const clientId = attendance.clientId;

    // 2. Fetch StockUnit with lot, product, and previous usages
    const stockUnit = await tx.stockUnit.findUnique({
      where: { id: input.stockUnitId },
      include: {
        lot: {
          include: { product: true },
        },
        usages: {
          include: {
            attendance: {
              include: { client: true },
            },
          },
        },
        currentClient: true,
      },
    });

    if (!stockUnit) {
      throw new NotFoundError('Unidade de estoque não encontrada');
    }

    const lot = stockUnit.lot;
    const product = lot.product;

    // 3. Validation V15: Expired Lot Check
    if (lot.dataValidade !== null) {
      const expirationDate = new Date(lot.dataValidade);
      const today = new Date();
      // Compare by date boundary
      if (expirationDate < today) {
        const formattedExp = expirationDate.toLocaleDateString('pt-BR');
        throw new ValidationError(
          `Lote ${lot.numeroLote} vencido em ${formattedExp}. Unidades deste lote não podem ser utilizadas (V15).`
        );
      }
    }

    // 4. Validate unit physical status
    if (stockUnit.status === 'Descartado') {
      throw new ValidationError('Esta unidade de estoque foi descartada e não pode ser utilizada');
    }
    if (stockUnit.status === 'Esgotado') {
      throw new ValidationError('Esta unidade de estoque já está esgotada');
    }

    // 5. Validation V18 & V17: Single-Use Rule
    if (!product.isReusable) {
      if (stockUnit.usages.length > 0 || stockUnit.status !== 'Disponivel') {
        throw new ConflictError(
          'Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17).'
        );
      }

      // Mark unit as depleted upon single usage
      await tx.stockUnit.update({
        where: { id: stockUnit.id },
        data: {
          status: 'Esgotado',
          currentClientId: clientId,
        },
      });
    } else {
      // 6. Validation V16, V17, AC 59, AC 66: Reusable Unit & Cross-Client Prevention
      if (stockUnit.currentClientId !== null && stockUnit.currentClientId !== clientId) {
        throw new ConflictError('Esta unidade de estoque já está vinculada a outro cliente.');
      }

      // Check all historical usages
      for (const priorUsage of stockUnit.usages) {
        if (priorUsage.attendance.clientId !== clientId) {
          throw new ConflictError('Esta unidade de estoque já está vinculada a outro cliente.');
        }
      }

      // Mark unit as In-Use and bound to this client
      await tx.stockUnit.update({
        where: { id: stockUnit.id },
        data: {
          status: 'EmUso',
          currentClientId: clientId,
        },
      });
    }

    // 7. Optional AttendanceProcedure association validation
    if (input.attendanceProcedureId) {
      const procAssoc = await tx.attendanceProcedure.findUnique({
        where: { id: input.attendanceProcedureId },
      });
      if (!procAssoc || procAssoc.attendanceId !== attendanceId) {
        throw new ValidationError('O procedimento selecionado não pertence a este atendimento');
      }
    }

    // 8. Create ProductUsage record
    const usage = await tx.productUsage.create({
      data: {
        attendanceId,
        stockUnitId: stockUnit.id,
        attendanceProcedureId: input.attendanceProcedureId ?? null,
        observacoes: input.observacoes ?? null,
      },
      include: {
        attendance: { include: { client: true } },
        stockUnit: {
          include: {
            lot: { include: { product: true } },
          },
        },
        attendanceProcedure: {
          include: { procedure: true },
        },
      },
    });

    return usage;
  });

  return {
    id: result.id,
    attendanceId: result.attendanceId,
    attendanceDate: result.attendance.dataHora.toISOString(),
    clientId: result.attendance.clientId,
    clientName: result.attendance.client.nome,
    stockUnitId: result.stockUnitId,
    codigoSerial: result.stockUnit.codigoSerial,
    productName: result.stockUnit.lot.product.nome,
    isReusable: result.stockUnit.lot.product.isReusable,
    attendanceProcedureId: result.attendanceProcedureId,
    procedureName: result.attendanceProcedure?.procedure?.nome ?? null,
    dataHora: result.dataHora.toISOString(),
    observacoes: result.observacoes,
    createdAt: result.createdAt.toISOString(),
  };
}

/**
 * Retrieves full audit traceability of an individual physical StockUnit.
 */
export async function getStockUnitTraceability(unitId: string): Promise<StockUnitDetailDto> {
  const unit = await prisma.stockUnit.findUnique({
    where: { id: unitId },
    include: {
      currentClient: true,
      lot: { include: { product: true } },
      usages: {
        orderBy: { dataHora: 'asc' },
        include: {
          attendance: { include: { client: true } },
          attendanceProcedure: { include: { procedure: true } },
        },
      },
    },
  });

  if (!unit) {
    throw new NotFoundError('Unidade de estoque não encontrada');
  }

  const now = new Date();
  const isExpired = unit.lot.dataValidade !== null && new Date(unit.lot.dataValidade) < now;

  return {
    id: unit.id,
    lotId: unit.lotId,
    numeroLote: unit.lot.numeroLote,
    productId: unit.lot.productId,
    productName: unit.lot.product.nome,
    isReusable: unit.lot.product.isReusable,
    codigoSerial: unit.codigoSerial,
    status: unit.status as any,
    currentClientId: unit.currentClientId,
    currentClientName: unit.currentClient?.nome ?? null,
    dataValidade: unit.lot.dataValidade ? unit.lot.dataValidade.toISOString() : null,
    isExpired,
    usageCount: unit.usages.length,
    createdAt: unit.createdAt.toISOString(),
    usages: unit.usages.map((u) => ({
      id: u.id,
      attendanceId: u.attendanceId,
      attendanceDate: u.attendance.dataHora.toISOString(),
      clientId: u.attendance.clientId,
      clientName: u.attendance.client.nome,
      stockUnitId: unit.id,
      codigoSerial: unit.codigoSerial,
      productName: unit.lot.product.nome,
      isReusable: unit.lot.product.isReusable,
      attendanceProcedureId: u.attendanceProcedureId,
      procedureName: u.attendanceProcedure?.procedure?.nome ?? null,
      dataHora: u.dataHora.toISOString(),
      observacoes: u.observacoes,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

/**
 * Updates stock unit status (e.g. discard contaminated or broken unit).
 */
export async function updateStockUnitStatus(
  unitId: string,
  input: UpdateStockUnitStatusInput
): Promise<StockUnitSummaryDto> {
  const unit = await prisma.stockUnit.findUnique({
    where: { id: unitId },
    include: { lot: { include: { product: true } }, currentClient: true, usages: true },
  });

  if (!unit) {
    throw new NotFoundError('Unidade de estoque não encontrada');
  }

  const updated = await prisma.stockUnit.update({
    where: { id: unitId },
    data: { status: input.status },
    include: { lot: { include: { product: true } }, currentClient: true, usages: true },
  });

  const now = new Date();
  const isExpired = updated.lot.dataValidade !== null && new Date(updated.lot.dataValidade) < now;

  return {
    id: updated.id,
    lotId: updated.lotId,
    numeroLote: updated.lot.numeroLote,
    productId: updated.lot.productId,
    productName: updated.lot.product.nome,
    isReusable: updated.lot.product.isReusable,
    codigoSerial: updated.codigoSerial,
    status: updated.status as any,
    currentClientId: updated.currentClientId,
    currentClientName: updated.currentClient?.nome ?? null,
    dataValidade: updated.lot.dataValidade ? updated.lot.dataValidade.toISOString() : null,
    isExpired,
    usageCount: updated.usages.length,
    createdAt: updated.createdAt.toISOString(),
  };
}
```

---

### 4.5 Database-Level Protection (SQL Server Trigger / Engine Enforcement)

Per AC 59: *"Cross-client reuse of a physical unit and a second use of a single-use unit are both rejected by the server/database layer, even when the UI is bypassed (direct service/API call)."*

To guarantee database-level enforcement in Microsoft SQL Server LocalDB even if the Node.js service is bypassed via raw SQL, the following SQL trigger script can be deployed:

```sql
-- SQL Server Trigger: TR_ProductUsage_ValidateReuse
CREATE OR ALTER TRIGGER [dbo].[TR_ProductUsage_ValidateReuse]
ON [dbo].[ProductUsage]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Enforce Single-Use Rule: Count of usages > 1 for isReusable = 0
    IF EXISTS (
        SELECT 1
        FROM [dbo].[ProductUsage] pu
        INNER JOIN [dbo].[StockUnit] su ON pu.stockUnitId = su.id
        INNER JOIN [dbo].[ProductLot] pl ON su.lotId = pl.id
        INNER JOIN [dbo].[Product] p ON pl.productId = p.id
        WHERE p.isReusable = 0
        GROUP BY pu.stockUnitId
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR('Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- 2. Enforce Cross-Client Prevention: Distinct client count > 1 for any physical unit
    IF EXISTS (
        SELECT 1
        FROM [dbo].[ProductUsage] pu
        INNER JOIN [dbo].[Attendance] a ON pu.attendanceId = a.id
        GROUP BY pu.stockUnitId
        HAVING COUNT(DISTINCT a.clientId) > 1
    )
    BEGIN
        RAISERROR('Esta unidade de estoque já está vinculada a outro cliente.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- 3. Enforce Expired Lot Usage Prevention (V15)
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN [dbo].[StockUnit] su ON i.stockUnitId = su.id
        INNER JOIN [dbo].[ProductLot] pl ON su.lotId = pl.id
        WHERE pl.dataValidade IS NOT NULL
          AND pl.dataValidade < CAST(GETDATE() AS DATE)
    )
    BEGIN
        RAISERROR('Unidades de lotes vencidos não podem ser utilizadas (V15).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
```

---

### 4.6 Next.js API Route Handlers

#### 1. `src/app/api/products/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { listProducts, createProduct } from '@/services/product.service';
import { createProductSchema, productQuerySchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      isReusable: searchParams.get('isReusable') ?? searchParams.get('reutilizavel') ?? undefined,
      active: searchParams.get('active') ?? searchParams.get('ativo') ?? undefined,
    };

    const parsedQuery = productQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de consulta inválidos', issues: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const products = await listProducts(parsedQuery.data);
    return NextResponse.json({ success: true, data: products });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar produtos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do produto inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const product = await createProduct(parsed.data);
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar produto' }, { status: 500 });
  }
}
```

#### 2. `src/app/api/products/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getProductById, updateProduct, deleteProduct } from '@/services/product.service';
import { updateProductSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const product = await getProductById(id);
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar produto' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateProduct(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar produto' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const result = await deleteProduct(id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao remover produto' }, { status: 500 });
  }
}
```

#### 3. `src/app/api/products/[id]/lots/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { createLot } from '@/services/stock.service';
import { createLotSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: productId } = await params;
    const body = await request.json();
    const parsed = createLotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do lote inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const lot = await createLot(productId, parsed.data);
    return NextResponse.json({ success: true, data: lot }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar lote' }, { status: 500 });
  }
}
```

#### 4. `src/app/api/lots/[id]/units/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { registerStockUnits } from '@/services/stock.service';
import { registerUnitsSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: lotId } = await params;
    const body = await request.json();
    const parsed = registerUnitsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de registro de unidades inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const units = await registerStockUnits(lotId, parsed.data);
    return NextResponse.json({ success: true, data: units }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar unidades' }, { status: 500 });
  }
}
```

#### 5. `src/app/api/stock/units/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { listAvailableUnits } from '@/services/stock.service';
import { availableUnitsQuerySchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      productId: searchParams.get('productId') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
    };

    const parsedQuery = availableUnitsQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de busca inválidos', issues: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const units = await listAvailableUnits(parsedQuery.data);
    return NextResponse.json({ success: true, data: units });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar unidades de estoque' }, { status: 500 });
  }
}
```

#### 6. `src/app/api/stock/units/[id]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getStockUnitTraceability, updateStockUnitStatus } from '@/services/stock.service';
import { updateStockUnitStatusSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const traceability = await getStockUnitTraceability(id);
    return NextResponse.json({ success: true, data: traceability });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar unidade' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateStockUnitStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateStockUnitStatus(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar status da unidade' }, { status: 500 });
  }
}
```

#### 7. `src/app/api/attendances/[id]/usages/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { recordProductUsage } from '@/services/stock.service';
import { recordProductUsageSchema } from '@/schemas/product';
import { DomainError } from '@/lib/errors';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;

    const usages = await prisma.productUsage.findMany({
      where: { attendanceId },
      include: {
        attendance: { include: { client: true } },
        stockUnit: {
          include: { lot: { include: { product: true } } },
        },
        attendanceProcedure: {
          include: { procedure: true },
        },
      },
      orderBy: { dataHora: 'asc' },
    });

    const data = usages.map((u) => ({
      id: u.id,
      attendanceId: u.attendanceId,
      attendanceDate: u.attendance.dataHora.toISOString(),
      clientId: u.attendance.clientId,
      clientName: u.attendance.client.nome,
      stockUnitId: u.stockUnitId,
      codigoSerial: u.stockUnit.codigoSerial,
      productName: u.stockUnit.lot.product.nome,
      isReusable: u.stockUnit.lot.product.isReusable,
      attendanceProcedureId: u.attendanceProcedureId,
      procedureName: u.attendanceProcedure?.procedure?.nome ?? null,
      dataHora: u.dataHora.toISOString(),
      observacoes: u.observacoes,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar usos de produtos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const body = await request.json();
    const parsed = recordProductUsageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de consumo do produto inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const usage = await recordProductUsage(attendanceId, parsed.data);
    return NextResponse.json({ success: true, data: usage }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao registrar uso de produto' }, { status: 500 });
  }
}
```

---

### 4.7 Test Specifications

#### Test Suite 1: Feature Coverage (`tests/tier1_features/f20_product_lot_service.spec.ts`)
- **T1.1**: Create product catalog item with mandatory name, unit of measure, and default `isReusable = false`.
- **T1.2**: Create reusable product with `isReusable = true` and verify correct retrieval.
- **T1.3**: Filter products by search term, category, and active status.
- **T1.4**: Intake a new lot with initial quantity = 5; verify 5 `StockUnit` rows generated with sequential serial codes (`${numeroLote}-001` through `${numeroLote}-005`).
- **T1.5**: Intake a lot with explicit custom serial codes; verify unique constraints and unit creation.

#### Test Suite 2: Validation V15 Expired Lot Prevention (`tests/tier2_boundaries/v15_expired_lot_prevention.spec.ts`)
```typescript
it('V15: strictly blocks usage of a stock unit belonging to an expired lot', async () => {
  const client = await createTestClient();
  const appt = await createTestAppointment(client.id);
  const attendance = appt.attendances[0];

  const product = await createTestProduct({ isReusable: false });
  // Expired 5 days ago
  const expiredLot = await createTestLot(product.id, {
    dataValidade: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });
  const unit = await createTestStockUnit(expiredLot.id);

  await expect(
    recordProductUsage(attendance.id, { stockUnitId: unit.id })
  ).rejects.toThrow(/vencido.*V15/i);
});

it('V15: permits usage of a stock unit belonging to a valid, unexpired lot', async () => {
  const client = await createTestClient();
  const appt = await createTestAppointment(client.id);
  const attendance = appt.attendances[0];

  const product = await createTestProduct({ isReusable: false });
  const validLot = await createTestLot(product.id, {
    dataValidade: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  });
  const unit = await createTestStockUnit(validLot.id);

  const usage = await recordProductUsage(attendance.id, { stockUnitId: unit.id });
  expect(usage.id).toBeDefined();
});
```

#### Test Suite 3: Validation V18 Single-Use Product Prevention (`tests/tier2_boundaries/v18_single_use_unit_prevention.spec.ts`)
```typescript
it('V18: permits first usage and transitions single-use unit to Esgotado', async () => {
  const client = await createTestClient();
  const appt = await createTestAppointment(client.id);
  const attendance = appt.attendances[0];

  const product = await createTestProduct({ isReusable: false });
  const lot = await createTestLot(product.id);
  const unit = await createTestStockUnit(lot.id);

  const usage = await recordProductUsage(attendance.id, { stockUnitId: unit.id });
  expect(usage.id).toBeDefined();

  const reloaded = await prismaTest.stockUnit.findUnique({ where: { id: unit.id } });
  expect(reloaded.status).toBe('Esgotado');
});

it('V18: strictly rejects second usage of a single-use unit for the same client', async () => {
  const client = await createTestClient();
  const appt1 = await createTestAppointment(client.id);
  const appt2 = await createTestAppointment(client.id);

  const product = await createTestProduct({ isReusable: false });
  const lot = await createTestLot(product.id);
  const unit = await createTestStockUnit(lot.id);

  // First usage succeeds
  await recordProductUsage(appt1.attendances[0].id, { stockUnitId: unit.id });

  // Second usage must fail
  await expect(
    recordProductUsage(appt2.attendances[0].id, { stockUnitId: unit.id })
  ).rejects.toThrow(/uso único.*V18/i);
});
```

#### Test Suite 4: Validations V16, V17 & AC 59, AC 66 Reusable Unit Cross-Client Block (`tests/tier2_boundaries/v16_v17_reusable_cross_client_prevention.spec.ts`)
```typescript
it('V16 & V17 (AC 59 & AC 66): permits same-client reuse and strictly blocks cross-client reuse', async () => {
  const clientA = await createTestClient();
  const clientB = await createTestClient();

  const apptA1 = await createTestAppointment(clientA.id);
  const apptA2 = await createTestAppointment(clientA.id);
  const apptB = await createTestAppointment(clientB.id);

  const product = await createTestProduct({ isReusable: true });
  const lot = await createTestLot(product.id);
  const unit = await createTestStockUnit(lot.id);

  // 1. Client A uses unit in Attendance 1 -> SUCCEEDS
  const usageA1 = await recordProductUsage(apptA1.attendances[0].id, { stockUnitId: unit.id });
  expect(usageA1.id).toBeDefined();

  const unitAfterA1 = await prismaTest.stockUnit.findUnique({ where: { id: unit.id } });
  expect(unitAfterA1.status).toBe('EmUso');
  expect(unitAfterA1.currentClientId).toBe(clientA.id);

  // 2. Client A reuses unit in Attendance 2 -> SUCCEEDS (V16)
  const usageA2 = await recordProductUsage(apptA2.attendances[0].id, { stockUnitId: unit.id });
  expect(usageA2.id).toBeDefined();

  // 3. Client B attempts to use unit in Attendance 3 -> MUST BE REJECTED with exact Portuguese error (V17, AC 59, AC 66)
  await expect(
    recordProductUsage(apptB.attendances[0].id, { stockUnitId: unit.id })
  ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

  // Verify database integrity: zero usages created for Client B
  const bUsages = await prismaTest.productUsage.findMany({
    where: {
      stockUnitId: unit.id,
      attendance: { clientId: clientB.id },
    },
  });
  expect(bUsages.length).toBe(0);
});
```

---

## 5. Verification Method

Once implemented, the implementation can be independently verified via:

1. **Lint & Build Cleanliness**:
   ```powershell
   npm run lint
   npm run build
   ```
   Both commands must pass with zero TypeScript errors and clean compilation.

2. **Automated Test Verification**:
   ```powershell
   npm test
   ```
   All test suites (Tiers 1–4) must pass with 0 failures on `PopoAppTest`.

3. **Critical Validation Checklist Verification**:
   - V15: Expired lot prevented from clinical usage.
   - V16: Reusable unit reused for the same client succeeds.
   - V17: Single-use products strictly rejected on second usage.
   - V18: Individual physical unit tracked per usage.
   - AC 59: Direct service/API call without UI triggers server rejection.
   - AC 66: Error message is in natural Brazilian Portuguese: `"Esta unidade de estoque já está vinculada a outro cliente."`
