import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

// ============================================================================
// In-Memory Relational Prisma Harness for Phases 1–6 Verification
// ============================================================================
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
    const actVal = actual instanceof Date ? actual.getTime() : actual instanceof Prisma.Decimal ? actual.toNumber() : actual;
    if ('gte' in cond) {
      const target = cond.gte instanceof Date ? cond.gte.getTime() : cond.gte instanceof Prisma.Decimal ? cond.gte.toNumber() : Number(cond.gte);
      if (!(actVal >= target)) return false;
    }
    if ('gt' in cond) {
      const target = cond.gt instanceof Date ? cond.gt.getTime() : cond.gt instanceof Prisma.Decimal ? cond.gt.toNumber() : Number(cond.gt);
      if (!(actVal > target)) return false;
    }
    if ('lte' in cond) {
      const target = cond.lte instanceof Date ? cond.lte.getTime() : cond.lte instanceof Prisma.Decimal ? cond.lte.toNumber() : Number(cond.lte);
      if (!(actVal <= target)) return false;
    }
    if ('lt' in cond) {
      const target = cond.lt instanceof Date ? cond.lt.getTime() : cond.lt instanceof Prisma.Decimal ? cond.lt.toNumber() : Number(cond.lt);
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

  if (table === 'clients') {
    if (include?.attendances) {
      const atts = Array.from(db.attendances.values()).filter((a) => a.clientId === item.id);
      item.attendances = atts.map((a) =>
        hydrateRecord('attendances', a, include.attendances.include, include.attendances.select)
      );
    }
    if (include?.appointments) {
      const appts = Array.from(db.appointments.values()).filter((a) => a.clientId === item.id);
      item.appointments = appts.map((a) =>
        hydrateRecord('appointments', a, include.appointments.include, include.appointments.select)
      );
    }
  }

  if (table === 'appointments') {
    if (include?.client || select?.client) {
      item.client = db.clients.get(item.clientId) ?? null;
    }
    if (include?.attendance) {
      const att = Array.from(db.attendances.values()).find((a) => a.appointmentId === item.id) ?? null;
      item.attendance = att
        ? hydrateRecord('attendances', att, typeof include.attendance === 'object' ? include.attendance.include : undefined, typeof include.attendance === 'object' ? include.attendance.select : undefined)
        : null;
    }
    if (include?.plannedProcedures) {
      const pps = Array.from(db.appointmentPlannedProcedures.values()).filter((p) => p.appointmentId === item.id);
      item.plannedProcedures = pps.map((pp) => ({
        ...pp,
        procedure: db.procedures.get(pp.procedureId) ?? null,
      }));
    }
  }

  if (table === 'attendances') {
    if (include?.client || select?.client) {
      item.client = db.clients.get(item.clientId) ?? null;
    }
    if (include?.appointment || select?.appointment) {
      item.appointment = item.appointmentId ? db.appointments.get(item.appointmentId) ?? null : null;
      if (item.appointment && include?.appointment?.include?.plannedProcedures) {
        item.appointment = hydrateRecord('appointments', item.appointment, include.appointment.include);
      }
    }
    if (include?.procedures || select?.procedures) {
      const procs = Array.from(db.attendanceProcedures.values()).filter((p) => p.attendanceId === item.id);
      item.procedures = procs.map((p) => ({
        ...p,
        procedure: db.procedures.get(p.procedureId) ?? null,
      }));
    }
    if (include?.payments || select?.payments) {
      const pays = Array.from(db.payments.values()).filter((p) => p.attendanceId === item.id);
      item.payments = pays.map((p) => hydrateRecord('payments', p, { pixInstallments: true }));
    }
    if (include?.productUsages || select?.productUsages) {
      const usages = Array.from(db.productUsages.values()).filter((u) => u.attendanceId === item.id);
      item.productUsages = usages.map((u) => hydrateRecord('productUsages', u, { stockUnit: { include: { lot: { include: { product: true } } } }, lot: { include: { product: true } }, product: true }));
    }
  }

  if (table === 'payments') {
    if (include?.pixInstallments || select?.pixInstallments) {
      item.pixInstallments = Array.from(db.pixInstallments.values())
        .filter((i) => i.paymentId === item.id)
        .sort((a, b) => a.numeroParcela - b.numeroParcela);
    }
    if (include?.attendance || select?.attendance) {
      const att = db.attendances.get(item.attendanceId) ?? null;
      item.attendance = att
        ? hydrateRecord(
            'attendances',
            att,
            include?.attendance?.include,
            include?.attendance?.select ?? select?.attendance?.select
          )
        : null;
    }
  }

  if (table === 'pixInstallments') {
    if (include?.payment) {
      const pay = db.payments.get(item.paymentId) ?? null;
      item.payment = pay ? hydrateRecord('payments', pay, include.payment.include) : null;
    }
  }

  if (table === 'financialObligations') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
    if (include?.attendance) {
      item.attendance = item.attendanceId ? db.attendances.get(item.attendanceId) ?? null : null;
    }
    if (include?.settlements) {
      let settlements = Array.from(db.financialSettlements.values()).filter((s) => s.obligationId === item.id);
      settlements = settlements.map((s) => ({
        ...s,
        movement: Array.from(db.financialMovements.values()).find((m) => m.settlementId === s.id) ?? null,
      }));
      item.settlements = settlements;
    }
  }

  if (table === 'financialSettlements') {
    if (include?.obligation) {
      const ob = db.financialObligations.get(item.obligationId) ?? null;
      item.obligation = ob ? hydrateRecord('financialObligations', ob, include.obligation.include) : null;
    }
    if (include?.movement) {
      item.movement = Array.from(db.financialMovements.values()).find((m) => m.settlementId === item.id) ?? null;
    }
  }

  if (table === 'financialMovements') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
    if (include?.attendance) {
      item.attendance = item.attendanceId ? db.attendances.get(item.attendanceId) ?? null : null;
    }
    if (include?.payment) {
      item.payment = item.paymentId ? db.payments.get(item.paymentId) ?? null : null;
    }
    if (include?.pixInstallment) {
      item.pixInstallment = item.pixInstallmentId ? db.pixInstallments.get(item.pixInstallmentId) ?? null : null;
    }
    if (include?.settlement) {
      const s = item.settlementId ? db.financialSettlements.get(item.settlementId) ?? null : null;
      item.settlement = s ? hydrateRecord('financialSettlements', s, include.settlement.include) : null;
    }
    if (include?.reversedFrom) {
      item.reversedFrom = item.reversedFromId ? db.financialMovements.get(item.reversedFromId) ?? null : null;
    }
    if (include?.reversals) {
      item.reversals = Array.from(db.financialMovements.values()).filter((m) => m.reversedFromId === item.id);
    }
  }

  if (table === 'reminders') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
    if (include?.appointment) {
      item.appointment = item.appointmentId ? db.appointments.get(item.appointmentId) ?? null : null;
    }
    if (include?.attendance) {
      item.attendance = item.attendanceId ? db.attendances.get(item.attendanceId) ?? null : null;
    }
    if (include?.pixInstallment) {
      const inst = item.pixInstallmentId ? db.pixInstallments.get(item.pixInstallmentId) ?? null : null;
      item.pixInstallment = inst ? hydrateRecord('pixInstallments', inst, include.pixInstallment.include) : null;
    }
    if (include?.recurrence) {
      item.recurrence = item.recurrenceId ? db.reminderRecurrences.get(item.recurrenceId) ?? null : null;
    }
  }

  if (table === 'reminderRecurrences') {
    if (include?.client) {
      item.client = item.clientId ? db.clients.get(item.clientId) ?? null : null;
    }
    if (include?.appointment) {
      item.appointment = item.appointmentId ? db.appointments.get(item.appointmentId) ?? null : null;
    }
    if (include?.attendance) {
      item.attendance = item.attendanceId ? db.attendances.get(item.attendanceId) ?? null : null;
    }
    if (include?.reminders) {
      const rems = Array.from(db.reminders.values())
        .filter((r) => r.recurrenceId === item.id)
        .sort((a, b) => (a.occurrenceIndex ?? 0) - (b.occurrenceIndex ?? 0));
      item.reminders = rems.map((r) =>
        hydrateRecord('reminders', r, typeof include.reminders === 'object' ? include.reminders.include : undefined)
      );
    }
    if (include?._count) {
      item._count = {
        reminders: Array.from(db.reminders.values()).filter((r) => r.recurrenceId === item.id).length,
      };
    }
  }

  if (table === 'products') {
    if (include?.lots) {
      const lots = Array.from(db.productLots.values()).filter((l) => l.productId === item.id);
      item.lots = lots.map((l) =>
        hydrateRecord('productLots', l, typeof include.lots === 'object' ? include.lots.include || include.lots.select : undefined)
      );
    }
    if (include?.procedureAssociations) {
      item.procedureAssociations = [];
    }
    if (include?._count) {
      item._count = {
        lots: Array.from(db.productLots.values()).filter((l) => l.productId === item.id).length,
      };
    }
  }

  if (table === 'productLots') {
    if (include?.product) {
      item.product = db.products.get(item.productId) ?? null;
    }
    if (include?.stockUnits) {
      let units = Array.from(db.stockUnits.values()).filter((u) => u.lotId === item.id);
      if (typeof include.stockUnits === 'object' && include.stockUnits.where) {
        units = units.filter((u) => matchesWhere('stockUnits', u, include.stockUnits.where));
      }
      item.stockUnits = units.map((u) =>
        hydrateRecord('stockUnits', u, typeof include.stockUnits === 'object' ? include.stockUnits.include : undefined)
      );
    }
    if (include?._count) {
      item._count = {
        stockUnits: Array.from(db.stockUnits.values()).filter((u) => u.lotId === item.id).length,
      };
    }
  }

  if (table === 'stockUnits') {
    if (include?.lot) {
      const lot = db.productLots.get(item.lotId) ?? null;
      item.lot = lot ? hydrateRecord('productLots', lot, include.lot.include) : null;
    }
    if (include?.currentClient) {
      item.currentClient = item.currentClientId ? db.clients.get(item.currentClientId) ?? null : null;
    }
    if (include?.usages) {
      let usages = Array.from(db.productUsages.values()).filter((u) => u.stockUnitId === item.id);
      if (typeof include.usages === 'object' && include.usages.where) {
        usages = usages.filter((u) => matchesWhere('productUsages', u, include.usages.where));
      }
      usages = usages.map((u) =>
        hydrateRecord('productUsages', u, typeof include.usages === 'object' ? include.usages.include : undefined)
      );
      item.usages = usages;
    }
  }

  if (table === 'productUsages') {
    if (include?.attendance) {
      const att = db.attendances.get(item.attendanceId) ?? null;
      item.attendance = att ? hydrateRecord('attendances', att, include.attendance.include) : null;
    }
    if (include?.stockUnit) {
      const unit = item.stockUnitId ? db.stockUnits.get(item.stockUnitId) ?? null : null;
      item.stockUnit = unit ? hydrateRecord('stockUnits', unit, include.stockUnit.include) : null;
    }
    if (include?.lot) {
      const lot = item.lotId ? db.productLots.get(item.lotId) ?? null : null;
      item.lot = lot ? hydrateRecord('productLots', lot, include.lot.include) : null;
    }
    if (include?.product) {
      item.product = item.productId ? db.products.get(item.productId) ?? null : null;
    }
    if (include?.attendanceProcedure) {
      const ap = item.attendanceProcedureId ? db.attendanceProcedures.get(item.attendanceProcedureId) ?? null : null;
      item.attendanceProcedure = ap
        ? { ...ap, procedure: db.procedures.get(ap.procedureId) ?? null }
        : null;
    }
    if (include?.inventoryMovements) {
      item.inventoryMovements = Array.from(db.inventoryMovements.values()).filter(
        (m) => m.productUsageId === item.id
      );
    }
  }

  if (table === 'inventoryMovements') {
    if (include?.product) {
      item.product = db.products.get(item.productId) ?? null;
    }
    if (include?.lot) {
      item.lot = item.lotId ? db.productLots.get(item.lotId) ?? null : null;
    }
    if (include?.stockUnit) {
      item.stockUnit = item.stockUnitId ? db.stockUnits.get(item.stockUnitId) ?? null : null;
    }
    if (include?.attendance) {
      item.attendance = item.attendanceId ? db.attendances.get(item.attendanceId) ?? null : null;
    }
    if (include?.reversedFrom) {
      item.reversedFrom = item.reversedFromId ? db.inventoryMovements.get(item.reversedFromId) ?? null : null;
    }
    if (include?.reversals) {
      item.reversals = Array.from(db.inventoryMovements.values()).filter((m) => m.reversedFromId === item.id);
    }
  }

  return item;
}

