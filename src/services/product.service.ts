import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/lib/errors';
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

export class ProductService {
  static listProducts = listProducts;
  static getProductById = getProductById;
  static createProduct = createProduct;
  static updateProduct = updateProduct;
  static deleteProduct = deleteProduct;
}
