const { PrismaClient } = require('@prisma/client');

async function main() {
  const devClient = new PrismaClient({
    datasources: {
      db: {
        url: 'sqlserver://localhost:1433;database=PopoApp;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT',
      },
    },
  });

  const testClient = new PrismaClient({
    datasources: {
      db: {
        url: 'sqlserver://localhost:1433;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT',
      },
    },
  });

  const dev = {
    users: await devClient.user.count(),
    clients: await devClient.client.count(),
    appointments: await devClient.appointment.count(),
    attendances: await devClient.attendance.count(),
    payments: await devClient.payment.count(),
    reminders: await devClient.reminder.count(),
  };

  const test = {
    users: await testClient.user.count(),
    clients: await testClient.client.count(),
    appointments: await testClient.appointment.count(),
    attendances: await testClient.attendance.count(),
    payments: await testClient.payment.count(),
    reminders: await testClient.reminder.count(),
  };

  console.log('AUDIT_DB_COUNTS:', JSON.stringify({ dev, test }));

  await devClient.$disconnect();
  await testClient.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
