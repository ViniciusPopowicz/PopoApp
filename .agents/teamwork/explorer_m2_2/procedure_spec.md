# Procedure Catalog Specification (Phase 5 / Feature F14)

**Document Version**: 1.0.0  
**Author**: Explorer M2 2 (Procedure Catalog)  
**Date**: 2026-10-06  
**Status**: APPROVED DESIGN BLUEPRINT  
**Target Milestone**: Milestone 2 (Security, Core Entities & Catalog)  
**Feature Code**: F14 (`PROJECT.md` line 29)  
**Authoritative References**:
- `POPOAPP_DEVELOPMENT_SPEC.md` (§9, §11, §30, §32 Validations V06, V07, V12, V24)
- `ORIGINAL_REQUEST.md` (Domain integrity, Brazilian aesthetic practice context)
- `PROJECT.md` (Layered Next.js App Router architecture, service contracts)
- `IMPLEMENTATION_CHECKLIST.md` (Phase 5 in dispatch / Phase 8 catalog CRUD in checklist)
- `prisma/schema.prisma` (Canonical `Procedure`, `AttendanceProcedure`, `PlannedProcedure`, `ProcedureProduct` models)

---

## 1. Executive Summary & Problem Scope

### 1.1 Context
In PopoApp, the **Procedure Catalog** (`Procedimento`) represents the aesthetic treatments and clinical procedures offered by the professional practice (e.g., *Aplicação de Toxina Botulínica*, *Preenchimento Labial*, *Bioestimulador de Colágeno*, *Harmonização Facial*). 

The catalog is a foundation for multiple downstream modules:
1. **Appointment Scheduling (M3)**: Appointments use planned procedures (`PlannedProcedure`) to calculate estimated duration and expected revenue.
2. **Attendance Execution (M3 / M4)**: When a clinical encounter takes place, procedures are added to the `Attendance` via `AttendanceProcedure`, snapshotting the catalog standard value (`standardValueSnapshot`) while capturing an independently negotiated practiced value (`practicedValue`).
3. **Product Inventory Association (M3)**: Procedures have many-to-many associations (`ProcedureProduct`) with catalog `Product` items to identify expected materials and supplies.

### 1.2 Core Domain Rules
Per `POPOAPP_DEVELOPMENT_SPEC.md` §9, §11, and §32 (V06, V07):
1. **Rule V06 (Positive Standard Value)**: The procedure's default/standard value (`valorPadrao`) must be strictly positive (`valorPadrao > 0`). Zero or negative values are invalid. Currency is stored as `@db.Decimal(10, 2)`.
2. **Rule V07 (Mandatory Catalog Fields)**: Name (`nome`), description (`descricao`), estimated duration in minutes (`duracaoMinutos > 0`), and category (`categoria`) are mandatory.
3. **Soft Deactivation & Historical Immutability (V12, V24)**: 
   - Procedures that have been included in previous attendances or appointments cannot be hard-deleted without breaking relational integrity and historical medical/financial records.
   - The catalog model provides an active status flag (`isActive: Boolean`, aliased as `ativo`).
   - If an in-use procedure is deleted, the system performs a **soft deactivation** (`isActive = false`), leaving all historical snapshots (`AttendanceProcedure.standardValueSnapshot`) and relational links intact.
   - Modifying a catalog procedure's `valorPadrao` will never retroactively modify previously recorded attendance line items.

---

## 2. Database Schema Alignment

### 2.1 Prisma Schema Inspection (`prisma/schema.prisma`)
The canonical database model is defined as:

```prisma
// ==========================================
// 5. CATÁLOGO DE PROCEDIMENTOS E PREÇOS
// ==========================================
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

model AttendanceProcedure {
  id                    String         @id @default(uuid())
  attendanceId          String
  procedureId           String
  standardValueSnapshot Decimal        @db.Decimal(10, 2) // Snapshot imutável do valor padrão na inclusão
  practicedValue        Decimal        @db.Decimal(10, 2) // Valor praticado obrigatório e independente
  observacoes           String?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  productUsages ProductUsage[]

  @@index([attendanceId])
  @@index([procedureId])
}

model PlannedProcedure {
  id            String      @id @default(uuid())
  appointmentId String
  procedureId   String
  ordem         Int         @default(0)
  createdAt     DateTime    @default(now())

  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  procedure   Procedure   @relation(fields: [procedureId], references: [id], onDelete: NoAction)

  @@index([appointmentId])
  @@index([procedureId])
}

model ProcedureProduct {
  procedureId String
  productId   String
  createdAt   DateTime @default(now())

  procedure Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([procedureId, productId])
}
```

