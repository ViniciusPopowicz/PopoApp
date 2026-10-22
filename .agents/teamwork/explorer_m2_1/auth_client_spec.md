# Specification & Implementation Blueprint: Phase 3 (Auth) & Phase 4 (Client Management)

**Milestone**: M2 (Security, Core Entities & Catalog)  
**Author**: Explorer M2 1  
**Status**: Ready for Implementation  
**Target Files**:
- `src/lib/cpf.ts`
- `src/lib/errors.ts`
- `src/lib/session.ts`
- `src/services/auth.service.ts`
- `src/services/client.service.ts`
- `src/schemas/auth.ts`
- `src/schemas/client.ts`
- `src/middleware.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[id]/route.ts`
- `src/app/api/clients/[id]/contacts/route.ts`
- `src/app/api/clients/[id]/contacts/[contactId]/route.ts`
- `tests/tier1_features/f02_auth_service.spec.ts`
- `tests/tier1_features/f03_client_service.spec.ts`

---

## 1. Executive Summary & Architectural Context

PopoApp is an aesthetic clinic management system built with Next.js 15, React 19, TypeScript, iron-session, and Prisma ORM on Microsoft SQL Server LocalDB. This document provides the complete, authoritative engineering blueprint for **Phase 3 (Authentication)** and **Phase 4 (Client Management)** as defined in `POPOAPP_DEVELOPMENT_SPEC.md`, `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`, `PROJECT.md`, and `ORIGINAL_REQUEST.md`.

### Core Mandates Addressed:
1. **Decision D4 & AC 62 (Mandatory & Unique CPF)**: Client CPF is mandatory, validated against the Brazilian MOD 11 checksum algorithm, stored normalized (11 digits), and strictly unique at both the domain service layer and the database layer (`@unique` index).
2. **Decision D7 (Isolated Testing)**: Zero mocks for domain rules. All authentication, CPF validation, and client lifecycle operations are verified with automated Vitest suites against the test database `PopoAppTest`.
3. **Spec §3, §4, §32 (V01, V02, V04, V05 / V13)**:
   - Client is an independent entity with basic registration, contact fields, and notes.
   - Client supports $1:N$ emergency contacts (`Client 1:N EmergencyContact`).
   - Soft-delete status toggle (`ativo` / `inativo`) preserves complete medical, financial, and clinical history (§30).
   - Consolidated client history is derived dynamically from real domain records (§26, §41), not duplicate artificial tables.
4. **Spec §29 & Phase 3 (Authentication)**: Single-professional authentication replacing existing mock logic in `auth.service.ts` with real database lookup against Prisma `User`, password verification via `bcrypt.compare`, and active user checking (`user.isActive`).
5. **AC 60 (Security Protection)**: All API routes return 401 Unauthorized for unauthenticated requests. Middleware correctly distinguishes API requests (JSON 401) from page navigations (redirect to `/login`).

---

## 2. Phase 3: Authentication & Security Architecture

### 2.1 Database Model (`User`)
Defined in `prisma/schema.prisma`:
```prisma
model User {
  id           String   @id @default(uuid())
  nickname     String   @unique
  displayName  String
  passwordHash String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### 2.2 `src/services/auth.service.ts`
The current file has hardcoded mock logic for `admin` and `PopoApp2024!`. The new implementation replaces this with a real Prisma query and `bcrypt.compare`.

#### Implementation Blueprint:
```typescript
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';

export interface AuthenticatedUser {
  userId: string;
  nickname: string;
  displayName: string;
}

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Validates user credentials against the database.
 * Returns user session info if valid, null otherwise.
 */
export async function validateCredentials(
  nickname: string,
  password: string
): Promise<AuthenticatedUser | null> {
  if (!nickname || !password) {
    return null;
  }

  const cleanNickname = nickname.trim();
  if (!cleanNickname) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { nickname: cleanNickname },
  });

  if (!user) {
    return null;
  }

  // Reject inactive accounts
  if (!user.isActive) {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return null;
  }

  return {
    userId: user.id,
    nickname: user.nickname,
    displayName: user.displayName,
  };
}

/**
 * Utility to hash plaintext passwords (used in seeds and user management).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/**
 * Retrieves user profile by ID without exposing the password hash.
 */
