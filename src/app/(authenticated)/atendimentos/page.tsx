'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Eye,
  Plus,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/format';

interface AttendanceItem {
  id: string;
  clientId: string;
  appointmentId: string | null;
  dataHora: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
  observacoes?: string | null;
  desconto?: number | null;
  client: {
    id: string;
    nome: string;
    telefone?: string | null;
  };
  appointment?: {
    id: string;
    dataHora: string;
    status: string;
  } | null;
  procedures?: Array<{
    id: string;
    practicedValue: number;
    procedure: {
      id: string;
      nome: string;
    };
  }>;
  financials?: {
    standardTotal: number;
    practicedTotal: number;
    explicitDiscount: number;
    netTotal: number;
    paidTotal: number;
    outstandingBalance: number;
    isFullyPaid: boolean;
  };
}

export default function AtendimentosPage() {
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Pendente' | 'Realizado' | 'Cancelado'>('todos');

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'todos') {
        params.set('status', statusFilter);
      }
      params.set('limit', '50');

      const res = await fetch(`/api/attendances?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar atendimentos');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setAttendances(json.data);
      } else {
        throw new Error(json.error || 'Erro ao consultar atendimentos');
      }
    } catch (err: any) {
      console.error('Error fetching attendances:', err);
      setError(err.message || 'Erro ao carregar atendimentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredAttendances = attendances.filter((atend) => {
    const clientName = atend.client?.nome?.toLowerCase() || '';
    const procNames = atend.procedures?.map((p) => p.procedure.nome.toLowerCase()).join(' ') || '';
    const q = searchTerm.toLowerCase();
    return clientName.includes(q) || procNames.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Atendimentos Clínicos"
          description="Acompanhamento da execução clínica, prontuários e registros de procedimentos."
        >
          <Button asChild>
            <Link href="/agenda">
              <Calendar className="mr-2 h-4 w-4" />
              Ver Agenda / Novo Atendimento
            </Link>
          </Button>
        </PageHeader>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-4 sm:flex">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="Pendente">Pendente</TabsTrigger>
            <TabsTrigger value="Realizado">Realizado</TabsTrigger>
            <TabsTrigger value="Cancelado">Cancelado</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-72">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por cliente ou procedimento..."
          />
          <Button variant="ghost" size="icon" onClick={fetchAttendances} disabled={loading} title="Recarregar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-sm">Carregando atendimentos clínicos...</div>
      ) : filteredAttendances.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum atendimento encontrado"
          description={
            searchTerm
              ? 'Nenhum atendimento corresponde aos termos da busca.'
              : `Não há atendimentos com o status "${statusFilter}".`
          }
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Procedimento(s) Realizado(s)</TableHead>
                <TableHead>Status Clínico</TableHead>
                <TableHead>Total Líquido</TableHead>
                <TableHead>Situação Financeira</TableHead>
                <TableHead className="text-right">Prontuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendances.map((atendimento) => {
                const procs = atendimento.procedures || [];
                const fin = atendimento.financials;
                const netTotal = fin?.netTotal ?? 0;
                const balance = fin?.outstandingBalance ?? 0;
                const isPaid = fin?.isFullyPaid ?? false;

                return (
                  <TableRow key={atendimento.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDateTime(new Date(atendimento.dataHora))}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{atendimento.client?.nome || '—'}</div>
                      {atendimento.client?.telefone && (
                        <div className="text-xs text-muted-foreground">{atendimento.client.telefone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {procs.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Nenhum adicionado</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {procs.map((p) => (
                            <Badge key={p.id} variant="secondary" className="text-xs font-normal">
                              {p.procedure.nome}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={atendimento.status} />
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">
                      {formatCurrency(netTotal)}
                    </TableCell>
                    <TableCell>
                      {netTotal === 0 ? (
                        <Badge variant="outline" className="text-xs">
                          Sem cobrança
                        </Badge>
                      ) : isPaid ? (
                        <Badge variant="default" className="bg-success text-success-foreground text-xs">
                          Quitado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                          Saldo: {formatCurrency(balance)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/atendimentos/${atendimento.id}`} className="gap-1.5">
                          <Eye className="h-4 w-4" />
                          <span>Abrir Workspace</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
