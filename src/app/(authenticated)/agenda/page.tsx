'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  CheckCircle,
  XCircle,
  UserX,
  CalendarClock,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Bell,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppCombobox } from '@/components/ui/app-combobox';
import {
  maskCurrencyBRL,
  formatNumberToBRLInput,
  unmaskCurrencyBRL,
  maskDateBR,
  dateBRToISO,
  isoToDateBR,
} from '@/lib/masks';
import { formatCurrency, formatDateTime, formatTime } from '@/lib/format';

// Types
interface ClientOption {
  id: string;
  nome: string;
  telefone?: string;
}

interface ProcedureOption {
  id: string;
  nome: string;
  valorPadrao?: number;
  precoPadrao?: number;
  duracaoMinutos?: number;
}

interface AppointmentItem {
  id: string;
  clientId: string;
  dataHora: string;
  status: string;
  observacoes?: string | null;
  valorEstimado?: number | null;
  motivoCancelamento?: string | null;
  client: {
    id: string;
    nome: string;
    cpf?: string;
    telefone?: string;
  };
  plannedProcedures?: Array<{
    id: string;
    procedureId: string;
    procedure: {
      id: string;
      nome: string;
      duracaoMinutos?: number;
    };
  }>;
  attendance?: {
    id: string;
    status: string;
  } | null;
  attendances?: Array<{
    id: string;
    status: string;
  }>;
}

interface CalendarReminderItem {
  id: string;
  titulo: string;
  dataVencimento: string;
  prioridade: string;
  status: string;
}

type ViewMode = 'mes' | 'semana' | 'dia' | 'lista';

