'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle,
  XCircle,
  UserX,
  CalendarClock,
  ExternalLink,
  RefreshCw,
  List,
  AlertCircle,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/format';

type ViewMode = 'dia' | 'semana' | 'mes' | 'lista';

interface ProcedureOption {
  id: string;
  nome: string;
  precoPadrao: number;
  duracaoMinutos: number;
  categoria?: string | null;
}

interface ClientOption {
  id: string;
  nome: string;
  telefone?: string | null;
  cpf?: string | null;
}

interface AppointmentItem {
  id: string;
  clientId: string;
  dataHora: string;
  status: string;
  valorEstimado?: number | null;
  observacoes?: string | null;
  client: {
    id: string;
    nome: string;
    telefone?: string | null;
    cpf?: string | null;
  };
  plannedProcedures?: Array<{
    id: string;
    procedureId: string;
    procedure: {
      id: string;
      nome: string;
      duracaoMinutos?: number | null;
      precoPadrao?: number | null;
    };
  }>;
  attendance?: {
    id: string;
    status: string;
    completedAt?: string | null;
  } | null;
  attendances?: Array<{
    id: string;
    status: string;
    completedAt?: string | null;
  }>;
}

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('mes');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected appointment for detail modal
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Create appointment modal state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTime, setNewTime] = useState('09:00');
  const [newSelectedProcedures, setNewSelectedProcedures] = useState<string[]>([]);
  const [newValorEstimado, setNewValorEstimado] = useState('');
  const [newObservacoes, setNewObservacoes] = useState('');
  const [newDialogError, setNewDialogError] = useState<string | null>(null);

  // Sub-dialogs for actions
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Fetch reference lists (Clients, Procedures)
  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const [clientsRes, proceduresRes] = await Promise.all([
          fetch('/api/clients?limit=100&active=true'),
          fetch('/api/procedures?active=true'),
        ]);

        if (clientsRes.ok) {
          const cData = await clientsRes.json();
          if (cData.success && cData.items) {
            setClients(cData.items);
          }
        }

        if (proceduresRes.ok) {
          const pData = await proceduresRes.json();
          if (pData.success && pData.data) {
            setProcedures(pData.data);
          }
        }
      } catch (err) {
        console.error('Error fetching reference data for agenda:', err);
      }
    };

    fetchReferences();
  }, []);

  // Compute date range based on view & currentDate
  const dateRange = useMemo(() => {
    if (view === 'mes') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        startDate: startOfWeek(monthStart, { weekStartsOn: 0 }),
        endDate: endOfWeek(monthEnd, { weekStartsOn: 0 }),
      };
    }
    if (view === 'semana') {
      return {
        startDate: startOfWeek(currentDate, { weekStartsOn: 0 }),
        endDate: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    if (view === 'dia') {
      const d = new Date(currentDate);
      d.setHours(0, 0, 0, 0);
      const e = new Date(currentDate);
      e.setHours(23, 59, 59, 999);
      return { startDate: d, endDate: e };
    }
    // Lista: entire month around currentDate
    return {
      startDate: subDays(startOfMonth(currentDate), 7),
      endDate: addDays(endOfMonth(currentDate), 7),
    };
  }, [currentDate, view]);

  // Fetch appointments for current range
  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const startIso = dateRange.startDate.toISOString();
      const endIso = dateRange.endDate.toISOString();
      const res = await fetch(`/api/appointments?startDate=${startIso}&endDate=${endIso}&limit=100`);
      if (!res.ok) {
        throw new Error('Falha ao carregar agendamentos');
      }
      const data = await res.json();
      if (data.success && data.data) {
        setAppointments(data.data);
      } else {
        throw new Error(data.error || 'Erro ao carregar agendamentos');
      }
    } catch (err: any) {
      console.error('Error loading appointments:', err);
      setError(err.message || 'Erro ao buscar agendamentos na agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Auto-calculate suggested duration & estimated value in create modal
  const handleToggleProcedure = (procId: string) => {
    const updated = newSelectedProcedures.includes(procId)
      ? newSelectedProcedures.filter((id) => id !== procId)
      : [...newSelectedProcedures, procId];
    setNewSelectedProcedures(updated);

    // Sum default prices
    const totalSuggested = updated.reduce((sum, id) => {
      const p = procedures.find((item) => item.id === id);
      return sum + (p?.precoPadrao ? Number(p.precoPadrao) : 0);
    }, 0);

    if (totalSuggested > 0) {
      setNewValorEstimado(totalSuggested.toFixed(2));
    }
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

  // Handle Create Appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      setNewDialogError('Selecione um cliente para o agendamento.');
      return;
    }
    if (!newDate || !newTime) {
      setNewDialogError('Informe a data e o horário do agendamento.');
      return;
    }

    try {
      setActionLoading(true);
      setNewDialogError(null);

      const [hours, minutes] = newTime.split(':').map(Number);
      const [year, month, day] = newDate.split('-').map(Number);
      const dataHora = new Date(year, month - 1, day, hours, minutes);

      const payload = {
        clientId: newClientId,
        dataHora: dataHora.toISOString(),
        valorEstimado: newValorEstimado ? parseFloat(newValorEstimado) : null,
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
      // Reset form
      setNewClientId('');
      setNewSelectedProcedures([]);
      setNewValorEstimado('');
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
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Informe a nova data e o horário.');
      return;
    }

    try {
      setActionLoading(true);
      setRescheduleError(null);

      const [hours, minutes] = rescheduleTime.split(':').map(Number);
      const [year, month, day] = rescheduleDate.split('-').map(Number);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Agenda" description="Gerencie seus horários e procedimentos planejados.">
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
          </Button>
        </PageHeader>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar / Controls */}
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

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
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
              const dayAppointments = appointments.filter((a) => isSameDay(parseISO(a.dataHora), day));
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
                    {dayAppointments.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                        {dayAppointments.length} agend.
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1 max-h-[90px]">
                    {dayAppointments.map((appt) => {
                      const procText =
                        appt.plannedProcedures?.map((p) => p.procedure.nome).join(', ') ||
                        'Sem procedimento';
                      return (
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
                      );
                    })}
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
              }).map((day, idx) => (
                <div key={idx} className={isToday(day) ? 'text-primary font-bold' : ''}>
                  <div>{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                </div>
              ))}
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
          <div className="text-center font-semibold text-lg border-b pb-2">
            {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger id="client-select">
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data e Horário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-date">Data *</Label>
                <Input
                  id="appt-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
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
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-muted/10">
                {procedures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum procedimento cadastrado.</p>
                ) : (
                  procedures.map((proc) => {
                    const isSelected = newSelectedProcedures.includes(proc.id);
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
                        <span className="font-semibold text-muted-foreground">
                          {formatCurrency(Number(proc.precoPadrao || 0))}
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
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newValorEstimado}
                onChange={(e) => setNewValorEstimado(e.target.value)}
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

              {selectedAppointment.valorEstimado && (
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
                          setRescheduleDate(format(parseISO(selectedAppointment.dataHora), 'yyyy-MM-dd'));
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
                <Input
                  id="resched-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
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
