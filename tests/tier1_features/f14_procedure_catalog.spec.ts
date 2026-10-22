import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createProcedure,
  getProcedureById,
  updateProcedure,
  toggleProcedureActive,
  deleteProcedure,
  listProcedures,
  getProcedureCategories,
} from '@/services/procedure.service';
import { createTestClient, createTestAppointment, createTestProduct } from '../helpers/test-fixtures';

describe('Feature F14: Procedure Catalog Service & CRUD (Phase 5)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should create procedure and retrieve it by ID with mapped DTO', async () => {
    const procedure = await createProcedure({
      nome: 'Bioestimulador de Colágeno',
      descricao: 'Estimulação celular para firmeza tecidual e rejuvenescimento',
      valorPadrao: 1800.0,
      duracaoMinutos: 60,
      categoria: 'Bioestimuladores',
    });

    expect(procedure.id).toBeDefined();
    expect(procedure.nome).toBe('Bioestimulador de Colágeno');
    expect(procedure.valorPadrao).toBe(1800.0);
    expect(procedure.duracaoMinutos).toBe(60);
    expect(procedure.isActive).toBe(true);
    expect(procedure.status).toBe('ativo');

    const retrieved = await getProcedureById(procedure.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(procedure.id);
    expect(retrieved?.isInUse).toBe(false);
  });

  it('should update procedure details', async () => {
    const procedure = await createProcedure({
      nome: 'Peeling Químico Inicial',
      descricao: 'Renovação cutânea superficial',
      valorPadrao: 350.0,
      duracaoMinutos: 30,
      categoria: 'Facial',
    });

    const updated = await updateProcedure(procedure.id, {
      nome: 'Peeling Químico Médio',
      valorPadrao: 450.0,
      duracaoMinutos: 40,
    });

    expect(updated.nome).toBe('Peeling Químico Médio');
    expect(updated.valorPadrao).toBe(450.0);
    expect(updated.duracaoMinutos).toBe(40);
  });

  it('should toggle active status of procedure', async () => {
    const procedure = await createProcedure({
      nome: 'Microagulhamento',
      descricao: 'Indução percutânea de colágeno',
      valorPadrao: 500.0,
      duracaoMinutos: 50,
      categoria: 'Facial',
    });

    expect(procedure.isActive).toBe(true);

    const toggledOff = await toggleProcedureActive(procedure.id, false);
    expect(toggledOff.isActive).toBe(false);
    expect(toggledOff.status).toBe('inativo');

    const toggledOn = await toggleProcedureActive(procedure.id, true);
    expect(toggledOn.isActive).toBe(true);
    expect(toggledOn.status).toBe('ativo');
  });

  it('should permanently delete procedure when not in use', async () => {
    const procedure = await createProcedure({
      nome: 'Procedimento Temporário',
      descricao: 'Será excluído definitivamente',
      valorPadrao: 200.0,
      duracaoMinutos: 20,
      categoria: 'Geral',
    });

    const result = await deleteProcedure(procedure.id);
    expect(result.success).toBe(true);
    expect(result.softDeactivated).toBe(false);

    const check = await getProcedureById(procedure.id);
    expect(check).toBeNull();
  });

  it('should soft-deactivate procedure when in use in an attendance or planned appointment', async () => {
    const client = await createTestClient();
    const appointment = await createTestAppointment(client.id);
    const attendanceId = appointment.attendances[0].id;

    const procedure = await createProcedure({
      nome: 'Harmonização de Mandíbula',
      descricao: 'Definição do contorno mandibular',
      valorPadrao: 2500.0,
      duracaoMinutos: 90,
      categoria: 'Harmonização',
    });

    // Attach to attendance
    await (prismaTest as any).attendanceProcedure.create({
      data: {
        attendanceId,
        procedureId: procedure.id,
        standardValueSnapshot: 2500.0,
        practicedValue: 2500.0,
      },
    });

    // Delete should automatically perform soft-deactivation
    const deleteResult = await deleteProcedure(procedure.id);
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.softDeactivated).toBe(true);
    expect(deleteResult.procedure.isActive).toBe(false);

    // Verify still in database but inactive
    const retrieved = await getProcedureById(procedure.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.isActive).toBe(false);
    expect(retrieved?.isInUse).toBe(true);
  });

  it('should filter procedures by search text and category', async () => {
    await createProcedure({
      nome: 'Preenchimento Malar Especial',
      descricao: 'Volume da região zigomática',
      valorPadrao: 1600.0,
      duracaoMinutos: 60,
      categoria: 'Preenchimento',
    });

    const searchResults = await listProcedures({ search: 'Malar' });
    expect(searchResults.some((p) => p.nome.includes('Malar'))).toBe(true);

    const categoryResults = await listProcedures({ categoria: 'Preenchimento' });
    expect(categoryResults.every((p) => p.categoria === 'Preenchimento')).toBe(true);

    const categories = await getProcedureCategories();
    expect(categories).toContain('Preenchimento');
  });

  it('should associate products with a procedure (M:N)', async () => {
    const product = await createTestProduct({ nome: 'Ácido Hialurônico Ultra' });

    const procedure = await createProcedure({
      nome: 'Preenchimento de Mento',
      descricao: 'Projeção do mento com AH',
      valorPadrao: 1400.0,
      duracaoMinutos: 45,
      categoria: 'Preenchimento',
      productIds: [product.id],
    });

    expect(procedure.products).toHaveLength(1);
    expect(procedure.products?.[0].productId).toBe(product.id);
  });
});
