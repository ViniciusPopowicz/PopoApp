'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Boxes, QrCode, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

interface StockUnitItem {
  id: string;
  codigoSerial: string;
  status: string;
  lot?: {
    numeroLote: string;
    product: {
      id: string;
      nome: string;
      isReusable: boolean;
      unidade: string;
    };
  };
}

interface ProductUsageItem {
  id: string;
  stockUnitId: string;
  dataHora: string;
  observacoes?: string | null;
  stockUnit: {
    codigoSerial: string;
    lot: {
      numeroLote: string;
      product: {
        nome: string;
        isReusable: boolean;
        unidade: string;
      };
    };
  };
  attendanceProcedure?: {
    procedure: {
      nome: string;
    };
  } | null;
}

interface AttendanceProductUsagesSectionProps {
  attendanceId: string;
  clientId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
  procedures: Array<{ id: string; procedure: { nome: string } }>;
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
  const [availableUnits, setAvailableUnits] = useState<StockUnitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Record usage dialog
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAttendanceProcId, setSelectedAttendanceProcId] = useState<string>('none');
  const [usageNotes, setUsageNotes] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);

  const isEditable = status === 'Pendente';

  // Load existing usages
  const loadUsages = async () => {
    try {
      const res = await fetch(`/api/attendances/${attendanceId}/usages`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          // Map to uniform shape
          const mapped: ProductUsageItem[] = json.data.map((u: any) => ({
            id: u.id,
            stockUnitId: u.stockUnitId,
            dataHora: u.dataHora,
            observacoes: u.observacoes,
            stockUnit: {
              codigoSerial: u.codigoSerial,
              lot: {
                numeroLote: '',
                product: {
                  nome: u.productName,
                  isReusable: u.isReusable,
                  unidade: '',
                },
              },
            },
            attendanceProcedure: u.procedureName
              ? { procedure: { nome: u.procedureName } }
              : null,
          }));
          setUsages(mapped);
        }
      }
    } catch (err) {
      console.error('Error loading usages:', err);
    }
  };

  // Load available stock units for this client
  const loadAvailableUnits = async () => {
    try {
      const res = await fetch(`/api/stock/units?clientId=${clientId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAvailableUnits(json.data);
        }
      }
    } catch (err) {
      console.error('Error loading available units:', err);
    }
  };

  useEffect(() => {
    loadUsages();
    if (isEditable) {
      loadAvailableUnits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceId, clientId, isEditable]);

  // Record usage handler
  const handleRecordUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setRecordError('Selecione uma unidade de estoque para registrar o uso.');
      return;
    }

    try {
      setLoading(true);
      setRecordError(null);

      const payload = {
        stockUnitId: selectedUnitId,
        attendanceProcedureId: selectedAttendanceProcId !== 'none' ? selectedAttendanceProcId : null,
        observacoes: usageNotes.trim() || null,
      };

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
      setSelectedUnitId('');
      setSelectedAttendanceProcId('none');
      setUsageNotes('');
      await Promise.all([loadUsages(), loadAvailableUnits(), onRefresh()]);
    } catch (err: any) {
      setRecordError(err.message || 'Falha ao registrar uso do produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Uso e Rastreabilidade de Produtos
          </CardTitle>
          <CardDescription>
            Controle de unidades físicas individuais utilizadas, rastreabilidade por lote/código serial e regras de reutilização.
          </CardDescription>
        </div>

        {isEditable && (
          <Button size="sm" onClick={() => setShowRecordDialog(true)} disabled={loading} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Registrar Uso de Unidade</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {usages.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg border-dashed">
            Nenhum produto ou unidade física registrada neste atendimento.
            {isEditable && (
              <p className="text-xs text-primary mt-1">
                Clique em &quot;Registrar Uso de Unidade&quot; para dar baixa e rastrear insumos.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código / Serial</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo de Uso</TableHead>
                  <TableHead>Procedimento Vinculado</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usages.map((u) => {
                  const isReusable = u.stockUnit.lot?.product?.isReusable;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.stockUnit.codigoSerial}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.stockUnit.lot?.product?.nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isReusable ? 'secondary' : 'outline'} className="text-xs">
                          {isReusable ? 'Reutilizável (Mesmo Cliente)' : 'Descartável'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.attendanceProcedure?.procedure?.nome || '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(new Date(u.dataHora))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {u.observacoes || '—'}
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
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Registrar Uso de Unidade Física</DialogTitle>
            <DialogDescription>
              Selecione a unidade rastreável em estoque. Unidades reutilizáveis são restritas ao mesmo cliente.
            </DialogDescription>
          </DialogHeader>

          {recordError && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-md text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{recordError}</span>
            </div>
          )}

          <form onSubmit={handleRecordUsage} className="space-y-4">
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
                      const prodName = unit.lot?.product?.nome || 'Produto';
                      const isReusable = unit.lot?.product?.isReusable;
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
              <Button type="submit" disabled={loading || !selectedUnitId}>
                {loading ? 'Registrando...' : 'Confirmar Uso'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
