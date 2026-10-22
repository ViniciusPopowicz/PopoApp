'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  DollarSign,
  CalendarCheck,
  Calendar,
  AlertTriangle,
  Clock,
  Gift,
  UserPlus,
  CalendarPlus,
  ClipboardPlus,
  Banknote,
  BellPlus,
  ArrowRight,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

interface DashboardData {
  financial: {
    monthly: {
      receivedRevenue: number;
      averageTicket: number;
      totalRevenue: number;
    };
  };
  operations: {
    appointments: {
      todayTotal: number;
      nextAppointments: Array<{
        id: string;
        dataHora: string;
        status: string;
        client: { id: string; nome: string };
        plannedProcedures?: Array<{ procedure: { nome: string } }>;
      }>;
    };
    attendances: {
      completedCount: number;
      pendingCount: number;
    };
  };
  alerts: {
    lowStock: {
      totalAlerts: number;
      items: Array<{
        id: string;
        nome: string;
        estoqueAtual: number;
        estoqueMinimo: number;
        unidade: string;
        isCritical: boolean;
      }>;
    };
    reminders: {
      totalPending: number;
      totalOverdue: number;
      overdueItems: Array<{
        id: string;
        titulo: string;
        dataVencimento: string;
        prioridade: string;
        client?: { nome: string } | null;
        pixInstallment?: { valor: number } | null;
      }>;
      upcomingItems: Array<{
        id: string;
        titulo: string;
        dataVencimento: string;
        prioridade: string;
        client?: { nome: string } | null;
        pixInstallment?: { valor: number } | null;
      }>;
    };
    birthdays: {
      count: number;
      items: Array<{
        id: string;
        nome: string;
        diasRestantes: number;
        proximoAniversario: string;
      }>;
    };
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dashboard/summary');
      if (!res.ok) {
        throw new Error('Falha ao carregar dados do dashboard');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Erro ao processar dados do dashboard');
      }
    } catch (err: any) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.message || 'Erro ao carregar dados do painel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const monthlyRevenue = data?.financial?.monthly?.receivedRevenue ?? 0;
  const averageTicket = data?.financial?.monthly?.averageTicket ?? 0;
  const completedAttendances = data?.operations?.attendances?.completedCount ?? 0;
  const todayAppointments = data?.operations?.appointments?.todayTotal ?? 0;

