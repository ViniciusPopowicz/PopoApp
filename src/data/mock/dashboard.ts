import { mockAgenda } from './agenda';
import { mockClientes } from './clientes';
import { mockLembretes } from './lembretes';
import { addDays, format, isAfter, isBefore, subDays } from 'date-fns';

const hoje = new Date();
const proximaSemana = addDays(hoje, 7);

export const dashboardData = {
  receitasMes: 45600,
  despesasMes: 18200,
  saldoMes: 27400,
  proximosAgendamentos: mockAgenda.filter(a => 
    (a.status === 'agendado' || a.status === 'confirmado') &&
    isAfter(new Date(a.data), subDays(hoje, 1))
  ).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).slice(0, 5),
  aniversariantes: mockClientes.filter(c => {
    // simplificando a lógica de aniversário para o mock
    if (!c.dataNascimento) return false;
    const mesNasc = c.dataNascimento.split('-')[1];
    const mesAtual = format(hoje, 'MM');
    return mesNasc === mesAtual;
  }).map(c => ({
    id: c.id,
    nome: c.nome,
    data: format(new Date(c.dataNascimento!), 'dd/MM'),
    diasFaltando: Math.floor(Math.random() * 15) + 1 // mock
  })).sort((a, b) => a.diasFaltando - b.diasFaltando).slice(0, 5),
  lembretesPendentes: mockLembretes.filter(l => l.status === 'pendente' || l.status === 'atrasado').slice(0, 5)
};
