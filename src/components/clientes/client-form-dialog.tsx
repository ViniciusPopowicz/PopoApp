'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { isValidCpf, formatCpf, normalizeCpf } from '@/lib/cpf';
import { Plus, Trash2, Upload, User, AlertCircle } from 'lucide-react';

export interface EmergencyContactItem {
  id?: string;
  nome: string;
  telefone: string;
  parentesco: string;
  observacoes?: string | null;
  isActive?: boolean;
}

export interface ClientFormData {
  id?: string;
  nome: string;
  cpf: string;
  telefone: string;
  email?: string | null;
  dataNascimento?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
  status: 'ativo' | 'inativo';
  profilePhotoId?: string | null;
  emergencyContacts?: EmergencyContactItem[];
}

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientFormData | null;
  onSuccess: () => void;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientFormDialogProps) {
  const isEditing = Boolean(client?.id);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([]);
  
  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation & Loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setNome(client.nome || '');
      setCpf(client.cpf ? formatCpf(client.cpf) : '');
      setTelefone(client.telefone || '');
      setEmail(client.email || '');
      setDataNascimento(
        client.dataNascimento
          ? new Date(client.dataNascimento).toISOString().split('T')[0]
          : ''
      );
      setEndereco(client.endereco || '');
      setObservacoes(client.observacoes || '');
      setStatus(client.status || 'ativo');
      setEmergencyContacts(
        client.emergencyContacts && client.emergencyContacts.length > 0
          ? client.emergencyContacts.map((c) => ({ ...c }))
          : []
      );
      if (client.profilePhotoId) {
        setPhotoPreview(`/api/attachments/${client.profilePhotoId}`);
      } else {
        setPhotoPreview(null);
      }
    } else {
      setNome('');
      setCpf('');
      setTelefone('');
      setEmail('');
      setDataNascimento('');
      setEndereco('');
      setObservacoes('');
      setStatus('ativo');
      setEmergencyContacts([]);
      setPhotoPreview(null);
    }
    setPhotoFile(null);
    setErrorMessage(null);
    setCpfError(null);
  }, [client, open]);

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const digits = normalizeCpf(raw).slice(0, 11);
    let masked = digits;
    if (digits.length > 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    } else if (digits.length > 6) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 3) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }
    setCpf(masked);

    if (digits.length === 11) {
      if (!isValidCpf(digits)) {
        setCpfError('CPF inválido. Verifique os dígitos verificadores.');
      } else {
        setCpfError(null);
      }
    } else if (digits.length > 0) {
      setCpfError('CPF deve conter 11 dígitos.');
    } else {
      setCpfError(null);
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function addEmergencyContact() {
    setEmergencyContacts((prev) => [
      ...prev,
      { nome: '', telefone: '', parentesco: '', observacoes: '', isActive: true },
    ]);
  }

  function updateContact(index: number, field: keyof EmergencyContactItem, value: any) {
    setEmergencyContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function removeContact(index: number) {
    setEmergencyContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Validate name
    if (!nome.trim() || nome.trim().length < 2) {
      setErrorMessage('O nome deve ter pelo menos 2 caracteres.');
      return;
    }

    // Validate CPF
    const rawCpf = normalizeCpf(cpf);
    if (!rawCpf || !isValidCpf(rawCpf)) {
      setCpfError('CPF obrigatório e válido (11 dígitos com checksum correto).');
      setErrorMessage('Por favor, informe um CPF válido.');
      return;
    }

    // Validate phone
    if (!telefone.trim() || telefone.trim().length < 8) {
      setErrorMessage('O telefone deve ter pelo menos 8 dígitos.');
      return;
    }

    // Validate emergency contacts
    for (let i = 0; i < emergencyContacts.length; i++) {
      const c = emergencyContacts[i];
      if (!c.nome.trim()) {
        setErrorMessage(`Contato de emergência #${i + 1}: Informe o nome.`);
        return;
      }
      if (!c.telefone.trim() || c.telefone.trim().length < 8) {
        setErrorMessage(`Contato de emergência #${i + 1}: Informe um telefone válido.`);
        return;
      }
      if (!c.parentesco.trim()) {
        setErrorMessage(`Contato de emergência #${i + 1}: Informe o parentesco.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        nome: nome.trim(),
        cpf: rawCpf,
        telefone: telefone.trim(),
        email: email.trim() || null,
        dataNascimento: dataNascimento ? dataNascimento : null,
        endereco: endereco.trim() || null,
        observacoes: observacoes.trim() || null,
        status,
      };

      let savedClientId = client?.id;

      if (isEditing && savedClientId) {
        // Update client
        const res = await fetch(`/api/clients/${savedClientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Erro ao atualizar cliente.');
        }

        // Synchronize emergency contacts if changed
        // Fetch current contacts or create new ones
        for (const contact of emergencyContacts) {
          if (!contact.id) {
            await fetch(`/api/clients/${savedClientId}/contacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome: contact.nome.trim(),
                telefone: contact.telefone.trim(),
                parentesco: contact.parentesco.trim(),
                observacoes: contact.observacoes?.trim() || null,
                isActive: contact.isActive !== false,
              }),
            });
          }
        }
      } else {
        // Create client with emergency contacts
        payload.emergencyContacts = emergencyContacts.map((c) => ({
          nome: c.nome.trim(),
          telefone: c.telefone.trim(),
          parentesco: c.parentesco.trim(),
          observacoes: c.observacoes?.trim() || null,
          isActive: c.isActive !== false,
        }));

        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Erro ao criar cliente.');
        }

        savedClientId = json.data?.id;
      }

      // If a new photo was selected, upload it
      if (photoFile && savedClientId) {
        const formData = new FormData();
        formData.append('file', photoFile);

        const photoRes = await fetch(`/api/clients/${savedClientId}/photo`, {
          method: 'POST',
          body: formData,
        });

        if (!photoRes.ok) {
          const photoJson = await photoRes.json();
          console.warn('Erro ao atualizar foto:', photoJson.error);
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocorreu um erro ao salvar o cliente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados cadastrais e contatos de emergência do paciente.'
              : 'Preencha as informações cadastrais e contatos de emergência do novo paciente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Profile Photo & Basic Data */}
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-2 self-center sm:self-start">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden bg-muted relative">
                {photoPreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photoPreview}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {photoPreview ? 'Trocar Foto' : 'Adicionar Foto'}
              </Button>
            </div>

            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="nome">
                  Nome Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Maria da Silva"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cpf">
                  CPF <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  required
                />
                {cpfError && (
                  <p className="text-xs text-destructive">{cpfError}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="telefone">
                  Telefone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@exemplo.com"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="endereco">Endereço Completo</Label>
              <Input
                id="endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, complemento, bairro, cidade - UF"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="observacoes">Observações Gerais / Alergias</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações clínicas relevantes, restrições, etc."
                rows={2}
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between p-3 border rounded-lg bg-card">
              <div>
                <Label className="font-medium">Status do Paciente</Label>
                <p className="text-xs text-muted-foreground">
                  Pacientes inativos não aparecem na agenda diária, mas mantêm todo o histórico clínico.
                </p>
              </div>
              <Button
                type="button"
                variant={status === 'ativo' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setStatus(status === 'ativo' ? 'inativo' : 'ativo')}
              >
                {status === 'ativo' ? 'Ativo' : 'Inativo'}
              </Button>
            </div>
          </div>

          {/* Emergency Contacts Section (1:N) */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm">Contatos de Emergência (1:N)</h4>
                <p className="text-xs text-muted-foreground">
                  Pessoas para contato em caso de intercorrência ou emergência médica.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEmergencyContact}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Contato
              </Button>
            </div>

            {emergencyContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded text-center">
                Nenhum contato de emergência cadastrado. Clique no botão acima para adicionar.
              </p>
            ) : (
              <div className="space-y-3">
                {emergencyContacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-lg bg-muted/20 relative space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Contato #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => removeContact(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Nome do Contato <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={contact.nome}
                          onChange={(e) => updateContact(idx, 'nome', e.target.value)}
                          placeholder="Ex: Carlos da Silva"
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Telefone <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={contact.telefone}
                          onChange={(e) => updateContact(idx, 'telefone', e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Parentesco <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          value={contact.parentesco}
                          onChange={(e) => updateContact(idx, 'parentesco', e.target.value)}
                          placeholder="Ex: Cônjuge, Mãe, Irmão"
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-xs">Observações do Contato</Label>
                        <Input
                          value={contact.observacoes || ''}
                          onChange={(e) => updateContact(idx, 'observacoes', e.target.value)}
                          placeholder="Ex: Disponível após as 18h"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
