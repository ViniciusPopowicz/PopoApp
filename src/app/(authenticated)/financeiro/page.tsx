'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  CreditCard,
  QrCode,
  Calendar,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

interface FinancialSummaryData {
  metrics: {
    totalRevenue: number;
    receivedRevenue: number;
    pendingRevenue: number;
    canceledRevenue: number;
    transactionCount: number;
    averageTicket: number;
  };
  cashFlow: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  receivables: {
    totalReceivable: number;
    countPendingInstallments: number;
    overdueTotal: number;
    overdueCount: number;
    dueSoonTotal: number;
    dueSoonCount: number;
  };
}

interface TransactionItem {
  id: string;
  valor: number;
  metodo: string;
  status: string;
  dataPagamento: string;
  numeroParcelas: number;
  identificadorTransacao?: string | null;
  observacoes?: string | null;
  attendance: {
    id: string;
    dataHora: string;
    status: string;
    client: {
      id: string;
      nome: string;
      cpf?: string | null;
    };
    procedures: Array<{
      practicedValue: number;
      procedure: { nome: string };
    }>;
  };
}

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'transacoes'>('visao-geral');
  const [period, setPeriod] = useState<'month' | 'week' | 'today' | 'all'>('month');

  // Summary state
  const [summary, setSummary] = useState<FinancialSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Transactions state
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [transPage, setTransPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterMetodo, setFilterMetodo] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Fetch Summary
  const fetchSummary = async () => {
    try {
      setLoadingSummary(true);
      setError(null);
      const res = await fetch(`/api/financial/summary?period=${period}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar resumo financeiro');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
      } else {
        throw new Error(json.error || 'Erro ao consultar resumo financeiro');
      }
    } catch (err: any) {
      console.error('Error fetching financial summary:', err);
      setError(err.message || 'Erro ao carregar dados financeiros.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch Transactions
  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const params = new URLSearchParams();
      params.set('page', transPage.toString());
      params.set('limit', '15');
      if (filterMetodo !== 'todos') params.set('metodo', filterMetodo);
      if (filterStatus !== 'todos') params.set('status', filterStatus);

      const res = await fetch(`/api/financial/transactions?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar lançamentos');
      }
      const json = await res.json();
      if (json.success && json.payments) {
        setTransactions(json.payments);
        setTotalPages(json.totalPages || 1);
        setTotalCount(json.total || 0);
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transPage, filterMetodo, filterStatus]);

  const getMethodName = (m: string) => {
    switch (m) {
      case 'CartaoCredito':
        return 'Cartão de Crédito';
      case 'CartaoDebito':
        return 'Cartão de Débito';
      case 'Pix':
        return 'PIX';
      case 'Dinheiro':
        return 'Dinheiro';
      case 'Boleto':
        return 'Boleto';
      case 'Transferencia':
        return 'Transferência';
      default:
        return m;
    }
  };

  const metrics = summary?.metrics;
  const receivables = summary?.receivables;
  const cashFlow = summary?.cashFlow || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Gestão Financeira"
          description="Contas a receber, fluxo de caixa por método e livro de transações."
        />

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[150px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="all">Todo o Histórico</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchSummary();
              fetchTransactions();
            }}
            disabled={loadingSummary}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Receita Realizada"
          value={loadingSummary ? '...' : formatCurrency(metrics?.receivedRevenue || 0)}
          description="Total pago no período"
          className="border-success/20 bg-success/5"
        />
        <StatCard
          icon={Clock}
          title="Contas a Receber"
          value={loadingSummary ? '...' : formatCurrency(receivables?.totalReceivable || 0)}
          description={`${receivables?.countPendingInstallments || 0} parcelas pendentes`}
          className="border-warning/20 bg-warning/5"
        />
        <StatCard
          icon={AlertCircle}
          title="Parcelas em Atraso"
          value={loadingSummary ? '...' : formatCurrency(receivables?.overdueTotal || 0)}
          description={`${receivables?.overdueCount || 0} parcelas vencidas`}
          className="border-destructive/20 bg-destructive/5"
        />
        <StatCard
          icon={DollarSign}
          title="Ticket Médio"
          value={loadingSummary ? '...' : formatCurrency(metrics?.averageTicket || 0)}
          description={`${metrics?.transactionCount || 0} transações`}
          className="border-primary/20 bg-primary/5"
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="visao-geral">Fluxo de Caixa & Contas a Receber</TabsTrigger>
          <TabsTrigger value="transacoes">Livro de Transações</TabsTrigger>
        </TabsList>

        {/* Tab 1: Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fluxo de Caixa por Método */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Fluxo de Caixa por Forma de Pagamento
                </CardTitle>
                <CardDescription>Valores recebidos por modalidade financeira no período</CardDescription>
              </CardHeader>
              <CardContent>
                {cashFlow.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    Nenhum recebimento registrado neste período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cashFlow.map((item) => {
                      const totalReceived = metrics?.receivedRevenue || 1;
                      const pct = Math.min(100, (item.total / (totalReceived || 1)) * 100);
                      return (
                        <div key={item.method} className="space-y-1.5 border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span className="flex items-center gap-2">
                              {item.method === 'Pix' && <QrCode className="h-4 w-4 text-emerald-600" />}
                              {item.method === 'CartaoCredito' && <CreditCard className="h-4 w-4 text-blue-600" />}
                              {getMethodName(item.method)}
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {item.count} {item.count === 1 ? 'transação' : 'transações'}
                              </Badge>
                            </span>
                            <span className="font-semibold">{formatCurrency(item.total)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detalhamento Contas a Receber */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Previsão de Recebimento
                </CardTitle>
                <CardDescription>Resumo de parcelamentos PIX pendentes e prazos de quitação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-warning/5 border-warning/20 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Vencendo nos próximos 7 dias</p>
                    <p className="text-lg font-bold text-warning">
                      {formatCurrency(receivables?.dueSoonTotal || 0)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {receivables?.dueSoonCount || 0} parcelas
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg bg-destructive/5 border-destructive/20 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Parcelas já vencidas (Em Atraso)</p>
                    <p className="text-lg font-bold text-destructive">
                      {formatCurrency(receivables?.overdueTotal || 0)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {receivables?.overdueCount || 0} em atraso
                  </Badge>
                </div>

                <div className="p-4 border rounded-lg bg-muted/20 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Geral a Receber</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(receivables?.totalReceivable || 0)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {receivables?.countPendingInstallments || 0} pendentes
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Livro de Transações */}
        <TabsContent value="transacoes" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar por:</span>
              <Select value={filterMetodo} onValueChange={(v) => { setFilterMetodo(v); setTransPage(1); }}>
                <SelectTrigger className="w-[140px] text-xs h-8">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Métodos</SelectItem>
                  <SelectItem value="Pix">PIX</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="CartaoDebito">Débito</SelectItem>
                  <SelectItem value="CartaoCredito">Crédito</SelectItem>
                  <SelectItem value="Transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setTransPage(1); }}>
                <SelectTrigger className="w-[130px] text-xs h-8">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs text-muted-foreground">
              Total: {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Atendimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTransactions ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando transações...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma transação encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        {formatDateTime(new Date(tx.dataPagamento))}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {tx.attendance?.client?.nome || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {tx.attendance?.procedures?.map((p) => p.procedure.nome).join(', ') || 'Atendimento'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span>{getMethodName(tx.metodo)}</span>
                        {tx.numeroParcelas > 1 && (
                          <span className="text-muted-foreground ml-1">({tx.numeroParcelas}x)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatCurrency(Number(tx.valor))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {tx.attendance?.id && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/atendimentos/${tx.attendance.id}`} className="gap-1 text-xs">
                              <Eye className="h-3.5 w-3.5" />
                              <span>Ver</span>
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
              <span>
                Página {transPage} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransPage((p) => Math.max(1, p - 1))}
                  disabled={transPage <= 1 || loadingTransactions}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransPage((p) => Math.min(totalPages, p + 1))}
                  disabled={transPage >= totalPages || loadingTransactions}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
