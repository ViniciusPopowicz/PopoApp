'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AppCombobox } from '@/components/ui/app-combobox';
import { ListingToolbar } from '@/components/shared/listing-toolbar';
import { RowStatusToggle } from '@/components/shared/row-status-toggle';
import { useDebounce } from '@/hooks/use-debounce';
import { ProcedureFormDialog } from '@/components/procedimentos/procedure-form-dialog';
import { ProcedureProductsDialog } from '@/components/procedimentos/procedure-products-dialog';
import { ProcedureResponseDto } from '@/types/procedure';
import { formatCurrency } from '@/lib/format';
import { useAppDialogs } from '@/components/shared/app-dialogs';
import {
  Clock,
  Edit2,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';

const STATUS_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'ativos', label: 'Somente Ativos' },
  { value: 'inativos', label: 'Somente Inativos' },
];

export default function ProcedimentosPage() {
  const [procedures, setProcedures] = useState<ProcedureResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');

  // Dialogs state
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureResponseDto | null>(null);

  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [productsProcedure, setProductsProcedure] = useState<ProcedureResponseDto | null>(null);

  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm.trim()) {
        params.set('search', debouncedSearchTerm.trim());
      }
      if (statusFilter === 'ativos') {
        params.set('active', 'true');
      } else if (statusFilter === 'inativos') {
        params.set('active', 'false');
      }
      if (categoryFilter !== 'todas') {
        params.set('categoria', categoryFilter);
      }

      const res = await fetch(`/api/procedures?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Falha ao carregar catálogo de procedimentos');
      }
      setProcedures(payload.data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar procedimentos');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    procedures.forEach((p) => {
      if (p.categoria) cats.add(p.categoria);
    });
    return Array.from(cats).sort();
  }, [procedures]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas as Categorias' },
      ...categories.map((cat) => ({ value: cat, label: cat })),
    ],
    [categories]
  );

  const metrics = useMemo(() => {
    const total = procedures.length;
    const ativos = procedures.filter((p) => p.isActive).length;
    const avgValue =
      ativos > 0
        ? procedures
            .filter((p) => p.isActive)
            .reduce((acc, p) => acc + p.valorPadrao, 0) / ativos
        : 0;
    const avgDuration =
      ativos > 0
        ? Math.round(
            procedures
              .filter((p) => p.isActive)
              .reduce((acc, p) => acc + p.duracaoMinutos, 0) / ativos
          )
        : 0;

    return { total, ativos, avgValue, avgDuration };
  }, [procedures]);

  function handleOpenCreate() {
    setSelectedProcedure(null);
    setFormOpen(true);
  }

  function handleOpenEdit(proc: ProcedureResponseDto) {
    setSelectedProcedure(proc);
    setFormOpen(true);
  }

  function handleOpenProducts(proc: ProcedureResponseDto) {
    setProductsProcedure(proc);
    setProductsDialogOpen(true);
  }

  async function handleToggleActive(proc: ProcedureResponseDto, nextActive: boolean) {
    const res = await fetch(`/api/procedures/${proc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || 'Erro ao alterar status');
    }
    setProcedures((prev) =>
      prev.map((item) =>
        item.id === proc.id
          ? {
              ...item,
              isActive: nextActive,
              ativo: nextActive,
              status: nextActive ? 'ativo' : 'inativo',
            }
          : item
      )
    );
  }

  const { confirm, alert, DialogsNode } = useAppDialogs();

  async function handleDelete(proc: ProcedureResponseDto) {
    const confirmed = await confirm({
      title: 'Remover Procedimento',
      description: `Deseja remover o procedimento "${proc.nome}"?\n\nNota: Caso já possua histórico em agendamentos ou atendimentos, ele será apenas inativado para preservar os registros clínicos.`,
      confirmLabel: 'Confirmar Remoção',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/procedures/${proc.id}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Erro ao remover procedimento');
      }
      await fetchProcedures();
    } catch (err: any) {
      await alert({
        title: 'Erro ao Excluir Procedimento',
        description: err.message || 'Erro ao excluir procedimento',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Catálogo de Procedimentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie procedimentos estéticos, valores de tabela, duração de sessão e insumos vinculados.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Total Cadastrados</span>
              <Sparkles className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl">{metrics.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Procedimentos registrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Procedimentos Ativos</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              {metrics.ativos}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Disponíveis para novos agendamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Ticket Médio Base</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(metrics.avgValue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Média dos valores padrão ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Duração Média</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl">{metrics.avgDuration} min</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tempo médio estimado de sessão
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Standardized Listing Toolbar (Search on left, Filters + Create Button on right) */}
      <ListingToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar procedimento por nome, categoria ou descrição..."
        rightSlot={
          <>
            <div className="w-52">
              <AppCombobox
                options={categoryFilterOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
                placeholder="Categoria"
              />
            </div>
            <div className="w-44">
              <AppCombobox
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(val) =>
                  setStatusFilter(val as 'todos' | 'ativos' | 'inativos')
                }
                placeholder="Status"
              />
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Procedimento
            </Button>
          </>
        }
      />

      {/* Procedures Table */}
      <Card>
        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Carregando procedimentos...</span>
            </div>
          ) : procedures.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Sparkles className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-base font-medium">Nenhum procedimento encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Ajuste os filtros de busca ou cadastre um novo procedimento clínico no catálogo.
              </p>
              <Button variant="outline" className="mt-4 gap-2" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" />
                Cadastrar Procedimento
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Valor Padrão</TableHead>
                    <TableHead>Insumos Sugeridos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procedures.map((proc) => (
                    <TableRow
                      key={proc.id}
                      className={!proc.isActive ? 'opacity-65 bg-muted/20' : ''}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{proc.nome}</div>
                        {proc.descricao && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs mt-0.5">
                            {proc.descricao}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-normal gap-1">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {proc.categoria || 'Geral'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{proc.duracaoMinutos} min</span>
                        </div>
                      </TableCell>

                      <TableCell className="font-semibold text-foreground">
                        {formatCurrency(proc.valorPadrao)}
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1.5"
                          onClick={() => handleOpenProducts(proc)}
                        >
                          <Package className="h-3.5 w-3.5 text-primary" />
                          <span>{proc.products?.length ?? 0} produto(s)</span>
                        </Button>
                      </TableCell>

                      <TableCell>
                        <RowStatusToggle
                          isActive={proc.isActive}
                          onToggle={(nextActive) =>
                            handleToggleActive(proc, nextActive)
                          }
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Vincular Produtos"
                            onClick={() => handleOpenProducts(proc)}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar Procedimento"
                            onClick={() => handleOpenEdit(proc)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir / Inativar"
                            onClick={() => handleDelete(proc)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Dialogs */}
      <ProcedureFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        procedure={selectedProcedure}
        onSuccess={fetchProcedures}
      />

      <ProcedureProductsDialog
        open={productsDialogOpen}
        onOpenChange={setProductsDialogOpen}
        procedure={productsProcedure}
        onSuccess={fetchProcedures}
      />
      {DialogsNode}
    </div>
  );
}