const getProcedurePrice = (proc?: ProcedureOption | null): number => {
  if (!proc) return 0;
  const val = proc.valorPadrao ?? proc.precoPadrao ?? 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export default function AgendaPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('mes');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [reminders, setReminders] = useState<CalendarReminderItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showNewDialog, setShowNewDialog] = useState<boolean>(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState<boolean>(false);

  // Action sub-dialogs
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState<boolean>(false);

  // Create form states
  const [newClientId, setNewClientId] = useState<string>('');
  const [newDateMasked, setNewDateMasked] = useState<string>(
    isoToDateBR(format(new Date(), 'yyyy-MM-dd'))
  );
  const [newTime, setNewTime] = useState<string>('09:00');
  const [newSelectedProcedures, setNewSelectedProcedures] = useState<string[]>([]);
  const [newValorEstimadoMasked, setNewValorEstimadoMasked] = useState<string>('');
  const [newObservacoes, setNewObservacoes] = useState<string>('');
  const [newDialogError, setNewDialogError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Cancel form state
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Reschedule form state
  const [rescheduleDateMasked, setRescheduleDateMasked] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('09:00');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Compute date range for current view
  const dateRange = useMemo(() => {
    if (view === 'mes') {
      const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
      const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
      return { startDate: start, endDate: end };
    }
    if (view === 'semana') {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return { startDate: start, endDate: end };
    }
    if (view === 'dia') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    // Lista: show current month
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return { startDate: start, endDate: end };
  }, [view, currentDate]);

  // Fetch appointments & reminders in range
  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        limit: '200',
      });

      const remParams = new URLSearchParams({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        status: 'pendente',
        limit: '200',
      });

      const [res, remRes] = await Promise.all([
        fetch(`/api/appointments?${params.toString()}`),
        fetch(`/api/reminders?${remParams.toString()}`),
      ]);

      if (!res.ok) {
        throw new Error('Falha ao carregar agendamentos.');
      }
      const json = await res.json();
      const list = json.data?.items || json.data || json.appointments || [];
      setAppointments(Array.isArray(list) ? list : []);

      if (remRes.ok) {
        const remJson = await remRes.json();
        const remList = remJson.data || remJson.items || [];
        setReminders(Array.isArray(remList) ? remList : []);
      }
    } catch (err: any) {
      console.error('Error loading appointments:', err);
      setError(err.message || 'Erro ao carregar agenda.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Group reminders by YYYY-MM-DD key for O(1) lookup per day cell
  const remindersByDayMap = useMemo(() => {
    const map = new Map<string, CalendarReminderItem[]>();
    for (const rem of reminders) {
      if (!rem.dataVencimento) continue;
      const dt = parseISO(rem.dataVencimento);
      if (isNaN(dt.getTime())) continue;
      const key = format(dt, 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(rem);
      map.set(key, existing);
    }
    return map;
  }, [reminders]);

  // Fetch clients and procedures for create dialog
  useEffect(() => {
    async function loadOptions() {
      try {
        const [clientsRes, procsRes] = await Promise.all([
          fetch('/api/clients?status=ativo&limit=100'),
          fetch('/api/procedures?active=true&limit=100'),
        ]);
        if (clientsRes.ok) {
          const cJson = await clientsRes.json();
          const cList = cJson.data?.items || cJson.data || cJson.items || [];
          setClients(Array.isArray(cList) ? cList : []);
        }
        if (procsRes.ok) {
          const pJson = await procsRes.json();
          const pList = pJson.data?.items || pJson.data || pJson.items || [];
          setProcedures(Array.isArray(pList) ? pList : []);
        }
      } catch (err) {
        console.error('Error loading form options:', err);
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const clientComboboxOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: c.nome,
        sublabel: c.telefone ? `Tel: ${c.telefone}` : undefined,
      })),
    [clients]
  );

  // Auto-calculate suggested estimated value in create modal (BUG-005 fix)
  const handleToggleProcedure = (procId: string) => {
    const updated = newSelectedProcedures.includes(procId)
      ? newSelectedProcedures.filter((id) => id !== procId)
      : [...newSelectedProcedures, procId];
    setNewSelectedProcedures(updated);

    if (updated.length === 0) {
      setNewValorEstimadoMasked('');
      return;
    }

    const totalSuggested = updated.reduce((sum, id) => {
      const p = procedures.find((item) => item.id === id);
      return sum + getProcedurePrice(p);
    }, 0);

    setNewValorEstimadoMasked(formatNumberToBRLInput(totalSuggested));
  };

  // Navigations
  const handlePrev = () => {
    if (view === 'mes') setCurrentDate(subMonths(currentDate, 1));
    if (view === 'semana') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'dia') setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (view === 'mes') setCurrentDate(addMonths(currentDate, 1));
    if (view === 'semana') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'dia') setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleNavigateRemindersForDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const dateKey = format(day, 'yyyy-MM-dd');
    router.push(`/lembretes?date=${dateKey}`);
  };

  // Handle Create Appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      setNewDialogError('Selecione um cliente para o agendamento.');
      return;
    }

    const isoDate = dateBRToISO(newDateMasked);
    if (!isoDate || !newTime) {
      setNewDialogError('Informe uma data válida (DD/MM/AAAA) e o horário do agendamento.');
      return;
    }

    try {
      setActionLoading(true);
      setNewDialogError(null);

      const [hours, minutes] = newTime.split(':').map(Number);
      const [year, month, day] = isoDate.split('-').map(Number);
      const dataHora = new Date(year, month - 1, day, hours, minutes);

      const valorEstimadoNum = newValorEstimadoMasked
        ? unmaskCurrencyBRL(newValorEstimadoMasked)
        : null;

      const payload = {
        clientId: newClientId,
        dataHora: dataHora.toISOString(),
        valorEstimado: valorEstimadoNum,
        observacoes: newObservacoes.trim() || null,
        plannedProcedureIds: newSelectedProcedures,
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar agendamento.');
      }

      // Success
      setShowNewDialog(false);
      setNewClientId('');
      setNewSelectedProcedures([]);
      setNewValorEstimadoMasked('');
      setNewObservacoes('');
      await loadAppointments();
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      setNewDialogError(err.message || 'Falha ao salvar agendamento.');
    } finally {
      setActionLoading(false);
    }
  };

  // Status Action Handlers
  const handleConfirmAppointment = async (apptId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/appointments/${apptId}/confirm`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao confirmar agendamento.');
      }
      setShowDetailDialog(false);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar agendamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShowAppointment = async (apptId: string) => {
    if (!confirm('Deseja realmente marcar este agendamento como "Não Compareceu"?')) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/appointments/${apptId}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar falta.');
      }
      setShowDetailDialog(false);
      await loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar falta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError('O motivo do cancelamento é obrigatório (mínimo 3 caracteres).');
      return;
    }

    try {
      setActionLoading(true);
      setCancelError(null);
      const res = await fetch(`/api/appointments/${selectedAppointment.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoCancelamento: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao cancelar agendamento.');
      }
      setShowCancelDialog(false);
      setShowDetailDialog(false);
      setCancelReason('');
      await loadAppointments();
    } catch (err: any) {
      setCancelError(err.message || 'Erro ao processar cancelamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleAppointment = async () => {
    if (!selectedAppointment) return;
    const isoRescheduleDate = dateBRToISO(rescheduleDateMasked);
    if (!isoRescheduleDate || !rescheduleTime) {
      setRescheduleError('Informe uma nova data válida (DD/MM/AAAA) e o horário.');
      return;
    }

    try {
      setActionLoading(true);
      setRescheduleError(null);

      const [hours, minutes] = rescheduleTime.split(':').map(Number);
      const [year, month, day] = isoRescheduleDate.split('-').map(Number);
      const novaDataHora = new Date(year, month - 1, day, hours, minutes);

      const res = await fetch(`/api/appointments/${selectedAppointment.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novaDataHora: novaDataHora.toISOString(),
          motivo: rescheduleReason.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao reagendar agendamento.');
      }
      setShowRescheduleDialog(false);
      setShowDetailDialog(false);
      setRescheduleReason('');
      await loadAppointments();
    } catch (err: any) {
      setRescheduleError(err.message || 'Erro ao processar reagendamento.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for 1:1 attendance ID
  const attendanceId = selectedAppointment?.attendance?.id ?? selectedAppointment?.attendances?.[0]?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Gerencie seus horários e procedimentos planejados."
      />

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar / Controls — Standardized position with New Appointment on the right */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoje
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-semibold text-base sm:text-lg capitalize ml-2">
            {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={loadAppointments} disabled={loading} title="Recarregar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowNewDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'mes' && (
        <div className="border rounded-lg bg-card overflow-hidden">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 border-b text-center font-medium text-xs sm:text-sm py-2 bg-muted/40">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y border-b">
            {eachDayOfInterval({
              start: dateRange.startDate,
              end: dateRange.endDate,
            }).map((day, idx) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayAppointments = appointments.filter((a) => isSameDay(parseISO(a.dataHora), day));
              const dayReminders = remindersByDayMap.get(dayKey) || [];
              const inCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col transition-colors ${
                    !inCurrentMonth ? 'bg-muted/15 text-muted-foreground' : 'bg-card'
                  } ${isCurrentDay ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full ${
                        isCurrentDay ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    <div className="flex items-center gap-1">
                      {dayReminders.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleNavigateRemindersForDay(day, e)}
                          title={`${dayReminders.length} lembrete(s) pendente(s) neste dia. Clique para ver.`}
                          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100/90 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold transition-colors"
                        >
                          <Bell className="h-2.5 w-2.5 fill-amber-500 text-amber-600" />
                          <span>{dayReminders.length}</span>
                        </button>
                      )}
                      {dayAppointments.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                          {dayAppointments.length} agend.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1 max-h-[90px]">
                    {dayAppointments.map((appt) => (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setShowDetailDialog(true);
                        }}
                        className="w-full text-left p-1 rounded text-[11px] bg-primary/10 hover:bg-primary/20 border border-primary/20 truncate block transition-colors"
                      >
                        <span className="font-semibold mr-1">{formatTime(new Date(appt.dataHora))}</span>
                        <span>{appt.client?.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'semana' && (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b text-center font-medium text-xs sm:text-sm py-2 bg-muted/40">
              {eachDayOfInterval({
                start: dateRange.startDate,
                end: dateRange.endDate,
              }).map((day, idx) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayReminders = remindersByDayMap.get(dayKey) || [];
                return (
                  <div
                    key={idx}
                    className={`relative px-1 ${isToday(day) ? 'text-primary font-bold' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{format(day, 'EEE', { locale: ptBR })}</span>
                      {dayReminders.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => handleNavigateRemindersForDay(day, e)}
                          title={`${dayReminders.length} lembrete(s) pendente(s) neste dia`}
                          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300/60 px-1.5 py-0.5 text-[10px] font-semibold transition-colors"
                        >
                          <Bell className="h-2.5 w-2.5 fill-amber-500 text-amber-600" />
                          <span>{dayReminders.length}</span>
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-7 divide-x min-h-[400px]">
              {eachDayOfInterval({
                start: dateRange.startDate,
                end: dateRange.endDate,
              }).map((day, idx) => {
                const dayAppointments = appointments.filter((a) => isSameDay(parseISO(a.dataHora), day));
                return (
                  <div key={idx} className="p-2 space-y-2">
                    {dayAppointments.map((appt) => (
                      <Card
                        key={appt.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors shadow-sm"
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setShowDetailDialog(true);
                        }}
                      >
                        <CardContent className="p-2 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-primary">
                              {formatTime(new Date(appt.dataHora))}
                            </span>
                            <StatusBadge status={appt.status} />
                          </div>
                          <p className="font-medium truncate">{appt.client?.nome}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {appt.plannedProcedures?.map((p) => p.procedure.nome).join(', ') || 'Procedimento'}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'dia' && (
        <div className="border rounded-lg bg-card p-4 space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="font-semibold text-lg capitalize">
              {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            {(remindersByDayMap.get(format(currentDate, 'yyyy-MM-dd')) || []).length > 0 && (
              <button
                type="button"
                onClick={(e) => handleNavigateRemindersForDay(currentDate, e)}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300/60 px-2.5 py-1 text-xs font-semibold transition-colors"
                title="Ver lembretes deste dia"
              >
                <Bell className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                <span>
                  {(remindersByDayMap.get(format(currentDate, 'yyyy-MM-dd')) || []).length}{' '}
                  lembrete(s)
                </span>
              </button>
            )}
          </div>
          {appointments.filter((a) => isSameDay(parseISO(a.dataHora), currentDate)).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum agendamento para este dia.</p>
          ) : (
            <div className="space-y-3">
              {appointments
                .filter((a) => isSameDay(parseISO(a.dataHora), currentDate))
                .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
                .map((appt) => (
                  <div
                    key={appt.id}
                    onClick={() => {
                      setSelectedAppointment(appt);
                      setShowDetailDialog(true);
                    }}
                    className="p-3 border rounded-lg hover:border-primary/50 cursor-pointer flex justify-between items-center transition-colors bg-muted/20"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">{formatTime(new Date(appt.dataHora))}</span>
                        <StatusBadge status={appt.status} />
                      </div>
                      <p className="font-medium text-sm">{appt.client?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.plannedProcedures?.map((p) => p.procedure.nome).join(', ') || 'Procedimento não especificado'}
                      </p>
                    </div>
                    {appt.valorEstimado && (
                      <span className="text-sm font-semibold">{formatCurrency(Number(appt.valorEstimado))}</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {view === 'lista' && (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Data e Hora</th>
                <th className="py-3 px-4 text-left font-medium">Cliente</th>
                <th className="py-3 px-4 text-left font-medium">Procedimento Planejado</th>
                <th className="py-3 px-4 text-left font-medium">Valor Estimado</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum agendamento encontrado no período.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">
                      {formatDateTime(new Date(appt.dataHora))}
                    </td>
                    <td className="py-3 px-4 font-medium">{appt.client?.nome}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                      {appt.plannedProcedures?.map((p) => p.procedure.nome).join(', ') || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {appt.valorEstimado ? formatCurrency(Number(appt.valorEstimado)) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setShowDetailDialog(true);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Appointment */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>
              Preencha os dados do agendamento e selecione os procedimentos planejados.
            </DialogDescription>
          </DialogHeader>

          {newDialogError && (
            <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm">
              {newDialogError}
            </div>
          )}

          <form onSubmit={handleCreateAppointment} className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label htmlFor="client-select">Cliente *</Label>
              <AppCombobox
                id="client-select"
                options={clientComboboxOptions}
                value={newClientId}
                onChange={setNewClientId}
                placeholder="Selecione um cliente..."
                searchPlaceholder="Buscar cliente por nome ou telefone..."
                searchable
              />
            </div>

            {/* Data e Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-date">Data *</Label>
                <DatePicker
                  id="appt-date"
                  placeholder="DD/MM/AAAA"
                  value={newDateMasked}
                  onChange={setNewDateMasked}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-time">Horário *</Label>
                <Input
                  id="appt-time"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Procedimentos Planejados (D3) */}
            <div className="space-y-2">
              <Label>Procedimentos Planejados</Label>
              <p className="text-xs text-muted-foreground">
                Planejamento inicial (separado da execução clínica real no atendimento).
              </p>
              <AppCombobox
                options={procedures.map((proc) => ({
                  value: proc.id,
                  label: `${proc.nome} — ${formatCurrency(getProcedurePrice(proc))}`,
                  sublabel: proc.duracaoMinutos ? `${proc.duracaoMinutos} min` : undefined,
                }))}
                value=""
                onChange={(procId) => {
                  if (procId) handleToggleProcedure(procId);
                }}
                placeholder="Adicionar ou remover procedimento pela busca..."
                searchPlaceholder="Buscar procedimento..."
                searchable
              />
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-1.5 bg-muted/10">
                {procedures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum procedimento cadastrado.</p>
                ) : (
                  procedures.map((proc) => {
                    const isSelected = newSelectedProcedures.includes(proc.id);
                    const price = getProcedurePrice(proc);
                    return (
                      <label
                        key={proc.id}
                        className="flex items-center justify-between text-xs cursor-pointer p-1.5 rounded hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleProcedure(proc.id)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="font-medium">{proc.nome}</span>
                          {proc.duracaoMinutos && (
                            <span className="text-muted-foreground">({proc.duracaoMinutos} min)</span>
                          )}
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(price)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Valor Estimado */}
            <div className="space-y-1.5">
              <Label htmlFor="valor-estimado">Valor Estimado (R$)</Label>
              <Input
                id="valor-estimado"
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={newValorEstimadoMasked}
                onChange={(e) => setNewValorEstimadoMasked(maskCurrencyBRL(e.target.value))}
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={3}
                placeholder="Ex.: Paciente prefere atendimento pontual..."
                value={newObservacoes}
                onChange={(e) => setNewObservacoes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? 'Salvando...' : 'Salvar Agendamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Appointment Detail & Status Actions */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              {selectedAppointment && <StatusBadge status={selectedAppointment.status} />}
            </div>
            <DialogDescription>
              {selectedAppointment && formatDateTime(new Date(selectedAppointment.dataHora))}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-2 text-sm">
              <div className="border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{selectedAppointment.client?.nome}</span>
                </div>
                {selectedAppointment.client?.telefone && (
                  <p className="text-xs text-muted-foreground ml-6">
                    Tel: {selectedAppointment.client.telefone}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Procedimentos Planejados:</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedAppointment.plannedProcedures && selectedAppointment.plannedProcedures.length > 0 ? (
                    selectedAppointment.plannedProcedures.map((p) => (
                      <span
                        key={p.id}
                        className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded"
                      >
                        {p.procedure.nome}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhum informado</span>
                  )}
                </div>
              </div>

              {selectedAppointment.valorEstimado != null && (
                <div>
                  <Label className="text-xs text-muted-foreground">Valor Estimado:</Label>
                  <p className="font-semibold text-base">
                    {formatCurrency(Number(selectedAppointment.valorEstimado))}
                  </p>
                </div>
              )}

              {selectedAppointment.observacoes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Observações:</Label>
                  <p className="text-xs bg-muted/30 p-2 rounded whitespace-pre-wrap">
                    {selectedAppointment.observacoes}
                  </p>
                </div>
              )}

              {/* Attendance Direct Link */}
              {attendanceId && (
                <div className="pt-2 border-t">
                  <Button variant="default" className="w-full gap-2" asChild>
                    <Link href={`/atendimentos/${attendanceId}`}>
                      <ExternalLink className="h-4 w-4" />
                      Abrir Prontuário / Atendimento Clínico
                    </Link>
                  </Button>
                </div>
              )}

              {/* Status Actions */}
              <div className="pt-2 border-t space-y-2">
                <Label className="text-xs text-muted-foreground">Ações de Status:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedAppointment.status === 'Agendado' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-success hover:bg-success/10 border-success/30"
                      onClick={() => handleConfirmAppointment(selectedAppointment.id)}
                      disabled={actionLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Confirmar
                    </Button>
                  )}

                  {['Agendado', 'Confirmado'].includes(selectedAppointment.status) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRescheduleDateMasked(
                            isoToDateBR(format(parseISO(selectedAppointment.dataHora), 'yyyy-MM-dd'))
                          );
                          setRescheduleTime(format(parseISO(selectedAppointment.dataHora), 'HH:mm'));
                          setShowRescheduleDialog(true);
                        }}
                        disabled={actionLoading}
                      >
                        <CalendarClock className="h-4 w-4 mr-1.5" />
                        Reagendar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={actionLoading}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Cancelar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground hover:bg-muted"
                        onClick={() => handleNoShowAppointment(selectedAppointment.id)}
                        disabled={actionLoading}
                      >
                        <UserX className="h-4 w-4 mr-1.5" />
                        Não Compareceu
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setShowDetailDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Cancel Appointment */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>
              Informe o motivo do cancelamento para registrar no histórico.
            </DialogDescription>
          </DialogHeader>

          {cancelError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">
              {cancelError}
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="cancel-reason">Motivo do Cancelamento *</Label>
              <Textarea
                id="cancel-reason"
                rows={3}
                placeholder="Ex.: Cliente solicitou cancelamento por motivos pessoais..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelAppointment} disabled={actionLoading}>
              {actionLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Reschedule Appointment (D1) */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Reagendar Agendamento</DialogTitle>
            <DialogDescription>
              Selecione o novo dia e horário. O agendamento anterior será marcado como Reagendado.
            </DialogDescription>
          </DialogHeader>

          {rescheduleError && (
            <div className="p-2.5 bg-destructive/15 text-destructive rounded-md text-xs">
              {rescheduleError}
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="resched-date">Nova Data *</Label>
                <DatePicker
                  id="resched-date"
                  placeholder="DD/MM/AAAA"
                  value={rescheduleDateMasked}
                  onChange={setRescheduleDateMasked}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resched-time">Novo Horário *</Label>
                <Input
                  id="resched-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="resched-reason">Motivo (Opcional)</Label>
              <Input
                id="resched-reason"
                placeholder="Ex.: Conflito de agenda do cliente"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>
              Voltar
            </Button>
            <Button onClick={handleRescheduleAppointment} disabled={actionLoading}>
              {actionLoading ? 'Reagendando...' : 'Confirmar Reagendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
