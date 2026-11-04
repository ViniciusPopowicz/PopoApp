'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductDetailDto } from '@/types/product';
import { formatCurrency, formatDate } from '@/lib/format';
import { Layers, Package, Calendar } from 'lucide-react';

interface ProductDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  onOpenLotIntake: (productId: string) => void;
  onUpdated?: () => void;
}

export function ProductDetailSheet({
  open,
  onOpenChange,
  productId,
  onOpenLotIntake,
}: ProductDetailSheetProps) {
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      setLoading(true);
      fetch(`/api/products/${productId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setProduct(json.data);
          }
        })
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    } else {
      setProduct(null);
    }
  }, [open, productId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product?.nome || 'Detalhes do Produto'}
          </SheetTitle>
          <SheetDescription>
            Histórico de lotes registrados e saldo disponível em estoque.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando informações do produto...
          </div>
        ) : !product ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Produto não encontrado.
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Disponível</p>
                <p className="text-lg font-bold">
                  {product.trackingMode === 'QUANTITY'
                    ? `${product.totalQuantityAvailable} ${product.unidade}`
                    : `${product.availableUnitsCount} un.`}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onOpenLotIntake(product.id)}
                className="gap-1.5"
              >
                <Layers className="h-4 w-4" />
                Novo Lote
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Lotes Registrados ({product.lots?.length || 0})
              </h4>
              {!product.lots || product.lots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum lote registrado para este produto.
                </p>
              ) : (
                <div className="space-y-2">
                  {product.lots.map((lot) => (
                    <div
                      key={lot.id}
                      className="rounded-md border p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>Lote: {lot.numeroLote}</span>
                        <Badge variant={lot.isExpired ? 'destructive' : 'secondary'}>
                          {product.trackingMode === 'QUANTITY'
                            ? `${lot.quantidadeDisponivel} / ${lot.quantidadeInicial} ${product.unidade}`
                            : `${lot.availableUnitsCount} / ${lot.totalUnitsCount} disp.`}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Validade:{' '}
                          {lot.dataValidade
                            ? formatDate(new Date(lot.dataValidade))
                            : 'Sem validade'}
                        </span>
                        {lot.precoCusto !== null && (
                          <span>Custo: {formatCurrency(lot.precoCusto)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
