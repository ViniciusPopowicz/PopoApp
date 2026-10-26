'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Bell,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  QrCode,
  RefreshCw,
  Info,
  Calendar,
  Stethoscope,
  Repeat,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

interface ReminderItem {
  id: string;
  clientId?: string | null;
  appointmentId?: string | null;
  attendanceId?: string | null;
  pixInstallmentId?: string | null;
  recurrenceId?: string | null;
  occurrenceIndex?: number | null;
  titulo: string;
  descricao?: string | null;
  dataVencimento: string;
  prioridade: 'baixa' | 'media' | 'alta';
  status: 'pendente' | 'concluido' | 'dispensado';
  tipo: string;
  completedAt?: string | null;
  isOverdue?: boolean;
  client?: {
    id: string;
    nome: string;
    telefone?: string | null;
  } | null;
  appointment?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  attendance?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  pixInstallment?: {
    id: string;
    numeroParcela: number;
    totalParcelas: number;
    valor: number;
    status: string;
    payment?: {
      id: string;
      attendanceId: string;
    };
  } | null;
}

interface ReminderStats {
  total?: number;
  pendentes?: number;
  concluidos?: number;
  dispensados?: number;
  atrasados?: number;
  pending?: number;
  overdue?: number;
  completed?: number;
  dismissed?: number;
}

