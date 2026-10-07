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
