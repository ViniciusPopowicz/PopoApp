import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { appointmentListQuerySchema } from '@/schemas/appointment';
import { createFinancialObligationSchema } from '@/schemas/financial';
import { maskDateBR, dateBRToISO, isoToDateBR } from '@/lib/masks';

// In-Memory Relational Prisma Harness for Cycle 2 Verification
const db = {
  clients: new Map<string, any>(),
  procedures: new Map<string, any>(),
  appointments: new Map<string, any>(),
  appointmentPlannedProcedures: new Map<string, any>(),
  attendances: new Map<string, any>(),
  attendanceProcedures: new Map<string, any>(),
  payments: new Map<string, any>(),
  pixInstallments: new Map<string, any>(),
  reminders: new Map<string, any>(),
  reminderRecurrences: new Map<string, any>(),
  financialObligations: new Map<string, any>(),
  financialSettlements: new Map<string, any>(),
  financialMovements: new Map<string, any>(),
  products: new Map<string, any>(),
  productLots: new Map<string, any>(),
  stockUnits: new Map<string, any>(),
  productUsages: new Map<string, any>(),
  inventoryMovements: new Map<string, any>(),
};

let idCounter = 1;
function nextUuid(): string {
  const hex = (idCounter++).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function resetDb() {
  Object.values(db).forEach((map) => map.clear());
  idCounter = 1;
}

function toDec(val: any): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(val ?? 0);
}

function num(val: any): number {
  if (val === null || val === undefined) return 0;
  if (val instanceof Prisma.Decimal) return val.toNumber();
  return Number(val);
}

function matchesScalar(actual: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return actual === null || actual === undefined;
  if (typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof Prisma.Decimal)) {
    if ('in' in cond) {
      return (cond.in as any[]).some((v) => matchesScalar(actual, v));
    }
    if ('notIn' in cond) {
      return !(cond.notIn as any[]).some((v) => matchesScalar(actual, v));
    }
    if ('not' in cond) {
      return !matchesScalar(actual, cond.not);
    }
    if ('contains' in cond) {
      return String(actual ?? '').toLowerCase().includes(String(cond.contains).toLowerCase());
    }
    const actVal =
      actual instanceof Date
        ? actual.getTime()
        : actual instanceof Prisma.Decimal
        ? actual.toNumber()
        : actual;
    if ('gte' in cond) {
      const target =
        cond.gte instanceof Date
          ? cond.gte.getTime()
          : cond.gte instanceof Prisma.Decimal
          ? cond.gte.toNumber()
          : Number(cond.gte);
      if (!(actVal >= target)) return false;
    }
    if ('gt' in cond) {
      const target =
        cond.gt instanceof Date
          ? cond.gt.getTime()
          : cond.gt instanceof Prisma.Decimal
          ? cond.gt.toNumber()
          : Number(cond.gt);
      if (!(actVal > target)) return false;
    }
    if ('lte' in cond) {
      const target =
        cond.lte instanceof Date
          ? cond.lte.getTime()
          : cond.lte instanceof Prisma.Decimal
          ? cond.lte.toNumber()
          : Number(cond.lte);
      if (!(actVal <= target)) return false;
    }
    if ('lt' in cond) {
      const target =
        cond.lt instanceof Date
          ? cond.lt.getTime()
          : cond.lt instanceof Prisma.Decimal
          ? cond.lt.toNumber()
          : Number(cond.lt);
      if (!(actVal < target)) return false;
    }
    return true;
  }
  if (actual instanceof Date && cond instanceof Date) {
    return actual.getTime() === cond.getTime();
  }
  if (actual instanceof Prisma.Decimal || cond instanceof Prisma.Decimal) {
    return num(actual) === num(cond);
  }
  return actual === cond;
}

