'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Download,
  ExternalLink,
  FileText,
  Package,
  Activity,
  DollarSign,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { formatCpf } from '@/lib/cpf';
import { ClientFormDialog, ClientFormData } from '@/components/clientes/client-form-dialog';

interface ClientWorkspaceProps {
  clientId: string;
}

export function ClientWorkspace({ clientId }: ClientWorkspaceProps) {
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // File upload state for Attachments tab
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('outro');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile photo upload ref
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  // Emergency contact quick add
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactNome, setNewContactNome] = useState('');
  const [newContactTelefone, setNewContactTelefone] = useState('');
  const [newContactParentesco, setNewContactParentesco] = useState('');
  const [newContactObs, setNewContactObs] = useState('');

  const fetchClientData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}?history=true`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao carregar dados do paciente');
      }
      setClient(json.data);
    } catch (err: any) {
      console.error('Erro ao buscar cliente:', err);
      setError(err.message || 'Erro ao carregar prontuário do cliente.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Profile photo upload handler
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    setIsUpdatingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/clients/${clientId}/photo`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar foto de perfil');
      }

      await fetchClientData();
    } catch (err: any) {
      alert(err.message || 'Erro ao fazer upload da foto');
    } finally {
      setIsUpdatingPhoto(false);
    }
  }

  // Quick emergency contact addition
  async function handleAddEmergencyContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContactNome.trim() || !newContactTelefone.trim() || !newContactParentesco.trim()) {
      alert('Preencha nome, telefone e parentesco.');
      return;
    }

    try {
      const res = await fetch(`/api/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: newContactNome.trim(),
          telefone: newContactTelefone.trim(),
          parentesco: newContactParentesco.trim(),
          observacoes: newContactObs.trim() || null,
          isActive: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao adicionar contato');
      }

      setNewContactNome('');
      setNewContactTelefone('');
      setNewContactParentesco('');
      setNewContactObs('');
      setIsAddingContact(false);
      fetchClientData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar contato de emergência.');
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!window.confirm('Deseja remover este contato de emergência?')) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao excluir contato');
      }
      fetchClientData();
    } catch (err: any) {
      alert(err.message || 'Falha ao remover contato');
    }
  }

  // Attachment upload handler
  async function handleAttachmentUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Selecione um arquivo para enviar.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('clientId', clientId);
      formData.append('categoria', uploadCategory);

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao enviar anexo.');
      }

      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchClientData();
    } catch (err: any) {
      setUploadError(err.message || 'Falha no envio do anexo.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este documento?')) return;
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao remover anexo');
      }
      fetchClientData();
    } catch (err: any) {
      alert(err.message || 'Falha ao excluir documento');
    }
  }

  if (isLoading) {
    return (
      <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-medium">Carregando prontuário e histórico clínico...</span>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-4">
        <PageHeader title="Prontuário do Paciente" description="Detalhes clínicos do cliente" />
        <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive flex items-center gap-3">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">Não foi possível carregar o paciente</p>
            <p className="text-sm">{error || 'Cliente não encontrado no sistema.'}</p>
          </div>
        </div>
        <Link href="/clientes">
          <Button variant="outline">Voltar para Lista de Clientes</Button>
        </Link>
      </div>
    );
  }

  // Derived financial computations across attendances
  const attendances = client.attendances || [];
  const appointments = client.appointments || [];
  const emergencyContacts = client.emergencyContacts || [];
  const attachments = client.attachments || [];
  const stockUnits = client.stockUnits || [];

  // Flatten all product usages across attendances
  const productUsages: any[] = [];
  attendances.forEach((att: any) => {
    if (att.productUsages && att.productUsages.length > 0) {
      att.productUsages.forEach((u: any) => {
        productUsages.push({
          ...u,
          attendanceDate: att.dataHora,
          attendanceId: att.id,
        });
      });
    }
  });

  // Calculate overall financial metrics
  let totalPracticed = 0;
  let totalDiscounts = 0;
  let totalPaid = 0;

  attendances.forEach((att: any) => {
    if (att.status !== 'Cancelado') {
      const practicedSum = (att.procedures || []).reduce(
        (sum: number, proc: any) => sum + Number(proc.valorPraticado || 0),
        0
      );
      const discount = Number(att.desconto || 0);
      totalPracticed += practicedSum;
      totalDiscounts += discount;

      const paymentsSum = (att.payments || []).reduce(
        (sum: number, pay: any) => sum + Number(pay.valor || 0),
        0
      );
      totalPaid += paymentsSum;
    }
  });

  const netTotal = Math.max(0, totalPracticed - totalDiscounts);
  const outstandingBalance = Math.max(0, netTotal - totalPaid);

  const initial = client.nome ? client.nome.charAt(0).toUpperCase() : '?';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
              {client.profilePhotoId ? (
                <AvatarImage
                  src={`/api/attachments/${client.profilePhotoId}`}
                  alt={client.nome}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {initial}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={photoInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUpdatingPhoto}
              title="Trocar Foto de Perfil"
              className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1 rounded-full shadow hover:bg-primary/90 transition-opacity"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {client.nome}
              </h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              CPF: {formatCpf(client.cpf)} • Tel: {client.telefone}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Editar Dados
          </Button>
          <Link href="/clientes">
            <Button variant="ghost" size="sm">
              Voltar
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Tabs Workspace */}
      <Tabs defaultValue="cadastro" className="w-full space-y-6">
        <TabsList className="w-full flex flex-wrap justify-start border-b rounded-none h-auto p-0 bg-transparent gap-1">
          <TabsTrigger
            value="cadastro"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <User className="h-4 w-4 mr-2" />
            Dados & Emergência
          </TabsTrigger>
          <TabsTrigger
            value="agendamentos"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Agendamentos ({appointments.length})
          </TabsTrigger>
          <TabsTrigger
            value="atendimentos"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <Activity className="h-4 w-4 mr-2" />
            Atendimentos ({attendances.length})
          </TabsTrigger>
          <TabsTrigger
            value="produtos"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Produtos & Lotes ({productUsages.length})
          </TabsTrigger>
          <TabsTrigger
            value="prontuarios"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Prontuários
          </TabsTrigger>
          <TabsTrigger
            value="financeiro"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger
            value="anexos"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            Documentos & Anexos ({attachments.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Dados Cadastrais & Contatos de Emergência */}
        <TabsContent value="cadastro" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Dados Pessoais</CardTitle>
                <CardDescription>Informações básicas de identificação e contato</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground block">CPF</span>
                    <span className="font-mono font-medium">{formatCpf(client.cpf)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Status</span>
                    <StatusBadge status={client.status} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Telefone</span>
                    <span className="font-medium">{client.telefone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">E-mail</span>
                    <span className="font-medium">{client.email || 'Não informado'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Data de Nascimento</span>
                    <span className="font-medium">
                      {client.dataNascimento
                        ? formatDate(new Date(client.dataNascimento))
                        : 'Não informada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Data de Cadastro</span>
                    <span className="font-medium">{formatDate(new Date(client.createdAt))}</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <span className="text-xs text-muted-foreground block mb-1">Endereço</span>
                  <div className="flex items-start gap-1.5 text-foreground">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{client.endereco || 'Endereço não cadastrado'}</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <span className="text-xs text-muted-foreground block mb-1">Observações Clínicas / Alergias</span>
                  <p className="text-muted-foreground bg-muted/30 p-2.5 rounded text-xs whitespace-pre-wrap">
                    {client.observacoes || 'Nenhuma observação ou restrição registrada.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contacts Card */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Contatos de Emergência (1:N)</CardTitle>
                  <CardDescription>Pessoas autorizadas para comunicação emergencial</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingContact(!isAddingContact)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {isAddingContact ? 'Fechar' : 'Novo'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAddingContact && (
                  <form onSubmit={handleAddEmergencyContact} className="p-3 border rounded-lg bg-muted/40 space-y-3">
                    <div className="font-medium text-xs text-foreground">Adicionar Novo Contato</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome do contato *"
                        value={newContactNome}
                        onChange={(e) => setNewContactNome(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Input
                        placeholder="Telefone *"
                        value={newContactTelefone}
                        onChange={(e) => setNewContactTelefone(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Input
                        placeholder="Parentesco (Ex: Cônjuge) *"
                        value={newContactParentesco}
                        onChange={(e) => setNewContactParentesco(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                      <Input
                        placeholder="Observações (opcional)"
                        value={newContactObs}
                        onChange={(e) => setNewContactObs(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setIsAddingContact(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" className="h-7 text-xs">
                        Salvar Contato
                      </Button>
                    </div>
                  </form>
                )}

                {emergencyContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-6 text-center">
                    Nenhum contato de emergência registrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {emergencyContacts.map((contact: any) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/20 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{contact.nome}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {contact.parentesco}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground font-mono">{contact.telefone}</p>
                          {contact.observacoes && (
                            <p className="text-[11px] text-muted-foreground italic">
                              Obs: {contact.observacoes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteContact(contact.id)}
                          title="Remover contato"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: Histórico de Agendamentos (Appointments) */}
        <TabsContent value="agendamentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Histórico de Agendamentos</CardTitle>
              <CardDescription>
                Registro de todas as datas reservadas, confirmadas ou reagendadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Nenhum agendamento encontrado"
                  description="Este paciente ainda não possui histórico de agendamentos no calendário."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data e Horário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Procedimentos Planejados</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.map((appt: any) => (
                        <TableRow key={appt.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDateTime(new Date(appt.dataHora))}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={appt.status} />
                          </TableCell>
                          <TableCell>
                            {appt.plannedProcedures && appt.plannedProcedures.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {appt.plannedProcedures.map((pp: any) => (
                                  <Badge key={pp.id} variant="outline" className="text-xs">
                                    {pp.procedure?.nome || 'Procedimento'}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                Nenhum procedimento planejado
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {appt.observacoes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Histórico de Atendimentos & Procedimentos Realizados */}
        <TabsContent value="atendimentos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Atendimentos & Procedimentos Realizados
              </CardTitle>
              <CardDescription>
                Encontros clínicos efetivamente realizados, com discriminação de valores praticados e descontos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Nenhum atendimento realizado"
                  description="Não há registros de sessões clínicas para este paciente."
                />
              ) : (
                <div className="space-y-4">
                  {attendances.map((att: any) => {
                    const procedures = att.procedures || [];
                    const attPracticedTotal = procedures.reduce(
                      (s: number, p: any) => s + Number(p.valorPraticado || 0),
                      0
                    );
                    const discount = Number(att.desconto || 0);
                    const attNetTotal = Math.max(0, attPracticedTotal - discount);

                    return (
                      <div
                        key={att.id}
                        className="border rounded-lg p-4 bg-card hover:bg-muted/10 transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">
                              Atendimento em {formatDateTime(new Date(att.dataHora))}
                            </span>
                            <StatusBadge status={att.status} />
                          </div>
                          <div className="text-sm font-medium">
                            Total Líquido:{' '}
                            <span className="text-primary font-bold">
                              {formatCurrency(attNetTotal)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">
                            Procedimentos Realizados ({procedures.length})
                          </span>
                          {procedures.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              Nenhum procedimento associado a este atendimento.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {procedures.map((proc: any) => (
                                <div
                                  key={proc.id}
                                  className="p-2 border rounded bg-muted/30 text-xs flex justify-between items-center"
                                >
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {proc.procedure?.nome || 'Procedimento'}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground">
                                      Padrão: {formatCurrency(Number(proc.valorPadraoMomento || 0))}
                                    </span>
                                  </div>
                                  <div className="font-bold text-foreground">
                                    {formatCurrency(Number(proc.valorPraticado || 0))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {discount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Desconto explícito aplicado:{' '}
                            <span className="font-semibold text-destructive">
                              -{formatCurrency(discount)}
                            </span>
                          </div>
                        )}

                        {att.medicalRecord && (
                          <div className="pt-2 border-t text-xs">
                            <span className="font-semibold text-foreground block mb-0.5">
                              Prontuário Clínico:
                            </span>
                            <p className="text-muted-foreground bg-muted/20 p-2 rounded line-clamp-2">
                              {att.medicalRecord.observacoes || 'Sem anotações complementares.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Produtos Utilizados & Rastreabilidade de Lotes */}
        <TabsContent value="produtos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Produtos Utilizados & Rastreabilidade de Lotes (§14–§17, §44)
              </CardTitle>
              <CardDescription>
                Rastreabilidade de cada unidade física aplicada, com número de lote e código serial individual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productUsages.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Nenhum produto utilizado"
                  description="Nenhuma unidade de estoque foi consumida em procedimentos deste cliente."
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data do Uso</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Código Serial (StockUnit)</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead>Status da Unidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productUsages.map((usage: any) => {
                        const unit = usage.stockUnit;
                        const lot = unit?.lot;
                        const product = lot?.product;

                        return (
                          <TableRow key={usage.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {formatDate(new Date(usage.dataHora || usage.attendanceDate))}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold">{product?.nome || 'Produto'}</div>
                              <div className="text-xs text-muted-foreground">{product?.marca || '-'}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {lot?.numeroLote || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {unit?.codigoSerial || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={product?.isReusable ? 'default' : 'outline'} className="text-xs">
                                {product?.isReusable ? 'Reutilizável' : 'Uso Único'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={unit?.status || 'Disponivel'} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reusable Stock Units Currently Assigned */}
          {stockUnits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Unidades Reutilizáveis Vinculadas a este Paciente
                </CardTitle>
                <CardDescription>
                  Unidades de estoque em regime de uso exclusivo deste paciente (V16 / V17).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {stockUnits.map((unit: any) => (
                    <div key={unit.id} className="p-3 border rounded-lg bg-card space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs text-foreground">
                          {unit.lot?.product?.nome || 'Produto'}
                        </span>
                        <StatusBadge status={unit.status} />
                      </div>
                      <p className="text-xs font-mono text-primary font-bold">
                        Serial: {unit.codigoSerial}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Lote: {unit.lot?.numeroLote}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 5: Prontuários (Medical Records) */}
        <TabsContent value="prontuarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Prontuários Clínicos</CardTitle>
              <CardDescription>
                Registro de evolução clínica, anamnese e condutas pós-procedimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances.filter((att: any) => att.medicalRecord).length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Nenhum prontuário registrado"
                  description="Os prontuários clínicos são gerados durante a realização dos atendimentos."
                />
              ) : (
                <div className="space-y-4">
                  {attendances
                    .filter((att: any) => att.medicalRecord)
                    .map((att: any) => {
                      const record = att.medicalRecord;
                      return (
                        <div key={record.id} className="border rounded-lg p-4 bg-card space-y-3">
                          <div className="flex justify-between items-center border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                Sessão de {formatDateTime(new Date(att.dataHora))}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {att.procedures?.map((p: any) => p.procedure?.nome).join(', ') ||
                                  'Procedimento'}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                              Prontuário #{record.id.slice(0, 8)}
                            </span>
                          </div>

                          <div className="text-xs space-y-2">
                            {record.observacoes && (
                              <div>
                                <span className="font-semibold text-muted-foreground block">
                                  Evolução Clínica / Anotações:
                                </span>
                                <p className="text-foreground bg-muted/20 p-2.5 rounded whitespace-pre-wrap">
                                  {record.observacoes}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: Histórico Financeiro & Pagamentos */}
        <TabsContent value="financeiro" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground">Total Praticado</span>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(totalPracticed)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground">Descontos Concedidos</span>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(totalDiscounts)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground">Total Pago</span>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(totalPaid)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <span className="text-xs text-muted-foreground">Saldo Devedor</span>
                <p
                  className={`text-xl font-bold ${
                    outstandingBalance > 0 ? 'text-amber-600' : 'text-muted-foreground'
                  }`}
                >
                  {formatCurrency(outstandingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Registro de Pagamentos</CardTitle>
              <CardDescription>
                Histórico detalhado das liquidações financeiras por atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const allPayments: any[] = [];
                attendances.forEach((att: any) => {
                  (att.payments || []).forEach((pay: any) => {
                    allPayments.push({
                      ...pay,
                      attendanceDate: att.dataHora,
                      attendanceId: att.id,
                    });
                  });
                });

                if (allPayments.length === 0) {
                  return (
                    <EmptyState
                      icon={DollarSign}
                      title="Nenhum pagamento registrado"
                      description="Não constam pagamentos efetuados para este paciente."
                    />
                  );
                }

                return (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Atendimento</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Parcelas</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allPayments.map((pay: any) => (
                          <TableRow key={pay.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {formatDate(new Date(pay.createdAt || pay.dataHora))}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(new Date(pay.attendanceDate))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {pay.metodo || 'Dinheiro'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {pay.parcelas && pay.parcelas > 1 ? `${pay.parcelas}x` : 'À vista'}
                            </TableCell>
                            <TableCell className="font-semibold text-emerald-600">
                              {formatCurrency(Number(pay.valor || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-emerald-600 text-xs">
                                Confirmado
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: Documentos & Anexos (file upload & streaming) */}
        <TabsContent value="anexos" className="space-y-6">
          {/* Upload widget */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Adicionar Novo Documento / Anexo</CardTitle>
              <CardDescription>
                Envio seguro com validação de tipo e armazenamento isolado fora da raiz pública.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAttachmentUpload} className="space-y-4">
                {uploadError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20">
                    {uploadError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <Label htmlFor="anexo-file" className="text-xs">
                      Arquivo (PDF, JPG, PNG, DOCX - máx 10MB)
                    </Label>
                    <Input
                      id="anexo-file"
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="text-xs h-9 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="anexo-categoria" className="text-xs">
                      Categoria do Documento
                    </Label>
                    <Select value={uploadCategory} onValueChange={setUploadCategory}>
                      <SelectTrigger id="anexo-categoria" className="h-9 text-xs">
                        <SelectValue placeholder="Selecione categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="termo_consentimento">Termo de Consentimento</SelectItem>
                        <SelectItem value="exame">Exame Clínico / Laboratorial</SelectItem>
                        <SelectItem value="foto_antes_depois">Foto Antes / Depois</SelectItem>
                        <SelectItem value="documento_pessoal">Documento de Identificação</SelectItem>
                        <SelectItem value="outro">Outro Documento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={isUploading || !uploadFile}>
                    <Upload className="h-4 w-4 mr-1.5" />
                    {isUploading ? 'Enviando documento...' : 'Enviar Anexo'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Attachments List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Documentos Armazenados</CardTitle>
              <CardDescription>
                Arquivos vinculados diretamente a este cliente disponíveis para visualização e download autenticado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <EmptyState
                  icon={Paperclip}
                  title="Nenhum anexo encontrado"
                  description="Nenhum documento ou imagem foi anexado a este paciente até o momento."
                />
              ) : (
                <div className="space-y-3">
                  {attachments.map((att: any) => {
                    const sizeKb = (Number(att.tamanhoBytes || 0) / 1024).toFixed(1);
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded text-primary">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">
                              {att.nomeOriginal}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {att.categoria ? `Categoria: ${att.categoria} • ` : ''}
                              {sizeKb} KB • Enviado em {formatDate(new Date(att.createdAt))}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Visualizar
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteAttachment(att.id)}
                            title="Excluir arquivo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Client Modal */}
      <ClientFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        client={{
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
        }}
        onSuccess={fetchClientData}
      />
    </div>
  );
}
