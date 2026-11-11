// src/types/medical-record.ts

export interface MedicalRecordDto {
  id: string;
  attendanceId: string;
  queixaPrincipal: string | null;
  avaliacaoClinica: string | null;
  condutaProcedimento: string | null;
  orientacoes: string | null;
  observacoes: string | null;
  anamnese?: string | null;
  evolucaoClinica?: string | null;
  orientacoesPosProcedimento?: string | null;
  intercorrencias?: string | null;
  createdAt: string;
  updatedAt: string;
  attendance?: {
    id: string;
    status: string;
    dataHora: string;
    clientId: string;
    clientName?: string;
    clientCpf?: string;
  };
}
