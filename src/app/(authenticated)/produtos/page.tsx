'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Layers,
  AlertTriangle,
  RefreshCw,
  Edit,
  Eye,
  Repeat,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppCombobox } from '@/components/ui/app-combobox';
import { ListingToolbar } from '@/components/shared/listing-toolbar';
import { RowStatusToggle } from '@/components/shared/row-status-toggle';
import { useDebounce } from '@/hooks/use-debounce';
import { ProductFormDialog, ProductFormData } from '@/components/produtos/product-form-dialog';
import { LotIntakeDialog } from '@/components/produtos/lot-intake-dialog';
import { ProductDetailSheet } from '@/components/produtos/product-detail-sheet';
import { UnitActionDialog } from '@/components/produtos/unit-action-dialog';
import { ProductSummaryDto, StockUnitItemDto, StockUnitStatus } from '@/types/product';

export default function ProdutosEstoquePage() {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'unidades'>('catalogo');

  // Products catalog state
  const [products, setProducts] = useState<ProductSummaryDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Global stock units state
  const [units, setUnits] = useState<StockUnitItemDto[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const debouncedUnitSearch = useDebounce(unitSearch, 350);
  const [unitStatusFilter, setUnitStatusFilter] = useState<string>('ALL');
  const [unitProductFilter, setUnitProductFilter] = useState<string>('ALL');

  // Dialogs & Sheets state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);

  const [lotDialogOpen, setLotDialogOpen] = useState(false);
  const [preselectedProductForLot, setPreselectedProductForLot] = useState<string | null>(null);

  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [unitActionOpen, setUnitActionOpen] = useState(false);
  const [selectedUnitForAction, setSelectedUnitForAction] = useState<StockUnitItemDto | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (categoryFilter !== 'ALL') params.set('categoria', categoryFilter);
      if (activeFilter === 'ACTIVE') params.set('active', 'true');
      if (activeFilter === 'INACTIVE') params.set('active', 'false');

      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao buscar produtos');
      }
      setProducts(json.data || json.items || []);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [debouncedSearch, categoryFilter, activeFilter]);

  const fetchUnits = useCallback(async () => {
    setLoadingUnits(true);
    try {
      const params = new URLSearchParams();
      if (debouncedUnitSearch.trim()) params.set('search', debouncedUnitSearch.trim());
      if (unitStatusFilter !== 'ALL') params.set('status', unitStatusFilter);
      if (unitProductFilter !== 'ALL') params.set('productId', unitProductFilter);

      const res = await fetch(`/api/stock/units?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao buscar unidades');
      }
      setUnits(json.data || []);
    } catch (err) {
      console.error('Erro ao buscar unidades de estoque:', err);
    } finally {
      setLoadingUnits(false);
    }
  }, [debouncedUnitSearch, unitStatusFilter, unitProductFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Deep-link support (?productId=...) from Client Details (MELHORIA-015)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetProdId = params.get('productId');
    if (targetProdId) {
      setSelectedProductId(targetProdId);
      setDetailSheetOpen(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'unidades') {
      fetchUnits();
    }
  }, [activeTab, fetchUnits]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort();
  }, [products]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todas as Categorias' },
      ...categories.map((cat) => ({ value: cat, label: cat })),
    ],
    [categories]
  );

  const statusFilterOptions = [
    { value: 'ALL', label: 'Todos os Status' },
    { value: 'ACTIVE', label: 'Somente Ativos' },
    { value: 'INACTIVE', label: 'Somente Inativos' },
  ];

  const unitProductOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Todos os Produtos' },
      ...products.map((p) => ({
        value: p.id,
        label: `${p.nome}${p.marca ? ` (${p.marca})` : ''}`,
      })),
    ],
    [products]
  );

  const unitStatusOptions = [
    { value: 'ALL', label: 'Todos os Status' },
    { value: 'Disponivel', label: 'Disponível' },
    { value: 'EmUso', label: 'Em Uso (Aberto)' },
    { value: 'Esgotado', label: 'Esgotado' },
    { value: 'Descartado', label: 'Descartado' },
  ];

  const summaryMetrics = useMemo(() => {
    const activeProducts = products.filter((p) => p.isActive);
    const totalAvailableUnits = activeProducts.reduce(
      (acc, p) => acc + p.availableUnitsCount,
      0
    );
    const lowStockProducts = activeProducts.filter((p) => p.isLowStock).length;
    const totalLots = activeProducts.reduce((acc, p) => acc + p.lotsCount, 0);

    return {
      activeCount: activeProducts.length,
      totalAvailableUnits,
      lowStockProducts,
      totalLots,
    };
  }, [products]);

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleOpenEditProduct = (prod: ProductSummaryDto) => {
    setEditingProduct({
      id: prod.id,
      nome: prod.nome,
      categoria: prod.categoria,
      marca: prod.marca,
      descricao: prod.descricao,
      unidade: prod.unidade,
      trackingMode: prod.trackingMode,
      estoqueMinimo: prod.estoqueMinimo,
      isReusable: prod.isReusable,
      isActive: prod.isActive,
    });
    setProductDialogOpen(true);
  };

  const handleToggleProductStatus = async (prod: ProductSummaryDto, nextActive: boolean) => {
    const res = await fetch(`/api/products/${prod.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Falha ao atualizar status do produto');
    }
    setProducts((prev) =>
      prev.map((item) => (item.id === prod.id ? { ...item, isActive: nextActive } : item))
    );
  };

  const handleOpenNewLot = (productId?: string) => {
    setPreselectedProductForLot(productId || null);
    setLotDialogOpen(true);
  };

  const handleOpenDetails = (productId: string) => {
    setSelectedProductId(productId);
    setDetailSheetOpen(true);
  };

  const handleOpenUnitAction = (unit: StockUnitItemDto) => {
    setSelectedUnitForAction(unit);
    setUnitActionOpen(true);
  };

  const handleRefreshAll = () => {
    fetchProducts();
    if (activeTab === 'unidades') fetchUnits();
  };

  const getStatusBadge = (status: StockUnitStatus) => {
    switch (status) {
      case 'Disponivel':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Disponível
          </Badge>
        );
      case 'EmUso':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" /> Em Uso
          </Badge>
        );
      case 'Esgotado':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" /> Esgotado
          </Badge>
        );
      case 'Descartado':
        return (
          <Badge variant="destructive" className="gap-1">
            <Trash2 className="h-3 w-3" /> Descartado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Produtos & Controle de Estoque
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o catálogo de insumos clínicos, entrada de lotes e rastreabilidade individual por unidade física ou volume.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Produtos Ativos
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {summaryMetrics.activeCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Itens cadastrados no catálogo clínico
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Unidades Disponíveis
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summaryMetrics.totalAvailableUnits}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Prontas para consumo em atendimentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Alertas de Estoque Baixo
            </CardDescription>
            <CardTitle
              className={`text-2xl font-bold flex items-center gap-2 ${
                summaryMetrics.lowStockProducts > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
              }`}
            >
              {summaryMetrics.lowStockProducts}
              {summaryMetrics.lowStockProducts > 0 && (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Produtos abaixo do estoque mínimo configurado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Lotes Registrados
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {summaryMetrics.totalLots}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Histórico de entradas e validades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Catalog vs Physical Stock Units */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'catalogo' | 'unidades')}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="catalogo" className="gap-1.5">
              <Package className="h-4 w-4" />
              Catálogo de Produtos ({products.length})
            </TabsTrigger>
            <TabsTrigger value="unidades" className="gap-1.5">
              <Tag className="h-4 w-4" />
              Unidades Físicas em Estoque
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: CATÁLOGO DE PRODUTOS */}
        <TabsContent value="catalogo" className="space-y-4">
          <ListingToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por nome, marca ou descrição..."
            rightSlot={
              <>
                <div className="w-48">
                  <AppCombobox
                    options={categoryFilterOptions}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="Categoria"
                  />
                </div>
                <div className="w-44">
                  <AppCombobox
                    options={statusFilterOptions}
                    value={activeFilter}
                    onChange={(val) =>
                      setActiveFilter(val as 'ALL' | 'ACTIVE' | 'INACTIVE')
                    }
                    placeholder="Status"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchProducts}
                  title="Atualizar lista"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingProducts ? 'animate-spin' : ''}`}
                  />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOpenNewLot()}
                  className="gap-1.5"
                >
                  <Layers className="h-4 w-4" />
                  Entrada de Lote
                </Button>
                <Button onClick={handleOpenNewProduct} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </Button>
              </>
            }
          />

          <Card>
            <CardContent className="p-0">
              {loadingProducts ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Carregando catálogo de produtos...
                </div>
              ) : products.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Nenhum produto encontrado</p>
                    <p className="text-xs text-muted-foreground">
                      Cadastre seu primeiro produto clínico para iniciar o controle de lotes e unidades.
                    </p>
                  </div>
                  <Button size="sm" onClick={handleOpenNewProduct}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Cadastrar Produto
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto / Marca</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo de Uso</TableHead>
                      <TableHead className="text-center">Lotes</TableHead>
                      <TableHead className="text-center">Disponíveis / Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((prod) => (
                      <TableRow
                        key={prod.id}
                        className={`cursor-pointer ${!prod.isActive ? 'opacity-65' : ''}`}
                        onClick={() => handleOpenDetails(prod.id)}
                      >
                        <TableCell>
                          <div className="font-medium text-foreground">{prod.nome}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{prod.marca || 'Sem marca informada'}</span>
                            <span>•</span>
                            <span>Unid: {prod.unidade}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {prod.categoria ? (
                            <Badge variant="outline">{prod.categoria}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            {prod.trackingMode === 'QUANTITY' ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Rastreio: Quantidade ({prod.unidade})
                              </Badge>
                            ) : prod.isReusable ? (
                              <Badge variant="info" className="gap-1">
                                <Repeat className="h-3 w-3" /> Reutilizável
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Uso Único</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {prod.lotsCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {prod.trackingMode === 'QUANTITY' ? (
                              <span
                                className={`font-bold text-sm ${
                                  prod.totalQuantityAvailable === 0
                                    ? 'text-destructive'
                                    : prod.isLowStock
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {prod.totalQuantityAvailable} {prod.unidade}
                              </span>
                            ) : (
                              <>
                                <span
                                  className={`font-bold text-sm ${
                                    prod.availableUnitsCount === 0
                                      ? 'text-destructive'
                                      : prod.isLowStock
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {prod.availableUnitsCount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  / {prod.totalUnitsCount} {prod.unidade}
                                </span>
                              </>
                            )}
                            {prod.isActive && prod.isLowStock && (
                              <Badge
                                variant={
                                  (prod.trackingMode === 'QUANTITY'
                                    ? prod.totalQuantityAvailable
                                    : prod.availableUnitsCount) === 0
                                    ? 'destructive'
                                    : 'warning'
                                }
                                className="ml-1 text-[10px] px-1.5 py-0"
                              >
                                {(prod.trackingMode === 'QUANTITY'
                                  ? prod.totalQuantityAvailable
                                  : prod.availableUnitsCount) === 0
                                  ? 'Sem estoque'
                                  : 'Baixo'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <RowStatusToggle
                            isActive={prod.isActive}
                            onToggle={(nextState) =>
                              handleToggleProductStatus(prod, nextState)
                            }
                          />
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Registrar novo lote"
                              onClick={() => handleOpenNewLot(prod.id)}
                            >
                              <Layers className="h-4 w-4 mr-1 text-primary" />
                              <span className="hidden md:inline text-xs">+ Lote</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar produto"
                              onClick={() => handleOpenEditProduct(prod)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ver lotes e unidades"
                              onClick={() => handleOpenDetails(prod.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: UNIDADES FÍSICAS EM ESTOQUE */}
        <TabsContent value="unidades" className="space-y-4">
          <ListingToolbar
            searchValue={unitSearch}
            onSearchChange={setUnitSearch}
            searchPlaceholder="Buscar por código serial (ex: LOTE-001) ou produto..."
            rightSlot={
              <>
                <div className="w-56">
                  <AppCombobox
                    options={unitProductOptions}
                    value={unitProductFilter}
                    onChange={setUnitProductFilter}
                    placeholder="Produto"
                    searchable
                  />
                </div>
                <div className="w-48">
                  <AppCombobox
                    options={unitStatusOptions}
                    value={unitStatusFilter}
                    onChange={setUnitStatusFilter}
                    placeholder="Status da Unidade"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchUnits}
                  title="Atualizar unidades"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingUnits ? 'animate-spin' : ''}`}
                  />
                </Button>
                <Button onClick={() => handleOpenNewLot()} className="gap-1.5">
                  <Layers className="h-4 w-4" />
                  Entrada de Lote
                </Button>
              </>
            }
          />

          <Card>
            <CardContent className="p-0">
              {loadingUnits ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Carregando unidades físicas em estoque...
                </div>
              ) : units.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Tag className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-medium">Nenhuma unidade física encontrada</p>
                  <p className="text-xs text-muted-foreground">
                    Registre um lote de entrada para gerar unidades numeradas automaticamente.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Serial</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote / Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Usos Registrados</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map((u) => {
                      const isExpired =
                        u.dataValidade !== null && new Date(u.dataValidade) < new Date();
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs font-semibold">
                            {u.codigoSerial}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{u.productName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span>{u.productMarca || 'Sem marca'}</span>
                              {u.isReusable && (
                                <Badge variant="info" className="text-[10px] px-1.5 py-0">
                                  Reutilizável
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">Lote: {u.numeroLote}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>
                                Val:{' '}
                                {u.dataValidade
                                  ? new Date(u.dataValidade).toLocaleDateString('pt-BR')
                                  : 'N/A'}
                              </span>
                              {isExpired && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  Vencido
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(u.status)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{u.usagesCount} uso(s)</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenUnitAction(u)}
                            >
                              Gerenciar Status
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals and Side Sheets */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        onSuccess={handleRefreshAll}
      />

      <LotIntakeDialog
        open={lotDialogOpen}
        onOpenChange={setLotDialogOpen}
        products={products}
        preselectedProductId={preselectedProductForLot}
        onSuccess={handleRefreshAll}
      />

      <ProductDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        productId={selectedProductId}
        onOpenLotIntake={(prodId) => {
          setDetailSheetOpen(false);
          handleOpenNewLot(prodId);
        }}
        onUpdated={handleRefreshAll}
      />

      <UnitActionDialog
        open={unitActionOpen}
        onOpenChange={setUnitActionOpen}
        unit={selectedUnitForAction}
        onSuccess={handleRefreshAll}
      />
    </div>
  );
}
