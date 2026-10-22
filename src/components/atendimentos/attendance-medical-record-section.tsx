'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

interface AttendanceMedicalRecordSectionProps {
  attendanceId: string;
  status: 'Pendente' | 'Realizado' | 'Cancelado';
}

export function AttendanceMedicalRecordSection({
  attendanceId,
  status,
}: AttendanceMedicalRecordSectionProps) {
  const [recordExists, setRecordExists] = useState(false);
  const [anamnese, setAnamnese] = useState('');
  const [evolucaoClinica, setEvolucaoClinica] = useState('');
  const [orientacoesPosProcedimento, setOrientacoesPosProcedimento] = useState('');
  const [intercorrencias, setIntercorrencias] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isEditable = status !== 'Cancelado';

  useEffect(() => {
    const loadRecord = async () => {
      try {
        setFetching(true);
        setError(null);
        const res = await fetch(`/api/attendances/${attendanceId}/record`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setRecordExists(true);
            setAnamnese(json.data.anamnese || json.data.queixaPrincipal || '');
            setEvolucaoClinica(json.data.evolucaoClinica || json.data.condutaProcedimento || json.data.avaliacaoClinica || '');
            setOrientacoesPosProcedimento(json.data.orientacoesPosProcedimento || json.data.orientacoes || '');
            setIntercorrencias(json.data.intercorrencias || '');
            setLastUpdated(json.data.updatedAt || json.data.createdAt);
          }
        }
      } catch (err: any) {
        console.error('Error fetching medical record:', err);
      } finally {
        setFetching(false);
      }
    };

    loadRecord();
  }, [attendanceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        anamnese: anamnese.trim() || undefined,
        evolucaoClinica: evolucaoClinica.trim() || undefined,
        orientacoesPosProcedimento: orientacoesPosProcedimento.trim() || undefined,
        intercorrencias: intercorrencias.trim() || undefined,
      };

      const method = recordExists ? 'PUT' : 'POST';
      const res = await fetch(`/api/attendances/${attendanceId}/record`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao salvar prontuário clínico.');
      }

      setRecordExists(true);
      setLastUpdated(new Date().toISOString());
      setSuccessMessage('Prontuário clínico salvo com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar anotações do prontuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Prontuário e Anotações Clínicas (1:1)
          </CardTitle>
          <CardDescription>
            Registro de anamnese, evolução do procedimento, cuidados pós-procedimento e histórico de intercorrências.
          </CardDescription>
        </div>

        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Última atualização: {formatDateTime(new Date(lastUpdated))}
          </span>
        )}
      </CardHeader>

      <CardContent>
        {fetching ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando dados do prontuário...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-success/15 text-success rounded-md text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Anamnese / Queixa Principal */}
            <div className="space-y-1.5">
              <Label htmlFor="anamnese" className="font-semibold text-sm">
                Anamnese / Queixa Principal
              </Label>
              <Textarea
                id="anamnese"
                rows={3}
                placeholder="Relato do paciente, queixas, expectativas e histórico relevante..."
                value={anamnese}
                onChange={(e) => setAnamnese(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            {/* Evolução Clínica / Conduta */}
            <div className="space-y-1.5">
              <Label htmlFor="evolucao" className="font-semibold text-sm">
                Evolução Clínica e Conduta do Procedimento
              </Label>
              <Textarea
                id="evolucao"
                rows={4}
                placeholder="Detalhes da execução técnica, anestesia, técnica aplicada, produtos utilizados..."
                value={evolucaoClinica}
                onChange={(e) => setEvolucaoClinica(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            {/* Orientações Pós-Procedimento */}
            <div className="space-y-1.5">
              <Label htmlFor="orientacoes" className="font-semibold text-sm">
                Orientações Pós-Procedimento
              </Label>
              <Textarea
                id="orientacoes"
                rows={3}
                placeholder="Cuidados domiciliares, restrições solares, medicamentos tópicos e data de retorno..."
                value={orientacoesPosProcedimento}
                onChange={(e) => setOrientacoesPosProcedimento(e.target.value)}
                disabled={!isEditable}
              />
            </div>

            {/* Intercorrências */}
            <div className="space-y-1.5">
              <Label htmlFor="intercorrencias" className="font-semibold text-sm text-destructive">
                Intercorrências ou Reações Adversas
              </Label>
              <Textarea
                id="intercorrencias"
                rows={2}
                placeholder="Registro de quaisquer anormalidades, hematomas, reações alérgicas ou conduta corretiva..."
                value={intercorrencias}
                onChange={(e) => setIntercorrencias(e.target.value)}
                disabled={!isEditable}
                className="border-destructive/30 focus-visible:ring-destructive"
              />
            </div>

            {isEditable && (
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={loading} className="gap-2">
                  <Save className="h-4 w-4" />
                  {loading ? 'Salvando...' : 'Salvar Prontuário'}
                </Button>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
