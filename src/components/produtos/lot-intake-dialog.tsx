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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, PackagePlus, CheckCircle2 } from 'lucide-react';

export interface ProductSimpleItem {
  id: string;
  nome: string;
  marca?: string | null;
  unidade: string;
  isReusable: boolean;
}

interface LotIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductSimpleItem[];
  preselectedProductId?: string | null;
  onSuccess: () => void;
}

export function LotIntakeDialog({
  open,
  onOpenChange,
  products,
  preselectedProductId,
  onSuccess,
}: LotIntakeDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [numeroLote, setNumeroLote] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [dataAquisicao, setDataAquisicao] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [precoCusto, setPrecoCusto] = useState('');
  const [quantidadeInicial, setQuantidadeInicial] = useState('1');
  const [observacoes, setObservacoes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedProductId) {
      setSelectedProductId(preselectedProductId);
    } else if (products.length > 0) {
      setSelectedProductId((current) => (current ? current : products[0].id));
    }
    setNumeroLote('');
    setDataValidade('');
    setDataAquisicao(new Date().toISOString().split('T')[0]);
    setPrecoCusto('');
    setQuantidadeInicial('1');
    setObservacoes('');
    setErrorMessage(null);
  }, [open, preselectedProductId, products]);

  const currentProduct = products.find((p) => p.id === selectedProductId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProductId) {
      setErrorMessage('Selecione o produto para a entrada de lote.');
      return;
    }

    if (!numeroLote.trim()) {
      setErrorMessage('O número do lote é obrigatório.');
      return;
    }

    const qtd = parseInt(quantidadeInicial, 10);
    if (isNaN(qtd) || qtd <= 0) {
      setErrorMessage('A quantidade de unidades recebidas deve ser um número inteiro maior que zero.');
      return;
    }

    const custo = precoCusto.trim() ? parseFloat(precoCusto.replace(',', '.')) : null;
    if (custo !== null && (isNaN(custo) || custo < 0)) {
      setErrorMessage('O preço de custo deve ser um valor numérico válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        numeroLote: numeroLote.trim(),
        dataValidade: dataValidade ? new Date(dataValidade).toISOString() : null,
        dataAquisicao: dataAquisicao ? new Date(dataAquisicao).toISOString() : new Date().toISOString(),
        precoCusto: custo,
        quantidadeInicial: qtd,
        observacoes: observacoes.trim() || null,
      };

      const res = await fetch(`/api/products/${selectedProductId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao registrar entrada de lote.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao registrar lote.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            Entrada de Lote de Estoque
          </DialogTitle>
          <DialogDescription>
            Receba um lote físico do produto. O sistema gerará automaticamente as unidades individuais
            rastreáveis com código serial único.
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
            <Label htmlFor="lote-produto">
              Produto <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger id="lote-produto">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} {p.marca ? `(${p.marca})` : ''} - {p.unidade}
                    {p.isReusable ? ' [Reutilizável]' : ' [Uso Único]'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="lote-numero">
                Número do Lote <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lote-numero"
                value={numeroLote}
                onChange={(e) => setNumeroLote(e.target.value)}
                placeholder="Ex: LOT-2026-X1"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lote-quantidade">
                Quantidade Recebida (Unidades) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lote-quantidade"
                type="number"
                min="1"
                max="1000"
                value={quantidadeInicial}
                onChange={(e) => setQuantidadeInicial(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="lote-validade">Data de Validade</Label>
              <Input
                id="lote-validade"
                type="date"
                value={dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lote-aquisicao">Data de Aquisição</Label>
              <Input
                id="lote-aquisicao"
                type="date"
                value={dataAquisicao}
                onChange={(e) => setDataAquisicao(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="lote-custo">Preço de Custo Unitário (R$)</Label>
              <Input
                id="lote-custo"
                type="number"
                step="0.01"
                min="0"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
                placeholder="Ex: 450.00"
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <div className="p-2.5 border rounded bg-muted/30 text-xs">
                <span className="font-semibold block">Geração Automática:</span>
                <span className="text-muted-foreground">
                  Serão criados seriais no padrão <code>{numeroLote.trim() || 'LOTE'}-001</code> até{' '}
                  <code>
                    {numeroLote.trim() || 'LOTE'}-
                    {String(parseInt(quantidadeInicial || '1', 10)).padStart(3, '0')}
                  </code>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="lote-obs">Observações do Fornecedor / Lote</Label>
            <Textarea
              id="lote-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Número de nota fiscal, condições de recebimento, temperatura..."
              rows={2}
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
              {isSubmitting ? 'Gerando unidades...' : 'Confirmar Entrada de Lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
