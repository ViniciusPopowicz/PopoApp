'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Boxes,
  Plus,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Info,
  RotateCcw,
} from 'lucide-react';
import { formatDateTime } from '@/lib/format';

interface ProductUsageItem {
  id: string;
  stockUnitId: string | null;
  codigoSerial?: string | null;
  productId?: string | null;
  lotId?: string | null;
  numeroLote?: string | null;
  productName?: string;
  isReusable?: boolean;
  quantidade?: number;
  unidade?: string | null;
  status?: string;
  dataHora: string;
  observacoes?: string | null;
  attendanceProcedureId?: string | null;
  procedureName?: string | null;
  stockUnit?: {
    id: string;
    codigoSerial: string;
    status: string;
    lot: {
      id: string;
      numeroLote: string;
      dataValidade?: string | null;
      product: {
        id: string;
        nome: string;
        isReusable: boolean;
      };
    };
  } | null;
  attendanceProcedure?: {
    id: string;
    procedure: {
      id: string;
      nome: string;
    };
  } | null;
}

interface AvailableUnitOption {
  id: string;
  codigoSerial: string;
  status: string;
  currentClientId?: string | null;
  productName?: string;
  isReusable?: boolean;
  numeroLote?: string;
  unidade?: string;
  quantidadeDisponivel?: number;
  lot?: {
    id: string;
    numeroLote: string;
    dataValidade?: string | null;
    product: {
      id: string;
      nome: string;
      isReusable: boolean;
    };
  };
}

interface AttendanceProductUsagesSectionProps {
  attendanceId: string;
  clientId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
  procedures: Array<{
    id: string;
    procedureId: string;
    procedure: {
      id: string;
      nome: string;
    };
  }>;
  onRefresh: () => Promise<void>;
}

