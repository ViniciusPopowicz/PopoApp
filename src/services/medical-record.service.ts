import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { CreateMedicalRecordInput, UpdateMedicalRecordInput } from '@/schemas/medical-record';

export class MedicalRecordService {
  /**
   * Creates a medical record for an attendance.
   * Strictly enforces 1:1 relationship with Attendance (V19).
   */
  static async createMedicalRecord(data: CreateMedicalRecordInput) {
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

    try {
      const record = await prisma.medicalRecord.create({
        data: {
          attendanceId: data.attendanceId,
          queixaPrincipal: data.queixaPrincipal,
          avaliacaoClinica: data.avaliacaoClinica,
          condutaProcedimento: data.condutaProcedimento,
          orientacoes: data.orientacoes,
          observacoes: data.observacoes,
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

      return record;
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

    return record;
  }

  /**
   * Updates clinical fields of an existing medical record.
   */
  static async updateByAttendanceId(attendanceId: string, data: UpdateMedicalRecordInput) {
    const existing = await prisma.medicalRecord.findUnique({
      where: { attendanceId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Prontuário não encontrado para este atendimento');
    }

    return prisma.medicalRecord.update({
      where: { attendanceId },
      data,
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
  }

  /**
   * Retrieves all medical records for a specific client across attendances.
   */
  static async getClientMedicalRecords(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.medicalRecord.findMany({
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
  }
}
