'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DollarSign,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  Clock,
  Plus,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { StatusBadge } from '@/components/shared/status-badge';

interface PixInstallment {
  id: string;
  numeroParcela: number;
  totalParcelas: number;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string | null;
  status: string;
}

interface PaymentItem {
  id: string;
  valor: number;
  metodo: string;
  status: string;
  numeroParcelas: number;
  dataPagamento?: string | null;
  createdAt: string;
  identificadorTransacao?: string | null;
  observacoes?: string | null;
  pixInstallments?: PixInstallment[];
}

interface AttendanceFinancials {
  standardTotal: number;
  practicedTotal: number;
  explicitDiscount: number;
  netTotal: number;
  paidTotal: number;
  outstandingBalance: number;
  isFullyPaid: boolean;
}

interface AttendanceFinancialSectionProps {
  attendanceId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
  financials: AttendanceFinancials;
  payments: PaymentItem[];
  onRefresh: () => Promise<void>;
}

export function AttendanceFinancialSection({
  attendanceId,
  status,
  financials,
  payments,
  onRefresh,
}: AttendanceFinancialSectionProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTab, setPaymentTab] = useState<'direto' | 'pix-parcelado'>('direto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form direct payment
  const [metodo, setMetodo] = useState<'Dinheiro' | 'CartaoDebito' | 'CartaoCredito' | 'Pix' | 'Transferencia' | 'Outro'>('Pix');
  const [valorDirect, setValorDirect] = useState(
    financials.outstandingBalance > 0 ? financials.outstandingBalance.toFixed(2) : '0.00'
  );
  const [numeroParcelasCard, setNumeroParcelasCard] = useState('1');
  const [identificadorTransacao, setIdentificadorTransacao] = useState('');
  const [observacoesDirect, setObservacoesDirect] = useState('');

  // Form PIX schedule
  const [valorTotalPix, setValorTotalPix] = useState(
    financials.outstandingBalance > 0 ? financials.outstandingBalance.toFixed(2) : '0.00'
  );
  const [numeroParcelasPix, setNumeroParcelasPix] = useState('2');
  const [primeiroVencimento, setPrimeiroVencimento] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [intervaloDias, setIntervaloDias] = useState('30');
  const [observacoesPix, setObservacoesPix] = useState('');

  const isEditable = status !== 'Cancelado';

  const openPaymentDialog = () => {
    const bal = financials.outstandingBalance > 0 ? financials.outstandingBalance.toFixed(2) : '0.00';
    setValorDirect(bal);
    setValorTotalPix(bal);
    setError(null);
    setShowPaymentModal(true);
  };

  // Submit direct payment
  const handleRecordDirectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valorDirect);
    if (isNaN(val) || val <= 0) {
      setError('O valor do pagamento deve ser maior que zero.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        valor: val,
        metodo,
        numeroParcelas: metodo === 'CartaoCredito' ? parseInt(numeroParcelasCard, 10) || 1 : 1,
        identificadorTransacao: identificadorTransacao.trim() || null,
        observacoes: observacoesDirect.trim() || null,
      };

      const res = await fetch(`/api/attendances/${attendanceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar pagamento.');
      }

      setShowPaymentModal(false);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Falha ao processar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  // Submit PIX schedule
  const handleRecordPixSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalVal = parseFloat(valorTotalPix);
    if (isNaN(totalVal) || totalVal <= 0) {
      setError('O valor total do parcelamento deve ser maior que zero.');
      return;
    }
    const parcels = parseInt(numeroParcelasPix, 10);
    if (isNaN(parcels) || parcels < 1 || parcels > 24) {
      setError('O número de parcelas deve ser entre 1 e 24.');
      return;
    }
    if (!primeiroVencimento) {
      setError('Informe a data do primeiro vencimento.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        valorTotal: totalVal,
        numeroParcelas: parcels,
        primeiroVencimento: new Date(primeiroVencimento).toISOString(),
        intervaloDias: parseInt(intervaloDias, 10) || 30,
        observacoes: observacoesPix.trim() || null,
      };

      const res = await fetch(`/api/attendances/${attendanceId}/payments/pix-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao gerar parcelamento PIX.');
      }

      setShowPaymentModal(false);
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Falha ao gerar parcelamento PIX.');
    } finally {
      setLoading(false);
    }
  };

  // Pay individual PIX installment
  const handlePayInstallment = async (installmentId: string) => {
    if (!confirm('Deseja dar baixa manual no pagamento desta parcela PIX?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/pix-installments/${installmentId}/pay`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao baixar parcela PIX.');
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar baixa da parcela PIX.');
    } finally {
      setLoading(false);
    }
  };

  const getMethodLabel = (m: string) => {
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

  return (
    <div className="space-y-6">
      {/* Financial Breakdown Card (D2) */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resumo Financeiro (D2)
            </CardTitle>
            <CardDescription>
              Cálculo dinâmico baseado nos procedimentos executados, desconto explícito e pagamentos confirmados.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {financials.netTotal > 0 && financials.isFullyPaid ? (
              <Badge variant="default" className="bg-success text-success-foreground">
                Quitado
              </Badge>
            ) : financials.netTotal === 0 ? (
              <Badge variant="outline">Sem Cobrança</Badge>
            ) : (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                Saldo Devedor: {formatCurrency(financials.outstandingBalance)}
              </Badge>
            )}

            {isEditable && (
              <Button size="sm" onClick={openPaymentDialog} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Registrar Pagamento</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-muted/20 border rounded-lg text-center">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Total Padrão</span>
              <p className="font-semibold text-sm sm:text-base text-muted-foreground line-through">
                {formatCurrency(financials.standardTotal)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Total Praticado</span>
              <p className="font-semibold text-sm sm:text-base">{formatCurrency(financials.practicedTotal)}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Desconto Explícito</span>
              <p className="font-semibold text-sm sm:text-base text-warning">
                {financials.explicitDiscount > 0 ? `- ${formatCurrency(financials.explicitDiscount)}` : 'R$ 0,00'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Total Líquido</span>
              <p className="font-bold text-base sm:text-lg text-primary">{formatCurrency(financials.netTotal)}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Total Pago</span>
              <p className="font-semibold text-sm sm:text-base text-success">{formatCurrency(financials.paidTotal)}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Saldo a Pagar</span>
              <p
                className={`font-bold text-base sm:text-lg ${
                  financials.outstandingBalance > 0 ? 'text-destructive' : 'text-success'
                }`}
              >
                {formatCurrency(financials.outstandingBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Pagamentos Registrados
          </CardTitle>
          <CardDescription>Histórico de transações vinculadas a este atendimento.</CardDescription>
        </CardHeader>

        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">
              Nenhum pagamento registrado até o momento.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Método</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Identificador / Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((pay) => (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium">{getMethodLabel(pay.metodo)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(pay.valor))}</TableCell>
                        <TableCell>
                          {pay.metodo === 'CartaoCredito' && pay.numeroParcelas > 1
                            ? `${pay.numeroParcelas}x no Cartão`
                            : pay.pixInstallments && pay.pixInstallments.length > 0
                            ? `${pay.pixInstallments.length}x no PIX`
                            : 'À vista (1x)'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(new Date(pay.dataPagamento || pay.createdAt))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={pay.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {pay.identificadorTransacao || pay.observacoes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* PIX Installment Schedules */}
              {payments
                .filter((p) => p.pixInstallments && p.pixInstallments.length > 0)
                .map((pay) => (
                  <div key={`pix-sched-${pay.id}`} className="border rounded-lg p-3 bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold">Cronograma de Parcelas PIX</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Total Parcelado: {formatCurrency(Number(pay.valor))}
                      </span>
                    </div>

                    <div className="rounded border bg-card overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="py-2">Parcela</TableHead>
                            <TableHead className="py-2">Vencimento</TableHead>
                            <TableHead className="py-2 text-right">Valor</TableHead>
                            <TableHead className="py-2">Status</TableHead>
                            <TableHead className="py-2 text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {pay.pixInstallments!.map((inst) => (
                            <TableRow key={inst.id}>
                              <TableCell className="font-medium">
                                Parcela {inst.numeroParcela} de {inst.totalParcelas}
                              </TableCell>
                              <TableCell>{formatDate(new Date(inst.dataVencimento))}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(Number(inst.valor))}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={inst.status} />
                              </TableCell>
                              <TableCell className="text-right">
                                {inst.status !== 'Pago' && isEditable && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                                    onClick={() => handlePayInstallment(inst.id)}
                                    disabled={loading}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Baixar Pagamento
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Record Payment */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Selecione o método de quitação: à vista, cartão parcelado ou cronograma de parcelas PIX.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="direto">À Vista / Cartão</TabsTrigger>
              <TabsTrigger value="pix-parcelado">Parcelamento PIX</TabsTrigger>
            </TabsList>

            {/* Tab: Direct / Card */}
            <TabsContent value="direto">
              <form onSubmit={handleRecordDirectPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="metodo-select">Método de Pagamento *</Label>
                  <Select value={metodo} onValueChange={(v) => setMetodo(v as any)}>
                    <SelectTrigger id="metodo-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">PIX à Vista</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="CartaoDebito">Cartão de Débito</SelectItem>
                      <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Transferencia">Transferência Bancária</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="valor-direct">Valor (R$) *</Label>
                  <Input
                    id="valor-direct"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorDirect}
                    onChange={(e) => setValorDirect(e.target.value)}
                    required
                  />
                </div>

                {metodo === 'CartaoCredito' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="num-parcelas">Número de Parcelas no Cartão</Label>
                    <Select value={numeroParcelasCard} onValueChange={setNumeroParcelasCard}>
                      <SelectTrigger id="num-parcelas">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x de{' '}
                            {formatCurrency(
                              (parseFloat(valorDirect) || 0) / n
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="identificador">Identificador / NSU / Comprovante (Opcional)</Label>
                  <Input
                    id="identificador"
                    placeholder="Ex.: NSU 129384 / PIX E2E..."
                    value={identificadorTransacao}
                    onChange={(e) => setIdentificadorTransacao(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="obs-direct">Observações (Opcional)</Label>
                  <Input
                    id="obs-direct"
                    placeholder="Ex.: Pago na recepção"
                    value={observacoesDirect}
                    onChange={(e) => setObservacoesDirect(e.target.value)}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Processando...' : 'Confirmar Pagamento'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* Tab: PIX Installment Schedule */}
            <TabsContent value="pix-parcelado">
              <form onSubmit={handleRecordPixSchedule} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pix-total">Valor Total a Parcelar (R$) *</Label>
                  <Input
                    id="pix-total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valorTotalPix}
                    onChange={(e) => setValorTotalPix(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pix-parcelas">Número de Parcelas *</Label>
                    <Select value={numeroParcelasPix} onValueChange={setNumeroParcelasPix}>
                      <SelectTrigger id="pix-parcelas">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x parcelas
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pix-intervalo">Intervalo (Dias) *</Label>
                    <Input
                      id="pix-intervalo"
                      type="number"
                      min="1"
                      max="90"
                      value={intervaloDias}
                      onChange={(e) => setIntervaloDias(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pix-primeiro-venc">Primeiro Vencimento *</Label>
                  <Input
                    id="pix-primeiro-venc"
                    type="date"
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pix-obs">Observações do Parcelamento</Label>
                  <Input
                    id="pix-obs"
                    placeholder="Ex.: Acordo de parcelamento em 2x PIX"
                    value={observacoesPix}
                    onChange={(e) => setObservacoesPix(e.target.value)}
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Gerando...' : 'Gerar Cronograma PIX'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