function matchesWhere(table: keyof typeof db, item: any, where?: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR') {
      if (!(cond as any[]).some((sub) => matchesWhere(table, item, sub))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!(cond as any[]).every((sub) => matchesWhere(table, item, sub))) return false;
      continue;
    }
    if (table === 'payments' && key === 'attendance') {
      const att = db.attendances.get(item.attendanceId);
      if (!att || !matchesWhere('attendances', att, cond)) return false;
      continue;
    }
    if (table === 'payments' && key === 'pixInstallments') {
      const insts = Array.from(db.pixInstallments.values()).filter((i) => i.paymentId === item.id);
      if ((cond as any).none !== undefined) {
        if (insts.length > 0) return false;
      }
      continue;
    }
    if (table === 'pixInstallments' && key === 'payment') {
      const pay = db.payments.get(item.paymentId);
      if (!pay || !matchesWhere('payments', pay, cond)) return false;
      continue;
    }
    if (table === 'stockUnits' && key === 'lot') {
      const lot = db.productLots.get(item.lotId);
      if (!lot || !matchesWhere('productLots', lot, cond)) return false;
      continue;
    }
    if (table === 'productUsages' && key === 'attendance') {
      const att = db.attendances.get(item.attendanceId);
      if (!att || !matchesWhere('attendances', att, cond)) return false;
      continue;
    }
    if (!matchesScalar(item[key], cond)) return false;
  }
  return true;
}

