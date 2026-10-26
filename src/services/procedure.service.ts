import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';
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
    createdAt: procedure.createdAt instanceof Date ? procedure.createdAt.toISOString() : String(procedure.createdAt),
    updatedAt: procedure.updatedAt instanceof Date ? procedure.updatedAt.toISOString() : String(procedure.updatedAt),
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
  const isActive = data.isActive ?? data.ativo ?? true;

  const created = await prisma.$transaction(async (tx) => {
    const procedure = await tx.procedure.create({
      data: {
        nome: data.nome.trim(),
        descricao: data.descricao.trim(),
        valorPadrao: new Prisma.Decimal(data.valorPadrao as any),
        duracaoMinutos: Number(data.duracaoMinutos),
        categoria: data.categoria.trim(),
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
    throw new NotFoundError('Procedimento não encontrado');
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
      await tx.procedureProduct.deleteMany({
        where: { procedureId: id },
      });

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
        ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao.trim() } : {}),
        ...(data.valorPadrao !== undefined
          ? { valorPadrao: new Prisma.Decimal(data.valorPadrao) }
          : {}),
        ...(data.duracaoMinutos !== undefined
          ? { duracaoMinutos: data.duracaoMinutos }
          : {}),
        ...(data.categoria !== undefined ? { categoria: data.categoria.trim() } : {}),
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
    throw new NotFoundError('Procedimento não encontrado');
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
    throw new NotFoundError('Procedimento não encontrado');
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
    throw new NotFoundError('Procedimento não encontrado');
  }

  const inUse =
    existing._count.attendanceProcedures > 0 ||
    existing._count.plannedAppointments > 0;

  if (inUse) {
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

export class ProcedureService {
  static listProcedures = listProcedures;
  static getProcedureById = getProcedureById;
  static createProcedure = createProcedure;
  static updateProcedure = updateProcedure;
  static deleteProcedure = deleteProcedure;
  static getProcedureCategories = getProcedureCategories;
}
