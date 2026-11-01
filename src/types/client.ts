export interface EmergencyContactDto {
  id?: string;
  clientId?: string;
  nome: string;
  telefone: string;
  parentesco: string;
  observacoes?: string | null;
}

export interface ClientSummaryDto {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  dataNascimento: string | null;
  endereco: string | null;
  observacoes: string | null;
  status: 'Ativo' | 'Inativo' | string;
  isActive?: boolean;
  profilePhotoId?: string | null;
  profilePhotoUrl?: string | null;
  emergencyContacts: EmergencyContactDto[];
  _count?: {
    attendances?: number;
    appointments?: number;
    emergencyContacts?: number;
  };
  attendancesCount?: number;
  appointmentsCount?: number;
  lastAttendanceDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