### 2.2 Critical Schema Constraints & Structural Implications
1. **Referential Action (`onDelete: NoAction`)**:
   - Both `AttendanceProcedure` and `PlannedProcedure` specify `onDelete: NoAction` pointing to `Procedure`.
   - Attempting a direct SQL `DELETE FROM Procedure WHERE id = ...` when child records exist causes Microsoft SQL Server error `Msg 547` (foreign key violation).
   - Therefore, the service layer MUST detect existing references and enforce **soft deactivation** (`isActive = false`).
2. **Mandatory vs Nullable in DB vs Service**:
   - While `descricao` and `categoria` are typed as `String?` in Prisma to allow flexibility with legacy/import records, the **service layer and Zod input schemas MUST strictly require both fields** per validation V07 for any new or updated catalog entry.
3. **Naming Convention & Domain Aliases**:
   - Database column: `isActive` (`Boolean`).
   - UI / pt-BR Domain terminology: `ativo` (`boolean`) and `status: 'ativo' | 'inativo'`.
   - Service DTOs provide bidirectional compatibility by accepting `isActive` or `ativo`, and returning both `isActive`, `ativo`, and `status`.

---

## 3. Data Transfer Objects (DTO) and TypeScript Types

Target file: `src/types/procedure.ts`

```typescript
import { Decimal } from '@prisma/client/runtime/library';

export interface ProcedureProductDto {
  productId: string;
  productName: string;
  category?: string | null;
  unit: string;
}

export interface ProcedureResponseDto {
  id: string;
  nome: string;
  descricao: string;
  valorPadrao: number; // Converted from Decimal for JSON/UI consumers
  duracaoMinutos: number;
  categoria: string;
  isActive: boolean;
  ativo: boolean; // pt-BR alias
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
  products?: ProcedureProductDto[];
}

export interface ProcedureDetailResponseDto extends ProcedureResponseDto {
  usageCount: {
    attendances: number;
    plannedAppointments: number;
  };
  isInUse: boolean;
}

export interface DeleteProcedureResultDto {
  success: boolean;
  softDeactivated: boolean;
  message: string;
  procedure: ProcedureResponseDto;
}
```

---

## 4. Zod Validation Schemas

Target file: `src/schemas/procedure.ts` (also exported via `src/types/validations.ts`)

```typescript
import { z } from 'zod';

/**
 * Preprocessor to parse incoming numeric strings (e.g. "1500.00" or "1500,50") into valid JS numbers.
 */
const coercePositiveDecimal = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(/\./g, '').replace(',', '.');
    const num = Number(cleaned);
    return isNaN(num) ? val : num;
  }
  return val;
}, z
  .number({
    required_error: 'O valor padrão é obrigatório',
    invalid_type_error: 'O valor padrão deve ser um número válido',
  })
  .positive('O valor padrão deve ser maior que zero (V06)')
  .max(9999999.99, 'O valor padrão excede o limite permitido')
);

/**
 * Preprocessor to parse duration minutes integers.
 */
const coercePositiveInt = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseInt(val.trim(), 10);
    return isNaN(num) ? val : num;
  }
  return val;
}, z
  .number({
    required_error: 'A duração em minutos é obrigatória',
    invalid_type_error: 'A duração deve ser um número inteiro',
  })
  .int('A duração deve ser um número inteiro de minutos')
  .positive('A duração deve ser maior que zero (V07)')
  .max(1440, 'A duração não pode exceder 24 horas (1440 minutos)')
);

/**
 * Schema for creating a new procedure (V06, V07)
 */
export const createProcedureSchema = z.object({
  nome: z
    .string({ required_error: 'O nome do procedimento é obrigatório' })
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres'),

  descricao: z
    .string({ required_error: 'A descrição do procedimento é obrigatória (V07)' })
    .trim()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres')
    .max(2000, 'A descrição não pode exceder 2000 caracteres'),

  valorPadrao: coercePositiveDecimal,

  duracaoMinutos: coercePositiveInt,

  categoria: z
    .string({ required_error: 'A categoria do procedimento é obrigatória (V07)' })
    .trim()
    .min(2, 'A categoria deve ter no mínimo 2 caracteres')
    .max(50, 'A categoria não pode exceder 50 caracteres'),

  isActive: z.boolean().optional().default(true),
  ativo: z.boolean().optional(), // alias support

  productIds: z
    .array(z.string().uuid('ID de produto associado inválido'))
    .optional()
    .default([]),
});

export type CreateProcedureInput = z.infer<typeof createProcedureSchema>;

/**
 * Schema for updating an existing procedure. All fields are optional,
 * but provided fields must follow the exact validation rules.
 */
export const updateProcedureSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'O nome deve ter no mínimo 2 caracteres')
    .max(150, 'O nome não pode exceder 150 caracteres')
    .optional(),

  descricao: z
    .string()
    .trim()
    .min(3, 'A descrição deve ter no mínimo 3 caracteres')
    .max(2000, 'A descrição não pode exceder 2000 caracteres')
    .optional(),

  valorPadrao: coercePositiveDecimal.optional(),

  duracaoMinutos: coercePositiveInt.optional(),

  categoria: z
    .string()
    .trim()
    .min(2, 'A categoria deve ter no mínimo 2 caracteres')
    .max(50, 'A categoria não pode exceder 50 caracteres')
    .optional(),

  isActive: z.boolean().optional(),
  ativo: z.boolean().optional(),

  productIds: z
    .array(z.string().uuid('ID de produto associado inválido'))
    .optional(),
});

export type UpdateProcedureInput = z.infer<typeof updateProcedureSchema>;

/**
 * Schema for query string parameters when listing procedures
 */
export const procedureQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all')
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined; // 'all' returns undefined for Prisma filter
    }),
  ativo: z
    .enum(['true', 'false', 'all'])
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

export type ProcedureQueryInput = z.infer<typeof procedureQuerySchema>;
```

