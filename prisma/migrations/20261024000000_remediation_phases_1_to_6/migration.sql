BEGIN TRY

BEGIN TRAN;

-- =========================================================================
-- PHASE 1: 1:1 APPOINTMENT <-> ATTENDANCE RECONCILIATION & UNIQUE CONSTRAINT
-- =========================================================================

-- 1. Allow NULL on Attendance.appointmentId so independent attendances remain supported
IF EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'Attendance' AND c.name = 'appointmentId' AND c.is_nullable = 0
)
BEGIN
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'Attendance_appointmentId_key' AND object_id = OBJECT_ID(N'[dbo].[Attendance]'))
    BEGIN
        DROP INDEX [Attendance_appointmentId_key] ON [dbo].[Attendance];
    END;
    ALTER TABLE [dbo].[Attendance] ALTER COLUMN [appointmentId] NVARCHAR(1000) NULL;
END;

-- 2. Deterministic reconciliation of any duplicate Attendance rows per Appointment:
--    If an appointment has multiple attendances, detach redundant empty Pendente/Cancelado
--    attendances (that have zero procedures, payments, usages, attachments, or medical records)
--    by setting appointmentId = NULL so zero historical rows are deleted.
WITH RankedAttendances AS (
    SELECT
        a.[id],
        a.[appointmentId],
        a.[status],
        (SELECT COUNT(*) FROM [dbo].[AttendanceProcedure] ap WHERE ap.[attendanceId] = a.[id]) +
        (SELECT COUNT(*) FROM [dbo].[Payment] p WHERE p.[attendanceId] = a.[id]) +
        (SELECT COUNT(*) FROM [dbo].[ProductUsage] pu WHERE pu.[attendanceId] = a.[id]) +
        (SELECT COUNT(*) FROM [dbo].[Attachment] att WHERE att.[attendanceId] = a.[id]) +
        (SELECT COUNT(*) FROM [dbo].[MedicalRecord] mr WHERE mr.[attendanceId] = a.[id]) AS [childCount],
        ROW_NUMBER() OVER (
            PARTITION BY a.[appointmentId]
            ORDER BY
                CASE WHEN a.[status] = 'Realizado' THEN 1
                     WHEN a.[status] = 'Pendente' THEN 2
                     ELSE 3 END ASC,
                a.[createdAt] ASC
        ) AS [rn]
    FROM [dbo].[Attendance] a
    WHERE a.[appointmentId] IS NOT NULL
)
UPDATE a
SET a.[appointmentId] = NULL
FROM [dbo].[Attendance] a
INNER JOIN RankedAttendances r ON a.[id] = r.[id]
WHERE r.[rn] > 1 AND r.[childCount] = 0 AND r.[status] <> 'Realizado';

-- 3. Diagnostic guard: Stop migration if conflicting substantive duplicate attendances remain
IF EXISTS (
    SELECT [appointmentId]
    FROM [dbo].[Attendance]
    WHERE [appointmentId] IS NOT NULL
    GROUP BY [appointmentId]
    HAVING COUNT(*) > 1
)
BEGIN
    THROW 50001, 'Migration halted: Conflicting duplicate Attendance records found for the same Appointment. Manual reconciliation required.', 1;
END;

-- 4. Replace non-unique index with filtered UNIQUE index on Attendance(appointmentId)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'Attendance_appointmentId_idx' AND object_id = OBJECT_ID(N'[dbo].[Attendance]'))
BEGIN
    DROP INDEX [Attendance_appointmentId_idx] ON [dbo].[Attendance];
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Attendance_appointmentId_key' AND object_id = OBJECT_ID(N'[dbo].[Attendance]'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [Attendance_appointmentId_key]
    ON [dbo].[Attendance]([appointmentId])
    WHERE [appointmentId] IS NOT NULL;
END;

-- =========================================================================
-- PHASE 4 & 5: INVENTORY TRACKING MODE, PARTIAL CONSUMPTION & LEDGER
-- =========================================================================

IF COL_LENGTH('[dbo].[Product]', 'trackingMode') IS NULL
BEGIN
    ALTER TABLE [dbo].[Product] ADD [trackingMode] NVARCHAR(1000) NOT NULL CONSTRAINT [Product_trackingMode_df] DEFAULT 'UNIT';
