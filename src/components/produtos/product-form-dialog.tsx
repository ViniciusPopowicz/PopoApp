'use client';

import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { AppCombobox } from '@/components/ui/app-combobox';
import { Loader2, Package } from 'lucide-react';

export interface ProductFormData {
  id?: string;
  nome: string;
  categoria?: string | null;
  marca?: string | null;
  descricao?: string | null;
  unidade: string;
  trackingMode?: 'UNIT' | 'QUANTITY';
  estoqueMinimo?: number;
  isReusable: boolean;
  isActive: boolean;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductFormData | null;
  onSuccess: () => void;
}

const COMMON_UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'mg', label: 'Miligrama (mg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'ampola', label: 'Ampola' },
  { value: 'frasco', label: 'Frasco' },
  { value: 'seringa', label: 'Seringa' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'par', label: 'Par' },
];

const COMMON_CATEGORIES = [
  { value: 'Toxina Botulínica', label: 'Toxina Botulínica' },
  { value: 'Preenchedores', label: 'Preenchedores' },
  { value: 'Bioestimuladores', label: 'Bioestimuladores' },
  { value: 'Fios de Sustentação', label: 'Fios de Sustentação' },
  { value: 'Dermocosméticos', label: 'Dermocosméticos' },
  { value: 'Descartáveis', label: 'Descartáveis' },
  { value: 'Anestésicos', label: 'Anestésicos' },
  { value: 'Equipamentos / Ponteiras', label: 'Equipamentos / Ponteiras' },
];

const TRACKING_MODE_OPTIONS = [
  { value: 'UNIT', label: 'Unidades Individuais / Seringas (UNIT)' },
  { value: 'QUANTITY', label: 'Quantidade Fracionável / Volume (QUANTITY)' },
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
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [trackingMode, setTrackingMode] = useState<'UNIT' | 'QUANTITY'>('UNIT');
  const [estoqueMinimo, setEstoqueMinimo] = useState('5');
  const [isReusable, setIsReusable] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (product) {
        setNome(product.nome || '');
        setCategoria(product.categoria || '');
        setMarca(product.marca || '');
        setDescricao(product.descricao || '');
        setUnidade(product.unidade || 'un');
        setTrackingMode(product.trackingMode || 'UNIT');
        setEstoqueMinimo(String(product.estoqueMinimo ?? 5));
        setIsReusable(Boolean(product.isReusable));
      } else {
        setNome('');
        setCategoria('');
        setMarca('');
        setDescricao('');
        setUnidade('un');
        setTrackingMode('UNIT');
        setEstoqueMinimo('5');
        setIsReusable(false);
      }
      setError(null);
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nome.trim()) {
      setError('O nome do produto é obrigatório.');
      return;
    }

    if (!unidade.trim()) {
      setError('A unidade de medida é obrigatória.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nome: nome.trim(),
        categoria: categoria.trim() || null,
        marca: marca.trim() || null,
        descricao: descricao.trim() || null,
        unidade: unidade.trim(),
        trackingMode,
        estoqueMinimo: Math.max(0, Number(estoqueMinimo) || 0),
        isReusable,
        ...(isEditing && product ? { isActive: product.isActive } : { isActive: true }),
      };

      const url = isEditing ? `/api/products/${product!.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar produto.');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Produto no Catálogo' : 'Novo Produto no Catálogo'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações técnicas do produto.'
              : 'Cadastre um insumo ou produto clínico para controle de lotes e unidades em estoque.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="prod-nome">Nome do Produto *</Label>
            <Input
              id="prod-nome"
              placeholder="Ex: Toxina Botulínica 100U, Ácido Hialurônico 1ml..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prod-marca">Marca / Fabricante</Label>
              <Input
                id="prod-marca"
                placeholder="Ex: Allergan, Galderma, Merz..."
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-categoria">Categoria</Label>
              <AppCombobox
                id="prod-categoria"
                options={COMMON_CATEGORIES}
                value={categoria}
                onChange={setCategoria}
                placeholder="Selecione ou digite..."
                searchPlaceholder="Buscar ou criar categoria..."
                creatable
                clearable
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prod-unidade">Unidade de Medida *</Label>
              <AppCombobox
                id="prod-unidade"
                options={COMMON_UNITS}
                value={unidade}
                onChange={setUnidade}
                placeholder="Ex: un, ml, ampola, frasco..."
                searchPlaceholder="Buscar ou criar unidade..."
                creatable
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-tracking">Modo de Rastreio *</Label>
              <AppCombobox
                id="prod-tracking"
                options={TRACKING_MODE_OPTIONS}
                value={trackingMode}
                onChange={(val) => setTrackingMode(val as 'UNIT' | 'QUANTITY')}
                placeholder="Selecione o modo de rastreio"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prod-estoque-min">Estoque Mínimo (Alerta)</Label>
              <Input
                id="prod-estoque-min"
                type="number"
                min="0"
                step={trackingMode === 'QUANTITY' ? '0.1' : '1'}
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end pb-1">
              <div className="flex items-start space-x-2 rounded-md border p-3 bg-muted/30">
                <Checkbox
                  id="prod-reusable"
                  checked={isReusable}
                  onCheckedChange={(checked) => setIsReusable(Boolean(checked))}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="prod-reusable" className="cursor-pointer font-medium text-sm">
                    Produto Reutilizável / Multidose
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permite múltiplos usos antes de esgotar
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-descricao">Descrição / Especificações</Label>
            <textarea
              id="prod-descricao"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Observações de armazenamento, diluição padrão ou especificações..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
