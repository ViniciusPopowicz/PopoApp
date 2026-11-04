import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  maskCurrencyBRL,
  formatNumberToBRLInput,
  unmaskCurrencyBRL,
  maskPhoneBR,
  unmaskPhoneBR,
  maskCPF,
  unmaskCPF,
  maskDateBR,
  isValidDateBR,
  dateBRToISO,
  isoToDateBR,
} from '@/lib/masks';

// Mock session and db-bootstrap
vi.mock('@/lib/session', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'admin@popo.com',
    nome: 'Admin',
  }),
}));

vi.mock('@/lib/db-bootstrap', () => ({
  ensureDatabaseSchema: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = {
  appointment: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  pixInstallment: {
    findMany: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  productLot: {
    findMany: vi.fn(),
  },
  reminder: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  financialObligation: {
    findMany: vi.fn(),
  },
  financialMovement: {
    findMany: vi.fn(),
  },
  procedure: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  client: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

describe('MVP Stabilization & Global UI Improvements Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    mockPrisma.attendance.findMany.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.payment.count.mockResolvedValue(0);
    mockPrisma.pixInstallment.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.productLot.findMany.mockResolvedValue([]);
    mockPrisma.reminder.findMany.mockResolvedValue([]);
    mockPrisma.reminder.findFirst.mockResolvedValue(null);
    mockPrisma.financialObligation.findMany.mockResolvedValue([]);
    mockPrisma.financialMovement.findMany.mockResolvedValue([]);
    mockPrisma.procedure.findMany.mockResolvedValue([]);
    mockPrisma.procedure.count.mockResolvedValue(0);
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);
  });

  describe('Phase 2 & 3 — Input Masks & Unmasking Utilities (IMPROVEMENT-001)', () => {
    it('correctly formats and unmasks BRL currency values', () => {
      expect(maskCurrencyBRL('')).toBe('');
      expect(maskCurrencyBRL('1')).toBe('R$ 0,01');
      expect(maskCurrencyBRL('123456')).toBe('R$ 1.234,56');
      expect(formatNumberToBRLInput(150.5)).toBe('R$ 150,50');
      expect(formatNumberToBRLInput(0)).toBe('R$ 0,00');
      expect(formatNumberToBRLInput('')).toBe('');
      expect(unmaskCurrencyBRL('R$ 1.234,56')).toBe(1234.56);
      expect(unmaskCurrencyBRL('')).toBe(0);
    });

    it('correctly formats and unmasks Brazilian phone numbers (10 and 11 digits)', () => {
      expect(maskPhoneBR('')).toBe('');
      expect(maskPhoneBR('11')).toBe('(11');
      expect(maskPhoneBR('1133334444')).toBe('(11) 3333-4444');
      expect(maskPhoneBR('11988887777')).toBe('(11) 98888-7777');
      expect(unmaskPhoneBR('(11) 98888-7777')).toBe('11988887777');
    });

    it('correctly formats and unmasks CPF strings', () => {
      expect(maskCPF('')).toBe('');
      expect(maskCPF('12345678901')).toBe('123.456.789-01');
      expect(unmaskCPF('123.456.789-01')).toBe('12345678901');
    });

    it('correctly formats, validates, and converts Brazilian dates (DD/MM/YYYY <-> YYYY-MM-DD)', () => {
      expect(maskDateBR('')).toBe('');
      expect(maskDateBR('25102026')).toBe('25/10/2026');
      expect(isValidDateBR('25/10/2026')).toBe(true);
      expect(isValidDateBR('31/02/2026')).toBe(false);
      expect(isValidDateBR('29/02/2024')).toBe(true); // Leap year
      expect(dateBRToISO('25/10/2026')).toBe('2026-10-25');
      expect(dateBRToISO('invalid')).toBe('');
      expect(isoToDateBR('2026-10-25T12:00:00.000Z')).toBe('25/10/2026');
    });
  });

  describe('Phase 1 — Critical Bug Resolutions (BUG-001 to BUG-006)', () => {
    it('BUG-001: DashboardService.getDashboardSummary succeeds and computes monthly attendance metrics', async () => {
      const { DashboardService } = await import('@/services/dashboard.service');

      mockPrisma.attendance.findMany.mockResolvedValue([
        {
          id: 'att-1',
          status: 'Realizado',
          dataHora: new Date(),
          desconto: new Prisma.Decimal(10),
          procedures: [{ practicedValue: new Prisma.Decimal(210) }],
        },
      ]);

      const summary = await DashboardService.getDashboardSummary({ period: 'today' });
      expect(summary).toBeDefined();
      expect(summary.operations.attendances.realizadosCount).toBe(1);
      expect((summary.operations.attendances as any).completedCount).toBe(1);
      expect(Array.isArray(summary.alerts.lowStock)).toBe(true);
      expect(summary.alerts.reminders).toBeDefined();
    });

    it('BUG-002: ProductService.listProducts handles QUANTITY and UNIT products safely', async () => {
      const { listProducts } = await import('@/services/product.service');

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          nome: 'Toxina Botulínica',
          marca: 'Allergan',
          categoria: 'Toxina Botulínica',
          unidade: 'Frasco',
          trackingMode: 'UNIT',
          estoqueMinimo: new Prisma.Decimal(2),
          isReusable: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { lots: 1 },
          lots: [
            {
              quantidadeInicial: new Prisma.Decimal(2),
              quantidadeDisponivel: new Prisma.Decimal(1),
              stockUnits: [{ status: 'Disponivel' }, { status: 'Esgotado' }],
            },
          ],
        },
      ]);

      const items = await listProducts({});
      expect(items).toHaveLength(1);
      expect(items[0].trackingMode).toBe('UNIT');
      expect(items[0].availableUnitsCount).toBe(1);
      expect(items[0].isLowStock).toBe(true);
    });

    it('BUG-003 & IMPROVEMENT-006: ReminderService.listReminders supports search and ?date=YYYY-MM-DD filtering', async () => {
      const { ReminderService } = await import('@/services/reminder.service');

      mockPrisma.reminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          titulo: 'Retorno Toxina Maria',
          descricao: 'Avaliar resultado após 15 dias',
          dataVencimento: new Date('2026-10-25T12:00:00.000Z'),
          prioridade: 'alta',
          tipo: 'retorno',
          status: 'pendente',
          concluidoEm: null,
          dispensadoEm: null,
          clientId: 'cli-1',
          client: { id: 'cli-1', nome: 'Maria Silva', telefone: '11999998888' },
          appointmentId: null,
          appointment: null,
          attendanceId: null,
          attendance: null,
          pixInstallmentId: null,
          pixInstallment: null,
          recurrenceRuleId: null,
          recurrenceRule: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const items = await ReminderService.listReminders({
        limit: 50,
        search: 'Maria',
        date: '2026-10-25',
      });

      expect(items).toHaveLength(1);
      expect(items[0].titulo).toBe('Retorno Toxina Maria');
    });

    it('BUG-004: Financial summary API handles custom period gracefully and returns HTTP 200', async () => {
      const { GET } = await import('@/app/api/financial/summary/route');
      const req = new NextRequest('http://localhost:3000/api/financial/summary?period=custom');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.metrics).toBeDefined();
    });

    it('BUG-005: ProcedureService exposes both valorPadrao and precoPadrao so Agenda never renders R$ 0,00', async () => {
      const { listProcedures } = await import('@/services/procedure.service');

      mockPrisma.procedure.findMany.mockResolvedValue([
        {
          id: 'proc-1',
          nome: 'Preenchimento Labial',
          categoria: 'Preenchimento',
          descricao: '1ml ácido hialurônico',
          duracaoMinutos: 45,
          valorPadrao: new Prisma.Decimal(1250),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          productAssociations: [],
        },
      ]);

      const items = await listProcedures({});
      expect(items).toHaveLength(1);
      expect(items[0].precoPadrao).toBe(1250);
      expect(items[0].valorPadrao).toBe(1250);
    });

    it('BUG-006: GET /api/clients returns both data and items arrays for Reminders client selector', async () => {
      const { GET } = await import('@/app/api/clients/route');

      mockPrisma.client.findMany.mockResolvedValue([
        {
          id: 'cli-1',
          nome: 'Ana Paula',
          cpf: '12345678901',
          telefone: '11988887777',
          email: 'ana@email.com',
          dataNascimento: new Date('1990-05-10'),
          status: 'Ativo',
          createdAt: new Date(),
          updatedAt: new Date(),
          emergencyContacts: [],
          _count: { attendances: 0, appointments: 0 },
          attendances: [],
        },
      ]);
      mockPrisma.client.count.mockResolvedValue(1);

      const req = new NextRequest('http://localhost:3000/api/clients?limit=200&active=true');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].nome).toBe('Ana Paula');
    });

    it('LotIntakeDialog & UnitActionDialog schemas normalize legacy/UI field aliases without throwing 400', async () => {
      const { createLotSchema, updateStockUnitStatusSchema } = await import('@/schemas/product');

      const parsedLot = createLotSchema.parse({
        codigoLote: 'LOTE-2026-X1',
        fornecedor: 'Allergan Brasil',
        dataCompra: '2026-10-25T12:00:00.000Z',
        dataValidade: '2027-10-25T12:00:00.000Z',
        quantidadeOriginal: 10,
        custoTotal: 1500.5,
        observacoes: 'Caixa lacrada',
      });

      expect(parsedLot.numeroLote).toBe('LOTE-2026-X1');
      expect(parsedLot.quantidadeInicial).toBe(10);
      expect(parsedLot.precoCusto).toBe(1500.5);
      expect(parsedLot.dataAquisicao).toBeInstanceOf(Date);
      expect(parsedLot.observacoes).toContain('Fornecedor: Allergan Brasil');

      const parsedStatus = updateStockUnitStatusSchema.parse({
        status: 'Descartado',
        motivoStatus: null,
      });
      expect(parsedStatus.status).toBe('Descartado');
      expect(parsedStatus.motivo).toBeUndefined();
    });

    it('DashboardService.getLowStockAlerts preserves fractional QUANTITY stock instead of truncating to zero', async () => {
      const { DashboardService } = await import('@/services/dashboard.service');

      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-qty-1',
          nome: 'Ácido Hialurônico Fracionado',
          marca: 'Restylane',
          categoria: 'Preenchedor',
          unidade: 'ml',
          trackingMode: 'QUANTITY',
          estoqueMinimo: new Prisma.Decimal(1),
          isReusable: true,
          lots: [
            {
              dataValidade: new Date(Date.now() + 86400000 * 60),
              quantidadeInicial: new Prisma.Decimal(1),
              quantidadeDisponivel: new Prisma.Decimal(0.5),
              stockUnits: [],
            },
          ],
        },
      ]);

      const alerts = await DashboardService.getLowStockAlerts(new Date(), 2);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].availableUnits).toBe(0.5);
      expect(alerts[0].alertLevel).toBe('BAIXO');
    });
  });
});
