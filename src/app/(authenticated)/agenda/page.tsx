'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay, isSameMonth, 
  isToday, getHours, parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDate } from '@/lib/format';
import { mockAgenda } from '@/data/mock/agenda';
import { mockClientes } from '@/data/mock/clientes';
import { mockProcedimentos } from '@/data/mock/procedimentos';
import { MockAgendamento } from '@/types';

type ViewMode = 'dia' | 'semana' | 'mes';

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('mes');
  const [selectedAppointment, setSelectedAppointment] = useState<MockAgendamento | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const getEndTime = (hora: string, duracaoMin: number) => {
    const [h, m] = hora.split(':').map(Number);
    const totalM = h * 60 + m + duracaoMin;
    return `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')}`;
  };

  // Helper to hydrate appointments
  const getHydratedAppointment = (app: MockAgendamento) => {
    const cliente = mockClientes.find(c => c.id === app.clienteId);
    const procedimento = mockProcedimentos.find(p => p.id === app.procedimentoId);
    return { ...app, clienteNome: cliente?.nome, procedimentoNome: procedimento?.nome, procedimento };
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

  // Month View Setup
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week View Setup
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Time slots for week/day view (07:00 - 20:00)
  const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7);

  // Status colors helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'bg-info/20 border-info text-info-foreground';
      case 'confirmado': return 'bg-success/20 border-success text-success-foreground';
      case 'concluido': return 'bg-muted border-muted-foreground text-muted-foreground';
      case 'cancelado': return 'bg-error/20 border-error text-error-foreground';
      case 'naoCompareceu': return 'bg-warning/20 border-warning text-warning-foreground';
      default: return 'bg-secondary border-secondary-foreground';
    }
  };

  const openAppointment = (app: MockAgendamento) => {
    setSelectedAppointment(app);
    setShowDetailDialog(true);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader title="Agenda" description="Gerencie seus compromissos e horários.">
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agendamento
        </Button>
      </PageHeader>

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-4 rounded-md border">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>Hoje</Button>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-xl font-semibold capitalize ml-2">
            {view === 'mes' && format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            {view === 'semana' && `${format(weekStart, 'dd MMM', { locale: ptBR })} - ${format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}`}
            {view === 'dia' && format(currentDate, 'dd MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar Body */}
      <div className="flex-1 bg-card rounded-md border overflow-hidden flex flex-col min-h-[600px]">
        {/* MONTH VIEW */}
        {view === 'mes' && (
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-7 border-b">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
              {calendarDays.map((day, i) => {
                const dayApps = mockAgenda.filter(a => a.data === format(day, 'yyyy-MM-dd'));
                return (
                  <div 
                    key={i} 
                    className={`border-r border-b p-2 min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors ${!isSameMonth(day, currentDate) ? 'opacity-50 bg-muted/20' : ''}`}
                    onClick={() => { setCurrentDate(day); setView('dia'); }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground font-bold' : ''}`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayApps.slice(0, 3).map(app => {
                        const hydrated = getHydratedAppointment(app);
                        return (
                          <div 
                            key={app.id} 
                            onClick={(e) => { e.stopPropagation(); openAppointment(app); }}
                            className={`text-xs p-1 rounded truncate border ${getStatusColor(app.status)}`}
                          >
                            {app.hora} - {hydrated.clienteNome?.split(' ')[0]}
                          </div>
                        );
                      })}
                      {dayApps.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">+{dayApps.length - 3} mais</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {view === 'semana' && (
          <div className="flex-1 flex flex-col overflow-auto">
            <div className="grid grid-cols-8 border-b sticky top-0 bg-card z-10">
              <div className="p-2 border-r text-center text-xs text-muted-foreground flex items-center justify-center">GMT-3</div>
              {weekDays.map(day => (
                <div 
                  key={day.toISOString()} 
                  className={`p-2 border-r text-center cursor-pointer hover:bg-muted/50 ${isToday(day) ? 'bg-primary/5' : ''}`}
                  onClick={() => { setCurrentDate(day); setView('dia'); }}
                >
                  <div className="text-xs text-muted-foreground uppercase">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className={`text-lg font-medium ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'dd')}</div>
                </div>
              ))}
            </div>
            <div className="flex-1 relative min-h-[800px]">
              {timeSlots.map(hour => (
                <div key={hour} className="grid grid-cols-8 border-b absolute w-full" style={{ top: `${(hour - 7) * 60}px`, height: '60px' }}>
                  <div className="border-r p-2 text-xs text-muted-foreground text-right">{hour.toString().padStart(2, '0')}:00</div>
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className="border-r border-dashed" />
                  ))}
                </div>
              ))}
              
              {/* Render Week Appointments */}
              {mockAgenda.filter(a => {
                const appDate = parseISO(a.data);
                return appDate >= weekStart && appDate <= weekEnd;
              }).map(app => {
                const hydrated = getHydratedAppointment(app);
                const appDate = parseISO(app.data);
                const dayIndex = appDate.getDay();
                const horaFim = getEndTime(app.hora, hydrated.procedimento?.duracao || 60);
                const [startH, startM] = app.hora.split(':').map(Number);
                const [endH, endM] = horaFim.split(':').map(Number);
                
                const top = (startH - 7) * 60 + startM;
                const height = ((endH - startH) * 60) + (endM - startM);
                
                // Hide if outside our 07:00-20:00 window for simplicity
                if (startH < 7 || startH >= 21) return null;

                return (
                  <div
                    key={app.id}
                    onClick={() => openAppointment(app)}
                    className={`absolute p-1 rounded-md border shadow-sm overflow-hidden cursor-pointer ${getStatusColor(app.status)}`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${((dayIndex + 1) / 8) * 100}% + 4px)`,
                      width: `calc(${100 / 8}% - 8px)`,
                      zIndex: 5
                    }}
                  >
                    <div className="text-[10px] font-semibold leading-tight">{app.hora} - {horaFim}</div>
                    <div className="text-xs font-bold truncate">{hydrated.clienteNome}</div>
                    <div className="text-[10px] truncate opacity-80">{hydrated.procedimentoNome}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DAY VIEW */}
        {view === 'dia' && (
          <div className="flex-1 flex overflow-auto">
            <div className="flex-1 relative min-h-[800px] w-full max-w-4xl mx-auto">
              {timeSlots.map(hour => (
                <div key={hour} className="flex border-b absolute w-full" style={{ top: `${(hour - 7) * 60}px`, height: '60px' }}>
                  <div className="w-16 border-r p-2 text-sm text-muted-foreground text-right shrink-0">{hour.toString().padStart(2, '0')}:00</div>
                  <div className="flex-1" />
                </div>
              ))}
              
              {/* Render Day Appointments */}
              {mockAgenda.filter(a => a.data === format(currentDate, 'yyyy-MM-dd')).map(app => {
                const hydrated = getHydratedAppointment(app);
                const horaFim = getEndTime(app.hora, hydrated.procedimento?.duracao || 60);
                const [startH, startM] = app.hora.split(':').map(Number);
                const [endH, endM] = horaFim.split(':').map(Number);
                
                const top = (startH - 7) * 60 + startM;
                const height = ((endH - startH) * 60) + (endM - startM);
                
                if (startH < 7 || startH >= 21) return null;

                return (
                  <div
                    key={app.id}
                    onClick={() => openAppointment(app)}
                    className={`absolute p-2 rounded-md border shadow-sm cursor-pointer ${getStatusColor(app.status)}`}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: '80px',
                      right: '20px',
                      zIndex: 5
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{hydrated.clienteNome}</div>
                        <div className="text-sm opacity-90">{hydrated.procedimentoNome}</div>
                      </div>
                      <div className="text-sm font-semibold">{app.hora} - {horaFim}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            <DialogDescription>Crie um novo agendamento na agenda.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {mockClientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Procedimento</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecione um procedimento" /></SelectTrigger>
                <SelectContent>
                  {mockProcedimentos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" defaultValue={format(currentDate, 'yyyy-MM-dd')} />
              </div>
              <div className="grid gap-2">
                <Label>Hora Início</Label>
                <Input type="time" defaultValue="09:00" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Anotações opcionais..."></textarea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={() => setShowNewDialog(false)}>Salvar Agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedAppointment && (
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="font-semibold text-lg">{getHydratedAppointment(selectedAppointment).clienteNome}</h3>
                  <p className="text-muted-foreground">{getHydratedAppointment(selectedAppointment).procedimentoNome}</p>
                </div>
                <StatusBadge status={selectedAppointment.status} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Data e Hora</p>
                  <p className="font-medium">
                    {formatDate(new Date(selectedAppointment.data))}<br />
                    {selectedAppointment.hora} às {getEndTime(selectedAppointment.hora, getHydratedAppointment(selectedAppointment).procedimento?.duracao || 60)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm">{selectedAppointment.observacoes || 'Nenhuma.'}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
              <Button variant="destructive" onClick={() => setShowDetailDialog(false)}>Cancelar Agenda</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Fechar</Button>
                <Button onClick={() => setShowDetailDialog(false)}>Concluir</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
