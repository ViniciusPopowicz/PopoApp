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
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { AppCombobox } from '@/components/ui/app-combobox';
import {
  maskCurrencyBRL,
  unmaskCurrencyBRL,
  maskDateBR,
  dateBRToISO,
  isoToDateBR,
} from '@/lib/masks';
import { Loader2, Layers, Info } from 'lucide-react';
import { ProductSummaryDto } from '@/types/product';

interface LotIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductSummaryDto[];
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
  const [productId, setProductId] = useState('');
  const [codigoLote, setCodigoLote] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [dataCompraMasked, setDataCompraMasked] = useState('');
  const [dataValidadeMasked, setDataValidadeMasked] = useState('');
  const [quantidadeOriginal, setQuantidadeOriginal] = useState<string>('1');
  const [custoTotalMasked, setCustoTotalMasked] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const todayIso = new Date().toISOString().split('T')[0];
      setProductId(preselectedProductId || (products[0]?.id ?? ''));
      setCodigoLote('');
      setFornecedor('');
      setDataCompraMasked(isoToDateBR(todayIso));
      setDataValidadeMasked('');
      setQuantidadeOriginal('1');
      setCustoTotalMasked('');
      setObservacoes('');
      setError(null);
    }
  }, [open, preselectedProductId, products]);

  const selectedProduct = products.find((p) => p.id === productId);
  const isQuantityMode = selectedProduct?.trackingMode === 'QUANTITY';
  const qtyNumber = parseFloat(quantidadeOriginal) || 0;
  const costNumber = unmaskCurrencyBRL(custoTotalMasked);
  const unitCostPreview = qtyNumber > 0 && costNumber > 0 ? costNumber / qtyNumber : 0;

  const productOptions = products
    .filter((p) => p.isActive || p.id === preselectedProductId)
    .map((p) => ({
      value: p.id,
      label: `${p.nome}${p.marca ? ` (${p.marca})` : ''} — [${p.unidade}]`,
      sublabel:
        p.trackingMode === 'QUANTITY'
          ? 'Rastreio por Quantidade'
          : 'Rastreio por Unidade Física',
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError('Selecione um produto.');
      return;
    }

    if (!codigoLote.trim()) {
      setError('O código/número do lote é obrigatório.');
      return;
    }

    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) {
      setError(
        isQuantityMode
          ? 'A quantidade inicial deve ser maior que zero.'
          : 'A quantidade de unidades deve ser um número inteiro maior ou igual a 1.'
      );
      return;
    }

    if (!isQuantityMode && (!Number.isInteger(qtyNumber) || qtyNumber > 500)) {
      setError(
        'Para produtos rastreados por unidade física (UNIT), informe um inteiro entre 1 e 500.'
      );
      return;
    }

    const isoCompra = dataCompraMasked ? dateBRToISO(dataCompraMasked) : '';
    if (dataCompraMasked && !isoCompra) {
      setError('Data de compra inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    const isoValidade = dataValidadeMasked ? dateBRToISO(dataValidadeMasked) : '';
    if (dataValidadeMasked && !isoValidade) {
      setError('Data de validade inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        numeroLote: codigoLote.trim(),
        codigoLote: codigoLote.trim(),
        fornecedor: fornecedor.trim() || null,
        dataAquisicao: isoCompra ? new Date(`${isoCompra}T12:00:00Z`).toISOString() : null,
        dataCompra: isoCompra ? new Date(`${isoCompra}T12:00:00Z`).toISOString() : null,
        dataValidade: isoValidade ? new Date(`${isoValidade}T12:00:00Z`).toISOString() : null,
        quantidadeOriginal: isQuantityMode ? qtyNumber : Math.round(qtyNumber),
        quantidadeInicial: isQuantityMode ? qtyNumber : Math.round(qtyNumber),
        precoCusto: costNumber,
        custoTotal: costNumber,
        custoUnitario: unitCostPreview,
        observacoes: observacoes.trim() || null,
      };

      const res = await fetch(`/api/products/${productId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao registrar entrada de lote.');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao registrar lote.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Entrada de Lote em Estoque
          </DialogTitle>
          <DialogDescription>
            {isQuantityMode
              ? 'Registre um novo lote com saldo de quantidade/volume para consumo fracionado.'
              : 'Registre um novo lote. O sistema gerará automaticamente as unidades físicas individuais.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lot-product">Produto *</Label>
            <AppCombobox
              id="lot-product"
              options={productOptions}
              value={productId}
              onChange={setProductId}
              disabled={Boolean(preselectedProductId)}
              placeholder="Selecione um produto..."
              searchable
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lot-codigo">Número / Código do Lote *</Label>
              <Input
                id="lot-codigo"
                placeholder="Ex: LOTE-2026-A1"
                value={codigoLote}
                onChange={(e) => setCodigoLote(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot-fornecedor">Fornecedor</Label>
              <Input
                id="lot-fornecedor"
                placeholder="Ex: Distribuidora Médica Sul"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lot-compra">Data de Compra / Aquisição</Label>
              <DatePicker
                id="lot-compra"
                placeholder="DD/MM/AAAA"
                value={dataCompraMasked}
                onChange={setDataCompraMasked}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot-validade">Data de Validade</Label>
              <DatePicker
                id="lot-validade"
                placeholder="DD/MM/AAAA"
                value={dataValidadeMasked}
                onChange={setDataValidadeMasked}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lot-qty">
                {isQuantityMode
                  ? `Quantidade Inicial (${selectedProduct?.unidade || 'un'}) *`
                  : `Qtd. de Unidades Físicas (${selectedProduct?.unidade || 'un'}) *`}
              </Label>
              <Input
                id="lot-qty"
                type="number"
                min={isQuantityMode ? '0.01' : '1'}
                max={isQuantityMode ? '100000' : '500'}
                step={isQuantityMode ? '0.01' : '1'}
                value={quantidadeOriginal}
                onChange={(e) => setQuantidadeOriginal(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot-custo">Custo Total do Lote (R$)</Label>
              <Input
                id="lot-custo"
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={custoTotalMasked}
                onChange={(e) => setCustoTotalMasked(maskCurrencyBRL(e.target.value))}
              />
            </div>
          </div>

          {qtyNumber > 0 && (
            <div className="rounded-lg border bg-primary/5 p-3 flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                {isQuantityMode ? (
                  <p className="font-medium text-foreground">
                    Será adicionado saldo de{' '}
                    <Badge variant="default" className="mx-0.5">
                      {qtyNumber} {selectedProduct?.unidade || 'un'}
                    </Badge>{' '}
                    disponível para baixa parcial ou integral neste lote.
                  </p>
                ) : (
                  <p className="font-medium text-foreground">
                    Serão geradas automaticamente{' '}
                    <Badge variant="default" className="mx-0.5">
                      {Math.round(qtyNumber)} unidades
                    </Badge>{' '}
                    individuais com status{' '}
                    <span className="text-emerald-600 font-semibold">Disponível</span>.
                  </p>
                )}
                {unitCostPreview > 0 && (
                  <p className="text-muted-foreground">
                    Custo unitário calculado:{' '}
                    <strong>
                      {unitCostPreview.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>{' '}
                    por {selectedProduct?.unidade || 'unidade'}.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lot-obs">Observações do Lote</Label>
            <textarea
              id="lot-obs"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Nota fiscal, condições de recebimento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
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
              Registrar Lote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
