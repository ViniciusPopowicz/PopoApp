'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  QrCode,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

interface ReminderItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  status: 'pendente' | 'concluido' | 'dispensado';
  prioridade: 'baixa' | 'media' | 'alta';
  dataVencimento: string;
  isOverdue?: boolean;
  completedAt?: string | null;
  client?: {
    id: string;
    nome: string;
    telefone?: string | null;
  } | null;
  pixInstallment?: {
    id: string;
    numeroParcela: number;
    totalParcelas: number;
    valor: number;
    status: string;
  } | null;
}

interface ReminderStats {
  total: number;
  pending: number;
  overdue: number;
  completed: number;
  dismissed: number;
}

interface ClientOption {
  id: string;
  nome: string;
}

export default function LembretesPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusTab, setStatusTab] = useState<'pendente' | 'atrasado' | 'concluido' | 'dispensado' | 'todos'>('pendente');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');

  // New Reminder Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newTipo, setNewTipo] = useState('retorno');
  const [newPrioridade, setNewPrioridade] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newDataVencimento, setNewDataVencimento] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [newClientId, setNewClientId] = useState<string>('none');
  const [newError, setNewError] = useState<string | null>(null);

  // Fetch Clients
  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await fetch('/api/clients?limit=100&active=true');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.items) {
            setClients(json.items);
          }
        }
      } catch (err) {
        console.error('Error fetching clients for reminders:', err);
      }
    };
    loadClients();
  }, []);

  // Fetch Reminders
  const loadReminders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusTab === 'atrasado') {
        params.set('status', 'pendente');
        params.set('overdueOnly', 'true');
      } else if (statusTab !== 'todos') {
        params.set('status', statusTab);
      }

      if (priorityFilter !== 'todas') {
        params.set('prioridade', priorityFilter);
      }

      params.set('limit', '100');

      const res = await fetch(`/api/reminders?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar lembretes.');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setReminders(json.data);
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        throw new Error(json.error || 'Erro ao carregar lembretes.');
      }
    } catch (err: any) {
      console.error('Error loading reminders:', err);
      setError(err.message || 'Erro ao consultar lembretes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab, priorityFilter]);

  // Status Action (Concluir / Dispensar) - V23 / AC 68 (preserves payment truth)
  const handleUpdateStatus = async (reminderId: string, newStatus: 'concluido' | 'dispensado') => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/reminders/${reminderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar status do lembrete.');
      }
      await loadReminders();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar lembrete.');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Reminder
  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitulo.trim()) {
      setNewError('O título do lembrete é obrigatório.');
      return;
    }
    if (!newDataVencimento) {
      setNewError('A data de vencimento é obrigatória.');
      return;
    }

    try {
      setActionLoading(true);
      setNewError(null);

      const payload = {
        titulo: newTitulo.trim(),
        descricao: newDescricao.trim() || undefined,
        tipo: newTipo,
        prioridade: newPrioridade,
        dataVencimento: new Date(newDataVencimento).toISOString(),
        clientId: newClientId !== 'none' ? newClientId : undefined,
      };

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar lembrete.');
      }

      setShowNewModal(false);
      setNewTitulo('');
      setNewDescricao('');
      setNewClientId('none');
      await loadReminders();
    } catch (err: any) {
      setNewError(err.message || 'Falha ao salvar lembrete.');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'alta':
        return <Badge variant="destructive">Alta</Badge>;
      case 'media':
        return <Badge className="bg-warning text-warning-foreground">Média</Badge>;
      case 'baixa':
        return <Badge variant="secondary">Baixa</Badge>;
      default:
        return <Badge variant="outline">{p}</Badge>;
    }
  };

  const getPriorityDot = (p: string) => {
    switch (p) {
      case 'alta':
        return 'bg-destructive';
      case 'media':
        return 'bg-warning';
      case 'baixa':
        return 'bg-success';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Lembretes & Tarefas"
          description="Acompanhamento de parcelas PIX, follow-ups de procedimentos e retornos clínicos."
        >
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lembrete
          </Button>
        </PageHeader>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Pendentes</span>
          <p className="text-xl font-bold text-primary">{stats?.pending ?? '—'}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1 border-destructive/30 bg-destructive/5">
          <span className="text-xs text-destructive font-medium">Em Atraso</span>
          <p className="text-xl font-bold text-destructive">{stats?.overdue ?? '—'}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Concluídos</span>
          <p className="text-xl font-bold text-success">{stats?.completed ?? '—'}</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Dispensados</span>
          <p className="text-xl font-bold text-muted-foreground">{stats?.dismissed ?? '—'}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-5 sm:flex">
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="atrasado">Atrasados</TabsTrigger>
            <TabsTrigger value="concluido">Concluídos</TabsTrigger>
            <TabsTrigger value="dispensado">Dispensados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Prioridade:</span>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
              <SelectTrigger className="w-[110px] text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="icon" onClick={loadReminders} disabled={loading} title="Recarregar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Invariant Note (V23 / AC 68) */}
      <div className="p-3 rounded-md bg-muted/30 border border-muted text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4 text-primary flex-shrink-0" />
        <span>
          <strong>Garantia de Integridade Financeira (V23 / AC 68):</strong> Concluir ou dispensar um lembrete altera exclusivamente o status da notificação e nunca modifica a situação financeira nem o saldo das parcelas PIX.
        </span>
      </div>

      {/* Feed / List */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Carregando lembretes...</div>
      ) : reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhum lembrete encontrado"
          description={`Não há tarefas ou lembretes na visualização selecionada.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((lembrete) => {
            const isOverdue = lembrete.isOverdue || new Date(lembrete.dataVencimento) < new Date();
            const isCompleted = lembrete.status === 'concluido';
            const isDismissed = lembrete.status === 'dispensado';

            return (
              <Card
                key={lembrete.id}
                className={`transition-all ${
                  isCompleted || isDismissed ? 'opacity-70 bg-muted/15' : 'hover:border-primary/40'
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${getPriorityDot(lembrete.prioridade)}`}
                          title={`Prioridade ${lembrete.prioridade}`}
                        />
                        <h3 className="font-semibold text-sm leading-tight">{lembrete.titulo}</h3>
                      </div>
                      {getPriorityBadge(lembrete.prioridade)}
                    </div>

                    {lembrete.descricao && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {lembrete.descricao}
                      </p>
                    )}

                    {/* Client & PIX details */}
                    <div className="space-y-1 pt-1">
                      {lembrete.client && (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                          <User className="h-3.5 w-3.5" />
                          <Link href={`/clientes/${lembrete.client.id}`} className="hover:underline">
                            {lembrete.client.nome}
                          </Link>
                        </div>
                      )}

                      {lembrete.pixInstallment && (
                        <div className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/40 font-mono">
                          <span className="flex items-center gap-1">
                            <QrCode className="h-3.5 w-3.5 text-primary" />
                            PIX Parc. {lembrete.pixInstallment.numeroParcela}/{lembrete.pixInstallment.totalParcelas}
                          </span>
                          <span className="font-bold text-primary">
                            {formatCurrency(Number(lembrete.pixInstallment.valor))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="border-t pt-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(new Date(lembrete.dataVencimento))}
                      </span>

                      {lembrete.status === 'pendente' && isOverdue ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Vencido
                        </Badge>
                      ) : (
                        <StatusBadge status={lembrete.status} />
                      )}
                    </div>

                    {/* Status Toggles (V23 / AC 68) */}
                    {lembrete.status === 'pendente' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-success border-success/30 hover:bg-success/10"
                          onClick={() => handleUpdateStatus(lembrete.id, 'concluido')}
                          disabled={actionLoading}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Concluir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:bg-muted"
                          onClick={() => handleUpdateStatus(lembrete.id, 'dispensado')}
                          disabled={actionLoading}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Dispensar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Novo Lembrete */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Novo Lembrete</DialogTitle>
            <DialogDescription>
              Crie uma tarefa, lembrete de retorno ou aviso de follow-up com cliente.
            </DialogDescription>
          </DialogHeader>

          {newError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">{newError}</div>
          )}

          <form onSubmit={handleCreateReminder} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rem-title">Título *</Label>
              <Input
                id="rem-title"
                placeholder="Ex.: Ligar para paciente confirmar pós-operatório..."
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-client">Cliente (Opcional)</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger id="rem-client">
                  <SelectValue placeholder="Vincular a um cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">Nenhum (Lembrete Geral)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rem-date">Data de Vencimento *</Label>
                <Input
                  id="rem-date"
                  type="date"
                  value={newDataVencimento}
                  onChange={(e) => setNewDataVencimento(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rem-prio">Prioridade</Label>
                <Select
                  value={newPrioridade}
                  onValueChange={(v) => setNewPrioridade(v as any)}
                >
                  <SelectTrigger id="rem-prio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-desc">Descrição</Label>
              <Textarea
                id="rem-desc"
                rows={3}
                placeholder="Detalhes ou instruções da tarefa..."
                value={newDescricao}
                onChange={(e) => setNewDescricao(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? 'Salvando...' : 'Criar Lembrete'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
