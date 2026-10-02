'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { mockProdutos } from '@/data/mock/produtos';

export default function ProdutosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');

  const categories = ['Todos', 'Toxinas', 'Preenchedores', 'Bioestimuladores', 'Skinboosters', 'Fios', 'Outros'];

  const filteredProdutos = mockProdutos.filter(produto => {
    const matchesSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeTab === 'Todos' || produto.categoria === activeTab;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Controle de estoque.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </PageHeader>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar produto..."
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>
        
        <div className="mt-4">
          {filteredProdutos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto encontrado"
              description="Nenhum produto corresponde aos filtros atuais."
            />
          ) : (
            <div className="rounded-md border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProdutos.map((produto) => (
                    <TableRow key={produto.id}>
                      <TableCell className="font-medium">{produto.nome}</TableCell>
                      <TableCell>{produto.categoria}</TableCell>
                      <TableCell>{produto.marca}</TableCell>
                      <TableCell>{formatCurrency(produto.preco)}</TableCell>
                      <TableCell>
                        <span className={produto.estoque < 5 ? 'text-error font-medium' : ''}>
                          {produto.estoque} {produto.unidade}(s)
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={produto.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
