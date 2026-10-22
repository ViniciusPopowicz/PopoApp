export interface ProcedureProductDto {
  productId: string;
  productName: string;
  category?: string | null;
  unit: string;
}

export interface ProcedureResponseDto {
  id: string;
  nome: string;
  descricao: string;
  valorPadrao: number; // Converted from Decimal for JSON/UI consumers
  duracaoMinutos: number;
  categoria: string;
  isActive: boolean;
  ativo: boolean; // pt-BR alias
  status: 'ativo' | 'inativo';
  createdAt: string;
  updatedAt: string;
  products?: ProcedureProductDto[];
}

export interface ProcedureDetailResponseDto extends ProcedureResponseDto {
  usageCount: {
    attendances: number;
    plannedAppointments: number;
  };
  isInUse: boolean;
}

export interface DeleteProcedureResultDto {
  success: boolean;
  softDeactivated: boolean;
  message: string;
  procedure: ProcedureResponseDto;
}
