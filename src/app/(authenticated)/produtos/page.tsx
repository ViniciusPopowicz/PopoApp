'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Package,
  PackagePlus,
  Layers,
  AlertTriangle,
  Pencil,
  Power,
  ShieldCheck,
  Tag,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { ProductFormDialog, ProductFormData } from '@/components/produtos/product-form-dialog';
import { LotIntakeDialog, ProductSimpleItem } from '@/components/produtos/lot-intake-dialog';

interface ProductItem {
  id: string;
  nome: string;
  categoria: string | null;
  marca: string | null;
  descricao: string | null;
  unidade: string;
  isReusable: boolean;
  isActive: boolean;
  lotsCount: number;
  totalUnitsCount: number;
  availableUnitsCount: number;
  isLowStock: boolean;
  createdAt: string;
}

interface StockUnitItem {
  id: string;
  codigoSerial: string;
  productId: string;
  productName: string;
  unidade: string;
  isReusable: boolean;
  lotId: string;
  numeroLote: string;
  dataValidade: string | null;
  status: 'Disponivel' | 'EmUso' | 'Esgotado' | 'Descartado';
  currentClientId?: string | null;
  currentClientName?: string | null;
  isAssignedToCurrentClient?: boolean;
}

export default function ProdutosPage() {
  const [activeMainTab, setActiveMainTab] = useState<'catalogo' | 'unidades'>('catalogo');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnitItem[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductFormData | null>(null);

  const [isLotDialogOpen, setIsLotDialogOpen] = useState(false);
  const [lotPreselectedProductId, setLotPreselectedProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (selectedCategory !== 'Todos') {
        params.set('categoria', selectedCategory);
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao buscar produtos');
      }

      setProducts(json.data || []);
    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
      setError(err.message || 'Erro ao consultar catálogo de produtos.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  const fetchStockUnits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      const res = await fetch(`/api/stock/units?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setStockUnits(json.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar unidades de estoque:', err);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
      fetchStockUnits();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts, fetchStockUnits]);

  // Categories list derived from current products
  const categories = [
    'Todos',
    ...Array.from(new Set(products.map((p) => p.categoria).filter(Boolean) as string[])),
  ];

  const lowStockCount = products.filter((p) => p.isLowStock && p.isActive).length;

  function handleOpenCreateProduct() {
    setSelectedProductForEdit(null);
    setIsProductDialogOpen(true);
  }

  function handleOpenEditProduct(product: ProductItem) {
    setSelectedProductForEdit({
      id: product.id,
      nome: product.nome,
      categoria: product.categoria,
      marca: product.marca,
      unidade: product.unidade,
      descricao: product.descricao,
      isReusable: product.isReusable,
      isActive: product.isActive,
    });
    setIsProductDialogOpen(true);
  }

  function handleOpenLotIntake(productId?: string) {
    setLotPreselectedProductId(productId || null);
    setIsLotDialogOpen(true);
  }

  const simpleProductsList: ProductSimpleItem[] = products.map((p) => ({
    id: p.id,
    nome: p.nome,
    marca: p.marca,
    unidade: p.unidade,
    isReusable: p.isReusable,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos & Estoque"
        description="Catálogo de insumos, classificação de reuso, controle de lotes e rastreabilidade serial física."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleOpenLotIntake()}>
            <PackagePlus className="mr-2 h-4 w-4 text-primary" />
            Entrada de Lote
          </Button>
          <Button onClick={handleOpenCreateProduct}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </PageHeader>

      {/* Low stock alert badge if any */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Atenção: <strong>{lowStockCount} produto(s)</strong> estão com estoque baixo (5 ou menos
            unidades disponíveis). Realize entrada de lotes para reposição.
          </span>
        </div>
      )}

      {/* Main Tabs: Catálogo vs Unidades Rastreáveis */}
      <Tabs
        value={activeMainTab}
        onValueChange={(v) => setActiveMainTab(v as any)}
        className="w-full space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <TabsList>
            <TabsTrigger value="catalogo">
              <Package className="mr-2 h-4 w-4" />
              Catálogo de Produtos ({products.length})
            </TabsTrigger>
            <TabsTrigger value="unidades">
              <Layers className="mr-2 h-4 w-4" />
              Unidades Físicas Rastreáveis ({stockUnits.length})
            </TabsTrigger>
          </TabsList>

          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por nome, marca ou serial..."
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: Catálogo de Produtos */}
        <TabsContent value="catalogo" className="space-y-4">
          {/* Categories Filter Badges */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground mr-1">Categoria:</span>
              {categories.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Carregando catálogo de produtos...</span>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto cadastrado"
              description={
                searchTerm || selectedCategory !== 'Todos'
                  ? 'Nenhum item corresponde aos filtros selecionados.'
                  : 'Seu catálogo de produtos está vazio. Cadastre o primeiro produto para iniciar o controle de estoque.'
              }
              actionLabel="Cadastrar Primeiro Produto"
              onAction={handleOpenCreateProduct}
            />
          ) : (
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto / Marca</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Lotes</TableHead>
                    <TableHead>Estoque Disponível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((produto) => (
                    <TableRow key={produto.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="font-semibold text-foreground">{produto.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {produto.marca ? `Marca: ${produto.marca} • ` : ''}
                          Unidade: {produto.unidade}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {produto.categoria || 'Geral'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={produto.isReusable ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {produto.isReusable ? 'Reutilizável (Mesmo Paciente)' : 'Uso Único'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {produto.lotsCount} lote(s)
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              produto.isLowStock
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-foreground'
                            }`}
                          >
                            {produto.availableUnitsCount} {produto.unidade}(s)
                          </span>
                          {produto.isLowStock && (
                            <Badge variant="destructive" className="text-[10px] uppercase px-1.5 py-0">
                              Baixo
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Total gerado: {produto.totalUnitsCount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={produto.isActive ? 'ativo' : 'inativo'} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs px-2"
                            onClick={() => handleOpenLotIntake(produto.id)}
                            title="Dar entrada em novo lote deste produto"
                          >
                            <PackagePlus className="h-3.5 w-3.5 mr-1" />
                            + Lote
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEditProduct(produto)}
                            title="Editar produto"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Unidades Físicas Rastreáveis (StockUnits) */}
        <TabsContent value="unidades" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground pb-2">
                Lista de unidades físicas rastreáveis em estoque. Cada frasco ou ampola possui um código
                serial único gerado na entrada do lote (§14–§17, §44).
              </div>

              {stockUnits.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="Nenhuma unidade física registrada"
                  description="Realize a entrada de lotes nos produtos cadastrados para gerar os códigos seriais físicos das unidades."
                  actionLabel="Registrar Primeira Entrada de Lote"
                  onAction={() => handleOpenLotIntake()}
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código Serial</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Regime</TableHead>
                        <TableHead>Vinculação ao Paciente</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockUnits.map((unit) => {
                        const isExpired =
                          unit.dataValidade && new Date(unit.dataValidade) < new Date();

                        return (
                          <TableRow key={unit.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono font-bold text-primary">
                              {unit.codigoSerial}
                            </TableCell>
                            <TableCell className="font-semibold">{unit.productName}</TableCell>
                            <TableCell className="font-mono text-xs">{unit.numeroLote}</TableCell>
                            <TableCell className="text-xs">
                              {unit.dataValidade ? (
                                <span className={isExpired ? 'text-destructive font-semibold' : ''}>
                                  {formatDate(new Date(unit.dataValidade))}
                                  {isExpired && ' (Vencido)'}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={unit.isReusable ? 'default' : 'outline'}
                                className="text-xs"
                              >
                                {unit.isReusable ? 'Reutilizável' : 'Uso Único'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {unit.currentClientName ? (
                                <div className="flex items-center gap-1.5 text-primary font-medium">
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  <span>{unit.currentClientName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Disponível geral</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={unit.status} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProductFormDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProductForEdit}
        onSuccess={() => {
          fetchProducts();
          fetchStockUnits();
        }}
      />

      <LotIntakeDialog
        open={isLotDialogOpen}
        onOpenChange={setIsLotDialogOpen}
        products={simpleProductsList}
        preselectedProductId={lotPreselectedProductId}
        onSuccess={() => {
          fetchProducts();
          fetchStockUnits();
        }}
      />
    </div>
  );
}