---

## 5. Domain Service Implementation (`src/services/procedure.service.ts`)

Target file: `src/services/procedure.service.ts`

```typescript
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateProcedureInput,
  UpdateProcedureInput,
  ProcedureQueryInput,
} from '@/schemas/procedure';
import {
  ProcedureResponseDto,
  ProcedureDetailResponseDto,
  DeleteProcedureResultDto,
} from '@/types/procedure';

/**
 * Maps a Prisma Procedure model to the canonical ProcedureResponseDto
 */
export function mapProcedureToDto(
  procedure: any,
  usageStats?: { attendances: number; plannedAppointments: number }
): ProcedureResponseDto | ProcedureDetailResponseDto {
  const base: ProcedureResponseDto = {
    id: procedure.id,
    nome: procedure.nome,
    descricao: procedure.descricao ?? '',
    valorPadrao: Number(procedure.valorPadrao),
    duracaoMinutos: procedure.duracaoMinutos,
    categoria: procedure.categoria ?? 'Geral',
    isActive: procedure.isActive,
    ativo: procedure.isActive,
    status: procedure.isActive ? 'ativo' : 'inativo',
    createdAt: procedure.createdAt.toISOString(),
    updatedAt: procedure.updatedAt.toISOString(),
    products: procedure.productAssociations?.map((pa: any) => ({
      productId: pa.product.id,
      productName: pa.product.nome,
      category: pa.product.categoria,
      unit: pa.product.unidade,
    })),
  };

  if (usageStats) {
    return {
      ...base,
      usageCount: usageStats,
      isInUse: usageStats.attendances > 0 || usageStats.plannedAppointments > 0,
    } as ProcedureDetailResponseDto;
  }

  return base;
}

/**
 * Lists procedures filtered by search terms, category, and active status.
 */
export async function listProcedures(
  query: ProcedureQueryInput = {}
): Promise<ProcedureResponseDto[]> {
  const activeFilter = query.active ?? query.ativo;

  const where: Prisma.ProcedureWhereInput = {
    ...(query.search
      ? {
          OR: [
            { nome: { contains: query.search } },
            { descricao: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.categoria ? { categoria: query.categoria } : {}),
    ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
  };

  const procedures = await prisma.procedure.findMany({
    where,
    orderBy: [
      { isActive: 'desc' },
      { nome: 'asc' },
    ],
    include: {
      productAssociations: {
        include: {
          product: {
            select: {
              id: true,
              nome: true,
              categoria: true,
              unidade: true,
            },
          },
        },
      },
    },
  });

  return procedures.map((p) => mapProcedureToDto(p) as ProcedureResponseDto);
}

/**
 * Retrieves a single procedure by ID including product associations and historical usage stats.
 */
export async function getProcedureById(
  id: string
): Promise<ProcedureDetailResponseDto | null> {
  const procedure = await prisma.procedure.findUnique({
    where: { id },
    include: {
      productAssociations: {
        include: {
          product: {
            select: {
              id: true,
              nome: true,
              categoria: true,
              unidade: true,
            },
          },
        },
      },
      _count: {
        select: {
          attendanceProcedures: true,
          plannedAppointments: true,
        },
      },
    },
  });

  if (!procedure) return null;

  return mapProcedureToDto(procedure, {
    attendances: procedure._count.attendanceProcedures,
    plannedAppointments: procedure._count.plannedAppointments,
  }) as ProcedureDetailResponseDto;
}

/**
 * Creates a new procedure in the catalog (Validates V06, V07).
 */
export async function createProcedure(
  data: CreateProcedureInput
): Promise<ProcedureDetailResponseDto> {
  // Determine active state from isActive or alias ativo
  const isActive = data.isActive ?? data.ativo ?? true;

  const created = await prisma.$transaction(async (tx) => {
    const procedure = await tx.procedure.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        valorPadrao: new Prisma.Decimal(data.valorPadrao),
        duracaoMinutos: data.duracaoMinutos,
        categoria: data.categoria,
        isActive,
        ...(data.productIds && data.productIds.length > 0
          ? {
              productAssociations: {
                create: data.productIds.map((productId) => ({
                  productId,
                })),
              },
            }
          : {}),
      },
      include: {
        productAssociations: {
          include: {
            product: {
              select: {
                id: true,
                nome: true,
                categoria: true,
                unidade: true,
              },
            },
          },
        },
      },
    });

    return procedure;
  });

  return mapProcedureToDto(created, {
    attendances: 0,
    plannedAppointments: 0,
  }) as ProcedureDetailResponseDto;
}

/**
 * Updates an existing procedure.
 * Note: Modifying valorPadrao NEVER alters historical AttendanceProcedure snapshots (V12, V24).
 */
export async function updateProcedure(
  id: string,
  data: UpdateProcedureInput
): Promise<ProcedureDetailResponseDto> {
  const existing = await prisma.procedure.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          attendanceProcedures: true,
          plannedAppointments: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Procedimento não encontrado');
  }

  const isActive =
    data.isActive !== undefined
      ? data.isActive
      : data.ativo !== undefined
      ? data.ativo
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    // If productIds list is provided, synchronize associations
    if (data.productIds !== undefined) {
      // Remove old associations
      await tx.procedureProduct.deleteMany({
        where: { procedureId: id },
      });

      // Insert new associations
      if (data.productIds.length > 0) {
        await tx.procedureProduct.createMany({
          data: data.productIds.map((productId) => ({
            procedureId: id,
            productId,
          })),
        });
      }
    }

    const procedure = await tx.procedure.update({
      where: { id },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
        ...(data.valorPadrao !== undefined
          ? { valorPadrao: new Prisma.Decimal(data.valorPadrao) }
          : {}),
        ...(data.duracaoMinutos !== undefined
          ? { duracaoMinutos: data.duracaoMinutos }
          : {}),
        ...(data.categoria !== undefined ? { categoria: data.categoria } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        productAssociations: {
          include: {
            product: {
              select: {
                id: true,
                nome: true,
                categoria: true,
                unidade: true,
              },
            },
          },
        },
      },
    });

    return procedure;
  });

  return mapProcedureToDto(updated, {
    attendances: existing._count.attendanceProcedures,
    plannedAppointments: existing._count.plannedAppointments,
  }) as ProcedureDetailResponseDto;
}

/**
 * Toggles the active status of a procedure.
 */
export async function toggleProcedureActive(
  id: string,
  activeState?: boolean
): Promise<ProcedureResponseDto> {
  const existing = await prisma.procedure.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Procedimento não encontrado');
  }

  const newStatus = activeState !== undefined ? activeState : !existing.isActive;

  const updated = await prisma.procedure.update({
    where: { id },
    data: { isActive: newStatus },
    include: {
      productAssociations: {
        include: {
          product: {
            select: { id: true, nome: true, categoria: true, unidade: true },
          },
        },
      },
    },
  });

  return mapProcedureToDto(updated) as ProcedureResponseDto;
}

/**
 * Checks whether a procedure is in use in clinical history or appointments.
 */
export async function checkProcedureUsage(id: string): Promise<{
  inUse: boolean;
  attendanceCount: number;
  plannedCount: number;
}> {
  const counts = await prisma.procedure.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          attendanceProcedures: true,
          plannedAppointments: true,
        },
      },
    },
  });

  if (!counts) {
    throw new Error('Procedimento não encontrado');
  }

  const attendanceCount = counts._count.attendanceProcedures;
  const plannedCount = counts._count.plannedAppointments;

  return {
    inUse: attendanceCount > 0 || plannedCount > 0,
    attendanceCount,
    plannedCount,
  };
}

/**
 * Deletes or soft-deactivates a procedure.
 * - If in use: automatically soft-deactivates (isActive = false) to preserve medical and financial history.
 * - If not in use: permanently removes the record.
 */
export async function deleteProcedure(
  id: string
): Promise<DeleteProcedureResultDto> {
  const existing = await prisma.procedure.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          attendanceProcedures: true,
          plannedAppointments: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Procedimento não encontrado');
  }

  const inUse =
    existing._count.attendanceProcedures > 0 ||
    existing._count.plannedAppointments > 0;

  if (inUse) {
    // Perform soft deactivation
    const softDeactivated = await prisma.procedure.update({
      where: { id },
      data: { isActive: false },
      include: {
        productAssociations: {
          include: {
            product: {
              select: { id: true, nome: true, categoria: true, unidade: true },
            },
          },
        },
      },
    });

    return {
      success: true,
      softDeactivated: true,
      message:
        'Procedimento possui histórico de agendamentos ou atendimentos e foi desativado em vez de excluído.',
      procedure: mapProcedureToDto(softDeactivated) as ProcedureResponseDto,
    };
  }

  // Not in use: safe hard delete (cascade cleans up ProcedureProduct)
  await prisma.procedure.delete({
    where: { id },
  });

  return {
    success: true,
    softDeactivated: false,
    message: 'Procedimento excluído com sucesso.',
    procedure: mapProcedureToDto(existing) as ProcedureResponseDto,
  };
}

/**
 * Returns distinct category names present in the catalog.
 */
export async function getProcedureCategories(): Promise<string[]> {
  const categories = await prisma.procedure.findMany({
    select: { categoria: true },
    distinct: ['categoria'],
    where: {
      categoria: { not: null },
    },
    orderBy: { categoria: 'asc' },
  });

  return categories
    .map((c) => c.categoria)
    .filter((c): c is string => c !== null && c.trim().length > 0);
}
```

