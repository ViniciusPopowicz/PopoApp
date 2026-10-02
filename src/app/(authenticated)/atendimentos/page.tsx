'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ClipboardList, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { mockAtendimentos } from '@/data/mock/atendimentos';
import { mockClientes } from '@/data/mock/clientes';
import { mockProcedimentos } from '@/data/mock/procedimentos';

export default function AtendimentosPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Hydrate atendimentos with related data
  const hydratedAtendimentos = mockAtendimentos.map(atendimento => {
    const cliente = mockClientes.find(c => c.id === atendimento.clienteId);
    const procedimento = mockProcedimentos.find(p => p.id === atendimento.procedimentoId);
    
    return {
      ...atendimento,
      clienteNome: cliente?.nome || 'Desconhecido',
      procedimentosStr: procedimento?.nome || 'Nenhum',
    };
  });

  const filteredAtendimentos = hydratedAtendimentos.filter(atend =>
    atend.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    atend.procedimentosStr.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Atendimentos" description="Histórico de atendimentos realizados.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Atendimento
        </Button>
      </PageHeader>

      <div className="max-w-md">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por cliente ou procedimento..."
        />
      </div>

      {filteredAtendimentos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum atendimento encontrado"
          description="Nenhum atendimento corresponde à busca."
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Procedimento(s)</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAtendimentos.map((atendimento) => (
                <TableRow key={atendimento.id}>
                  <TableCell>{formatDate(new Date(atendimento.data))}</TableCell>
                  <TableCell className="font-medium">{atendimento.clienteNome}</TableCell>
                  <TableCell>{atendimento.procedimentosStr}</TableCell>
                  <TableCell>{formatCurrency(atendimento.valor)}</TableCell>
                  <TableCell>
                    <StatusBadge status={atendimento.statusPagamento} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
