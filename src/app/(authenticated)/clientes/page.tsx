'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Users, Eye, Pencil, Power, Phone, Mail, FileText, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { formatCpf, normalizeCpf } from '@/lib/cpf';
import { ClientFormDialog, ClientFormData } from '@/components/clientes/client-form-dialog';

interface ClientItem {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  dataNascimento: string | null;
  endereco: string | null;
  observacoes: string | null;
  status: 'ativo' | 'inativo';
  profilePhotoId: string | null;
  createdAt: string;
  updatedAt: string;
  emergencyContacts?: Array<{
    id: string;
    nome: string;
    telefone: string;
    parentesco: string;
    observacoes?: string | null;
    isActive: boolean;
  }>;
  _count?: {
    appointments: number;
    attendances: number;
    attachments: number;
  };
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<ClientFormData | null>(null);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (statusFilter !== 'todos') {
        params.set('status', statusFilter);
      } else {
        params.set('status', 'todos');
      }
      params.set('limit', '100');

      const res = await fetch(`/api/clients?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao carregar lista de clientes');
      }

      setClients(json.items || []);
    } catch (err: any) {
      console.error('Erro ao buscar clientes:', err);
      setError(err.message || 'Erro ao carregar clientes do servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  // Client-side fuzzy filter for normalized CPF and Name in real-time
  const filteredClients = clients.filter((client) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const cleanTermDigits = normalizeCpf(term);
    const matchesName = client.nome.toLowerCase().includes(term);
    const matchesEmail = client.email ? client.email.toLowerCase().includes(term) : false;
    const matchesPhone = client.telefone.includes(term);
    const matchesCpf = cleanTermDigits
      ? client.cpf.includes(cleanTermDigits)
      : client.cpf.includes(term);

    return matchesName || matchesEmail || matchesPhone || matchesCpf;
  });

  async function handleToggleStatus(client: ClientItem) {
    const nextStatus = client.status === 'ativo' ? 'inativo' : 'ativo';
    const confirmMessage =
      client.status === 'ativo'
        ? `Deseja inativar o cliente "${client.nome}"? O histórico clínico e financeiro será preservado.`
        : `Deseja reativar o cliente "${client.nome}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: nextStatus === 'inativo' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(nextStatus === 'ativo' ? { body: JSON.stringify({ status: 'ativo' }) } : {}),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao alterar status do cliente');
      }

      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Não foi possível alterar o status.');
    }
  }

  function handleOpenCreate() {
    setSelectedClientForEdit(null);
    setIsFormDialogOpen(true);
  }

  function handleOpenEdit(client: ClientItem) {
    setSelectedClientForEdit({
      id: client.id,
      nome: client.nome,
      cpf: client.cpf,
      telefone: client.telefone,
      email: client.email,
      dataNascimento: client.dataNascimento,
      endereco: client.endereco,
      observacoes: client.observacoes,
      status: client.status,
      profilePhotoId: client.profilePhotoId,
      emergencyContacts: client.emergencyContacts,
    });
    setIsFormDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie os pacientes cadastrados, dados de contato e prontuários clínicos."
      >
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por nome ou CPF..."
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={statusFilter === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('todos')}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'ativo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('ativo')}
          >
            Ativos
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'inativo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('inativo')}
          >
            Inativos
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Carregando pacientes...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={
            searchTerm
              ? 'Nenhum paciente corresponde aos critérios de busca por nome ou CPF.'
              : 'Você ainda não possui clientes cadastrados no sistema.'
          }
          actionLabel={!searchTerm ? 'Cadastrar Primeiro Cliente' : undefined}
          onAction={!searchTerm ? handleOpenCreate : undefined}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Contatos Emergência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const initial = client.nome ? client.nome.charAt(0).toUpperCase() : '?';
                  const contactsCount = client.emergencyContacts?.length || 0;

                  return (
                    <TableRow key={client.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          {client.profilePhotoId ? (
                            <AvatarImage
                              src={`/api/attachments/${client.profilePhotoId}`}
                              alt={client.nome}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          <Link
                            href={`/clientes/${client.id}`}
                            className="hover:underline text-primary font-semibold"
                          >
                            {client.nome}
                          </Link>
                        </div>
                        {client.dataNascimento && (
                          <span className="text-xs text-muted-foreground">
                            Nasc: {formatDate(new Date(client.dataNascimento))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {formatCpf(client.cpf)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{client.telefone}</div>
                        {client.email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {client.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {contactsCount > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {contactsCount} contato(s)
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={client.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/clientes/${client.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver Prontuário e Histórico Clínico"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(client)}
                            title="Editar Dados Cadastrais"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(client)}
                            title={client.status === 'ativo' ? 'Inativar Paciente' : 'Reativar Paciente'}
                            className={
                              client.status === 'ativo'
                                ? 'text-muted-foreground hover:text-destructive'
                                : 'text-primary hover:text-primary'
                            }
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredClients.map((client) => {
              const initial = client.nome ? client.nome.charAt(0).toUpperCase() : '?';

              return (
                <Card key={client.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          {client.profilePhotoId ? (
                            <AvatarImage
                              src={`/api/attachments/${client.profilePhotoId}`}
                              alt={client.nome}
                            />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/clientes/${client.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {client.nome}
                          </Link>
                          <p className="text-xs font-mono text-muted-foreground">
                            CPF: {formatCpf(client.cpf)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={client.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{client.telefone}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {client.emergencyContacts && client.emergencyContacts.length > 0
                          ? `${client.emergencyContacts.length} contato(s) emergência`
                          : 'Sem contato emergência'}
                      </span>
                      <div className="flex gap-1">
                        <Link href={`/clientes/${client.id}`}>
                          <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Detalhes
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleOpenEdit(client)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleToggleStatus(client)}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Create / Edit Client Dialog */}
      <ClientFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        client={selectedClientForEdit}
        onSuccess={fetchClients}
      />
    </div>
  );
}