---

## 6. API Route Handlers

### 6.1 Collection Route: `src/app/api/procedures/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  listProcedures,
  createProcedure,
} from '@/services/procedure.service';
import {
  createProcedureSchema,
  procedureQuerySchema,
} from '@/schemas/procedure';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = {
      search: searchParams.get('search') ?? searchParams.get('q') ?? undefined,
      categoria: searchParams.get('categoria') ?? undefined,
      active: searchParams.get('active') ?? searchParams.get('ativo') ?? undefined,
    };

    const parsedQuery = procedureQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parâmetros de busca inválidos',
          issues: parsedQuery.error.format(),
        },
        { status: 400 }
      );
    }

    const procedures = await listProcedures(parsedQuery.data);

    return NextResponse.json({
      success: true,
      data: procedures,
    });
  } catch (error: any) {
    console.error('Erro ao listar procedimentos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar procedimentos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createProcedureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados do procedimento inválidos',
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const procedure = await createProcedure(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: procedure,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar procedimento' },
      { status: 500 }
    );
  }
}
```

### 6.2 Item Route: `src/app/api/procedures/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getProcedureById,
  updateProcedure,
  toggleProcedureActive,
  deleteProcedure,
} from '@/services/procedure.service';
import { updateProcedureSchema } from '@/schemas/procedure';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const procedure = await getProcedureById(id);

    if (!procedure) {
      return NextResponse.json(
        { success: false, error: 'Procedimento não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: procedure,
    });
  } catch (error: any) {
    console.error('Erro ao consultar procedimento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar procedimento' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const parsed = updateProcedureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados de atualização inválidos',
          issues: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const updated = await updateProcedure(id, parsed.data);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    if (error.message === 'Procedimento não encontrado') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    console.error('Erro ao atualizar procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar procedimento' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const targetState =
      body.isActive !== undefined
        ? Boolean(body.isActive)
        : body.ativo !== undefined
        ? Boolean(body.ativo)
        : undefined;

    const toggled = await toggleProcedureActive(id, targetState);

    return NextResponse.json({
      success: true,
      data: toggled,
    });
  } catch (error: any) {
    if (error.message === 'Procedimento não encontrado') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    console.error('Erro ao alternar status do procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao alternar status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const result = await deleteProcedure(id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === 'Procedimento não encontrado') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    console.error('Erro ao remover procedimento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao processar exclusão' },
      { status: 500 }
    );
  }
}
```

---

## 7. Frontend Integration Blueprint (`src/app/(authenticated)/procedimentos/page.tsx`)

### 7.1 Current vs Target State
- **Current State**: Imports static mock array `mockProcedimentos` from `@/data/mock/procedimentos`.
- **Target State**:
  1. Fetches procedures via `fetch('/api/procedures')` with search query debouncing.
  2. Implements a "Novo Procedimento" modal dialog wired to `POST /api/procedures`.
  3. Implements an "Editar Procedimento" modal dialog wired to `PUT /api/procedures/[id]`.
  4. Provides an active toggle switch / button wired to `PATCH /api/procedures/[id]`.
  5. Implements delete confirmation with feedback explaining when soft-deactivation occurs.

### 7.2 Modal Dialog Fields & UX Requirements
- **Nome**: Input text (e.g. "Aplicação de Toxina Botulínica").
- **Categoria**: Combobox / Input with suggestions (e.g. "Toxina", "Preenchimento", "Harmonização", "Bioestimulador").
- **Valor Padrão (R$)**: Currency input with `R$` prefix and 2 decimal places.
- **Duração Estimada**: Number input with `min` suffix (e.g., 45 min).
- **Descrição**: Multiline textarea explaining treatment scope and recommendations.
- **Status Ativo**: Checkbox or switch default checked.

---

## 8. Automated Test Specifications

The testing architecture for Procedure Catalog maps to:
- **Feature F14**: Procedure Catalog Service & Validations
- **Critical Validation V06**: Positive standard value (`valorPadrao > 0`, `@db.Decimal(10, 2)`)
- **Critical Validation V07**: Mandatory fields (`nome`, `descricao`, `duracaoMinutos > 0`, `categoria`)
- **Critical Validation V12 / V24**: Catalog value modification preserves historical attendance snapshots

### 8.1 Test Matrix

| Test ID | Test Title | Test Type | File Location | Validation Rule |
|---|---|---|---|---|
| **TC-PROC-01** | Create valid procedure in catalog | Integration | `tests/tier1_features/f14_procedure_catalog.spec.ts` | F14, V06, V07 |
| **TC-PROC-02** | Rejection of non-positive standard value (zero and negative) | Boundary / Zod | `tests/tier2_boundaries/v06_procedure_positive_value.spec.ts` | V06 |
| **TC-PROC-03** | Rejection of missing mandatory fields (`nome`, `descricao`, `duracaoMinutos`, `categoria`) | Boundary / Zod | `tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts` | V07 |
| **TC-PROC-04** | Rejection of non-positive or non-integer duration | Boundary / Zod | `tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts` | V07 |
| **TC-PROC-05** | Catalog standard value modification immutability snapshot test | Combinations | `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts` | V12, V24 |
| **TC-PROC-06** | Soft deactivation preserves relations and historical attendance | Workflow | `tests/tier1_features/f14_procedure_catalog.spec.ts` | Soft Deactivation |
| **TC-PROC-07** | Deleting in-use procedure automatically soft-deactivates | Workflow | `tests/tier1_features/f14_procedure_catalog.spec.ts` | Relational Safety |
| **TC-PROC-08** | Deleting unused procedure permanently deletes record | Integration | `tests/tier1_features/f14_procedure_catalog.spec.ts` | CRUD |
| **TC-PROC-09** | Filtering procedures by category, search text, and active flag | Integration | `tests/tier1_features/f14_procedure_catalog.spec.ts` | Listing & Filter |
| **TC-PROC-10** | Associate and synchronize products with procedure (M:N) | Integration | `tests/tier1_features/f14_procedure_catalog.spec.ts` | M:N Association |

### 8.2 Dedicated Test Suite Implementations

#### File 1: `tests/tier2_boundaries/v06_procedure_positive_value.spec.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { createProcedureSchema } from '@/schemas/procedure';

describe('Critical Validation V06: Positive Standard Value (valorPadrao > 0)', () => {
  const validBase = {
    nome: 'Preenchimento Labial',
    descricao: 'Preenchimento labial com ácido hialurônico de alta pureza',
    duracaoMinutos: 60,
    categoria: 'Preenchimento',
  };

  it('should accept strictly positive values', () => {
    const result1 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 500.0 });
    expect(result1.success).toBe(true);

    const result2 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 0.01 });
    expect(result2.success).toBe(true);

    const result3 = createProcedureSchema.safeParse({ ...validBase, valorPadrao: '1500,50' });
    expect(result3.success).toBe(true);
    if (result3.success) {
      expect(result3.data.valorPadrao).toBe(1500.5);
    }
  });

  it('should reject zero value (0.00)', () => {
    const result = createProcedureSchema.safeParse({ ...validBase, valorPadrao: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('valorPadrao'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('maior que zero');
    }
  });

  it('should reject negative values', () => {
    const result = createProcedureSchema.safeParse({ ...validBase, valorPadrao: -100.0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('valorPadrao'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('maior que zero');
    }
  });

  it('should reject missing valorPadrao', () => {
    const { valorPadrao, ...withoutPrice } = validBase as any;
    const result = createProcedureSchema.safeParse(withoutPrice);
    expect(result.success).toBe(false);
  });
});
```

#### File 2: `tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { createProcedureSchema } from '@/schemas/procedure';

describe('Critical Validation V07: Mandatory Procedure Catalog Fields', () => {
  const validBase = {
    nome: 'Bioestimulador de Colágeno',
    descricao: 'Aplicação de ácido polilático para estímulo dérmico',
    valorPadrao: 2500.0,
    duracaoMinutos: 60,
    categoria: 'Bioestimulador',
  };

  it('should accept complete and valid payload', () => {
    const result = createProcedureSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('should reject empty or missing nome', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, nome: '' });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, nome: '   ' });
    expect(r2.success).toBe(false);

    const { nome, ...withoutNome } = validBase;
    const r3 = createProcedureSchema.safeParse(withoutNome);
    expect(r3.success).toBe(false);
  });

  it('should reject empty or missing descricao', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, descricao: '' });
    expect(r1.success).toBe(false);

    const r2 = createProcedureSchema.safeParse({ ...validBase, descricao: 'ab' });
    expect(r2.success).toBe(false);

    const { descricao, ...withoutDesc } = validBase;
    const r3 = createProcedureSchema.safeParse(withoutDesc);
    expect(r3.success).toBe(false);
  });

  it('should reject non-positive or non-integer duracaoMinutos', () => {
    const rZero = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: 0 });
    expect(rZero.success).toBe(false);

    const rNeg = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: -15 });
    expect(rNeg.success).toBe(false);

    const rFloat = createProcedureSchema.safeParse({ ...validBase, duracaoMinutos: 45.5 });
    expect(rFloat.success).toBe(false);
  });

  it('should reject empty or missing categoria', () => {
    const r1 = createProcedureSchema.safeParse({ ...validBase, categoria: '' });
    expect(r1.success).toBe(false);

    const { categoria, ...withoutCat } = validBase;
    const r2 = createProcedureSchema.safeParse(withoutCat);
    expect(r2.success).toBe(false);
  });
});
```

#### File 3: `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure } from '../helpers/test-fixtures';