export function AttendanceProductUsagesSection({
  attendanceId,
  clientId,
  status,
  procedures,
  onRefresh,
}: AttendanceProductUsagesSectionProps) {
  const [usages, setUsages] = useState<ProductUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [mode, setMode] = useState<'UNIT' | 'QUANTITY'>('UNIT');
  const [availableUnits, setAvailableUnits] = useState<AvailableUnitOption[]>([]);
  const [quantityProducts, setQuantityProducts] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [consumeQuantity, setConsumeQuantity] = useState<string>('1');
  const [selectedAttendanceProcId, setSelectedAttendanceProcId] = useState<string>('none');
  const [usageNotes, setUsageNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const isCanceled = status === 'Cancelado';

  const fetchUsages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/attendances/${attendanceId}/usages`);
      if (!res.ok) {
        throw new Error('Falha ao carregar usos de produtos do atendimento.');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setUsages(json.data);
      }
    } catch (err: any) {
      console.error('Error fetching product usages:', err);
      setError(err.message || 'Erro ao carregar produtos utilizados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceId]);

  const loadAvailableOptions = async () => {
    try {
      const [unitsRes, prodsRes] = await Promise.all([
        fetch(`/api/stock/units?availableForClientId=${clientId}&clientId=${clientId}`),
        fetch(`/api/products?active=true`),
      ]);
      if (unitsRes.ok) {
        const json = await unitsRes.json();
        if (json.success && json.data) {
          setAvailableUnits(json.data);
        }
      }
      if (prodsRes.ok) {
        const json = await prodsRes.json();
        if (json.success && json.data) {
          setQuantityProducts(
            json.data.filter((p: any) => p.trackingMode === 'QUANTITY' && p.totalQuantityAvailable > 0)
          );
        }
      }
    } catch (err) {
      console.error('Error loading available stock options:', err);
    }
  };

  const handleOpenRecordDialog = async () => {
    setRecordError(null);
    setSelectedUnitId('');
    setSelectedProductId('');
    setConsumeQuantity('1');
    setSelectedAttendanceProcId('none');
    setUsageNotes('');
    setShowRecordDialog(true);
    await loadAvailableOptions();
  };

  const handleRecordUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordError(null);

    if (mode === 'UNIT' && !selectedUnitId) {
      setRecordError('Selecione uma unidade física de estoque disponível.');
      return;
    }
    if (mode === 'QUANTITY' && (!selectedProductId || Number(consumeQuantity) <= 0)) {
      setRecordError('Selecione o produto consumível e informe uma quantidade maior que zero.');
      return;
    }

    try {
      setActionLoading(true);
      const payload: Record<string, any> = {
        attendanceProcedureId: selectedAttendanceProcId !== 'none' ? selectedAttendanceProcId : null,
        observacoes: usageNotes.trim() ? usageNotes.trim() : null,
      };

      if (mode === 'UNIT') {
        payload.stockUnitId = selectedUnitId;
      } else {
        payload.productId = selectedProductId;
        payload.quantidade = Number(consumeQuantity);
      }

      const res = await fetch(`/api/attendances/${attendanceId}/usages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar uso de produto.');
      }

      setShowRecordDialog(false);
      await fetchUsages();
      await onRefresh();
    } catch (err: any) {
      setRecordError(err.message || 'Erro ao registrar uso do produto.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverseUsage = async (usageId: string) => {
    const motivo = prompt('Informe o motivo do estorno deste consumo de estoque:', 'Correção de lançamento');
    if (!motivo) return;
    try {
      const res = await fetch(`/api/attendances/${attendanceId}/usages/${usageId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Erro ao estornar consumo');
        return;
      }
      await fetchUsages();
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao estornar consumo');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <span>Rastreabilidade de Produtos & Insumos</span>
          </CardTitle>
          <CardDescription>
            Registro de unidades físicas (código serial) e consumo parcial/fracionado de insumos com controle de lote e saldo.
          </CardDescription>
        </div>

        {!isCanceled && (
          <Button size="sm" onClick={handleOpenRecordDialog}>
            <Plus className="h-4 w-4 mr-1.5" />
            Registrar Consumo de Produto
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/15 text-destructive rounded-md text-xs">{error}</div>
        )}

        <div className="p-3 rounded-md bg-muted/30 border border-muted text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <strong>Regras de Estoque (V15-V18 & Consumo Parcial):</strong> Lotes vencidos são bloqueados. Unidades reutilizáveis ficam vinculadas ao mesmo cliente, e produtos controlados por quantidade permitem baixa parcial/fracionada até o esgotamento do lote.
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Carregando histórico de produtos utilizados...
          </div>
        ) : usages.length === 0 ? (
          <div className="py-8 text-center border rounded-md border-dashed text-muted-foreground text-sm">
            Nenhum produto ou insumo registrado neste atendimento.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação (Serial / Lote)</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Tipo / Status</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usages.map((u) => {
                  const isReusable = u.isReusable ?? u.stockUnit?.lot?.product?.isReusable;
                  const serialOrLot =
                    u.codigoSerial ?? u.stockUnit?.codigoSerial ?? (u.numeroLote ? `Lote: ${u.numeroLote}` : 'Consumo Parcial');
                  const prodName = u.productName ?? u.stockUnit?.lot?.product?.nome ?? 'Produto';
                  const procName = u.procedureName ?? u.attendanceProcedure?.procedure?.nome ?? '—';
                  const isReversed = u.status === 'Estornado';

                  return (
                    <TableRow key={u.id} className={isReversed ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                          {serialOrLot}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{prodName}</TableCell>
                      <TableCell className="text-xs font-semibold">
                        {u.quantidade ?? 1} {u.unidade || 'un'}
                      </TableCell>
                      <TableCell>
                        {isReversed ? (
                          <Badge variant="destructive" className="text-xs">
                            Estornado
                          </Badge>
                        ) : (
                          <Badge variant={isReusable ? 'secondary' : 'outline'} className="text-xs">
                            {isReusable ? 'Reutilizável (Mesmo Cliente)' : u.stockUnitId ? 'Unidade' : 'Parcial'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{procName}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(new Date(u.dataHora))}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isReversed && !isCanceled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleReverseUsage(u.id)}
                            title="Estornar consumo e devolver ao estoque"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Estornar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Modal: Record Product Usage */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar Consumo de Produto</DialogTitle>
            <DialogDescription>
              Escolha entre consumir uma unidade física rastreada por serial ou lançar consumo parcial por quantidade.
            </DialogDescription>
          </DialogHeader>

          {recordError && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-md text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{recordError}</span>
            </div>
          )}

          <form onSubmit={handleRecordUsage} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === 'UNIT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('UNIT')}
              >
                Unidade Física (Serial)
              </Button>
              <Button
                type="button"
                variant={mode === 'QUANTITY' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('QUANTITY')}
              >
                Consumo Parcial (Qtd)
              </Button>
            </div>

            {mode === 'UNIT' ? (
              <div className="space-y-1.5">
                <Label htmlFor="unit-select">Unidade de Estoque Disponível *</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger id="unit-select">
                    <SelectValue placeholder="Selecione por código serial..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {availableUnits.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        Nenhuma unidade disponível em estoque para este cliente.
                      </div>
                    ) : (
                      availableUnits.map((unit) => {
                        const prodName = unit.productName || unit.lot?.product?.nome || 'Produto';
                        const isReusable = unit.isReusable ?? unit.lot?.product?.isReusable;
                        return (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.codigoSerial} — {prodName} {isReusable ? '(Reutilizável)' : ''}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Produto Consumível *</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {quantityProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} (Saldo: {p.totalQuantityAvailable} {p.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={consumeQuantity}
                    onChange={(e) => setConsumeQuantity(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="proc-assoc-select">Procedimento Vinculado (Opcional)</Label>
              <Select
                value={selectedAttendanceProcId}
                onValueChange={setSelectedAttendanceProcId}
              >
                <SelectTrigger id="proc-assoc-select">
                  <SelectValue placeholder="Vincular a um procedimento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Uso geral na sessão)</SelectItem>
                  {procedures.map((proc) => (
                    <SelectItem key={proc.id} value={proc.id}>
                      {proc.procedure.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usage-notes">Observações</Label>
              <Textarea
                id="usage-notes"
                rows={2}
                placeholder="Ex.: Aplicação na região malar direita..."
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRecordDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actionLoading}>
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                {actionLoading ? 'Validando...' : 'Confirmar Consumo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