END;

IF COL_LENGTH('[dbo].[Product]', 'estoqueMinimo') IS NULL
BEGIN
    ALTER TABLE [dbo].[Product] ADD [estoqueMinimo] DECIMAL(10,3) NOT NULL CONSTRAINT [Product_estoqueMinimo_df] DEFAULT 5.000;
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Product_trackingMode_idx' AND object_id = OBJECT_ID(N'[dbo].[Product]'))
BEGIN
    CREATE NONCLUSTERED INDEX [Product_trackingMode_idx] ON [dbo].[Product]([trackingMode]);
END;

IF COL_LENGTH('[dbo].[ProductLot]', 'quantidadeInicial') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductLot] ADD [quantidadeInicial] DECIMAL(10,3) NULL;
END;

IF COL_LENGTH('[dbo].[ProductLot]', 'quantidadeDisponivel') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductLot] ADD [quantidadeDisponivel] DECIMAL(10,3) NULL;
END;

IF COL_LENGTH('[dbo].[StockUnit]', 'quantidadeInicial') IS NULL
BEGIN
    ALTER TABLE [dbo].[StockUnit] ADD [quantidadeInicial] DECIMAL(10,3) NULL;
END;

IF COL_LENGTH('[dbo].[StockUnit]', 'quantidadeDisponivel') IS NULL
BEGIN
    ALTER TABLE [dbo].[StockUnit] ADD [quantidadeDisponivel] DECIMAL(10,3) NULL;
END;

IF COL_LENGTH('[dbo].[StockUnit]', 'motivoStatus') IS NULL
BEGIN
    ALTER TABLE [dbo].[StockUnit] ADD [motivoStatus] NVARCHAR(1000) NULL;
END;

-- Alter ProductUsage to support both unit-tracked and quantity-based consumables
ALTER TABLE [dbo].[ProductUsage] ALTER COLUMN [stockUnitId] NVARCHAR(1000) NULL;

IF COL_LENGTH('[dbo].[ProductUsage]', 'productId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [productId] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'lotId') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [lotId] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'quantidade') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [quantidade] DECIMAL(10,3) NOT NULL CONSTRAINT [ProductUsage_quantidade_df] DEFAULT 1.000;
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'unidade') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [unidade] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'status') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ProductUsage_status_df] DEFAULT 'Ativo';
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'reversedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [reversedAt] DATETIME2 NULL;
END;

IF COL_LENGTH('[dbo].[ProductUsage]', 'reversalReason') IS NULL
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD [reversalReason] NVARCHAR(1000) NULL;
END;

-- Backfill ProductUsage productId, lotId, unidade from existing StockUnit links
EXEC('
UPDATE pu
SET
    pu.[lotId] = su.[lotId],
    pu.[productId] = l.[productId],
    pu.[unidade] = p.[unidade]
FROM [dbo].[ProductUsage] pu
INNER JOIN [dbo].[StockUnit] su ON pu.[stockUnitId] = su.[id]
INNER JOIN [dbo].[ProductLot] l ON su.[lotId] = l.[id]
INNER JOIN [dbo].[Product] p ON l.[productId] = p.[id]
WHERE pu.[productId] IS NULL;
');

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_productId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]'))
BEGIN
    CREATE NONCLUSTERED INDEX [ProductUsage_productId_idx] ON [dbo].[ProductUsage]([productId]);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'ProductUsage_lotId_idx' AND object_id = OBJECT_ID(N'[dbo].[ProductUsage]'))
