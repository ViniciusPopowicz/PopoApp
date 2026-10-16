// src/types/product.ts

export type StockUnitStatus = 'Disponivel' | 'EmUso' | 'Esgotado' | 'Descartado';

export interface ProductSummaryDto {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  descricao: string | null;
  unidade: string;
  isReusable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lotsCount: number;
  totalUnitsCount: number;
  availableUnitsCount: number;
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
  codigoSerial: string;
  status: StockUnitStatus;
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
  stockUnitId: string;
  codigoSerial: string;
  productName: string;
  isReusable: boolean;
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
  isReusable: boolean;
  lotId: string;
  numeroLote: string;
  dataValidade: string | null;
  status: StockUnitStatus;
  isAssignedToCurrentClient: boolean;
}