export async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return {
    userId: user.id,
    nickname: user.nickname,
    displayName: user.displayName,
  };
}
```

### 2.3 Session Verification Helper (`src/lib/session.ts`)
Add `requireAuth` to enforce session validation in route handlers and server actions.

#### Implementation Blueprint:
```typescript
import { SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { UnauthorizedError } from '@/lib/errors';

export interface SessionData {
  userId: string;
  nickname: string;
  displayName: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_12345',
  cookieName: 'popoapp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
  ttl: 60 * 60 * 24, // 24 hours
};

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Guard that verifies the active session.
 * Throws UnauthorizedError (401) if not logged in.
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session || !session.isLoggedIn || !session.userId) {
    throw new UnauthorizedError('Sessão expirada ou não autenticada');
  }
  return session;
}
```

### 2.4 Middleware Hardening (`src/middleware.ts`)
Current flaw: `src/middleware.ts` redirects unauthenticated `/api/*` calls to `/login`. For API calls, it must return `401 Unauthorized` JSON.

#### Implementation Blueprint:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('popoapp-session');

  if (!sessionCookie) {
    // API routes must return 401 JSON instead of redirecting
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 3. Phase 4: Client Management Architecture

### 3.1 Domain Errors (`src/lib/errors.ts`)
To maintain clean separation between HTTP status codes and domain logic:
```typescript
export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends DomainError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, 400);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso proibido') {
    super(message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Registro não encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflito de dados') {
    super(message, 409);
  }
}
```

---

### 3.2 Brazilian CPF Validation Algorithm (`src/lib/cpf.ts`)
Implements Receita Federal MOD 11 specification, identical to the test oracle in `tests/helpers/cpf-validator.ts`.

#### Algorithm Specification:
1. `normalizeCpf(raw: string | null | undefined): string`  
   - Removes all non-digit characters (`\D`).
   - Returns string of digits `0-9` (or `""` if falsy).
2. `formatCpf(raw: string): string`  
   - Formats 11 digits to `000.000.000-00`.
   - Returns unformatted string if length is not 11.
3. `isValidCpf(raw: string | null | undefined): boolean`  
   - Must be non-empty and have exactly 11 digits after normalization.
   - Rejects sequences of identical repeated digits (`00000000000` to `99999999999`) using `/^(\d)\1{10}$/`.
   - **Check Digit 1 (D1)**:
     $$\text{Sum}_1 = \sum_{i=0}^{8} \text{clean}[i] \times (10 - i)$$
     $$\text{Rest}_1 = (\text{Sum}_1 \times 10) \pmod{11}$$
     If $\text{Rest}_1 \in \{10, 11\}$, $\text{Rest}_1 = 0$.  
     If $\text{Rest}_1 \neq \text{clean}[9]$, return `false`.
   - **Check Digit 2 (D2)**:
     $$\text{Sum}_2 = \sum_{i=0}^{9} \text{clean}[i] \times (11 - i)$$
     $$\text{Rest}_2 = (\text{Sum}_2 \times 10) \pmod{11}$$
     If $\text{Rest}_2 \in \{10, 11\}$, $\text{Rest}_2 = 0$.  
     If $\text{Rest}_2 \neq \text{clean}[10]$, return `false`.
   - Returns `true` if and only if both verification digits match.

#### Implementation Blueprint:
```typescript
/**
 * Normalizes CPF by removing all non-digit characters.
 */
export function normalizeCpf(rawCpf: string | null | undefined): string {
  if (!rawCpf) return '';
  return rawCpf.replace(/\D/g, '');
}

/**
 * Formats an 11-digit CPF to canonical Brazilian mask 000.000.000-00.
 */
export function formatCpf(rawCpf: string): string {
  const clean = normalizeCpf(rawCpf);
  if (clean.length !== 11) return clean;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Validates Brazilian CPF according to Receita Federal MOD 11 rules.
 */
export function isValidCpf(rawCpf: string | null | undefined): boolean {
  const clean = normalizeCpf(rawCpf);

  if (clean.length !== 11) return false;

  // Rejects sequences of identical digits (000.000.000-00, 111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // First verification digit (D1)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rest1 = (sum1 * 10) % 11;
  if (rest1 === 10 || rest1 === 11) rest1 = 0;
  if (rest1 !== parseInt(clean.charAt(9), 10)) return false;

  // Second verification digit (D2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let rest2 = (sum2 * 10) % 11;
  if (rest2 === 10 || rest2 === 11) rest2 = 0;
  if (rest2 !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}
```

---

### 3.3 Zod Validation Schemas (`src/schemas/client.ts`)

```typescript
import { z } from 'zod';
import { isValidCpf, normalizeCpf } from '@/lib/cpf';

export const emergencyContactInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome do contato deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  telefone: z
    .string()
    .trim()
    .min(8, 'Telefone do contato inválido')
    .max(20, 'Telefone muito longo'),
  parentesco: z
    .string()
    .trim()
    .min(2, 'Parentesco é obrigatório')
    .max(50, 'Parentesco muito longo'),
  observacoes: z
    .string()
    .trim()
    .max(500, 'Observações muito longas')
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateEmergencyContactSchema = emergencyContactInputSchema.partial();

export const createClientSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(150, 'Nome muito longo'),
  cpf: z
    .string()
    .trim()
    .min(1, 'CPF é obrigatório')
    .refine((val) => isValidCpf(val), {
      message: 'CPF inválido',
    })
    .transform((val) => normalizeCpf(val)),
  telefone: z
    .string()
    .trim()
    .min(8, 'Telefone inválido')
    .max(20, 'Telefone muito longo'),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal('')),
  dataNascimento: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  endereco: z
    .string()
    .trim()
    .max(255, 'Endereço muito longo')
    .optional()
    .nullable(),
  observacoes: z
    .string()
    .trim()
    .max(4000, 'Observações muito longas')
    .optional()
    .nullable(),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  emergencyContacts: z.array(emergencyContactInputSchema).optional().default([]),
});