BEGIN
    CREATE NONCLUSTERED INDEX [ProductUsage_lotId_idx] ON [dbo].[ProductUsage]([lotId]);
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[ProductUsage_productId_fkey]'))
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[ProductUsage_lotId_fkey]'))
BEGIN
    ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- CreateTable InventoryMovement
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[InventoryMovement]') AND type in (N'U'))
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
        CONSTRAINT [InventoryMovement_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [InventoryMovement_productId_idx] ON [dbo].[InventoryMovement]([productId]);
    CREATE NONCLUSTERED INDEX [InventoryMovement_lotId_idx] ON [dbo].[InventoryMovement]([lotId]);
    CREATE NONCLUSTERED INDEX [InventoryMovement_stockUnitId_idx] ON [dbo].[InventoryMovement]([stockUnitId]);
    CREATE NONCLUSTERED INDEX [InventoryMovement_attendanceId_idx] ON [dbo].[InventoryMovement]([attendanceId]);
    CREATE NONCLUSTERED INDEX [InventoryMovement_tipo_idx] ON [dbo].[InventoryMovement]([tipo]);
    CREATE NONCLUSTERED INDEX [InventoryMovement_dataHora_idx] ON [dbo].[InventoryMovement]([dataHora]);

    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_stockUnitId_fkey] FOREIGN KEY ([stockUnitId]) REFERENCES [dbo].[StockUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_attendanceProcedureId_fkey] FOREIGN KEY ([attendanceProcedureId]) REFERENCES [dbo].[AttendanceProcedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_productUsageId_fkey] FOREIGN KEY ([productUsageId]) REFERENCES [dbo].[ProductUsage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[InventoryMovement] ADD CONSTRAINT [InventoryMovement_reversedFromId_fkey] FOREIGN KEY ([reversedFromId]) REFERENCES [dbo].[InventoryMovement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- Backfill baseline InventoryMovement records from existing StockUnit and ProductUsage rows
INSERT INTO [dbo].[InventoryMovement] (
    [id], [productId], [lotId], [stockUnitId], [tipo], [quantidade], [unidade], [motivo], [origem], [dataHora], [createdAt]
)
SELECT
    LOWER(CONVERT(NVARCHAR(36), NEWID())),
    l.[productId],
    su.[lotId],
    su.[id],
    'ENTRADA',
    1.000,
    p.[unidade],
    'Saldo inicial de migração da unidade física ' + su.[codigoSerial],
    'MIGRACAO_INICIAL',
    su.[createdAt],
    su.[createdAt]
FROM [dbo].[StockUnit] su
INNER JOIN [dbo].[ProductLot] l ON su.[lotId] = l.[id]
INNER JOIN [dbo].[Product] p ON l.[productId] = p.[id]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[InventoryMovement] im WHERE im.[stockUnitId] = su.[id] AND im.[tipo] = 'ENTRADA'
);

INSERT INTO [dbo].[InventoryMovement] (
    [id], [productId], [lotId], [stockUnitId], [attendanceId], [attendanceProcedureId], [productUsageId],
    [tipo], [quantidade], [unidade], [motivo], [origem], [dataHora], [createdAt]
)
SELECT
    LOWER(CONVERT(NVARCHAR(36), NEWID())),
    l.[productId],
    su.[lotId],
    pu.[stockUnitId],
    pu.[attendanceId],
    pu.[attendanceProcedureId],
    pu.[id],
    'CONSUMO',
    1.000,
    p.[unidade],
    COALESCE(pu.[observacoes], 'Consumo registrado em atendimento'),
    'ATENDIMENTO',
    pu.[dataHora],
    pu.[createdAt]
FROM [dbo].[ProductUsage] pu
INNER JOIN [dbo].[StockUnit] su ON pu.[stockUnitId] = su.[id]
INNER JOIN [dbo].[ProductLot] l ON su.[lotId] = l.[id]
INNER JOIN [dbo].[Product] p ON l.[productId] = p.[id]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[InventoryMovement] im WHERE im.[productUsageId] = pu.[id]
);

