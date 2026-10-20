import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestProcedure,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
  createTestAppointment,
} from '../helpers/test-fixtures';
import { getAuthHeaders } from '../helpers/auth-helper';
import { generateValidCpf } from '../helpers/cpf-validator';
import { isValidCpf, normalizeCpf, formatCpf } from '@/lib/cpf';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { createProcedureSchema, updateProcedureSchema } from '@/schemas/procedure';
import { createLotSchema } from '@/schemas/product';
import { ClientService } from '@/services/client.service';
import { AttendanceService } from '@/services/attendance.service';
import { createLot, listAvailableUnits, recordProductUsage } from '@/services/stock.service';

// Next.js 15 dynamic route page components
import ClienteDetailPage from '@/app/(authenticated)/clientes/[id]/page';
import AttendanceDetailPage from '@/app/(authenticated)/atendimentos/[id]/page';

// API Route Handlers
import { GET as getClientRoute, PUT as putClientRoute } from '@/app/api/clients/[id]/route';
import { GET as getAttendanceRoute, PATCH as patchAttendanceRoute } from '@/app/api/attendances/[id]/route';
import { POST as postProcedureRoute } from '@/app/api/procedures/route';
import { POST as postLotRoute } from '@/app/api/products/[id]/lots/route';

describe('Tier 5 Adversarial Suite: M5 UI Core & Route Parameter Resilience (Challenger M5-1)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  // =========================================================================
  // Challenge 1: Next.js 15 Dynamic Route Parameter Unwrapping & Malformed UUID Resilience
  // =========================================================================
  describe('Challenge 1: Next.js 15 Dynamic Route Parameter Unwrapping & Malformed UUID Resilience', () => {
    it('1.1: ClienteDetailPage unwraps await params cleanly under malformed or non-existent UUIDs', async () => {
      const testCases = [
        'not-a-valid-uuid',
        '00000000-0000-0000-0000-000000000000',
        "'; DROP TABLE Client; --",
        '<script>alert("xss")</script>',
        '12345',
        'undefined',
        'null',
      ];

      for (const malformedId of testCases) {
        const paramsPromise = Promise.resolve({ id: malformedId });
        const element = await ClienteDetailPage({ params: paramsPromise });

        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.clientId).toBe(malformedId);
      }
    });

    it('1.2: AttendanceDetailPage unwraps await params cleanly under malformed or non-existent UUIDs', async () => {
      const testCases = [
        'invalid-attendance-id',
        '00000000-0000-0000-0000-000000000000',
        "' UNION SELECT * FROM Attendance --",
        'NaN',
        'false',
      ];

      for (const malformedId of testCases) {
        const paramsPromise = Promise.resolve({ id: malformedId });
        const element = await AttendanceDetailPage({ params: paramsPromise });

        expect(React.isValidElement(element)).toBe(true);
        expect(element.props.attendanceId).toBe(malformedId);
      }
    });

    it('1.3: GET /api/clients/[id] returns 404 for non-existent and malformed UUIDs without 500 crash', async () => {
      const authHeaders = await getAuthHeaders();
      const attackIds = [
        '00000000-0000-0000-0000-000000000000',
        'non-existent-uuid-12345',
        "' OR '1'='1",
        '<svg onload=alert(1)>',
      ];

      for (const id of attackIds) {
        const req = new NextRequest(`http://localhost:3000/api/clients/${encodeURIComponent(id)}`, {
          method: 'GET',
          headers: authHeaders,
        });

        const res = await getClientRoute(req, { params: Promise.resolve({ id }) });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.success).toBe(false);
        expect(json.error).toBe('Cliente não encontrado');
      }
    });

    it('1.4: GET /api/clients/[id]?history=true returns 404 for non-existent and malformed IDs', async () => {
      const authHeaders = await getAuthHeaders();
      const id = 'malformed-history-id';

      const req = new NextRequest(`http://localhost:3000/api/clients/${id}?history=true`, {
        method: 'GET',
        headers: authHeaders,
      });

      const res = await getClientRoute(req, { params: Promise.resolve({ id }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cliente não encontrado');
    });

    it('1.5: PUT /api/clients/[id] returns 404 when attempting to update non-existent client', async () => {
      const authHeaders = await getAuthHeaders();
      const id = '00000000-0000-0000-0000-000000000000';

      const req = new NextRequest(`http://localhost:3000/api/clients/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Nome Alterado' }),
      });

      const res = await putClientRoute(req, { params: Promise.resolve({ id }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cliente não encontrado');
    });

    it('1.6: GET /api/attendances/[id] returns 404 for non-existent and malformed UUIDs without 500 crash', async () => {
      const authHeaders = await getAuthHeaders();
      const attackIds = [
        '00000000-0000-0000-0000-000000000000',
        'malformed-att-id',
        "'; SELECT @@VERSION; --",
      ];

      for (const id of attackIds) {
        const req = new NextRequest(`http://localhost:3000/api/attendances/${encodeURIComponent(id)}`, {
          method: 'GET',
          headers: authHeaders,
        });

        const res = await getAttendanceRoute(req, { params: Promise.resolve({ id }) });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.success).toBe(false);
        expect(json.error).toBe('Atendimento não encontrado');
      }
    });

    it('1.7: PATCH /api/attendances/[id] returns 404 when updating non-existent attendance', async () => {
      const authHeaders = await getAuthHeaders();
      const id = '00000000-0000-0000-0000-000000000000';

      const req = new NextRequest(`http://localhost:3000/api/attendances/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: 'Notas do atendimento' }),
      });

      const res = await patchAttendanceRoute(req, { params: Promise.resolve({ id }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Atendimento não encontrado');
    });

    it('1.8: ClientService and AttendanceService directly throw NotFoundError for missing entities', async () => {
      await expect(ClientService.getClientById('non-existent')).rejects.toThrow(NotFoundError);
      await expect(ClientService.getClientWithHistory('non-existent')).rejects.toThrow(NotFoundError);
      await expect(AttendanceService.getAttendanceById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // Challenge 2: Brazilian CPF Client-Side Validation Logic Edge Cases
  // =========================================================================
  describe('Challenge 2: Brazilian CPF Client-Side Validation Logic Edge Cases', () => {
    it('2.1: Valid CPFs (formatted and unformatted) pass MOD 11 validation', () => {
      // Known valid CPFs generated by oracle
      const validCpfs = [
        '52998224725',
        '11144477735',
        '00000000191',
        generateValidCpf(1),
        generateValidCpf(42),
        generateValidCpf(999),
        generateValidCpf(12345),
      ];

      for (const cpf of validCpfs) {
        expect(isValidCpf(cpf)).toBe(true);
        // Formatted version must also validate
        const formatted = formatCpf(cpf);
        expect(isValidCpf(formatted)).toBe(true);
      }
    });

    it('2.2: Repeated digit sequences (000...000 to 999...999) are strictly rejected', () => {
      const repeatedDigits = [
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
        '00000000000',
        '11111111111',
        '22222222222',
        '33333333333',
        '44444444444',
        '55555555555',
        '66666666666',
        '77777777777',
        '88888888888',
        '99999999999',
      ];

      for (const rep of repeatedDigits) {
        expect(isValidCpf(rep)).toBe(false);
      }
    });

    it('2.3: Invalid checksum digits (D1 wrong, D2 wrong, or both inverted) are rejected', () => {
      const valid = generateValidCpf(100);
      const clean = normalizeCpf(valid);

      // Invert D1
      const wrongD1 = clean.slice(0, 9) + ((Number(clean[9]) + 1) % 10) + clean[10];
      expect(isValidCpf(wrongD1)).toBe(false);

      // Invert D2
      const wrongD2 = clean.slice(0, 10) + ((Number(clean[10]) + 1) % 10);
      expect(isValidCpf(wrongD2)).toBe(false);

      // Invert both
      const wrongBoth = clean.slice(0, 9) + ((Number(clean[9]) + 1) % 10) + ((Number(clean[10]) + 1) % 10);
      expect(isValidCpf(wrongBoth)).toBe(false);
    });

    it('2.4: Length anomalies (less than 11 digits or greater than 11 digits) are rejected', () => {
      const lengthCases = [
        '',
        '1',
        '12',
        '123',
        '1234567890', // 10 digits
        '123456789012', // 12 digits
        '123456789012345', // 15 digits
        '   ',
      ];

      for (const c of lengthCases) {
        expect(isValidCpf(c)).toBe(false);
      }
    });

    it('2.5: Alphanumeric and special characters are rejected', () => {
      const alphaCases = [
        '123.456.789-0A',
        'abc.def.ghi-jk',
        '123.456.789-??',
        'CPF_DO_CLIENTE',
        '!@#$%^&*()_+',
        "123' OR '1'='1",
      ];

      for (const c of alphaCases) {
        expect(isValidCpf(c)).toBe(false);
      }
    });

    it('2.6: Null, undefined, and non-string inputs are handled safely without throwing', () => {
      expect(isValidCpf(null)).toBe(false);
      expect(isValidCpf(undefined)).toBe(false);
      expect(normalizeCpf(null)).toBe('');
      expect(normalizeCpf(undefined)).toBe('');
      expect(formatCpf('')).toBe('');
      expect(formatCpf('123')).toBe('123'); // returns clean if not 11 digits
    });

    it('2.7: formatCpf produces canonical mask 000.000.000-00 for 11 digits', () => {
      const clean = '52998224725';
      expect(formatCpf(clean)).toBe('529.982.247-25');

      const masked = '529.982.247-25';
      expect(formatCpf(masked)).toBe('529.982.247-25');
    });
  });

  // =========================================================================
  // Challenge 3: Procedure Price Input Boundary (0.00, negative, extreme numbers)
  // =========================================================================
  describe('Challenge 3: Procedure Price Input Boundary (0.00, negative, extreme numbers)', () => {
    it('3.1: Rejects valorPadrao of 0.00, exact 0, negative values (V06)', () => {
      const invalidPrices = [0, 0.0, -0.01, -1.0, -500.0, -999999];

      for (const val of invalidPrices) {
        const result = createProcedureSchema.safeParse({
          nome: 'Procedimento Teste',
          categoria: 'Facial',
          descricao: 'Descrição válida com mais de 3 caracteres',
          duracaoMinutos: 60,
          valorPadrao: val,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          const errors = result.error.flatten().fieldErrors;
          expect(errors.valorPadrao).toBeDefined();
        }
      }
    });

    it('3.2: Rejects numeric string representation of zero or negative values', () => {
      const invalidStringPrices = ['0', '0.00', '0,00', '-0.01', '-50.00', '-100,50'];

      for (const val of invalidStringPrices) {
        const result = createProcedureSchema.safeParse({
          nome: 'Procedimento Teste',
          categoria: 'Facial',
          descricao: 'Descrição válida',
          duracaoMinutos: 45,
          valorPadrao: val,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          const errors = result.error.flatten().fieldErrors;
          expect(errors.valorPadrao).toBeDefined();
        }
      }
    });

    it('3.3: Accepts minimum valid currency cent (0.01) and standard positive decimals', () => {
      const validPrices = [0.01, 1.0, 50.5, 500.0, 1500.99];

      for (const val of validPrices) {
        const result = createProcedureSchema.safeParse({
          nome: 'Procedimento Válido',
          categoria: 'Estética',
          descricao: 'Procedimento de teste',
          duracaoMinutos: 30,
          valorPadrao: val,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.valorPadrao).toBe(val);
        }
      }
    });

    it('3.4: Preprocessor coerces Brazilian comma currency strings cleanly', () => {
      const brazilianFormatted = [
        { input: '1.500,50', expected: 1500.5 },
        { input: '250,00', expected: 250.0 },
        { input: '0,99', expected: 0.99 },
        { input: '10.000,00', expected: 10000.0 },
      ];

      for (const { input, expected } of brazilianFormatted) {
        const result = createProcedureSchema.safeParse({
          nome: 'Procedimento Formatado',
          categoria: 'Corporal',
          descricao: 'Descrição do procedimento',
          duracaoMinutos: 60,
          valorPadrao: input,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.valorPadrao).toBe(expected);
        }
      }
    });

    it('3.5: Extreme numbers: accepts 9,999,999.99 and rejects values exceeding the limit or non-numbers', () => {
      // Boundary maximum
      const maxValid = createProcedureSchema.safeParse({
        nome: 'Procedimento Máximo',
        categoria: 'Facial',
        descricao: 'Valor no teto permitido',
        duracaoMinutos: 60,
        valorPadrao: 9999999.99,
      });
      expect(maxValid.success).toBe(true);

      // Exceeding maximum
      const exceeding = createProcedureSchema.safeParse({
        nome: 'Procedimento Ultrapassado',
        categoria: 'Facial',
        descricao: 'Valor além do teto',
        duracaoMinutos: 60,
        valorPadrao: 10000000.0,
      });
      expect(exceeding.success).toBe(false);

      // Non-numeric garbage
      const nonNumeric = ['grátis', 'free', 'NaN', 'Infinity', 'abc'];
      for (const val of nonNumeric) {
        const res = createProcedureSchema.safeParse({
          nome: 'Procedimento Inválido',
          categoria: 'Facial',
          descricao: 'Valor não numérico',
          duracaoMinutos: 60,
          valorPadrao: val,
        });
        expect(res.success).toBe(false);
      }
    });

    it('3.6: POST /api/procedures returns 400 when valorPadrao <= 0 or invalid', async () => {
      const authHeaders = await getAuthHeaders();

      const invalidPayloads = [
        { valorPadrao: 0 },
        { valorPadrao: -100 },
        { valorPadrao: 'gratis' },
      ];

      for (const payload of invalidPayloads) {
        const req = new NextRequest('http://localhost:3000/api/procedures', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: 'Procedimento Inválido API',
            categoria: 'Facial',
            descricao: 'Descrição válida',
            duracaoMinutos: 60,
            ...payload,
          }),
        });

        const res = await postProcedureRoute(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error).toBe('Dados do procedimento inválidos');
      }
    });

    it('3.7: DuracaoMinutos boundaries (0, negative, >1440 min) are strictly rejected (V07)', () => {
      const invalidDurations = [0, -1, -60, 1441, 99999];

      for (const d of invalidDurations) {
        const result = createProcedureSchema.safeParse({
          nome: 'Duração Inválida',
          categoria: 'Facial',
          descricao: 'Descrição válida',
          duracaoMinutos: d,
          valorPadrao: 200.0,
        });

        expect(result.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Stock Lot Intake Boundary (Past Expiration, Future Expiration, Quantity 0 or Negative)
  // =========================================================================
  describe('Challenge 4: Stock Lot Intake Boundary (Past Expiration, Future Expiration, Quantity 0 or Negative)', () => {
    it('4.1: Lot intake schema rejects negative quantity and quantity exceeding 1000', () => {
      const negativeResult = createLotSchema.safeParse({
        numeroLote: 'LOTE-NEG',
        quantidadeInicial: -1,
      });
      expect(negativeResult.success).toBe(false);
      if (!negativeResult.success) {
        expect(negativeResult.error.flatten().fieldErrors.quantidadeInicial).toBeDefined();
      }

      const excessiveResult = createLotSchema.safeParse({
        numeroLote: 'LOTE-EXCESS',
        quantidadeInicial: 1001,
      });
      expect(excessiveResult.success).toBe(false);
      if (!excessiveResult.success) {
        expect(excessiveResult.error.flatten().fieldErrors.quantidadeInicial).toBeDefined();
      }
    });

    it('4.2: Quantity 0 creates lot without stock units; positive quantity generates unique sequential units', async () => {
      const product = await createTestProduct({ isReusable: false });

      // Quantity 0
      const lotZero = await createLot(product.id, {
        numeroLote: 'LOTE-QTD-0',
        quantidadeInicial: 0,
      });
      expect(lotZero.totalUnitsCount).toBe(0);
      expect(lotZero.availableUnitsCount).toBe(0);

      // Positive quantity: 3 units
      const lotThree = await createLot(product.id, {
        numeroLote: 'LOTE-QTD-3',
        quantidadeInicial: 3,
      });
      expect(lotThree.totalUnitsCount).toBe(3);
      expect(lotThree.availableUnitsCount).toBe(3);

      const units = await prismaTest.stockUnit.findMany({
        where: { lotId: lotThree.id },
        orderBy: { codigoSerial: 'asc' },
      });
      expect(units).toHaveLength(3);
      expect(units[0].codigoSerial).toBe('LOTE-QTD-3-001');
      expect(units[1].codigoSerial).toBe('LOTE-QTD-3-002');
      expect(units[2].codigoSerial).toBe('LOTE-QTD-3-003');
    });

    it('4.3: Past expiration date marks lot as isExpired=true and blocks usage in clinical attendance (V15)', async () => {
      const client = await createTestClient();
      const procedure = await createTestProcedure();
      const product = await createTestProduct({ isReusable: false });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      // Create lot with expiration date in the past (yesterday)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredLot = await createLot(product.id, {
        numeroLote: 'LOTE-EXP-PAST',
        dataValidade: yesterday,
        quantidadeInicial: 2,
      });

      expect(expiredLot.isExpired).toBe(true);

      // Verify listAvailableUnits filters out the expired lot's units
      const availableUnits = await listAvailableUnits({ productId: product.id });
      const foundInAvailable = availableUnits.some((u) => u.lotId === expiredLot.id);
      expect(foundInAvailable).toBe(false);

      // Verify direct clinical consumption attempt on expired unit throws ValidationError (V15)
      const expiredUnit = await prismaTest.stockUnit.findFirstOrThrow({
        where: { lotId: expiredLot.id },
      });

      await expect(
        recordProductUsage(attendanceId, {
          stockUnitId: expiredUnit.id,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        recordProductUsage(attendanceId, {
          stockUnitId: expiredUnit.id,
        })
      ).rejects.toThrow(/V15/);
    });

    it('4.4: Future expiration date allows lot units to be listed and clinically consumed', async () => {
      const client = await createTestClient();
      const procedure = await createTestProcedure();
      const product = await createTestProduct({ isReusable: false });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      // Future expiration (30 days from now)
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const futureLot = await createLot(product.id, {
        numeroLote: 'LOTE-EXP-FUTURE',
        dataValidade: futureDate,
        quantidadeInicial: 2,
      });

      expect(futureLot.isExpired).toBe(false);

      // listAvailableUnits must include these units
      const availableUnits = await listAvailableUnits({ productId: product.id });
      const found = availableUnits.filter((u) => u.lotId === futureLot.id);
      expect(found).toHaveLength(2);

      // Clinical consumption must succeed
      const usage = await recordProductUsage(attendanceId, {
        stockUnitId: found[0].id,
      });

      expect(usage.id).toBeDefined();
      expect(usage.stockUnitId).toBe(found[0].id);

      // Single-use unit is now marked Esgotado and cannot be used again
      const unitAfter = await prismaTest.stockUnit.findUniqueOrThrow({
        where: { id: found[0].id },
      });
      expect(unitAfter.status).toBe('Esgotado');
    });

    it('4.5: Null expiration date (non-perishable goods) is treated as unexpired and usable', async () => {
      const client = await createTestClient();
      const product = await createTestProduct({ isReusable: false });
      const appt = await createTestAppointment(client.id);
      const attendanceId = appt.attendances[0].id;

      const nonPerishableLot = await createLot(product.id, {
        numeroLote: 'LOTE-NON-PERISHABLE',
        dataValidade: null,
        quantidadeInicial: 1,
      });

      expect(nonPerishableLot.isExpired).toBe(false);

      const available = await listAvailableUnits({ productId: product.id });
      expect(available.some((u) => u.lotId === nonPerishableLot.id)).toBe(true);

      const unit = await prismaTest.stockUnit.findFirstOrThrow({
        where: { lotId: nonPerishableLot.id },
      });

      const usage = await recordProductUsage(attendanceId, {
        stockUnitId: unit.id,
      });
      expect(usage.id).toBeDefined();
    });

    it('4.6: POST /api/products/[id]/lots returns 400 when quantity is negative or product does not exist', async () => {
      const authHeaders = await getAuthHeaders();
      const product = await createTestProduct();

      // Negative quantity
      const reqNeg = new NextRequest(`http://localhost:3000/api/products/${product.id}/lots`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroLote: 'LOTE-API-NEG',
          quantidadeInicial: -5,
        }),
      });

      const resNeg = await postLotRoute(reqNeg, { params: Promise.resolve({ id: product.id }) });
      expect(resNeg.status).toBe(400);

      // Non-existent product ID
      const reqNotFound = new NextRequest(`http://localhost:3000/api/products/00000000-0000-0000-0000-000000000000/lots`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroLote: 'LOTE-API-OK',
          quantidadeInicial: 1,
        }),
      });

      const resNotFound = await postLotRoute(reqNotFound, {
        params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
      });
      expect(resNotFound.status).toBe(404);
    });
  });
});