export const updateClientSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(150)
    .optional(),
  cpf: z
    .string()
    .trim()
    .refine((val) => isValidCpf(val), { message: 'CPF inválido' })
    .transform((val) => normalizeCpf(val))
    .optional(),
  telefone: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .optional(),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal(''))
    .optional(),
  dataNascimento: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null))
    .optional(),
  endereco: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),
  observacoes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable(),
  status: z.enum(['ativo', 'inativo']).optional(),
});

export const clientListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ativo', 'inativo', 'todos']).optional().default('ativo'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactInputSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
```

---

### 3.4 Client Service (`src/services/client.service.ts`)

#### Business Invariants & Operations:
1. **Mandatory CPF Validation**: Fails immediately if CPF is missing or invalid MOD 11 checksum.
2. **Normalized CPF Storage**: Digits-only 11 characters.
3. **Uniqueness Check (AC 62)**:
   - Queries `prisma.client.findUnique({ where: { cpf } })`.
   - Catches Prisma `P2002` error on unique constraint as defense-in-depth, translating it into a `ConflictError('CPF já cadastrado para outro cliente')`.
4. **Emergency Contacts ($1:N$, V13)**:
   - Supports atomic nested creation during client creation.
   - Provides methods `addEmergencyContact`, `updateEmergencyContact`, `deleteEmergencyContact`, `listEmergencyContacts`.
5. **Soft-delete / Status Toggle (`ativo`/`inativo`, V05 / §30)**:
   - `deactivateClient(id)`: sets `status = 'inativo'`. Retains all appointments, attendances, medical records, payments, attachments.
   - `activateClient(id)`: sets `status = 'ativo'`.
6. **Search & Pagination (§40)**:
   - Matches text across `nome`, `cpf` (normalized substring), `telefone`, and `email`.
   - Filters by active status (`ativo`, `inativo`, or `todos`).
7. **Consolidated History (§26, §41)**:
   - Queries real related models (`Appointment`, `Attendance`, `MedicalRecord`, `Payment`, `Attachment`, `StockUnit`).
   - Assembles an organized history without duplicate artificial tables.

#### Implementation Blueprint:
```typescript
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
   * Registers a new client with mandatory, valid, unique CPF and optional emergency contacts.
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
          emergencyContacts: true,
        },
      });

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
          emergencyContacts: true,
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
   * Soft-deactivates client preserving historical clinical and financial records.
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
                stockUnit: {
                  include: {
                    product: true,
                    lot: true,
                  },
                },
              },
            },
            payments: {
              orderBy: { createdAt: 'asc' },
            },
            attachments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        stockUnits: {
          include: {
            product: true,
            lot: true,
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
```

---

## 4. API Routes Specifications

### 4.1 `POST /api/clients` & `GET /api/clients` (`src/app/api/clients/route.ts`)

#### POST /api/clients
- **Auth**: Required (`requireAuth()`). Returns 401 if unauthenticated.
- **Request Body**: JSON validated with `createClientSchema`.
- **Responses**:
  - `201 Created`: `{ success: true, data: Client }`
  - `400 Bad Request`: `{ success: false, error: 'Dados inválidos', details: ... }`
  - `401 Unauthorized`: `{ success: false, error: 'Não autorizado' }`
  - `409 Conflict`: `{ success: false, error: 'CPF já cadastrado para outro cliente' }`

#### GET /api/clients
- **Auth**: Required (`requireAuth()`). Returns 401 if unauthenticated.
- **Query Params**: `search`, `status`, `page`, `limit` (validated with `clientListQuerySchema`).
- **Responses**:
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [...],
      "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
    }
    ```
  - `401 Unauthorized`: `{ success: false, error: 'Não autorizado' }`

#### Route Implementation Blueprint:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { createClientSchema, clientListQuerySchema } from '@/schemas/client';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = clientListQuerySchema.parse(searchParams);

    const result = await ClientService.listClients(query);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/clients:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const client = await ClientService.createClient(parsed.data);
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in POST /api/clients:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
```

---

### 4.2 `GET /api/clients/[id]`, `PUT /api/clients/[id]`, `DELETE /api/clients/[id]` (`src/app/api/clients/[id]/route.ts`)

#### GET /api/clients/[id]
- **Auth**: Required.
- **Query Params**: `history=true` (optional). If `true`, calls `ClientService.getClientWithHistory(id)`. Otherwise `ClientService.getClientById(id)`.
- **Responses**:
  - `200 OK`: `{ success: true, data: Client }`
  - `404 Not Found`: `{ success: false, error: 'Cliente não encontrado' }`

#### PUT /api/clients/[id]
- **Auth**: Required.
- **Request Body**: JSON validated with `updateClientSchema`.
- **Responses**:
  - `200 OK`: `{ success: true, data: Client }`
  - `400 Bad Request`: `{ success: false, error: 'Dados inválidos' }`
  - `404 Not Found`: `{ success: false, error: 'Cliente não encontrado' }`
  - `409 Conflict`: `{ success: false, error: 'CPF já cadastrado para outro cliente' }`

#### DELETE /api/clients/[id]
- **Auth**: Required.
- **Action**: Soft-deletes (sets `status: 'inativo'`).
- **Responses**:
  - `200 OK`: `{ success: true, message: 'Cliente inativado com sucesso' }`
  - `404 Not Found`: `{ success: false, error: 'Cliente não encontrado' }`

#### Route Implementation Blueprint:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { updateClientSchema } from '@/schemas/client';
import { DomainError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const includeHistory = request.nextUrl.searchParams.get('history') === 'true';

    const client = includeHistory
      ? await ClientService.getClientWithHistory(id)
      : await ClientService.getClientById(id);

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await ClientService.updateClient(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in PUT /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await ClientService.deactivateClient(id);
    return NextResponse.json({ success: true, message: 'Cliente inativado com sucesso' });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in DELETE /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
```

---

### 4.3 Emergency Contacts API Routes (`src/app/api/clients/[id]/contacts/route.ts` & `[contactId]/route.ts`)

#### POST /api/clients/[id]/contacts
- Adds an emergency contact to the client.
- Body validated with `emergencyContactInputSchema`.
- Returns `201 Created`.

#### PUT /api/clients/[id]/contacts/[contactId]
- Updates an emergency contact.
- Body validated with `updateEmergencyContactSchema`.
- Returns `200 OK`.

#### DELETE /api/clients/[id]/contacts/[contactId]
- Deletes an emergency contact.
- Returns `200 OK`.

---

## 5. Interface Contracts & Dependents (For Downstream Milestones)

### 5.1 Downstream Interface: Client Service ↔ Appointment Service (M3)
- `getClient(id: string): Promise<Client | null>`
- `validateClientActive(id: string): Promise<boolean>`:
  ```typescript
  static async validateClientActive(id: string): Promise<boolean> {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { status: true },
    });
    return client?.status === 'ativo';
  }
  ```

### 5.2 Downstream Interface: Client Service ↔ Stock Unit Reusability (M3)
- `StockUnit` model links `clientId: String?`.
- In `getClientWithHistory(id)`: returns `stockUnits` linked to this client for display on the client detail page.
- Prevents cross-client contamination per §32 V16.

### 5.3 Downstream Interface: Client Service ↔ Attachments Engine (M2 / M3)
- `profilePhotoId`: Reference to `Attachment` record.
- When photo is replaced, `profilePhotoId` is updated; the previous photo can be deleted (§5).
- Client attachments are strictly owned by Client (`clientId` non-nullable, `attendanceId` null).

---

## 6. Test Suite & Verification Matrix

### 6.1 Feature Coverage Tests: Auth Service (`tests/tier1_features/f02_auth_service.spec.ts`)
Must cover:
1. `validateCredentials`: Successful login with seeded admin nickname and password.
2. `validateCredentials`: Returns `null` when given wrong password.
3. `validateCredentials`: Returns `null` when given nonexistent nickname.
4. `validateCredentials`: Returns `null` when user exists but `isActive: false`.
5. `hashPassword`: Produces valid bcrypt hash verified by `bcrypt.compare`.
6. Middleware / API probe: Direct unauthenticated HTTP request to `/api/clients` returns HTTP 401 with `{ success: false, error: 'Não autorizado' }`.

### 6.2 Feature Coverage Tests: Client Service (`tests/tier1_features/f03_client_service.spec.ts`)
Must cover:
1. `createClient`: Creates client with mandatory valid CPF, normalizes CPF to 11 digits, sets default status `ativo`.
2. `createClient`: Rejects client creation without CPF (throws `ValidationError`).
3. `createClient`: Rejects client creation with invalid CPF checksum (e.g. `12345678900`, throws `ValidationError`).
4. `createClient`: Rejects client creation with repetitive digits (e.g. `111.111.111-11`, throws `ValidationError`).
5. `createClient`: Rejects duplicate CPF at service layer (throws `ConflictError`).
6. Unique constraint defense-in-depth: Rejects duplicate CPF at Prisma DB level with `P2002` (AC 62).
7. `createClient`: Accepts and creates multiple emergency contacts in the same transaction ($1:N$, V13).
8. `emergencyContacts`: Adding, updating, and deleting individual emergency contacts.
9. `deactivateClient`: Soft-deactivates client (`status = 'inativo'`), preserving all related appointments and attendances.
10. `listClients`: Search by full name, partial name, phone, and normalized CPF.
11. `getClientWithHistory`: Returns derived appointments, attendances, medical records, payments, and attachments without artificial history tables.

### 6.3 Boundary Tests: CPF Validation (`tests/tier2_boundaries/cpf_validation.spec.ts`)
Already created and passing! Exercises:
- Normalization of punctuation, spaces, and slashes.
- Formatting of 11-digit strings into `000.000.000-00`.
- Mathematical MOD 11 verification across generated seed CPFs.
- Rejection of all 10 repetitive sequences (`00000000000` through `99999999999`).
- Corrupted check digits D1 and D2.
- Short (<11) and long (>11) strings.

---

## 7. Migration & Seed Alignment

### 7.1 Existing Migration:
The initial migration `20261006000000_init_domain_models/migration.sql` already creates:
- `[User]` table with `[nickname]` unique constraint.
- `[Client]` table with `[cpf]` unique constraint.
- `[EmergencyContact]` table with foreign key `[clientId]` cascading on delete.

### 7.2 Seed Script (`prisma/seed.ts`):
Current seed creates `admin` with `PopoApp2024!` and bcrypt hash (cost 12):
```typescript
const passwordHash = await bcrypt.hash('PopoApp2024!', 12);
await prisma.user.upsert({
  where: { nickname: 'admin' },
  update: {},
  create: { nickname: 'admin', displayName: 'Administrador', passwordHash, isActive: true },
});
```
This is fully compatible with the designed `validateCredentials` logic.

---

## 8. Summary of File Changes for Implementation Agent

| File | Change Summary |
|---|---|
| `src/lib/cpf.ts` | **NEW**: MOD 11 verification, normalization, formatting |
| `src/lib/errors.ts` | **NEW**: Domain error classes (`ValidationError`, `ConflictError`, `NotFoundError`, etc.) |
| `src/lib/session.ts` | **UPDATE**: Add `requireAuth()` guard throwing `UnauthorizedError` |
| `src/services/auth.service.ts` | **UPDATE**: Replace mock with Prisma `user.findUnique`, `bcrypt.compare`, and `isActive` check |
| `src/schemas/client.ts` | **NEW**: Zod schemas for client creation, update, query, and emergency contacts |
| `src/services/client.service.ts` | **NEW**: Core domain client service enforcing D4, AC 62, V01, V02, V04, V05 / V13, search, and derived history |
| `src/middleware.ts` | **UPDATE**: Return 401 JSON for unauthenticated `/api/*` requests instead of redirecting to `/login` |
| `src/app/api/clients/route.ts` | **NEW**: GET (search & pagination) and POST (creation) route handlers |
| `src/app/api/clients/[id]/route.ts` | **NEW**: GET (detail/history), PUT (update), DELETE (soft-deactivate) route handlers |
| `src/app/api/clients/[id]/contacts/route.ts` | **NEW**: Emergency contacts list and create endpoints |
| `src/app/api/clients/[id]/contacts/[contactId]/route.ts` | **NEW**: Emergency contact update and delete endpoints |
| `tests/tier1_features/f02_auth_service.spec.ts` | **NEW**: Unit & integration test suite for auth service |
| `tests/tier1_features/f03_client_service.spec.ts` | **NEW**: Integration test suite for client service and AC 62 |
