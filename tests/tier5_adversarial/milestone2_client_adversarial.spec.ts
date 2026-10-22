import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { ClientService } from '@/services/client.service';
import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';
import { generateValidCpf } from '../helpers/cpf-validator';
import { ValidationError, ConflictError } from '@/lib/errors';
import {
  createClientSchema,
  updateClientSchema,
  emergencyContactInputSchema,
} from '@/schemas/client';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';

describe('Tier 5 Adversarial Challenge: Milestone 2 (Client, CPF Invariants, Emergency Contacts, DB Cleanliness)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  // =========================================================================
  // 1. MALFORMED CPFs & BOUNDARY INVARIANTS (D4, AC 62, V01)
  // =========================================================================
  describe('1. Malformed CPFs & Boundary Invariants', () => {
    it('Oracle: reject all 10 repetitive digit sequences in formatted and unformatted masks', () => {
      const repetitiveSequences = [
        '000.000.000-00',
        '111.111.111-11',
        '222.222.222-22',
        '333.333.333-33',
        '444.444.444-44',
        '555.555.555-55',
        '666.666.666-66',
        '777.777.777-77',
        '888.888.888-88',
        '999.999.999-99',
      ];

      for (const seq of repetitiveSequences) {
        expect(isValidCpf(seq)).toBe(false);
        const unmasked = normalizeCpf(seq);
        expect(isValidCpf(unmasked)).toBe(false);
      }
    });

    it('Oracle: reject CPFs with invalid check digit 1 (D1 corrupted)', () => {
      const baseValid = generateValidCpf(88801);
      // Mutate D1 (character at index 9)
      const corruptedD1 =
        baseValid.slice(0, 9) +
        (baseValid[9] === '9' ? '0' : String(Number(baseValid[9]) + 1)) +
        baseValid.slice(10);

      expect(isValidCpf(corruptedD1)).toBe(false);
      expect(isValidCpf(formatCpf(corruptedD1))).toBe(false);
    });

    it('Oracle: reject CPFs with invalid check digit 2 (D2 corrupted)', () => {
      const baseValid = generateValidCpf(88802);
      // Mutate D2 (character at index 10)
      const corruptedD2 =
        baseValid.slice(0, 10) +
        (baseValid[10] === '9' ? '0' : String(Number(baseValid[10]) + 1));

      expect(isValidCpf(corruptedD2)).toBe(false);
      expect(isValidCpf(formatCpf(corruptedD2))).toBe(false);
    });

    it('Oracle: reject CPFs with both check digits corrupted', () => {
      const baseValid = generateValidCpf(88803);
      const mutatedBoth =
        baseValid.slice(0, 9) +
        (baseValid[9] === '5' ? '1' : '5') +
        (baseValid[10] === '7' ? '2' : '7');

      expect(isValidCpf(mutatedBoth)).toBe(false);
    });

    it('Oracle: reject CPFs with incorrect lengths (empty, too short, too long)', () => {
      const invalidLengths = [
        '',
        '   ',
        '1',
        '12',
        '12345678',
        '1234567890', // 10 digits
        '123456789012', // 12 digits
        '12345678901234567890', // 20 digits
      ];

      for (const val of invalidLengths) {
        expect(isValidCpf(val)).toBe(false);
      }
    });

    it('Oracle: reject CPFs containing hostile or non-digit characters', () => {
      const hostileInputs = [
        '123.45a.789-01',
        'abc.def.ghi-jk',
        '1234567890a',
        '123.456.789-0#',
        "12345678901' OR '1'='1",
        '12345678901; DROP TABLE Client; --',
        '<script>alert(1)</script>',
        '123.456.789-0🔥',
        null,
        undefined,
      ];

      for (const hostile of hostileInputs) {
        expect(isValidCpf(hostile)).toBe(false);
      }
    });

    it('Service Layer: ClientService.createClient MUST reject malformed CPFs with ValidationError', async () => {
      const malformedCpfs = [
        '111.111.111-11', // Repeated digits
        '12345678900', // Invalid check digit
        '123', // Too short
        '123.456.789-012', // Too long
        'abc.def.ghi-jk', // Non-digit
        '', // Empty
      ];

      for (const badCpf of malformedCpfs) {
        await expect(
          ClientService.createClient({
            nome: 'Cliente Malformado',
            cpf: badCpf,
            telefone: '11988887777',
          })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('Service Layer: ClientService.updateClient MUST reject updating to an invalid CPF', async () => {
      const validCpf = generateValidCpf(88810);
      const client = await ClientService.createClient({
        nome: 'Cliente Para Update Invalido',
        cpf: validCpf,
        telefone: '11988887777',
      });

      await expect(
        ClientService.updateClient(client.id, {
          cpf: '222.222.222-22',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        ClientService.updateClient(client.id, {
          cpf: '12345678900',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Schema Validation: createClientSchema rejects malformed CPFs in Zod parsing', () => {
      const badCpfs = [
        '111.111.111-11',
        '12345678900',
        'short',
        '123456789012',
      ];

      for (const bad of badCpfs) {
        const parsed = createClientSchema.safeParse({
          nome: 'Teste Schema',
          cpf: bad,
          telefone: '11988887777',
        });
        expect(parsed.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. DUPLICATE CPFs ACROSS DIFFERENT CLIENTS (D4, AC 62)
  // =========================================================================
  describe('2. Duplicate CPFs Across Different Clients', () => {
    it('Service Layer: reject duplicate CPF when second client uses identical CPF (ConflictError)', async () => {
      const sharedCpf = generateValidCpf(88820);

      const client1 = await ClientService.createClient({
        nome: 'Primeiro Dono do CPF',
        cpf: sharedCpf,
        telefone: '11911112222',
        email: 'dono1@test.com',
      });
      expect(client1.id).toBeDefined();

      await expect(
        ClientService.createClient({
          nome: 'Segundo Tentando Mesmo CPF',
          cpf: sharedCpf,
          telefone: '11933334444',
          email: 'dono2@test.com',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('Service Layer: reject duplicate CPF when second client uses formatted mask vs unmasked (ConflictError)', async () => {
      const rawCpf = generateValidCpf(88821);
      const maskedCpf = formatCpf(rawCpf);

      // Create with masked CPF
      await ClientService.createClient({
        nome: 'Dono Com Mascara',
        cpf: maskedCpf,
        telefone: '11955556666',
      });

      // Attempt second with raw unmasked CPF
      await expect(
        ClientService.createClient({
          nome: 'Dono Sem Mascara Tentando Duplicar',
          cpf: rawCpf,
          telefone: '11977778888',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('Database Constraint: raw Prisma insert with duplicate CPF MUST throw UNIQUE constraint violation (AC 62)', async () => {
      const rawCpf = generateValidCpf(88822);

      // Directly insert via Prisma bypassing service layer
      await (prismaTest as any).client.create({
        data: {
          nome: 'DB Bypass Primeiro',
          cpf: rawCpf,
          telefone: '11911111111',
          status: 'ativo',
        },
      });

      let caughtDbError: any = null;
      try {
        await (prismaTest as any).client.create({
          data: {
            nome: 'DB Bypass Segundo Duplicado',
            cpf: rawCpf,
            telefone: '11922222222',
            status: 'ativo',
          },
        });
      } catch (err) {
        caughtDbError = err;
      }

      expect(caughtDbError).not.toBeNull();
      // Verify Prisma unique key violation on Client_cpf_key (P2002)
      expect(caughtDbError.code).toBe('P2002');
      const errorMsg = String(caughtDbError.message || caughtDbError);
      expect(errorMsg.toLowerCase()).toMatch(/unique|constraint|client/i);
    });

    it('Service Layer Update: reject updating Client B to Client A CPF, but allow self-update', async () => {
      const cpfA = generateValidCpf(88823);
      const cpfB = generateValidCpf(88824);

      const clientA = await ClientService.createClient({
        nome: 'Cliente A',
        cpf: cpfA,
        telefone: '11911110001',
      });

      const clientB = await ClientService.createClient({
        nome: 'Cliente B',
        cpf: cpfB,
        telefone: '11911110002',
      });

      // Attempt to update Client B's CPF to Client A's CPF -> ConflictError
      await expect(
        ClientService.updateClient(clientB.id, {
          cpf: cpfA,
        })
      ).rejects.toThrow(ConflictError);

      // Self-update Client A with Client A's OWN CPF -> MUST SUCCEED
      const updatedA = await ClientService.updateClient(clientA.id, {
        cpf: cpfA,
        nome: 'Cliente A Nome Atualizado',
      });
      expect(updatedA.nome).toBe('Cliente A Nome Atualizado');
      expect(updatedA.cpf).toBe(cpfA);
    });
  });

  // =========================================================================
  // 3. CLIENT WITH MISSING REQUIRED FIELDS (D4)
  // =========================================================================
  describe('3. Client With Missing Required Fields', () => {
    it('Service Layer: reject creation with missing or empty CPF', async () => {
      await expect(
        ClientService.createClient({
          nome: 'Sem CPF',
          cpf: '',
          telefone: '11999990000',
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        ClientService.createClient({
          nome: 'Sem CPF Undefined',
          cpf: undefined as any,
          telefone: '11999990000',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('Schema Validation: reject client creation with missing or invalid nome', () => {
      const validCpf = generateValidCpf(88830);

      // Nome empty
      expect(
        createClientSchema.safeParse({
          nome: '',
          cpf: validCpf,
          telefone: '11999990000',
        }).success
      ).toBe(false);

      // Nome too short (< 2 chars)
      expect(
        createClientSchema.safeParse({
          nome: 'A',
          cpf: validCpf,
          telefone: '11999990000',
        }).success
      ).toBe(false);

      // Nome missing
      expect(
        createClientSchema.safeParse({
          cpf: validCpf,
          telefone: '11999990000',
        }).success
      ).toBe(false);
    });

    it('Schema Validation: reject client creation with missing or invalid telefone', () => {
      const validCpf = generateValidCpf(88831);

      // Telefone too short (< 8 chars)
      expect(
        createClientSchema.safeParse({
          nome: 'Valido Nome',
          cpf: validCpf,
          telefone: '1234567',
        }).success
      ).toBe(false);

      // Telefone empty
      expect(
        createClientSchema.safeParse({
          nome: 'Valido Nome',
          cpf: validCpf,
          telefone: '',
        }).success
      ).toBe(false);

      // Telefone missing
      expect(
        createClientSchema.safeParse({
          nome: 'Valido Nome',
          cpf: validCpf,
        }).success
      ).toBe(false);
    });

    it('Database Constraints: DB rejects insertion when non-nullable fields are null', async () => {
      const validCpf = generateValidCpf(88832);

      // Null nome
      await expect(
        (prismaTest as any).client.create({
          data: {
            nome: null,
            cpf: validCpf,
            telefone: '11988887777',
            status: 'ativo',
          },
        })
      ).rejects.toThrow();

      // Null cpf
      await expect(
        (prismaTest as any).client.create({
          data: {
            nome: 'Nome Valido',
            cpf: null,
            telefone: '11988887777',
            status: 'ativo',
          },
        })
      ).rejects.toThrow();

      // Null telefone
      await expect(
        (prismaTest as any).client.create({
          data: {
            nome: 'Nome Valido',
            cpf: validCpf,
            telefone: null,
            status: 'ativo',
          },
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4. EMERGENCY CONTACTS EDGE CASES (1:N, V13)
  // =========================================================================
  describe('4. Emergency Contacts Edge Cases', () => {
    it('should create client with empty emergencyContacts array cleanly (0 contacts)', async () => {
      const cpf = generateValidCpf(88840);
      const client = await ClientService.createClient({
        nome: 'Cliente Sem Contatos Array Vazio',
        cpf,
        telefone: '11988881111',
        emergencyContacts: [],
      });

      expect(client.id).toBeDefined();
      const contacts = await ClientService.listEmergencyContacts(client.id);
      expect(contacts).toHaveLength(0);
    });

    it('should create client without emergencyContacts property cleanly (0 contacts)', async () => {
      const cpf = generateValidCpf(88841);
      const client = await ClientService.createClient({
        nome: 'Cliente Sem Contatos Property Omitida',
        cpf,
        telefone: '11988882222',
      });

      expect(client.id).toBeDefined();
      const contacts = await ClientService.listEmergencyContacts(client.id);
      expect(contacts).toHaveLength(0);
    });

    it('should maintain deterministic ordering of multiple emergency contacts (1:N, V13)', async () => {
      const cpf = generateValidCpf(88842);
      const client = await ClientService.createClient({
        nome: 'Cliente Com 3 Contatos Ordenados',
        cpf,
        telefone: '11988883333',
        emergencyContacts: [
          {
            nome: 'Contato Alpha',
            telefone: '11911110001',
            parentesco: 'Pai',
            observacoes: 'Ordem 1',
            isActive: true,
          },
          {
            nome: 'Contato Beta',
            telefone: '11911110002',
            parentesco: 'Mãe',
            observacoes: 'Ordem 2',
            isActive: true,
          },
          {
            nome: 'Contato Gamma',
            telefone: '11911110003',
            parentesco: 'Irmão',
            observacoes: 'Ordem 3',
            isActive: true,
          },
        ],
      });

      expect(client.emergencyContacts).toHaveLength(3);
      expect(client.emergencyContacts[0].nome).toBe('Contato Alpha');
      expect(client.emergencyContacts[1].nome).toBe('Contato Beta');
      expect(client.emergencyContacts[2].nome).toBe('Contato Gamma');

      // Verify listEmergencyContacts retrieves all persisted contacts
      const persisted = await ClientService.listEmergencyContacts(client.id);
      expect(persisted).toHaveLength(3);
      const contactNames = persisted.map((c) => c.nome);
      expect(contactNames).toContain('Contato Alpha');
      expect(contactNames).toContain('Contato Beta');
      expect(contactNames).toContain('Contato Gamma');
    });

    it('should maintain chronological ordering for emergency contacts added sequentially', async () => {
      const cpf = generateValidCpf(88849);
      const client = await ClientService.createClient({
        nome: 'Cliente Sequencial Contatos',
        cpf,
        telefone: '11988880009',
      });

      // Add contacts sequentially
      await ClientService.addEmergencyContact(client.id, {
        nome: 'Primeiro Contato Seq',
        telefone: '11911110001',
        parentesco: 'Pai',
      });

      await ClientService.addEmergencyContact(client.id, {
        nome: 'Segundo Contato Seq',
        telefone: '11911110002',
        parentesco: 'Mãe',
      });

      await ClientService.addEmergencyContact(client.id, {
        nome: 'Terceiro Contato Seq',
        telefone: '11911110003',
        parentesco: 'Irmão',
      });

      const list = await ClientService.listEmergencyContacts(client.id);
      expect(list).toHaveLength(3);
      expect(list[0].nome).toBe('Primeiro Contato Seq');
      expect(list[1].nome).toBe('Segundo Contato Seq');
      expect(list[2].nome).toBe('Terceiro Contato Seq');
    });

    it('should support full lifecycle: add, update, soft-deactivate, and delete emergency contacts', async () => {
      const cpf = generateValidCpf(88843);
      const client = await ClientService.createClient({
        nome: 'Cliente Para Ciclo Contatos',
        cpf,
        telefone: '11988884444',
      });

      // 1. Add contact
      const contact = await ClientService.addEmergencyContact(client.id, {
        nome: 'Contato Adicionado',
        telefone: '11944445555',
        parentesco: 'Primo',
        observacoes: 'Inicial',
        isActive: true,
      });
      expect(contact.id).toBeDefined();
      expect(contact.nome).toBe('Contato Adicionado');

      // 2. Partial update
      const updated = await ClientService.updateEmergencyContact(client.id, contact.id, {
        telefone: '11999998888',
        observacoes: 'Telefone atualizado',
      });
      expect(updated.telefone).toBe('11999998888');
      expect(updated.observacoes).toBe('Telefone atualizado');
      expect(updated.nome).toBe('Contato Adicionado'); // preserved

      // 3. Deactivate contact
      await ClientService.updateEmergencyContact(client.id, contact.id, {
        isActive: false,
      });

      // getClientById filters active only
      const clientById = await ClientService.getClientById(client.id);
      expect(clientById.emergencyContacts).toHaveLength(0);

      // listEmergencyContacts lists all
      const allContacts = await ClientService.listEmergencyContacts(client.id);
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].isActive).toBe(false);

      // 4. Delete contact
      await ClientService.deleteEmergencyContact(client.id, contact.id);
      const remaining = await ClientService.listEmergencyContacts(client.id);
      expect(remaining).toHaveLength(0);
    });

    it('Schema Validation: emergencyContactInputSchema rejects invalid phone numbers and missing fields', () => {
      // Telefone too short (< 8 chars)
      expect(
        emergencyContactInputSchema.safeParse({
          nome: 'Contato',
          telefone: '1234567',
          parentesco: 'Amigo',
        }).success
      ).toBe(false);

      // Telefone too long (> 20 chars)
      expect(
        emergencyContactInputSchema.safeParse({
          nome: 'Contato',
          telefone: '123456789012345678901',
          parentesco: 'Amigo',
        }).success
      ).toBe(false);

      // Telefone empty
      expect(
        emergencyContactInputSchema.safeParse({
          nome: 'Contato',
          telefone: '',
          parentesco: 'Amigo',
        }).success
      ).toBe(false);

      // Nome too short (< 2 chars)
      expect(
        emergencyContactInputSchema.safeParse({
          nome: 'A',
          telefone: '11988887777',
          parentesco: 'Amigo',
        }).success
      ).toBe(false);

      // Parentesco too short (< 2 chars)
      expect(
        emergencyContactInputSchema.safeParse({
          nome: 'Contato',
          telefone: '11988887777',
          parentesco: 'X',
        }).success
      ).toBe(false);
    });
  });

  // =========================================================================
  // 5. DATABASE CLEANUP VERIFICATION (cleanTestDatabase Invariant)
  // =========================================================================
  describe('5. Database Cleanup Verification (cleanTestDatabase Invariant)', () => {
    it('cleanTestDatabase leaves strictly zero dirty records across all domain tables', async () => {
      // 1. Seed multiple tables with test records
      const client = await createTestClient({
        emergencyContacts: [
          {
            nome: 'Contato Limpeza',
            telefone: '11988881234',
            parentesco: 'Irmão',
            isActive: true,
          },
        ],
      });
      await createTestAppointment(client.id);

      // Verify records are present
      const clientCountBefore = await (prismaTest as any).client.count();
      const contactCountBefore = await (prismaTest as any).emergencyContact.count();
      const apptCountBefore = await (prismaTest as any).appointment.count();
      const attendCountBefore = await (prismaTest as any).attendance.count();

      expect(clientCountBefore).toBeGreaterThanOrEqual(1);
      expect(contactCountBefore).toBeGreaterThanOrEqual(1);
      expect(apptCountBefore).toBeGreaterThanOrEqual(1);
      expect(attendCountBefore).toBeGreaterThanOrEqual(1);

      // 2. Execute cleanTestDatabase
      await cleanTestDatabase();

      // 3. Verify that every single table in dependency order is strictly 0
      const tablesToCheck = [
        'Reminder',
        'PixInstallment',
        'Payment',
        'ProductUsage',
        'StockUnit',
        'ProductLot',
        'ProcedureProduct',
        'Product',
        'AttendanceProcedure',
        'PlannedProcedure',
        'MedicalRecord',
        'Attachment',
        'Attendance',
        'Appointment',
        'EmergencyContact',
        'Client',
        'Procedure',
        'User',
      ];

      for (const table of tablesToCheck) {
        const rows: any[] = await prismaTest.$queryRawUnsafe(
          `SELECT COUNT(*) as [cnt] FROM [${table}]`
        );
        const count = Number(rows[0].cnt);
        expect(count).toBe(0);
      }

      // 4. Verify idempotency: re-inserting with the same CPF succeeds with zero collision
      const reusableCpf = client.cpf;
      const recreatedClient = await (prismaTest as any).client.create({
        data: {
          nome: 'Cliente Recriado Pos Limpeza',
          cpf: reusableCpf,
          telefone: '11988880000',
          status: 'ativo',
        },
      });
      expect(recreatedClient.id).toBeDefined();
      expect(recreatedClient.cpf).toBe(reusableCpf);
    });
  });
});