  const lowStockItems = data?.alerts?.lowStock?.items ?? [];
  const overdueReminders = data?.alerts?.reminders?.overdueItems ?? [];
  const upcomingReminders = data?.alerts?.reminders?.upcomingItems ?? [];
  const allReminders = [...overdueReminders, ...upcomingReminders];
  const birthdays = data?.alerts?.birthdays?.items ?? [];
  const nextAppointments = data?.operations?.appointments?.nextAppointments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Início" description="Visão geral e indicadores clínicos do seu consultório." />
        <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading} className="w-fit">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm">
          {error}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Faturamento do Mês"
          value={loading ? 'Carregando...' : formatCurrency(monthlyRevenue)}
          description="Receita confirmada"
          className="border-success/20 bg-success/5"
        />
        <StatCard
          icon={DollarSign}
          title="Ticket Médio"
          value={loading ? 'Carregando...' : formatCurrency(averageTicket)}
          description="Por atendimento"
          className="border-primary/20 bg-primary/5"
        />
        <StatCard
          icon={CalendarCheck}
          title="Atendimentos Realizados"
          value={loading ? 'Carregando...' : completedAttendances.toString()}
          description="Neste mês"
          className="border-info/20 bg-info/5"
        />
        <StatCard
          icon={Calendar}
          title="Agendamentos Hoje"
          value={loading ? 'Carregando...' : todayAppointments.toString()}
          description="Previstos para hoje"
          className="border-warning/20 bg-warning/5"
        />
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5" asChild>
          <Link href="/clientes">
            <UserPlus className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Novo Cliente</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5" asChild>
          <Link href="/agenda">
            <CalendarPlus className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Novo Agendamento</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5" asChild>
          <Link href="/atendimentos">
            <ClipboardPlus className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Novo Atendimento</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5" asChild>
          <Link href="/financeiro">
            <Banknote className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Financeiro</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col items-center justify-center gap-1.5" asChild>
          <Link href="/lembretes">
            <BellPlus className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">Lembretes</span>
          </Link>
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos Agendamentos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-5 w-5 text-primary" />
                Próximos Agendamentos
              </CardTitle>
              <CardDescription>Agendamentos confirmados e pendentes</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agenda" className="text-xs text-primary flex items-center gap-1">
                Ver Agenda <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Carregando agendamentos...</p>
            ) : nextAppointments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Procedimento Planejado</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nextAppointments.map((agendamento) => {
                      const procNames = agendamento.plannedProcedures
                        ?.map((p) => p.procedure.nome)
                        .join(', ') || 'Não especificado';
                      return (
                        <TableRow key={agendamento.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDateTime(new Date(agendamento.dataHora))}
                          </TableCell>
                          <TableCell className="font-medium">{agendamento.client?.nome || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                            {procNames}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={agendamento.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum agendamento próximo.</p>
            )}
          </CardContent>
        </Card>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          {/* Alerta de Estoque Baixo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Boxes className="h-5 w-5 text-warning" />
                  Alerta de Estoque Baixo
                </CardTitle>
                <CardDescription>Produtos atingindo o estoque mínimo</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/produtos" className="text-xs text-primary flex items-center gap-1">
                  Estoque <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Carregando estoque...</p>
              ) : lowStockItems.length > 0 ? (
                <ul className="space-y-3">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Mínimo: {item.estoqueMinimo} {item.unidade}
                        </p>
                      </div>
                      <Badge variant={item.isCritical ? 'destructive' : 'outline'}>
                        {item.estoqueAtual} {item.unidade}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum alerta de estoque.</p>
              )}
            </CardContent>
          </Card>

          {/* Lembretes de Parcelas PIX */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Clock className="h-5 w-5 text-primary" />
                  Parcelas PIX & Lembretes
                </CardTitle>
                <CardDescription>Vencidas e a vencer</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/lembretes" className="text-xs text-primary flex items-center gap-1">
                  Ver Todos <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Carregando lembretes...</p>
              ) : allReminders.length > 0 ? (
                <ul className="space-y-3">
                  {allReminders.slice(0, 5).map((lembrete) => {
                    const isOverdue = new Date(lembrete.dataVencimento) < new Date();
                    return (
                      <li key={lembrete.id} className="flex flex-col gap-1 border-b last:border-0 pb-2 last:pb-0">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm leading-tight">{lembrete.titulo}</p>
                          <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">
                            {isOverdue ? 'Atrasado' : 'A Vencer'}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{lembrete.client?.nome || '—'}</span>
                          <span>Venc.: {formatDate(new Date(lembrete.dataVencimento))}</span>
                        </div>
                        {lembrete.pixInstallment && (
                          <div className="text-xs font-semibold text-primary">
                            {formatCurrency(lembrete.pixInstallment.valor)}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum lembrete pendente.</p>
              )}
            </CardContent>
          </Card>

          {/* Aniversariantes do Mês */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Gift className="h-5 w-5 text-primary" />
                Aniversariantes do Mês
              </CardTitle>
              <CardDescription>Clientes aniversariantes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Carregando aniversariantes...</p>
              ) : birthdays.length > 0 ? (
                <ul className="space-y-3">
                  {birthdays.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{a.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(new Date(a.proximoAniversario))}
                        </p>
                      </div>
                      <Badge variant={a.diasRestantes === 0 ? 'default' : 'secondary'}>
                        {a.diasRestantes === 0
                          ? 'Hoje!'
                          : a.diasRestantes === 1
                          ? 'Amanhã'
                          : `Em ${a.diasRestantes} dias`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum aniversariante neste período.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
