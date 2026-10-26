import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { normalizeCpf, isValidCpf } from '@/lib/cpf';
import { ValidationError, ConflictError, NotFoundError } from '@/lib/errors';
import {
  CreateClientInput,
  UpdateClientInput,
  EmergencyContactInput,
  ClientListQuery,
} from '@/schemas/client';

export class ClientService {
  /**
   * Registers a new client with mandatory, valid, unique CPF and optional emergency contacts (D4, AC 62, V01, V02, V13).
   */
  static async createClient(data: CreateClientInput) {
    if (!data.cpf) {
      throw new ValidationError('CPF é obrigatório');
    }

    const cleanCpf = normalizeCpf(data.cpf);
    if (!isValidCpf(cleanCpf)) {
      throw new ValidationError('CPF inválido');
    }

    // Pre-check for duplicate CPF
    const existingClient = await prisma.client.findUnique({
      where: { cpf: cleanCpf },
      select: { id: true },
    });

    if (existingClient) {
      throw new ConflictError('CPF já cadastrado para outro cliente');
    }

    try {
      const client = await prisma.client.create({
        data: {
          nome: data.nome.trim(),
          cpf: cleanCpf,
          telefone: data.telefone.trim(),
          email: data.email ? data.email.trim() : null,
          dataNascimento: data.dataNascimento ?? null,
          endereco: data.endereco ? data.endereco.trim() : null,
          observacoes: data.observacoes ? data.observacoes.trim() : null,
          status: data.status ?? 'ativo',
          ...(data.emergencyContacts && data.emergencyContacts.length > 0
            ? {
                emergencyContacts: {
                  create: data.emergencyContacts.map((contact) => ({
                    nome: contact.nome.trim(),
                    telefone: contact.telefone.trim(),
                    parentesco: contact.parentesco.trim(),
                    observacoes: contact.observacoes ? contact.observacoes.trim() : null,
                    isActive: contact.isActive ?? true,
                  })),
                },
              }
            : {}),
        },
        include: {
          emergencyContacts: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (data.emergencyContacts && data.emergencyContacts.length > 0 && client.emergencyContacts) {
        const orderMap = new Map(data.emergencyContacts.map((c, i) => [c.nome.trim(), i]));
        client.emergencyContacts.sort((a, b) => {
          const orderA = orderMap.get(a.nome) ?? 0;
          const orderB = orderMap.get(b.nome) ?? 0;
          return orderA - orderB;
        });
      }

      return client;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('CPF já cadastrado para outro cliente');
      }
      throw error;
    }
  }

  /**
   * Updates an existing client's information.
   */
  static async updateClient(id: string, data: UpdateClientInput) {
    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, cpf: true },
    });

    if (!existing) {
      throw new NotFoundError('Cliente não encontrado');
    }

    let cleanCpf: string | undefined = undefined;
    if (data.cpf !== undefined) {
      cleanCpf = normalizeCpf(data.cpf);
      if (!isValidCpf(cleanCpf)) {
        throw new ValidationError('CPF inválido');
      }

      if (cleanCpf !== existing.cpf) {
        const duplicate = await prisma.client.findUnique({
          where: { cpf: cleanCpf },
          select: { id: true },
        });

        if (duplicate && duplicate.id !== id) {
          throw new ConflictError('CPF já cadastrado para outro cliente');
        }
      }
    }