function makeModelDelegate(table: keyof typeof db) {
  return {
    findUnique: async ({ where, include, select }: any) => {
      let found: any = null;
      if (where.id) {
        found = db[table].get(where.id) ?? null;
      } else {
        found = Array.from(db[table].values()).find((item) => matchesWhere(table, item, where)) ?? null;
      }
      return hydrateRecord(table, found, include, select);
    },
    findFirst: async ({ where, include, select, orderBy }: any = {}) => {
      let items = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      if (orderBy) {
        const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          for (const o of orders) {
            const [k, dir] = Object.entries(o)[0];
            const av = a[k] instanceof Date ? a[k].getTime() : a[k];
            const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
            if (av < bv) return dir === 'asc' ? -1 : 1;
            if (av > bv) return dir === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
      return hydrateRecord(table, items[0] ?? null, include, select);
    },
    findMany: async ({ where, include, select, orderBy, skip, take }: any = {}) => {
      let items = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      if (orderBy) {
        const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          for (const o of orders) {
            const [k, dir] = Object.entries(o)[0];
            const av = a[k] instanceof Date ? a[k].getTime() : a[k] instanceof Prisma.Decimal ? a[k].toNumber() : a[k];
            const bv = b[k] instanceof Date ? b[k].getTime() : b[k] instanceof Prisma.Decimal ? b[k].toNumber() : b[k];
            if (av < bv) return dir === 'asc' ? -1 : 1;
            if (av > bv) return dir === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
      if (typeof skip === 'number') items = items.slice(skip);
      if (typeof take === 'number') items = items.slice(0, take);
      return items.map((item) => hydrateRecord(table, item, include, select));
    },
    count: async ({ where }: any = {}) => {
      return Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where)).length;
    },
    create: async ({ data, include, select }: any) => {
      const now = new Date();
      const id = data.id ?? nextUuid();

      // Enforce 1:1 unique constraint on Attendance.appointmentId
      if (table === 'attendances' && data.appointmentId) {
        const existing = Array.from(db.attendances.values()).find((a) => a.appointmentId === data.appointmentId);
        if (existing) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`appointmentId`)', {
            code: 'P2002',
            clientVersion: '5.0.0',
          });
        }
      }

      // Enforce unique constraint on Reminder(recurrenceId, occurrenceIndex)
      if (
        table === 'reminders' &&
        data.recurrenceId !== undefined &&
        data.recurrenceId !== null &&
        data.occurrenceIndex !== undefined &&
        data.occurrenceIndex !== null
      ) {
        const existing = Array.from(db.reminders.values()).find(
          (r) => r.recurrenceId === data.recurrenceId && r.occurrenceIndex === data.occurrenceIndex
        );
        if (existing) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`recurrenceId`, `occurrenceIndex`)',
            {
              code: 'P2002',
              clientVersion: '5.0.0',
            }
          );
        }
      }

      const record: any = {
        id,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      };

      for (const [k, v] of Object.entries(data)) {
        if (
          (table === 'appointments' && (k === 'attendance' || k === 'plannedProcedures')) ||
          (table === 'payments' && k === 'pixInstallments') ||
          (table === 'products' && k === 'procedureAssociations')
        ) {
          continue;
        }
        record[k] = v;
      }

      if (table === 'procedures') {
        record.isActive = record.isActive ?? true;
        record.valorPadrao = toDec(record.valorPadrao);
      }
      if (table === 'appointments') {
        record.duracaoMinutos = record.duracaoMinutos ?? 60;
        record.status = record.status ?? 'Agendado';
        record.rescheduledFromId = record.rescheduledFromId ?? null;
        record.rescheduledToId = record.rescheduledToId ?? null;
        record.valorEstimado =
          record.valorEstimado !== undefined && record.valorEstimado !== null
            ? toDec(record.valorEstimado)
            : null;
      }
      if (table === 'attendances') {
        record.appointmentId = record.appointmentId ?? null;
        record.status = record.status ?? 'Pendente';
        record.dataHora = record.dataHora ?? now;
        record.desconto = toDec(record.desconto ?? 0);
        record.completedAt = record.completedAt ?? null;
      }
      if (table === 'attendanceProcedures') {
        record.standardValueSnapshot = toDec(record.standardValueSnapshot);
        record.practicedValue = toDec(record.practicedValue);
      }
      if (table === 'payments') {
        record.valor = toDec(record.valor);
        record.status = record.status ?? 'Pago';
        record.numeroParcelas = record.numeroParcelas ?? 1;
        record.dataPagamento = record.dataPagamento !== undefined ? record.dataPagamento : now;
      }
      if (table === 'pixInstallments') {
        record.valor = toDec(record.valor);
        record.status = record.status ?? 'Pendente';
        record.dataPagamento = record.dataPagamento ?? null;
      }
      if (table === 'financialObligations') {
        record.valorOriginal = toDec(record.valorOriginal);
        record.status = record.status ?? 'Pendente';
        record.clientId = record.clientId ?? null;
        record.appointmentId = record.appointmentId ?? null;
        record.attendanceId = record.attendanceId ?? null;
        record.categoria = record.categoria ?? 'Geral';
        record.fornecedor = record.fornecedor ?? null;
        record.metodo = record.metodo ?? null;
      }
      if (table === 'financialSettlements') {
        record.valor = toDec(record.valor);
        record.status = record.status ?? 'Ativo';
        record.dataLiquidacao = record.dataLiquidacao ?? now;
      }
      if (table === 'financialMovements') {
        record.valor = toDec(record.valor);
        record.status = record.status ?? 'Ativo';
        record.dataMovimentacao = record.dataMovimentacao ?? now;
        record.reversedFromId = record.reversedFromId ?? null;
        record.settlementId = record.settlementId ?? null;
        record.paymentId = record.paymentId ?? null;
        record.pixInstallmentId = record.pixInstallmentId ?? null;
      }
      if (table === 'reminders') {
        record.status = record.status ?? 'pendente';
        record.prioridade = record.prioridade ?? 'media';
        record.tipo = record.tipo ?? 'geral';
        record.clientId = record.clientId ?? null;
        record.appointmentId = record.appointmentId ?? null;
        record.attendanceId = record.attendanceId ?? null;
        record.pixInstallmentId = record.pixInstallmentId ?? null;
        record.recurrenceId = record.recurrenceId ?? null;
        record.occurrenceIndex = record.occurrenceIndex ?? null;
      }
      if (table === 'reminderRecurrences') {
        record.isActive = record.isActive ?? true;
        record.intervalo = record.intervalo ?? 1;
        record.ocorrenciasGeradas = record.ocorrenciasGeradas ?? 0;
        record.clientId = record.clientId ?? null;
        record.appointmentId = record.appointmentId ?? null;
        record.attendanceId = record.attendanceId ?? null;
        record.dataFim = record.dataFim ?? null;
        record.maxOcorrencias = record.maxOcorrencias ?? null;
      }
      if (table === 'products') {
        record.trackingMode = record.trackingMode ?? 'UNIT';
        record.unidade = record.unidade ?? 'frasco';
        record.isReusable = record.isReusable ?? false;
        record.isActive = record.isActive ?? true;
        record.estoqueMinimo = toDec(record.estoqueMinimo ?? 5);
      }
      if (table === 'productLots') {
        record.quantidadeInicial = toDec(record.quantidadeInicial ?? 0);
        record.quantidadeDisponivel = toDec(record.quantidadeDisponivel ?? record.quantidadeInicial);
      }
      if (table === 'stockUnits') {
        record.status = record.status ?? 'Disponivel';
        record.currentClientId = record.currentClientId ?? null;
        record.quantidadeInicial = toDec(record.quantidadeInicial ?? 1);
        record.quantidadeDisponivel = toDec(record.quantidadeDisponivel ?? record.quantidadeInicial);
        record.motivoStatus = record.motivoStatus ?? null;
      }
      if (table === 'productUsages') {
        record.quantidade = toDec(record.quantidade ?? 1);
        record.unidade = record.unidade ?? 'frasco';
        record.status = record.status ?? 'Ativo';
        record.dataHora = record.dataHora ?? now;
      }
      if (table === 'inventoryMovements') {
        record.quantidade = toDec(record.quantidade);
        record.saldoAnterior = record.saldoAnterior !== undefined && record.saldoAnterior !== null ? toDec(record.saldoAnterior) : null;
        record.saldoPosterior = record.saldoPosterior !== undefined && record.saldoPosterior !== null ? toDec(record.saldoPosterior) : null;
        record.dataHora = record.dataHora ?? now;
        record.reversedFromId = record.reversedFromId ?? null;
        record.status = record.status ?? 'Ativo';
      }

      db[table].set(id, record);

      if (table === 'appointments' && data.attendance?.create) {
        await makeModelDelegate('attendances').create({
          data: {
            ...data.attendance.create,
            appointmentId: id,
          },
        });
      }
      if (table === 'appointments' && data.plannedProcedures?.create) {
        const list = Array.isArray(data.plannedProcedures.create)
          ? data.plannedProcedures.create
          : [data.plannedProcedures.create];
        for (const pp of list) {
          await makeModelDelegate('appointmentPlannedProcedures').create({
            data: {
              ...pp,
              appointmentId: id,
            },
          });
        }
      }
      if (table === 'payments' && data.pixInstallments?.create) {
        const list = Array.isArray(data.pixInstallments.create)
          ? data.pixInstallments.create
          : [data.pixInstallments.create];
        for (const inst of list) {
          await makeModelDelegate('pixInstallments').create({
            data: {
              ...inst,
              paymentId: id,
            },
          });
        }
      }

      return hydrateRecord(table, record, include, select);
    },
    createMany: async ({ data }: any) => {
      const list = Array.isArray(data) ? data : [data];
      for (const item of list) {
        await makeModelDelegate(table).create({ data: item });
      }
      return { count: list.length };
    },
    update: async ({ where, data, include, select }: any) => {
      const existing = db[table].get(where.id);
      if (!existing) {
        throw new Error(`Record not found in ${table}: ${where.id}`);
      }
      const updated = { ...existing, updatedAt: new Date() };
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && 'increment' in (v as any)) {
          const inc = (v as any).increment;
          if (updated[k] instanceof Prisma.Decimal || inc instanceof Prisma.Decimal) {
            updated[k] = toDec(num(updated[k]) + num(inc));
          } else {
            updated[k] = Number(updated[k] ?? 0) + Number(inc);
          }
        } else if (v && typeof v === 'object' && 'decrement' in (v as any)) {
          const dec = (v as any).decrement;
          if (updated[k] instanceof Prisma.Decimal || dec instanceof Prisma.Decimal) {
            updated[k] = toDec(num(updated[k]) - num(dec));
          } else {
            updated[k] = Number(updated[k] ?? 0) - Number(dec);
          }
        } else {
          updated[k] = v;
        }
      }
      db[table].set(where.id, updated);
      return hydrateRecord(table, updated, include, select);
    },
    updateMany: async ({ where, data }: any) => {
      const matches = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      for (const item of matches) {
        await makeModelDelegate(table).update({ where: { id: item.id }, data });
      }
      return { count: matches.length };
    },
    delete: async ({ where }: any) => {
      const existing = db[table].get(where.id);
      db[table].delete(where.id);
      return existing;
    },
    deleteMany: async ({ where }: any = {}) => {
      const matches = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      for (const item of matches) {
        db[table].delete(item.id);
      }
      return { count: matches.length };
    },
    aggregate: async ({ where, _sum }: any) => {
      const matches = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      const result: any = { _sum: {} };
      if (_sum) {
        for (const k of Object.keys(_sum)) {
          const total = matches.reduce((acc: number, cur: any) => acc + num(cur[k]), 0);
          result._sum[k] = matches.length > 0 ? toDec(total) : null;
        }
      }
      return result;
    },
    groupBy: async ({ by, where, _sum, _count }: any) => {
      const matches = Array.from(db[table].values()).filter((item) => matchesWhere(table, item, where));
      const groups = new Map<string, any[]>();
      for (const item of matches) {
        const key = by.map((b: string) => item[b]).join('::');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      const out: any[] = [];
      for (const [, rows] of Array.from(groups.entries())) {
        const entry: any = {};
        for (const b of by) entry[b] = rows[0][b];
        if (_sum) {
          entry._sum = {};
          for (const k of Object.keys(_sum)) {
            entry._sum[k] = toDec(rows.reduce((acc: number, r: any) => acc + num(r[k]), 0));
          }
        }
        if (_count) {
          entry._count = {};
          for (const k of Object.keys(_count)) {
            entry._count[k] = rows.length;
          }
        }
        out.push(entry);
      }
      return out;
    },
  };
}

