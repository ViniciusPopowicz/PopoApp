import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { validateCredentials, hashPassword, getUserById } from '@/services/auth.service';
import bcrypt from 'bcrypt';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Feature F02: Authentication Service & Security (Phase 3)', () => {
  const testNickname = 'admin_auth_test';
  const testPassword = 'PopoApp2024!Secure';
  let activeUserId: string;
  let inactiveUserId: string;

  beforeAll(async () => {
    await cleanTestDatabase();

    const hashedPassword = await hashPassword(testPassword);

    // Create an active user
    const activeUser = await (prismaTest as any).user.create({
      data: {
        nickname: testNickname,
        displayName: 'Administrador de Teste',
        passwordHash: hashedPassword,
        isActive: true,
      },
    });
    activeUserId = activeUser.id;

    // Create an inactive user
    const inactiveUser = await (prismaTest as any).user.create({
      data: {
        nickname: 'inactive_user',
        displayName: 'Usuário Desativado',
        passwordHash: hashedPassword,
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  it('should authenticate user with valid nickname and password', async () => {
    const user = await validateCredentials(testNickname, testPassword);
    expect(user).not.toBeNull();
    expect(user?.userId).toBe(activeUserId);
    expect(user?.nickname).toBe(testNickname);
    expect(user?.displayName).toBe('Administrador de Teste');
  });

  it('should reject authentication when password is incorrect', async () => {
    const user = await validateCredentials(testNickname, 'WrongPassword123!');
    expect(user).toBeNull();
  });

  it('should reject authentication for nonexistent user', async () => {
    const user = await validateCredentials('nonexistent_user', testPassword);
    expect(user).toBeNull();
  });

  it('should reject authentication when user account is inactive', async () => {
    const user = await validateCredentials('inactive_user', testPassword);
    expect(user).toBeNull();
  });

  it('should return null for empty credentials', async () => {
    expect(await validateCredentials('', testPassword)).toBeNull();
    expect(await validateCredentials(testNickname, '')).toBeNull();
    expect(await validateCredentials('   ', '   ')).toBeNull();
  });

  it('should generate valid bcrypt hash matching plaintext', async () => {
    const plain = 'MinhaSenhaSegura#2024';
    const hash = await hashPassword(plain);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    const matches = await bcrypt.compare(plain, hash);
    expect(matches).toBe(true);
  });

  it('should retrieve active user profile by ID without passwordHash', async () => {
    const profile = await getUserById(activeUserId);
    expect(profile).not.toBeNull();
    expect(profile?.userId).toBe(activeUserId);
    expect(profile?.nickname).toBe(testNickname);
    expect((profile as any).passwordHash).toBeUndefined();
  });

  it('should return null from getUserById for inactive or nonexistent user', async () => {
    expect(await getUserById(inactiveUserId)).toBeNull();
    expect(await getUserById('non-existent-uuid-1234')).toBeNull();
  });

  it('middleware should return 401 JSON for unauthenticated /api/* requests (AC 60)', async () => {
    const req = new NextRequest('http://localhost:3000/api/clients', {
      headers: { host: 'localhost:3000' },
    });
    const response = await middleware(req);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Não autorizado');
  });

  it('middleware should redirect unauthenticated page navigation to /login', async () => {
    const req = new NextRequest('http://localhost:3000/clientes', {
      headers: { host: 'localhost:3000' },
    });
    const response = await middleware(req);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });
});