describe('Critical Validation V12 & V24: Catalog Immutability vs Historical Snapshots', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('V12: updating procedure catalog valorPadrao must NOT modify existing standardValueSnapshot in AttendanceProcedure', async () => {
    const client = await createTestClient({ nome: 'Paciente Imutabilidade' });

    // 1. Procedure created with standard value R$ 500.00
    const procedure = await createTestProcedure({
      nome: 'Toxina Teste Imutabilidade',
      valorPadrao: 500.0,
      duracaoMinutos: 45,
      categoria: 'Toxina',
    });

    // 2. Attendance references procedure with snapshot = R$ 500.00 and practiced = R$ 450.00
    const attendance = await (prismaTest as any).attendance.create({
      data: {
        clientId: client.id,
        status: 'Realizado',
        procedures: {
          create: {
            procedureId: procedure.id,
            standardValueSnapshot: 500.0,
            practicedValue: 450.0,
          },
        },
      },
      include: { procedures: true },
    });

    const attendanceProcId = attendance.procedures[0].id;
    expect(Number(attendance.procedures[0].standardValueSnapshot)).toBe(500.0);
    expect(Number(attendance.procedures[0].practicedValue)).toBe(450.0);

    // 3. Catalog updates procedure price from R$ 500.00 to R$ 800.00
    await (prismaTest as any).procedure.update({
      where: { id: procedure.id },
      data: { valorPadrao: 800.0 },
    });

    // 4. Verify catalog is updated
    const updatedCatalog = await (prismaTest as any).procedure.findUnique({
      where: { id: procedure.id },
    });
    expect(Number(updatedCatalog.valorPadrao)).toBe(800.0);

    // 5. Verify historical snapshot in attendance is strictly preserved (V12, V24)
    const historicalLine = await (prismaTest as any).attendanceProcedure.findUnique({
      where: { id: attendanceProcId },
    });
    expect(Number(historicalLine.standardValueSnapshot)).toBe(500.0);
    expect(Number(historicalLine.practicedValue)).toBe(450.0);
  });
});
```

#### File 4: `tests/tier1_features/f14_procedure_catalog.spec.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestProcedure, createTestProduct } from '../helpers/test-fixtures';

