'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { mockFinanceiro } from '@/data/mock/financeiro';

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState('Lançamentos');

  // Simple hardcoded period navigation for UI purposes
  const period = 'Setembro 2026';

  // Calculate totals
  const receitasTotais = mockFinanceiro.filter(t => t.tipo === 'receita').reduce((acc, curr) => acc + curr.valor, 0);
  const despesasTotais = mockFinanceiro.filter(t => t.tipo === 'despesa').reduce((acc, curr) => acc + curr.valor, 0);
  const saldo = receitasTotais - despesasTotais;

  // Group for summary
  const categoriasResumo = mockFinanceiro.reduce((acc, curr) => {
    if (!acc[curr.categoria]) {
      acc[curr.categoria] = { total: 0, tipo: curr.tipo };
    }
    acc[curr.categoria].total += curr.valor;
    return acc;
  }, {} as Record<string, { total: number, tipo: string }>);

  const maiorCategoria = Math.max(...Object.values(categoriasResumo).map(c => c.total));

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" description="Controle de receitas e despesas.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      </PageHeader>

      <div className="flex justify-between items-center bg-card p-4 rounded-md border">
        <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
        <span className="font-semibold text-lg">{period}</span>
        <Button variant="ghost" size="icon"><ChevronRight className="h-5 w-5" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          title="Receitas"
          value={formatCurrency(receitasTotais)}
          className="border-success/20 bg-success/5 text-success"
        />
        <StatCard
          icon={TrendingDown}
          title="Despesas"
          value={formatCurrency(despesasTotais)}
          className="border-error/20 bg-error/5 text-error"
        />
        <StatCard
          icon={DollarSign}
          title="Saldo"
          value={formatCurrency(saldo)}
          className="border-primary/20 bg-primary/5 text-primary"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="Lançamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="Resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="Lançamentos" className="m-0">
          <div className="rounded-md border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockFinanceiro.map((transacao) => (
                  <TableRow key={transacao.id}>
                    <TableCell>{formatDate(new Date(transacao.data))}</TableCell>
                    <TableCell className="font-medium">{transacao.descricao}</TableCell>
                    <TableCell className="capitalize">{transacao.categoria}</TableCell>
                    <TableCell>
                      {transacao.tipo === 'receita' 
                        ? <Badge className="bg-success/20 text-success hover:bg-success/30 border-none">Receita</Badge>
                        : <Badge className="bg-error/20 text-error hover:bg-error/30 border-none">Despesa</Badge>
                      }
                    </TableCell>
                    <TableCell className={`text-right font-medium ${transacao.tipo === 'receita' ? 'text-success' : 'text-error'}`}>
                      {transacao.tipo === 'receita' ? '+' : '-'}{formatCurrency(transacao.valor)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={transacao.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="Resumo" className="m-0">
          <Card>
            <CardContent className="p-6 space-y-6">
              {Object.entries(categoriasResumo).sort((a, b) => b[1].total - a[1].total).map(([cat, data]) => (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="capitalize font-medium">{cat}</span>
                    <span className="font-semibold">{formatCurrency(data.total)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${data.tipo === 'receita' ? 'bg-success' : 'bg-error'}`}
                      style={{ width: `${(data.total / maiorCategoria) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
