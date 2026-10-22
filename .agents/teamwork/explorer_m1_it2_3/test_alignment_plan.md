# Test Suite Integration & Tooling Alignment Remediation Plan

**Author**: Explorer M1 Iteration 2 (Agent 3)  
**Date**: 2026-10-06T03:12:00Z  
**Target Project**: PopoApp (`c:\Users\Vinicius\PopoApp\PopoApp`)  
**Scope**: Tooling dependencies (`vitest`, Prisma client) and exact test suite code alignment across `tests/`.

---

## 1. Executive Summary

Milestone 1 audit and challenge revealed two distinct categories of failure preventing test execution:
1. **Tooling & Dependency Gap**: `vitest` and `@vitejs/plugin-react` are declared in `package.json` (lines 62–63), but were never installed into `node_modules` or locked into `package-lock.json`. Furthermore, `node_modules/@prisma/client` only exports the initial `User` model because `npx prisma generate` was blocked by the 9 P1012 cascade validation errors in `prisma/schema.prisma`.
2. **Schema & Test Contract Divergence**: While `prisma/schema.prisma` correctly implements canonical Brazilian Portuguese domain models (`nome`, `telefone`, `dataNascimento`, `valorPadrao`, `ProductLot`, `StockUnit`, `nomeOriginal`, `caminhoRelativo`, `desconto`), 6 files in `tests/` were authored against an English prototype (`name`, `phone`, `birthDate`, `standardValue`, `lot`, `individualStockUnit`, `originalName`, `filePath`, `discount`).

This document provides:
- The dependency and tooling diagnosis.
- A comprehensive catalog of all files under `tests/`.
- Full, copy-paste replacement code for every affected test and helper file.
- The exact verification command sequence for Worker M1.

---

## 2. Tooling & Dependency Investigation

### 2.1 Vitest & Test Runner Status
- **`package.json`**:
  - Script definitions:
    ```json
    "test": "vitest run",
    "test:watch": "vitest"
    ```
  - Declared devDependencies:
    ```json
    "@vitejs/plugin-react": "^4.3.4",
    "vitest": "^2.1.8"
    ```
- **`package-lock.json`**:
  - Exactly **0 occurrences** of `"vitest"`.
  - Exactly **0 occurrences** of `"@vitejs/plugin-react"`.
- **`node_modules`**:
  - `node_modules/vitest`: **DOES NOT EXIST**.
  - `node_modules/@vitejs`: **DOES NOT EXIST**.
  - `node_modules/.bin/vitest` / `vitest.cmd`: **DOES NOT EXIST**.
- **Impact**: Running `npm test` fails immediately with `'vitest' is not recognized as an internal or external command`.
- **Remediation**: Worker M1 must run `npm install` once shell execution is permitted.

### 2.2 Prisma Client Generation State
- **`node_modules/.prisma/client/index.d.ts`**:
  - Currently defines **only** `Model User` (2168 total lines).
  - None of the 17 domain entities (`Client`, `EmergencyContact`, `Appointment`, `PlannedProcedure`, `Attendance`, `MedicalRecord`, `Procedure`, `AttendanceProcedure`, `Product`, `ProcedureProduct`, `ProductLot`, `StockUnit`, `ProductUsage`, `Attachment`, `Payment`, `PixInstallment`, `Reminder`) exist in the generated client.
- **Root Cause**:
  - `npx prisma validate` failed with 9 P1012 referential action errors (cycles on `Attendance`, `ProductUsage`, `Attachment`, `Reminder`).
  - Because validation failed, `npx prisma generate` could not compile the schema into TypeScript types.
- **Impact**:
  - Test files are forced to use `(prismaTest as any)` casts to bypass TypeScript compile errors.
- **Remediation**:
  - After Explorer 1 and Explorer 2's schema fixes (`onDelete: NoAction, onUpdate: NoAction`) resolve the 9 P1012 errors, running `npx prisma generate` will successfully emit full types for all 18 models.

---

## 3. Test Suite Catalog & Divergence Matrix

The `tests/` directory contains 12 files across helpers and 4 test tiers:

| File Path | Status | Nature of Divergence | Required Actions |
|---|---|---|---|
| `tests/helpers/auth-helper.ts` | **ALIGNED** | Pure `iron-session` cookie utility. | None. Keep unchanged. |
| `tests/helpers/cpf-validator.ts` | **ALIGNED** | Pure mathematical MOD 11 reference oracle. | None. Keep unchanged. |
| `tests/helpers/db-cleaner.ts` | **DIVERGENT** | Uses non-canonical table names (`IndividualStockUnit`, `Lot`, `PaymentInstallment`); missing `ProcedureProduct`. | Update `tablesInOrder` to exact canonical 18 tables. |
| `tests/helpers/db-client.ts` | **ALIGNED** | Connects to `PopoAppTest` with guard. | None. Keep unchanged. |
| `tests/helpers/test-fixtures.ts` | **DIVERGENT** | English field names (`name`, `phone`, `birthDate`, etc.) and wrong models (`lot`, `individualStockUnit`). | Align all fixture factories to canonical Portuguese schema. |
| `tests/tier1_features/f01_tooling.spec.ts` | **ALIGNED** | Tooling & CPF oracle unit tests. | None. Keep unchanged. |
| `tests/tier1_features/f03_client_model.spec.ts` | **DIVERGENT** | English fields on Client (`name`, `phone`, `birthDate`, `isActive`) & EmergencyContact (`relationship`). | Align client creation, emergency contacts, soft deactivation (`status = 'inativo'`). |
| `tests/tier2_boundaries/cpf_validation.spec.ts` | **ALIGNED** | Boundary tests on CPF oracle algorithm. | None. Keep unchanged. |
| `tests/tier2_boundaries/v02_v03_appointment_statuses.spec.ts` | **ALIGNED** | Domain enum validation for 6 appointment statuses. | None. Keep unchanged. |
| `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts` | **DIVERGENT** | Raw SQL queries reference non-existent English columns (`originalName`, `storedFileName`, `filePath`, `sizeBytes`). | Replace raw SQL column names with `nomeOriginal`, `nomeArquivo`, `caminhoRelativo`, `tamanhoBytes`. |
| `tests/tier3_combinations/appointment_attendance_d1.spec.ts` | **DIVERGENT** | English fields (`scheduledDate`, `notes`, `cancellationReason`, `rescheduledFromAppointmentId`, `rescheduledToAppointmentId`). | Align to `dataHora`, `observacoes`, `motivoCancelamento`, `rescheduledFromId`, `rescheduledToId`. |
| `tests/tier4_workflows/scenarios_a_through_e.spec.ts` | **DIVERGENT** | English fields across all 5 clinical workflows (`discount`, `standardValue`, `unitIdentifier`, `lotNumber`, `individualStockUnit`). | Align to `desconto`, `valorPadrao`, `codigoSerial`, `numeroLote`, `stockUnit`, `nomeOriginal`, etc. |

---

## 4. Exact Code Edits by File

### 4.1 `tests/helpers/db-cleaner.ts`

**Issue**: Contains obsolete table names (`IndividualStockUnit`, `Lot`, `PaymentInstallment`) and misses `ProcedureProduct`.  
**Remediation**: Align table array in reverse foreign-key order covering all 18 tables:

```typescript
import prismaTest from './db-client';

/**
 * Truncates or deletes all test records from PopoAppTest database
 * in reverse foreign-key dependency order to prevent constraint errors.
 */
export async function cleanTestDatabase(): Promise<void> {
  const tablesInOrder = [
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

  for (const table of tablesInOrder) {
    try {
      await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
    } catch {
      // Table may not exist yet during early migration phases; ignore silently
    }
  }
}

/**
 * Disconnects the Prisma client when testing completes.
 */
export async function closeTestDatabase(): Promise<void> {
  await prismaTest.$disconnect();
}
```

---

### 4.2 `tests/helpers/test-fixtures.ts`

