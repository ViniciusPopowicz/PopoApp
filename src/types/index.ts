
export type AppointmentStatus = 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'naoCompareceu';
export type ReminderStatus = 'pendente' | 'emAndamento' | 'concluido' | 'atrasado';
export type PaymentStatus = 'pendente' | 'pago' | 'cancelado';
export type ThemeName = 'rosa-delicado' | 'lavanda-suave' | 'nude-natural' | 'verde-sereno' | 'azul-classico' | 'borgonha-elegante';

export interface MockCliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  status: 'ativo' | 'inativo';
  endereco: string;
  observacoes?: string;
  ultimoAtendimento?: string;
  foto?: string;
}

export interface MockProduto {
  id: string;
  nome: string;
  categoria: string;
  marca: string;
  preco: number;
  estoque: number;
  status: 'ativo' | 'inativo';
  descricao: string;
  unidade: string;
  lote?: string;
}

export interface MockProcedimento {
  id: string;
  nome: string;
  categoria: string;
  duracao: number; // in minutes
  preco: number;
  status: 'ativo' | 'inativo';
  descricao: string;
  materiaisNecessarios?: string[];
}

export interface MockAgendamento {
  id: string;
  clienteId: string;
  clienteNome: string;
  procedimentoId: string;
  procedimentoNome: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:mm
  status: AppointmentStatus;
  observacoes?: string;
}

export interface MockAtendimento {
  id: string;
  clienteId: string;
  clienteNome: string;
  procedimentoId: string;
  procedimentoNome: string;
  produtosUsados: string[];
  data: string;
  valor: number;
  statusPagamento: PaymentStatus;
  observacoes?: string;
}

export interface MockLembrete {
  id: string;
  titulo: string;
  descricao: string;
  data: string;
  status: ReminderStatus;
  prioridade: 'baixa' | 'media' | 'alta';
  tipo: string;
  clienteId?: string;
  clienteNome?: string;
}

export interface MockFinanceiro {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  formaPagamento: string;
  status: PaymentStatus;
  atendimentoId?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
