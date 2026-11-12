import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { ensureDatabaseSchema } from '@/lib/db-bootstrap';
import {
  CreateMedicalRecordInput,
  UpdateMedicalRecordInput,
  extractBaseObservacoes,
  extractIntercorrenciasFromObservacoes,
  formatIntercorrenciasIntoObservacoes,
} from '@/schemas/medical-record';

export function enrichMedicalRecord<
  T extends {
    queixaPrincipal: string | null;
    avaliacaoClinica: string | null;
    condutaProcedimento: string | null;
    orientacoes: string | null;
    observacoes: string | null;
  }
>(record: T) {
  return {
    ...record,
    anamnese: record.queixaPrincipal ?? record.avaliacaoClinica ?? null,
    evolucaoClinica: record.condutaProcedimento ?? null,
    orientacoesPosProcedimento: record.orientacoes ?? null,
    intercorrencias: extractIntercorrenciasFromObservacoes(record.observacoes),
    observacoesLimpa: extractBaseObservacoes(record.observacoes),
  };
}

export class MedicalRecordService {
  /**
   * Creates a medical record for an attendance.
   * Strictly enforces 1:1 relationship with Attendance (V19).
   */
  static async createMedicalRecord(data: CreateMedicalRecordInput) {
    await ensureDatabaseSchema();

    // 1. Verify Attendance exists
    const attendance = await prisma.attendance.findUnique({
      where: { id: data.attendanceId },
      include: { medicalRecord: { select: { id: true } } },
    });

    if (!attendance) {
      throw new NotFoundError('Atendimento não encontrado');
    }

    // 2. Attendance cannot be Cancelado
    if (attendance.status === 'Cancelado') {
      throw new ValidationError('Não é possível criar prontuário para um atendimento cancelado');
    }

    // 3. Strict 1:1 check (V19)
    if (attendance.medicalRecord) {
      throw new ConflictError('Atendimento já possui prontuário cadastrado (V19)');
    }

    const rawAnamnese = (data as any).anamnese?.trim() || null;
    const rawEvolucao = (data as any).evolucaoClinica?.trim() || null;
    const rawOrientacoesPos = (data as any).orientacoesPosProcedimento?.trim() || null;
    const rawIntercorrencias = (data as any).intercorrencias;

    const queixaPrincipal = data.queixaPrincipal?.trim() || rawAnamnese || null;
    const avaliacaoClinica = data.avaliacaoClinica?.trim() || rawAnamnese || null;
    const condutaProcedimento = data.condutaProcedimento?.trim() || rawEvolucao || null;
    const orientacoes = data.orientacoes?.trim() || rawOrientacoesPos || null;
    const observacoes =
      rawIntercorrencias !== undefined
        ? formatIntercorrenciasIntoObservacoes(data.observacoes, rawIntercorrencias)
        : data.observacoes?.trim() || null;

    try {
      const record = await prisma.medicalRecord.create({
        data: {
          attendanceId: data.attendanceId,
          queixaPrincipal,
          avaliacaoClinica,
          condutaProcedimento,
          orientacoes,
          observacoes,
        },
        include: {
          attendance: {
            include: {
              client: { select: { id: true, nome: true, cpf: true } },
              procedures: { include: { procedure: true } },
              productUsages: {
                include: {
                  stockUnit: {
                    include: { lot: { include: { product: true } } },
                  },
                },
              },
              attachments: true,
            },
          },
        },
      });

      return enrichMedicalRecord(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Atendimento já possui prontuário cadastrado (V19)');
      }
      throw error;
    }
  }

  /**
   * Retrieves medical record by attendance ID with clinical context.
   */
  static async getByAttendanceId(attendanceId: string) {
    await ensureDatabaseSchema();

    const record = await prisma.medicalRecord.findUnique({
      where: { attendanceId },
      include: {
        attendance: {
          include: {
            client: true,
            procedures: { include: { procedure: true } },
            productUsages: {
              include: {
                stockUnit: {
                  include: { lot: { include: { product: true } } },
                },
              },
            },
            attachments: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundError('Prontuário não encontrado para este atendimento');
    }

    return enrichMedicalRecord(record);
  }

  /**
   * Updates clinical fields of an existing medical record.
   */
  static async updateByAttendanceId(attendanceId: string, data: UpdateMedicalRecordInput) {
    await ensureDatabaseSchema();

    const existing = await prisma.medicalRecord.findUnique({
      where: { attendanceId },
      select: { id: true, observacoes: true },
    });

    if (!existing) {
      throw new NotFoundError('Prontuário não encontrado para este atendimento');
    }

    const updatePayload: Prisma.MedicalRecordUpdateInput = {};

    if (data.queixaPrincipal !== undefined) {
      updatePayload.queixaPrincipal = data.queixaPrincipal?.trim() || null;
    } else if ((data as any).anamnese !== undefined) {
      updatePayload.queixaPrincipal = (data as any).anamnese?.trim() || null;
    }

    if (data.avaliacaoClinica !== undefined) {
      updatePayload.avaliacaoClinica = data.avaliacaoClinica?.trim() || null;
    } else if ((data as any).anamnese !== undefined) {
      updatePayload.avaliacaoClinica = (data as any).anamnese?.trim() || null;
    }

    if (data.condutaProcedimento !== undefined) {
      updatePayload.condutaProcedimento = data.condutaProcedimento?.trim() || null;
    } else if ((data as any).evolucaoClinica !== undefined) {
      updatePayload.condutaProcedimento = (data as any).evolucaoClinica?.trim() || null;
    }

    if (data.orientacoes !== undefined) {
      updatePayload.orientacoes = data.orientacoes?.trim() || null;
    } else if ((data as any).orientacoesPosProcedimento !== undefined) {
      updatePayload.orientacoes = (data as any).orientacoesPosProcedimento?.trim() || null;
    }

    if ((data as any).intercorrencias !== undefined) {
      const baseObs = data.observacoes !== undefined ? data.observacoes : existing.observacoes;
      updatePayload.observacoes = formatIntercorrenciasIntoObservacoes(
        baseObs,
        (data as any).intercorrencias
      );
    } else if (data.observacoes !== undefined) {
      const explicitInter = extractIntercorrenciasFromObservacoes(data.observacoes);
      const existingInter = extractIntercorrenciasFromObservacoes(existing.observacoes);
      updatePayload.observacoes = formatIntercorrenciasIntoObservacoes(
        data.observacoes,
        explicitInter ?? existingInter
      );
    }

    const updated = await prisma.medicalRecord.update({
      where: { attendanceId },
      data: updatePayload,
      include: {
        attendance: {
          include: {
            client: { select: { id: true, nome: true } },
            procedures: { include: { procedure: true } },
            attachments: true,
          },
        },
      },
    });

    return enrichMedicalRecord(updated);
  }

  /**
   * Retrieves all medical records for a specific client across attendances.
   */
  static async getClientMedicalRecords(clientId: string) {
    await ensureDatabaseSchema();

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    const records = await prisma.medicalRecord.findMany({
      where: {
        attendance: {
          clientId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        attendance: {
          include: {
            procedures: { include: { procedure: true } },
            productUsages: {
              include: {
                stockUnit: {
                  include: { lot: { include: { product: true } } },
                },
              },
            },
            attachments: true,
          },
        },
      },
    });

    return records.map(enrichMedicalRecord);
  }
}
