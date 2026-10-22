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
        precoCusto:
          input.precoCusto !== null && input.precoCusto !== undefined ? new Prisma.Decimal(input.precoCusto) : null,
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
    orderBy: { codigoSerial: 'asc' },
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
      OR: [{ dataValidade: null }, { dataValidade: { gte: now } }],
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
    orderBy: [{ lot: { dataValidade: 'asc' } }, { codigoSerial: 'asc' }],
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
      if (stockUnit.status === 'Esgotado') {
        throw new ValidationError('Esta unidade de estoque já está esgotada');
      }

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

export class StockService {
  static createLot = createLot;
  static registerStockUnits = registerStockUnits;
  static listAvailableUnits = listAvailableUnits;
  static recordProductUsage = recordProductUsage;
  static getStockUnitTraceability = getStockUnitTraceability;
  static updateStockUnitStatus = updateStockUnitStatus;
}
