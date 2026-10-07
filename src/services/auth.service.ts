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
