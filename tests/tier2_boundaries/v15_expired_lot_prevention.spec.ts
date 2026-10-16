import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { ValidationError } from '@/lib/errors';

describe('Tier 2 Boundary: Validation V15 (Expired Lot Dispensation Prevention)', () => {
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

  it('V15.1: strictly blocks usage of an individual stock unit belonging to an expired lot', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const product = await ProductService.createProduct({
      nome: 'Toxina Botulínica Vencida',
      unidade: 'frasco',
      isReusable: false,
    });

    // Lot expired 10 days ago
    const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const lot = await StockService.createLot(product.id, {
      numeroLote: 'LOTE-VENCIDO-99',
      dataValidade: expiredDate,
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    await expect(
      StockService.recordProductUsage(attendanceId, {
        stockUnitId: unit.id,
      })
    ).rejects.toThrow(/vencido.*V15/i);

    // Verify database state remains intact: zero usage records created
    const usages = await (prismaTest as any).productUsage.findMany({
      where: { stockUnitId: unit.id },
    });
    expect(usages).toHaveLength(0);

    // Unit status remains Disponivel (not consumed)
    const reloadedUnit = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
    });
    expect(reloadedUnit.status).toBe('Disponivel');
  });

  it('V15.2: permits usage of an individual stock unit belonging to a valid, unexpired lot', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const product = await ProductService.createProduct({
      nome: 'Toxina Botulínica Válida',
      unidade: 'frasco',
      isReusable: false,
    });

    // Valid lot expiring in 180 days
    const validDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const lot = await StockService.createLot(product.id, {
      numeroLote: 'LOTE-VALIDO-01',
      dataValidade: validDate,
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    const usage = await StockService.recordProductUsage(attendanceId, {
      stockUnitId: unit.id,
    });

    expect(usage.id).toBeDefined();
    expect(usage.stockUnitId).toBe(unit.id);

    const reloadedUnit = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
    });
    expect(reloadedUnit.status).toBe('Esgotado');
  });
});
