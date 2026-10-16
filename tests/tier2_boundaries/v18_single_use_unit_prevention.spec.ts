import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { ConflictError } from '@/lib/errors';

describe('Tier 2 Boundary: Validation V18 & AC 59 (Single-Use Product Unit Prevention)', () => {
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

  it('V18.1: permits first usage and transitions single-use unit to Esgotado', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);

    const product = await ProductService.createProduct({
      nome: 'Fio de PDO Parafuso 29G',
      unidade: 'unidade',
      isReusable: false, // Single-use
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'PDO-SINGLE-01',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    const usage = await StockService.recordProductUsage(appt.attendances[0].id, {
      stockUnitId: unit.id,
    });
    expect(usage.id).toBeDefined();

    const reloaded = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
    });
    expect(reloaded.status).toBe('Esgotado');
    expect(reloaded.currentClientId).toBe(client.id);
  });

  it('V18.2: strictly rejects second usage of a single-use unit for the same client', async () => {
    const client = await createTestClient();
    const appt1 = await createTestAppointment(client.id);
    const appt2 = await createTestAppointment(client.id);

    const product = await ProductService.createProduct({
      nome: 'Agulha Estéril Descartável',
      unidade: 'unidade',
      isReusable: false,
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'AG-SINGLE-02',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    // First usage succeeds
    await StockService.recordProductUsage(appt1.attendances[0].id, {
      stockUnitId: unit.id,
    });

    // Second usage for same client must fail
    await expect(
      StockService.recordProductUsage(appt2.attendances[0].id, {
        stockUnitId: unit.id,
      })
    ).rejects.toThrow(/uso único.*V18/i);
  });

  it('V18.3: strictly rejects second usage of a single-use unit for a different client', async () => {
    const clientA = await createTestClient();
    const clientB = await createTestClient();
    const apptA = await createTestAppointment(clientA.id);
    const apptB = await createTestAppointment(clientB.id);

    const product = await ProductService.createProduct({
      nome: 'Cânula Estéril Descartável',
      unidade: 'unidade',
      isReusable: false,
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'CAN-SINGLE-03',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    // First usage for client A succeeds
    await StockService.recordProductUsage(apptA.attendances[0].id, {
      stockUnitId: unit.id,
    });

    // Second usage for client B must fail
    await expect(
      StockService.recordProductUsage(apptB.attendances[0].id, {
        stockUnitId: unit.id,
      })
    ).rejects.toThrow();
  });
});