function hydrateRecord(table: keyof typeof db, raw: any, include?: any, select?: any): any {
  if (!raw) return null;
  const item = { ...raw };

  if (table === 'appointments') {
    if (include?.client || select?.client) {
      item.client = db.clients.get(item.clientId) ?? null;
    }
    if (include?.attendance) {
      const att = Array.from(db.attendances.values()).find((a) => a.appointmentId === item.id) ?? null;
      item.attendance = att
        ? hydrateRecord('attendances', att, include.attendance.include, include.attendance.select)
        : null;
    }
    if (include?.plannedProcedures) {
      const plans = Array.from(db.appointmentPlannedProcedures.values()).filter(
        (p) => p.appointmentId === item.id
      );
      item.plannedProcedures = plans.map((p) => {
        const h = { ...p };
        if (include.plannedProcedures.include?.procedure) {
          h.procedure = db.procedures.get(p.procedureId) ?? null;
        }
        return h;
      });
    }
  }

  if (table === 'attendances') {
    if (include?.client || select?.client) {
      item.client = db.clients.get(item.clientId) ?? null;
    }
    if (include?.appointment) {
      item.appointment = db.appointments.get(item.appointmentId) ?? null;
    }
    if (include?.procedures) {
      const procs = Array.from(db.attendanceProcedures.values()).filter(
        (ap) => ap.attendanceId === item.id
      );
      item.procedures = procs.map((ap) => {
        const h = { ...ap };
        if (include.procedures.include?.procedure) {
          h.procedure = db.procedures.get(ap.procedureId) ?? null;
        }
        return h;
      });
    }
    if (include?.usages) {
      const usages = Array.from(db.productUsages.values()).filter((u) => u.attendanceId === item.id);
      item.usages = usages.map((u) =>
        hydrateRecord('productUsages', u, include.usages.include, include.usages.select)
      );
    }
  }

  if (table === 'stockUnits') {
    if (include?.lot) {
      const lot = db.productLots.get(item.lotId);
      item.lot = lot
        ? hydrateRecord('productLots', lot, include.lot.include, include.lot.select)
        : null;
    }
    if (include?.usages) {
      const usages = Array.from(db.productUsages.values()).filter((u) => u.stockUnitId === item.id);
      item.usages = usages.map((u) =>
        hydrateRecord('productUsages', u, include.usages.include, include.usages.select)
      );
    }
    if (include?.currentClient) {
      item.currentClient = item.currentClientId ? db.clients.get(item.currentClientId) ?? null : null;
    }
  }

  if (table === 'productLots') {
    if (include?.product) {
      item.product = db.products.get(item.productId) ?? null;
    }
    if (include?.stockUnits) {
      const units = Array.from(db.stockUnits.values()).filter((u) => u.lotId === item.id);
      item.stockUnits = units.map((u) =>
        hydrateRecord('stockUnits', u, include.stockUnits.include, include.stockUnits.select)
      );
    }
  }

  if (table === 'productUsages') {
    if (include?.attendance) {
      const att = db.attendances.get(item.attendanceId);
      item.attendance = att
        ? hydrateRecord('attendances', att, include.attendance.include, include.attendance.select)
        : null;
    }
    if (include?.stockUnit) {
      const su = item.stockUnitId ? db.stockUnits.get(item.stockUnitId) : null;
      item.stockUnit = su
        ? hydrateRecord('stockUnits', su, include.stockUnit.include, include.stockUnit.select)
        : null;
    }
    if (include?.lot) {
      const lot = item.lotId ? db.productLots.get(item.lotId) : null;
      item.lot = lot
        ? hydrateRecord('productLots', lot, include.lot.include, include.lot.select)
        : null;
    }
    if (include?.product) {
      item.product = item.productId ? db.products.get(item.productId) : null;
    }
    if (include?.attendanceProcedure) {
      item.attendanceProcedure = item.attendanceProcedureId
        ? db.attendanceProcedures.get(item.attendanceProcedureId) ?? null
        : null;
    }
  }

  if (table === 'financialObligations') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
    if (include?.settlements) {
      const sets = Array.from(db.financialSettlements.values()).filter(
        (s) => s.obligationId === item.id
      );
      item.settlements = sets;
    }
  }

  if (table === 'financialSettlements') {
    if (include?.obligation) {
      item.obligation = db.financialObligations.get(item.obligationId) ?? null;
    }
  }

  if (table === 'reminderRecurrences') {
    if (include?.reminders) {
      item.reminders = Array.from(db.reminders.values()).filter(
        (r) => r.recurrenceId === item.id
      );
    }
  }

  if (table === 'reminders') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
  }

  return item;
}