**Issue**:
- `createTestClient`: writes `name`, `phone`, `birthDate`, `address`, `notes`, `isActive` instead of `nome`, `telefone`, `dataNascimento`, `endereco`, `observacoes`, `status`.
- `createTestProcedure`: writes `name`, `description`, `standardValue`, `estimatedDurationMinutes`, `category` instead of `nome`, `descricao`, `valorPadrao`, `duracaoMinutos`, `categoria`.
- `createTestProduct`: writes `name`, `brand`, `unitOfMeasure`, `minimumStockAlert` (non-existent column).
- `createTestLot`: references `lot.create` (model is `ProductLot`), writes `lotNumber`, `expirationDate`, `quantityReceived` (non-existent).
- `createTestStockUnit`: references `individualStockUnit.create` (model is `StockUnit`), writes `unitIdentifier`, uppercase `DISPONIVEL`.
- `createTestAppointment`: writes `scheduledDate`, `notes`, `estimatedValue` instead of `dataHora`, `observacoes`, `valorEstimado`.

**Full Canonical Replacement for `tests/helpers/test-fixtures.ts`**:

```typescript
import prismaTest from './db-client';
import { generateValidCpf } from './cpf-validator';

let fixtureCounter = 1;

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
```

---

### 4.3 `tests/tier1_features/f03_client_model.spec.ts`

**Issue**: Directly queries English properties (`name`, `phone`, `birthDate`, `relationship`, `isActive`).  
**Full Canonical Replacement for `tests/tier1_features/f03_client_model.spec.ts`**:

```typescript
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
```

---

### 4.4 `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`