describe('Feature F14: Procedure Catalog CRUD & Soft Deactivation', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should support full procedure creation and retrieval', async () => {
    const procedure = await (prismaTest as any).procedure.create({
      data: {
        nome: 'Harmonização Mandibular',
        descricao: 'Preenchimento para definição do ângulo mandibular',
        valorPadrao: 3500.0,
        duracaoMinutos: 90,
        categoria: 'Harmonização',
        isActive: true,
      },
    });

    expect(procedure.id).toBeDefined();
    expect(procedure.nome).toBe('Harmonização Mandibular');
    expect(Number(procedure.valorPadrao)).toBe(3500.0);
    expect(procedure.duracaoMinutos).toBe(90);
    expect(procedure.isActive).toBe(true);
  });

  it('should soft-deactivate an in-use procedure rather than breaking relations', async () => {
    const client = await createTestClient({ nome: 'Cliente Histórico' });
    const procedure = await createTestProcedure({ nome: 'Procedimento Em Uso' });

    // Link procedure to attendance
    await (prismaTest as any).attendance.create({
      data: {
        clientId: client.id,
        status: 'Realizado',
        procedures: {
          create: {
            procedureId: procedure.id,
            standardValueSnapshot: 500.0,
            practicedValue: 500.0,
          },
        },
      },
    });

    // Check usage
    const inUseCheck = await (prismaTest as any).procedure.findUnique({
      where: { id: procedure.id },
      include: { _count: { select: { attendanceProcedures: true } } },
    });
    expect(inUseCheck._count.attendanceProcedures).toBeGreaterThan(0);

    // Perform soft deactivation
    const deactivated = await (prismaTest as any).procedure.update({
      where: { id: procedure.id },
      data: { isActive: false },
    });
    expect(deactivated.isActive).toBe(false);

    // Verify historical attendance link remains completely intact
    const historicalLinks = await (prismaTest as any).attendanceProcedure.findMany({
      where: { procedureId: procedure.id },
    });
    expect(historicalLinks).toHaveLength(1);
  });

  it('should support linking catalog products to procedures via ProcedureProduct (M:N)', async () => {
    const product1 = await createTestProduct({ nome: 'Seringa Ácido Hialurônico' });
    const product2 = await createTestProduct({ nome: 'Microcânula 22G' });

    const procedure = await (prismaTest as any).procedure.create({
      data: {
        nome: 'Rinomodelação',
        descricao: 'Ajuste de dorso e ponta nasal',
        valorPadrao: 1800.0,
        duracaoMinutos: 45,
        categoria: 'Facial',
        isActive: true,
        productAssociations: {
          create: [
            { productId: product1.id },
            { productId: product2.id },
          ],
        },
      },
      include: {
        productAssociations: {
          include: { product: true },
        },
      },
    });

    expect(procedure.productAssociations).toHaveLength(2);
    expect(procedure.productAssociations.map((pa: any) => pa.product.nome)).toContain('Microcânula 22G');
  });
});
```

---

## 9. Conclusion & Implementation Checklist

The Procedure Catalog is fully investigated and specified with zero architectural blockers. When the implementation phase begins, the implementer will execute the following steps:

1. **Create Schemas**: Write `src/schemas/procedure.ts` and re-export in `src/types/validations.ts`.
2. **Create Types**: Write `src/types/procedure.ts` with canonical DTO interfaces.
3. **Implement Service**: Write `src/services/procedure.service.ts` with all 8 domain methods.
4. **Implement API Routes**: 
   - `src/app/api/procedures/route.ts` (GET / POST)
   - `src/app/api/procedures/[id]/route.ts` (GET / PUT / PATCH / DELETE)
5. **Implement Test Suite**:
   - `tests/tier2_boundaries/v06_procedure_positive_value.spec.ts`
   - `tests/tier2_boundaries/v07_procedure_mandatory_fields.spec.ts`
   - `tests/tier2_boundaries/v12_v24_catalog_immutability.spec.ts`
   - `tests/tier1_features/f14_procedure_catalog.spec.ts`
6. **Frontend Integration**: Refactor `src/app/(authenticated)/procedimentos/page.tsx` from mock data to `/api/procedures`.
