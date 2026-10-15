import prismaTest from './db-client';
import { generateValidCpf } from './cpf-validator';

// Random seed avoids CPF/serial collisions if a previous run left rows behind
let fixtureCounter = Math.floor(Math.random() * 1_000_000) + 1;

export function getNextCounter(): number {
  return fixtureCounter++;
}

/**
 * Creates an isolated test Client with mandatory valid CPF, emergency contacts, etc.
 */
export async function createTestClient(overrides: Record<string, any> = {}) {
  const count = getNextCounter();
  const cpf = overrides.cpf ?? generateValidCpf(count);

  return (prismaTest as any).client.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Cliente Teste ${count}`,
      cpf,
      telefone: overrides.telefone ?? overrides.phone ?? `1198888${String(count).padStart(4, '0')}`,
      email: overrides.email ?? `cliente${count}@test.com`,
      dataNascimento: overrides.dataNascimento ?? overrides.birthDate ?? new Date('1990-01-01'),
      endereco: overrides.endereco ?? overrides.address ?? 'Rua das Flores, 123, São Paulo - SP',
      observacoes: overrides.observacoes ?? overrides.notes ?? 'Sem observações especiais',
      status: overrides.status ?? (overrides.isActive === false ? 'inativo' : 'ativo'),
      ...(overrides.emergencyContacts
        ? {
            emergencyContacts: {
              create: overrides.emergencyContacts.map((c: any) => ({
                nome: c.nome ?? c.name,
                telefone: c.telefone ?? c.phone,
                parentesco: c.parentesco ?? c.relationship ?? 'Contato',
                observacoes: c.observacoes ?? c.notes ?? null,
                isActive: c.isActive ?? true,
              })),
            },
          }
        : {}),
    },
    include: {
      emergencyContacts: true,
    },
  });
}

/**
 * Creates an isolated test Procedure in catalog.
 */
export async function createTestProcedure(overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).procedure.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Procedimento ${count}`,
      descricao: overrides.descricao ?? overrides.description ?? 'Descrição do procedimento para testes',
      valorPadrao: overrides.valorPadrao ?? overrides.standardValue ?? 500.0,
      duracaoMinutos: overrides.duracaoMinutos ?? overrides.estimatedDurationMinutes ?? 60,
      categoria: overrides.categoria ?? overrides.category ?? 'Facial',
      isActive: overrides.isActive ?? true,
    },
  });
}

/**
 * Creates an isolated test Product (with reusable flag).
 */
export async function createTestProduct(overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).product.create({
    data: {
      nome: overrides.nome ?? overrides.name ?? `Produto Teste ${count}`,
      marca: overrides.marca ?? overrides.brand ?? 'Marca Teste',
      categoria: overrides.categoria ?? overrides.category ?? null,
      descricao: overrides.descricao ?? overrides.description ?? null,
      unidade: overrides.unidade ?? overrides.unitOfMeasure ?? 'frasco',
      isReusable: overrides.isReusable ?? false,
      isActive: overrides.isActive ?? true,
    },
  });
}

/**
 * Creates a Lot under a Product.
 */
export async function createTestLot(productId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).productLot.create({
    data: {
      productId,
      numeroLote: overrides.numeroLote ?? overrides.lotNumber ?? `LOTE-${count}`,
      dataValidade: overrides.dataValidade ?? overrides.expirationDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      dataAquisicao: overrides.dataAquisicao ?? null,
      precoCusto: overrides.precoCusto ?? null,
      observacoes: overrides.observacoes ?? null,
    },
  });
}

/**
 * Creates an individual physical StockUnit under a Lot.
 */
export async function createTestStockUnit(lotId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();

  return (prismaTest as any).stockUnit.create({
    data: {
      lotId,
      codigoSerial: overrides.codigoSerial ?? overrides.unitIdentifier ?? `UNIT-${count}`,
      status: overrides.status ?? 'Disponivel',
      currentClientId: overrides.currentClientId ?? null,
    },
  });
}

/**
 * Creates an isolated test Appointment with its linked Attendance.
 */
export async function createTestAppointment(clientId: string, overrides: Record<string, any> = {}) {
  const count = getNextCounter();
  const dataHora = overrides.dataHora ?? overrides.scheduledDate ?? new Date(Date.now() + 86400000);

  return (prismaTest as any).appointment.create({
    data: {
      clientId,
      dataHora,
      status: overrides.status ?? 'Agendado',
      valorEstimado: overrides.valorEstimado ?? overrides.estimatedValue ?? 500.0,
      observacoes: overrides.observacoes ?? overrides.notes ?? 'Agendamento de teste',
      motivoCancelamento: overrides.motivoCancelamento ?? overrides.cancellationReason ?? null,
      rescheduledFromId: overrides.rescheduledFromId ?? overrides.rescheduledFromAppointmentId ?? null,
      rescheduledToId: overrides.rescheduledToId ?? overrides.rescheduledToAppointmentId ?? null,
      attendances: {
        create: {
          clientId,
          status: 'Pendente',
          observacoes: 'Atendimento inicial gerado automaticamente',
        },
      },
    },
    include: {
      attendances: true,
    },
  });
}
