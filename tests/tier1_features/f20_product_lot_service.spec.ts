import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestProcedure } from '../helpers/test-fixtures';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { NotFoundError, ConflictError } from '@/lib/errors';

describe('Tier 1 Feature F20: Product Catalog & Lot Management (Phase 9)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  it('F20.1: creates single-use product catalog item with defaults', async () => {
    const product = await ProductService.createProduct({
      nome: 'Fio de PDO Espiculado 19G',
      unidade: 'envelope',
      categoria: 'Fios de Sustentação',
      marca: 'Silhouette',
      isReusable: false,
    });

    expect(product.id).toBeDefined();
    expect(product.nome).toBe('Fio de PDO Espiculado 19G');
    expect(product.isReusable).toBe(false);
    expect(product.isActive).toBe(true);
    expect(product.lotsCount).toBe(0);
    expect(product.availableUnitsCount).toBe(0);
  });

  it('F20.2: creates reusable product catalog item with procedure associations', async () => {
    const proc = await createTestProcedure({ nome: 'Preenchimento Facial' });

    const product = await ProductService.createProduct({
      nome: 'Ácido Hialurônico Juvederm Ultra Plus 1ml',
      unidade: 'seringa',
      isReusable: true,
      procedureIds: [proc.id],
    });

    expect(product.id).toBeDefined();
    expect(product.isReusable).toBe(true);

    const detailed = await ProductService.getProductById(product.id);
    expect(detailed.associatedProcedures).toHaveLength(1);
    expect(detailed.associatedProcedures[0].procedureId).toBe(proc.id);
  });

  it('F20.3: creates lot and auto-generates sequential physical stock units', async () => {
    const product = await ProductService.createProduct({
      nome: 'Toxina Botulínica Botulift 100U',
      unidade: 'frasco',
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'BOT-2026-X1',
      dataValidade: new Date('2027-12-31'),
      precoCusto: 650.0,
      quantidadeInicial: 4,
    });

    expect(lot.id).toBeDefined();
    expect(lot.numeroLote).toBe('BOT-2026-X1');
    expect(lot.totalUnitsCount).toBe(4);
    expect(lot.availableUnitsCount).toBe(4);
    expect(lot.isExpired).toBe(false);

    // Verify individual StockUnit rows in DB
    const units = await (prismaTest as any).stockUnit.findMany({
      where: { lotId: lot.id },
      orderBy: { codigoSerial: 'asc' },
    });

    expect(units).toHaveLength(4);
    expect(units[0].codigoSerial).toBe('BOT-2026-X1-001');
    expect(units[1].codigoSerial).toBe('BOT-2026-X1-002');
    expect(units[2].codigoSerial).toBe('BOT-2026-X1-003');
    expect(units[3].codigoSerial).toBe('BOT-2026-X1-004');
    expect(units.every((u: any) => u.status === 'Disponivel')).toBe(true);
  });

  it('F20.4: creates lot with custom serial codes and blocks duplicates', async () => {
    const product = await ProductService.createProduct({
      nome: 'Bioestimulador Sculptra',
      unidade: 'frasco',
    });

    const customCodes = ['SCULPT-A01', 'SCULPT-A02'];
    const lot = await StockService.createLot(product.id, {
      numeroLote: 'LOT-SCULPT-99',
      codigosSeriais: customCodes,
    });

    expect(lot.totalUnitsCount).toBe(2);

    // Attempting to create duplicate serial code throws ConflictError
    await expect(
      StockService.createLot(product.id, {
        numeroLote: 'LOT-SCULPT-100',
        codigosSeriais: ['SCULPT-A01'],
      })
    ).rejects.toThrow(ConflictError);
  });

  it('F20.5: soft-deactivates product when lots exist, hard-deletes when empty', async () => {
    // 1. Product without lots can be hard-deleted
    const emptyProduct = await ProductService.createProduct({
      nome: 'Gaze Estéril',
      unidade: 'pacote',
    });
    const deleteRes1 = await ProductService.deleteProduct(emptyProduct.id);
    expect(deleteRes1.deactivated).toBe(false);
    expect(deleteRes1.success).toBe(true);

    // 2. Product with lot is soft-deactivated
    const productWithLot = await ProductService.createProduct({
      nome: 'Agulha 30G',
      unidade: 'caixa',
    });
    await StockService.createLot(productWithLot.id, {
      numeroLote: 'AG-01',
      quantidadeInicial: 2,
    });

    const deleteRes2 = await ProductService.deleteProduct(productWithLot.id);
    expect(deleteRes2.deactivated).toBe(true);

    const reloaded = await ProductService.getProductById(productWithLot.id);
    expect(reloaded.isActive).toBe(false);
  });
});
