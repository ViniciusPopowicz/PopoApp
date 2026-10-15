import prisma from '@/lib/prisma';

export const TEST_DATABASE_URL = process.env.DATABASE_URL ?? '';

// Safety Guard: NEVER allow tests to touch development database (PopoApp) or production
if (!/database=PopoAppTest(;|$)/i.test(TEST_DATABASE_URL)) {
  throw new Error(
    `[CRITICAL ISOLATION ERROR] Database connection string must point to PopoAppTest! Received: ${TEST_DATABASE_URL}`
  );
}

/**
 * Tests share the exact same Prisma client (and connection pool) as the
 * domain services, so fixtures and services always see the same database.
 */
export const prismaTest = prisma;

export default prismaTest;
