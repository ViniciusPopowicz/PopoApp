import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient } from '../helpers/test-fixtures';
import { generateValidCpf } from '../helpers/cpf-validator';

describe('Feature F03 & Critical Validation V13: Client & Emergency Contacts Model', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should create client with mandatory valid CPF and contact info', async () => {
    const cpf = generateValidCpf(101);
    const client = await (prismaTest as any).client.create({
      data: {
        nome: 'Maria Silva',
        cpf,
        telefone: '11999990001',
        email: 'maria.silva@example.com',
        dataNascimento: new Date('1985-05-15'),
        endereco: 'Av. Paulista, 1000, Apto 51, São Paulo - SP',
        observacoes: 'Alérgica a dipirona',
        status: 'ativo',
      },
    });

    expect(client.id).toBeDefined();
    expect(client.nome).toBe('Maria Silva');
    expect(client.cpf).toBe(cpf);
    expect(client.status).toBe('ativo');
  });

  it('should support multiple emergency contacts for a single client (1:N, V13)', async () => {
    const client = await createTestClient({
      emergencyContacts: [
        {
          nome: 'João Silva',
          telefone: '11988880001',
          parentesco: 'Cônjuge',
          observacoes: 'Disponível após as 18h',
          isActive: true,
        },
        {
          nome: 'Ana Silva',
          telefone: '11977770002',
          parentesco: 'Irmã',
          observacoes: 'Contato secundário',
          isActive: true,
        },
      ],
    });

    const contacts = await (prismaTest as any).emergencyContact.findMany({
      where: { clientId: client.id },
    });

    expect(contacts).toHaveLength(2);
    expect(contacts.map((c: any) => c.parentesco)).toContain('Cônjuge');
    expect(contacts.map((c: any) => c.parentesco)).toContain('Irmã');
  });

  it('should enforce unique CPF constraint in database (AC 62)', async () => {
    const duplicateCpf = generateValidCpf(202);

    await (prismaTest as any).client.create({
      data: {
        nome: 'Cliente Original',
        cpf: duplicateCpf,
        telefone: '11999990002',
        email: 'original@example.com',
        dataNascimento: new Date('1990-01-01'),
        endereco: 'Rua Um, 10',
        status: 'ativo',
      },
    });

    let duplicateError: any = null;
    try {
      await (prismaTest as any).client.create({
        data: {
          nome: 'Cliente Duplicado',
          cpf: duplicateCpf,
          telefone: '11999990003',
          email: 'duplicado@example.com',
          dataNascimento: new Date('1992-02-02'),
          endereco: 'Rua Dois, 20',
          status: 'ativo',
        },
      });
    } catch (err) {
      duplicateError = err;
    }

    expect(duplicateError).not.toBeNull();
  });

  it('should allow soft-deactivation of a client (status = inativo)', async () => {
    const client = await createTestClient({ status: 'ativo' });
    expect(client.status).toBe('ativo');

    const updated = await (prismaTest as any).client.update({
      where: { id: client.id },
      data: { status: 'inativo' },
    });

    expect(updated.status).toBe('inativo');
  });

  it('should retrieve client with all emergency contacts included', async () => {
    const client = await createTestClient({
      emergencyContacts: [
        {
          nome: 'Contato Teste',
          telefone: '11966660003',
          parentesco: 'Mãe',
        },
      ],
    });

    const retrieved = await (prismaTest as any).client.findUnique({
      where: { id: client.id },
      include: { emergencyContacts: true },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved.emergencyContacts).toHaveLength(1);
    expect(retrieved.emergencyContacts[0].nome).toBe('Contato Teste');
  });
});
