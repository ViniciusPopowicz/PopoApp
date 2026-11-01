'use client';

import React, { useEffect, useState } from 'react';
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
import { AppCombobox } from '@/components/ui/app-combobox';
import {
  maskCurrencyBRL,
  formatNumberToBRLInput,
  unmaskCurrencyBRL,
} from '@/lib/masks';
import { ProcedureResponseDto } from '@/types/procedure';
import { Loader2, Sparkles } from 'lucide-react';

interface ProcedureFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedure?: ProcedureResponseDto | null;
  onSuccess: () => void;
}

const SUGGESTED_CATEGORIES = [
  { value: 'Harmonização Facial', label: 'Harmonização Facial' },
  { value: 'Injetáveis & Toxina', label: 'Injetáveis & Toxina' },
  { value: 'Bioestimuladores', label: 'Bioestimuladores' },
  { value: 'Estética Corporal', label: 'Estética Corporal' },
  { value: 'Estética Facial', label: 'Estética Facial' },
  { value: 'Laser & Tecnologias', label: 'Laser & Tecnologias' },
  { value: 'Peelings & Renovação', label: 'Peelings & Renovação' },
  { value: 'Capilar', label: 'Capilar' },
  { value: 'Avaliação & Retorno', label: 'Avaliação & Retorno' },
];

export function ProcedureFormDialog({
  open,
  onOpenChange,
  procedure,
  onSuccess,
}: ProcedureFormDialogProps) {
  const isEditing = Boolean(procedure);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Harmonização Facial');
  const [valorPadraoMasked, setValorPadraoMasked] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('60');
  const [descricao, setDescricao] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (procedure) {
        setNome(procedure.nome);
        setCategoria(procedure.categoria || 'Geral');
        setValorPadraoMasked(formatNumberToBRLInput(procedure.valorPadrao));
        setDuracaoMinutos(String(procedure.duracaoMinutos));
        setDescricao(procedure.descricao || '');
      } else {
        setNome('');
        setCategoria('Harmonização Facial');
        setValorPadraoMasked('');
        setDuracaoMinutos('60');
        setDescricao('');
      }
    }
  }, [open, procedure]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const valorNum = unmaskCurrencyBRL(valorPadraoMasked);
    const duracaoNum = Number(duracaoMinutos);

    if (!nome.trim() || nome.trim().length < 2) {
      setError('O nome do procedimento deve ter pelo menos 2 caracteres.');
      return;
    }

    if (isNaN(valorNum) || valorNum <= 0) {
      setError('O valor padrão do procedimento deve ser maior que zero.');
      return;
    }

    if (isNaN(duracaoNum) || duracaoNum < 5) {
      setError('A duração estimada deve ser de pelo menos 5 minutos.');
      return;
    }

    if (!descricao.trim() || descricao.trim().length < 3) {
      setError('A descrição do procedimento deve ter pelo menos 3 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const url = isEditing ? `/api/procedures/${procedure!.id}` : '/api/procedures';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          categoria: categoria.trim() || 'Geral',
          valorPadrao: valorNum,
          duracaoMinutos: duracaoNum,
          descricao: descricao.trim(),
          ...(isEditing && procedure ? { isActive: procedure.isActive } : { isActive: true }),
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Erro ao salvar procedimento');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao salvar procedimento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Procedimento' : 'Novo Procedimento Clínico'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações e o valor base do procedimento no catálogo.'
              : 'Defina o nome, valor padrão e duração estimada para disponibilizar na agenda e atendimentos.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive border border-destructive/30">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="proc-nome">Nome do Procedimento *</Label>
            <Input
              id="proc-nome"
              placeholder="Ex: Toxina Botulínica (3 Regiões)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proc-categoria">Categoria</Label>
              <AppCombobox
                id="proc-categoria"
                options={SUGGESTED_CATEGORIES}
                value={categoria}
                onChange={setCategoria}
                placeholder="Selecione ou digite..."
                creatable
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proc-duracao">Duração Estimada (minutos) *</Label>
              <Input
                id="proc-duracao"
                type="number"
                min={5}
                max={720}
                step={5}
                value={duracaoMinutos}
                onChange={(e) => setDuracaoMinutos(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proc-valor">Valor Padrão (R$) *</Label>
            <Input
              id="proc-valor"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={valorPadraoMasked}
              onChange={(e) => setValorPadraoMasked(maskCurrencyBRL(e.target.value))}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Valor de tabela sugerido automaticamente ao lançar um atendimento (permitindo descontos ou ajustes por sessão).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proc-descricao">Descrição Técnica & Recomendações *</Label>
            <textarea
              id="proc-descricao"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Detalhes do protocolo, áreas incluídas ou observações clínicas..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Procedimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
