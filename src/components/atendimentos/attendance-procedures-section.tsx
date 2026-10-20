'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Trash2, Edit2, Sparkles, Tag, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface AttendanceProcedure {
  id: string;
  procedureId: string;
  practicedValue: number;
  standardValueSnapshot: number;
  procedure: {
    id: string;
    nome: string;
  };
}

interface ProcedureOption {
  id: string;
  nome: string;
  precoPadrao: number;
}

interface AttendanceProceduresSectionProps {
  attendanceId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
  procedures: AttendanceProcedure[];
  currentDiscount: number;
  onRefresh: () => Promise<void>;
}

export function AttendanceProceduresSection({
  attendanceId,
  status,
  procedures,
  currentDiscount,
  onRefresh,
}: AttendanceProceduresSectionProps) {
  const [catalog, setCatalog] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Procedure Modal
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [practicedValueInput, setPracticedValueInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Value Modal
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProcedureId, setEditingProcedureId] = useState<string | null>(null);
  const [editValueInput, setEditValueInput] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Discount Modal
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountInput, setDiscountInput] = useState(currentDiscount.toString());
  const [discountError, setDiscountError] = useState<string | null>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch('/api/procedures?active=true');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setCatalog(data.data);
          }
        }
      } catch (err) {
        console.error('Error fetching procedure catalog:', err);
      }
    };
    loadCatalog();
  }, []);

  const isEditable = status === 'Pendente';

  // Handle Catalog Selection in Add Modal
  const handleSelectCatalogItem = (procId: string) => {
    setSelectedCatalogId(procId);
    const item = catalog.find((p) => p.id === procId);
    if (item) {
      setPracticedValueInput(Number(item.precoPadrao || 0).toFixed(2));
    }
  };

  // Add Procedure
  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogId) {
      setAddError('Selecione um procedimento.');
      return;
    }
    const val = parseFloat(practicedValueInput);
    if (isNaN(val) || val < 0) {
      setAddError('Informe um valor praticado válido maior ou igual a zero.');
      return;
    }

    try {
      setLoading(true);
      setAddError(null);
      const res = await fetch(`/api/attendances/${attendanceId}/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureId: selectedCatalogId,
          practicedValue: val,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao adicionar procedimento.');
      }
      setShowAddDialog(false);
      setSelectedCatalogId('');
      setPracticedValueInput('');
      await onRefresh();
    } catch (err: any) {
      setAddError(err.message || 'Falha ao adicionar procedimento.');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill from planned procedures (D3)
  const handlePrefill = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/attendances/${attendanceId}/prefill`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar procedimentos planejados.');
      }
      await onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar procedimentos planejados.');
    } finally {
      setLoading(false);
    }
  };

  // Update practiced value
  const handleUpdateValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcedureId) return;
    const val = parseFloat(editValueInput);
    if (isNaN(val) || val < 0) {
      setEditError('Informe um valor praticado válido maior ou igual a zero.');
      return;
    }

    try {
      setLoading(true);
      setEditError(null);
      const res = await fetch(`/api/attendances/${attendanceId}/procedures/${editingProcedureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practicedValue: val }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar valor praticado.');
      }
      setShowEditDialog(false);
      setEditingProcedureId(null);
      await onRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Falha ao atualizar valor.');
    } finally {
      setLoading(false);
    }
  };

  // Remove Procedure
  const handleRemoveProcedure = async (procId: string) => {
    if (!confirm('Deseja remover este procedimento do atendimento?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/attendances/${attendanceId}/procedures/${procId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao remover procedimento.');
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover procedimento.');
    } finally {
      setLoading(false);
    }
  };

  // Set Explicit Discount (D2)
  const handleSetDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    const discountVal = parseFloat(discountInput);
    if (isNaN(discountVal) || discountVal < 0) {
      setDiscountError('O valor do desconto deve ser maior ou igual a zero.');
      return;
    }

    try {
      setLoading(true);
      setDiscountError(null);
      const res = await fetch(`/api/attendances/${attendanceId}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desconto: discountVal }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao aplicar desconto.');
      }
      setShowDiscountDialog(false);
      await onRefresh();
    } catch (err: any) {
      setDiscountError(err.message || 'Falha ao registrar desconto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-lg">Procedimentos Realizados</CardTitle>
          <CardDescription>
            Registro dos procedimentos executados nesta sessão clínica com valores praticados e desconto explícito.
          </CardDescription>
        </div>

        {isEditable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrefill} disabled={loading} className="gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Importar do Agendamento</span>
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)} disabled={loading} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Adicionar Procedimento</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDiscountInput(currentDiscount.toString());
                setShowDiscountDialog(true);
              }}
              disabled={loading}
              className="gap-1.5"
            >
              <Tag className="h-4 w-4 text-warning" />
              <span>Desconto</span>
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {procedures.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg border-dashed">
            Nenhum procedimento registrado ainda neste atendimento.
            {isEditable && (
              <p className="text-xs text-primary mt-1">
                Clique em &quot;Importar do Agendamento&quot; ou &quot;Adicionar Procedimento&quot;.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Valor Padrão</TableHead>
                  <TableHead className="text-right">Valor Praticado</TableHead>
                  {isEditable && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.procedure.nome}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(Number(p.standardValueSnapshot || 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(Number(p.practicedValue || 0))}
                    </TableCell>
                    {isEditable && (
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingProcedureId(p.id);
                              setEditValueInput(Number(p.practicedValue || 0).toFixed(2));
                              setShowEditDialog(true);
                            }}
                            title="Editar valor praticado"
                          >
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveProcedure(p.id)}
                            title="Remover procedimento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Modal: Add Procedure */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Procedimento</DialogTitle>
            <DialogDescription>
              Selecione o procedimento e informe o valor praticado para este atendimento.
            </DialogDescription>
          </DialogHeader>

          {addError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">{addError}</div>
          )}

          <form onSubmit={handleAddProcedure} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proc-select">Procedimento *</Label>
              <Select value={selectedCatalogId} onValueChange={handleSelectCatalogItem}>
                <SelectTrigger id="proc-select">
                  <SelectValue placeholder="Selecione um procedimento..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {catalog.map((proc) => (
                    <SelectItem key={proc.id} value={proc.id}>
                      {proc.nome} — {formatCurrency(Number(proc.precoPadrao || 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="practiced-val">Valor Praticado (R$) *</Label>
              <Input
                id="practiced-val"
                type="number"
                step="0.01"
                min="0"
                value={practicedValueInput}
                onChange={(e) => setPracticedValueInput(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Practiced Value */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Editar Valor Praticado</DialogTitle>
            <DialogDescription>Ajuste o valor praticado para este procedimento.</DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">{editError}</div>
          )}

          <form onSubmit={handleUpdateValue} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-val">Novo Valor Praticado (R$) *</Label>
              <Input
                id="edit-val"
                type="number"
                step="0.01"
                min="0"
                value={editValueInput}
                onChange={(e) => setEditValueInput(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Atualizar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Set Explicit Discount */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Desconto Explícito</DialogTitle>
            <DialogDescription>
              Informe o desconto explícito (D2) aplicado sobre o total praticado.
            </DialogDescription>
          </DialogHeader>

          {discountError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">
              {discountError}
            </div>
          )}

          <form onSubmit={handleSetDiscount} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="disc-val">Valor do Desconto (R$) *</Label>
              <Input
                id="disc-val"
                type="number"
                step="0.01"
                min="0"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDiscountDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Aplicar Desconto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
