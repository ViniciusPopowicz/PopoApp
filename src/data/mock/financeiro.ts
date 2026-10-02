import { MockFinanceiro } from '@/types';
import { format, subDays, subMonths, addDays } from 'date-fns';

const hoje = new Date();

export const mockFinanceiro: MockFinanceiro[] = [
  { id: '1', data: format(hoje, 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Preenchimento - Ana', valor: 2500, status: 'pago', formaPagamento: 'pix', atendimentoId: '2' },
  { id: '2', data: format(hoje, 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Botox - Beatriz', valor: 1500, status: 'pago', formaPagamento: 'credito', atendimentoId: '1' },
  { id: '3', data: format(subDays(hoje, 2), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'produtos', descricao: 'Compra Allergan', valor: 8500, status: 'pago', formaPagamento: 'boleto' },
  { id: '4', data: format(subDays(hoje, 3), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Harmonização - Camila', valor: 5000, status: 'pago', formaPagamento: 'pix', atendimentoId: '4' },
  { id: '5', data: format(subDays(hoje, 5), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'aluguel', descricao: 'Aluguel Clínica', valor: 4500, status: 'pago', formaPagamento: 'pix' },
  { id: '6', data: format(subDays(hoje, 5), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'impostos', descricao: 'DAS Simples Nacional', valor: 1200, status: 'pago', formaPagamento: 'boleto' },
  { id: '7', data: format(subDays(hoje, 7), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Bioestimulador - Daniela', valor: 3500, status: 'pago', formaPagamento: 'credito', atendimentoId: '5' },
  { id: '8', data: format(subDays(hoje, 10), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'marketing', descricao: 'Anúncios Instagram', valor: 800, status: 'pago', formaPagamento: 'credito' },
  { id: '9', data: format(subDays(hoje, 12), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Fios PDO - Elena', valor: 4000, status: 'pago', formaPagamento: 'pix', atendimentoId: '7' },
  { id: '10', data: format(subDays(hoje, 15), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'produtos', descricao: 'Compra Galderma', valor: 6000, status: 'pendente', formaPagamento: 'boleto' },
  { id: '11', data: format(subDays(hoje, 18), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Limpeza de Pele - Fernanda', valor: 350, status: 'pago', formaPagamento: 'dinheiro' },
  { id: '12', data: format(subDays(hoje, 20), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'equipamentos', descricao: 'Manutenção Laser', valor: 1500, status: 'pago', formaPagamento: 'pix' },
  { id: '13', data: format(subDays(hoje, 22), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Peeling - Gabriela', valor: 500, status: 'pago', formaPagamento: 'debito' },
  { id: '14', data: format(subDays(hoje, 25), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Microagulhamento - Helena', valor: 800, status: 'pago', formaPagamento: 'pix' },
  { id: '15', data: format(subDays(hoje, 28), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'salarios', descricao: 'Salário Recepcionista', valor: 2500, status: 'pago', formaPagamento: 'pix' },
  { id: '16', data: format(subDays(hoje, 28), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'outros', descricao: 'Conta de Luz', valor: 450, status: 'pago', formaPagamento: 'boleto' },
  { id: '17', data: format(subDays(hoje, 28), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'outros', descricao: 'Conta de Água', valor: 120, status: 'pago', formaPagamento: 'boleto' },
  { id: '18', data: format(subMonths(hoje, 1), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Botox - Isabela', valor: 1500, status: 'pago', formaPagamento: 'pix' },
  { id: '19', data: format(subMonths(hoje, 1), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Skinbooster - Juliana', valor: 1800, status: 'pago', formaPagamento: 'credito' },
  { id: '20', data: format(subMonths(hoje, 1), 'yyyy-MM-dd'), tipo: 'despesa', categoria: 'produtos', descricao: 'Compra Merz', valor: 4200, status: 'pago', formaPagamento: 'boleto' },
  { id: '21', data: format(addDays(hoje, 5), 'yyyy-MM-dd'), tipo: 'receita', categoria: 'procedimento', descricao: 'Harmonização - Karina (Parcela 2)', valor: 2500, status: 'pendente', formaPagamento: 'boleto' },
];