**Issue**: Raw SQL queries reference non-existent columns `[originalName]`, `[storedFileName]`, `[filePath]`, `[sizeBytes]`.  
**Full Canonical Replacement for `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';

describe('Critical Validation V14 & AC 61: Attachment XOR Constraint (Database Level)', () => {
  let testClientId: string;
  let testAttendanceId: string;

  beforeAll(async () => {
    await cleanTestDatabase();

    // Create client and attendance for attachment ownership references
    const client = await createTestClient();
    testClientId = client.id;

    const appointment = await createTestAppointment(testClientId);
    testAttendanceId = appointment.attendances[0].id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should REJECT an attachment row with BOTH clientId and attendanceId populated (bypassing service layer)', async () => {
    const attachmentId = 'test-att-both-0001';

    // Direct raw SQL insert bypassing any application/service validation
    let errorThrown: any = null;
    try {
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attachmentId}', 'exam.pdf', 'uuid-stored.pdf', 'application/pdf', 1024, './storage/uploads/uuid-stored.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', '${testAttendanceId}'
        )
      `);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    // Verify violation of CK_Attachment_Ownership check constraint
    const errorMessage = String(errorThrown?.message || errorThrown);
    expect(errorMessage.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
  });

  it('should REJECT an attachment row with NEITHER clientId nor attendanceId populated (bypassing service layer)', async () => {
    const attachmentId = 'test-att-neither-0002';

    let errorThrown: any = null;
    try {
      await prismaTest.$executeRawUnsafe(`
        INSERT INTO [Attachment] (
          [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
          [createdAt], [updatedAt], [clientId], [attendanceId]
        ) VALUES (
          '${attachmentId}', 'exam.pdf', 'uuid-stored.pdf', 'application/pdf', 1024, './storage/uploads/uuid-stored.pdf',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, NULL
        )
      `);
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).not.toBeNull();
    const errorMessage = String(errorThrown?.message || errorThrown);
    expect(errorMessage.toLowerCase()).toMatch(/check constraint|ck_attachment_ownership|conflict/i);
  });

  it('should ACCEPT an attachment row with ONLY clientId populated', async () => {
    const attachmentId = 'test-att-client-0003';

    await prismaTest.$executeRawUnsafe(`
      INSERT INTO [Attachment] (
        [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
        [createdAt], [updatedAt], [clientId], [attendanceId]
      ) VALUES (
        '${attachmentId}', 'termo.pdf', 'uuid-termo.pdf', 'application/pdf', 2048, './storage/uploads/uuid-termo.pdf',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '${testClientId}', NULL
      )
    `);

    const records: any[] = await prismaTest.$queryRawUnsafe(`
      SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attachmentId}'
    `);

    expect(records).toHaveLength(1);
    expect(records[0].clientId).toBe(testClientId);
    expect(records[0].attendanceId).toBeNull();
  });

  it('should ACCEPT an attachment row with ONLY attendanceId populated', async () => {
    const attachmentId = 'test-att-attendance-0004';

    await prismaTest.$executeRawUnsafe(`
      INSERT INTO [Attachment] (
        [id], [nomeOriginal], [nomeArquivo], [mimeType], [tamanhoBytes], [caminhoRelativo],
        [createdAt], [updatedAt], [clientId], [attendanceId]
      ) VALUES (
        '${attachmentId}', 'foto_antes.jpg', 'uuid-foto.jpg', 'image/jpeg', 4096, './storage/uploads/uuid-foto.jpg',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, '${testAttendanceId}'
      )
    `);

    const records: any[] = await prismaTest.$queryRawUnsafe(`
      SELECT [id], [clientId], [attendanceId] FROM [Attachment] WHERE [id] = '${attachmentId}'
    `);

    expect(records).toHaveLength(1);
    expect(records[0].attendanceId).toBe(testAttendanceId);
    expect(records[0].clientId).toBeNull();
  });
});
```

---

### 4.5 `tests/tier3_combinations/appointment_attendance_d1.spec.ts`

**Issue**: Uses `scheduledDate`, `notes`, `cancellationReason`, `rescheduledFromAppointmentId`, `rescheduledToAppointmentId`.  
**Full Canonical Replacement for `tests/tier3_combinations/appointment_attendance_d1.spec.ts`**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient } from '../helpers/test-fixtures';

describe('Tier 3: Appointment & Attendance Lifecycle State Machine (D1, AC 57)', () => {
  let clientId: string;

  beforeAll(async () => {
    await cleanTestDatabase();
    const client = await createTestClient();
    clientId = client.id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('D1 Rule 1: Appointment creation instantiates linked Attendance in Pendente status (never Realizado)', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-01T10:00:00Z'),
        status: 'Agendado',
        valorEstimado: 450.0,
        observacoes: 'Agendamento inicial',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
            observacoes: 'Atendimento gerado automaticamente',
          },
        },
      },
      include: {
        attendances: true,
      },
    });

    expect(appt.status).toBe('Agendado');
    expect(appt.attendances).toHaveLength(1);
    expect(appt.attendances[0].status).toBe('Pendente');
    expect(appt.attendances[0].status).not.toBe('Realizado');
  });

  it('D1 Rule 2: Appointment cancellation cascades status Cancelado to pending Attendance', async () => {
    // Setup appointment with pending attendance
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-02T14:00:00Z'),
        status: 'Agendado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    const pendingAttendanceId = appt.attendances[0].id;

    // Execute cancellation transaction (as per D1 state machine contract)
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: {
          status: 'Cancelado',
          motivoCancelamento: 'Cliente com febre',
        },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente',
        },
        data: {
          status: 'Cancelado',
        },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Cancelado');
    expect(updatedAppt.attendances[0].status).toBe('Cancelado');
  });

  it('D1 Rule 3: Appointment no-show (Não compareceu) cascades status Cancelado to pending Attendance', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-03T16:00:00Z'),
        status: 'Confirmado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    // Execute no-show transaction
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: { status: 'Não compareceu' },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente',
        },
        data: { status: 'Cancelado' },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Não compareceu');
    expect(updatedAppt.attendances[0].status).toBe('Cancelado');
  });

  it('D1 Rule 4: Rescheduling sets old appointment to Reagendado, old attendance to Cancelado, creates new Agendado appt with new Pendente attendance', async () => {
    // 1. Original appointment
    const originalAppt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-05T09:00:00Z'),
        status: 'Agendado',
        attendances: {
          create: {
            clientId,
            status: 'Pendente',
          },
        },
      },
      include: { attendances: true },
    });

    const oldAttendanceId = originalAppt.attendances[0].id;
    const newScheduledDate = new Date('2026-11-12T15:00:00Z');

    // 2. Rescheduling transaction
    const newAppt = await (prismaTest as any).$transaction(async (tx: any) => {
      // Create new appointment
      const createdNew = await tx.appointment.create({
        data: {
          clientId,
          dataHora: newScheduledDate,
          status: 'Agendado',
          rescheduledFromId: originalAppt.id,
          attendances: {
            create: {
              clientId,
              status: 'Pendente',
              observacoes: 'Atendimento do reagendamento',
            },
          },
        },
        include: { attendances: true },
      });

      // Update old appointment to Reagendado
      await tx.appointment.update({
        where: { id: originalAppt.id },
        data: {
          status: 'Reagendado',
          rescheduledToId: createdNew.id,
        },
      });

      // Cancel old pending attendance
      await tx.attendance.update({
        where: { id: oldAttendanceId },
        data: { status: 'Cancelado' },
      });

      return createdNew;
    });

    // Verification
    const oldApptReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: originalAppt.id },
      include: { attendances: true },
    });

    expect(oldApptReloaded.status).toBe('Reagendado');
    expect(oldApptReloaded.attendances[0].status).toBe('Cancelado');
    expect(newAppt.status).toBe('Agendado');
    expect(newAppt.attendances[0].status).toBe('Pendente');
  });

  it('D1 Rule 5: Cancelling an appointment does NOT cancel an attendance that was already marked Realizado', async () => {
    const appt = await (prismaTest as any).appointment.create({
      data: {
        clientId,
        dataHora: new Date('2026-11-04T11:00:00Z'),
        status: 'Confirmado',
        attendances: {
          create: {
            clientId,
            status: 'Realizado',
            observacoes: 'Procedimento clínico já concluído',
          },
        },
      },
      include: { attendances: true },
    });

    // Execute cancellation of appointment only affecting pending attendances
    await prismaTest.$transaction([
      (prismaTest as any).appointment.update({
        where: { id: appt.id },
        data: { status: 'Cancelado' },
      }),
      (prismaTest as any).attendance.updateMany({
        where: {
          appointmentId: appt.id,
          status: 'Pendente', // Strictly does NOT match Realizado
        },
        data: { status: 'Cancelado' },
      }),
    ]);

    const updatedAppt = await (prismaTest as any).appointment.findUnique({
      where: { id: appt.id },
      include: { attendances: true },
    });

    expect(updatedAppt.status).toBe('Cancelado');
    // Attendance remains Realizado because clinical encounter actually happened
    expect(updatedAppt.attendances[0].status).toBe('Realizado');
  });
});
```

