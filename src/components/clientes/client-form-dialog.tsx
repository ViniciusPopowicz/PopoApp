'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { AppCombobox } from '@/components/ui/app-combobox';
import { isValidCpf } from '@/lib/cpf';
import {
  maskCPF,
  unmaskCPF,
  maskPhoneBR,
  unmaskPhoneBR,
  maskDateBR,
  dateBRToISO,
  isoToDateBR,
} from '@/lib/masks';
import { ClientSummaryDto, EmergencyContactDto } from '@/types/client';
import { Plus, Trash2, AlertCircle, UserPlus, Edit3, ShieldAlert, Camera, X } from 'lucide-react';

export interface ClientFormData {
  id?: string;
  nome: string;
  cpf: string;
  telefone: string;
  email?: string | null;
  dataNascimento?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
  status?: string;
  profilePhotoId?: string | null;
  profilePhotoUrl?: string | null;
  emergencyContacts?: EmergencyContactDto[];
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientToEdit?: ClientSummaryDto | ClientFormData | null;
  client?: ClientSummaryDto | ClientFormData | null;
  onSuccess: (savedClient?: any) => void;
}

interface EmergencyContactFormItem {
  id?: string;
  nome: string;
  telefone: string;
  parentesco: string;
  observacoes: string;
}

const PARENTESCO_OPTIONS = [
  { value: 'Cônjuge / Parceiro(a)', label: 'Cônjuge / Parceiro(a)' },
  { value: 'Mãe / Pai', label: 'Mãe / Pai' },
  { value: 'Filho(a)', label: 'Filho(a)' },
  { value: 'Irmão / Irmã', label: 'Irmão / Irmã' },
  { value: 'Familiar', label: 'Familiar' },
  { value: 'Amigo(a)', label: 'Amigo(a)' },
  { value: 'Outro', label: 'Outro' },
];

