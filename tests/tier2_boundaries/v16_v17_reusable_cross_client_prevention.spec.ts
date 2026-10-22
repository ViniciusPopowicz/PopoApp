import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { ConflictError } from '@/lib/errors';

describe('Tier 2 Boundary: Validations V16, V17 & AC 59, AC 66 (Reusable Unit Same-Client Reuse vs Cross-Client Prevention)', () => {
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

  it('V16 & V17 (AC 59 & AC 66): allows same-client reuse and strictly blocks cross-client reuse with Portuguese error', async () => {
    const clientA = await createTestClient({ nome: 'Alice Silva' });
    const clientB = await createTestClient({ nome: 'Beatriz Santos' });

    const apptA1 = await createTestAppointment(clientA.id);
    const apptA2 = await createTestAppointment(clientA.id);
    const apptB = await createTestAppointment(clientB.id);

    const product = await ProductService.createProduct({
      nome: 'Ácido Hialurônico 1ml Reutilizável',
      unidade: 'seringa',
      isReusable: true, // Reusable by same client
    });

    const lot = await StockService.createLot(product.id, {
      numeroLote: 'LOT-AH-100',
      quantidadeInicial: 1,
    });

    const unit = (await (prismaTest as any).stockUnit.findFirst({
      where: { lotId: lot.id },
    }))!;

    // 1. Client A consumes unit in Attendance 1 -> MUST SUCCEED
    const usageA1 = await StockService.recordProductUsage(apptA1.attendances[0].id, {
      stockUnitId: unit.id,
      observacoes: 'Primeira aplicação de 0.5ml em lábios',
    });
    expect(usageA1.id).toBeDefined();

    const unitAfterA1 = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
    });
    expect(unitAfterA1.status).toBe('EmUso');
    expect(unitAfterA1.currentClientId).toBe(clientA.id);

    // 2. Client A reuses the same physical unit in Attendance 2 -> MUST SUCCEED (V16)
    const usageA2 = await StockService.recordProductUsage(apptA2.attendances[0].id, {
      stockUnitId: unit.id,
      observacoes: 'Retoque de 0.5ml restante em lábios da mesma cliente',
    });
    expect(usageA2.id).toBeDefined();

    // 3. Client B attempts to consume unit in Attendance 3 -> MUST BE REJECTED (V17, AC 59, AC 66)
    await expect(
      StockService.recordProductUsage(apptB.attendances[0].id, {
        stockUnitId: unit.id,
        observacoes: 'Tentativa indevida de uso em outra cliente',
      })
    ).rejects.toThrow('Esta unidade de estoque já está vinculada a outro cliente.');

    // 4. Verify database integrity: zero usages created for Client B
    const bUsages = await (prismaTest as any).productUsage.findMany({
      where: {
        stockUnitId: unit.id,
        attendance: { clientId: clientB.id },
      },
    });
    expect(bUsages).toHaveLength(0);

    // Unit remains assigned to Client A
    const unitFinal = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
    });
    expect(unitFinal.currentClientId).toBe(clientA.id);
  });
});
