'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProcedureResponseDto } from '@/types/procedure';
import { ProductSummaryDto } from '@/types/product';
import { Loader2, Package, Search } from 'lucide-react';

interface ProcedureProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedure: ProcedureResponseDto | null;
  onSuccess: () => void;
}

export function ProcedureProductsDialog({
  open,
  onOpenChange,
  procedure,
  onSuccess,
}: ProcedureProductsDialogProps) {
  const [products, setProducts] = useState<ProductSummaryDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && procedure) {
      setError(null);
      setSearch('');
      const initialIds = new Set<string>(
        (procedure.products || []).map((p: any) => p.productId || p.id)
      );
      setSelectedIds(initialIds);

      setLoading(true);
      fetch('/api/products?active=true')
        .then((res) => res.json())
        .then((json) => {
          const list = json.data ?? json.items ?? [];
          setProducts(Array.isArray(list) ? list : []);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }
  }, [open, procedure]);

  const toggleProduct = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!procedure) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/procedures/${procedure.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao atualizar vínculo de produtos.');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar vínculos.');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Produtos Vinculados
          </DialogTitle>
          <DialogDescription>
            Selecione os insumos frequentemente utilizados em{' '}
            <strong>{procedure?.nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Carregando produtos...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhum produto encontrado.
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const isSelected = selectedIds.has(prod.id);
                return (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2.5 hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleProduct(prod.id)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleProduct(prod.id)}
                      />
                      <div>
                        <Label className="text-sm font-medium cursor-pointer">
                          {prod.nome}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {prod.categoria || 'Sem categoria'} • {prod.unidade}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {prod.trackingMode === 'QUANTITY' ? 'Volume' : 'Unidade'}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
