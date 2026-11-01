'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Bell,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  QrCode,
  User,
  Calendar,
  Trash2,
  Edit3,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AppCombobox } from '@/components/ui/app-combobox';
import { ListingToolbar } from '@/components/shared/listing-toolbar';
import { useDebounce } from '@/hooks/use-debounce';
import { maskDateBR, dateBRToISO, isoToDateBR } from '@/lib/masks';
import { formatCurrency, formatDate } from '@/lib/format';
import { ReminderDto, ReminderPriority, ReminderStatsDto } from '@/types/reminder';

const PRIORITY_FILTER_OPTIONS = [
  { value: 'todas', label: 'Todas as Prioridades' },
  { value: 'alta', label: 'Prioridade Alta' },
  { value: 'media', label: 'Prioridade Média' },
  { value: 'baixa', label: 'Prioridade Baixa' },
];

const PRIORITY_FORM_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

const RECURRENCE_FREQUENCY_OPTIONS = [
  { value: 'DIARIA', label: 'Diária' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'MENSAL', label: 'Mensal' },
  { value: 'ANUAL', label: 'Anual' },
];

function LembretesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlDateParam = searchParams.get('date') || '';

  const [reminders, setReminders] = useState<ReminderDto[]>([]);
  const [stats, setStats] = useState<ReminderStatsDto>({
    total: 0,
    pendentes: 0,
    concluidos: 0,
    dispensados: 0,
    atrasados: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pendente');
  const [priorityFilter, setPriorityFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [dateFilter, setDateFilter] = useState<string>(urlDateParam);
  const [clients, setClients] = useState<Array<{ id: string; nome: string }>>([]);
  const [appointments, setAppointments] = useState<
    Array<{ id: string; dataHora: string; status: string; clientId: string }>
  >([]);
  const [attendances, setAttendances] = useState<
    Array<{ id: string; dataHora: string; status: string; clientId: string }>
  >([]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderDto | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataVencimentoMasked, setDataVencimentoMasked] = useState('');
  const [prioridade, setPrioridade] = useState<ReminderPriority>('media');
  const [clientId, setClientId] = useState<string>('');
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [attendanceId, setAttendanceId] = useState<string>('');

  // Recurrence State
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState<'DIARIA' | 'SEMANAL' | 'MENSAL' | 'ANUAL'>('MENSAL');
  const [intervalo, setIntervalo] = useState('1');
  const [dataFimMasked, setDataFimMasked] = useState('');
  const [maxOcorrencias, setMaxOcorrencias] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDateFilter(urlDateParam);
    if (urlDateParam) {
      setStatusFilter('todos');
    }
  }, [urlDateParam]);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'todos') {
        params.set('status', statusFilter);
      } else {
        params.set('status', 'todos');
      }
      if (priorityFilter && priorityFilter !== 'todas') {
        params.set('prioridade', priorityFilter);
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      if (dateFilter) {
        params.set('date', dateFilter);
      }
      params.set('limit', '200');

      const res = await fetch(`/api/reminders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao carregar lembretes');
      }
      setReminders(json.data || json.items || []);
      if (json.stats) {
        setStats(json.stats);
      }
    } catch (err) {
      console.error('Erro ao buscar lembretes:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, debouncedSearch, dateFilter]);

  const loadClientsAndLinks = useCallback(async () => {
    try {
      const [cRes, apRes, atRes] = await Promise.all([
        fetch('/api/clients?status=ativo&limit=100'),
        fetch('/api/appointments?limit=50'),
        fetch('/api/attendances?limit=50'),
      ]);
      if (cRes.ok) {
        const json = await cRes.json();
        const clientList = json.data || json.items || [];
        if (Array.isArray(clientList)) {
          setClients(clientList);
        }
      }
      if (apRes.ok) {
        const json = await apRes.json();
        const list = json.data || json.appointments || json.items || [];
        if (Array.isArray(list)) setAppointments(list);
      }
      if (atRes.ok) {
        const json = await atRes.json();
        const list = json.data || json.attendances || json.items || [];
        if (Array.isArray(list)) setAttendances(list);
      }
    } catch {
      // Ignore optional dropdown fetch error
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  useEffect(() => {
    loadClientsAndLinks();
  }, [loadClientsAndLinks]);

  const clientOptions = useMemo(
    () => [
      { value: '', label: 'Nenhum cliente (Lembrete geral da clínica)' },
      ...clients.map((c) => ({ value: c.id, label: c.nome })),
    ],
    [clients]
  );

  const appointmentOptions = useMemo(() => {
    const filtered = appointments.filter((ap) => !clientId || ap.clientId === clientId);
    return [
      { value: '', label: 'Nenhum agendamento' },
      ...filtered.map((ap) => ({
        value: ap.id,
        label: `${formatDate(ap.dataHora)} (${ap.status})`,
      })),
    ];
  }, [appointments, clientId]);

  const attendanceOptions = useMemo(() => {
    const filtered = attendances.filter((at) => !clientId || at.clientId === clientId);
    return [
      { value: '', label: 'Nenhum atendimento' },
      ...filtered.map((at) => ({
        value: at.id,
        label: `${formatDate(at.dataHora)} (${at.status})`,
      })),
    ];
  }, [attendances, clientId]);

  const openCreateModal = () => {
    setEditingReminder(null);
    setTitulo('');
    setDescricao('');
    const defaultIso = dateFilter || new Date().toISOString().slice(0, 10);
    setDataVencimentoMasked(isoToDateBR(defaultIso));
    setPrioridade('media');
    setClientId('');
    setAppointmentId('');
    setAttendanceId('');
    setRecorrente(false);
    setFrequencia('MENSAL');
    setIntervalo('1');
    setDataFimMasked('');
    setMaxOcorrencias('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const openEditModal = (r: ReminderDto) => {
    setEditingReminder(r);
    setTitulo(r.titulo);
    setDescricao(r.descricao ?? '');
    setDataVencimentoMasked(isoToDateBR(r.dataVencimento));
    setPrioridade(r.prioridade);
    setClientId(r.clientId ?? '');
    setAppointmentId(r.appointmentId ?? '');
    setAttendanceId(r.attendanceId ?? '');
    setRecorrente(false);
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isoVencimento = dateBRToISO(dataVencimentoMasked);
    if (!isoVencimento) {
      setErrorMsg('Data de vencimento inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    let isoDataFim: string | null = null;
    if (recorrente && dataFimMasked.trim()) {
      const convertedEnd = dateBRToISO(dataFimMasked);
      if (!convertedEnd) {
        setErrorMsg('Data de término da recorrência inválida. Use o formato DD/MM/AAAA.');
        return;
      }
      isoDataFim = convertedEnd;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        titulo,
        descricao: descricao || null,
        dataVencimento: new Date(`${isoVencimento}T12:00:00.000Z`).toISOString(),
        prioridade,
        clientId: clientId || null,
        appointmentId: appointmentId || null,
        attendanceId: attendanceId || null,
      };

      if (!editingReminder && recorrente) {
        payload.recorrente = true;
        payload.frequencia = frequencia;
        payload.intervalo = Math.max(1, parseInt(intervalo, 10) || 1);
        payload.dataInicio = payload.dataVencimento;
        payload.dataFim = isoDataFim
          ? new Date(`${isoDataFim}T23:59:59.000Z`).toISOString()
          : null;
        payload.maxOcorrencias = maxOcorrencias ? parseInt(maxOcorrencias, 10) : null;
      }

      const url = editingReminder
        ? `/api/reminders/${editingReminder.id}`
        : '/api/reminders';
      const method = editingReminder ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao salvar lembrete');
      }

      setDialogOpen(false);
      await loadReminders();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: 'pendente' | 'concluido' | 'dispensado'
  ) => {
    try {
      const res = await fetch(`/api/reminders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadReminders();
      }
    } catch (err) {
      console.error('Erro ao alterar status do lembrete:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadReminders();
      }
    } catch (err) {
      console.error('Erro ao excluir lembrete:', err);
    }
  };

  const handleClearDateFilter = () => {
    setDateFilter('');
    router.replace('/lembretes');
  };

  const getPriorityBadge = (p: ReminderPriority) => {
    if (p === 'alta') return <Badge variant="destructive">Alta</Badge>;
    if (p === 'media') return <Badge variant="warning">Média</Badge>;
    return <Badge variant="secondary">Baixa</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Central de Lembretes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie lembretes internos da clínica, retornos de pacientes e vencimentos de parcelas PIX.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Pendentes
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {stats.pendentes}
              </p>
            </div>
            <Clock className="h-8 w-8 text-amber-500/30" />
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Em Atraso
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {stats.atrasados}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-rose-500/30" />
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Concluídos
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {stats.concluidos}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Dispensados
              </p>
              <p className="text-2xl font-bold text-slate-600 mt-1">
                {stats.dispensados}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-slate-400/30" />
          </CardContent>
        </Card>
      </div>

      {/* Standardized ListingToolbar (Search on left, Filters + Primary Create Button on right) */}
      <ListingToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar lembrete por título, descrição ou cliente..."
        leftSlot={
          dateFilter ? (
            <Badge variant="info" className="h-8 px-2.5 gap-1.5 text-xs shrink-0">
              <Calendar className="h-3.5 w-3.5" />
              Data: {isoToDateBR(dateFilter)}
              <button
                type="button"
                onClick={handleClearDateFilter}
                className="ml-1 rounded hover:bg-black/10 p-0.5"
                title="Limpar filtro de data"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : null
        }
        rightSlot={
          <>
            <div className="w-48">
              <AppCombobox
                options={PRIORITY_FILTER_OPTIONS}
                value={priorityFilter}
                onChange={setPriorityFilter}
                placeholder="Prioridade"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={loadReminders}
              disabled={loading}
              title="Atualizar lembretes"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={openCreateModal} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo Lembrete
            </Button>
          </>
        }
      />

      {/* Status Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="pendente">
              Pendentes ({stats.pendentes})
            </TabsTrigger>
            <TabsTrigger value="atrasado">
              Atrasados ({stats.atrasados})
            </TabsTrigger>
            <TabsTrigger value="concluido">
              Concluídos ({stats.concluidos})
            </TabsTrigger>
            <TabsTrigger value="dispensado">
              Dispensados ({stats.dispensados})
            </TabsTrigger>
            <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Reminders List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Carregando lembretes...
            </div>
          ) : reminders.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-base font-medium">Nenhum lembrete encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Não há lembretes correspondentes aos filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-muted/20 ${
                    r.isOverdue ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.tipo === 'parcela_pix' ? (
                        <Badge variant="info" className="gap-1">
                          <QrCode className="h-3 w-3" />
                          Parcela PIX
                        </Badge>
                      ) : (
                        <Badge variant="outline">Geral / Retorno</Badge>
                      )}

                      {getPriorityBadge(r.prioridade)}

                      {r.isOverdue && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Vencido
                        </Badge>
                      )}

                      {r.status === 'concluido' && (
                        <Badge variant="success">Concluído</Badge>
                      )}
                      {r.status === 'dispensado' && (
                        <Badge variant="secondary">Dispensado</Badge>
                      )}
                    </div>

                    <h3
                      className={`font-semibold text-base ${
                        r.status !== 'pendente'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {r.titulo}
                    </h3>

                    {r.descricao && (
                      <p className="text-sm text-muted-foreground">{r.descricao}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Vencimento: {formatDate(r.dataVencimento)}
                      </span>

                      {r.client && (
                        <Link
                          href={`/clientes/${r.client.id}`}
                          className="flex items-center gap-1 hover:text-primary hover:underline"
                        >
                          <User className="h-3.5 w-3.5" />
                          {r.client.nome}
                        </Link>
                      )}

                      {r.pixInstallment && (
                        <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          Valor Parcela: {formatCurrency(r.pixInstallment.valor)} (Status
                          Financeiro: {r.pixInstallment.status})
                        </span>
                      )}

                      {r.pixInstallment?.payment?.attendanceId && (
                        <Link
                          href={`/atendimentos/${r.pixInstallment.payment.attendanceId}`}
                          className="flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir Atendimento
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.status === 'pendente' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => handleStatusChange(r.id, 'concluido')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-muted-foreground"
                          onClick={() => handleStatusChange(r.id, 'dispensado')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Dispensar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => handleStatusChange(r.id, 'pendente')}
                      >
                        Reabrir Lembrete
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEditModal(r)}
                      title="Editar Lembrete"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                      title="Excluir Lembrete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? 'Editar Lembrete' : 'Novo Lembrete'}
            </DialogTitle>
            <DialogDescription>
              Lembretes são alertas internos da clínica e não disparam mensagens externas automáticas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReminder} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rem-titulo">Título do Lembrete *</Label>
              <Input
                id="rem-titulo"
                required
                placeholder="Ex: Retorno de avaliação de Botox"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rem-vencimento">Data de Vencimento *</Label>
                <DatePicker
                  id="rem-vencimento"
                  placeholder="DD/MM/AAAA"
                  required
                  value={dataVencimentoMasked}
                  onChange={setDataVencimentoMasked}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rem-prioridade">Prioridade</Label>
                <AppCombobox
                  id="rem-prioridade"
                  options={PRIORITY_FORM_OPTIONS}
                  value={prioridade}
                  onChange={(val) => setPrioridade(val as ReminderPriority)}
                  placeholder="Selecione a prioridade"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rem-cliente">Cliente Vinculado (Opcional)</Label>
              <AppCombobox
                id="rem-cliente"
                options={clientOptions}
                value={clientId}
                onChange={(val) => {
                  setClientId(val);
                  setAppointmentId('');
                  setAttendanceId('');
                }}
                placeholder="Selecione um cliente..."
                searchPlaceholder="Buscar cliente por nome..."
                searchable
                clearable
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rem-appt">Agendamento (Opcional)</Label>
                <AppCombobox
                  id="rem-appt"
                  options={appointmentOptions}
                  value={appointmentId}
                  onChange={setAppointmentId}
                  placeholder="Nenhum agendamento"
                  searchable
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rem-att">Atendimento (Opcional)</Label>
                <AppCombobox
                  id="rem-att"
                  options={attendanceOptions}
                  value={attendanceId}
                  onChange={setAttendanceId}
                  placeholder="Nenhum atendimento"
                  searchable
                />
              </div>
            </div>

            {!editingReminder && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rem-recorrente"
                    checked={recorrente}
                    onCheckedChange={(c) => setRecorrente(Boolean(c))}
                  />
                  <Label
                    htmlFor="rem-recorrente"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Repetir lembrete automaticamente (Recorrente)
                  </Label>
                </div>

                {recorrente && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Frequência</Label>
                      <AppCombobox
                        options={RECURRENCE_FREQUENCY_OPTIONS}
                        value={frequencia}
                        onChange={(val) =>
                          setFrequencia(
                            val as 'DIARIA' | 'SEMANAL' | 'MENSAL' | 'ANUAL'
                          )
                        }
                        placeholder="Frequência"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">A cada (intervalo)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        className="h-10 text-xs"
                        value={intervalo}
                        onChange={(e) => setIntervalo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data de Término (Opcional)</Label>
                      <DatePicker
                        placeholder="DD/MM/AAAA"
                        className="text-xs"
                        value={dataFimMasked}
                        onChange={setDataFimMasked}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Máx. Ocorrências (Opcional)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        placeholder="Sem limite"
                        className="h-10 text-xs"
                        value={maxOcorrencias}
                        onChange={(e) => setMaxOcorrencias(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rem-descricao">Descrição / Observações</Label>
              <textarea
                id="rem-descricao"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Detalhes adicionais sobre este lembrete..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar Lembrete'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LembretesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Carregando central de lembretes...
        </div>
      }
    >
      <LembretesContent />
    </Suspense>
  );
}
