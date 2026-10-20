'use client';

import { useState, useEffect } from 'react';
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
import { AlertCircle } from 'lucide-react';

export interface ProcedureFormData {
  id?: string;
  nome: string;
  categoria: string;
  valorPadrao: number | string;
  duracaoMinutos: number | string;
  descricao: string;
  isActive?: boolean;
}

interface ProcedureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedure?: ProcedureFormData | null;
  onSuccess: () => void;
}

export function ProcedureFormDialog({
  open,
  onOpenChange,
  procedure,
  onSuccess,
}: ProcedureFormDialogProps) {
  const isEditing = Boolean(procedure?.id);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valorPadrao, setValorPadrao] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('60');
  const [descricao, setDescricao] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (procedure) {
      setNome(procedure.nome || '');
      setCategoria(procedure.categoria || '');
      setValorPadrao(procedure.valorPadrao !== undefined ? String(procedure.valorPadrao) : '');
      setDuracaoMinutos(
        procedure.duracaoMinutos !== undefined ? String(procedure.duracaoMinutos) : '60'
      );
      setDescricao(procedure.descricao || '');
      setIsActive(procedure.isActive !== false);
    } else {
      setNome('');
      setCategoria('');
      setValorPadrao('');
      setDuracaoMinutos('60');
      setDescricao('');
      setIsActive(true);
    }
    setErrorMessage(null);
  }, [procedure, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!nome.trim() || nome.trim().length < 2) {
      setErrorMessage('O nome do procedimento deve ter pelo menos 2 caracteres.');
      return;
    }

    if (!categoria.trim() || categoria.trim().length < 2) {
      setErrorMessage('A categoria deve ter pelo menos 2 caracteres.');
      return;
    }

    const numValor = parseFloat(valorPadrao.replace(',', '.'));
    if (isNaN(numValor) || numValor <= 0) {
      setErrorMessage('O valor padrão deve ser um número maior que zero (V06).');
      return;
    }

    const numDuracao = parseInt(String(duracaoMinutos), 10);
    if (isNaN(numDuracao) || numDuracao <= 0) {
      setErrorMessage('A duração estimada deve ser um número inteiro de minutos maior que zero (V07).');
      return;
    }

    if (!descricao.trim() || descricao.trim().length < 3) {
      setErrorMessage('A descrição do procedimento é obrigatória e deve ter pelo menos 3 caracteres (V07).');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        nome: nome.trim(),
        categoria: categoria.trim(),
        valorPadrao: numValor,
        duracaoMinutos: numDuracao,
        descricao: descricao.trim(),
        isActive,
      };

      const url = isEditing && procedure?.id ? `/api/procedures/${procedure.id}` : '/api/procedures';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao salvar procedimento.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar procedimento no servidor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Procedimento' : 'Novo Procedimento'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados e precificação padrão do procedimento do catálogo.'
              : 'Cadastre um novo procedimento estético no catálogo com valores e duração estimada.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="proc-nome">
              Nome do Procedimento <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proc-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Toxina Botulínica - Terço Superior"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="proc-categoria">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proc-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Injetáveis, Facial, Corporal"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="proc-valor">
                Valor Padrão (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proc-valor"
                type="number"
                step="0.01"
                min="0.01"
                value={valorPadrao}
                onChange={(e) => setValorPadrao(e.target.value)}
                placeholder="Ex: 1200.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="proc-duracao">
                Duração Estimada (minutos) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proc-duracao"
                type="number"
                min="1"
                max="1440"
                value={duracaoMinutos}
                onChange={(e) => setDuracaoMinutos(e.target.value)}
                placeholder="Ex: 60"
                required
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <Label className="mb-2">Status do Procedimento</Label>
              <Button
                type="button"
                variant={isActive ? 'default' : 'secondary'}
                size="sm"
                className="w-full"
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? 'Ativo no Catálogo' : 'Inativo (Oculto)'}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="proc-descricao">
              Descrição do Procedimento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="proc-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva as indicações, áreas de aplicação e detalhes do protocolo clínico (V07)."
              rows={3}
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Procedimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
