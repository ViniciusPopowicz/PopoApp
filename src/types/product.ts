// src/types/product.ts

export type StockUnitStatus = 'Disponivel' | 'EmUso' | 'Esgotado' | 'Descartado';
export type ProductTrackingMode = 'UNIT' | 'QUANTITY';

export const INVENTORY_MOVEMENT_TYPES = [
  'ENTRADA',
  'CONSUMO',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
  'PERDA_DESCARTE',
  'REVERSAO',
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export interface ProductSummaryDto {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  descricao: string | null;
  unidade: string;
  trackingMode: ProductTrackingMode;
  estoqueMinimo: number;
  isReusable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lotsCount: number;
  totalUnitsCount: number;
  availableUnitsCount: number;
  totalQuantityAvailable: number;
  isLowStock: boolean;
}

export interface ProductDetailDto extends ProductSummaryDto {
  lots: ProductLotSummaryDto[];
  associatedProcedures: {
    procedureId: string;
    procedureName: string;
    standardValue: number;
  }[];
}

export interface ProductLotSummaryDto {
  id: string;
  productId: string;
  numeroLote: string;
  dataValidade: string | null;
  dataAquisicao: string | null;
  precoCusto: number | null;
  quantidadeInicial: number;
  quantidadeDisponivel: number;
  observacoes: string | null;
  isExpired: boolean;
  totalUnitsCount: number;
  availableUnitsCount: number;
  inUseUnitsCount: number;
  depletedUnitsCount: number;
  discardedUnitsCount: number;
  createdAt: string;
}

export interface StockUnitSummaryDto {
  id: string;
  lotId: string;
  numeroLote: string;
  productId: string;
  productName: string;
  isReusable: boolean;
  trackingMode?: ProductTrackingMode;
  unidade?: string;
  codigoSerial: string;
  status: StockUnitStatus;
  motivoStatus?: string | null;
  quantidadeInicial: number;
  quantidadeDisponivel: number;
  currentClientId: string | null;
  currentClientName: string | null;
  dataValidade: string | null;
  isExpired: boolean;
  usageCount: number;
  createdAt: string;
}

export interface StockUnitDetailDto extends StockUnitSummaryDto {
  usages: ProductUsageSummaryDto[];
}

export interface ProductUsageSummaryDto {
  id: string;
  attendanceId: string;
  attendanceDate: string;
  clientId: string;
  clientName: string;
  stockUnitId: string | null;
  codigoSerial: string | null;
  productId: string | null;
  lotId: string | null;
  numeroLote: string | null;
  productName: string;
  isReusable: boolean;
  quantidade: number;
  unidade: string | null;
  status: string;
  reversedAt?: string | null;
  reversalReason?: string | null;
  attendanceProcedureId: string | null;
  procedureName: string | null;
  dataHora: string;
  observacoes: string | null;
  createdAt: string;
}

export interface AvailableStockUnitDto {
  id: string;
  codigoSerial: string;
  productId: string;
  productName: string;
  unidade: string;
  trackingMode?: ProductTrackingMode;
  isReusable: boolean;
  lotId: string;
  numeroLote: string;
  dataValidade: string | null;
  status: StockUnitStatus;
  quantidadeDisponivel?: number;
  isAssignedToCurrentClient: boolean;
}

export interface InventoryMovementDto {
  id: string;
  productId: string;
  productName?: string;
  lotId: string | null;
  numeroLote?: string | null;
  stockUnitId: string | null;
  codigoSerial?: string | null;
  attendanceId: string | null;
  productUsageId: string | null;
  tipo: InventoryMovementType;
  quantidade: number;
  unidade: string;
  saldoAnterior: number | null;
  saldoPosterior: number | null;
  motivo: string | null;
  observacoes: string | null;
  status: string;
  reversedFromId: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  dataHora: string;
  createdAt: string;
}
