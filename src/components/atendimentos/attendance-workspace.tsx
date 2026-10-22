'use client';

import { useState, useEffect } from 'react';
import { AttendanceHeader } from './attendance-header';
import { AttendanceProceduresSection } from './attendance-procedures-section';
import { AttendanceProductUsagesSection } from './attendance-product-usages-section';
import { AttendanceMedicalRecordSection } from './attendance-medical-record-section';
import { AttendanceAttachmentsSection } from './attendance-attachments-section';
import { AttendanceFinancialSection } from './attendance-financial-section';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Stethoscope, Boxes, FileText, Camera, DollarSign, AlertCircle } from 'lucide-react';

interface AttendanceWorkspaceProps {
  attendanceId: string;
}

export function AttendanceWorkspace({ attendanceId }: AttendanceWorkspaceProps) {
  const [attendance, setAttendance] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('procedimentos');

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/attendances/${attendanceId}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar detalhes do atendimento.');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setAttendance(json.data);
      } else {
        throw new Error(json.error || 'Erro ao processar dados do atendimento.');
      }
    } catch (err: any) {
      console.error('Error fetching attendance workspace:', err);
      setError(err.message || 'Erro ao carregar workspace clínico.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceId]);

  if (loading && !attendance) {
    return (
      <div className="p-12 text-center text-muted-foreground text-sm">
        Carregando workspace clínico do atendimento...
      </div>
    );
  }

  if (error && !attendance) {
    return (
      <div className="p-6 bg-destructive/15 text-destructive rounded-lg border border-destructive/20 text-sm flex items-center gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Erro ao abrir atendimento clínico</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!attendance) {
    return (
      <div className="p-12 text-center text-muted-foreground text-sm">
        Atendimento não encontrado.
      </div>
    );
  }

  const financials = attendance.financials || {
    standardTotal: 0,
    practicedTotal: 0,
    explicitDiscount: Number(attendance.desconto || 0),
    netTotal: 0,
    paidTotal: 0,
    outstandingBalance: 0,
    isFullyPaid: false,
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <AttendanceHeader attendance={attendance} onRefresh={fetchAttendance} />

      {/* Clinical Workspace Sections via Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="procedimentos" className="text-xs sm:text-sm py-2 gap-1.5">
            <Stethoscope className="h-4 w-4" />
            <span>Procedimentos</span>
          </TabsTrigger>
          <TabsTrigger value="produtos" className="text-xs sm:text-sm py-2 gap-1.5">
            <Boxes className="h-4 w-4" />
            <span>Produtos / Estoque</span>
          </TabsTrigger>
          <TabsTrigger value="prontuario" className="text-xs sm:text-sm py-2 gap-1.5">
            <FileText className="h-4 w-4" />
            <span>Prontuário</span>
          </TabsTrigger>
          <TabsTrigger value="anexos" className="text-xs sm:text-sm py-2 gap-1.5">
            <Camera className="h-4 w-4" />
            <span>Fotos & Anexos</span>
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs sm:text-sm py-2 gap-1.5 col-span-2 sm:col-span-1">
            <DollarSign className="h-4 w-4" />
            <span>Financeiro</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Procedimentos */}
        <TabsContent value="procedimentos" className="mt-4">
          <AttendanceProceduresSection
            attendanceId={attendance.id}
            status={attendance.status}
            procedures={attendance.procedures || []}
            currentDiscount={Number(attendance.desconto || 0)}
            onRefresh={fetchAttendance}
          />
        </TabsContent>

        {/* Tab 2: Produtos / Estoque */}
        <TabsContent value="produtos" className="mt-4">
          <AttendanceProductUsagesSection
            attendanceId={attendance.id}
            clientId={attendance.clientId}
            status={attendance.status}
            procedures={attendance.procedures || []}
            onRefresh={fetchAttendance}
          />
        </TabsContent>

        {/* Tab 3: Prontuário */}
        <TabsContent value="prontuario" className="mt-4">
          <AttendanceMedicalRecordSection
            attendanceId={attendance.id}
            status={attendance.status}
          />
        </TabsContent>

        {/* Tab 4: Fotos & Anexos */}
        <TabsContent value="anexos" className="mt-4">
          <AttendanceAttachmentsSection
            attendanceId={attendance.id}
            status={attendance.status}
          />
        </TabsContent>

        {/* Tab 5: Financeiro */}
        <TabsContent value="financeiro" className="mt-4">
          <AttendanceFinancialSection
            attendanceId={attendance.id}
            status={attendance.status}
            financials={financials}
            payments={attendance.payments || []}
            onRefresh={fetchAttendance}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