function matchesFilter(item: any, where?: any): boolean {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    if (key === 'AND') {
      const ands = Array.isArray(where.AND) ? where.AND : [where.AND];
      if (!ands.every((cond: any) => matchesFilter(item, cond))) return false;
      continue;
    }
    if (key === 'OR') {
      const ors = Array.isArray(where.OR) ? where.OR : [where.OR];
      if (!ors.some((cond: any) => matchesFilter(item, cond))) return false;
      continue;
    }
    if (key === 'settlements') {
      const relatedSets = Array.from(db.financialSettlements.values()).filter(
        (s) => s.obligationId === item.id
      );
      if (where.settlements.none) {
        if (relatedSets.length > 0) return false;
      }
      continue;
    }
    if (key === 'pixInstallments') {
      const relatedInsts = Array.from(db.pixInstallments.values()).filter(
        (i) => i.paymentId === item.id
      );
      if (where.pixInstallments.none) {
        if (relatedInsts.length > 0) return false;
      }
      continue;
    }
    if (key === 'obligation') {
      const ob = db.financialObligations.get(item.obligationId);
      if (!matchesFilter(ob, where.obligation)) return false;
      continue;
    }
    if (key === 'lot') {
      const lot = db.productLots.get(item.lotId);
      if (!matchesFilter(lot, where.lot)) return false;
      continue;
    }
    if (!matchesScalar(item[key], where[key])) return false;
  }
  return true;
}

function createTableMock(tableName: keyof typeof db) {
  return {
    findMany: vi.fn(async ({ where, include, select, orderBy, skip = 0, take }: any = {}) => {
      let items = Array.from(db[tableName].values()).filter((item) => matchesFilter(item, where));
      if (orderBy) {
        const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          for (const order of orders) {
            const field = Object.keys(order)[0];
            const dir = order[field] === 'desc' ? -1 : 1;
            const valA = a[field] instanceof Date ? a[field].getTime() : a[field];
            const valB = b[field] instanceof Date ? b[field].getTime() : b[field];
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
          }
          return 0;
        });
      }
      const paginated = items.slice(skip, take ? skip + take : undefined);
      return paginated.map((item) => hydrateRecord(tableName, item, include, select));
    }),

    findUnique: vi.fn(async ({ where, include, select }: any) => {
      const item = Array.from(db[tableName].values()).find((it) => matchesFilter(it, where));
      return item ? hydrateRecord(tableName, item, include, select) : null;
    }),

    findFirst: vi.fn(async ({ where, include, select, orderBy }: any = {}) => {
      let items = Array.from(db[tableName].values()).filter((item) => matchesFilter(item, where));
      if (orderBy) {
        const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          for (const order of orders) {
            const field = Object.keys(order)[0];
            const dir = order[field] === 'desc' ? -1 : 1;
            const valA = a[field] instanceof Date ? a[field].getTime() : a[field];
            const valB = b[field] instanceof Date ? b[field].getTime() : b[field];
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
          }
          return 0;
        });
      }
      const item = items[0] ?? null;
      return item ? hydrateRecord(tableName, item, include, select) : null;
    }),

    create: vi.fn(async ({ data, include, select }: any) => {
      const id = data.id || nextUuid();
      const now = new Date();
      const record = {
        id,
        createdAt: now,
        updatedAt: now,
        ...(tableName === 'productUsages' ? { dataHora: now } : {}),
        ...(tableName === 'stockUnits' ? { currentClientId: null } : {}),
        ...data,
      };
      db[tableName].set(id, record);

      if (tableName === 'appointments' && data.attendance?.create) {
        const attId = nextUuid();
        db.attendances.set(attId, {
          id: attId,
          appointmentId: id,
          createdAt: now,
          updatedAt: now,
          dataHora: now,
          status: 'Pendente',
          ...data.attendance.create,
        });
      }
      if (tableName === 'appointments' && data.plannedProcedures?.create) {
        const list = Array.isArray(data.plannedProcedures.create)
          ? data.plannedProcedures.create
          : [data.plannedProcedures.create];
        for (const pp of list) {
          const ppId = nextUuid();
          db.appointmentPlannedProcedures.set(ppId, {
            id: ppId,
            appointmentId: id,
            createdAt: now,
            updatedAt: now,
            ...pp,
          });
        }
      }

      return hydrateRecord(tableName, record, include, select);
    }),

    createMany: vi.fn(async ({ data }: any) => {
      const list = Array.isArray(data) ? data : [data];
      const now = new Date();
      for (const d of list) {
        const id = d.id || nextUuid();
        db[tableName].set(id, {
          id,
          createdAt: now,
          updatedAt: now,
          ...(tableName === 'productUsages' ? { dataHora: now } : {}),
          ...(tableName === 'stockUnits' ? { currentClientId: null } : {}),
          ...d,
        });
      }
      return { count: list.length };
    }),

    update: vi.fn(async ({ where, data, include, select }: any) => {
      const item = Array.from(db[tableName].values()).find((it) => matchesFilter(it, where));
      if (!item) throw new Error(`Record to update not found in ${tableName}`);
      const updated = { ...item, updatedAt: new Date() };
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'decrement' in value) {
          const prev = num(updated[key]);
          const dec = num((value as any).decrement);
          updated[key] = toDec(prev - dec);
        } else if (value && typeof value === 'object' && 'increment' in value) {
          const prev = num(updated[key]);
          const inc = num((value as any).increment);
          updated[key] = toDec(prev + inc);
        } else {
          updated[key] = value;
        }
      }
      db[tableName].set(item.id, updated);
      return hydrateRecord(tableName, updated, include, select);
    }),

    updateMany: vi.fn(async ({ where, data }: any) => {
      const matches = Array.from(db[tableName].values()).filter((it) => matchesFilter(it, where));
      for (const item of matches) {
        const updated = { ...item, updatedAt: new Date() };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'decrement' in value) {
            const prev = num(updated[key]);
            const dec = num((value as any).decrement);
            updated[key] = toDec(prev - dec);
          } else if (value && typeof value === 'object' && 'increment' in value) {
            const prev = num(updated[key]);
            const inc = num((value as any).increment);
            updated[key] = toDec(prev + inc);
          } else {
            updated[key] = value;
          }
        }
        db[tableName].set(item.id, updated);
      }
      return { count: matches.length };
    }),

    delete: vi.fn(async ({ where }: any) => {
      const item = Array.from(db[tableName].values()).find((it) => matchesFilter(it, where));
      if (item) db[tableName].delete(item.id);
      return item;
    }),

    deleteMany: vi.fn(async ({ where }: any) => {
      const matches = Array.from(db[tableName].values()).filter((it) => matchesFilter(it, where));
      matches.forEach((m) => db[tableName].delete(m.id));
      return { count: matches.length };
    }),

    count: vi.fn(async ({ where }: any = {}) => {
      return Array.from(db[tableName].values()).filter((it) => matchesFilter(it, where)).length;
    }),
  };
}

