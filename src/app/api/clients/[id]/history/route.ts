import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { AttendanceService } from '@/services/attendance.service';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const clientData = await ClientService.getClientWithHistory(id);

    // Build chronological clinical timeline combining attendances and appointments
    const timelineItems: any[] = [];

    let totalPracticed = 0;
    let totalDiscount = 0;
    let totalPaid = 0;

    for (const att of clientData.attendances) {
      const financials = AttendanceService.computeFinancials(att);
      totalPracticed += financials.practicedTotal;
      totalDiscount += financials.explicitDiscount;
      totalPaid += financials.paidTotal;

      timelineItems.push({
        type: 'attendance',
        id: att.id,
        dataHora: att.dataHora.toISOString(),
        status: att.status,
        completedAt: att.completedAt ? att.completedAt.toISOString() : null,
        desconto: Number(att.desconto),
        observacoes: att.observacoes,
        procedures: att.procedures.map((p) => ({
          id: p.id,
          nome: p.procedure.nome,
          standardValue: Number(p.standardValueSnapshot),
          practicedValue: Number(p.practicedValue),
          observacoes: p.observacoes,
        })),
        productUsages: att.productUsages.map((u) => ({
          id: u.id,
          serial: u.stockUnit.codigoSerial,
          product: u.stockUnit.lot.product.nome,
          isReusable: u.stockUnit.lot.product.isReusable,
          lot: u.stockUnit.lot.numeroLote,
          dataHora: u.dataHora.toISOString(),
          observacoes: u.observacoes,
        })),
        medicalRecord: att.medicalRecord
          ? {
              id: att.medicalRecord.id,
              queixaPrincipal: att.medicalRecord.queixaPrincipal,
              avaliacaoClinica: att.medicalRecord.avaliacaoClinica,
              condutaProcedimento: att.medicalRecord.condutaProcedimento,
              orientacoes: att.medicalRecord.orientacoes,
              observacoes: att.medicalRecord.observacoes,
              createdAt: att.medicalRecord.createdAt.toISOString(),
              updatedAt: att.medicalRecord.updatedAt.toISOString(),
            }
          : null,
        attachments: att.attachments.map((a) => ({
          id: a.id,
          nomeOriginal: a.nomeOriginal,
          categoria: a.categoria,
          mimeType: a.mimeType,
          tamanhoBytes: a.tamanhoBytes,
          createdAt: a.createdAt.toISOString(),
        })),
        payments: att.payments.map((pay) => ({
          id: pay.id,
          valor: Number(pay.valor),
          metodo: pay.metodo,
          status: pay.status,
          dataPagamento: pay.dataPagamento ? pay.dataPagamento.toISOString() : null,
        })),
        financials,
      });
    }

    for (const appt of clientData.appointments) {
      timelineItems.push({
        type: 'appointment',
        id: appt.id,
        dataHora: appt.dataHora.toISOString(),
        status: appt.status,
        valorEstimado: Number(appt.valorEstimado),
        observacoes: appt.observacoes,
        motivoCancelamento: appt.motivoCancelamento,
        rescheduledFromId: appt.rescheduledFromId,
        rescheduledToId: appt.rescheduledToId,
        plannedProcedures: appt.plannedProcedures.map((pp) => ({
          id: pp.id,
          nome: pp.procedure.nome,
          duracaoMinutos: pp.procedure.duracaoMinutos,
          valorPadrao: Number(pp.procedure.valorPadrao),
        })),
      });
    }

    // Sort timeline chronologically descending (newest first)
    timelineItems.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

    const netTotal = Math.max(0, totalPracticed - totalDiscount);
    const outstandingBalance = Math.max(0, netTotal - totalPaid);

    return NextResponse.json({
      success: true,
      data: {
        client: {
          id: clientData.id,
          nome: clientData.nome,
          cpf: clientData.cpf,
          telefone: clientData.telefone,
          email: clientData.email,
          dataNascimento: clientData.dataNascimento ? clientData.dataNascimento.toISOString() : null,
          endereco: clientData.endereco,
          observacoes: clientData.observacoes,
          status: clientData.status,
          emergencyContacts: clientData.emergencyContacts,
          attachments: clientData.attachments,
        },
        financialSummary: {
          totalPracticed,
          totalDiscount,
          netTotal,
          totalPaid,
          outstandingBalance,
        },
        timeline: timelineItems,
        assignedStockUnits: clientData.stockUnits.map((su) => ({
          id: su.id,
          codigoSerial: su.codigoSerial,
          status: su.status,
          productName: su.lot.product.nome,
          isReusable: su.lot.product.isReusable,
          numeroLote: su.lot.numeroLote,
        })),
      },
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar histórico do cliente' }, { status: 500 });
  }
}
