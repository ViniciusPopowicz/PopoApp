import { PrismaClient } from '@prisma/client';

/**
 * Resolves the database URL for the current runtime.
 * D7 safety guard: under NODE_ENV=test the connection MUST point to the
 * isolated PopoAppTest database, never the development database.
 */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'test') {
    if (!url || !/database=PopoAppTest(;|$)/i.test(url)) {
      throw new Error(
        `[D7] Ambiente de teste deve usar o banco PopoAppTest. DATABASE_URL atual: ${url ?? '(vazio)'}`
      );
    }
  }
  return url;
}

const prismaClientSingleton = () => {
  const url = resolveDatabaseUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