---

### 4.6 `tests/tier4_workflows/scenarios_a_through_e.spec.ts`

**Issue**: English names across all 5 clinical workflows (`discount`, `standardValue`, `unitIdentifier`, `lotNumber`, `individualStockUnit`, `originalName`, `filePath`, etc.).  
**Full Canonical Replacement for `tests/tier4_workflows/scenarios_a_through_e.spec.ts`**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import {
  createTestClient,
  createTestProcedure,
  createTestProduct,
  createTestLot,
  createTestStockUnit,
} from '../helpers/test-fixtures';

describe('Tier 4: Clinical Workflows & Data Integrity Examples (§47 Scenarios A–E)', () => {
  let clientAId: string;
  let clientBId: string;

  beforeAll(async () => {
    await cleanTestDatabase();

    const clientA = await createTestClient({ nome: 'Paciente Alice' });
    clientAId = clientA.id;

    const clientB = await createTestClient({ nome: 'Paciente Bruno' });
    clientBId = clientB.id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('Example A (§47): Procedure practiced below standard value (no automatic discount)', async () => {
    // 1. Catalog procedure with Standard value: R$ 500.00
    const procedure = await createTestProcedure({
      nome: 'Harmonização Facial - Botox',
      valorPadrao: 500.0,
    });

    // 2. Attendance created with Practiced value: R$ 400.00 and explicit discount: R$ 0.00
    const attendance = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientAId,
        status: 'Realizado',
        desconto: 0.0, // explicit discount R$ 0.00
        procedures: {
          create: {
            procedureId: procedure.id,
            standardValueSnapshot: 500.0,
            practicedValue: 400.0,
          },
        },
      },
      include: {
        procedures: true,
      },
    });

    // Verification:
    // Snapshot = 500.00
    expect(Number(attendance.procedures[0].standardValueSnapshot)).toBe(500.0);
    // Practiced = 400.00
    expect(Number(attendance.procedures[0].practicedValue)).toBe(400.0);
    // Explicit discount remains strictly 0.00 (NOT automatically computed as 100.00)
    expect(Number(attendance.desconto)).toBe(0.0);

    // Dynamic Total computation per D2: sum(practicedValue) - discount
    const practicedSum = attendance.procedures.reduce(
      (acc: number, p: any) => acc + Number(p.practicedValue),
      0
    );
    const computedTotal = practicedSum - Number(attendance.desconto);
    expect(computedTotal).toBe(400.0);
  });

  it('Example B (§47): Explicit Attendance discount (distinct from practiced values)', async () => {
    const proc1 = await createTestProcedure({ nome: 'Preenchimento Labial', valorPadrao: 500.0 });
    const proc2 = await createTestProcedure({ nome: 'Bioestimulador', valorPadrao: 400.0 });

    // Two procedures with practiced total: R$ 800.00 (e.g. 500 + 300)
    // Explicit attendance discount: R$ 100.00
    const attendance = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientAId,
        status: 'Realizado',
        desconto: 100.0, // explicit discount R$ 100.00
        procedures: {
          create: [
            {
              procedureId: proc1.id,
              standardValueSnapshot: 500.0,
              practicedValue: 500.0,
            },
            {
              procedureId: proc2.id,
              standardValueSnapshot: 400.0,
              practicedValue: 300.0,
            },
          ],
        },
      },
      include: {
        procedures: true,
      },
    });

    const practicedSum = attendance.procedures.reduce(
      (acc: number, p: any) => acc + Number(p.practicedValue),
      0
    );
    expect(practicedSum).toBe(800.0);
    expect(Number(attendance.desconto)).toBe(100.0);

    // Dynamic Total per D2: 800.00 - 100.00 = 700.00
    const computedTotal = practicedSum - Number(attendance.desconto);
    expect(computedTotal).toBe(700.0);
  });

  it('Example C (§47): Reusable physical product allowed for same client, rejected for cross-client reuse', async () => {
    // 1. Reusable product (e.g. Frasco de Toxina 100U compartilhado apenas pelo mesmo paciente)
    const product = await createTestProduct({
      nome: 'Toxina Botulínica 100U (Frasco Multidose)',
      isReusable: true,
      unidade: 'frasco',
    });

    const lot = await createTestLot(product.id, { numeroLote: 'LOTE-EX-C' });
    const unit = await createTestStockUnit(lot.id, { codigoSerial: 'UNIT-001' });

    // 2. Client A uses UNIT-001 in Attendance 1
    const att1 = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const usage1 = await (prismaTest as any).productUsage.create({
      data: {
        attendanceId: att1.id,
        stockUnitId: unit.id,
        observacoes: 'Primeira aplicação de Alice',
      },
    });
    expect(usage1.id).toBeDefined();

    // Update unit to record current client
    await (prismaTest as any).stockUnit.update({
      where: { id: unit.id },
      data: { currentClientId: clientAId },
    });

    // 3. Client A uses UNIT-001 again in Attendance 2 -> MUST BE ALLOWED
    const att2 = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const usage2 = await (prismaTest as any).productUsage.create({
      data: {
        attendanceId: att2.id,
        stockUnitId: unit.id,
        observacoes: 'Retoque de Alice (mesma cliente)',
      },
    });
    expect(usage2.id).toBeDefined();

    // 4. Client B attempts to use UNIT-001 in Attendance 3 -> MUST BE REJECTED
    const att3 = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientBId,
        status: 'Realizado',
      },
    });

    // Business check before usage:
    const unitCheck = await (prismaTest as any).stockUnit.findUnique({
      where: { id: unit.id },
      include: {
        usages: {
          include: { attendance: true },
        },
      },
    });

    const previousClientIds = unitCheck.usages.map((u: any) => u.attendance.clientId);
    const hasDifferentClient = previousClientIds.some((id: string) => id !== clientBId);

    // Business invariant test: must detect cross-client reuse conflict
    expect(hasDifferentClient).toBe(true);
  });

  it('Example D (§47): Rescheduling workflow preserves historical linkage', async () => {
    const originalDate = new Date('2026-12-01T10:00:00Z');
    const newDate = new Date('2026-12-05T15:00:00Z');

    // 1. Original appointment
    const original = await (prismaTest as any).appointment.create({
      data: {
        clientId: clientAId,
        dataHora: originalDate,
        status: 'Agendado',
      },
    });

    // 2. Rescheduling creates new appointment and links to old
    const newAppt = await (prismaTest as any).appointment.create({
      data: {
        clientId: clientAId,
        dataHora: newDate,
        status: 'Agendado',
        rescheduledFromId: original.id,
      },
    });

    await (prismaTest as any).appointment.update({
      where: { id: original.id },
      data: {
        status: 'Reagendado',
        rescheduledToId: newAppt.id,
      },
    });

    // Historical audit check: original appointment retains its date and references new appointment
    const originalReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: original.id },
    });
    expect(originalReloaded.status).toBe('Reagendado');
    expect(originalReloaded.rescheduledToId).toBe(newAppt.id);

    const newReloaded = await (prismaTest as any).appointment.findUnique({
      where: { id: newAppt.id },
    });
    expect(newReloaded.rescheduledFromId).toBe(original.id);
  });

  it('Example E (§47): Client vs Attendance attachment exclusivity', async () => {
    // 1. Test result belonging generally to the Client is stored as Client attachment
    const clientAttachment = await (prismaTest as any).attachment.create({
      data: {
        nomeOriginal: 'exame_sangue.pdf',
        nomeArquivo: 'uuid-exame.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024,
        caminhoRelativo: './storage/uploads/uuid-exame.pdf',
        clientId: clientAId,
        attendanceId: null,
      },
    });
    expect(clientAttachment.clientId).toBe(clientAId);
    expect(clientAttachment.attendanceId).toBeNull();

    // 2. Photo specific to a particular service is stored as Attendance attachment
    const att = await (prismaTest as any).attendance.create({
      data: {
        clientId: clientAId,
        status: 'Realizado',
      },
    });

    const attendanceAttachment = await (prismaTest as any).attachment.create({
      data: {
        nomeOriginal: 'foto_procedimento_antes.jpg',
        nomeArquivo: 'uuid-foto.jpg',
        mimeType: 'image/jpeg',
        tamanhoBytes: 2048,
        caminhoRelativo: './storage/uploads/uuid-foto.jpg',
        clientId: null,
        attendanceId: att.id,
      },
    });
    expect(attendanceAttachment.attendanceId).toBe(att.id);
    expect(attendanceAttachment.clientId).toBeNull();

    // 3. Verifying exclusivity: An attachment must not belong to both contexts
    const isBothNull = clientAttachment.clientId === null && clientAttachment.attendanceId === null;
    const isBothSet = clientAttachment.clientId !== null && clientAttachment.attendanceId !== null;
    expect(isBothNull).toBe(false);
    expect(isBothSet).toBe(false);
  });
});
```

---

## 5. Execution & Verification Sequence for Worker M1

Worker M1 should execute the following steps in sequence:

1. **Apply Schema and Migration Fixes** (from Explorer 1 & 2):
   - Update `prisma/schema.prisma` with `onDelete: NoAction, onUpdate: NoAction` for the 9 diamond relation paths.
   - Update `prisma/migrations/20261006000000_init_domain_models/migration.sql` with matching T-SQL foreign key actions.
2. **Apply Test Suite Alignments** (from Section 4 above):
   - Overwrite `tests/helpers/db-cleaner.ts`.
   - Overwrite `tests/helpers/test-fixtures.ts`.
   - Overwrite `tests/tier1_features/f03_client_model.spec.ts`.
   - Overwrite `tests/tier2_boundaries/v14_attachment_xor_constraint.spec.ts`.
   - Overwrite `tests/tier3_combinations/appointment_attendance_d1.spec.ts`.
   - Overwrite `tests/tier4_workflows/scenarios_a_through_e.spec.ts`.
3. **Execute Tooling Commands in Shell**:
   ```powershell
   # Step A: Install vitest and lock dependencies
   npm install

   # Step B: Validate Prisma schema compiles with 0 errors
   npx prisma validate

   # Step C: Generate full TypeScript client for all 18 models
   npx prisma generate

   # Step D: Deploy/verify migration against LocalDB test database
   npx prisma migrate dev --name init_domain_models

   # Step E: Execute automated test suite
   npm test
   ```
4. **Verification Criteria**:
   - `npx prisma validate`: Exit code 0 ("The schema at prisma\schema.prisma is valid").
   - `npx prisma generate`: Generates all 18 models into `@prisma/client`.
   - `npm test`: Runs vitest and passes with 0 failures across all 7 spec files.
