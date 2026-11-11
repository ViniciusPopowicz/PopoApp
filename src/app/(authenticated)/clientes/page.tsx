'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatCpf } from '@/lib/cpf';
import { formatPhone } from '@/lib/format';
import { ClientSummaryDto } from '@/types/client';
import { ClientFormDialog } from '@/components/clientes/client-form-dialog';
import {
  UserPlus,
  Users,
  Eye,
  Edit2,
  Phone,
  ShieldAlert,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const STATUS_FILTER_OPTIONS = [
  { value: 'ativo', label: 'Somente Ativos' },
  { value: 'inativo', label: 'Somente Inativos' },
  { value: 'todos', label: 'Todos os Clientes' },
];

export default function ClientesPage() {
  const router = useRouter();

  const [clients, setClients] = useState<ClientSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<'ativo' | 'inativo' | 'todos'>('todos');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientSummaryDto | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: '15',
      });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      const res = await fetch(`/api/clients?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setClients(json.items || json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleOpenCreate = () => {
    setClientToEdit(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (client: ClientSummaryDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setClientToEdit(client);
    setFormOpen(true);
  };

  const handleToggleClientStatus = async (
    client: ClientSummaryDto,
    nextActive: boolean
  ) => {
    const nextStatus = nextActive ? 'ativo' : 'inativo';
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Erro ao alterar status do cliente');
    }
    setClients((prev) =>
      prev.map((item) =>
        item.id === client.id ? { ...item, status: nextStatus } : item
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Clientes & Prontuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o cadastro completo de pacientes, contatos de emergência e histórico clínico.
          </p>
        </div>
      </div>

      {/* Standardized Listing Toolbar (Search on left, Filters + Create Button on right) */}
      <ListingToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CPF ou telefone..."
        rightSlot={
          <>
            <div className="w-48">
              <AppCombobox
                options={STATUS_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(val) =>
                  setStatusFilter(val as 'ativo' | 'inativo' | 'todos')
                }
                placeholder="Filtrar status"
              />
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </>
        }
      />

      {/* Listing Table */}
      <Card className="shadow-sm overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Paciente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Emergência</TableHead>
                <TableHead className="text-center">Atendimentos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="h-14 animate-pulse bg-muted/20" />
                  </TableRow>
                ))
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                    Nenhum cliente encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow
                    key={client.id}
                    className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                      client.status !== 'ativo' ? 'opacity-70' : ''
                    }`}
                    onClick={() => router.push(`/clientes/${client.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{client.nome}</div>
                      {client.email && (
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatCpf(client.cpf)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatPhone(client.telefone)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.emergencyContacts && client.emergencyContacts.length > 0 ? (
                        <div className="text-xs">
                          <span className="font-medium">
                            {client.emergencyContacts[0].nome}
                          </span>{' '}
                          <span className="text-muted-foreground">
                            ({client.emergencyContacts[0].parentesco})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Não informado
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {client._count?.attendances ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowStatusToggle
                        isActive={client.status === 'ativo'}
                        onToggle={(nextActive) =>
                          handleToggleClientStatus(client, nextActive)
                        }
                      />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/clientes/${client.id}`)}
                          title="Abrir Prontuário Completo"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ficha
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleOpenEdit(client, e)}
                          title="Editar Cadastro"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 divide-y md:hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Carregando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </div>
          ) : (
            clients.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/clientes/${client.id}`)}
                className="p-4 space-y-2.5 active:bg-muted/50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{client.nome}</h3>
                    <p className="text-xs text-muted-foreground">
                      CPF: {formatCpf(client.cpf)}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowStatusToggle
                      isActive={client.status === 'ativo'}
                      onToggle={(nextActive) =>
                        handleToggleClientStatus(client, nextActive)
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {formatPhone(client.telefone)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {client._count?.attendances ?? 0} atendimentos
                  </span>
                  {client.emergencyContacts?.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {client.emergencyContacts.length} contato(s) emergência
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center justify-end gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleOpenEdit(client, e)}
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/clientes/${client.id}`)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Prontuário
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <CardContent className="flex items-center justify-between border-t py-3 px-4 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Total de <strong>{totalCount}</strong> paciente(s) • Página {page} de{' '}
              {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Create/Edit Client Dialog */}
      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clientToEdit={clientToEdit}
        onSuccess={() => {
          fetchClients();
        }}
      />
    </div>
  );
}
