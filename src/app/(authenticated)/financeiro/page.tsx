'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Plus,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import { FinancialObligationDto, FinancialMovementDto } from '@/types/financial';

interface FinancialSummaryData {
  period: { startDate: string; endDate: string };
  metrics: {
    grossRevenue: number;
    totalDiscounts: number;
    netRevenue: number;
    receivedRevenue: number;
    outstandingRevenue: number;
    averageTicket: number;
    transactionCount: number;
    totalInflows: number;
    totalOutflows: number;
    netCashFlow: number;
  };
  cashFlow: Array<{
    metodo: string;
    method: string;
    label: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  receivables: {
    totalOutstanding: number;
    totalReceivable: number;
    attendancesCount: number;
    clientsCount: number;
    countPendingInstallments: number;
    overdueTotal: number;
    overdueCount: number;
    dueSoonTotal: number;
    dueSoonCount: number;
    obligationsPendingTotal: number;
    obligationsOverdueTotal: number;
  };
  payables?: {
    totalPending: number;
    totalOverdue: number;
    outflowsByCategory: Array<{
      categoria: string;
      total: number;
      count: number;
    }>;
  };
}

interface TransactionItem {
  id: string;
  valor: number;
  metodo: string;
  status: string;
  dataPagamento: string | null;
  numeroParcelas: number;
  identificadorTransacao: string | null;
  observacoes: string | null;
  attendance: {
    id: string;
    dataHora: string;
    status: string;
    desconto: number;
    client: {
      id: string;
      nome: string;
      cpf: string;
    };
    procedures: Array<{
      id?: string;
      nome?: string;
      practicedValue: number;
      procedure?: {
        id?: string;
        nome: string;
      };
    }>;
  };
  pixInstallments: Array<{
    id: string;
    numeroParcela: number;
    totalParcelas: number;
    valor: number;
    dataVencimento: string;
    status: string;
  }>;
}

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'receber' | 'pagar' | 'movimentacoes'>('visao_geral');

