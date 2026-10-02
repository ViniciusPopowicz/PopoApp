'use client';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, UserPlus, CalendarPlus, ClipboardPlus, Banknote, BellPlus, Calendar, Gift, Bell } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '@/lib/format';
import { dashboardData } from '@/data/mock/dashboard';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Início" description="Visão geral do seu negócio." />

      {/* StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Receitas"
          value={formatCurrency(dashboardData.receitasMes)}
          description="Este mês"
          className="border-success/20 bg-success/5"
        />
        <StatCard
          icon={TrendingDown}
          title="Despesas"
          value={formatCurrency(dashboardData.despesasMes)}
          description="Este mês"
          className="border-error/20 bg-error/5"
        />
        <StatCard
          icon={DollarSign}
          title="Saldo"
          value={formatCurrency(dashboardData.saldoMes)}
          description="Este mês"
          className="border-primary/20 bg-primary/5"
        />
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Button variant="outline" className="h-24 flex flex-col gap-2" asChild>
          <Link href="/clientes">
            <UserPlus className="h-6 w-6 text-primary" />
            <span>Novo Cliente</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col gap-2" asChild>
          <Link href="/agenda">
            <CalendarPlus className="h-6 w-6 text-primary" />
            <span>Novo Agendamento</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col gap-2" asChild>
          <Link href="/atendimentos">
            <ClipboardPlus className="h-6 w-6 text-primary" />
            <span>Novo Atendimento</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col gap-2" asChild>
          <Link href="/financeiro">
            <Banknote className="h-6 w-6 text-primary" />
            <span>Novo Lançamento</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-24 flex flex-col gap-2" asChild>
          <Link href="/lembretes">
            <BellPlus className="h-6 w-6 text-primary" />
            <span>Novo Lembrete</span>
          </Link>
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos Agendamentos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.proximosAgendamentos.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.proximosAgendamentos.map((agendamento) => (
                      <TableRow key={agendamento.id}>
                        <TableCell>
                          {formatDate(new Date(agendamento.data))} às {agendamento.hora}
                        </TableCell>
                        <TableCell className="font-medium">{agendamento.clienteNome}</TableCell>
                        <TableCell>
                          <StatusBadge status={agendamento.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">Nenhum agendamento próximo.</p>
            )}
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Aniversariantes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Aniversariantes
              </CardTitle>
              <CardDescription>Próximos aniversários</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.aniversariantes.length > 0 ? (
                <ul className="space-y-4">
                  {dashboardData.aniversariantes.map((a) => (
                    <li key={a.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">{a.data}</p>
                      </div>
                      <Badge variant="secondary">Faltam {a.diasFaltando} dias</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm text-center">Nenhum aniversariante próximo.</p>
              )}
            </CardContent>
          </Card>

          {/* Lembretes Pendentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Lembretes Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.lembretesPendentes.length > 0 ? (
                <ul className="space-y-4">
                  {dashboardData.lembretesPendentes.map((l) => (
                    <li key={l.id} className="flex flex-col gap-1 border-b last:border-0 pb-2 last:pb-0">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{l.titulo}</p>
                        <Badge 
                          variant={l.prioridade === 'alta' ? 'destructive' : l.prioridade === 'media' ? 'default' : 'secondary'}
                        >
                          {l.prioridade}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{l.descricao}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm text-center">Tudo em dia!</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
