const { PrismaClient } = require('@prisma/client');

async function main() {
  const prismaDev = new PrismaClient({
    datasources: { db: { url: 'sqlserver://localhost:1433;database=PopoApp;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT' } }
  });
  const prismaTest = new PrismaClient({
    datasources: { db: { url: 'sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT' } }
  });

  try {
    const devUsers = await prismaDev.user.count();
    const devClients = await prismaDev.client.count();
    const devProcs = await prismaDev.procedure.count();
    const devAppts = await prismaDev.appointment.count();
    const devAtts = await prismaDev.attendance.count();
    const devPayments = await prismaDev.payment.count();

    console.log('--- Dev Database (PopoApp) ---');
    console.log('Users:', devUsers);
    console.log('Clients:', devClients);
    console.log('Procedures:', devProcs);
    console.log('Appointments:', devAppts);
    console.log('Attendances:', devAtts);
    console.log('Payments:', devPayments);

    const testUsers = await prismaTest.user.count();
    const testClients = await prismaTest.client.count();

    console.log('--- Test Database (PopoAppTest) ---');
    console.log('Users:', testUsers);
    console.log('Clients:', testClients);
  } finally {
    await prismaDev.$disconnect();
    await prismaTest.$disconnect();
  }
}

main().catch(console.error);
