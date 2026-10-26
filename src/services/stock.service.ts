import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import {
  CreateLotInput,
  RegisterUnitsInput,
  RecordProductUsageInput,
  ReverseProductUsageInput,
  CorrectProductUsageInput,
  AvailableUnitsQueryInput,
  UpdateStockUnitStatusInput,
  StockAdjustmentInput,
  InventoryMovementQueryInput,
} from '@/schemas/product';
import {
  ProductLotSummaryDto,
  StockUnitSummaryDto,
  ProductUsageSummaryDto,
  AvailableStockUnitDto,
  StockUnitDetailDto,
  InventoryMovementDto,
  InventoryMovementType,
} from '@/types/product';

function round3(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

function formatMovementDto(raw: any): InventoryMovementDto {
  return {
    id: raw.id,
    productId: raw.productId,
    productName: raw.product?.nome ?? undefined,
    lotId: raw.lotId ?? null,
    numeroLote: raw.lot?.numeroLote ?? null,
    stockUnitId: raw.stockUnitId ?? null,
    codigoSerial: raw.stockUnit?.codigoSerial ?? null,
    attendanceId: raw.attendanceId ?? null,
    productUsageId: raw.productUsageId ?? null,
    tipo: raw.tipo as InventoryMovementType,
    quantidade: round3(Number(raw.quantidade)),
    unidade: raw.unidade,
    saldoAnterior: raw.saldoAnterior !== null && raw.saldoAnterior !== undefined ? round3(Number(raw.saldoAnterior)) : null,
    saldoPosterior: raw.saldoPosterior !== null && raw.saldoPosterior !== undefined ? round3(Number(raw.saldoPosterior)) : null,
    motivo: raw.motivo ?? null,
    observacoes: raw.observacoes ?? null,
    status: raw.status,
    reversedFromId: raw.reversedFromId ?? null,
    reversedAt: raw.reversedAt ? new Date(raw.reversedAt).toISOString() : null,
    reversalReason: raw.reversalReason ?? null,
    dataHora: new Date(raw.dataHora).toISOString(),
    createdAt: new Date(raw.createdAt).toISOString(),
  };
}

/**
 * Creates a new ProductLot, automatically creates individual StockUnit records (when in UNIT mode or serials provided),
 * and records an initial 'ENTRADA' InventoryMovement.
 */
export async function createLot(productId: string, input: CreateLotInput): Promise<ProductLotSummaryDto> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new NotFoundError('Produto não encontrado');
  }

  const isQuantityMode = product.trackingMode === 'QUANTITY';
  const rawInitialQty = input.quantidadeInicial ?? 0;
  if (rawInitialQty < 0) {
    throw new ValidationError('A quantidade inicial não pode ser negativa');
  }

  const customCodes = input.codigosSeriais || [];
  const serialCodesToCreate: string[] = [];

  if (customCodes.length > 0) {
    serialCodesToCreate.push(...customCodes);
  } else if (!isQuantityMode && rawInitialQty > 0) {
    const unitCount = Math.floor(rawInitialQty);
    for (let i = 1; i <= unitCount; i++) {
      serialCodesToCreate.push(`${input.numeroLote}-${String(i).padStart(3, '0')}`);
    }
  }

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

  const lotInitialQty =
    !isQuantityMode && serialCodesToCreate.length > 0
      ? serialCodesToCreate.length
      : rawInitialQty;
  const lotAvailableQty =
    input.quantidadeDisponivel !== undefined ? input.quantidadeDisponivel : lotInitialQty;

  const lot = await prisma.$transaction(async (tx) => {
    const createdLot = await tx.productLot.create({
      data: {
        productId,
        numeroLote: input.numeroLote,
        dataValidade: input.dataValidade ? new Date(input.dataValidade as any) : null,
        dataAquisicao: input.dataAquisicao ? new Date(input.dataAquisicao as any) : new Date(),
        precoCusto:
          input.precoCusto !== null && input.precoCusto !== undefined
            ? new Prisma.Decimal(input.precoCusto as any)
            : null,
        quantidadeInicial: new Prisma.Decimal(lotInitialQty),
        quantidadeDisponivel: new Prisma.Decimal(lotAvailableQty),
        observacoes: input.observacoes ?? null,
      },
    });

    if (serialCodesToCreate.length > 0) {
      const perUnitQty =
        isQuantityMode && serialCodesToCreate.length > 0 && lotInitialQty > 0
          ? round3(lotInitialQty / serialCodesToCreate.length)
          : 1;

      await tx.stockUnit.createMany({
        data: serialCodesToCreate.map((serial) => ({
          lotId: createdLot.id,
          codigoSerial: serial,
          status: 'Disponivel',
          quantidadeInicial: new Prisma.Decimal(perUnitQty),
          quantidadeDisponivel: new Prisma.Decimal(perUnitQty),
        })),
      });
    }

    if (lotInitialQty > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId,
          lotId: createdLot.id,
          tipo: 'ENTRADA',
          quantidade: new Prisma.Decimal(lotInitialQty),
          unidade: product.unidade,
          saldoAnterior: new Prisma.Decimal(0),
          saldoPosterior: new Prisma.Decimal(lotAvailableQty),
          motivo: 'Entrada inicial de lote',
          observacoes: input.observacoes ?? null,
          status: 'Ativo',
        },
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
    quantidadeInicial: Number(lot.quantidadeInicial),
    quantidadeDisponivel: Number(lot.quantidadeDisponivel),
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
 * Registers additional physical stock units under an existing lot and records an 'ENTRADA' InventoryMovement.
 */
export async function registerStockUnits(
  lotId: string,
  input: RegisterUnitsInput
): Promise<StockUnitSummaryDto[]> {
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

  const qtyPerUnit = input.quantidadePorUnidade ?? 1;
  const totalAddedQty = round3(serialCodesToCreate.length * qtyPerUnit);

  await prisma.$transaction(async (tx) => {
    await tx.stockUnit.createMany({
      data: serialCodesToCreate.map((serial) => ({
        lotId,
        codigoSerial: serial,
        status: 'Disponivel',
        quantidadeInicial: new Prisma.Decimal(qtyPerUnit),
        quantidadeDisponivel: new Prisma.Decimal(qtyPerUnit),
      })),
    });

    const prevBalance = Number(lot.quantidadeDisponivel ?? 0);
    const nextBalance = round3(prevBalance + totalAddedQty);

    await tx.productLot.update({
      where: { id: lotId },
      data: {
        quantidadeInicial: { increment: new Prisma.Decimal(totalAddedQty) },
        quantidadeDisponivel: { increment: new Prisma.Decimal(totalAddedQty) },
      },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: lot.productId,
        lotId,
        tipo: 'ENTRADA',
        quantidade: new Prisma.Decimal(totalAddedQty),
        unidade: lot.product.unidade,
        saldoAnterior: new Prisma.Decimal(prevBalance),
        saldoPosterior: new Prisma.Decimal(nextBalance),
        motivo: `Registro de ${serialCodesToCreate.length} unidade(s) no lote`,
        status: 'Ativo',
      },
    });
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
    trackingMode: (lot.product.trackingMode as any) || 'UNIT',
    unidade: lot.product.unidade,
    codigoSerial: u.codigoSerial,
    status: u.status as any,
    motivoStatus: u.motivoStatus ?? null,
    quantidadeInicial: Number(u.quantidadeInicial ?? 1),
    quantidadeDisponivel: Number(u.quantidadeDisponivel ?? 1),
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
 */
export async function listAvailableUnits(
  query: AvailableUnitsQueryInput = {}
): Promise<AvailableStockUnitDto[]> {
  const now = new Date();

  const where: Prisma.StockUnitWhereInput = {
    status: { in: ['Disponivel', 'EmUso'] },
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

  return units
    .filter((unit) => {
      if (unit.status === 'Disponivel' && !unit.currentClientId) {
        return true;
      }
      if (unit.currentClientId) {
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
      trackingMode: (unit.lot.product.trackingMode as any) || 'UNIT',
      isReusable: unit.lot.product.isReusable,
      lotId: unit.lot.id,
      numeroLote: unit.lot.numeroLote,
      dataValidade: unit.lot.dataValidade ? unit.lot.dataValidade.toISOString() : null,
      status: unit.status as any,
      quantidadeDisponivel: Number(unit.quantidadeDisponivel ?? 1),
      isAssignedToCurrentClient: Boolean(query.clientId && unit.currentClientId === query.clientId),
    }));
}

/**
 * THE CRITICAL USAGE ENGINE: Records clinical product usage with full support for:
 * - Physical StockUnit consumption (indivisible single-use, reusable same-client bound, or multi-dose container)
 * - Partial/fractional consumption of consumables tracked by QUANTITY (lot-level or product-level FEFO)
 * - Unit compatibility validation, expired lot blocking (V15), same-client reusable enforcement (V16/V17),
 *   single-use restriction (V18), concurrency-safe stock deduction, and atomic InventoryMovement ledger entry.
 */
export async function recordProductUsage(
  attendanceId: string,
  input: RecordProductUsageInput
): Promise<ProductUsageSummaryDto> {
  if (input.quantidade !== undefined && input.quantidade <= 0) {
    throw new ValidationError('A quantidade consumida deve ser maior que zero');
  }

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

    // 2. Optional AttendanceProcedure association validation
    if (input.attendanceProcedureId) {
      const procAssoc = await tx.attendanceProcedure.findUnique({
        where: { id: input.attendanceProcedureId },
      });
      if (!procAssoc || procAssoc.attendanceId !== attendanceId) {
        throw new ValidationError('O procedimento selecionado não pertence a este atendimento');
      }
    }

    // PATH A: Physical StockUnit provided
    if (input.stockUnitId) {
      const stockUnit = await tx.stockUnit.findUnique({
        where: { id: input.stockUnitId },
        include: {
          lot: {
            include: { product: true },
          },
          usages: {
            where: { status: 'Ativo' },
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

      // Validate unit of measure compatibility if provided
      if (
        input.unidade &&
        input.unidade.trim().toLowerCase() !== product.unidade.trim().toLowerCase()
      ) {
        throw new ValidationError(
          `Unidade de medida incompatível ("${input.unidade}"). O produto "${product.nome}" é controlado em "${product.unidade}".`
        );
      }

      // Validation V15: Expired Lot Check
      if (lot.dataValidade !== null) {
        const expirationDate = new Date(lot.dataValidade);
        const today = new Date();
        if (expirationDate < today) {
          const formattedExp = expirationDate.toLocaleDateString('pt-BR');
          throw new ValidationError(
            `Lote ${lot.numeroLote} vencido em ${formattedExp}. Unidades deste lote não podem ser utilizadas (V15).`
          );
        }
      }

      if (stockUnit.status === 'Descartado') {
        throw new ValidationError('Esta unidade de estoque foi descartada e não pode ser utilizada');
      }

      const unitInitQty = Number(stockUnit.quantidadeInicial ?? 1);
      const unitAvailQty = Number(stockUnit.quantidadeDisponivel ?? 1);
      const isIndivisibleUnit = product.trackingMode === 'UNIT' && unitInitQty <= 1;

      if (
        isIndivisibleUnit &&
        input.quantidade !== undefined &&
        (input.quantidade !== 1 || !Number.isInteger(input.quantidade))
      ) {
        throw new ValidationError(
          `O produto "${product.nome}" é rastreado por unidade indivisível e não permite consumo parcial/fracionado.`
        );
      }

      const consumeQty = input.quantidade !== undefined ? round3(input.quantidade) : 1;

      if (!product.isReusable && isIndivisibleUnit) {
        // V18 & V17: Single-Use Indivisible Unit Rule
        if (stockUnit.usages.length > 0 || stockUnit.status !== 'Disponivel') {
          throw new ConflictError(
            'Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17).'
          );
        }

        const updatedUnit = await tx.stockUnit.updateMany({
          where: { id: stockUnit.id, status: 'Disponivel' },
          data: {
            status: 'Esgotado',
            currentClientId: clientId,
            quantidadeDisponivel: new Prisma.Decimal(0),
          },
        });
        if (updatedUnit.count === 0) {
          throw new ConflictError('Esta unidade já foi consumida concorrentemente.');
        }

        if (Number(lot.quantidadeDisponivel) >= 1) {
          await tx.productLot.update({
            where: { id: lot.id },
            data: { quantidadeDisponivel: { decrement: new Prisma.Decimal(1) } },
          });
        }
      } else {
        // Reusable unit OR multi-quantity container unit
        if (stockUnit.status === 'Esgotado') {
          throw new ValidationError('Esta unidade de estoque já está esgotada');
        }

        if (product.isReusable) {
          // V16, V17, AC 59, AC 66: Reusable Unit & Cross-Client Prevention
          if (stockUnit.currentClientId !== null && stockUnit.currentClientId !== clientId) {
            throw new ConflictError('Esta unidade de estoque já está vinculada a outro cliente.');
          }

          for (const priorUsage of stockUnit.usages) {
            if (priorUsage.attendance.clientId !== clientId) {
              throw new ConflictError('Esta unidade de estoque já está vinculada a outro cliente.');
            }
          }
        } else if (!isIndivisibleUnit && input.quantidade === undefined && stockUnit.usages.length > 0) {
          throw new ConflictError(
            'Esta unidade é de uso único e já foi utilizada anteriormente. Não é permitido reutilizar unidades de uso único (V18/V17).'
          );
        }

        if (input.quantidade !== undefined) {
          if (consumeQty > unitAvailQty + 0.0001) {
            throw new ValidationError(
              `Quantidade solicitada (${consumeQty} ${product.unidade}) excede o saldo disponível na unidade (${unitAvailQty} ${product.unidade}).`
            );
          }

          const newUnitAvail = round3(Math.max(0, unitAvailQty - consumeQty));
          const nextUnitStatus = newUnitAvail <= 0.0001 ? 'Esgotado' : 'EmUso';

          const updatedUnit = await tx.stockUnit.updateMany({
            where: {
              id: stockUnit.id,
              quantidadeDisponivel: { gte: new Prisma.Decimal(consumeQty) },
            },
            data: {
              quantidadeDisponivel: new Prisma.Decimal(newUnitAvail),
              status: nextUnitStatus,
              currentClientId: clientId,
            },
          });
          if (updatedUnit.count === 0) {
            throw new ValidationError('Saldo disponível insuficiente na unidade de estoque.');
          }

          if (Number(lot.quantidadeDisponivel) >= consumeQty) {
            await tx.productLot.update({
              where: { id: lot.id },
              data: { quantidadeDisponivel: { decrement: new Prisma.Decimal(consumeQty) } },
            });
          }
        } else {
          // Standard reusable unit usage without fractional depletion
          await tx.stockUnit.update({
            where: { id: stockUnit.id },
            data: {
              status: 'EmUso',
              currentClientId: clientId,
            },
          });
        }
      }

      const refreshedLot = await tx.productLot.findUnique({ where: { id: lot.id } });
      const saldoPosterior = Number(refreshedLot?.quantidadeDisponivel ?? 0);
      const saldoAnterior = round3(saldoPosterior + (product.isReusable && input.quantidade === undefined ? 0 : consumeQty));

      const usage = await tx.productUsage.create({
        data: {
          attendanceId,
          stockUnitId: stockUnit.id,
          productId: product.id,
          lotId: lot.id,
          quantidade: new Prisma.Decimal(consumeQty),
          unidade: product.unidade,
          status: 'Ativo',
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
          lot: { include: { product: true } },
          product: true,
          attendanceProcedure: {
            include: { procedure: true },
          },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          lotId: lot.id,
          stockUnitId: stockUnit.id,
          attendanceId,
          productUsageId: usage.id,
          tipo: 'CONSUMO',
          quantidade: new Prisma.Decimal(consumeQty),
          unidade: product.unidade,
          saldoAnterior: new Prisma.Decimal(saldoAnterior),
          saldoPosterior: new Prisma.Decimal(saldoPosterior),
          motivo: 'Consumo em atendimento clínico',
          observacoes: input.observacoes ?? null,
          status: 'Ativo',
        },
      });

      return usage;
    }

    // PATH B: Partial / Quantity Consumption by lotId or productId (FEFO)
    let targetLot: any = null;
    if (input.lotId) {
      targetLot = await tx.productLot.findUnique({
        where: { id: input.lotId },
        include: { product: true },
      });
      if (!targetLot) {
        throw new NotFoundError('Lote não encontrado');
      }
    } else if (input.productId) {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new NotFoundError('Produto não encontrado');
      }
      if (product.trackingMode === 'UNIT' && input.quantidade !== undefined && !Number.isInteger(input.quantidade)) {
        throw new ValidationError(
          `O produto "${product.nome}" é rastreado por unidade indivisível e não permite consumo fracionado.`
        );
      }

      const now = new Date();
      const candidateLots = await tx.productLot.findMany({
        where: {
          productId: input.productId,
          quantidadeDisponivel: { gt: new Prisma.Decimal(0) },
          OR: [{ dataValidade: null }, { dataValidade: { gte: now } }],
        },
        include: { product: true },
        orderBy: [{ dataValidade: 'asc' }, { createdAt: 'asc' }],
      });

      if (candidateLots.length === 0) {
        throw new ValidationError('Não há lotes válidos com saldo disponível para este produto');
      }
      targetLot = candidateLots[0];
    } else {
      throw new ValidationError('Informe stockUnitId, lotId ou productId para registrar o consumo');
    }

    const product = targetLot.product;

    if (
      product.trackingMode === 'UNIT' &&
      input.quantidade !== undefined &&
      !Number.isInteger(input.quantidade)
    ) {
      throw new ValidationError(
        `O produto "${product.nome}" é rastreado por unidade indivisível e não permite consumo fracionado.`
      );
    }

    if (
      input.unidade &&
      input.unidade.trim().toLowerCase() !== product.unidade.trim().toLowerCase()
    ) {
      throw new ValidationError(
        `Unidade de medida incompatível ("${input.unidade}"). O produto "${product.nome}" utiliza "${product.unidade}".`
      );
    }

    // Validation V15: Expired Lot Check
    if (targetLot.dataValidade !== null) {
      const expirationDate = new Date(targetLot.dataValidade);
      const today = new Date();
      if (expirationDate < today) {
        const formattedExp = expirationDate.toLocaleDateString('pt-BR');
        throw new ValidationError(
          `Lote ${targetLot.numeroLote} vencido em ${formattedExp}. Não é permitido consumir de lote vencido (V15).`
        );
      }
    }

    const consumeQty = round3(input.quantidade ?? 1);
    const availableInLot = round3(Number(targetLot.quantidadeDisponivel ?? 0));

    if (consumeQty > availableInLot + 0.0001) {
      throw new ValidationError(
        `Estoque disponível insuficiente no lote ${targetLot.numeroLote}. Disponível: ${availableInLot} ${product.unidade}, Solicitado: ${consumeQty} ${product.unidade}.`
      );
    }

    // Concurrency-safe conditional update on ProductLot
    const updatedLotCount = await tx.productLot.updateMany({
      where: {
        id: targetLot.id,
        quantidadeDisponivel: { gte: new Prisma.Decimal(consumeQty) },
      },
      data: {
        quantidadeDisponivel: { decrement: new Prisma.Decimal(consumeQty) },
      },
    });

    if (updatedLotCount.count === 0) {
      throw new ConflictError(
        `Estoque disponível insuficiente no lote ${targetLot.numeroLote} (atualização concorrente detectada).`
      );
    }

    const saldoAnterior = availableInLot;
    const saldoPosterior = round3(Math.max(0, availableInLot - consumeQty));

    const usage = await tx.productUsage.create({
      data: {
        attendanceId,
        stockUnitId: null,
        productId: product.id,
        lotId: targetLot.id,
        quantidade: new Prisma.Decimal(consumeQty),
        unidade: product.unidade,
        status: 'Ativo',
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
        lot: { include: { product: true } },
        product: true,
        attendanceProcedure: {
          include: { procedure: true },
        },
      },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        lotId: targetLot.id,
        stockUnitId: null,
        attendanceId,
        productUsageId: usage.id,
        tipo: 'CONSUMO',
        quantidade: new Prisma.Decimal(consumeQty),
        unidade: product.unidade,
        saldoAnterior: new Prisma.Decimal(saldoAnterior),
        saldoPosterior: new Prisma.Decimal(saldoPosterior),
        motivo: 'Consumo parcial/quantitativo em atendimento clínico',
        observacoes: input.observacoes ?? null,
        status: 'Ativo',
      },
    });

    return usage;
  });

  const resolvedProduct = result.stockUnit?.lot?.product ?? result.lot?.product ?? result.product;
  const resolvedLot = result.stockUnit?.lot ?? result.lot;

  return {
    id: result.id,
    attendanceId: result.attendanceId,
    attendanceDate: result.attendance.dataHora.toISOString(),
    clientId: result.attendance.clientId,
    clientName: result.attendance.client.nome,
    stockUnitId: result.stockUnitId ?? null,
    codigoSerial: result.stockUnit?.codigoSerial ?? null,
    productId: resolvedProduct?.id ?? result.productId ?? null,
    lotId: resolvedLot?.id ?? result.lotId ?? null,
    numeroLote: resolvedLot?.numeroLote ?? null,
    productName: resolvedProduct?.nome ?? 'Produto',
    isReusable: Boolean(resolvedProduct?.isReusable),
    quantidade: round3(Number(result.quantidade ?? 1)),
    unidade: result.unidade ?? resolvedProduct?.unidade ?? null,
    status: result.status,
    reversedAt: result.reversedAt ? result.reversedAt.toISOString() : null,
    reversalReason: result.reversalReason ?? null,
    attendanceProcedureId: result.attendanceProcedureId,
    procedureName: result.attendanceProcedure?.procedure?.nome ?? null,
    dataHora: result.dataHora.toISOString(),
    observacoes: result.observacoes,
    createdAt: result.createdAt.toISOString(),
  };
}

/**
 * Reverses a clinical product usage with an audit trail, restoring stock balances and recording a 'REVERSAO' InventoryMovement.
 */
export async function reverseProductUsage(
  usageId: string,
  input: ReverseProductUsageInput
): Promise<ProductUsageSummaryDto> {
  const reversed = await prisma.$transaction(async (tx) => {
    const usage = await tx.productUsage.findUnique({
      where: { id: usageId },
      include: {
        attendance: { include: { client: true } },
        stockUnit: { include: { lot: { include: { product: true } } } },
        lot: { include: { product: true } },
        product: true,
        attendanceProcedure: { include: { procedure: true } },
        inventoryMovements: true,
      },
    });

    if (!usage) {
      throw new NotFoundError('Registro de consumo de produto não encontrado');
    }

    if (usage.status === 'Estornado') {
      throw new ValidationError('Este consumo de produto já foi estornado');
    }

    const now = new Date();
    const reason = input.motivo.trim();
    const qty = round3(Number(usage.quantidade ?? 1));
    const resolvedLot = usage.lot ?? usage.stockUnit?.lot;
    const resolvedProduct = usage.product ?? resolvedLot?.product;

    let saldoAnterior = 0;
    let saldoPosterior = 0;

    if (resolvedLot) {
      saldoAnterior = round3(Number(resolvedLot.quantidadeDisponivel ?? 0));
      saldoPosterior = round3(saldoAnterior + qty);

      await tx.productLot.update({
        where: { id: resolvedLot.id },
        data: {
          quantidadeDisponivel: new Prisma.Decimal(saldoPosterior),
        },
      });
    }

    if (usage.stockUnitId && usage.stockUnit) {
      const remainingActiveUsages = await tx.productUsage.count({
        where: {
          stockUnitId: usage.stockUnitId,
          id: { not: usageId },
          status: 'Ativo',
        },
      });

      const unitInit = round3(Number(usage.stockUnit.quantidadeInicial ?? 1));
      const unitAvail = round3(Number(usage.stockUnit.quantidadeDisponivel ?? 0));
      const restoredUnitAvail = round3(Math.min(unitInit, unitAvail + qty));

      await tx.stockUnit.update({
        where: { id: usage.stockUnitId },
        data: {
          quantidadeDisponivel: new Prisma.Decimal(restoredUnitAvail),
          status: remainingActiveUsages === 0 ? 'Disponivel' : 'EmUso',
          currentClientId: remainingActiveUsages === 0 ? null : usage.stockUnit.currentClientId,
        },
      });
    }

    const updatedUsage = await tx.productUsage.update({
      where: { id: usageId },
      data: {
        status: 'Estornado',
        reversedAt: now,
        reversalReason: reason,
      },
      include: {
        attendance: { include: { client: true } },
        stockUnit: { include: { lot: { include: { product: true } } } },
        lot: { include: { product: true } },
        product: true,
        attendanceProcedure: { include: { procedure: true } },
      },
    });

    const origMovement = usage.inventoryMovements.find((m) => m.status === 'Ativo');
    if (origMovement) {
      await tx.inventoryMovement.update({
        where: { id: origMovement.id },
        data: {
          status: 'Estornado',
          reversedAt: now,
          reversalReason: reason,
        },
      });
    }

    if (resolvedProduct) {
      await tx.inventoryMovement.create({
        data: {
          productId: resolvedProduct.id,
          lotId: resolvedLot?.id ?? null,
          stockUnitId: usage.stockUnitId ?? null,
          attendanceId: usage.attendanceId,
          productUsageId: usage.id,
          tipo: 'REVERSAO',
          quantidade: new Prisma.Decimal(qty),
          unidade: usage.unidade ?? resolvedProduct.unidade,
          saldoAnterior: new Prisma.Decimal(saldoAnterior),
          saldoPosterior: new Prisma.Decimal(saldoPosterior),
          motivo: reason,
          reversedFromId: origMovement?.id ?? null,
          status: 'Ativo',
        },
      });
    }

    return updatedUsage;
  });

  const resolvedProduct = reversed.stockUnit?.lot?.product ?? reversed.lot?.product ?? reversed.product;
  const resolvedLot = reversed.stockUnit?.lot ?? reversed.lot;

  return {
    id: reversed.id,
    attendanceId: reversed.attendanceId,
    attendanceDate: reversed.attendance.dataHora.toISOString(),
    clientId: reversed.attendance.clientId,
    clientName: reversed.attendance.client.nome,
    stockUnitId: reversed.stockUnitId ?? null,
    codigoSerial: reversed.stockUnit?.codigoSerial ?? null,
    productId: resolvedProduct?.id ?? reversed.productId ?? null,
    lotId: resolvedLot?.id ?? reversed.lotId ?? null,
    numeroLote: resolvedLot?.numeroLote ?? null,
    productName: resolvedProduct?.nome ?? 'Produto',
    isReusable: Boolean(resolvedProduct?.isReusable),
    quantidade: round3(Number(reversed.quantidade ?? 1)),
    unidade: reversed.unidade ?? resolvedProduct?.unidade ?? null,
    status: reversed.status,
    reversedAt: reversed.reversedAt ? reversed.reversedAt.toISOString() : null,
    reversalReason: reversed.reversalReason ?? null,
    attendanceProcedureId: reversed.attendanceProcedureId,
    procedureName: reversed.attendanceProcedure?.procedure?.nome ?? null,
    dataHora: reversed.dataHora.toISOString(),
    observacoes: reversed.observacoes,
    createdAt: reversed.createdAt.toISOString(),
  };
}

/**
 * Corrects a product usage quantity by reversing the original usage and recording the corrected usage.
 */
export async function correctProductUsage(
  usageId: string,
  input: CorrectProductUsageInput
): Promise<ProductUsageSummaryDto> {
  if (input.novaQuantidade <= 0) {
    throw new ValidationError('A nova quantidade deve ser maior que zero');
  }

  const existing = await prisma.productUsage.findUnique({
    where: { id: usageId },
  });

  if (!existing) {
    throw new NotFoundError('Registro de consumo de produto não encontrado');
  }

  if (existing.status === 'Estornado') {
    throw new ValidationError('Este consumo de produto já foi estornado e não pode ser corrigido');
  }

  await reverseProductUsage(usageId, { motivo: `Correção de consumo: ${input.motivo}` });

  return await recordProductUsage(existing.attendanceId, {
    stockUnitId: existing.stockUnitId,
    lotId: existing.lotId,
    productId: existing.productId,
    quantidade: input.novaQuantidade,
    unidade: existing.unidade,
    attendanceProcedureId: existing.attendanceProcedureId,
    observacoes: `Consumo corrigido (${input.motivo})`,
  });
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
    trackingMode: (unit.lot.product.trackingMode as any) || 'UNIT',
    unidade: unit.lot.product.unidade,
    codigoSerial: unit.codigoSerial,
    status: unit.status as any,
    motivoStatus: unit.motivoStatus ?? null,
    quantidadeInicial: Number(unit.quantidadeInicial ?? 1),
    quantidadeDisponivel: Number(unit.quantidadeDisponivel ?? 1),
    currentClientId: unit.currentClientId,
    currentClientName: unit.currentClient?.nome ?? null,
    dataValidade: unit.lot.dataValidade ? unit.lot.dataValidade.toISOString() : null,
    isExpired,
    usageCount: unit.usages.filter((u) => u.status === 'Ativo').length,
    createdAt: unit.createdAt.toISOString(),
    usages: unit.usages.map((u) => ({
      id: u.id,
      attendanceId: u.attendanceId,
      attendanceDate: u.attendance.dataHora.toISOString(),
      clientId: u.attendance.clientId,
      clientName: u.attendance.client.nome,
      stockUnitId: unit.id,
      codigoSerial: unit.codigoSerial,
      productId: unit.lot.productId,
      lotId: unit.lotId,
      numeroLote: unit.lot.numeroLote,
      productName: unit.lot.product.nome,
      isReusable: unit.lot.product.isReusable,
      quantidade: round3(Number(u.quantidade ?? 1)),
      unidade: u.unidade ?? unit.lot.product.unidade,
      status: u.status,
      reversedAt: u.reversedAt ? u.reversedAt.toISOString() : null,
      reversalReason: u.reversalReason ?? null,
      attendanceProcedureId: u.attendanceProcedureId,
      procedureName: u.attendanceProcedure?.procedure?.nome ?? null,
      dataHora: u.dataHora.toISOString(),
      observacoes: u.observacoes,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

/**
 * Updates stock unit status (e.g. discard contaminated or broken unit),
 * persists `motivo` on StockUnit.motivoStatus, and records an InventoryMovement entry.
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

  const motivo = input.motivo ? input.motivo.trim() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const unitAvail = round3(Number(unit.quantidadeDisponivel ?? 1));
    const lotAvail = round3(Number(unit.lot.quantidadeDisponivel ?? 0));

    let nextUnitAvail = unitAvail;
    let lotDelta = 0;
    let movementType: InventoryMovementType | null = null;

    if (
      (input.status === 'Descartado' || input.status === 'Esgotado') &&
      unit.status !== 'Descartado' &&
      unit.status !== 'Esgotado'
    ) {
      nextUnitAvail = 0;
      lotDelta = -Math.min(lotAvail, unitAvail > 0 ? unitAvail : 1);
      movementType = input.status === 'Descartado' ? 'PERDA_DESCARTE' : 'AJUSTE_NEGATIVO';
    } else if (
      input.status === 'Disponivel' &&
      (unit.status === 'Descartado' || unit.status === 'Esgotado')
    ) {
      nextUnitAvail = round3(Number(unit.quantidadeInicial ?? 1));
      lotDelta = nextUnitAvail;
      movementType = 'REVERSAO';
    }

    const upd = await tx.stockUnit.update({
      where: { id: unitId },
      data: {
        status: input.status,
        motivoStatus: motivo ?? unit.motivoStatus,
        quantidadeDisponivel: new Prisma.Decimal(nextUnitAvail),
      },
      include: { lot: { include: { product: true } }, currentClient: true, usages: true },
    });

    const nextLotAvail = round3(Math.max(0, lotAvail + lotDelta));
    if (lotDelta !== 0) {
      await tx.productLot.update({
        where: { id: unit.lotId },
        data: {
          quantidadeDisponivel: new Prisma.Decimal(nextLotAvail),
        },
      });
    }

    if (movementType || motivo) {
      await tx.inventoryMovement.create({
        data: {
          productId: unit.lot.productId,
          lotId: unit.lotId,
          stockUnitId: unit.id,
          tipo: movementType ?? (input.status === 'Descartado' ? 'PERDA_DESCARTE' : 'AJUSTE_NEGATIVO'),
          quantidade: new Prisma.Decimal(Math.abs(lotDelta) || 1),
          unidade: unit.lot.product.unidade,
          saldoAnterior: new Prisma.Decimal(lotAvail),
          saldoPosterior: new Prisma.Decimal(nextLotAvail),
          motivo: motivo ?? `Mudança de status para ${input.status}`,
          status: 'Ativo',
        },
      });
    }

    return upd;
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
    trackingMode: (updated.lot.product.trackingMode as any) || 'UNIT',
    unidade: updated.lot.product.unidade,
    codigoSerial: updated.codigoSerial,
    status: updated.status as any,
    motivoStatus: updated.motivoStatus ?? null,
    quantidadeInicial: Number(updated.quantidadeInicial ?? 1),
    quantidadeDisponivel: Number(updated.quantidadeDisponivel ?? 0),
    currentClientId: updated.currentClientId,
    currentClientName: updated.currentClient?.nome ?? null,
    dataValidade: updated.lot.dataValidade ? updated.lot.dataValidade.toISOString() : null,
    isExpired,
    usageCount: updated.usages.filter((u) => u.status === 'Ativo').length,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Records a stock movement (ENTRADA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO, PERDA_DESCARTE)
 * and updates lot/unit balances transactionally.
 */
export async function recordStockMovement(
  input: StockAdjustmentInput
): Promise<InventoryMovementDto> {
  if (input.quantidade <= 0) {
    throw new ValidationError('A quantidade da movimentação deve ser maior que zero');
  }

  const created = await prisma.$transaction(async (tx) => {
    let lot: any = null;
    let product: any = null;
    let stockUnit: any = null;

    if (input.stockUnitId) {
      stockUnit = await tx.stockUnit.findUnique({
        where: { id: input.stockUnitId },
        include: { lot: { include: { product: true } } },
      });
      if (!stockUnit) {
        throw new NotFoundError('Unidade de estoque não encontrada');
      }
      lot = stockUnit.lot;
      product = lot.product;
    } else if (input.lotId) {
      lot = await tx.productLot.findUnique({
        where: { id: input.lotId },
        include: { product: true },
      });
      if (!lot) {
        throw new NotFoundError('Lote não encontrado');
      }
      product = lot.product;
    } else if (input.productId) {
      product = await tx.product.findUnique({
        where: { id: input.productId },
        include: {
          lots: { orderBy: [{ dataValidade: 'asc' }, { createdAt: 'desc' }] },
        },
      });
      if (!product) {
        throw new NotFoundError('Produto não encontrado');
      }
      lot = product.lots[0] ?? null;
    } else {
      throw new ValidationError('Informe lotId, stockUnitId ou productId para registrar a movimentação');
    }

    if (
      input.unidade &&
      input.unidade.trim().toLowerCase() !== product.unidade.trim().toLowerCase()
    ) {
      throw new ValidationError(
        `Unidade de medida incompatível ("${input.unidade}"). O produto utiliza "${product.unidade}".`
      );
    }

    const qty = round3(input.quantidade);
    const isAddition = input.tipo === 'ENTRADA' || input.tipo === 'AJUSTE_POSITIVO';

    let saldoAnterior = 0;
    let saldoPosterior = 0;

    if (lot) {
      saldoAnterior = round3(Number(lot.quantidadeDisponivel ?? 0));
      if (!isAddition && qty > saldoAnterior + 0.0001) {
        throw new ValidationError(
          `Saldo insuficiente no lote ${lot.numeroLote} para ${input.tipo}. Saldo atual: ${saldoAnterior} ${product.unidade}.`
        );
      }

      saldoPosterior = isAddition
        ? round3(saldoAnterior + qty)
        : round3(Math.max(0, saldoAnterior - qty));

      if (isAddition) {
        await tx.productLot.update({
          where: { id: lot.id },
          data: {
            quantidadeDisponivel: new Prisma.Decimal(saldoPosterior),
            ...(input.tipo === 'ENTRADA'
              ? { quantidadeInicial: { increment: new Prisma.Decimal(qty) } }
              : {}),
          },
        });
      } else {
        const res = await tx.productLot.updateMany({
          where: {
            id: lot.id,
            quantidadeDisponivel: { gte: new Prisma.Decimal(qty) },
          },
          data: {
            quantidadeDisponivel: { decrement: new Prisma.Decimal(qty) },
          },
        });
        if (res.count === 0) {
          throw new ValidationError(`Saldo insuficiente no lote ${lot.numeroLote}.`);
        }
      }
    }

    if (stockUnit) {
      const unitAvail = round3(Number(stockUnit.quantidadeDisponivel ?? 0));
      if (!isAddition && qty > unitAvail + 0.0001) {
        throw new ValidationError('Saldo insuficiente na unidade de estoque.');
      }
      const nextUnitAvail = isAddition
        ? round3(unitAvail + qty)
        : round3(Math.max(0, unitAvail - qty));

      await tx.stockUnit.update({
        where: { id: stockUnit.id },
        data: {
          quantidadeDisponivel: new Prisma.Decimal(nextUnitAvail),
          status:
            input.tipo === 'PERDA_DESCARTE' && nextUnitAvail <= 0.0001
              ? 'Descartado'
              : nextUnitAvail <= 0.0001
              ? 'Esgotado'
              : stockUnit.status,
          motivoStatus: input.motivo.trim(),
        },
      });
    }

    return await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        lotId: lot?.id ?? null,
        stockUnitId: stockUnit?.id ?? null,
        tipo: input.tipo,
        quantidade: new Prisma.Decimal(qty),
        unidade: product.unidade,
        saldoAnterior: new Prisma.Decimal(saldoAnterior),
        saldoPosterior: new Prisma.Decimal(saldoPosterior),
        motivo: input.motivo.trim(),
        observacoes: input.observacoes ? input.observacoes.trim() : null,
        status: 'Ativo',
      },
      include: {
        product: { select: { id: true, nome: true } },
        lot: { select: { id: true, numeroLote: true } },
        stockUnit: { select: { id: true, codigoSerial: true } },
      },
    });
  });

  return formatMovementDto(created);
}

/**
 * Reverses an inventory movement with a compensating 'REVERSAO' entry and restores lot balance.
 */
export async function reverseInventoryMovement(
  movementId: string,
  motivo: string
): Promise<InventoryMovementDto> {
  const existing = await prisma.inventoryMovement.findUnique({
    where: { id: movementId },
  });

  if (!existing) {
    throw new NotFoundError('Movimentação de estoque não encontrada');
  }

  if (existing.status === 'Estornado') {
    throw new ValidationError('Esta movimentação de estoque já foi estornada');
  }

  if (existing.tipo === 'REVERSAO') {
    throw new ValidationError('Não é possível estornar um lançamento de reversão');
  }

  if (existing.productUsageId) {
    await reverseProductUsage(existing.productUsageId, { motivo });
    const revMov = await prisma.inventoryMovement.findFirst({
      where: { reversedFromId: movementId },
      include: {
        product: { select: { id: true, nome: true } },
        lot: { select: { id: true, numeroLote: true } },
        stockUnit: { select: { id: true, codigoSerial: true } },
      },
    });
    return formatMovementDto(revMov!);
  }

  const rev = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const qty = round3(Number(existing.quantidade));
    const wasAddition = existing.tipo === 'ENTRADA' || existing.tipo === 'AJUSTE_POSITIVO';

    let saldoAnterior = 0;
    let saldoPosterior = 0;

    if (existing.lotId) {
      const lot = await tx.productLot.findUnique({ where: { id: existing.lotId } });
      if (lot) {
        saldoAnterior = round3(Number(lot.quantidadeDisponivel ?? 0));
        if (wasAddition && saldoAnterior < qty - 0.0001) {
          throw new ValidationError(
            'Não é possível estornar esta entrada pois parte do saldo já foi consumida.'
          );
        }
        saldoPosterior = wasAddition
          ? round3(Math.max(0, saldoAnterior - qty))
          : round3(saldoAnterior + qty);

        await tx.productLot.update({
          where: { id: lot.id },
          data: {
            quantidadeDisponivel: new Prisma.Decimal(saldoPosterior),
          },
        });
      }
    }

    await tx.inventoryMovement.update({
      where: { id: movementId },
      data: {
        status: 'Estornado',
        reversedAt: now,
        reversalReason: motivo.trim(),
      },
    });

    return await tx.inventoryMovement.create({
      data: {
        productId: existing.productId,
        lotId: existing.lotId,
        stockUnitId: existing.stockUnitId,
        tipo: 'REVERSAO',
        quantidade: new Prisma.Decimal(qty),
        unidade: existing.unidade,
        saldoAnterior: new Prisma.Decimal(saldoAnterior),
        saldoPosterior: new Prisma.Decimal(saldoPosterior),
        motivo: motivo.trim(),
        reversedFromId: existing.id,
        status: 'Ativo',
      },
      include: {
        product: { select: { id: true, nome: true } },
        lot: { select: { id: true, numeroLote: true } },
        stockUnit: { select: { id: true, codigoSerial: true } },
      },
    });
  });

  return formatMovementDto(rev);
}

/**
 * Lists inventory movements with filtering and pagination.
 */
export async function listInventoryMovements(query: Partial<InventoryMovementQueryInput> = {}) {
  const where: Prisma.InventoryMovementWhereInput = {
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.lotId ? { lotId: query.lotId } : {}),
    ...(query.stockUnitId ? { stockUnitId: query.stockUnitId } : {}),
    ...(query.attendanceId ? { attendanceId: query.attendanceId } : {}),
    ...(query.tipo && query.tipo !== 'todos' ? { tipo: query.tipo } : {}),
    ...(query.startDate || query.endDate
      ? {
          dataHora: {
            ...(query.startDate ? { gte: query.startDate } : {}),
            ...(query.endDate ? { lte: query.endDate } : {}),
          },
        }
      : {}),
  };

  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const skip = (page - 1) * limit;

  const [total, rawItems] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ dataHora: 'desc' }, { createdAt: 'desc' }],
      include: {
        product: { select: { id: true, nome: true } },
        lot: { select: { id: true, numeroLote: true } },
        stockUnit: { select: { id: true, codigoSerial: true } },
      },
    }),
  ]);

  return {
    items: rawItems.map(formatMovementDto),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export class StockService {
  static createLot = createLot;
  static registerStockUnits = registerStockUnits;
  static listAvailableUnits = listAvailableUnits;
  static recordProductUsage = recordProductUsage;
  static reverseProductUsage = reverseProductUsage;
  static correctProductUsage = correctProductUsage;
  static getStockUnitTraceability = getStockUnitTraceability;
  static updateStockUnitStatus = updateStockUnitStatus;
  static recordStockMovement = recordStockMovement;
  static reverseInventoryMovement = reverseInventoryMovement;
  static listInventoryMovements = listInventoryMovements;
}
