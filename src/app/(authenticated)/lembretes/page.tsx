'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Bell, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { mockLembretes } from '@/data/mock/lembretes';

export default function LembretesPage() {
  const [activeTab, setActiveTab] = useState('Todos');

  const filterMap: Record<string, string[]> = {
    'Todos': ['pendente', 'emAndamento', 'concluido', 'atrasado'],
    'Pendentes': ['pendente'],
    'Em Andamento': ['emAndamento'],
    'Concluídos': ['concluido'],
    'Atrasados': ['atrasado']
  };

  const filteredLembretes = mockLembretes.filter(l => filterMap[activeTab].includes(l.status));

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'alta': return 'bg-error';
      case 'media': return 'bg-warning';
      case 'baixa': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Lembretes" description="Gerencie suas tarefas e follow-ups.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lembrete
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto mb-4">
          {Object.keys(filterMap).map(tab => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>

        {filteredLembretes.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhum lembrete encontrado"
            description={`Não há lembretes na categoria "${activeTab}".`}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLembretes.map(lembrete => (
              <Card key={lembrete.id} className={lembrete.status === 'concluido' ? 'opacity-70' : ''}>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getPriorityDot(lembrete.prioridade)}`} title={`Prioridade ${lembrete.prioridade}`} />
                      <h3 className="font-semibold text-base leading-tight">{lembrete.titulo}</h3>
                    </div>
                    <StatusBadge status={lembrete.status} />
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                    {lembrete.descricao}
                  </p>
                  
                  <div className="flex justify-between items-center border-t pt-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">{lembrete.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(new Date(lembrete.data))}</span>
                    </div>
                    
                    <div className="flex gap-1">
                      {lembrete.status !== 'concluido' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success hover:bg-success/10">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-error hover:text-error hover:bg-error/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}
