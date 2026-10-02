'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Activity, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { mockProcedimentos } from '@/data/mock/procedimentos';

export default function ProcedimentosPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProcedimentos = mockProcedimentos.filter(proc =>
    proc.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Procedimentos" description="Catálogo de tratamentos.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Procedimento
        </Button>
      </PageHeader>

      <div className="max-w-md">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar procedimento..."
        />
      </div>

      {filteredProcedimentos.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhum procedimento encontrado"
          description="Nenhum procedimento corresponde à busca."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcedimentos.map((proc) => (
            <Card key={proc.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg leading-tight">{proc.nome}</CardTitle>
                  <StatusBadge status={proc.status} />
                </div>
                <CardDescription className="line-clamp-2 mt-1 min-h-[40px]">{proc.descricao}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{proc.categoria}</Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Clock className="mr-1 h-4 w-4" />
                    {proc.duracao} min
                  </div>
                  <div className="font-semibold text-lg text-primary">
                    {formatCurrency(proc.preco)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
