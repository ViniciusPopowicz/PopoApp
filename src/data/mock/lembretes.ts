import { MockLembrete } from '@/types';
import { addDays, format, subDays } from 'date-fns';

const hoje = new Date();

export const mockLembretes: MockLembrete[] = [
  { id: '1', titulo: 'Retorno Ana Carolina', descricao: 'Ligar para agendar retorno de 15 dias do botox', data: format(hoje, 'yyyy-MM-dd'), tipo: 'retorno', prioridade: 'alta', status: 'pendente', clienteId: '1' },
  { id: '2', titulo: 'Comprar Toxina', descricao: 'Estoque de Botox acabando, fazer pedido', data: format(hoje, 'yyyy-MM-dd'), tipo: 'compra', prioridade: 'alta', status: 'emAndamento' },
  { id: '3', titulo: 'Aniversário Daniela', descricao: 'Enviar mensagem de parabéns', data: format(addDays(hoje, 1), 'yyyy-MM-dd'), tipo: 'aniversario', prioridade: 'baixa', status: 'pendente', clienteId: '4' },
  { id: '4', titulo: 'Manutenção Autoclave', descricao: 'Agendar técnico para manutenção preventiva', data: format(addDays(hoje, 5), 'yyyy-MM-dd'), tipo: 'manutencao', prioridade: 'media', status: 'pendente' },
  { id: '5', titulo: 'Cobrar paciente', descricao: 'Cobrar parcela pendente da paciente Camila', data: format(subDays(hoje, 2), 'yyyy-MM-dd'), tipo: 'outro', prioridade: 'alta', status: 'atrasado', clienteId: '3' },
  { id: '6', titulo: 'Retorno Beatriz', descricao: 'Verificar resultados do preenchimento', data: format(addDays(hoje, 3), 'yyyy-MM-dd'), tipo: 'retorno', prioridade: 'media', status: 'pendente', clienteId: '2' },
  { id: '7', titulo: 'Pedido Galderma', descricao: 'Chegada prevista dos produtos', data: format(addDays(hoje, 2), 'yyyy-MM-dd'), tipo: 'compra', prioridade: 'media', status: 'emAndamento' },
  { id: '8', titulo: 'Aniversário Camila', descricao: 'Enviar mensagem com desconto de 10%', data: format(addDays(hoje, 15), 'yyyy-MM-dd'), tipo: 'aniversario', prioridade: 'baixa', status: 'pendente', clienteId: '3' },
  { id: '9', titulo: 'Organizar estoque', descricao: 'Contagem mensal', data: format(subDays(hoje, 10), 'yyyy-MM-dd'), tipo: 'outro', prioridade: 'baixa', status: 'concluido' },
  { id: '10', titulo: 'Ligar para fornecedor', descricao: 'Confirmar valores novos de fios de PDO', data: format(hoje, 'yyyy-MM-dd'), tipo: 'compra', prioridade: 'media', status: 'pendente' },
  { id: '11', titulo: 'Retorno Elena', descricao: 'Sessão 2 de bioestimulador', data: format(addDays(hoje, 7), 'yyyy-MM-dd'), tipo: 'retorno', prioridade: 'alta', status: 'pendente', clienteId: '5' },
  { id: '12', titulo: 'Acompanhar cicatrização', descricao: 'Mandar whatsapp para paciente Gabriela', data: format(subDays(hoje, 1), 'yyyy-MM-dd'), tipo: 'outro', prioridade: 'media', status: 'atrasado', clienteId: '7' },
];
