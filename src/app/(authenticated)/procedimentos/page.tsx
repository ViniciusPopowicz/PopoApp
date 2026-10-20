'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Activity, Clock, Pencil, Power, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ProcedureFormDialog, ProcedureFormData } from '@/components/procedimentos/procedure-form-dialog';

interface ProcedureItem {
  id: string;
  nome: string;
  categoria: string;
  valorPadrao: number;
  duracaoMinutos: number;
  descricao: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProcedimentosPage() {
  const [procedures, setProcedures] = useState<ProcedureItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<'all' | 'true' | 'false'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedProcedureForEdit, setSelectedProcedureForEdit] = useState<ProcedureFormData | null>(null);

  const fetchProcedures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (selectedCategory !== 'Todas') {
        params.set('categoria', selectedCategory);
      }
      if (statusFilter !== 'all') {
        params.set('active', statusFilter);
      }

      const res = await fetch(`/api/procedures?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao buscar catálogo de procedimentos');
      }

      setProcedures(json.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar procedimentos:', err);
      setError(err.message || 'Erro ao carregar procedimentos do servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProcedures();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchProcedures]);

  // Extract distinct categories
  const categories = ['Todas', ...Array.from(new Set(procedures.map((p) => p.categoria).filter(Boolean)))];

  async function handleToggleActive(proc: ProcedureItem) {
    const nextState = !proc.isActive;
    const confirmMsg = nextState
      ? `Deseja ativar o procedimento "${proc.nome}" no catálogo?`
      : `Deseja inativar o procedimento "${proc.nome}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/procedures/${proc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao alterar status');
      }

      fetchProcedures();
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar status do procedimento.');
    }
  }

  function handleOpenCreate() {
    setSelectedProcedureForEdit(null);
    setIsFormDialogOpen(true);
  }

  function handleOpenEdit(proc: ProcedureItem) {
    setSelectedProcedureForEdit({
      id: proc.id,
      nome: proc.nome,
      categoria: proc.categoria,
      valorPadrao: proc.valorPadrao,
      duracaoMinutos: proc.duracaoMinutos,
      descricao: proc.descricao,
      isActive: proc.isActive,
    });
    setIsFormDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procedimentos"
        description="Catálogo de tratamentos estéticos, parametrização de valores padrão e duração estimada."
      >
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Procedimento
        </Button>
      </PageHeader>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="w-full sm:max-w-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar procedimento por nome ou descrição..."
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 border rounded-md p-1 bg-card">
            <Button
              type="button"
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'true' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setStatusFilter('true')}
            >
              Ativos
            </Button>
            <Button
              type="button"
              variant={statusFilter === 'false' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setStatusFilter('false')}
            >
              Inativos
            </Button>
          </div>
        </div>
      </div>

      {/* Category badges filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground mr-1">Categoria:</span>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Carregando catálogo de procedimentos...</span>
        </div>
      ) : procedures.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhum procedimento encontrado"
          description={
            searchTerm || selectedCategory !== 'Todas'
              ? 'Nenhum procedimento corresponde aos filtros aplicados.'
              : 'Nenhum procedimento cadastrado no catálogo.'
          }
          actionLabel="Cadastrar Procedimento"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {procedures.map((proc) => (
            <Card key={proc.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">
                    {proc.nome}
                  </CardTitle>
                  <StatusBadge status={proc.isActive ? 'ativo' : 'inativo'} />
                </div>
                <CardDescription className="line-clamp-2 mt-1 min-h-[40px] text-xs">
                  {proc.descricao}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {proc.categoria}
                  </Badge>
                </div>

                <div className="flex justify-between items-center text-sm border-t pt-3">
                  <div className="flex items-center text-muted-foreground text-xs">
                    <Clock className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    <span>{proc.duracaoMinutos} min</span>
                  </div>
                  <div className="font-bold text-lg text-primary">
                    {formatCurrency(Number(proc.valorPadrao))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => handleOpenEdit(proc)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${
                      proc.isActive
                        ? 'text-muted-foreground hover:text-destructive'
                        : 'text-primary hover:text-primary'
                    }`}
                    onClick={() => handleToggleActive(proc)}
                    title={proc.isActive ? 'Inativar Procedimento' : 'Reativar Procedimento'}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Procedure Dialog */}
      <ProcedureFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        procedure={selectedProcedureForEdit}
        onSuccess={fetchProcedures}
      />
    </div>
  );
}
