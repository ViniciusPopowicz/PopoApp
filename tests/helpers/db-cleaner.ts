import prismaTest from './db-client';

/**
 * Deletes all records from the PopoAppTest database in reverse foreign-key
 * dependency order. Self-referencing appointment links are cleared first so
 * SQL Server does not reject the delete (Msg 547). Errors are NOT swallowed:
 * a failed cleanup must fail the test run instead of leaking state.
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

  await prismaTest.$executeRawUnsafe(
    'UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL'
  );
  await prismaTest.$executeRawUnsafe('UPDATE [Client] SET [profilePhotoId] = NULL');

  for (const table of tablesInOrder) {
    await prismaTest.$executeRawUnsafe(`DELETE FROM [${table}]`);
  }
}

/**
 * Disconnects the Prisma client when testing completes.
 */
export async function closeTestDatabase(): Promise<void> {
  await prismaTest.$disconnect();
}
