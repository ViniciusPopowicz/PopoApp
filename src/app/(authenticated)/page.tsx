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
  financial?: {
    monthly?: {
      receivedRevenue?: number;
      averageTicket?: number;
      totalRevenue?: number;
      grossRevenue?: number;
      netRevenue?: number;
      outstandingRevenue?: number;
    };
  };
  operations?: {
    appointments?: {
      todayTotal?: number;
      upcomingList?: Array<{
        id: string;
        dataHora: string;
        status: string;
        clientId?: string;
        clientName?: string;
        procedimentosPlanejados?: string[];
      }>;
      nextAppointments?: Array<{
        id: string;
        dataHora: string;
        status: string;
        client?: { id: string; nome: string };
        clientName?: string;
        procedimentosPlanejados?: string[];
        plannedProcedures?: Array<{ procedure?: { nome: string }; nome?: string }>;
      }>;
    };
    attendances?: {
      completedCount?: number;
      realizadosCount?: number;
      pendingCount?: number;
      pendentesCount?: number;
      todayTotal?: number;
    };
  };
  alerts?: {
    lowStock?: Array<{
      productId?: string;
      id?: string;
      productName?: string;
      nome?: string;
      availableUnits?: number;
      estoqueAtual?: number;
      estoqueMinimo?: number;
      unidade?: string;
      alertLevel?: string;
      isCritical?: boolean;
    }> | {
      totalAlerts?: number;
      items?: Array<{
        id: string;
        nome: string;
        estoqueAtual: number;
        estoqueMinimo: number;
        unidade: string;
        isCritical: boolean;
      }>;
    };
    reminders?: {
      summary?: {
        totalPending?: number;
        overdueCount?: number;
        todayCount?: number;
        upcomingCount?: number;
      };
      items?: Array<{
        id: string;
        titulo: string;
        dataVencimento: string;
        prioridade: string;
        clientName?: string | null;
        installmentValor?: number | null;
        isOverdue?: boolean;
      }>;
      totalPending?: number;
      totalOverdue?: number;
      overdueItems?: Array<{
        id: string;
        titulo: string;
        dataVencimento: string;
        prioridade: string;
        client?: { nome: string } | null;
        clientName?: string | null;
        pixInstallment?: { valor: number } | null;
        installmentValor?: number | null;
      }>;
      upcomingItems?: Array<{
        id: string;
        titulo: string;
        dataVencimento: string;
        prioridade: string;
        client?: { nome: string } | null;
        clientName?: string | null;
        pixInstallment?: { valor: number } | null;
        installmentValor?: number | null;
      }>;
    };
    birthdays?: Array<{
      id: string;
      nome: string;
      dataNascimento?: string;
      dataAniversario?: string;
      diasFaltando?: number;
      proximoAniversario?: string;
      diasRestantes?: number;
    }> | {
      count?: number;
      items?: Array<{
        id: string;
        nome: string;
        diasRestantes?: number;
        diasFaltando?: number;
        proximoAniversario?: string;
        dataAniversario?: string;
        dataNascimento?: string;
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
        let errorMsg = 'Falha ao carregar dados do dashboard';
        try {
          const errJson = await res.json();
          if (errJson?.error) errorMsg = errJson.error;
        } catch {
          // ignore json parsing errors for non-json responses
        }
        throw new Error(errorMsg);
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

  const monthlyRevenue = data?.financial?.monthly?.receivedRevenue ?? data?.financial?.monthly?.totalRevenue ?? 0;
  const completedAttendances =
    data?.operations?.attendances?.completedCount ??
    data?.operations?.attendances?.realizadosCount ??
    0;
  const averageTicket =
    data?.financial?.monthly?.averageTicket ??
    (completedAttendances > 0 ? Number((monthlyRevenue / completedAttendances).toFixed(2)) : 0);
  const todayAppointments = data?.operations?.appointments?.todayTotal ?? 0;

  // Normalize low stock items whether an array or an object with .items
  const rawLowStock = data?.alerts?.lowStock;
  const lowStockItems: Array<{
    id: string;
    nome: string;
    estoqueAtual: number;
    estoqueMinimo: number;
    unidade: string;
    isCritical: boolean;
  }> = Array.isArray(rawLowStock)
    ? rawLowStock.map((item: any) => ({
        id: item.productId || item.id,
        nome: item.productName || item.nome,
        estoqueAtual: item.availableUnits ?? item.estoqueAtual ?? 0,
        estoqueMinimo: item.estoqueMinimo ?? 5,
        unidade: item.unidade || 'un',
        isCritical: item.alertLevel === 'CRITICO' || item.isCritical || (item.availableUnits ?? 0) === 0,
      }))
    : (rawLowStock?.items ?? []);

  // Normalize reminders
  const rawReminders = data?.alerts?.reminders;
  const allReminders: Array<{
    id: string;
    titulo: string;
    dataVencimento: string;
    prioridade: string;
    clientName: string;
    pixValor?: number | null;
    isOverdue: boolean;
  }> = rawReminders?.items
    ? rawReminders.items.map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        dataVencimento: r.dataVencimento,
        prioridade: r.prioridade,
        clientName: r.clientName || r.client?.nome || '—',
        pixValor: r.installmentValor ?? r.pixInstallment?.valor ?? null,
        isOverdue: r.isOverdue ?? (r.dataVencimento ? new Date(r.dataVencimento) < new Date() : false),
      }))
    : [
        ...(rawReminders?.overdueItems ?? []),
        ...(rawReminders?.upcomingItems ?? []),
      ].map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        dataVencimento: r.dataVencimento,
        prioridade: r.prioridade,
        clientName: r.client?.nome || r.clientName || '—',
        pixValor: r.pixInstallment?.valor ?? r.installmentValor ?? null,
        isOverdue: r.dataVencimento ? new Date(r.dataVencimento) < new Date() : false,
      }));

  // Normalize birthdays
  const rawBirthdays = data?.alerts?.birthdays;
  const birthdays: Array<{
    id: string;
    nome: string;
    diasRestantes: number;
    dataExibicao: string;
  }> = (Array.isArray(rawBirthdays) ? rawBirthdays : (rawBirthdays?.items ?? [])).map((a: any) => ({
    id: a.id,
    nome: a.nome,
    diasRestantes: a.diasFaltando ?? a.diasRestantes ?? 0,
    dataExibicao: a.dataAniversario || (a.proximoAniversario ? formatDate(a.proximoAniversario) : (a.dataNascimento ? formatDate(a.dataNascimento) : '—')),
  }));

  // Normalize upcoming appointments
  const rawAppts = data?.operations?.appointments;
  const nextAppointments: Array<{
    id: string;
    dataHora: string;
    clientName: string;
    procNames: string;
    status: string;
  }> = (rawAppts?.upcomingList || rawAppts?.nextAppointments || []).map((a: any) => {
    let procNames = 'Não especificado';
    if (Array.isArray(a.procedimentosPlanejados) && a.procedimentosPlanejados.length > 0) {
      procNames = a.procedimentosPlanejados.join(', ');
    } else if (Array.isArray(a.plannedProcedures) && a.plannedProcedures.length > 0) {
      procNames = a.plannedProcedures.map((p: any) => p.procedure?.nome || p.nome).filter(Boolean).join(', ') || 'Não especificado';
    }
    return {
      id: a.id,
      dataHora: a.dataHora,
      clientName: a.clientName || a.client?.nome || '—',
      procNames,
      status: a.status || 'Agendado',
    };
  });

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
                    {nextAppointments.map((agendamento) => (
                      <TableRow key={agendamento.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatDateTime(agendamento.dataHora)}
                        </TableCell>
                        <TableCell className="font-medium">{agendamento.clientName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {agendamento.procNames}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={agendamento.status} />
                        </TableCell>
                      </TableRow>
                    ))}
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
                  {allReminders.slice(0, 5).map((lembrete) => (
                    <li key={lembrete.id} className="flex flex-col gap-1 border-b last:border-0 pb-2 last:pb-0">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm leading-tight">{lembrete.titulo}</p>
                        <Badge variant={lembrete.isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">
                          {lembrete.isOverdue ? 'Atrasado' : 'A Vencer'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{lembrete.clientName}</span>
                        <span>Venc.: {formatDate(lembrete.dataVencimento)}</span>
                      </div>
                      {lembrete.pixValor != null && (
                        <div className="text-xs font-semibold text-primary">
                          {formatCurrency(lembrete.pixValor)}
                        </div>
                      )}
                    </li>
                  ))}
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
                          {a.dataExibicao}
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