const mockPrisma: any = {
  client: makeModelDelegate('clients'),
  procedure: makeModelDelegate('procedures'),
  appointment: makeModelDelegate('appointments'),
  plannedProcedure: makeModelDelegate('appointmentPlannedProcedures'),
  appointmentPlannedProcedure: makeModelDelegate('appointmentPlannedProcedures'),
  attendance: makeModelDelegate('attendances'),
  attendanceProcedure: makeModelDelegate('attendanceProcedures'),
  payment: makeModelDelegate('payments'),
  pixInstallment: makeModelDelegate('pixInstallments'),
  reminder: makeModelDelegate('reminders'),
  reminderRecurrence: makeModelDelegate('reminderRecurrences'),
  financialObligation: makeModelDelegate('financialObligations'),
  financialSettlement: makeModelDelegate('financialSettlements'),
  financialMovement: makeModelDelegate('financialMovements'),
  product: makeModelDelegate('products'),
  productLot: makeModelDelegate('productLots'),
  stockUnit: makeModelDelegate('stockUnits'),
  productUsage: makeModelDelegate('productUsages'),
  inventoryMovement: makeModelDelegate('inventoryMovements'),
  $transaction: async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  },
};

vi.mock('@/lib/prisma', () => {
  const proxy = new Proxy(
    {},
    {
      get(_target, prop) {
        return (globalThis as any).__mockPrisma[prop];
      },
    }
  );
  return {
    default: proxy,
    prisma: proxy,
  };
});
(globalThis as any).__mockPrisma = mockPrisma;

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => ({
    userId: 'admin-user-id',
    nickname: 'admin',
    displayName: 'Dra. Popo',
    isLoggedIn: true,
  })),
  requireAuth: vi.fn(async () => ({
    userId: 'admin-user-id',
    nickname: 'admin',
    displayName: 'Dra. Popo',
    isLoggedIn: true,
  })),
}));

import { ClientService } from '@/services/client.service';
import { AppointmentService } from '@/services/appointment.service';
import { AttendanceService } from '@/services/attendance.service';
import { FinancialService } from '@/services/financial.service';
import { PaymentService } from '@/services/payment.service';
import { ReminderService } from '@/services/reminder.service';
import { ProductService } from '@/services/product.service';
import { StockService } from '@/services/stock.service';
import { ValidationError, ConflictError } from '@/lib/errors';

import { GET as getFinancialTransactions } from '@/app/api/financial/transactions/route';
import { GET as getFinancialSummary } from '@/app/api/financial/summary/route';
import { POST as postProcessDueReminders } from '@/app/api/reminders/process-due/route';

async function seedActiveClient(nome = 'Maria Silva') {
  return mockPrisma.client.create({
    data: {
      nome,
      telefone: '11999999999',
      status: 'ativo',
    },
  });
}

async function seedProcedure(nome = 'Toxina Botulínica', valorPadrao = 800) {
  return mockPrisma.procedure.create({
    data: {
      nome,
      categoria: 'Injetáveis',
      valorPadrao: toDec(valorPadrao),
      duracaoMinutos: 45,
      isActive: true,
    },
  });
}

