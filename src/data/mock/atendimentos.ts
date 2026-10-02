import { MockAtendimento } from '@/types';
import { format, subDays, subMonths } from 'date-fns';

const hoje = new Date();

export const mockAtendimentos: MockAtendimento[] = [
  { id: '1', data: format(subDays(hoje, 1), 'yyyy-MM-dd'), clienteId: '1', clienteNome: 'Ana Carolina Ferreira', procedimentoId: '1', procedimentoNome: 'Aplicação de Toxina Botulínica', produtosUsados: ['1'], valor: 1500, statusPagamento: 'pago', observacoes: 'Paciente bem responsiva.' },
  { id: '2', data: format(subDays(hoje, 2), 'yyyy-MM-dd'), clienteId: '2', clienteNome: 'Beatriz Santos Lima', procedimentoId: '2', procedimentoNome: 'Preenchimento Labial', produtosUsados: ['3'], valor: 2500, statusPagamento: 'pago' },
  { id: '3', data: format(subDays(hoje, 3), 'yyyy-MM-dd'), clienteId: '3', clienteNome: 'Camila Rodrigues Silva', procedimentoId: '3', procedimentoNome: 'Preenchimento de Malar', produtosUsados: ['4'], valor: 3000, statusPagamento: 'pago' },
  { id: '4', data: format(subDays(hoje, 5), 'yyyy-MM-dd'), clienteId: '4', clienteNome: 'Daniela Oliveira Costa', procedimentoId: '4', procedimentoNome: 'Harmonização Facial', produtosUsados: ['1', '3'], valor: 5000, statusPagamento: 'pendente' },
  { id: '5', data: format(subDays(hoje, 7), 'yyyy-MM-dd'), clienteId: '5', clienteNome: 'Elena Martins Souza', procedimentoId: '5', procedimentoNome: 'Bioestimulador de Colágeno', produtosUsados: ['6'], valor: 3500, statusPagamento: 'pago' },
  { id: '6', data: format(subDays(hoje, 10), 'yyyy-MM-dd'), clienteId: '6', clienteNome: 'Fernanda Almeida', procedimentoId: '6', procedimentoNome: 'Skinbooster Facial', produtosUsados: ['8'], valor: 1800, statusPagamento: 'pago' },
  { id: '7', data: format(subDays(hoje, 12), 'yyyy-MM-dd'), clienteId: '8', clienteNome: 'Helena Castro Ribeiro', procedimentoId: '7', procedimentoNome: 'Fios de PDO', produtosUsados: ['10'], valor: 4000, statusPagamento: 'pago' },
  { id: '8', data: format(subDays(hoje, 15), 'yyyy-MM-dd'), clienteId: '9', clienteNome: 'Isabela Mendes Barros', procedimentoId: '8', procedimentoNome: 'Intradermoterapia Facial', produtosUsados: ['11'], valor: 600, statusPagamento: 'pago' },
  { id: '9', data: format(subDays(hoje, 18), 'yyyy-MM-dd'), clienteId: '10', clienteNome: 'Juliana Ferraz Cardoso', procedimentoId: '9', procedimentoNome: 'Microagulhamento', produtosUsados: [], valor: 800, statusPagamento: 'pendente' },
  { id: '10', data: format(subDays(hoje, 20), 'yyyy-MM-dd'), clienteId: '11', clienteNome: 'Karina Lopes Duarte', procedimentoId: '10', procedimentoNome: 'Peeling Químico', produtosUsados: [], valor: 500, statusPagamento: 'pago' },
  { id: '11', data: format(subDays(hoje, 22), 'yyyy-MM-dd'), clienteId: '12', clienteNome: 'Larissa Teixeira Moura', procedimentoId: '11', procedimentoNome: 'Limpeza de Pele Profunda', produtosUsados: [], valor: 350, statusPagamento: 'pago' },
  { id: '12', data: format(subDays(hoje, 25), 'yyyy-MM-dd'), clienteId: '13', clienteNome: 'Mariana Vieira Santos', procedimentoId: '12', procedimentoNome: 'Tratamento de Melasma', produtosUsados: ['12'], valor: 700, statusPagamento: 'pago' },
  { id: '13', data: format(subMonths(hoje, 1), 'yyyy-MM-dd'), clienteId: '15', clienteNome: 'Patrícia Cunha Azevedo', procedimentoId: '1', procedimentoNome: 'Aplicação de Toxina Botulínica', produtosUsados: ['1'], valor: 1500, statusPagamento: 'pago' },
  { id: '14', data: format(subMonths(hoje, 1), 'yyyy-MM-dd'), clienteId: '1', clienteNome: 'Ana Carolina Ferreira', procedimentoId: '6', procedimentoNome: 'Skinbooster Facial', produtosUsados: ['8'], valor: 1800, statusPagamento: 'pago' },
  { id: '15', data: format(subMonths(hoje, 2), 'yyyy-MM-dd'), clienteId: '2', clienteNome: 'Beatriz Santos Lima', procedimentoId: '5', procedimentoNome: 'Bioestimulador de Colágeno', produtosUsados: ['6'], valor: 3500, statusPagamento: 'pago' },
];
