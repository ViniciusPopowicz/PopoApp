import { z } from 'zod';

const INTERCORRENCIAS_MARKER = '[Intercorrências]:';

export function formatIntercorrenciasIntoObservacoes(
  observacoes: string | null | undefined,
  intercorrencias: string | null | undefined
): string | null {
  const cleanObs = observacoes?.trim() || '';
  const cleanInter = intercorrencias?.trim() || '';

  // Remove any previous [Intercorrências]: block from cleanObs if present
  const markerIdx = cleanObs.indexOf(INTERCORRENCIAS_MARKER);
  const baseObs =
    markerIdx >= 0 ? cleanObs.slice(0, markerIdx).trim() : cleanObs;

  if (cleanInter) {
    return baseObs
      ? `${baseObs}\n\n${INTERCORRENCIAS_MARKER} ${cleanInter}`
      : `${INTERCORRENCIAS_MARKER} ${cleanInter}`;
  }

  return baseObs || null;
}

export function extractBaseObservacoes(
  observacoes: string | null | undefined
): string | null {
  if (!observacoes) return null;
  const markerIdx = observacoes.indexOf(INTERCORRENCIAS_MARKER);
  const baseObs =
    markerIdx >= 0 ? observacoes.slice(0, markerIdx).trim() : observacoes.trim();
  return baseObs || null;
}

export function extractIntercorrenciasFromObservacoes(
  observacoes: string | null | undefined
): string | null {
  if (!observacoes) return null;
  const markerIdx = observacoes.indexOf(INTERCORRENCIAS_MARKER);
  if (markerIdx >= 0) {
    const extracted = observacoes
      .slice(markerIdx + INTERCORRENCIAS_MARKER.length)
      .trim();
    return extracted || null;
  }
  return null;
}

export const createMedicalRecordSchema = z.object({
  attendanceId: z.string().uuid('ID do atendimento inválido'),
  queixaPrincipal: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  avaliacaoClinica: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  condutaProcedimento: z.string().trim().max(10000, 'Texto muito longo').optional().nullable(),
  orientacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),
  observacoes: z.string().trim().max(5000, 'Texto muito longo').optional().nullable(),

  // Semantic clinical aliases (Brazilian clinical terminology)
  anamnese: z.string().trim().max(10000).optional().nullable(),
  evolucaoClinica: z.string().trim().max(10000).optional().nullable(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional().nullable(),
  intercorrencias: z.string().trim().max(5000).optional().nullable(),
}).transform((data) => {
  const cleanQueixa = data.queixaPrincipal?.trim() || null;
  const cleanAnamnese = data.anamnese?.trim() || null;
  const cleanAvaliacao = data.avaliacaoClinica?.trim() || null;
  const cleanConduta = data.condutaProcedimento?.trim() || null;
  const cleanEvolucao = data.evolucaoClinica?.trim() || null;
  const cleanOrientacoes = data.orientacoes?.trim() || null;
  const cleanOrientacoesPos = data.orientacoesPosProcedimento?.trim() || null;

  // Map anamnese to queixaPrincipal (when queixaPrincipal is not separately provided)
  // and keep avaliacaoClinica populated for backward compatibility with existing clinical consumers.
  const queixaPrincipal = cleanQueixa ?? cleanAnamnese ?? null;
  const avaliacaoClinica = cleanAvaliacao ?? cleanAnamnese ?? null;
  const condutaProcedimento = cleanConduta ?? cleanEvolucao ?? null;
  const orientacoes = cleanOrientacoes ?? cleanOrientacoesPos ?? null;

  const observacoes =
    data.intercorrencias !== undefined
      ? formatIntercorrenciasIntoObservacoes(data.observacoes, data.intercorrencias)
      : data.observacoes?.trim() || null;

  return {
    attendanceId: data.attendanceId,
    queixaPrincipal,
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
  anamnese: z.string().trim().max(10000).optional().nullable(),
  evolucaoClinica: z.string().trim().max(10000).optional().nullable(),
  orientacoesPosProcedimento: z.string().trim().max(5000).optional().nullable(),
  intercorrencias: z.string().trim().max(5000).optional().nullable(),
}).transform((data) => {
  const result: Record<string, string | null> = {};

  if (data.queixaPrincipal !== undefined) {
    result.queixaPrincipal = data.queixaPrincipal?.trim() || null;
  } else if (data.anamnese !== undefined) {
    result.queixaPrincipal = data.anamnese?.trim() || null;
  }

  if (data.avaliacaoClinica !== undefined) {
    result.avaliacaoClinica = data.avaliacaoClinica?.trim() || null;
  } else if (data.anamnese !== undefined) {
    result.avaliacaoClinica = data.anamnese?.trim() || null;
  }

  if (data.condutaProcedimento !== undefined) {
    result.condutaProcedimento = data.condutaProcedimento?.trim() || null;
  } else if (data.evolucaoClinica !== undefined) {
    result.condutaProcedimento = data.evolucaoClinica?.trim() || null;
  }

  if (data.orientacoes !== undefined) {
    result.orientacoes = data.orientacoes?.trim() || null;
  } else if (data.orientacoesPosProcedimento !== undefined) {
    result.orientacoes = data.orientacoesPosProcedimento?.trim() || null;
  }

  if (data.observacoes !== undefined) {
    result.observacoes = data.observacoes?.trim() || null;
  }

  if (data.intercorrencias !== undefined) {
    result.intercorrencias = data.intercorrencias?.trim() || null;
  }

  return result;
});

export type CreateMedicalRecordInput = z.input<typeof createMedicalRecordSchema>;
export type UpdateMedicalRecordInput = z.input<typeof updateMedicalRecordSchema>;
