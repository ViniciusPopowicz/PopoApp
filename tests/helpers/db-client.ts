import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  'sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT';

// Safety Guard: NEVER allow tests to touch development database (PopoApp) or production
if (!TEST_DATABASE_URL.includes('PopoAppTest')) {
  throw new Error(
    `[CRITICAL ISOLATION ERROR] Database connection string must point to PopoAppTest! Received: ${TEST_DATABASE_URL}`
  );
}

export const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
  log: process.env.DEBUG_TEST_SQL ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

export default prismaTest;