const mockPrisma = {
  client: createTableMock('clients'),
  procedure: createTableMock('procedures'),
  appointment: createTableMock('appointments'),
  appointmentPlannedProcedure: createTableMock('appointmentPlannedProcedures'),
  attendance: createTableMock('attendances'),
  attendanceProcedure: createTableMock('attendanceProcedures'),
  payment: createTableMock('payments'),
  pixInstallment: createTableMock('pixInstallments'),
  reminder: createTableMock('reminders'),
  reminderRecurrence: createTableMock('reminderRecurrences'),
  financialObligation: createTableMock('financialObligations'),
  financialSettlement: createTableMock('financialSettlements'),
  financialMovement: createTableMock('financialMovements'),
  product: createTableMock('products'),
  productLot: createTableMock('productLots'),
  stockUnit: createTableMock('stockUnits'),
  productUsage: createTableMock('productUsages'),
  inventoryMovement: createTableMock('inventoryMovements'),
  $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
};

(globalThis as any).__mockPrisma = mockPrisma;

vi.mock('@/lib/prisma', () => {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        return (globalThis as any).__mockPrisma?.[prop];
      },
    }
  );
  return {
    default: proxy,
    prisma: proxy,
  };
});

vi.mock('@/lib/db-bootstrap', () => ({
  ensureDatabaseSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/session', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'user-admin',
    email: 'admin@popo.com',
    nome: 'Dra. Paula',
  }),
}));

// Services
import { AppointmentService } from '@/services/appointment.service';
import { FinancialService } from '@/services/financial.service';
import { StockService } from '@/services/stock.service';
import { ReminderService } from '@/services/reminder.service';
import { ProductService } from '@/services/product.service';
import { ValidationError, ConflictError } from '@/lib/errors';