export default function LembretesPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<'pendente' | 'atrasado' | 'concluido' | 'dispensado' | 'todos'>('pendente');
  const [priorityFilter, setPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');

  // New Reminder Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; nome: string }>>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string; dataHora: string; client?: { nome: string } }>>([]);
  const [attendances, setAttendances] = useState<Array<{ id: string; dataHora: string; client?: { nome: string } }>>([]);
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newDataVencimento, setNewDataVencimento] = useState('');
  const [newPrioridade, setNewPrioridade] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newClientId, setNewClientId] = useState<string>('none');
  const [newAppointmentId, setNewAppointmentId] = useState<string>('none');
  const [newAttendanceId, setNewAttendanceId] = useState<string>('none');

  // Recurrence State
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [newFrequencia, setNewFrequencia] = useState<'DIARIA' | 'SEMANAL' | 'MENSAL' | 'ANUAL'>('MENSAL');
  const [newIntervalo, setNewIntervalo] = useState('1');
  const [newDataFim, setNewDataFim] = useState('');
  const [newMaxOcorrencias, setNewMaxOcorrencias] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

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

      const res = await fetch(`/api/reminders?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar lembretes');
      }

      const json = await res.json();
      if (json.success) {
        setReminders(json.data || []);
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        throw new Error(json.error || 'Erro ao buscar lembretes');
      }
    } catch (err: any) {
      console.error('Error loading reminders:', err);
      setError(err.message || 'Erro ao carregar lembretes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab, priorityFilter]);

  useEffect(() => {
    const fetchFormOptions = async () => {
      try {
        const [cliRes, apptRes, attRes] = await Promise.all([
          fetch('/api/clients?limit=100'),
          fetch('/api/appointments?limit=50'),
          fetch('/api/attendances?limit=50'),
        ]);
        if (cliRes.ok) {
          const json = await cliRes.json();
          if (json.success && json.data) setClients(json.data);
        }
        if (apptRes.ok) {
          const json = await apptRes.json();
          if (json.success && json.data) setAppointments(json.data);
        }
        if (attRes.ok) {
          const json = await attRes.json();
          if (json.success && json.data) setAttendances(json.data);
        }
      } catch (err) {
        console.error('Error loading form options for reminder modal:', err);
      }
    };
    fetchFormOptions();
  }, []);

  const handleUpdateStatus = async (id: string, novoStatus: 'concluido' | 'dispensado' | 'pendente') => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/reminders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar status do lembrete');
      }
      await loadReminders();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewError(null);

    if (!newTitulo.trim() || !newDataVencimento) {
      setNewError('Informe o título e a data de vencimento.');
      return;
    }

    try {
      setActionLoading(true);
      const [year, month, day] = newDataVencimento.split('-').map(Number);
      const dueDate = new Date(year, month - 1, day, 12, 0, 0);

      const payload: Record<string, any> = {
        titulo: newTitulo.trim(),
        descricao: newDescricao.trim() ? newDescricao.trim() : null,
        dataVencimento: dueDate.toISOString(),
        prioridade: newPrioridade,
        clientId: newClientId !== 'none' ? newClientId : null,
        appointmentId: newAppointmentId !== 'none' ? newAppointmentId : null,
        attendanceId: newAttendanceId !== 'none' ? newAttendanceId : null,
        tipo: newAppointmentId !== 'none'
          ? 'agendamento'
          : newAttendanceId !== 'none'
          ? 'atendimento'
          : newClientId !== 'none'
          ? 'retorno'
          : 'geral',
      };

      if (isRecurrent) {
        payload.recorrente = true;
        payload.dataInicio = dueDate.toISOString();
        payload.frequencia = newFrequencia;
        payload.intervalo = Number(newIntervalo) || 1;
        if (newDataFim) {
          payload.dataFim = new Date(newDataFim + 'T23:59:59').toISOString();
        }
        if (newMaxOcorrencias) {
          payload.maxOcorrencias = Number(newMaxOcorrencias);
        }
      }

      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao criar lembrete');
      }

      setShowNewModal(false);
      setNewTitulo('');
      setNewDescricao('');
      setNewDataVencimento('');
      setNewPrioridade('media');
      setNewClientId('none');
      setNewAppointmentId('none');
      setNewAttendanceId('none');
      setIsRecurrent(false);
      setNewDataFim('');
      setNewMaxOcorrencias('');
      await loadReminders();
    } catch (err: any) {
      setNewError(err.message || 'Erro ao criar lembrete.');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'alta':
        return (
          <Badge variant="destructive" className="text-[10px]">
            Alta
          </Badge>
        );
      case 'media':
        return (
          <Badge variant="secondary" className="text-[10px] bg-warning/20 text-warning-foreground">
            Média
          </Badge>
        );
      case 'baixa':
        return (
          <Badge variant="outline" className="text-[10px]">
            Baixa
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPriorityDot = (prio: string) => {
    switch (prio) {
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
          description="Acompanhamento de parcelas PIX, agendamentos, atendimentos e lembretes recorrentes."
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
          <p className="text-xl font-bold text-primary">
            {stats?.pendentes ?? stats?.pending ?? '—'}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1 border-destructive/30 bg-destructive/5">
          <span className="text-xs text-destructive font-medium">Em Atraso</span>
          <p className="text-xl font-bold text-destructive">
            {stats?.atrasados ?? stats?.overdue ?? '—'}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Concluídos</span>
          <p className="text-xl font-bold text-success">
            {stats?.concluidos ?? stats?.completed ?? '—'}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Dispensados</span>
          <p className="text-xl font-bold text-muted-foreground">
            {stats?.dispensados ?? stats?.dismissed ?? '—'}
          </p>
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
          description="Não há tarefas ou lembretes na visualização selecionada."
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
                      <div className="flex items-center gap-1">
                        {lembrete.recurrenceId && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Repeat className="h-3 w-3" />
                            #{lembrete.occurrenceIndex ?? 1}
                          </Badge>
                        )}
                        {getPriorityBadge(lembrete.prioridade)}
                      </div>
                    </div>

                    {lembrete.descricao && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {lembrete.descricao}
                      </p>
                    )}

                    {/* Linked Entities (Client, Appointment, Attendance, PIX) */}
                    <div className="space-y-1.5 pt-1">
                      {lembrete.client && (
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                          <User className="h-3.5 w-3.5" />
                          <Link href={`/clientes/${lembrete.client.id}`} className="hover:underline">
                            {lembrete.client.nome}
                          </Link>
                        </div>
                      )}

                      {lembrete.appointment && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <Link href="/agenda" className="hover:underline">
                            Agendamento: {formatDate(new Date(lembrete.appointment.dataHora))} ({lembrete.appointment.status})
                          </Link>
                        </div>
                      )}

                      {lembrete.attendance && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Stethoscope className="h-3.5 w-3.5 text-primary" />
                          <Link href={`/atendimentos/${lembrete.attendance.id}`} className="hover:underline">
                            Atendimento: {formatDate(new Date(lembrete.attendance.dataHora))} ({lembrete.attendance.status})
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

      {/* Modal: Novo Lembrete (Avulso ou Recorrente) */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lembrete</DialogTitle>
            <DialogDescription>
              Crie um lembrete avulso ou recorrente vinculado a cliente, agendamento ou atendimento.
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
                placeholder="Ex.: Retorno de avaliação de toxina botulínica..."
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rem-appt">Agendamento (Opcional)</Label>
                <Select value={newAppointmentId} onValueChange={setNewAppointmentId}>
                  <SelectTrigger id="rem-appt">
                    <SelectValue placeholder="Vincular agendamento..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {appointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatDate(new Date(a.dataHora))} - {a.client?.nome || 'Cliente'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rem-att">Atendimento (Opcional)</Label>
                <Select value={newAttendanceId} onValueChange={setNewAttendanceId}>
                  <SelectTrigger id="rem-att">
                    <SelectValue placeholder="Vincular atendimento..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {attendances.map((att) => (
                      <SelectItem key={att.id} value={att.id}>
                        {formatDate(new Date(att.dataHora))} - {att.client?.nome || 'Cliente'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rem-date">
                  {isRecurrent ? 'Data da 1ª Ocorrência *' : 'Data de Vencimento *'}
                </Label>
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
                <Select value={newPrioridade} onValueChange={(v) => setNewPrioridade(v as any)}>
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

            {/* Recurrence Configuration */}
            <div className="p-3 rounded-md border bg-muted/20 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurrent}
                  onChange={(e) => setIsRecurrent(e.target.checked)}
                  className="rounded border-input"
                />
                <Repeat className="h-4 w-4 text-primary" />
                <span>Repetir este lembrete periodicamente (Recorrência)</span>
              </label>

              {isRecurrent && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Frequência</Label>
                      <Select value={newFrequencia} onValueChange={(v) => setNewFrequencia(v as any)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DIARIA">Diária</SelectItem>
                          <SelectItem value="SEMANAL">Semanal</SelectItem>
                          <SelectItem value="MENSAL">Mensal</SelectItem>
                          <SelectItem value="ANUAL">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo (a cada N períodos)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={newIntervalo}
                        onChange={(e) => setNewIntervalo(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data Limite (Opcional)</Label>
                      <Input
                        type="date"
                        value={newDataFim}
                        onChange={(e) => setNewDataFim(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Máx. Ocorrências (Opcional)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="500"
                        placeholder="Sem limite"
                        value={newMaxOcorrencias}
                        onChange={(e) => setNewMaxOcorrencias(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                {actionLoading ? 'Salvando...' : isRecurrent ? 'Criar Recorrência' : 'Criar Lembrete'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