describe('PopoApp Definitive Implementation & Remediation Verification (Phases 1 to 6)', () => {
  beforeEach(() => {
    resetDb();
  });

  // ==========================================================================
  // PHASE 1 (P0): One-to-One Appointment / Attendance Relationship
  // ==========================================================================
  describe('Phase 1 (P0): One-to-One Appointment <-> Attendance & Independent Attendances', () => {
    it('1.1: Creates appointment with exactly one linked attendance and rejects a second attendance for the same appointment', async () => {
      const client = await seedActiveClient();
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-10T14:00:00Z'),
        valorEstimado: 500,
        plannedProcedureIds: [],
        prefillAttendance: false,
      });

      expect(appt.status).toBe('Agendado');
      expect(appt.attendance).toBeDefined();
      expect(appt.attendance?.status).toBe('Pendente');
      expect(appt.attendances).toHaveLength(1);
      expect(appt.attendances[0].id).toBe(appt.attendance!.id);

      // Attempting to create a second attendance on the same appointment must fail with ConflictError
      await expect(
        AttendanceService.createAttendance({
          appointmentId: appt.id,
          clientId: client.id,
          desconto: 0,
          observacoes: 'Tentativa duplicada',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('1.2: Supports independent attendances without an appointment (appointmentId = null)', async () => {
      const client = await seedActiveClient();
      const proc = await seedProcedure('Avaliação Avulsa', 250);

      const independentAtt = await AttendanceService.createAttendance({
        appointmentId: null,
        clientId: client.id,
        desconto: 0,
        observacoes: 'Atendimento avulso sem agendamento prévio',
      });

      expect(independentAtt.id).toBeDefined();
      expect(independentAtt.appointmentId).toBeNull();
      expect(independentAtt.status).toBe('Pendente');

      // Prefill on an independent attendance gracefully returns 0 added procedures
      const prefilled = await AttendanceService.prefillFromPlanned(independentAtt.id);
      expect(prefilled).toEqual({ addedCount: 0, procedures: [] });

      // Add procedure and complete independent attendance
      await AttendanceService.addProcedure(independentAtt.id, {
        procedureId: proc.id,
        practicedValue: 250,
      });

      const completed = await AttendanceService.completeAttendance(independentAtt.id);
      expect(completed.status).toBe('Realizado');
      expect((completed as any).completedAt).toBeInstanceOf(Date);
    });

    it('1.3: Rescheduling, cancelling, and no-show preserve 1:1 rules and cascade to linked reminders', async () => {
      const client = await seedActiveClient();
      const oldAppt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-12T10:00:00Z'),
        plannedProcedureIds: [],
        prefillAttendance: false,
      });

      // Attach a pending reminder to the appointment
      const rem = await ReminderService.createReminder({
        titulo: 'Confirmar presença na véspera',
        dataVencimento: new Date('2026-11-11T10:00:00Z'),
        prioridade: 'media',
        tipo: 'geral',
        appointmentId: oldAppt.id,
      });
      expect(rem.clientId).toBe(client.id);

      // Reschedule appointment
      const newAppt = await AppointmentService.rescheduleAppointment(oldAppt.id, {
        novaDataHora: new Date('2026-11-15T16:00:00Z'),
        motivo: 'Conflito de agenda da cliente',
      });

      const reloadedOldAppt = await AppointmentService.getAppointmentById(oldAppt.id);
      expect(reloadedOldAppt.status).toBe('Reagendado');
      expect(reloadedOldAppt.rescheduledToId).toBe(newAppt.id);
      expect(reloadedOldAppt.attendance?.status).toBe('Cancelado');

      // Reminder linked to old appointment was automatically dismissed/cancelled
      const reloadedRem = await ReminderService.getReminderById(rem.id);
      expect(reloadedRem.status).toBe('dispensado');

      // New appointment has its own fresh Pendente attendance
      expect(newAppt.status).toBe('Agendado');
      expect(newAppt.rescheduledFromId).toBe(oldAppt.id);
      expect(newAppt.attendance?.status).toBe('Pendente');
      expect(newAppt.attendance?.id).not.toBe(oldAppt.attendance?.id);
    });
  });

  // ==========================================================================
  // PHASE 2 (P1): Complete Financial Management
  // ==========================================================================
  describe('Phase 2 (P1): Financial Obligations (AR/AP), Partial/Full Settlements, Movements & Reversals', () => {
    it('2.1: Supports Accounts Receivable & Payable with partial settlements, full settlement, and overpayment rejection', async () => {
      const client = await seedActiveClient();

      // Create a Receivable obligation of R$ 1000.00
      const receivable = await FinancialService.createObligation({
        tipo: 'RECEIVABLE',
        descricao: 'Pacote Corporal 4 Sessões',
        valorOriginal: 1000,
        dataVencimento: new Date('2027-12-10T12:00:00Z'),
        clientId: client.id,
        categoria: 'Procedimentos',
      });

      expect(receivable.status).toBe('Pendente');
      expect(receivable.valorOriginal).toBe(1000);
      expect(receivable.paidAmount).toBe(0);
      expect(receivable.remainingBalance).toBe(1000);

      // 1st Partial Settlement: R$ 400.00 via Pix
      const partial1 = await FinancialService.settleObligation(receivable.id, {
        valor: 400,
        metodo: 'Pix',
        observacoes: 'Primeira entrada',
      });

      expect(partial1.status).toBe('Parcial');
      expect(partial1.paidAmount).toBe(400);
      expect(partial1.remainingBalance).toBe(600);
      expect(partial1.settlements).toHaveLength(1);

      // Reject overpayment (> R$ 600.00 remaining)
      await expect(
        FinancialService.settleObligation(receivable.id, {
          valor: 600.01,
          metodo: 'Pix',
        })
      ).rejects.toThrow(ValidationError);

      // 2nd Settlement (remaining R$ 600.00): transitions to Pago
      const finalSettle = await FinancialService.settleObligation(receivable.id, {
        valor: 600,
        metodo: 'CartaoCredito',
        observacoes: 'Quitação restante',
      });

      expect(finalSettle.status).toBe('Pago');
      expect(finalSettle.paidAmount).toBe(1000);
      expect(finalSettle.remainingBalance).toBe(0);

      // Reject settling an already Pago obligation
      await expect(
        FinancialService.settleObligation(receivable.id, {
          valor: 50,
          metodo: 'Dinheiro',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('2.2: Supports Accounts Payable (PAYABLE), overdue status detection, and settlement reversal with audit trail', async () => {
      // Create an overdue PAYABLE obligation (vencimento in the past)
      const payable = await FinancialService.createObligation({
        tipo: 'PAYABLE',
        descricao: 'Fornecedor de Toxina Botulínica',
        valorOriginal: 1500,
        dataVencimento: new Date('2020-01-10T12:00:00Z'),
        categoria: 'Insumos',
      });

      expect(payable.status).toBe('Atrasado');
      expect(payable.isOverdue).toBe(true);

      // Settle R$ 1500.00 -> creates SAIDA movement
      const settled = await FinancialService.settleObligation(payable.id, {
        valor: 1500,
        metodo: 'Transferencia',
      });

      expect(settled.status).toBe('Pago');
      const settlementId = settled.settlements[0].id;

      // Cannot cancel obligation while active settlement exists unless reverseSettlements=true
      await expect(
        FinancialService.cancelObligation(payable.id, {
          motivo: 'Tentativa inválida',
          reverseSettlements: false,
        })
      ).rejects.toThrow(ValidationError);

      // Reverse the settlement -> creates ESTORNO movement and restores obligation to Atrasado
      const afterReversal = await FinancialService.reverseSettlement(settlementId, {
        motivo: 'Transferência devolvida pelo banco',
      });

      expect(afterReversal.settlements[0].status).toBe('Estornado');
      expect(afterReversal.status).toBe('Atrasado');
      expect(afterReversal.paidAmount).toBe(0);
      expect(afterReversal.remainingBalance).toBe(1500);

      // Verify compensating ESTORNO movement exists in ledger
      const movements = await FinancialService.listMovements({ origem: 'ESTORNO' });
      expect(movements.total).toBe(1);
      expect(movements.items[0].tipo).toBe('ENTRADA');
      expect(movements.items[0].valor).toBe(1500);

      // Now obligation can be cancelled since no active settlements remain
      const cancelled = await FinancialService.cancelObligation(payable.id, {
        motivo: 'Compra cancelada',
        reverseSettlements: false,
      });
      expect(cancelled.status).toBe('Cancelado');
      expect(cancelled.remainingBalance).toBe(0);
    });

    it('2.3: Calculates cash flow by movement date and integrates with PaymentService without double-counting', async () => {
      const client = await seedActiveClient();
      const proc = await seedProcedure('Preenchimento Labial', 1200);
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-10-20T10:00:00Z'),
        plannedProcedureIds: [],
        prefillAttendance: false,
      });
      const attId = appt.attendance!.id;

      await AttendanceService.addProcedure(attId, {
        procedureId: proc.id,
        practicedValue: 1200,
      });

      const movDate = new Date('2026-10-22T12:00:00Z');

      // Record direct payment of R$ 700 in cash -> automatically creates ENTRADA FinancialMovement
      const cashPayment = await PaymentService.recordPayment(attId, {
        valor: 700,
        metodo: 'Dinheiro',
        status: 'Pago',
        dataPagamento: movDate,
        numeroParcelas: 1,
      });
      expect(cashPayment.payment.status).toBe('Pago');

      // Record parcelado Pix of R$ 500 in 2 installments -> Pendente until installments settled
      const pixPlan = await PaymentService.createPixInstallmentSchedule(attId, {
        valorTotal: 500,
        numeroParcelas: 2,
        primeiroVencimento: new Date('2026-10-25T12:00:00Z'),
        intervaloDias: 30,
      });

      // Settle 1st Pix installment -> creates ENTRADA FinancialMovement of R$ 250
      await PaymentService.payPixInstallment(pixPlan.payment.pixInstallments![0].id, {
        dataPagamento: movDate,
      });

      // Record a manual expense (SAIDA) of R$ 300
      await FinancialService.createManualMovement({
        tipo: 'SAIDA',
        valor: 300,
        metodo: 'Pix',
        categoria: 'Aluguel',
        descricao: 'Taxa de condomínio da clínica',
        dataMovimentacao: movDate,
      });

      // Check cash flow summary for October 2026:
      // Cash inflows: R$ 700 (Dinheiro) + R$ 250 (1st Pix installment) = R$ 950 (zero double-counting!)
      // Cash outflows: R$ 300 (SAIDA)
      // Net cash flow: R$ 650
      const summary = await FinancialService.getCashFlowSummary(
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-10-31T23:59:59Z')
      );
      expect(summary.totalInflows).toBe(950);
      expect(summary.totalOutflows).toBe(300);
      expect(summary.netCashFlow).toBe(650);

      // Verify reversal handling in cash flow:
      // Reverse the manual expense of R$ 300. In an auditable ledger:
      // Original SAIDA R$ 300 remains on Oct 22 (Outflows: 300)
      // Compensating ENTRADA R$ 300 is recorded on reversal date (Inflows: 950 + 300 = 1250)
      // Net cash flow balances back to: 1250 - 300 = R$ 950!
      const manualMov = Array.from(db.financialMovements.values()).find(
        (m) => m.tipo === 'SAIDA' && m.categoria === 'Aluguel'
      )!;
      await FinancialService.reverseMovement(manualMov.id, {
        motivo: 'Condomínio estornado por cobrança duplicada',
      });

      const summaryAfterRev = await FinancialService.getCashFlowSummary(
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-10-31T23:59:59Z')
      );
      expect(summaryAfterRev.totalInflows).toBe(1250);
      expect(summaryAfterRev.totalOutflows).toBe(300);
      expect(summaryAfterRev.netCashFlow).toBe(950);

      // Verify ClientService.getClientWithHistory correctly includes Pix installments in financials
      const clientHistory = await ClientService.getClientWithHistory(client.id);
      expect(clientHistory.attendances).toHaveLength(1);
      const attHistory = clientHistory.attendances[0];
      const attFinancials = AttendanceService.computeFinancials(attHistory);
      expect(attFinancials.paidTotal).toBe(950); // R$ 700 cash + R$ 250 Pix installment
      expect(attFinancials.outstandingBalance).toBe(250); // R$ 1200 - 950
    });
  });

  // ==========================================================================
  // PHASE 3 (P1): Reminders Linked to Appointments & Attendance + Recurrence
  // ==========================================================================
  describe('Phase 3 (P1): Reminders Linked to Appointments/Attendance & Deterministic Recurrence', () => {
    it('3.1: Validates cross-entity consistency for reminders linked to client, appointment, and attendance', async () => {
      const clientA = await seedActiveClient('Cliente A');
      const clientB = await seedActiveClient('Cliente B');

      const apptA = await AppointmentService.createAppointment({
        clientId: clientA.id,
        dataHora: new Date('2026-11-20T10:00:00Z'),
        plannedProcedureIds: [],
        prefillAttendance: false,
      });
      const attA = apptA.attendance!;

      // Reject mismatching clientId vs appointment.clientId
      await expect(
        ReminderService.createReminder({
          titulo: 'Lembrete inconsistente',
          dataVencimento: new Date('2026-11-19T10:00:00Z'),
          prioridade: 'media',
          tipo: 'geral',
          clientId: clientB.id,
          appointmentId: apptA.id,
        })
      ).rejects.toThrow(ValidationError);

      // Valid reminder linked to attendance auto-populates clientId and appointmentId
      const validRem = await ReminderService.createReminder({
        titulo: 'Retorno pós-procedimento 7 dias',
        dataVencimento: new Date('2026-11-27T10:00:00Z'),
        prioridade: 'alta',
        tipo: 'retorno',
        attendanceId: attA.id,
      });

      expect(validRem.clientId).toBe(clientA.id);
      expect(validRem.appointmentId).toBe(apptA.id);
      expect(validRem.attendanceId).toBe(attA.id);
    });

    it('3.2: Handles month-end clamping (Jan 31 -> Feb 28 -> Mar 31) and leap years deterministically', () => {
      const startJan31 = new Date('2026-01-31T10:00:00.000Z');

      // Occurrence 1 (1-based): Jan 31, 2026
      const occ1 = ReminderService.computeOccurrenceDate(startJan31, 'MENSAL', 1, 1);
      expect(occ1.toISOString().slice(0, 10)).toBe('2026-01-31');

      // Occurrence 2: Feb 28, 2026 (2026 is non-leap year, clamped to 28, NOT March 3!)
      const occ2 = ReminderService.computeOccurrenceDate(startJan31, 'MENSAL', 1, 2);
      expect(occ2.toISOString().slice(0, 10)).toBe('2026-02-28');

      // Occurrence 3: Mar 31, 2026 (restores 31st day!)
      const occ3 = ReminderService.computeOccurrenceDate(startJan31, 'MENSAL', 1, 3);
      expect(occ3.toISOString().slice(0, 10)).toBe('2026-03-31');

      // Annual recurrence starting on Feb 29, 2024 (leap year) -> Feb 28, 2025
      const leapStart = new Date('2024-02-29T09:00:00.000Z');
      const nextYear = ReminderService.computeOccurrenceDate(leapStart, 'ANUAL', 1, 2);
      expect(nextYear.toISOString().slice(0, 10)).toBe('2025-02-28');
    });

    it('3.3: Recovers missed recurrence runs, prevents duplicates on repeated runs, and isolates single-occurrence completion', async () => {
      const client = await seedActiveClient();

      // Create a weekly recurrence starting Oct 1, 2026 with maxOcorrencias = 3, evaluated initially as of Oct 2
      const start = new Date('2026-10-01T09:00:00.000Z');
      const recurrence = await ReminderService.createRecurrence(
        {
          titulo: 'Acompanhamento Semanal Pós-Lipo',
          prioridade: 'alta',
          tipo: 'retorno',
          frequencia: 'SEMANAL',
          intervalo: 1,
          dataInicio: start,
          maxOcorrencias: 3,
          isActive: true,
          clientId: client.id,
        },
        new Date('2026-10-02T12:00:00.000Z')
      );

      // Initial occurrence (#1: Oct 1) was generated on creation
      expect(recurrence.ocorrenciasGeradas).toBe(1);

      // Process due recurrences as of Oct 20 (should recover Oct 8 [#2] and Oct 15 [#3])
      const run1 = await ReminderService.generateDueOccurrences(new Date('2026-10-20T12:00:00.000Z'));
      expect(run1.generatedCount).toBe(2);

      // Running again for the same or later date must be 100% idempotent (0 duplicates)
      const run2 = await ReminderService.generateDueOccurrences(new Date('2026-10-25T12:00:00.000Z'));
      expect(run2.generatedCount).toBe(0);

      // Complete the 1st occurrence and verify the 2nd and 3rd remain pendente
      const allReminders = await ReminderService.listReminders({
        recurrenceId: recurrence.id,
        limit: 50,
        offset: 0,
      });
      expect(allReminders).toHaveLength(3);

      const firstOcc = allReminders.find((r) => r.occurrenceIndex === 1)!;
      await ReminderService.completeReminder(firstOcc.id);

      const refreshed = await ReminderService.listReminders({
        recurrenceId: recurrence.id,
        limit: 50,
        offset: 0,
      });
      const statusesByIdx = refreshed
        .sort((a, b) => (a.occurrenceIndex ?? 0) - (b.occurrenceIndex ?? 0))
        .map((r) => r.status);
      expect(statusesByIdx).toEqual(['concluido', 'pendente', 'pendente']);

      // Also verify the cron API endpoint works
      const req = new NextRequest('http://localhost:3000/api/reminders/process-due', {
        method: 'POST',
        body: JSON.stringify({ referenceDate: '2026-10-25T12:00:00.000Z' }),
      });
      const res = await postProcessDueReminders(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.generatedCount).toBe(0);
    });
  });

  // ==========================================================================
  // PHASE 4 & PHASE 5 (P2): Inventory Movement Ledger & Partial Consumption
  // ==========================================================================
  describe('Phase 4 & Phase 5 (P2): Inventory Movement Ledger, Partial Consumption & Stock Invariants', () => {
    it('4.1 & 5.1: Tracks partial consumption of QUANTITY consumables across multiple attendances until depletion and records ledger entries', async () => {
      const client = await seedActiveClient();

      // Create a QUANTITY-tracked consumable product (Ácido Hialurônico 10 ml)
      const product = await ProductService.createProduct({
        nome: 'Ácido Hialurônico Corporal',
        categoria: 'Preenchedores',
        trackingMode: 'QUANTITY',
        unidade: 'ml',
        isReusable: false,
        isActive: true,
        estoqueMinimo: 2,
        procedureIds: [],
      });

      expect(product.trackingMode).toBe('QUANTITY');
      expect(product.unidade).toBe('ml');

      // Create lot with 10 ml initial quantity and 1 vial serial
      const lot = await StockService.createLot(product.id, {
        numeroLote: 'LOTE-AH-001',
        dataValidade: new Date('2027-12-31T00:00:00Z'),
        quantidadeInicial: 10,
        codigosSeriais: ['AMPOLA-10ML-01'],
      });

      expect(lot.quantidadeInicial).toBe(10);
      expect(lot.quantidadeDisponivel).toBe(10);
      const units = Array.from(db.stockUnits.values()).filter((u) => u.lotId === lot.id);
      expect(units).toHaveLength(1);
      const unitId = units[0].id;

      // Verify ENTRADA movement was recorded in ledger
      const initialMovements = await StockService.listInventoryMovements({ lotId: lot.id });
      expect(initialMovements.total).toBe(1);
      expect(initialMovements.items[0].tipo).toBe('ENTRADA');
      expect(initialMovements.items[0].quantidade).toBe(10);

      // Create 3 attendances for partial consumption: 2.5 ml, 3.5 ml, 4.0 ml
      const att1 = await AttendanceService.createAttendance({ clientId: client.id, appointmentId: null, desconto: 0 });
      const att2 = await AttendanceService.createAttendance({ clientId: client.id, appointmentId: null, desconto: 0 });
      const att3 = await AttendanceService.createAttendance({ clientId: client.id, appointmentId: null, desconto: 0 });

      // 1) Consume 2.5 ml in att1 -> remaining 7.5 ml, status 'EmUso'
      const usage1 = await StockService.recordProductUsage(att1.id, {
        stockUnitId: unitId,
        quantidade: 2.5,
        unidade: 'ml',
      });
      expect(usage1.quantidade).toBe(2.5);

      const unitAfter1 = await mockPrisma.stockUnit.findUnique({ where: { id: unitId } });
      expect(num(unitAfter1.quantidadeDisponivel)).toBe(7.5);
      expect(unitAfter1.status).toBe('EmUso');

      // Reject incompatible unit of measure (e.g. 'mg' instead of 'ml')
      await expect(
        StockService.recordProductUsage(att2.id, {
          stockUnitId: unitId,
          quantidade: 1,
          unidade: 'mg',
        })
      ).rejects.toThrow(ValidationError);

      // Reject consuming more than available (e.g. 8.0 ml > 7.5 ml)
      await expect(
        StockService.recordProductUsage(att2.id, {
          stockUnitId: unitId,
          quantidade: 8.0,
          unidade: 'ml',
        })
      ).rejects.toThrow(ValidationError);

      // 2) Consume 3.5 ml in att2 -> remaining 4.0 ml, status still 'EmUso'
      await StockService.recordProductUsage(att2.id, {
        stockUnitId: unitId,
        quantidade: 3.5,
      });
      const unitAfter2 = await mockPrisma.stockUnit.findUnique({ where: { id: unitId } });
      expect(num(unitAfter2.quantidadeDisponivel)).toBe(4.0);
      expect(unitAfter2.status).toBe('EmUso');

      // 3) Consume remaining 4.0 ml in att3 -> remaining 0 ml, status transitions to 'Esgotado'
      await StockService.recordProductUsage(att3.id, {
        stockUnitId: unitId,
        quantidade: 4.0,
      });
      const unitAfter3 = await mockPrisma.stockUnit.findUnique({ where: { id: unitId } });
      expect(num(unitAfter3.quantidadeDisponivel)).toBe(0);
      expect(unitAfter3.status).toBe('Esgotado');

      const lotAfter3 = await mockPrisma.productLot.findUnique({ where: { id: lot.id } });
      expect(num(lotAfter3.quantidadeDisponivel)).toBe(0);

      // Verify ledger has 1 ENTRADA + 3 CONSUMO movements = 4 movements
      const allMovements = await StockService.listInventoryMovements({ lotId: lot.id });
      expect(allMovements.total).toBe(4);
    });

    it('4.2 & 5.2: Supports usage reversal/correction, manual stock adjustments, and updateStockUnitStatus with motivo persistence', async () => {
      const client = await seedActiveClient();
      const product = await ProductService.createProduct({
        nome: 'Bioestimulador Fracionável',
        categoria: 'Injetáveis',
        trackingMode: 'QUANTITY',
        unidade: 'ml',
        isReusable: false,
        isActive: true,
        estoqueMinimo: 2,
        procedureIds: [],
      });

      const lot = await StockService.createLot(product.id, {
        numeroLote: 'LOTE-BIO-01',
        dataValidade: new Date('2027-06-30T00:00:00Z'),
        quantidadeInicial: 10,
        codigosSeriais: ['BIO-10ML'],
      });
      const units = Array.from(db.stockUnits.values()).filter((u) => u.lotId === lot.id);
      const unitId = units[0].id;

      const att = await AttendanceService.createAttendance({ clientId: client.id, appointmentId: null, desconto: 0 });

      // Record wrong consumption of 6 ml instead of 4 ml
      const wrongUsage = await StockService.recordProductUsage(att.id, {
        stockUnitId: unitId,
        quantidade: 6,
      });

      // Correct usage to 4 ml (reverses 6 ml and records 4 ml)
      const corrected = await StockService.correctProductUsage(wrongUsage.id, {
        motivo: 'Erro de digitação na quantidade aplicada',
        novaQuantidade: 4,
      });

      expect(corrected.quantidade).toBe(4);
      const unitAfterCorrection = await mockPrisma.stockUnit.findUnique({ where: { id: unitId } });
      expect(num(unitAfterCorrection.quantidadeDisponivel)).toBe(6);
      expect(unitAfterCorrection.status).toBe('EmUso');

      // Attempting to correct an already-reversed usage must fail with ValidationError
      await expect(
        StockService.correctProductUsage(wrongUsage.id, {
          motivo: 'Segunda correção inválida',
          novaQuantidade: 3,
        })
      ).rejects.toThrow(ValidationError);

      // Manual stock adjustment (AJUSTE_NEGATIVO of 1 ml for syringe dead-space loss)
      const adjMov = await StockService.recordStockMovement({
        stockUnitId: unitId,
        tipo: 'AJUSTE_NEGATIVO',
        quantidade: 1,
        motivo: 'Perda residual na agulha',
      });
      expect(adjMov.tipo).toBe('AJUSTE_NEGATIVO');
      expect(adjMov.saldoPosterior).toBe(5);

      // Legacy updateStockUnitStatus to Descartado persists motivoStatus and zeroes remaining quantity
      const discarded = await StockService.updateStockUnitStatus(unitId, {
        status: 'Descartado',
        motivo: 'Frasco trincado acidentalmente',
      });
      expect(discarded.status).toBe('Descartado');
      expect(discarded.motivoStatus).toBe('Frasco trincado acidentalmente');
      expect(discarded.quantidadeDisponivel).toBe(0);
    });

    it('5.3: Preserves indivisible UNIT rules, V15 expiration, V16/V17 same-client reusable rules, and V18 single-use restrictions', async () => {
      const clientA = await seedActiveClient('Cliente A');
      const clientB = await seedActiveClient('Cliente B');

      // 1) Same-client reusable UNIT product (V16/V17)
      const reusableProd = await ProductService.createProduct({
        nome: 'Cânula Reutilizável Individual',
        categoria: 'Insumos',
        trackingMode: 'UNIT',
        unidade: 'unidade',
        isReusable: true,
        isActive: true,
        estoqueMinimo: 2,
        procedureIds: [],
      });

      const reusableLot = await StockService.createLot(reusableProd.id, {
        numeroLote: 'LOTE-CAN-01',
        dataValidade: new Date('2027-10-01T00:00:00Z'),
        quantidadeInicial: 1,
        codigosSeriais: ['CAN-01'],
      });
      const reusableUnitId = Array.from(db.stockUnits.values()).find((u) => u.lotId === reusableLot.id)!.id;

      const attA1 = await AttendanceService.createAttendance({ clientId: clientA.id, appointmentId: null, desconto: 0 });
      const attA2 = await AttendanceService.createAttendance({ clientId: clientA.id, appointmentId: null, desconto: 0 });
      const attB1 = await AttendanceService.createAttendance({ clientId: clientB.id, appointmentId: null, desconto: 0 });

      // Reject fractional consumption on UNIT product
      await expect(
        StockService.recordProductUsage(attA1.id, {
          stockUnitId: reusableUnitId,
          quantidade: 0.5,
        })
      ).rejects.toThrow(ValidationError);

      // First use by Cliente A succeeds and marks unit EmUso with currentClientId = clientA.id
      await StockService.recordProductUsage(attA1.id, { stockUnitId: reusableUnitId });

      // Reuse by same client (Cliente A) in second attendance succeeds
      await StockService.recordProductUsage(attA2.id, { stockUnitId: reusableUnitId });

      // Reuse by different client (Cliente B) is strictly rejected (V16/V17)
      await expect(
        StockService.recordProductUsage(attB1.id, { stockUnitId: reusableUnitId })
      ).rejects.toThrow(ConflictError);
    });
  });

  // ==========================================================================
  // PHASE 6: Fix Financial API / UI Contract Mismatch
  // ==========================================================================
  describe('Phase 6: Financial API & UI Contract Alignment (/api/financial/transactions & /api/financial/summary)', () => {
    it('6.1: /api/financial/transactions and /api/financial/summary return aligned contract fields expected by UI and tests', async () => {
      const client = await seedActiveClient('Paciente Financeiro');
      const proc = await seedProcedure('Lipo de Papada', 1500);
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-10-22T15:00:00Z'),
        plannedProcedureIds: [],
        prefillAttendance: false,
      });
      const attId = appt.attendance!.id;

      await AttendanceService.addProcedure(attId, {
        procedureId: proc.id,
        practicedValue: 1500,
      });
      await AttendanceService.completeAttendance(attId);

      await PaymentService.recordPayment(attId, {
        valor: 1500,
        metodo: 'Pix',
        status: 'Pago',
        dataPagamento: new Date(),
        numeroParcelas: 1,
      });

      await FinancialService.createObligation({
        tipo: 'PAYABLE',
        descricao: 'Conta de Energia',
        valorOriginal: 450,
        dataVencimento: new Date('2026-11-05T12:00:00Z'),
        categoria: 'Utilidades',
      });

      // 1) Test GET /api/financial/transactions
      const txReq = new NextRequest('http://localhost:3000/api/financial/transactions?page=1&limit=15');
      const txRes = await getFinancialTransactions(txReq);
      expect(txRes.status).toBe(200);
      const txJson = await txRes.json();

      // Verify both `data` and `payments` arrays exist and match
      expect(Array.isArray(txJson.data)).toBe(true);
      expect(Array.isArray(txJson.payments)).toBe(true);
      expect(txJson.data).toHaveLength(1);
      expect(txJson.pagination.totalPages).toBe(1);
      expect(txJson.totalPages).toBe(1);

      // Verify procedure name is accessible both as `p.nome` (UI) and `p.procedure.nome` (nested)
      const firstTx = txJson.data[0];
      expect(firstTx.attendance.client.nome).toBe('Paciente Financeiro');
      expect(firstTx.attendance.procedures[0].nome).toBe('Lipo de Papada');
      expect(firstTx.attendance.procedures[0].procedure.nome).toBe('Lipo de Papada');

      // 2) Test GET /api/financial/summary
      const sumReq = new NextRequest('http://localhost:3000/api/financial/summary');
      const sumRes = await getFinancialSummary(sumReq);
      expect(sumRes.status).toBe(200);
      const sumJson = await sumRes.json();

      expect(sumJson.data.metrics).toBeDefined();
      expect(sumJson.metrics).toBeDefined();
      expect(sumJson.metrics.receivedRevenue).toBe(1500);
      expect(sumJson.metrics.totalInflows).toBe(1500);
      expect(sumJson.metrics.netCashFlow).toBe(1500);
      expect(Array.isArray(sumJson.cashFlow)).toBe(true);
      expect(sumJson.cashFlow[0].metodo).toBe('Pix');
      expect(sumJson.cashFlow[0].method).toBe('Pix');
      expect(sumJson.payables.totalPending).toBe(450);
    });

    it('6.2: Edge cases — V08 appointment completion guard, V15 expired lot, V18 single-use restriction, disableRecurrence, and double-reversal guards', async () => {
      const client = await seedActiveClient('Cliente Edge Cases');

      // 1) V08 guard: cannot complete appointment while its 1:1 attendance is Pendente
      const appt = await AppointmentService.createAppointment({
        clientId: client.id,
        dataHora: new Date('2026-11-01T10:00:00Z'),
        plannedProcedureIds: [],
        prefillAttendance: false,
      });
      await expect(AppointmentService.completeAppointment(appt.id)).rejects.toThrow(ValidationError);

      // Once attendance is Realizado, completeAppointment succeeds
      await AttendanceService.completeAttendance(appt.attendance!.id);
      const completedAppt = await AppointmentService.completeAppointment(appt.id);
      expect(completedAppt.status).toBe('Concluído');

      // 2) Phase 2: Manual movement reversal and double-reversal rejection
      const manualMov = await FinancialService.createManualMovement({
        tipo: 'SAIDA',
        valor: 200,
        metodo: 'Pix',
        categoria: 'Material',
        descricao: 'Compra de luvas',
      });
      const reversedMov = await FinancialService.reverseMovement(manualMov.id, {
        motivo: 'Lançamento em duplicidade',
      });
      expect(reversedMov.status).toBe('Estornado');
      await expect(
        FinancialService.reverseMovement(manualMov.id, { motivo: 'Segunda tentativa' })
      ).rejects.toThrow(ValidationError);

      // 3) Phase 3: Disabling recurrence prevents future occurrences from generating
      const rec = await ReminderService.createRecurrence(
        {
          titulo: 'Lembrete Mensal Desativável',
          prioridade: 'media',
          tipo: 'geral',
          frequencia: 'MENSAL',
          intervalo: 1,
          dataInicio: new Date('2026-01-15T10:00:00Z'),
          isActive: true,
          clientId: client.id,
        },
        new Date('2026-01-16T10:00:00Z')
      );
      expect(rec.ocorrenciasGeradas).toBe(1);

      const disabled = await ReminderService.disableRecurrence(rec.id);
      expect(disabled.isActive).toBe(false);

      const genAfterDisable = await ReminderService.generateDueOccurrences(
        new Date('2026-06-01T10:00:00Z')
      );
      expect(genAfterDisable.generatedCount).toBe(0);

      // 4) Phase 4 & 5: V15 expired lot rejection & V18 single-use reuse rejection
      const singleUseProd = await ProductService.createProduct({
        nome: 'Seringa Descartável',
        categoria: 'Insumos',
        trackingMode: 'UNIT',
        unidade: 'unidade',
        isReusable: false,
        isActive: true,
        estoqueMinimo: 5,
        procedureIds: [],
      });

      const expiredLot = await StockService.createLot(singleUseProd.id, {
        numeroLote: 'LOTE-VENCIDO',
        dataValidade: new Date('2020-01-01T00:00:00Z'),
        quantidadeInicial: 1,
        codigosSeriais: ['SER-EXP-01'],
      });
      const expiredUnitId = Array.from(db.stockUnits.values()).find(
        (u) => u.lotId === expiredLot.id
      )!.id;

      const attEdge = await AttendanceService.createAttendance({
        clientId: client.id,
        appointmentId: null,
        desconto: 0,
      });

      // V15: Expired lot cannot be consumed
      await expect(
        StockService.recordProductUsage(attEdge.id, { stockUnitId: expiredUnitId })
      ).rejects.toThrow(ValidationError);

      // V18: Single-use unit cannot be consumed a second time
      const validLot = await StockService.createLot(singleUseProd.id, {
        numeroLote: 'LOTE-VALIDO',
        dataValidade: new Date('2028-01-01T00:00:00Z'),
        quantidadeInicial: 1,
        codigosSeriais: ['SER-VAL-01'],
      });
      const validUnitId = Array.from(db.stockUnits.values()).find(
        (u) => u.lotId === validLot.id
      )!.id;

      await StockService.recordProductUsage(attEdge.id, { stockUnitId: validUnitId });
      await expect(
        StockService.recordProductUsage(attEdge.id, { stockUnitId: validUnitId })
      ).rejects.toThrow(ConflictError);
    });
  });
});