-- =========================================================================
-- PHASE 2: FINANCIAL DOMAIN (OBLIGATIONS, SETTLEMENTS, MOVEMENTS)
-- =========================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialObligation]') AND type in (N'U'))
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
        CONSTRAINT [FinancialObligation_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [FinancialObligation_tipo_idx] ON [dbo].[FinancialObligation]([tipo]);
    CREATE NONCLUSTERED INDEX [FinancialObligation_status_idx] ON [dbo].[FinancialObligation]([status]);
    CREATE NONCLUSTERED INDEX [FinancialObligation_dataVencimento_idx] ON [dbo].[FinancialObligation]([dataVencimento]);
    CREATE NONCLUSTERED INDEX [FinancialObligation_clientId_idx] ON [dbo].[FinancialObligation]([clientId]);
    CREATE NONCLUSTERED INDEX [FinancialObligation_appointmentId_idx] ON [dbo].[FinancialObligation]([appointmentId]);
    CREATE NONCLUSTERED INDEX [FinancialObligation_attendanceId_idx] ON [dbo].[FinancialObligation]([attendanceId]);

    ALTER TABLE [dbo].[FinancialObligation] ADD CONSTRAINT [FinancialObligation_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialObligation] ADD CONSTRAINT [FinancialObligation_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialObligation] ADD CONSTRAINT [FinancialObligation_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialObligation] ADD CONSTRAINT [FinancialObligation_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialObligation] ADD CONSTRAINT [FinancialObligation_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialSettlement]') AND type in (N'U'))
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
        CONSTRAINT [FinancialSettlement_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [FinancialSettlement_obligationId_idx] ON [dbo].[FinancialSettlement]([obligationId]);
    CREATE NONCLUSTERED INDEX [FinancialSettlement_dataLiquidacao_idx] ON [dbo].[FinancialSettlement]([dataLiquidacao]);
    CREATE NONCLUSTERED INDEX [FinancialSettlement_status_idx] ON [dbo].[FinancialSettlement]([status]);

    ALTER TABLE [dbo].[FinancialSettlement] ADD CONSTRAINT [FinancialSettlement_obligationId_fkey] FOREIGN KEY ([obligationId]) REFERENCES [dbo].[FinancialObligation]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FinancialMovement]') AND type in (N'U'))
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
        CONSTRAINT [FinancialMovement_pkey] PRIMARY KEY CLUSTERED ([id])
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

    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_obligationId_fkey] FOREIGN KEY ([obligationId]) REFERENCES [dbo].[FinancialObligation]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_settlementId_fkey] FOREIGN KEY ([settlementId]) REFERENCES [dbo].[FinancialSettlement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[FinancialMovement] ADD CONSTRAINT [FinancialMovement_reversedFromId_fkey] FOREIGN KEY ([reversedFromId]) REFERENCES [dbo].[FinancialMovement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- Backfill FinancialMovement for historical direct Payments (status = 'Pago' without PixInstallments)
INSERT INTO [dbo].[FinancialMovement] (
    [id], [tipo], [origem], [valor], [dataMovimentacao], [metodo], [descricao], [categoria],
    [status], [clientId], [appointmentId], [attendanceId], [paymentId], [observacoes], [createdAt], [updatedAt]
)
SELECT
    LOWER(CONVERT(NVARCHAR(36), NEWID())),
    'ENTRADA',
    'PAGAMENTO_ATENDIMENTO',
    p.[valor],
    COALESCE(p.[dataPagamento], p.[createdAt]),
    p.[metodo],
    'Pagamento de atendimento (' + p.[metodo] + ')',
    'Atendimento Clínico',
    'Ativo',
    att.[clientId],
    att.[appointmentId],
    p.[attendanceId],
    p.[id],
    p.[observacoes],
    p.[createdAt],
    p.[updatedAt]
FROM [dbo].[Payment] p
INNER JOIN [dbo].[Attendance] att ON p.[attendanceId] = att.[id]
WHERE p.[status] = 'Pago'
  AND NOT EXISTS (SELECT 1 FROM [dbo].[PixInstallment] pi WHERE pi.[paymentId] = p.[id])
  AND NOT EXISTS (SELECT 1 FROM [dbo].[FinancialMovement] fm WHERE fm.[paymentId] = p.[id]);

-- Backfill FinancialMovement for historical paid PixInstallments (status = 'Pago')
INSERT INTO [dbo].[FinancialMovement] (
    [id], [tipo], [origem], [valor], [dataMovimentacao], [metodo], [descricao], [categoria],
    [status], [clientId], [appointmentId], [attendanceId], [paymentId], [pixInstallmentId], [createdAt], [updatedAt]
)
SELECT
    LOWER(CONVERT(NVARCHAR(36), NEWID())),
    'ENTRADA',
    'PARCELA_PIX',
    pi.[valor],
    COALESCE(pi.[dataPagamento], pi.[updatedAt], pi.[createdAt]),
    'Pix',
    'Parcela PIX ' + CAST(pi.[numeroParcela] AS NVARCHAR(10)) + '/' + CAST(pi.[totalParcelas] AS NVARCHAR(10)),
    'Atendimento Clínico',
    'Ativo',
    att.[clientId],
    att.[appointmentId],
    p.[attendanceId],
    p.[id],
    pi.[id],
    pi.[createdAt],
    pi.[updatedAt]
FROM [dbo].[PixInstallment] pi
INNER JOIN [dbo].[Payment] p ON pi.[paymentId] = p.[id]
INNER JOIN [dbo].[Attendance] att ON p.[attendanceId] = att.[id]
WHERE pi.[status] = 'Pago'
  AND NOT EXISTS (SELECT 1 FROM [dbo].[FinancialMovement] fm WHERE fm.[pixInstallmentId] = pi.[id]);


-- =========================================================================
-- PHASE 3: REMINDER RECURRENCE & EXTENDED ASSOCIATIONS
-- =========================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReminderRecurrence]') AND type in (N'U'))
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
        CONSTRAINT [ReminderRecurrence_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE NONCLUSTERED INDEX [ReminderRecurrence_isActive_proximaOcorrenciaEm_idx] ON [dbo].[ReminderRecurrence]([isActive], [proximaOcorrenciaEm]);
    CREATE NONCLUSTERED INDEX [ReminderRecurrence_clientId_idx] ON [dbo].[ReminderRecurrence]([clientId]);
    CREATE NONCLUSTERED INDEX [ReminderRecurrence_appointmentId_idx] ON [dbo].[ReminderRecurrence]([appointmentId]);
    CREATE NONCLUSTERED INDEX [ReminderRecurrence_attendanceId_idx] ON [dbo].[ReminderRecurrence]([attendanceId]);

    ALTER TABLE [dbo].[ReminderRecurrence] ADD CONSTRAINT [ReminderRecurrence_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[ReminderRecurrence] ADD CONSTRAINT [ReminderRecurrence_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE [dbo].[ReminderRecurrence] ADD CONSTRAINT [ReminderRecurrence_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF COL_LENGTH('[dbo].[Reminder]', 'appointmentId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Reminder] ADD [appointmentId] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[Reminder]', 'attendanceId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Reminder] ADD [attendanceId] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[Reminder]', 'recurrenceId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Reminder] ADD [recurrenceId] NVARCHAR(1000) NULL;
END;

IF COL_LENGTH('[dbo].[Reminder]', 'occurrenceIndex') IS NULL
BEGIN
    ALTER TABLE [dbo].[Reminder] ADD [occurrenceIndex] INT NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_appointmentId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]'))
BEGIN
    EXEC('CREATE NONCLUSTERED INDEX [Reminder_appointmentId_idx] ON [dbo].[Reminder]([appointmentId]);');
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_attendanceId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]'))
BEGIN
    EXEC('CREATE NONCLUSTERED INDEX [Reminder_attendanceId_idx] ON [dbo].[Reminder]([attendanceId]);');
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_recurrenceId_idx' AND object_id = OBJECT_ID(N'[dbo].[Reminder]'))
BEGIN
    EXEC('CREATE NONCLUSTERED INDEX [Reminder_recurrenceId_idx] ON [dbo].[Reminder]([recurrenceId]);');
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'Reminder_recurrenceId_occurrenceIndex_key' AND object_id = OBJECT_ID(N'[dbo].[Reminder]'))
BEGIN
    EXEC('CREATE UNIQUE NONCLUSTERED INDEX [Reminder_recurrenceId_occurrenceIndex_key] ON [dbo].[Reminder]([recurrenceId], [occurrenceIndex]) WHERE [recurrenceId] IS NOT NULL AND [occurrenceIndex] IS NOT NULL;');
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_appointmentId_fkey]'))
BEGIN
    EXEC('ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_attendanceId_fkey]'))
BEGIN
    EXEC('ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');
END;

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[Reminder_recurrenceId_fkey]'))
BEGIN
    EXEC('ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_recurrenceId_fkey] FOREIGN KEY ([recurrenceId]) REFERENCES [dbo].[ReminderRecurrence]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;');
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
