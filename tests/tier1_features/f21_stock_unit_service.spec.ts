import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F21: Stock Unit Traceability & Status Service (Phase 9)', () => {
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

  it('F21.1: registerStockUnits generates additional physical units with sequential serials', async () => {
    const product = await ProductService.createProduct({
      nome: 'Cânula 22G',
      unidade: 'unidade',
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'CAN-100',
      quantidadeInicial: 2,
    });

    const newUnits = await StockService.registerStockUnits(lot.id, {
      quantidade: 3,
    });

    expect(newUnits).toHaveLength(3);
    expect(newUnits[0].codigoSerial).toBe('CAN-100-003');
    expect(newUnits[1].codigoSerial).toBe('CAN-100-004');
    expect(newUnits[2].codigoSerial).toBe('CAN-100-005');

    const lotDetails = await (prismaTest as any).stockUnit.count({
      where: { lotId: lot.id },
    });
    expect(lotDetails).toBe(5);
  });

  it('F21.2: listAvailableUnits excludes expired lots and cross-client units', async () => {
    const clientA = await createTestClient();
    const clientB = await createTestClient();

    const product = await ProductService.createProduct({
      nome: 'Seringa Preenchedora Reutilizável',
      unidade: 'seringa',
      isReusable: true,
    });

    // 1. Valid lot with 2 units
    const validLot = await StockService.createLot(product.id, {
      numeroLote: 'VAL-2027',
      dataValidade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      quantidadeInicial: 2,
    });

    // 2. Expired lot with 1 unit
    await StockService.createLot(product.id, {
      numeroLote: 'EXP-2020',
      dataValidade: new Date('2020-01-01'),
      quantidadeInicial: 1,
    });

    // 3. Mark unit 1 in valid lot as EmUso for Client A
    const apptA = await createTestAppointment(clientA.id);
    const unitToUse = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: validLot.id },
    }))!;

    await StockService.recordProductUsage(apptA.attendances[0].id, {
      stockUnitId: unitToUse.id,
    });

    // Query available for Client A: should see unit in use (assigned to Client A) + 1 unassigned unit
    const availForA = await StockService.listAvailableUnits({
      productId: product.id,
      clientId: clientA.id,
    });
    expect(availForA).toHaveLength(2);
    expect(availForA.some((u) => u.isAssignedToCurrentClient)).toBe(true);

    // Query available for Client B: should see ONLY the 1 unassigned unit, NOT the unit assigned to Client A!
    const availForB = await StockService.listAvailableUnits({
      productId: product.id,
      clientId: clientB.id,
    });
    expect(availForB).toHaveLength(1);
    expect(availForB[0].codigoSerial).not.toBe(unitToUse.codigoSerial);

    // Expired lot units never appear
    expect(availForA.some((u) => u.numeroLote === 'EXP-2020')).toBe(false);
    expect(availForB.some((u) => u.numeroLote === 'EXP-2020')).toBe(false);
  });

  it('F21.3: getStockUnitTraceability provides complete clinical audit history', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);

    const product = await ProductService.createProduct({
      nome: 'Fio de Sustentação Espiculado',
      unidade: 'fio',
      isReusable: false,
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'LOT-FIO-55',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    await StockService.recordProductUsage(appt.attendances[0].id, {
      stockUnitId: unit.id,
      observacoes: 'Aplicação no terço médio facial',
    });

    const traceability = await StockService.getStockUnitTraceability(unit.id);
    expect(traceability.codigoSerial).toBe('LOT-FIO-55-001');
    expect(traceability.status).toBe('Esgotado');
    expect(traceability.usageCount).toBe(1);
    expect(traceability.usages[0].clientName).toBe(client.nome);
    expect(traceability.usages[0].observacoes).toBe('Aplicação no terço médio facial');
  });

  it('F21.4: updateStockUnitStatus marks unit as Descartado', async () => {
    const product = await ProductService.createProduct({
      nome: 'Agulha Hipodérmica',
      unidade: 'unidade',
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'AG-DISC',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    const updated = await StockService.updateStockUnitStatus(unit.id, {
      status: 'Descartado',
      motivo: 'Embalagem violada no transporte',
    });

    expect(updated.status).toBe('Descartado');
  });
});
