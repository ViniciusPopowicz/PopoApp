import { MockAgendamento } from '@/types';
import { addDays, format, subDays } from 'date-fns';

const hoje = new Date();

export const mockAgenda: MockAgendamento[] = [
  { id: '1', data: format(subDays(hoje, 2), 'yyyy-MM-dd'), hora: '09:00', clienteId: '1', clienteNome: 'Ana Carolina Ferreira', procedimentoId: '1', procedimentoNome: 'Aplicação de Toxina Botulínica', status: 'concluido', observacoes: 'Primeira sessão' },
  { id: '2', data: format(subDays(hoje, 2), 'yyyy-MM-dd'), hora: '10:00', clienteId: '2', clienteNome: 'Beatriz Santos Lima', procedimentoId: '2', procedimentoNome: 'Preenchimento Labial', status: 'concluido' },
  { id: '3', data: format(subDays(hoje, 1), 'yyyy-MM-dd'), hora: '14:00', clienteId: '3', clienteNome: 'Camila Rodrigues Silva', procedimentoId: '3', procedimentoNome: 'Preenchimento de Malar', status: 'naoCompareceu' },
  { id: '4', data: format(hoje, 'yyyy-MM-dd'), hora: '08:00', clienteId: '4', clienteNome: 'Daniela Oliveira Costa', procedimentoId: '4', procedimentoNome: 'Harmonização Facial', status: 'concluido' },
  { id: '5', data: format(hoje, 'yyyy-MM-dd'), hora: '10:00', clienteId: '5', clienteNome: 'Elena Martins Souza', procedimentoId: '5', procedimentoNome: 'Bioestimulador de Colágeno', status: 'confirmado' },
  { id: '6', data: format(hoje, 'yyyy-MM-dd'), hora: '13:00', clienteId: '6', clienteNome: 'Fernanda Almeida', procedimentoId: '6', procedimentoNome: 'Skinbooster Facial', status: 'confirmado' },
  { id: '7', data: format(hoje, 'yyyy-MM-dd'), hora: '15:00', clienteId: '8', clienteNome: 'Helena Castro Ribeiro', procedimentoId: '7', procedimentoNome: 'Fios de PDO', status: 'agendado' },
  { id: '8', data: format(hoje, 'yyyy-MM-dd'), hora: '17:00', clienteId: '9', clienteNome: 'Isabela Mendes Barros', procedimentoId: '8', procedimentoNome: 'Intradermoterapia Facial', status: 'agendado' },
  { id: '9', data: format(addDays(hoje, 1), 'yyyy-MM-dd'), hora: '09:00', clienteId: '10', clienteNome: 'Juliana Ferraz Cardoso', procedimentoId: '9', procedimentoNome: 'Microagulhamento', status: 'confirmado' },
  { id: '10', data: format(addDays(hoje, 1), 'yyyy-MM-dd'), hora: '11:00', clienteId: '11', clienteNome: 'Karina Lopes Duarte', procedimentoId: '10', procedimentoNome: 'Peeling Químico', status: 'agendado' },
  { id: '11', data: format(addDays(hoje, 1), 'yyyy-MM-dd'), hora: '14:00', clienteId: '12', clienteNome: 'Larissa Teixeira Moura', procedimentoId: '11', procedimentoNome: 'Limpeza de Pele Profunda', status: 'cancelado' },
  { id: '12', data: format(addDays(hoje, 2), 'yyyy-MM-dd'), hora: '08:30', clienteId: '13', clienteNome: 'Mariana Vieira Santos', procedimentoId: '12', procedimentoNome: 'Tratamento de Melasma', status: 'agendado' },
  { id: '13', data: format(addDays(hoje, 2), 'yyyy-MM-dd'), hora: '10:00', clienteId: '15', clienteNome: 'Patrícia Cunha Azevedo', procedimentoId: '1', procedimentoNome: 'Aplicação de Toxina Botulínica', status: 'agendado' },
  { id: '14', data: format(addDays(hoje, 3), 'yyyy-MM-dd'), hora: '13:00', clienteId: '1', clienteNome: 'Ana Carolina Ferreira', procedimentoId: '2', procedimentoNome: 'Preenchimento Labial', status: 'agendado' },
  { id: '15', data: format(addDays(hoje, 4), 'yyyy-MM-dd'), hora: '15:30', clienteId: '2', clienteNome: 'Beatriz Santos Lima', procedimentoId: '3', procedimentoNome: 'Preenchimento de Malar', status: 'agendado' },
  { id: '16', data: format(addDays(hoje, 5), 'yyyy-MM-dd'), hora: '09:00', clienteId: '3', clienteNome: 'Camila Rodrigues Silva', procedimentoId: '4', procedimentoNome: 'Harmonização Facial', status: 'agendado' },
  { id: '17', data: format(addDays(hoje, 7), 'yyyy-MM-dd'), hora: '11:00', clienteId: '4', clienteNome: 'Daniela Oliveira Costa', procedimentoId: '5', procedimentoNome: 'Bioestimulador de Colágeno', status: 'agendado' },
  { id: '18', data: format(addDays(hoje, 8), 'yyyy-MM-dd'), hora: '14:00', clienteId: '5', clienteNome: 'Elena Martins Souza', procedimentoId: '6', procedimentoNome: 'Skinbooster Facial', status: 'agendado' },
  { id: '19', data: format(addDays(hoje, 10), 'yyyy-MM-dd'), hora: '16:00', clienteId: '6', clienteNome: 'Fernanda Almeida', procedimentoId: '7', procedimentoNome: 'Fios de PDO', status: 'agendado' },
  { id: '20', data: format(addDays(hoje, 12), 'yyyy-MM-dd'), hora: '09:30', clienteId: '8', clienteNome: 'Helena Castro Ribeiro', procedimentoId: '8', procedimentoNome: 'Intradermoterapia Facial', status: 'agendado' },
];
