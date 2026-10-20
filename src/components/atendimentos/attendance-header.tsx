'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  User,
  Phone,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';

interface AttendanceHeaderProps {
  attendance: {
    id: string;
    dataHora: string;
    status: 'Pendente' | 'Realizado' | 'Cancelado';
    appointmentId: string;
    client: {
      id: string;
      nome: string;
      telefone?: string | null;
      cpf?: string | null;
    };
    appointment?: {
      id: string;
      dataHora: string;
      status: string;
    } | null;
  };
  onRefresh: () => Promise<void>;
}

export function AttendanceHeader({ attendance, onRefresh }: AttendanceHeaderProps) {
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!confirm('Deseja marcar este atendimento clínico como Realizado?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/attendances/${attendance.id}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao concluir atendimento.');
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Deseja realmente cancelar este atendimento clínico?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/attendances/${attendance.id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao cancelar atendimento.');
      }
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar atendimento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/atendimentos">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Atendimento Clínico</h1>
              <StatusBadge status={attendance.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Data e Hora: {formatDateTime(new Date(attendance.dataHora))}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {attendance.status === 'Pendente' && (
            <>
              <Button
                variant="default"
                size="sm"
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={handleComplete}
                disabled={loading}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Concluir Atendimento
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleCancel}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Client & Appointment Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground text-xs">Cliente:</span>
          <Link
            href={`/clientes/${attendance.client.id}`}
            className="font-medium hover:underline flex items-center gap-1"
          >
            {attendance.client.nome}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>

        {attendance.client.telefone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground text-xs">Telefone:</span>
            <span className="font-medium">{formatPhone(attendance.client.telefone)}</span>
          </div>
        )}

        {attendance.appointment && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground text-xs">Agendamento:</span>
            <Link href="/agenda" className="font-medium hover:underline flex items-center gap-1">
              {formatDate(new Date(attendance.appointment.dataHora))}
              <Badge variant="outline" className="text-[10px] ml-1">
                {attendance.appointment.status}
              </Badge>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
