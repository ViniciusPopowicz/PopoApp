import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('PopoApp2024!', 12);
  await prisma.user.upsert({
    where: { nickname: 'admin' },
    update: {},
    create: { nickname: 'admin', displayName: 'Administrador', passwordHash, isActive: true },
  });
  console.log('Seed completed: admin user created');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