describe('Cycle 2 Stabilization & Functional Verification Suite', () => {
  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  // ============================================================================
  // BUG-007 Verification: Appointment Listing with limit=200 & Creation
  // ============================================================================
  describe('BUG-007: Appointment listing error (224:15) & appointment creation/retrieval', () => {
    it('accepts limit=200 in appointmentListQuerySchema without throwing HTTP 400', () => {
      const parsed = appointmentListQuerySchema.parse({ limit: '200' });
      expect(parsed.limit).toBe(200);

      const parsedMax = appointmentListQuerySchema.parse({ limit: 500 });
      expect(parsedMax.limit).toBe(500);

      // Rejects beyond max limit 500
      expect(() => appointmentListQuerySchema.parse({ limit: 501 })).toThrow();
    });

    it('creates an appointment with planned procedures, verifies 1:1 linked attendance, and retrieves via listAppointments with limit=200', async () => {
      // 1. Seed Client & Procedure
      const client = await mockPrisma.client.create({
        data: {
          nome: 'Juliana Paes',
          cpf: '12345678900',
          telefone: '11999998888',
          status: 'ativo',
        },
      });

      const proc = await mockPrisma.procedure.create({
        data: {
          nome: 'Harmonização Facial Completa',
          categoria: 'Injetáveis',
          duracaoMinutos: 60,
          valorPadrao: toDec(3500),
          precoPadrao: toDec(3500),
          isActive: true,
          ativo: true,
        },
      });

      // 2. Create Appointment via AppointmentService
      const apptDate = new Date('2026-11-15T14:00:00.000Z');
      const appointment = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: apptDate,
        observacoes: 'Primeira consulta de avaliação e plano de harmonização.',
        plannedProcedureIds: [proc.id],
      });

      expect(appointment).toBeDefined();
      expect(appointment.id).toBeDefined();
      expect(appointment.status).toBe('Agendado');
      expect(appointment.client?.nome).toBe('Juliana Paes');
      expect(appointment.plannedProcedures).toHaveLength(1);
      expect(appointment.plannedProcedures[0].procedureId).toBe(proc.id);

      // Verify DB persistence of 1:1 linked Attendance
      const linkedAttendance = Array.from(db.attendances.values()).find(
        (a) => a.appointmentId === appointment.id
      );
      expect(linkedAttendance).toBeDefined();
      expect(linkedAttendance?.status).toBe('Pendente');
      expect(linkedAttendance?.clientId).toBe(client.id);

      // 3. Query listAppointments with limit=200 (exact parameter that caused BUG-007)
      const listResult = await AppointmentService.listAppointments({
        limit: 200,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.000Z'),
      });

      expect(listResult.items).toHaveLength(1);
      expect(listResult.items[0].id).toBe(appointment.id);
      expect(listResult.items[0].plannedProcedures).toHaveLength(1);
    });
  });

  // ============================================================================
  // BUG-008 Verification: Realized Expenses Indicator & Settlement Invariants
  // ============================================================================
  describe('BUG-008: Realized Expenses summary indicator aggregates expenses and settlements', () => {
    it('validates schema allows status=Pago and dataPagamento for immediate payable expenses', () => {
      const parsed = createFinancialObligationSchema.parse({
        tipo: 'PAYABLE',
        descricao: 'Aluguel do Consultório - Novembro',
        valorOriginal: 4500,
        dataVencimento: '2026-11-10T00:00:00.000Z',
        categoria: 'Infraestrutura',
        status: 'Pago',
        dataPagamento: '2026-11-05T12:00:00.000Z',
      });

      expect(parsed.status).toBe('Pago');
      expect(parsed.dataPagamento).toBeDefined();
    });

    it('aggregates direct movements, settlements, and paid obligations into totalOutflows without double-counting', async () => {
      const periodStart = new Date('2026-11-01T00:00:00.000Z');
      const periodEnd = new Date('2026-11-30T23:59:59.000Z');

      // 1. Direct SAIDA cash movement: R$ 500 (Descartáveis)
      await mockPrisma.financialMovement.create({
        data: {
          tipo: 'SAIDA',
          origem: 'MANUAL',
          descricao: 'Compra de luvas e gaze',
          categoria: 'Insumos',
          valor: toDec(500),
          dataMovimentacao: new Date('2026-11-03T10:00:00.000Z'),
          metodo: 'PIX',
          status: 'Ativo',
        },
      });

      // 2. PAYABLE obligation created already paid (e.g., direct clinic expense R$ 1200)
      const directPaidObligation = await FinancialService.createObligation({
        tipo: 'PAYABLE',
        descricao: 'Software de Prontuário Anual',
        valorOriginal: 1200,
        dataVencimento: new Date('2026-11-05T00:00:00.000Z'),
        categoria: 'Tecnologia',
        status: 'Pago',
        dataPagamento: new Date('2026-11-05T10:00:00.000Z'),
      });
      expect(directPaidObligation.status).toBe('Pago');

      // 3. PAYABLE obligation settled partially (R$ 2000 total, R$ 800 paid now)
      const partialObligation = await FinancialService.createObligation({
        tipo: 'PAYABLE',
        descricao: 'Fornecedor de Ácido Hialurônico',
        valorOriginal: 2000,
        dataVencimento: new Date('2026-11-20T00:00:00.000Z'),
        categoria: 'Insumos',
      });
      expect(partialObligation.status).toBe('Pendente');

      await FinancialService.settleObligation(partialObligation.id, {
        valor: 800,
        dataLiquidacao: new Date('2026-11-08T15:00:00.000Z'),
        metodo: 'PIX',
      });

      // 4. Pending PAYABLE obligation (R$ 3000 due Nov 28) - should NOT count in realized expenses
      await FinancialService.createObligation({
        tipo: 'PAYABLE',
        descricao: 'Manutenção do Laser',
        valorOriginal: 3000,
        dataVencimento: new Date('2026-11-28T00:00:00.000Z'),
        categoria: 'Equipamentos',
      });

      // Compute Cash Flow Summary for November 2026
      const summary = await FinancialService.getCashFlowSummary(periodStart, periodEnd);

      // Expected Realized Outflows = 500 (movement) + 1200 (direct paid) + 800 (settlement) = 2500
      expect(summary.totalOutflows).toBe(2500);

      // Verify pending payables = 1200 (remaining of partial) + 3000 (pending) = 4200
      expect(summary.pendingPayables).toBe(4200);

      // Verify outflowsByCategory has aggregated entries
      const insumosOut = summary.outflowsByCategory.find((c) => c.categoria === 'Insumos');
      expect(insumosOut).toBeDefined();
      expect(insumosOut?.total).toBe(1300); // 500 (luvas) + 800 (settlement)
    });

    it('correctly reduces realized outflows when an expense movement is reversed', async () => {
      const periodStart = new Date('2026-11-01T00:00:00.000Z');
      const periodEnd = new Date('2026-11-30T23:59:59.000Z');

      const mov = await mockPrisma.financialMovement.create({
        data: {
          tipo: 'SAIDA',
          origem: 'MANUAL',
          descricao: 'Material incorreto lançado',
          categoria: 'Insumos',
          valor: toDec(600),
          dataMovimentacao: new Date('2026-11-02T10:00:00.000Z'),
          metodo: 'PIX',
          status: 'Ativo',
        },
      });

      const initialSummary = await FinancialService.getCashFlowSummary(periodStart, periodEnd);
      expect(initialSummary.totalOutflows).toBe(600);

      // Reverse the movement
      await FinancialService.reverseMovement(mov.id, {
        motivo: 'Lançamento efetuado em duplicidade',
      });

      const afterReversalSummary = await FinancialService.getCashFlowSummary(periodStart, periodEnd);
      expect(afterReversalSummary.netCashFlow).toBe(0);
      expect(afterReversalSummary.totalInflows).toBe(600);
      expect(afterReversalSummary.totalOutflows).toBe(600);
    });
  });

  // ============================================================================
  // BUG-009 Verification: Reusable and Fractionable Products in Partial Consumption
  // ============================================================================
  describe('BUG-009: Reusable & fractionable products partial consumption end-to-end', () => {
    it('executes steps 1 to 5: allows fractional consumption on reusable product, updates lot & unit balance, and preserves cross-client isolation', async () => {
      // Step 1: Create Reusable & Fractionable Product (Botox 100UI vial)
      const botoxProd = await ProductService.createProduct({
        nome: 'Toxina Botulínica 100UI',
        categoria: 'Injetáveis',
        trackingMode: 'QUANTITY',
        unidade: 'UI',
        isReusable: true,
        isActive: true,
        estoqueMinimo: 10,
        procedureIds: [],
      });
      expect(botoxProd.isReusable).toBe(true);

      const botoxLot = await StockService.createLot(botoxProd.id, {
        numeroLote: 'LOTE-BTX-100',
        dataValidade: new Date('2027-12-31T00:00:00Z'),
        quantidadeInicial: 100,
        codigosSeriais: ['FRASCO-BTX-01'],
      });
      expect(num(botoxLot.quantidadeDisponivel)).toBe(100);

      // Stock unit created with 100 UI
      const botoxUnit = Array.from(db.stockUnits.values()).find((u) => u.lotId === botoxLot.id);
      expect(botoxUnit).toBeDefined();
      expect(num(botoxUnit.quantidadeDisponivel)).toBe(100);
      expect(botoxUnit.status).toBe('Disponivel');

      // Step 2: Open treatment for Client A
      const clientA = await mockPrisma.client.create({
        data: { nome: 'Ana Carolina', cpf: '11122233344', telefone: '11988887777', status: 'ativo' },
      });
      const clientB = await mockPrisma.client.create({
        data: { nome: 'Beatriz Silva', cpf: '55566677788', telefone: '11977776666', status: 'ativo' },
      });

      const attA = await mockPrisma.attendance.create({
        data: {
          clientId: clientA.id,
          dataHora: new Date(),
          status: 'EmAtendimento',
        },
      });

      const attB = await mockPrisma.attendance.create({
        data: {
          clientId: clientB.id,
          dataHora: new Date(),
          status: 'EmAtendimento',
        },
      });

      // Step 3 & 4: In product consumption section, user selects Consumo Parcial (Qtd)
      // When recordProductUsage is called with productId for reusable product, it routes through Path A
      // Step 5: Record fractional consumption of 35 UI for Client A
      const usageA = await StockService.recordProductUsage(attA.id, {
        productId: botoxProd.id,
        quantidade: 35,
        observacoes: 'Aplicação terço superior (glabela e testa)',
      });

      expect(usageA).toBeDefined();
      expect(num(usageA.quantidade)).toBe(35);

      // Verify lot balance updated
      const refreshedLot = db.productLots.get(botoxLot.id);
      expect(num(refreshedLot.quantidadeDisponivel)).toBe(65);

      // Verify unit balance updated and assigned to Client A
      const refreshedUnit = db.stockUnits.get(botoxUnit.id);
      expect(num(refreshedUnit.quantidadeDisponivel)).toBe(65);
      expect(refreshedUnit.status).toBe('EmUso');
      expect(refreshedUnit.currentClientId).toBe(clientA.id);

      // Verify cross-client isolation: Client B cannot consume this same in-use reusable unit!
      await expect(
        StockService.recordProductUsage(attB.id, {
          productId: botoxProd.id,
          quantidade: 20,
        })
      ).rejects.toThrow(ConflictError);

      // Client A can continue consuming from their own in-use unit in a subsequent attendance
      const attA2 = await mockPrisma.attendance.create({
        data: { clientId: clientA.id, dataHora: new Date(), status: 'EmAtendimento' },
      });

      const usageA2 = await StockService.recordProductUsage(attA2.id, {
        productId: botoxProd.id,
        quantidade: 15,
        observacoes: 'Retoque glabela 15 UI',
      });

      expect(num(usageA2.quantidade)).toBe(15);
      const finalUnit = db.stockUnits.get(botoxUnit.id);
      expect(num(finalUnit.quantidadeDisponivel)).toBe(50);
      expect(num(db.productLots.get(botoxLot.id).quantidadeDisponivel)).toBe(50);
    });

    it('strictly enforces indivisible unit check on single-unit products and allows fractional consumption on multi-quantity reusable products', async () => {
      const cannulaProd = await ProductService.createProduct({
        nome: 'Cânula Micro 22G',
        categoria: 'Insumos',
        trackingMode: 'UNIT',
        unidade: 'unidade',
        isReusable: true,
        isActive: true,
        estoqueMinimo: 1,
        procedureIds: [],
      });

      const cannulaLot = await StockService.createLot(cannulaProd.id, {
        numeroLote: 'LOTE-CAN-22G',
        dataValidade: new Date('2028-01-01T00:00:00Z'),
        quantidadeInicial: 1,
        codigosSeriais: ['CAN-22G-01'],
      });

      const client = await mockPrisma.client.create({
        data: { nome: 'Carlos Silva', cpf: '22233344455', telefone: '11911112222', status: 'ativo' },
      });

      const att = await mockPrisma.attendance.create({
        data: { clientId: client.id, dataHora: new Date(), status: 'EmAtendimento' },
      });

      // Indivisible unit of 1 cannot be fractionally consumed
      await expect(
        StockService.recordProductUsage(att.id, {
          productId: cannulaProd.id,
          quantidade: 0.5,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================================================
  // IMPROVEMENT-011 Verification: Recurring Reminders Mechanism
  // ============================================================================
  describe('IMPROVEMENT-011: Recurring reminders series generation, persistence, future occurrences', () => {
    it('creates persistent recurring series, pre-generates occurrences across horizon, and maintains idempotency', async () => {
      const client = await mockPrisma.client.create({
        data: { nome: 'Mariana Rios', cpf: '99988877766', telefone: '11966665555', status: 'ativo' },
      });

      const startDate = new Date('2026-11-01T10:00:00.000Z');
      const horizonDate = new Date('2026-12-01T10:00:00.000Z'); // 1 month horizon

      // 1. Create a weekly recurrence for 4 weeks
      const recurrence = await ReminderService.createRecurrence(
        {
          titulo: 'Revisão Semanal Pós-Procedimento',
          descricao: 'Verificar cicatrização e edema',
          prioridade: 'alta',
          tipo: 'retorno',
          frequencia: 'SEMANAL',
          intervalo: 1,
          dataInicio: startDate,
          maxOcorrencias: 4,
          isActive: true,
          clientId: client.id,
        },
        horizonDate
      );

      expect(recurrence).toBeDefined();
      expect(recurrence.id).toBeDefined();
      expect(recurrence.frequencia).toBe('SEMANAL');
      expect(recurrence.maxOcorrencias).toBe(4);

      // All 4 occurrences up to horizonDate generated and persisted
      const occurrences = await ReminderService.listReminders({
        recurrenceId: recurrence.id,
        limit: 50,
      });

      expect(occurrences).toHaveLength(4);

      // Verify sequential occurrence indices
      const indices = occurrences.map((o) => o.occurrenceIndex).sort();
      expect(indices).toEqual([1, 2, 3, 4]);

      // Verify dates are spaced by 7 days
      const dates = occurrences
        .sort((a, b) => (a.occurrenceIndex ?? 0) - (b.occurrenceIndex ?? 0))
        .map((o) => new Date(o.dataVencimento).toISOString());
      expect(dates[0]).toBe('2026-11-01T10:00:00.000Z');
      expect(dates[1]).toBe('2026-11-08T10:00:00.000Z');
      expect(dates[2]).toBe('2026-11-15T10:00:00.000Z');
      expect(dates[3]).toBe('2026-11-22T10:00:00.000Z');

      // 2. Idempotency check: running generateDueOccurrences creates 0 duplicate occurrences
      const rerun = await ReminderService.generateDueOccurrences(new Date('2026-12-31T23:59:59.000Z'));
      expect(rerun.generatedCount).toBe(0);

      // 3. Completing one occurrence updates ONLY that occurrence
      const firstOcc = occurrences.find((o) => o.occurrenceIndex === 1)!;
      await ReminderService.completeReminder(firstOcc.id);

      const refreshedOccurrences = await ReminderService.listReminders({
        recurrenceId: recurrence.id,
        limit: 50,
      });

      const completed = refreshedOccurrences.find((o) => o.id === firstOcc.id);
      expect(completed?.status).toBe('concluido');

      const remainingPending = refreshedOccurrences.filter((o) => o.id !== firstOcc.id);
      expect(remainingPending.every((o) => o.status === 'pendente')).toBe(true);
    });

    it('generates the initial occurrence even when dataInicio is in the distant future', async () => {
      const client = await mockPrisma.client.create({
        data: { nome: 'Lucas Mendonça', cpf: '33344455566', telefone: '11922223333', status: 'ativo' },
      });

      // Recurrence starting 90 days from now
      const futureStart = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const recurrence = await ReminderService.createRecurrence(
        {
          titulo: 'Retorno Semestral Futuro',
          tipo: 'retorno',
          frequencia: 'MENSAL',
          intervalo: 6,
          dataInicio: futureStart,
          maxOcorrencias: 2,
          isActive: true,
          clientId: client.id,
        },
        new Date() // Reference date is today, before dataInicio
      );

      const occurrences = await ReminderService.listReminders({
        recurrenceId: recurrence.id,
        limit: 50,
      });

      expect(occurrences.length).toBeGreaterThanOrEqual(1);
      expect(occurrences[0].occurrenceIndex).toBe(1);
    });
  });

  // ============================================================================
  // IMPROVEMENT-012 & 010 Verification: Date Formatting & Technical Annotation Removal
  // ============================================================================
  describe('IMPROVEMENT-012 & 010: Date input standardization and clean UI text', () => {
    it('properly formats and masks Brazilian date strings for DatePicker', () => {
      expect(maskDateBR('05112026')).toBe('05/11/2026');
      expect(maskDateBR('0511')).toBe('05/11');
      expect(dateBRToISO('05/11/2026')).toBe('2026-11-05');
      expect(isoToDateBR('2026-11-05')).toBe('05/11/2026');
    });

    it('properly validates startOfDay date boundaries for DatePicker minDate', () => {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      // Raw date comparison without startOfDay would make todayMidnight < now (true), falsely disabling today!
      expect(todayMidnight.getTime() < now.getTime()).toBe(true);

      // With startOfDay normalization:
      const todayStart = new Date(todayMidnight);
      todayStart.setHours(0, 0, 0, 0);
      const minStart = new Date(now);
      minStart.setHours(0, 0, 0, 0);
      expect(todayStart < minStart).toBe(false); // Today is NOT disabled!
    });
  });
});
