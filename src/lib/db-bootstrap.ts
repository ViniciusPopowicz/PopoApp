import prisma from '@/lib/prisma';

const globalForBootstrap = globalThis as unknown as {
  dbSchemaEnsured?: boolean;
  dbSchemaPromise?: Promise<void> | null;
};

/**
 * Idempotently ensures that Phase 1-6 schema columns and tables exist on the target SQL Server database.
 * Prevents Prisma P2021 / P2022 500 Internal Server Errors on Dashboard, Products, Reminders, and Financial modules
 * if the database was initialized with the baseline migration before remediation migration 2 was applied or if
 * migration 2 previously halted on SQL Server index dependencies.
 *
 * Safe no-op in in-memory Vitest environments where $executeRawUnsafe is not a real SQL Server engine.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  if (globalForBootstrap.dbSchemaEnsured) return;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    globalForBootstrap.dbSchemaEnsured = true;
    return;
  }

  if (globalForBootstrap.dbSchemaPromise) {
    return globalForBootstrap.dbSchemaPromise;
  }

  globalForBootstrap.dbSchemaPromise = (async () => {
    try {
      const anyPrisma = prisma as any;
      if (typeof anyPrisma.$executeRawUnsafe !== 'function') {
        globalForBootstrap.dbSchemaEnsured = true;
        return;
      }

      const check = await anyPrisma.$queryRawUnsafe(`
        SELECT 
          COL_LENGTH('[dbo].[Product]', 'trackingMode') AS hasTrackingMode,
          COL_LENGTH('[dbo].[Reminder]', 'recurrenceId') AS hasRecurrenceId,
          OBJECT_ID('[dbo].[FinancialObligation]') AS hasFinancialObligation,
          OBJECT_ID('[dbo].[FinancialMovement]') AS hasFinancialMovement,
          OBJECT_ID('[dbo].[ReminderRecurrence]') AS hasReminderRecurrence,
          OBJECT_ID('[dbo].[InventoryMovement]') AS hasInventoryMovement
      `);

      const row = Array.isArray(check) && check[0] ? check[0] : null;
      if (
        row &&
        row.hasTrackingMode != null &&
        row.hasRecurrenceId != null &&
        row.hasFinancialObligation != null &&
        row.hasFinancialMovement != null &&
        row.hasReminderRecurrence != null &&
        row.hasInventoryMovement != null
      ) {
        globalForBootstrap.dbSchemaEnsured = true;
        return;
      }

      const statements: string[] = [
        // 1. Attendance optional appointmentId
        `IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'Attendance_appointmentId_idx' AND object_id = OBJECT_ID(N'[dbo].[Attendance]')) DROP INDEX [Attendance_appointmentId_idx] ON [dbo].[Attendance];`,
        `ALTER TABLE [dbo].[Attendance] ALTER COLUMN [appointmentId] NVARCHAR(1000) NULL;`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Attendance_appointmentId_key' AND object_id = OBJECT_ID(N'[dbo].[Attendance]')) CREATE UNIQUE NONCLUSTERED INDEX [Attendance_appointmentId_key] ON [dbo].[Attendance]([appointmentId]) WHERE [appointmentId] IS NOT NULL;`,

        // 2. Product, ProductLot, StockUnit, ProductUsage, InventoryMovement
        `IF COL_LENGTH('[dbo].[Product]', 'trackingMode') IS NULL ALTER TABLE [dbo].[Product] ADD [trackingMode] NVARCHAR(1000) NOT NULL CONSTRAINT [Product_trackingMode_df] DEFAULT 'UNIT';`,
        `IF COL_LENGTH('[dbo].[Product]', 'estoqueMinimo') IS NULL ALTER TABLE [dbo].[Product] ADD [estoqueMinimo] DECIMAL(10,3) NOT NULL CONSTRAINT [Product_estoqueMinimo_df] DEFAULT 5.000;`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Product_trackingMode_idx' AND object_id = OBJECT_ID(N'[dbo].[Product]')) CREATE NONCLUSTERED INDEX [Product_trackingMode_idx] ON [dbo].[Product]([trackingMode]);`,
        `IF COL_LENGTH('[dbo].[ProductLot]', 'quantidadeInicial') IS NULL ALTER TABLE [dbo].[ProductLot] ADD [quantidadeInicial] DECIMAL(10,3) NULL;`,
        `IF COL_LENGTH('[dbo].[ProductLot]', 'quantidadeDisponivel') IS NULL ALTER TABLE [dbo].[ProductLot] ADD [quantidadeDisponivel] DECIMAL(10,3) NULL;`,
        `UPDATE [dbo].[ProductLot] SET [quantidadeInicial] = [quantidadeOriginal] WHERE [quantidadeInicial] IS NULL;`,
        `UPDATE [dbo].[ProductLot] SET [quantidadeDisponivel] = [quantidadeOriginal] WHERE [quantidadeDisponivel] IS NULL;`,
        `IF COL_LENGTH('[dbo].[StockUnit]', 'quantidadeInicial') IS NULL ALTER TABLE [dbo].[StockUnit] ADD [quantidadeInicial] DECIMAL(10,3) NULL;`,
        `IF COL_LENGTH('[dbo].[StockUnit]', 'quantidadeDisponivel') IS NULL ALTER TABLE [dbo].[StockUnit] ADD [quantidadeDisponivel] DECIMAL(10,3) NULL;`,
        `IF COL_LENGTH('[dbo].[StockUnit]', 'motivoStatus') IS NULL ALTER TABLE [dbo].[StockUnit] ADD [motivoStatus] NVARCHAR(1000) NULL;`,
        `IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_stockUnitId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]')) DROP INDEX [ProductUsage_stockUnitId_idx] ON [dbo].[ProductUsage];`,
        `ALTER TABLE [dbo].[ProductUsage] ALTER COLUMN [stockUnitId] NVARCHAR(1000) NULL;`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_stockUnitId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]')) CREATE NONCLUSTERED INDEX [ProductUsage_stockUnitId_idx] ON [dbo].[ProductUsage]([stockUnitId]);`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'productId') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [productId] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'lotId') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [lotId] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'quantidade') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [quantidade] DECIMAL(10,3) NOT NULL CONSTRAINT [ProductUsage_quantidade_df] DEFAULT 1.000;`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'unidade') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [unidade] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'status') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ProductUsage_status_df] DEFAULT 'Ativo';`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'reversedAt') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [reversedAt] DATETIME2 NULL;`,
        `IF COL_LENGTH('[dbo].[ProductUsage]', 'reversalReason') IS NULL ALTER TABLE [dbo].[ProductUsage] ADD [reversalReason] NVARCHAR(1000) NULL;`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_productId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]')) CREATE NONCLUSTERED INDEX [ProductUsage_productId_idx] ON [dbo].[ProductUsage]([productId]);`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_lotId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]')) CREATE NONCLUSTERED INDEX [ProductUsage_lotId_idx] ON [dbo].[ProductUsage]([lotId]);`,
        `IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[ProductUsage_productId_fkey]')) ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
        `IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[ProductUsage_lotId_fkey]')) ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,

        `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[InventoryMovement]') AND type in (N'U'))
         BEGIN
           CREATE TABLE [dbo].[InventoryMovement] (
             [id] NVARCHAR(1000) NOT NULL,
             [productId] NVARCHAR(1000) NOT NULL,
             [lotId] NVARCHAR(1000) NULL,
             [stockUnitId] NVARCHAR(1000) NULL,
             [attendanceId] NVARCHAR(1000) NULL,
             [attendanceProcedureId] NVARCHAR(1000) NULL,
             [productUsageId] NVARCHAR(1000) NULL,
             [reversedFromId] NVARCHAR(1000) NULL,
             [reversedAt] DATETIME2 NULL,
             [reversalReason] NVARCHAR(1000) NULL,
             [tipo] NVARCHAR(1000) NOT NULL,
             [quantidade] DECIMAL(10,3) NOT NULL,
             [unidade] NVARCHAR(1000) NOT NULL,
             [saldoAnterior] DECIMAL(10,3) NULL,
             [saldoPosterior] DECIMAL(10,3) NULL,
             [motivo] NVARCHAR(max) NULL,
             [observacoes] NVARCHAR(max) NULL,
             [status] NVARCHAR(1000) NOT NULL CONSTRAINT [InventoryMovement_status_df] DEFAULT 'Ativo',
             [origem] NVARCHAR(1000) NOT NULL CONSTRAINT [InventoryMovement_origem_df] DEFAULT 'SISTEMA',
             [dataHora] DATETIME2 NOT NULL CONSTRAINT [InventoryMovement_dataHora_df] DEFAULT CURRENT_TIMESTAMP,
             [createdAt] DATETIME2 NOT NULL CONSTRAINT [InventoryMovement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
             CONSTRAINT [InventoryMovement_pkey] PRIMARY KEY CLUSTERED ([id]),
             CONSTRAINT [InventoryMovement_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_stockUnitId_fkey] FOREIGN KEY ([stockUnitId]) REFERENCES [dbo].[StockUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_attendanceProcedureId_fkey] FOREIGN KEY ([attendanceProcedureId]) REFERENCES [dbo].[AttendanceProcedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_productUsageId_fkey] FOREIGN KEY ([productUsageId]) REFERENCES [dbo].[ProductUsage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [InventoryMovement_reversedFromId_fkey] FOREIGN KEY ([reversedFromId]) REFERENCES [dbo].[InventoryMovement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
           );
           CREATE NONCLUSTERED INDEX [InventoryMovement_productId_idx] ON [dbo].[InventoryMovement]([productId]);
           CREATE NONCLUSTERED INDEX [InventoryMovement_lotId_idx] ON [dbo].[InventoryMovement]([lotId]);
           CREATE NONCLUSTERED INDEX [InventoryMovement_stockUnitId_idx] ON [dbo].[InventoryMovement]([stockUnitId]);
           CREATE NONCLUSTERED INDEX [InventoryMovement_attendanceId_idx] ON [dbo].[InventoryMovement]([attendanceId]);
           CREATE NONCLUSTERED INDEX [InventoryMovement_tipo_idx] ON [dbo].[InventoryMovement]([tipo]);
           CREATE NONCLUSTERED INDEX [InventoryMovement_dataHora_idx] ON [dbo].[InventoryMovement]([dataHora]);
         END;`,

        // 3. FinancialObligation, FinancialSettlement, FinancialMovement
        `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialObligation]') AND type in (N'U'))
         BEGIN
           CREATE TABLE [dbo].[FinancialObligation] (
             [id] NVARCHAR(1000) NOT NULL,
             [tipo] NVARCHAR(1000) NOT NULL,
             [descricao] NVARCHAR(1000) NOT NULL,
             [valorOriginal] DECIMAL(10,2) NOT NULL,
             [dataVencimento] DATETIME2 NOT NULL,
             [categoria] NVARCHAR(1000) NULL CONSTRAINT [FinancialObligation_categoria_df] DEFAULT 'Geral',
             [fornecedor] NVARCHAR(1000) NULL,
             [metodo] NVARCHAR(1000) NULL,
             [status] NVARCHAR(1000) NOT NULL CONSTRAINT [FinancialObligation_status_df] DEFAULT 'Pendente',
             [counterpartyName] NVARCHAR(1000) NULL,
             [clientId] NVARCHAR(1000) NULL,
             [appointmentId] NVARCHAR(1000) NULL,
             [attendanceId] NVARCHAR(1000) NULL,
             [paymentId] NVARCHAR(1000) NULL,
             [pixInstallmentId] NVARCHAR(1000) NULL,
             [observacoes] NVARCHAR(max) NULL,
             [cancelledAt] DATETIME2 NULL,
             [cancellationReason] NVARCHAR(1000) NULL,
             [createdAt] DATETIME2 NOT NULL CONSTRAINT [FinancialObligation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
             [updatedAt] DATETIME2 NOT NULL CONSTRAINT [FinancialObligation_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
             CONSTRAINT [FinancialObligation_pkey] PRIMARY KEY CLUSTERED ([id]),
             CONSTRAINT [FinancialObligation_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialObligation_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialObligation_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialObligation_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialObligation_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
           );
           CREATE NONCLUSTERED INDEX [FinancialObligation_tipo_idx] ON [dbo].[FinancialObligation]([tipo]);
           CREATE NONCLUSTERED INDEX [FinancialObligation_status_idx] ON [dbo].[FinancialObligation]([status]);
           CREATE NONCLUSTERED INDEX [FinancialObligation_dataVencimento_idx] ON [dbo].[FinancialObligation]([dataVencimento]);
           CREATE NONCLUSTERED INDEX [FinancialObligation_clientId_idx] ON [dbo].[FinancialObligation]([clientId]);
           CREATE NONCLUSTERED INDEX [FinancialObligation_appointmentId_idx] ON [dbo].[FinancialObligation]([appointmentId]);
           CREATE NONCLUSTERED INDEX [FinancialObligation_attendanceId_idx] ON [dbo].[FinancialObligation]([attendanceId]);
         END;`,

        `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialSettlement]') AND type in (N'U'))
         BEGIN
           CREATE TABLE [dbo].[FinancialSettlement] (
             [id] NVARCHAR(1000) NOT NULL,
             [obligationId] NVARCHAR(1000) NOT NULL,
             [valor] DECIMAL(10,2) NOT NULL,
             [dataLiquidacao] DATETIME2 NOT NULL CONSTRAINT [FinancialSettlement_dataLiquidacao_df] DEFAULT CURRENT_TIMESTAMP,
             [metodo] NVARCHAR(1000) NOT NULL,
             [status] NVARCHAR(1000) NOT NULL CONSTRAINT [FinancialSettlement_status_df] DEFAULT 'Ativo',
             [observacoes] NVARCHAR(1000) NULL,
             [reversedAt] DATETIME2 NULL,
             [reversalReason] NVARCHAR(1000) NULL,
             [createdAt] DATETIME2 NOT NULL CONSTRAINT [FinancialSettlement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
             [updatedAt] DATETIME2 NOT NULL CONSTRAINT [FinancialSettlement_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
             CONSTRAINT [FinancialSettlement_pkey] PRIMARY KEY CLUSTERED ([id]),
             CONSTRAINT [FinancialSettlement_obligationId_fkey] FOREIGN KEY ([obligationId]) REFERENCES [dbo].[FinancialObligation]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
           );
           CREATE NONCLUSTERED INDEX [FinancialSettlement_obligationId_idx] ON [dbo].[FinancialSettlement]([obligationId]);
           CREATE NONCLUSTERED INDEX [FinancialSettlement_dataLiquidacao_idx] ON [dbo].[FinancialSettlement]([dataLiquidacao]);
           CREATE NONCLUSTERED INDEX [FinancialSettlement_status_idx] ON [dbo].[FinancialSettlement]([status]);
         END;`,

        `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialMovement]') AND type in (N'U'))
         BEGIN
           CREATE TABLE [dbo].[FinancialMovement] (
             [id] NVARCHAR(1000) NOT NULL,
             [tipo] NVARCHAR(1000) NOT NULL,
             [origem] NVARCHAR(1000) NOT NULL CONSTRAINT [FinancialMovement_origem_df] DEFAULT 'LANCAMENTO_MANUAL',
             [valor] DECIMAL(10,2) NOT NULL,
             [dataMovimentacao] DATETIME2 NOT NULL CONSTRAINT [FinancialMovement_dataMovimentacao_df] DEFAULT CURRENT_TIMESTAMP,
             [metodo] NVARCHAR(1000) NOT NULL,
             [descricao] NVARCHAR(1000) NOT NULL,
             [categoria] NVARCHAR(1000) NULL CONSTRAINT [FinancialMovement_categoria_df] DEFAULT 'Geral',
             [status] NVARCHAR(1000) NOT NULL CONSTRAINT [FinancialMovement_status_df] DEFAULT 'Ativo',
             [counterpartyName] NVARCHAR(1000) NULL,
             [clientId] NVARCHAR(1000) NULL,
             [appointmentId] NVARCHAR(1000) NULL,
             [attendanceId] NVARCHAR(1000) NULL,
             [obligationId] NVARCHAR(1000) NULL,
             [settlementId] NVARCHAR(1000) NULL,
             [paymentId] NVARCHAR(1000) NULL,
             [pixInstallmentId] NVARCHAR(1000) NULL,
             [reversedFromId] NVARCHAR(1000) NULL,
             [reversedAt] DATETIME2 NULL,
             [reversalReason] NVARCHAR(1000) NULL,
             [observacoes] NVARCHAR(max) NULL,
             [createdAt] DATETIME2 NOT NULL CONSTRAINT [FinancialMovement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
             [updatedAt] DATETIME2 NOT NULL CONSTRAINT [FinancialMovement_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
             CONSTRAINT [FinancialMovement_pkey] PRIMARY KEY CLUSTERED ([id]),
             CONSTRAINT [FinancialMovement_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_obligationId_fkey] FOREIGN KEY ([obligationId]) REFERENCES [dbo].[FinancialObligation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_settlementId_fkey] FOREIGN KEY ([settlementId]) REFERENCES [dbo].[FinancialSettlement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [FinancialMovement_reversedFromId_fkey] FOREIGN KEY ([reversedFromId]) REFERENCES [dbo].[FinancialMovement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
           );
           CREATE UNIQUE NONCLUSTERED INDEX [FinancialMovement_settlementId_key] ON [dbo].[FinancialMovement]([settlementId]) WHERE [settlementId] IS NOT NULL;
           CREATE NONCLUSTERED INDEX [FinancialMovement_tipo_idx] ON [dbo].[FinancialMovement]([tipo]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_origem_idx] ON [dbo].[FinancialMovement]([origem]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_status_idx] ON [dbo].[FinancialMovement]([status]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_dataMovimentacao_idx] ON [dbo].[FinancialMovement]([dataMovimentacao]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_clientId_idx] ON [dbo].[FinancialMovement]([clientId]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_attendanceId_idx] ON [dbo].[FinancialMovement]([attendanceId]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_obligationId_idx] ON [dbo].[FinancialMovement]([obligationId]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_paymentId_idx] ON [dbo].[FinancialMovement]([paymentId]);
           CREATE NONCLUSTERED INDEX [FinancialMovement_pixInstallmentId_idx] ON [dbo].[FinancialMovement]([pixInstallmentId]);
         END;`,

        // 4. ReminderRecurrence & Reminder columns
        `IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReminderRecurrence]') AND type in (N'U'))
         BEGIN
           CREATE TABLE [dbo].[ReminderRecurrence] (
             [id] NVARCHAR(1000) NOT NULL,
             [clientId] NVARCHAR(1000) NULL,
             [appointmentId] NVARCHAR(1000) NULL,
             [attendanceId] NVARCHAR(1000) NULL,
             [titulo] NVARCHAR(1000) NOT NULL,
             [descricao] NVARCHAR(max) NULL,
             [tipo] NVARCHAR(1000) NOT NULL CONSTRAINT [ReminderRecurrence_tipo_df] DEFAULT 'geral',
             [prioridade] NVARCHAR(1000) NOT NULL CONSTRAINT [ReminderRecurrence_prioridade_df] DEFAULT 'media',
             [frequencia] NVARCHAR(1000) NOT NULL,
             [intervalo] INT NOT NULL CONSTRAINT [ReminderRecurrence_intervalo_df] DEFAULT 1,
             [dataInicio] DATETIME2 NOT NULL,
             [dataFim] DATETIME2 NULL,
             [maxOcorrencias] INT NULL,
             [ocorrenciasGeradas] INT NOT NULL CONSTRAINT [ReminderRecurrence_ocorrenciasGeradas_df] DEFAULT 0,
             [proximaOcorrenciaEm] DATETIME2 NULL,
             [ultimaGeracaoEm] DATETIME2 NULL,
             [proximaExecucao] DATETIME2 NULL,
             [isActive] BIT NOT NULL CONSTRAINT [ReminderRecurrence_isActive_df] DEFAULT 1,
             [timezone] NVARCHAR(1000) NOT NULL CONSTRAINT [ReminderRecurrence_timezone_df] DEFAULT 'America/Sao_Paulo',
             [createdAt] DATETIME2 NOT NULL CONSTRAINT [ReminderRecurrence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
             [updatedAt] DATETIME2 NOT NULL CONSTRAINT [ReminderRecurrence_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
             CONSTRAINT [ReminderRecurrence_pkey] PRIMARY KEY CLUSTERED ([id]),
             CONSTRAINT [ReminderRecurrence_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [ReminderRecurrence_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
             CONSTRAINT [ReminderRecurrence_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
           );
           CREATE NONCLUSTERED INDEX [ReminderRecurrence_isActive_proximaOcorrenciaEm_idx] ON [dbo].[ReminderRecurrence]([isActive], [proximaOcorrenciaEm]);
           CREATE NONCLUSTERED INDEX [ReminderRecurrence_clientId_idx] ON [dbo].[ReminderRecurrence]([clientId]);
           CREATE NONCLUSTERED INDEX [ReminderRecurrence_appointmentId_idx] ON [dbo].[ReminderRecurrence]([appointmentId]);
           CREATE NONCLUSTERED INDEX [ReminderRecurrence_attendanceId_idx] ON [dbo].[ReminderRecurrence]([attendanceId]);
         END;`,

        `IF COL_LENGTH('[dbo].[Reminder]', 'appointmentId') IS NULL ALTER TABLE [dbo].[Reminder] ADD [appointmentId] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[Reminder]', 'attendanceId') IS NULL ALTER TABLE [dbo].[Reminder] ADD [attendanceId] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[Reminder]', 'recurrenceId') IS NULL ALTER TABLE [dbo].[Reminder] ADD [recurrenceId] NVARCHAR(1000) NULL;`,
        `IF COL_LENGTH('[dbo].[Reminder]', 'occurrenceIndex') IS NULL ALTER TABLE [dbo].[Reminder] ADD [occurrenceIndex] INT NULL;`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_appointmentId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]')) CREATE NONCLUSTERED INDEX [Reminder_appointmentId_idx] ON [dbo].[Reminder]([appointmentId]);`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_attendanceId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]')) CREATE NONCLUSTERED INDEX [Reminder_attendanceId_idx] ON [dbo].[Reminder]([attendanceId]);`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_recurrenceId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]')) CREATE NONCLUSTERED INDEX [Reminder_recurrenceId_idx] ON [dbo].[Reminder]([recurrenceId]);`,
        `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_recurrenceId_occurrenceIndex_key' AND object_id = OBJECT_ID(N'[dbo].[Reminder]')) CREATE UNIQUE NONCLUSTERED INDEX [Reminder_recurrenceId_occurrenceIndex_key] ON [dbo].[Reminder]([recurrenceId], [occurrenceIndex]) WHERE [recurrenceId] IS NOT NULL AND [occurrenceIndex] IS NOT NULL;`,
        `IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_appointmentId_fkey]')) ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
        `IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_attendanceId_fkey]')) ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
        `IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_recurrenceId_fkey]')) ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_recurrenceId_fkey] FOREIGN KEY ([recurrenceId]) REFERENCES [dbo].[ReminderRecurrence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
      ];

      for (const sql of statements) {
        try {
          await anyPrisma.$executeRawUnsafe(sql);
        } catch (stmtErr) {
          console.warn('[db-bootstrap] Non-fatal DDL warning:', stmtErr);
        }
      }

      globalForBootstrap.dbSchemaEnsured = true;
    } catch {
      globalForBootstrap.dbSchemaEnsured = true;
    } finally {
      globalForBootstrap.dbSchemaPromise = null;
    }
  })();

  return globalForBootstrap.dbSchemaPromise;
}
