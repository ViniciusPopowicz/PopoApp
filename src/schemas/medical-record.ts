import { z } from 'zod';

export const createMedicalRecordSchema = z.object({
  attendanceId: z.string().uuid('ID do atendimento inválido'),
  queixaPrincipal: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  avaliacaoClinica: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  condutaProcedimento: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  orientacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  observacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),

  // Semantic clinical aliases (Brazilian clinical terminology)
  anamnese: z.string().trim().max(10000).optional(),
  evolucaoClinica: z.string().trim().max(10000).optional(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional(),
  intercorrencias: z.string().trim().max(5000).optional(),
}).transform((data) => {
  const avaliacaoClinica = data.avaliacaoClinica ?? data.anamnese ?? null;
  const condutaProcedimento = data.condutaProcedimento ?? data.evolucaoClinica ?? null;
  const orientacoes = data.orientacoes ?? data.orientacoesPosProcedimento ?? null;

  let observacoes = data.observacoes ?? null;
  if (data.intercorrencias) {
    observacoes = observacoes
      ? `${observacoes}\n\n[Intercorrências]: ${data.intercorrencias}`
      : `[Intercorrências]: ${data.intercorrencias}`;
  }

  return {
    attendanceId: data.attendanceId,
    queixaPrincipal: data.queixaPrincipal ?? null,
    avaliacaoClinica,
    condutaProcedimento,
    orientacoes,
    observacoes,
  };
});

export const updateMedicalRecordSchema = z.object({
  queixaPrincipal: z.string().trim().max(5000).optional().nullable(),
  avaliacaoClinica: z.string().trim().max(10000).optional().nullable(),
  condutaProcedimento: z.string().trim().max(10000).optional().nullable(),
  orientacoes: z.string().trim().max(5000).optional().nullable(),
  observacoes: z.string().trim().max(5000).optional().nullable(),
  anamnese: z.string().trim().max(10000).optional(),
  evolucaoClinica: z.string().trim().max(10000).optional(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional(),
  intercorrencias: z.string().trim().max(5000).optional(),
}).transform((data) => {
  const avaliacaoClinica = data.avaliacaoClinica ?? data.anamnese;
  const condutaProcedimento = data.condutaProcedimento ?? data.evolucaoClinica;
  const orientacoes = data.orientacoes ?? data.orientacoesPosProcedimento;

  let observacoes = data.observacoes;
  if (data.intercorrencias !== undefined) {
    observacoes = observacoes
      ? `${observacoes}\n\n[Intercorrências]: ${data.intercorrencias}`
      : `[Intercorrências]: ${data.intercorrencias}`;
  }

  return {
    ...(data.queixaPrincipal !== undefined ? { queixaPrincipal: data.queixaPrincipal } : {}),
    ...(avaliacaoClinica !== undefined ? { avaliacaoClinica } : {}),
    ...(condutaProcedimento !== undefined ? { condutaProcedimento } : {}),
    ...(orientacoes !== undefined ? { orientacoes } : {}),
    ...(observacoes !== undefined ? { observacoes } : {}),
  };
});

export type CreateMedicalRecordInput = z.input<typeof createMedicalRecordSchema>;
export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>;