    try {
      const updated = await prisma.client.update({
        where: { id },
        data: {
          ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
          ...(cleanCpf !== undefined ? { cpf: cleanCpf } : {}),
          ...(data.telefone !== undefined ? { telefone: data.telefone.trim() } : {}),
          ...(data.email !== undefined ? { email: data.email ? data.email.trim() : null } : {}),
          ...(data.dataNascimento !== undefined ? { dataNascimento: data.dataNascimento } : {}),
          ...(data.endereco !== undefined ? { endereco: data.endereco ? data.endereco.trim() : null } : {}),
          ...(data.observacoes !== undefined ? { observacoes: data.observacoes ? data.observacoes.trim() : null } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
        include: {
          emergencyContacts: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('CPF já cadastrado para outro cliente');
      }
      throw error;
    }
  }

  /**
   * Soft-deactivates client preserving historical clinical and financial records (V05 / §30).
   */
  static async deactivateClient(id: string) {
    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.client.update({
      where: { id },
      data: { status: 'inativo' },
    });
  }

  /**
   * Re-activates an inactive client.
   */
  static async activateClient(id: string) {
    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.client.update({
      where: { id },
      data: { status: 'ativo' },
    });
  }

  /**
   * Retrieves client by ID with emergency contacts and counts.
   */
  static async getClientById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        emergencyContacts: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            appointments: true,
            attendances: true,
            attachments: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return client;
  }

  /**
   * Validates whether a client exists and is active.
   */
  static async validateClientActive(id: string): Promise<boolean> {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { status: true },
    });
    return client?.status === 'ativo';
  }

  /**
   * Retrieves comprehensive derived clinical and financial history (§26, §41).
   */
  static async getClientWithHistory(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        emergencyContacts: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          where: { attendanceId: null }, // Client-level attachments
          orderBy: { createdAt: 'desc' },
        },
        appointments: {
          orderBy: { dataHora: 'desc' },
          include: {
            plannedProcedures: {
              include: { procedure: true },
            },
          },
        },
        attendances: {
          orderBy: { dataHora: 'desc' },
          include: {
            appointment: {
              select: { id: true, dataHora: true, status: true },
            },
            procedures: {
              include: { procedure: true },
            },
            medicalRecord: true,
            productUsages: {
              include: {
                product: true,
                lot: {
                  include: {
                    product: true,
                  },
                },
                stockUnit: {
                  include: {
                    lot: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
            payments: {
              include: { pixInstallments: true },
              orderBy: { createdAt: 'asc' },
            },
            attachments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        stockUnits: {
          include: {
            lot: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return client;
  }

  /**
   * Paginated listing of clients with real-time search.
   */
  static async listClients(query: ClientListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {};

    if (query.status && query.status !== 'todos') {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      const normalizedSearchCpf = normalizeCpf(search);

      where.OR = [
        { nome: { contains: search } },
        { telefone: { contains: search } },
        { email: { contains: search } },
        ...(normalizedSearchCpf ? [{ cpf: { contains: normalizedSearchCpf } }] : []),
      ];
    }

    const [total, items] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        include: {
          emergencyContacts: {
            where: { isActive: true },
            select: { id: true, nome: true, telefone: true, parentesco: true },
          },
          _count: {
            select: {
              appointments: true,
              attendances: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // --- 1:N Emergency Contacts Operations ---

  static async listEmergencyContacts(clientId: string) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.emergencyContact.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async addEmergencyContact(clientId: string, data: EmergencyContactInput) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return prisma.emergencyContact.create({
      data: {
        clientId,
        nome: data.nome.trim(),
        telefone: data.telefone.trim(),
        parentesco: data.parentesco.trim(),
        observacoes: data.observacoes ? data.observacoes.trim() : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async updateEmergencyContact(
    clientId: string,
    contactId: string,
    data: Partial<EmergencyContactInput>
  ) {
    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, clientId },
    });

    if (!contact) {
      throw new NotFoundError('Contato de emergência não encontrado');
    }

    return prisma.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
        ...(data.telefone !== undefined ? { telefone: data.telefone.trim() } : {}),
        ...(data.parentesco !== undefined ? { parentesco: data.parentesco.trim() } : {}),
        ...(data.observacoes !== undefined ? { observacoes: data.observacoes ? data.observacoes.trim() : null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  static async deleteEmergencyContact(clientId: string, contactId: string) {
    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, clientId },
    });

    if (!contact) {
      throw new NotFoundError('Contato de emergência não encontrado');
    }

    return prisma.emergencyContact.delete({
      where: { id: contactId },
    });
  }
}