export function ClientFormDialog({
  open,
  onOpenChange,
  clientToEdit: clientToEditProp,
  client: clientProp,
  onSuccess,
}: ClientFormDialogProps) {
  const clientToEdit = clientToEditProp ?? clientProp ?? null;
  const isEditing = Boolean(clientToEdit?.id);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimentoMasked, setDataNascimentoMasked] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [contacts, setContacts] = useState<EmergencyContactFormItem[]>([]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setCpfError(null);
      setPhotoFile(null);

      if (clientToEdit) {
        setNome(clientToEdit.nome || '');
        setCpf(maskCPF(clientToEdit.cpf || ''));
        setTelefone(maskPhoneBR(clientToEdit.telefone || ''));
        setEmail(clientToEdit.email || '');
        setDataNascimentoMasked(
          clientToEdit.dataNascimento ? isoToDateBR(clientToEdit.dataNascimento) : ''
        );
        setEndereco(clientToEdit.endereco || '');
        setObservacoes(clientToEdit.observacoes || '');
        setPhotoPreviewUrl(clientToEdit.profilePhotoUrl || null);
        setContacts(
          (clientToEdit.emergencyContacts || []).map((c: EmergencyContactDto) => ({
            id: c.id,
            nome: c.nome,
            telefone: maskPhoneBR(c.telefone),
            parentesco: c.parentesco,
            observacoes: c.observacoes || '',
          }))
        );
      } else {
        setNome('');
        setCpf('');
        setTelefone('');
        setEmail('');
        setDataNascimentoMasked('');
        setEndereco('');
        setObservacoes('');
        setPhotoPreviewUrl(null);
        setContacts([]);
      }
    }
  }, [open, clientToEdit]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }
    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = maskCPF(e.target.value);
    setCpf(formatted);

    const rawDigits = unmaskCPF(formatted);
    if (rawDigits.length === 11) {
      if (!isValidCpf(rawDigits)) {
        setCpfError('CPF inválido (dígitos verificadores incorretos)');
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(maskPhoneBR(e.target.value));
  };

  const handleAddContact = () => {
    setContacts((prev) => [
      ...prev,
      { nome: '', telefone: '', parentesco: '', observacoes: '' },
    ]);
  };

  const handleRemoveContact = (index: number) => {
    setContacts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleContactFieldChange = (
    index: number,
    field: keyof EmergencyContactFormItem,
    value: string
  ) => {
    setContacts((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === 'telefone') {
          return { ...item, telefone: maskPhoneBR(value) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const rawCpf = unmaskCPF(cpf);
    if (!isValidCpf(rawCpf)) {
      setCpfError('Informe um CPF válido de 11 dígitos.');
      return;
    }

    const rawPhone = unmaskPhoneBR(telefone);
    if (rawPhone.length < 8) {
      setErrorMessage('Informe um telefone válido com DDD.');
      return;
    }

    let isoBirthDate: string | null = null;
    if (dataNascimentoMasked.trim()) {
      const converted = dateBRToISO(dataNascimentoMasked);
      if (!converted) {
        setErrorMessage('Data de nascimento inválida. Use o formato DD/MM/AAAA.');
        return;
      }
      isoBirthDate = converted;
    }

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (!c.nome.trim() || unmaskPhoneBR(c.telefone).length < 8 || !c.parentesco.trim()) {
        setErrorMessage(
          `Preencha Nome, Telefone e Parentesco do Contato de Emergência #${i + 1}.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      if (isEditing && clientToEdit) {
        const res = await fetch(`/api/clients/${clientToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nome.trim(),
            cpf: rawCpf,
            telefone: rawPhone,
            email: email.trim() || null,
            dataNascimento: isoBirthDate,
            endereco: endereco.trim() || null,
            observacoes: observacoes.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao atualizar cliente.');
        }

        const existingIds = new Set(
          (clientToEdit.emergencyContacts || [])
            .map((c: EmergencyContactDto) => c.id)
            .filter((id): id is string => Boolean(id))
        );
        const currentIds = new Set(contacts.filter((c) => c.id).map((c) => c.id!));

        for (const oldId of Array.from(existingIds)) {
          if (!currentIds.has(oldId)) {
            await fetch(
              `/api/clients/${clientToEdit.id}/contacts/${oldId}`,
              { method: 'DELETE' }
            );
          }
        }

        for (const contact of contacts) {
          const contactPayload = {
            nome: contact.nome.trim(),
            telefone: unmaskPhoneBR(contact.telefone),
            parentesco: contact.parentesco.trim(),
            observacoes: contact.observacoes.trim() || null,
          };

          if (contact.id) {
            await fetch(
              `/api/clients/${clientToEdit.id}/contacts/${contact.id}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactPayload),
              }
            );
          } else {
            await fetch(`/api/clients/${clientToEdit.id}/contacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(contactPayload),
            });
          }
        }

        if (photoFile && clientToEdit.id) {
          const formData = new FormData();
          formData.append('file', photoFile);
          await fetch(`/api/clients/${clientToEdit.id}/photo`, {
            method: 'POST',
            body: formData,
          });
        }

        const refreshedRes = await fetch(`/api/clients/${clientToEdit.id}`);
        const refreshedJson = await refreshedRes.json();

        onSuccess(refreshedJson.data || data.data);
        onOpenChange(false);
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nome.trim(),
            cpf: rawCpf,
            telefone: rawPhone,
            email: email.trim() || null,
            dataNascimento: isoBirthDate,
            endereco: endereco.trim() || null,
            observacoes: observacoes.trim() || null,
            status: 'ativo',
            emergencyContacts: contacts.map((c) => ({
              nome: c.nome.trim(),
              telefone: unmaskPhoneBR(c.telefone),
              parentesco: c.parentesco.trim(),
              observacoes: c.observacoes.trim() || null,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao cadastrar cliente.');
        }

        let createdClient = data.data;

        if (photoFile && createdClient?.id) {
          const formData = new FormData();
          formData.append('file', photoFile);
          await fetch(`/api/clients/${createdClient.id}/photo`, {
            method: 'POST',
            body: formData,
          });

          const refreshedRes = await fetch(`/api/clients/${createdClient.id}`);
          const refreshedJson = await refreshedRes.json();
          if (refreshedJson.success && refreshedJson.data) {
            createdClient = refreshedJson.data;
          }
        }

        onSuccess(createdClient);
        onOpenChange(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isEditing ? (
              <>
                <Edit3 className="h-5 w-5 text-primary" />
                Editar Cliente
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                Novo Cliente
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados cadastrais, observações clínicas e contatos de emergência.'
              : 'Cadastre um novo paciente com validação de CPF e contatos de emergência.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Foto de Perfil do Paciente */}
          <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
            <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
              {photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreviewUrl}
                  alt="Foto do paciente"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-6 w-6 text-primary/60" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-sm font-medium">Foto de Identificação do Paciente</Label>
              <p className="text-xs text-muted-foreground">
                Exibida na agenda, prontuário e ficha de atendimento (JPG, PNG ou WEBP).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {photoPreviewUrl ? 'Alterar Foto' : 'Selecionar Foto'}
                </Button>
                {photoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreviewUrl(clientToEdit?.profilePhotoUrl || null);
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Desfazer
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-nome">Nome Completo *</Label>
              <Input
                id="client-nome"
                placeholder="Ex: Maria Fernanda Oliveira"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-cpf">CPF *</Label>
              <Input
                id="client-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCpfChange}
                maxLength={14}
                required
                className={cpfError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {cpfError && (
                <p className="text-xs text-destructive font-medium">{cpfError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-telefone">Telefone / WhatsApp *</Label>
              <Input
                id="client-telefone"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={handlePhoneChange}
                maxLength={15}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email">E-mail</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="paciente@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-nascimento">Data de Nascimento</Label>
              <DatePicker
                id="client-nascimento"
                placeholder="DD/MM/AAAA"
                value={dataNascimentoMasked}
                onChange={setDataNascimentoMasked}
                maxDate={new Date()}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-endereco">Endereço Completo</Label>
              <Input
                id="client-endereco"
                placeholder="Rua, Número, Complemento, Bairro, Cidade - UF"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="client-observacoes">
                Observações Gerais / Anotações Clínicas Iniciais
              </Label>
              <textarea
                id="client-observacoes"
                rows={3}
                placeholder="Alergias conhecidas, restrições médicas, preferências de horário..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          {/* Contatos de Emergência */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-semibold">Contatos de Emergência</h4>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddContact}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Contato
              </Button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum contato de emergência cadastrado para este cliente.
              </p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className="rounded-lg border bg-muted/30 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Contato #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveContact(idx)}
                        className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remover
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome *</Label>
                        <Input
                          placeholder="Nome do contato"
                          value={contact.nome}
                          onChange={(e) =>
                            handleContactFieldChange(idx, 'nome', e.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Telefone *</Label>
                        <Input
                          inputMode="numeric"
                          placeholder="(11) 99999-9999"
                          value={contact.telefone}
                          onChange={(e) =>
                            handleContactFieldChange(idx, 'telefone', e.target.value)
                          }
                          maxLength={15}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Parentesco / Relação *</Label>
                        <AppCombobox
                          options={PARENTESCO_OPTIONS}
                          value={contact.parentesco}
                          onChange={(val) =>
                            handleContactFieldChange(idx, 'parentesco', val)
                          }
                          placeholder="Ex: Cônjuge, Mãe..."
                          creatable
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || Boolean(cpfError)}>
              {submitting
                ? 'Salvando...'
                : isEditing
                ? 'Salvar Alterações'
                : 'Cadastrar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