  // Summary State
  const [period, setPeriod] = useState<string>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [summary, setSummary] = useState<FinancialSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Transactions State
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(true);
  const [txStatus, setTxStatus] = useState<string>('ALL');
  const [txMethod, setTxMethod] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalTx, setTotalTx] = useState<number>(0);

  // Obligations State (Receivables & Payables)
  const [receivablesList, setReceivablesList] = useState<FinancialObligationDto[]>([]);
  const [payablesList, setPayablesList] = useState<FinancialObligationDto[]>([]);
  const [movementsList, setMovementsList] = useState<FinancialMovementDto[]>([]);
  const [loadingObligations, setLoadingObligations] = useState<boolean>(false);

  // Dialogs State
  const [showObligationDialog, setShowObligationDialog] = useState<boolean>(false);
  const [obligationDialogType, setObligationDialogType] = useState<'RECEIVABLE' | 'PAYABLE'>('PAYABLE');
  const [obDescricao, setObDescricao] = useState('');
  const [obCategoria, setObCategoria] = useState('');
  const [obFornecedor, setObFornecedor] = useState('');
  const [obValor, setObValor] = useState('');
  const [obVencimento, setObVencimento] = useState(() => new Date().toISOString().split('T')[0]);
  const [obMetodo, setObMetodo] = useState('Pix');
  const [obObservacoes, setObObservacoes] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Settle Dialog State
  const [settleTarget, setSettleTarget] = useState<FinancialObligationDto | null>(null);
  const [settleValor, setSettleValor] = useState('');
  const [settleMetodo, setSettleMetodo] = useState('Pix');
  const [settleData, setSettleData] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleObs, setSettleObs] = useState('');

  // Manual Movement Dialog State
  const [showMovementDialog, setShowMovementDialog] = useState<boolean>(false);
  const [movTipo, setMovTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA');
  const [movDescricao, setMovDescricao] = useState('');
  const [movCategoria, setMovCategoria] = useState('');
  const [movValor, setMovValor] = useState('');
  const [movMetodo, setMovMetodo] = useState('Pix');
  const [movData, setMovData] = useState(() => new Date().toISOString().split('T')[0]);

  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('period', period);
      if (period === 'custom') {
        if (customStart) params.set('startDate', new Date(customStart).toISOString());
        if (customEnd) params.set('endDate', new Date(customEnd).toISOString());
      }

      const res = await fetch(`/api/financial/summary?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao carregar resumo financeiro');
      }

      setSummary(json.data);
    } catch (err: any) {
      console.error('Error fetching financial summary:', err);
      setError(err.message || 'Falha ao carregar indicadores financeiros.');
    } finally {
      setLoadingSummary(false);
    }
  }, [period, customStart, customEnd]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTx(true);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (txStatus !== 'ALL') params.set('status', txStatus);
      if (txMethod !== 'ALL') params.set('metodo', txMethod);

      const res = await fetch(`/api/financial/transactions?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao carregar transações');
      }

      const items = json.data ?? json.payments ?? [];
      setTransactions(items);
      setTotalPages(json.pagination?.totalPages ?? json.totalPages ?? 1);
      setTotalTx(json.pagination?.total ?? json.total ?? items.length);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [page, txStatus, txMethod]);

  const fetchObligationsAndMovements = useCallback(async () => {
    try {
      setLoadingObligations(true);
      const [recRes, payRes, movRes] = await Promise.all([
        fetch('/api/financial/obligations?tipo=RECEIVABLE&limit=100'),
        fetch('/api/financial/obligations?tipo=PAYABLE&limit=100'),
        fetch('/api/financial/movements?limit=100'),
      ]);

      const [recJson, payJson, movJson] = await Promise.all([
        recRes.json(),
        payRes.json(),
        movRes.json(),
      ]);

      if (recJson.success) setReceivablesList(recJson.data ?? []);
      if (payJson.success) setPayablesList(payJson.data ?? []);
      if (movJson.success) setMovementsList(movJson.data ?? []);
    } catch (err) {
      console.error('Error fetching obligations/movements:', err);
    } finally {
      setLoadingObligations(false);
    }
  }, []);

  useEffect(() => {
    if (period !== 'custom' || (customStart && customEnd)) {
      fetchSummary();
    }
  }, [period, customStart, customEnd, fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchObligationsAndMovements();
  }, [fetchObligationsAndMovements]);

  const refreshAll = () => {
    fetchSummary();
    fetchTransactions();
    fetchObligationsAndMovements();
  };

  const handleOpenCreateObligation = (tipo: 'RECEIVABLE' | 'PAYABLE') => {
    setObligationDialogType(tipo);
    setObDescricao('');
    setObCategoria(tipo === 'PAYABLE' ? 'Insumos / Fornecedores' : 'Cobrança Clínica');
    setObFornecedor('');
    setObValor('');
    setObVencimento(new Date().toISOString().split('T')[0]);
    setObMetodo('Pix');
    setObObservacoes('');
    setDialogError(null);
    setShowObligationDialog(true);
  };

  const handleCreateObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setDialogError(null);
      const res = await fetch('/api/financial/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: obligationDialogType,
          descricao: obDescricao,
          categoria: obCategoria || null,
          fornecedor: obFornecedor || null,
          valorOriginal: Number(obValor),
          dataVencimento: new Date(obVencimento + 'T12:00:00').toISOString(),
          metodo: obMetodo || null,
          observacoes: obObservacoes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao criar obrigação financeira');
      }
      setShowObligationDialog(false);
      refreshAll();
    } catch (err: any) {
      setDialogError(err.message || 'Erro ao salvar obrigação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSettle = (ob: FinancialObligationDto) => {
    setSettleTarget(ob);
    setSettleValor(String(ob.remainingBalance));
    setSettleMetodo(ob.metodo || 'Pix');
    setSettleData(new Date().toISOString().split('T')[0]);
    setSettleObs('');
    setDialogError(null);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    try {
      setSubmitting(true);
      setDialogError(null);
      const res = await fetch(`/api/financial/obligations/${settleTarget.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: Number(settleValor),
          metodo: settleMetodo,
          dataLiquidacao: new Date(settleData + 'T12:00:00').toISOString(),
          observacoes: settleObs || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar baixa');
      }
      setSettleTarget(null);
      refreshAll();
    } catch (err: any) {
      setDialogError(err.message || 'Erro ao liquidar obrigação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelObligation = async (ob: FinancialObligationDto) => {
    const hasPaid = ob.paidAmount > 0;
    const msg = hasPaid
      ? 'Esta obrigação já possui pagamentos parciais. Deseja cancelar e estornar os valores recebidos/pagos?'
      : 'Deseja realmente cancelar esta obrigação financeira?';
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/financial/obligations/${ob.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: 'Cancelamento pelo painel financeiro',
          reverseSettlements: hasPaid,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Erro ao cancelar obrigação');
        return;
      }
      refreshAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar obrigação');
    }
  };

  const handleCreateManualMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setDialogError(null);
      const res = await fetch('/api/financial/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: movTipo,
          descricao: movDescricao,
          categoria: movCategoria || null,
          valor: Number(movValor),
          metodo: movMetodo,
          dataMovimentacao: new Date(movData + 'T12:00:00').toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao criar lançamento manual');
      }
      setShowMovementDialog(false);
      setMovDescricao('');
      setMovCategoria('');
      setMovValor('');
      refreshAll();
    } catch (err: any) {
      setDialogError(err.message || 'Erro ao salvar movimentação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseMovement = async (mov: FinancialMovementDto) => {
    const motivo = prompt('Informe o motivo do estorno desta movimentação:', 'Correção de lançamento');
    if (!motivo) return;
    try {
      const res = await fetch(`/api/financial/movements/${mov.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Erro ao estornar movimentação');
        return;
      }
      refreshAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao estornar movimentação');
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Dinheiro':
      case 'dinheiro':
        return <Banknote className="h-4 w-4 text-emerald-600" />;
      case 'Pix':
      case 'pix_avista':
      case 'pix_parcelado':
        return <QrCode className="h-4 w-4 text-teal-600" />;
      case 'CartaoCredito':
      case 'CartaoDebito':
      case 'cartao_credito':
      case 'cartao_debito':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const metrics = summary?.metrics;
  const receivables = summary?.receivables;
  const payables = summary?.payables;
  const cashFlow = summary?.cashFlow || [];

  return (
    <div className="space-y-6">
      {/* Header & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Gestão Financeira"
          description="Controle completo de fluxo de caixa, contas a receber, contas a pagar e transações."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenCreateObligation('RECEIVABLE')}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Conta a Receber
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenCreateObligation('PAYABLE')}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Despesa / Pagar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setDialogError(null);
              setShowMovementDialog(true);
            }}
          >
            <Wallet className="h-4 w-4 mr-1" />
            Lançamento Manual
          </Button>

          <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="year">Este Ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs w-32"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs w-32"
                />
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refreshAll}
              disabled={loadingSummary}
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Entradas Realizadas (Caixa)</span>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-success">
              {loadingSummary ? '...' : formatCurrency(metrics?.totalInflows ?? metrics?.receivedRevenue ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Receita líquida clínica: {formatCurrency(metrics?.netRevenue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Saídas Realizadas (Despesas)</span>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-destructive">
              {loadingSummary ? '...' : formatCurrency(metrics?.totalOutflows || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Saldo líquido período:{' '}
              <strong className="text-foreground">
                {formatCurrency(metrics?.netCashFlow ?? (metrics?.receivedRevenue || 0))}
              </strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Contas a Receber (Aberto)</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600">
              {loadingSummary
                ? '...'
                : formatCurrency(receivables?.totalReceivable ?? receivables?.totalOutstanding ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Em atraso:{' '}
              <strong className="text-destructive">
                {formatCurrency(receivables?.overdueTotal || 0)}
              </strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Contas a Pagar (Pendente)</span>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {loadingSummary ? '...' : formatCurrency(payables?.totalPending || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Vencidas:{' '}
              <strong className="text-destructive">
                {formatCurrency(payables?.totalOverdue || 0)}
              </strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao_geral">Visão Geral & Transações</TabsTrigger>
          <TabsTrigger value="receber">
            Contas a Receber ({receivablesList.filter((r) => r.status !== 'Pago' && r.status !== 'Cancelado').length})
          </TabsTrigger>
          <TabsTrigger value="pagar">
            Contas a Pagar ({payablesList.filter((p) => p.status !== 'Pago' && p.status !== 'Cancelado').length})
          </TabsTrigger>
          <TabsTrigger value="movimentacoes">Livro Caixa ({movementsList.length})</TabsTrigger>
        </TabsList>

        {/* TAB 1: VISÃO GERAL & TRANSAÇÕES */}
        <TabsContent value="visao_geral" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Flow Breakdown by Method */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Entradas por Meio de Pagamento</CardTitle>
                <CardDescription className="text-xs">
                  Distribuição dos valores efetivamente recebidos no período selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSummary ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Calculando distribuição...</div>
                ) : cashFlow.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground italic">
                    Nenhum recebimento liquidado no período selecionado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cashFlow.map((item) => {
                      const methodKey = item.metodo || item.method;
                      return (
                        <div key={methodKey} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 font-medium">
                              {getMethodIcon(methodKey)}
                              <span>{item.label || PAYMENT_METHOD_LABELS[methodKey] || methodKey}</span>
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                              <span className="font-semibold">{formatCurrency(item.total)}</span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Receivables & Payables Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo de Obrigações</CardTitle>
                <CardDescription className="text-xs">
                  Parcelas PIX, cobranças e despesas pendentes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total a Receber</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(receivables?.totalReceivable ?? receivables?.totalOutstanding ?? 0)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {receivables?.countPendingInstallments || 0} parcelas PIX
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
                    <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Recebíveis Vencidos</span>
                    </div>
                    <p className="text-base font-bold text-destructive">
                      {formatCurrency(receivables?.overdueTotal || 0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {receivables?.overdueCount || 0} parcela(s) PIX vencida(s)
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Contas a Pagar</span>
                    </div>
                    <p className="text-base font-bold text-amber-700 dark:text-amber-400">
                      {formatCurrency(payables?.totalPending || 0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Vencidas: {formatCurrency(payables?.totalOverdue || 0)}
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex gap-2">
                  <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                    <Link href="/lembretes">
                      <span>Ver Lembretes de Cobrança</span>
                      <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Payments Ledger */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Pagamentos de Atendimentos</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Histórico detalhado de pagamentos registrados nos atendimentos ({totalTx} registros).
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select
                    value={txStatus}
                    onValueChange={(v) => {
                      setTxStatus(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos Status</SelectItem>
                      <SelectItem value="Pago">Pago</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Atrasado">Atrasado</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select
                  value={txMethod}
                  onValueChange={(v) => {
                    setTxMethod(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="Meio de Pagto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos Meios</SelectItem>
                    <SelectItem value="Pix">PIX</SelectItem>
                    <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                    <SelectItem value="CartaoDebito">Cartão de Débito</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {loadingTx ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Carregando transações...</div>
              ) : transactions.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="Nenhuma transação encontrada"
                  description="Não há pagamentos que correspondam aos filtros selecionados."
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Procedimentos</TableHead>
                          <TableHead>Meio de Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Atendimento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => {
                          const procs = tx.attendance?.procedures || [];
                          const displayDate = tx.dataPagamento || tx.attendance?.dataHora;

                          return (
                            <TableRow key={tx.id} className="hover:bg-muted/20">
                              <TableCell className="whitespace-nowrap text-xs font-medium">
                                {displayDate ? formatDate(new Date(displayDate)) : '—'}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{tx.attendance?.client?.nome || '—'}</div>
                              </TableCell>
                              <TableCell>
                                {procs.length === 0 ? (
                                  <span className="text-xs text-muted-foreground italic">Sem procedimentos</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {procs.map((p, idx) => (
                                      <Badge key={p.id || idx} variant="secondary" className="text-[10px] font-normal">
                                        {p.procedure?.nome ?? p.nome ?? 'Procedimento'}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-xs">
                                  {getMethodIcon(tx.metodo)}
                                  <span>{PAYMENT_METHOD_LABELS[tx.metodo] || tx.metodo}</span>
                                  {tx.numeroParcelas > 1 && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {tx.numeroParcelas}x
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={tx.status} />
                              </TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">
                                {formatCurrency(Number(tx.valor))}
                              </TableCell>
                              <TableCell className="text-right">
                                {tx.attendance?.id && (
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/atendimentos/${tx.attendance.id}`} className="text-xs gap-1">
                                      <span>Abrir</span>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground">
                        Página {page} de {totalPages} ({totalTx} registros)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Próxima
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CONTAS A RECEBER */}
        <TabsContent value="receber">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Contas a Receber</CardTitle>
                <CardDescription className="text-xs">
                  Cobranças de clientes, agendamentos ou atendimentos com suporte a baixa parcial e total.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenCreateObligation('RECEIVABLE')}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Conta a Receber
              </Button>
            </CardHeader>
            <CardContent>
              {loadingObligations ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Carregando contas a receber...</div>
              ) : receivablesList.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="Nenhuma conta a receber cadastrada"
                  description="Registre títulos a receber para acompanhar vencimentos e liquidações parciais ou totais."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Cliente / Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor Original</TableHead>
                        <TableHead className="text-right">Recebido</TableHead>
                        <TableHead className="text-right">Saldo Restante</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivablesList.map((ob) => (
                        <TableRow key={ob.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(new Date(ob.dataVencimento))}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{ob.descricao}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ob.clientName || ob.categoria || '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ob.status} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(ob.valorOriginal)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-success">
                            {formatCurrency(ob.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(ob.remainingBalance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {ob.remainingBalance > 0 && ob.status !== 'Cancelado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenSettle(ob)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-success" />
                                  Baixar
                                </Button>
                              )}
                              {ob.status !== 'Cancelado' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() => handleCancelObligation(ob)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CONTAS A PAGAR */}
        <TabsContent value="pagar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Contas a Pagar (Despesas da Clínica)</CardTitle>
                <CardDescription className="text-xs">
                  Controle de fornecedores, aluguel, insumos e obrigações operacionais.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenCreateObligation('PAYABLE')}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Conta a Pagar
              </Button>
            </CardHeader>
            <CardContent>
              {loadingObligations ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Carregando contas a pagar...</div>
              ) : payablesList.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Nenhuma conta a pagar registrada"
                  description="Cadastre despesas da clínica com fornecedor, categoria e data de vencimento."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fornecedor / Beneficiário</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor Original</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Em Aberto</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payablesList.map((ob) => (
                        <TableRow key={ob.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(new Date(ob.dataVencimento))}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{ob.descricao}</TableCell>
                          <TableCell className="text-xs">{ob.fornecedor || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{ob.categoria || 'Geral'}</TableCell>
                          <TableCell>
                            <StatusBadge status={ob.status} />
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(ob.valorOriginal)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {formatCurrency(ob.paidAmount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(ob.remainingBalance)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {ob.remainingBalance > 0 && ob.status !== 'Cancelado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenSettle(ob)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-success" />
                                  Pagar
                                </Button>
                              )}
                              {ob.status !== 'Cancelado' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive"
                                  onClick={() => handleCancelObligation(ob)}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: LIVRO CAIXA (FINANCIAL MOVEMENTS) */}
        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Livro Caixa (Entradas e Saídas Efetivas)</CardTitle>
                <CardDescription className="text-xs">
                  Movimentações financeiras ordenadas pela data efetiva de entrada ou saída de caixa.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowMovementDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Lançamento Manual
              </Button>
            </CardHeader>
            <CardContent>
              {loadingObligations ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Carregando livro caixa...</div>
              ) : movementsList.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nenhuma movimentação no livro caixa"
                  description="As baixas de títulos, pagamentos e lançamentos manuais aparecerão aqui."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Meio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementsList.map((mov) => (
                        <TableRow key={mov.id} className={mov.status === 'Estornado' ? 'opacity-60' : ''}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(new Date(mov.dataMovimentacao))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={mov.tipo === 'ENTRADA' ? 'default' : 'destructive'}
                              className="text-[10px]"
                            >
                              {mov.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{mov.origem}</TableCell>
                          <TableCell className="text-sm font-medium">{mov.descricao}</TableCell>
                          <TableCell className="text-xs">
                            {PAYMENT_METHOD_LABELS[mov.metodo] || mov.metodo}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={mov.status} />
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              mov.tipo === 'ENTRADA' ? 'text-success' : 'text-destructive'
                            }`}
                          >
                            {mov.tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(mov.valor)}
                          </TableCell>
                          <TableCell className="text-right">
                            {mov.status === 'Ativo' && mov.origem !== 'ESTORNO' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleReverseMovement(mov)}
                                title="Estornar movimentação"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Estornar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Create Obligation */}
      <Dialog open={showObligationDialog} onOpenChange={setShowObligationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {obligationDialogType === 'RECEIVABLE' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da obrigação financeira e a data de vencimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateObligation} className="space-y-4">
            {dialogError && (
              <div className="p-3 rounded bg-destructive/15 text-destructive text-xs">{dialogError}</div>
            )}
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input
                required
                value={obDescricao}
                onChange={(e) => setObDescricao(e.target.value)}
                placeholder={
                  obligationDialogType === 'PAYABLE'
                    ? 'Ex.: Compra de toxina botulínica / Aluguel'
                    : 'Ex.: Cobrança avulsa de pacote facial'
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input
                  value={obCategoria}
                  onChange={(e) => setObCategoria(e.target.value)}
                  placeholder="Ex.: Insumos, Aluguel"
                />
              </div>
              {obligationDialogType === 'PAYABLE' && (
                <div className="space-y-1.5">
                  <Label>Fornecedor / Beneficiário</Label>
                  <Input
                    value={obFornecedor}
                    onChange={(e) => setObFornecedor(e.target.value)}
                    placeholder="Ex.: Galderma Brasil"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={obValor}
                  onChange={(e) => setObValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  required
                  value={obVencimento}
                  onChange={(e) => setObVencimento(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meio Previsto</Label>
                <Select value={obMetodo} onValueChange={setObMetodo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">PIX</SelectItem>
                    <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                    <SelectItem value="CartaoDebito">Cartão de Débito</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferencia">Transferência / Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowObligationDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Settle Obligation */}
      <Dialog open={!!settleTarget} onOpenChange={(open) => !open && setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Liquidação (Baixa Parcial ou Total)</DialogTitle>
            <DialogDescription>
              {settleTarget?.descricao} — Saldo restante:{' '}
              {settleTarget ? formatCurrency(settleTarget.remainingBalance) : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmSettle} className="space-y-4">
            {dialogError && (
              <div className="p-3 rounded bg-destructive/15 text-destructive text-xs">{dialogError}</div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor da Baixa (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={settleTarget?.remainingBalance}
                  required
                  value={settleValor}
                  onChange={(e) => setSettleValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data da Liquidação *</Label>
                <Input
                  type="date"
                  required
                  value={settleData}
                  onChange={(e) => setSettleData(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meio de Pagamento *</Label>
                <Select value={settleMetodo} onValueChange={setSettleMetodo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">PIX</SelectItem>
                    <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                    <SelectItem value="CartaoDebito">Cartão de Débito</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettleTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Confirmando...' : 'Confirmar Liquidação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manual Movement */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançamento Manual de Caixa</DialogTitle>
            <DialogDescription>
              Registre uma entrada ou saída avulsa diretamente no fluxo de caixa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateManualMovement} className="space-y-4">
            {dialogError && (
              <div className="p-3 rounded bg-destructive/15 text-destructive text-xs">{dialogError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Movimento *</Label>
                <Select value={movTipo} onValueChange={(v) => setMovTipo(v as 'ENTRADA' | 'SAIDA')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">Entrada (Receita Avulsa)</SelectItem>
                    <SelectItem value="SAIDA">Saída (Despesa Imediata)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input
                  value={movCategoria}
                  onChange={(e) => setMovCategoria(e.target.value)}
                  placeholder="Ex.: Despesas Gerais, Suprimentos"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input
                required
                value={movDescricao}
                onChange={(e) => setMovDescricao(e.target.value)}
                placeholder="Ex.: Compra de descartáveis / Receita avulsa"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={movValor}
                  onChange={(e) => setMovValor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input
                  type="date"
                  required
                  value={movData}
                  onChange={(e) => setMovData(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Meio *</Label>
                <Select value={movMetodo} onValueChange={setMovMetodo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">PIX</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                    <SelectItem value="CartaoDebito">Cartão de Débito</SelectItem>
                    <SelectItem value="Transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowMovementDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Registrar no Caixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
