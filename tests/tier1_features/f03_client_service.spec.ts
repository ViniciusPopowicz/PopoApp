import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { ClientService } from '@/services/client.service';
import { generateValidCpf } from '../helpers/cpf-validator';
import { ValidationError, ConflictError, NotFoundError } from '@/lib/errors';

describe('Feature F03: Client Management Domain Service (Phase 4, D4, AC 62)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should create client with valid CPF, normalizing to 11 digits and default status ativo (V01)', async () => {
    const rawCpf = generateValidCpf(301);
    const maskedCpf = `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9, 11)}`;

    const client = await ClientService.createClient({
      nome: 'Juliana Paes',
      cpf: maskedCpf,
      telefone: '11988887777',
      email: 'juliana@example.com',
      endereco: 'Rua Oscar Freire, 500',
    });

    expect(client.id).toBeDefined();
    expect(client.nome).toBe('Juliana Paes');
    expect(client.cpf).toBe(rawCpf); // Normalized to 11 digits
    expect(client.status).toBe('ativo');
  });

  it('should reject client creation with missing or empty CPF (V01)', async () => {
    await expect(
      ClientService.createClient({
        nome: 'Sem CPF',
        cpf: '',
        telefone: '11988880000',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should reject client creation with invalid CPF checksum (V01)', async () => {
    await expect(
      ClientService.createClient({
        nome: 'CPF Invalido',
        cpf: '12345678900',
        telefone: '11988880000',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should reject client creation with repetitive digits CPF (V01)', async () => {
    await expect(
      ClientService.createClient({
        nome: 'CPF Repetido',
        cpf: '111.111.111-11',
        telefone: '11988880000',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should reject duplicate CPF at service layer (AC 62, V02)', async () => {
    const cpf = generateValidCpf(302);

    await ClientService.createClient({
      nome: 'Primeiro Titular',
      cpf,
      telefone: '11911112222',
    });

    await expect(
      ClientService.createClient({
        nome: 'Segundo Titular com Mesmo CPF',
        cpf,
        telefone: '11933334444',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should create client with multiple emergency contacts atomically (1:N, V13)', async () => {
    const cpf = generateValidCpf(303);

    const client = await ClientService.createClient({
      nome: 'Carlos Drummond',
      cpf,
      telefone: '11955556666',
      emergencyContacts: [
        {
          nome: 'Clara Drummond',
          telefone: '11944443333',
          parentesco: 'Filha',
          observacoes: 'Ligar primeiro',
          isActive: true,
        },
        {
          nome: 'Roberto Drummond',
          telefone: '11933332222',
          parentesco: 'Irmão',
          isActive: true,
        },
      ],
    });

    expect(client.emergencyContacts).toHaveLength(2);
    expect(client.emergencyContacts[0].parentesco).toBe('Filha');
    expect(client.emergencyContacts[1].parentesco).toBe('Irmão');
  });

  it('should add, update, and delete individual emergency contacts', async () => {
    const cpf = generateValidCpf(304);
    const client = await ClientService.createClient({
      nome: 'Vinicius de Moraes',
      cpf,
      telefone: '11922221111',
    });

    // Add contact
    const contact = await ClientService.addEmergencyContact(client.id, {
      nome: 'Tom Jobim',
      telefone: '21988887777',
      parentesco: 'Amigo',
    });
    expect(contact.id).toBeDefined();
    expect(contact.nome).toBe('Tom Jobim');

    // Update contact
    const updatedContact = await ClientService.updateEmergencyContact(client.id, contact.id, {
      telefone: '21999998888',
      observacoes: 'Número novo',
    });
    expect(updatedContact.telefone).toBe('21999998888');
    expect(updatedContact.observacoes).toBe('Número novo');

    // Delete contact
    await ClientService.deleteEmergencyContact(client.id, contact.id);

    const remainingContacts = await ClientService.listEmergencyContacts(client.id);
    expect(remainingContacts).toHaveLength(0);
  });

  it('should soft-deactivate and reactivate client without deleting records (V05)', async () => {
    const cpf = generateValidCpf(305);
    const client = await ClientService.createClient({
      nome: 'Clarice Lispector',
      cpf,
      telefone: '11977778888',
    });

    expect(client.status).toBe('ativo');

    // Soft-deactivate
    const deactivated = await ClientService.deactivateClient(client.id);
    expect(deactivated.status).toBe('inativo');

    const checkActive = await ClientService.validateClientActive(client.id);
    expect(checkActive).toBe(false);

    // Reactivate
    const reactivated = await ClientService.activateClient(client.id);
    expect(reactivated.status).toBe('ativo');

    const checkActiveAgain = await ClientService.validateClientActive(client.id);
    expect(checkActiveAgain).toBe(true);
  });

  it('should list clients with search by name and normalized CPF', async () => {
    const cpf = generateValidCpf(306);
    await ClientService.createClient({
      nome: 'Machado de Assis',
      cpf,
      telefone: '11966665555',
      email: 'machado@academia.org.br',
    });

    // Search by name
    const resultName = await ClientService.listClients({ search: 'Machado' });
    expect(resultName.items.length).toBeGreaterThanOrEqual(1);
    expect(resultName.items.some((c) => c.nome.includes('Machado'))).toBe(true);

    // Search by formatted CPF
    const masked = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}`;
    const resultCpf = await ClientService.listClients({ search: masked });
    expect(resultCpf.items.length).toBeGreaterThanOrEqual(1);
    expect(resultCpf.items.some((c) => c.cpf === cpf)).toBe(true);
  });

  it('should retrieve client with derived history', async () => {
    const cpf = generateValidCpf(307);
    const client = await ClientService.createClient({
      nome: 'Cecília Meireles',
      cpf,
      telefone: '11955554444',
    });

    const clientWithHistory = await ClientService.getClientWithHistory(client.id);
    expect(clientWithHistory).toBeDefined();
    expect(clientWithHistory.id).toBe(client.id);
    expect(clientWithHistory.appointments).toBeDefined();
    expect(clientWithHistory.attendances).toBeDefined();
    expect(clientWithHistory.attachments).toBeDefined();
    expect(clientWithHistory.stockUnits).toBeDefined();
  });
});
