BEGIN TRY

BEGIN TRAN;

-- CreateTable User
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[User]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[User] (
        [id] NVARCHAR(1000) NOT NULL,
        [nickname] NVARCHAR(1000) NOT NULL,
        [displayName] NVARCHAR(1000) NOT NULL,
        [passwordHash] NVARCHAR(1000) NOT NULL,
        [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [User_nickname_key] UNIQUE NONCLUSTERED ([nickname])
    );
END;

-- CreateTable Client
CREATE TABLE [dbo].[Client] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [cpf] NVARCHAR(1000) NOT NULL,
    [telefone] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NULL,
    [dataNascimento] DATETIME2 NULL,
    [endereco] NVARCHAR(1000) NULL,
    [observacoes] NVARCHAR(max) NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Client_status_df] DEFAULT 'ativo',
    [profilePhotoId] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Client_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Client_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Client_cpf_key] UNIQUE NONCLUSTERED ([cpf])
);

-- CreateTable EmergencyContact
CREATE TABLE [dbo].[EmergencyContact] (
    [id] NVARCHAR(1000) NOT NULL,
    [clientId] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [telefone] NVARCHAR(1000) NOT NULL,
    [parentesco] NVARCHAR(1000) NOT NULL,
    [observacoes] NVARCHAR(1000) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [EmergencyContact_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EmergencyContact_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [EmergencyContact_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Appointment
CREATE TABLE [dbo].[Appointment] (
    [id] NVARCHAR(1000) NOT NULL,
    [clientId] NVARCHAR(1000) NOT NULL,
    [dataHora] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Appointment_status_df] DEFAULT 'Agendado',
    [valorEstimado] DECIMAL(10,2) NULL,
    [observacoes] NVARCHAR(max) NULL,
    [motivoCancelamento] NVARCHAR(1000) NULL,
    [rescheduledFromId] NVARCHAR(1000) NULL,
    [rescheduledToId] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Appointment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Appointment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable PlannedProcedure
CREATE TABLE [dbo].[PlannedProcedure] (
    [id] NVARCHAR(1000) NOT NULL,
    [appointmentId] NVARCHAR(1000) NOT NULL,
    [procedureId] NVARCHAR(1000) NOT NULL,
    [ordem] INT NOT NULL CONSTRAINT [PlannedProcedure_ordem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PlannedProcedure_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PlannedProcedure_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Attendance
CREATE TABLE [dbo].[Attendance] (
    [id] NVARCHAR(1000) NOT NULL,
    [appointmentId] NVARCHAR(1000) NOT NULL,
    [clientId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Attendance_status_df] DEFAULT 'Pendente',
    [dataHora] DATETIME2 NOT NULL CONSTRAINT [Attendance_dataHora_df] DEFAULT CURRENT_TIMESTAMP,
    [completedAt] DATETIME2 NULL,
    [desconto] DECIMAL(10,2) NOT NULL CONSTRAINT [Attendance_desconto_df] DEFAULT 0.00,
    [observacoes] NVARCHAR(max) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Attendance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Attendance_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable MedicalRecord
CREATE TABLE [dbo].[MedicalRecord] (
    [id] NVARCHAR(1000) NOT NULL,
    [attendanceId] NVARCHAR(1000) NOT NULL,
    [queixaPrincipal] NVARCHAR(max) NULL,
    [avaliacaoClinica] NVARCHAR(max) NULL,
    [condutaProcedimento] NVARCHAR(max) NULL,
    [orientacoes] NVARCHAR(max) NULL,
    [observacoes] NVARCHAR(max) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MedicalRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MedicalRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MedicalRecord_attendanceId_key] UNIQUE NONCLUSTERED ([attendanceId])
);

-- CreateTable Procedure
CREATE TABLE [dbo].[Procedure] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [descricao] NVARCHAR(max) NULL,
    [valorPadrao] DECIMAL(10,2) NOT NULL,
    [duracaoMinutos] INT NOT NULL,
    [categoria] NVARCHAR(1000) NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Procedure_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Procedure_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Procedure_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable AttendanceProcedure
CREATE TABLE [dbo].[AttendanceProcedure] (
    [id] NVARCHAR(1000) NOT NULL,
    [attendanceId] NVARCHAR(1000) NOT NULL,
    [procedureId] NVARCHAR(1000) NOT NULL,
    [standardValueSnapshot] DECIMAL(10,2) NOT NULL,
    [practicedValue] DECIMAL(10,2) NOT NULL,
    [observacoes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AttendanceProcedure_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AttendanceProcedure_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Product
CREATE TABLE [dbo].[Product] (
    [id] NVARCHAR(1000) NOT NULL,
    [nome] NVARCHAR(1000) NOT NULL,
    [categoria] NVARCHAR(1000) NULL,
    [marca] NVARCHAR(1000) NULL,
    [descricao] NVARCHAR(max) NULL,
    [unidade] NVARCHAR(1000) NOT NULL,
    [isReusable] BIT NOT NULL CONSTRAINT [Product_isReusable_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Product_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable ProcedureProduct
CREATE TABLE [dbo].[ProcedureProduct] (
    [procedureId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProcedureProduct_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ProcedureProduct_pkey] PRIMARY KEY CLUSTERED ([procedureId], [productId])
);

-- CreateTable ProductLot
CREATE TABLE [dbo].[ProductLot] (
    [id] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [numeroLote] NVARCHAR(1000) NOT NULL,
    [dataValidade] DATETIME2 NULL,
    [dataAquisicao] DATETIME2 NULL,
    [precoCusto] DECIMAL(10,2) NULL,
    [observacoes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductLot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProductLot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable StockUnit
CREATE TABLE [dbo].[StockUnit] (
    [id] NVARCHAR(1000) NOT NULL,
    [lotId] NVARCHAR(1000) NOT NULL,
    [codigoSerial] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [StockUnit_status_df] DEFAULT 'Disponivel',
    [currentClientId] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [StockUnit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [StockUnit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StockUnit_codigoSerial_key] UNIQUE NONCLUSTERED ([codigoSerial])
);

-- CreateTable ProductUsage
CREATE TABLE [dbo].[ProductUsage] (
    [id] NVARCHAR(1000) NOT NULL,
    [attendanceId] NVARCHAR(1000) NOT NULL,
    [stockUnitId] NVARCHAR(1000) NOT NULL,
    [attendanceProcedureId] NVARCHAR(1000) NULL,
    [dataHora] DATETIME2 NOT NULL CONSTRAINT [ProductUsage_dataHora_df] DEFAULT CURRENT_TIMESTAMP,
    [observacoes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProductUsage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ProductUsage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Attachment
CREATE TABLE [dbo].[Attachment] (
    [id] NVARCHAR(1000) NOT NULL,
    [clientId] NVARCHAR(1000) NULL,
    [attendanceId] NVARCHAR(1000) NULL,
    [nomeOriginal] NVARCHAR(1000) NOT NULL,
    [nomeArquivo] NVARCHAR(1000) NOT NULL,
    [caminhoRelativo] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(1000) NOT NULL,
    [tamanhoBytes] INT NOT NULL,
    [categoria] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Attachment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Attachment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Payment
CREATE TABLE [dbo].[Payment] (
    [id] NVARCHAR(1000) NOT NULL,
    [attendanceId] NVARCHAR(1000) NOT NULL,
    [valor] DECIMAL(10,2) NOT NULL,
    [metodo] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'Pago',
    [dataPagamento] DATETIME2 NULL CONSTRAINT [Payment_dataPagamento_df] DEFAULT CURRENT_TIMESTAMP,
    [numeroParcelas] INT NOT NULL CONSTRAINT [Payment_numeroParcelas_df] DEFAULT 1,
    [identificadorTransacao] NVARCHAR(1000) NULL,
    [observacoes] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable PixInstallment
CREATE TABLE [dbo].[PixInstallment] (
    [id] NVARCHAR(1000) NOT NULL,
    [paymentId] NVARCHAR(1000) NOT NULL,
    [numeroParcela] INT NOT NULL,
    [totalParcelas] INT NOT NULL,
    [valor] DECIMAL(10,2) NOT NULL,
    [dataVencimento] DATETIME2 NOT NULL,
    [dataPagamento] DATETIME2 NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [PixInstallment_status_df] DEFAULT 'Pendente',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PixInstallment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PixInstallment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable Reminder
CREATE TABLE [dbo].[Reminder] (
    [id] NVARCHAR(1000) NOT NULL,
    [clientId] NVARCHAR(1000) NULL,
    [pixInstallmentId] NVARCHAR(1000) NULL,
    [titulo] NVARCHAR(1000) NOT NULL,
    [descricao] NVARCHAR(max) NULL,
    [dataVencimento] DATETIME2 NOT NULL,
    [prioridade] NVARCHAR(1000) NOT NULL CONSTRAINT [Reminder_prioridade_df] DEFAULT 'media',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Reminder_status_df] DEFAULT 'pendente',
    [tipo] NVARCHAR(1000) NOT NULL CONSTRAINT [Reminder_tipo_df] DEFAULT 'parcela_pix',
    [completedAt] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Reminder_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Reminder_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Create Indexes
CREATE NONCLUSTERED INDEX [Client_nome_idx] ON [dbo].[Client]([nome]);
CREATE NONCLUSTERED INDEX [Client_status_idx] ON [dbo].[Client]([status]);
CREATE NONCLUSTERED INDEX [EmergencyContact_clientId_idx] ON [dbo].[EmergencyContact]([clientId]);
CREATE NONCLUSTERED INDEX [Appointment_clientId_idx] ON [dbo].[Appointment]([clientId]);
CREATE NONCLUSTERED INDEX [Appointment_dataHora_idx] ON [dbo].[Appointment]([dataHora]);
CREATE NONCLUSTERED INDEX [Appointment_status_idx] ON [dbo].[Appointment]([status]);
CREATE NONCLUSTERED INDEX [PlannedProcedure_appointmentId_idx] ON [dbo].[PlannedProcedure]([appointmentId]);
CREATE NONCLUSTERED INDEX [PlannedProcedure_procedureId_idx] ON [dbo].[PlannedProcedure]([procedureId]);
CREATE NONCLUSTERED INDEX [Attendance_appointmentId_idx] ON [dbo].[Attendance]([appointmentId]);
CREATE NONCLUSTERED INDEX [Attendance_clientId_idx] ON [dbo].[Attendance]([clientId]);
CREATE NONCLUSTERED INDEX [Attendance_status_idx] ON [dbo].[Attendance]([status]);
CREATE NONCLUSTERED INDEX [Attendance_dataHora_idx] ON [dbo].[Attendance]([dataHora]);
CREATE NONCLUSTERED INDEX [Procedure_nome_idx] ON [dbo].[Procedure]([nome]);
CREATE NONCLUSTERED INDEX [Procedure_isActive_idx] ON [dbo].[Procedure]([isActive]);
CREATE NONCLUSTERED INDEX [AttendanceProcedure_attendanceId_idx] ON [dbo].[AttendanceProcedure]([attendanceId]);
CREATE NONCLUSTERED INDEX [AttendanceProcedure_procedureId_idx] ON [dbo].[AttendanceProcedure]([procedureId]);
CREATE NONCLUSTERED INDEX [Product_nome_idx] ON [dbo].[Product]([nome]);
CREATE NONCLUSTERED INDEX [Product_isActive_idx] ON [dbo].[Product]([isActive]);
CREATE NONCLUSTERED INDEX [ProductLot_productId_idx] ON [dbo].[ProductLot]([productId]);
CREATE NONCLUSTERED INDEX [ProductLot_numeroLote_idx] ON [dbo].[ProductLot]([numeroLote]);
CREATE NONCLUSTERED INDEX [StockUnit_lotId_idx] ON [dbo].[StockUnit]([lotId]);
CREATE NONCLUSTERED INDEX [StockUnit_status_idx] ON [dbo].[StockUnit]([status]);
CREATE NONCLUSTERED INDEX [StockUnit_currentClientId_idx] ON [dbo].[StockUnit]([currentClientId]);
CREATE NONCLUSTERED INDEX [ProductUsage_attendanceId_idx] ON [dbo].[ProductUsage]([attendanceId]);
CREATE NONCLUSTERED INDEX [ProductUsage_stockUnitId_idx] ON [dbo].[ProductUsage]([stockUnitId]);
CREATE NONCLUSTERED INDEX [ProductUsage_attendanceProcedureId_idx] ON [dbo].[ProductUsage]([attendanceProcedureId]);
CREATE NONCLUSTERED INDEX [Attachment_clientId_idx] ON [dbo].[Attachment]([clientId]);
CREATE NONCLUSTERED INDEX [Attachment_attendanceId_idx] ON [dbo].[Attachment]([attendanceId]);
CREATE NONCLUSTERED INDEX [Payment_attendanceId_idx] ON [dbo].[Payment]([attendanceId]);
CREATE NONCLUSTERED INDEX [Payment_metodo_idx] ON [dbo].[Payment]([metodo]);
CREATE NONCLUSTERED INDEX [Payment_status_idx] ON [dbo].[Payment]([status]);
CREATE NONCLUSTERED INDEX [PixInstallment_paymentId_idx] ON [dbo].[PixInstallment]([paymentId]);
CREATE NONCLUSTERED INDEX [PixInstallment_dataVencimento_idx] ON [dbo].[PixInstallment]([dataVencimento]);
CREATE NONCLUSTERED INDEX [PixInstallment_status_idx] ON [dbo].[PixInstallment]([status]);
CREATE NONCLUSTERED INDEX [Reminder_clientId_idx] ON [dbo].[Reminder]([clientId]);
CREATE NONCLUSTERED INDEX [Reminder_pixInstallmentId_idx] ON [dbo].[Reminder]([pixInstallmentId]);
CREATE NONCLUSTERED INDEX [Reminder_dataVencimento_idx] ON [dbo].[Reminder]([dataVencimento]);
CREATE NONCLUSTERED INDEX [Reminder_status_idx] ON [dbo].[Reminder]([status]);

-- Add Foreign Keys
ALTER TABLE [dbo].[EmergencyContact] ADD CONSTRAINT [EmergencyContact_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Appointment] ADD CONSTRAINT [Appointment_rescheduledFromId_fkey] FOREIGN KEY ([rescheduledFromId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[PlannedProcedure] ADD CONSTRAINT [PlannedProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_appointmentId_fkey] FOREIGN KEY ([appointmentId]) REFERENCES [dbo].[Appointment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [Attendance_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[MedicalRecord] ADD CONSTRAINT [MedicalRecord_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[AttendanceProcedure] ADD CONSTRAINT [AttendanceProcedure_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[ProcedureProduct] ADD CONSTRAINT [ProcedureProduct_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[ProductLot] ADD CONSTRAINT [ProductLot_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_lotId_fkey] FOREIGN KEY ([lotId]) REFERENCES [dbo].[ProductLot]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[StockUnit] ADD CONSTRAINT [StockUnit_currentClientId_fkey] FOREIGN KEY ([currentClientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_stockUnitId_fkey] FOREIGN KEY ([stockUnitId]) REFERENCES [dbo].[StockUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ProductUsage] ADD CONSTRAINT [ProductUsage_attendanceProcedureId_fkey] FOREIGN KEY ([attendanceProcedureId]) REFERENCES [dbo].[AttendanceProcedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [Attachment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_attendanceId_fkey] FOREIGN KEY ([attendanceId]) REFERENCES [dbo].[Attendance]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PixInstallment] ADD CONSTRAINT [PixInstallment_paymentId_fkey] FOREIGN KEY ([paymentId]) REFERENCES [dbo].[Payment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Reminder] ADD CONSTRAINT [Reminder_pixInstallmentId_fkey] FOREIGN KEY ([pixInstallmentId]) REFERENCES [dbo].[PixInstallment]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Business Constraint: Attachment ownership exclusivity (Client XOR Attendance)
ALTER TABLE [dbo].[Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
