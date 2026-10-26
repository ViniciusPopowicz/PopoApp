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
import { AlertCircle } from 'lucide-react';

export interface ProductFormData {
  id?: string;
  nome: string;
  categoria?: string | null;
  marca?: string | null;
  unidade: string;
  trackingMode?: 'UNIT' | 'QUANTITY';
  estoqueMinimo?: number;
  descricao?: string | null;
  isReusable: boolean;
  isActive: boolean;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductFormData | null;
  onSuccess: () => void;
}

const COMMON_CATEGORIES = [
  'Toxinas',
  'Preenchedores',
  'Bioestimuladores',
  'Skinboosters',
  'Fios de PDO',
  'Anestésicos',
  'Cosméticos & Home Care',
  'Descartáveis & Insumos',
  'Outros',
];

const COMMON_UNITS = [
  'Frasco',
  'Ampola',
  'Seringa',
  'Caixa',
  'Unidade',
  'Envelope',
  'Pacote',
  'ml',
  'g',
  'aplicacoes',
];

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductFormDialogProps) {
  const isEditing = Boolean(product?.id);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [marca, setMarca] = useState('');
  const [unidade, setUnidade] = useState('Frasco');
  const [trackingMode, setTrackingMode] = useState<'UNIT' | 'QUANTITY'>('UNIT');
  const [estoqueMinimo, setEstoqueMinimo] = useState('5');
  const [descricao, setDescricao] = useState('');
  const [isReusable, setIsReusable] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setNome(product.nome || '');
      setCategoria(product.categoria || '');
      setMarca(product.marca || '');
      setUnidade(product.unidade || 'Frasco');
      setTrackingMode(product.trackingMode || 'UNIT');
      setEstoqueMinimo(String(product.estoqueMinimo ?? 5));
      setDescricao(product.descricao || '');
      setIsReusable(Boolean(product.isReusable));
      setIsActive(product.isActive !== false);
    } else {
      setNome('');
      setCategoria('Toxinas');
      setMarca('');
      setUnidade('Frasco');
      setTrackingMode('UNIT');
      setEstoqueMinimo('5');
      setDescricao('');
      setIsReusable(false);
      setIsActive(true);
    }
    setErrorMessage(null);
  }, [product, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!nome.trim() || nome.trim().length < 2) {
      setErrorMessage('O nome do produto deve ter pelo menos 2 caracteres.');
      return;
    }

    if (!unidade.trim()) {
      setErrorMessage('A unidade de medida é obrigatória.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        nome: nome.trim(),
        categoria: categoria.trim() || null,
        marca: marca.trim() || null,
        unidade: unidade.trim(),
        trackingMode,
        estoqueMinimo: Number(estoqueMinimo) || 0,
        descricao: descricao.trim() || null,
        isReusable,
        isActive,
      };

      const url = isEditing && product?.id ? `/api/products/${product.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao salvar produto.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar produto.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto no Catálogo'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize a definição do produto e regras de rastreabilidade de estoque.'
              : 'Cadastre um novo item no catálogo de produtos e insumos clínicos.'}
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
            <Label htmlFor="prod-nome">
              Nome do Produto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="prod-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Botox 100U, Restylane Lyft, Creme Anestésico"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="prod-categoria">Categoria</Label>
              <Input
                id="prod-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Toxinas, Preenchedores"
                list="category-suggestions"
              />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod-marca">Marca / Laboratório</Label>
              <Input
                id="prod-marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: Allergan, Galderma"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Modo de Rastreio</Label>
              <Select
                value={trackingMode}
                onValueChange={(v) => setTrackingMode(v as 'UNIT' | 'QUANTITY')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">Unidade Física (Serial)</SelectItem>
                  <SelectItem value="QUANTITY">Quantidade Fracionável</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod-unidade">
                Unidade <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prod-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex: Frasco, ml, g"
                list="unit-suggestions"
                required
              />
              <datalist id="unit-suggestions">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prod-min">Estoque Mín.</Label>
              <Input
                id="prod-min"
                type="number"
                step="0.1"
                min="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Classificação de Reuso (§15)</Label>
            <div className="pt-1">
              <Button
                type="button"
                variant={isReusable ? 'default' : 'outline'}
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsReusable(!isReusable)}
              >
                {isReusable ? 'Reutilizável (Mesmo Cliente)' : 'Uso Único / Consumível'}
              </Button>
            </div>
          </div>

          <div className="p-3 border rounded-lg bg-muted/20 text-xs text-muted-foreground">
            {trackingMode === 'QUANTITY' ? (
              <p>
                <strong>Consumo Parcial / Quantitativo:</strong> O saldo do lote é controlado em{' '}
                <strong>{unidade || 'unidades'}</strong>, permitindo consumo parcial/fracionado em múltiplos atendimentos até esgotamento.
              </p>
            ) : isReusable ? (
              <p>
                <strong>Regra de Reutilização:</strong> Cada frasco ou unidade física terá código serial
                individual e, após a primeira aplicação, ficará vinculado exclusivamente àquele paciente (V16).
              </p>
            ) : (
              <p>
                <strong>Uso Único:</strong> Unidades físicas são consumidas e esgotadas no atendimento,
                impedindo reutilização cruzada (V17 / V18).
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="prod-descricao">Descrição / Observações</Label>
            <Textarea
              id="prod-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Instruções de armazenamento, concentração, etc."
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
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
