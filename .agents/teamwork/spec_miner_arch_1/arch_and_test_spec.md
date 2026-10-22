# PopoApp — Architecture, Data Modeling, Security, Storage, Localization & Test Infrastructure Specification

**Miner**: Architecture & Test Miner 1 (`spec_miner_arch_1`)  
**Timestamp**: 2026-10-06T02:35:00Z  
**Project**: PopoApp (Management system for single-professional Brazilian aesthetic/clinical practice)  
**Authoritative Sources**:
1. `POPOAPP_DEVELOPMENT_SPEC.md`
2. `POPOAPP_IMPLEMENTATION_CHECKLIST_SPEC.md`
3. `ORIGINAL_REQUEST.md` (including Binding Decisions D1–D7 and Acceptance Criteria)
4. Existing Codebase (`prisma/schema.prisma`, `src/`, `SETUP_GUIDE.md`, `package.json`)

---

## 1. Executive Summary & Binding Decisions

PopoApp is designed as a single-professional aesthetic and clinical practice management application built on Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, iron-session, and Prisma 6 running on Microsoft SQL Server LocalDB.

### Binding Business Decisions (D1–D7)
- **D1. Attendance Lifecycle**: Attendance (`Atendimento`) has its own status: `Pendente`, `Realizado`, `Cancelado`. It is created automatically as `Pendente` when its Appointment (`Agendamento`) is created. The user marks it `Realizado` manually when the clinical encounter actually occurs. When the Appointment transitions to `Cancelado`, `Não compareceu`, or `Reagendado`, its pending Attendance is automatically set to `Cancelado`. A rescheduled Appointment produces a new Appointment with its own new `Pendente` Attendance. Creating an Appointment never produces a `Realizado` Attendance.
- **D2. Attendance Total & Balance Composition**:
  - `Total` = $\sum(\text{practicedValue of procedures}) - \text{explicit Attendance discount}$.
  - `Outstanding` (Saldo Devedor) = $\text{Total} - \sum(\text{payments with status 'Pago'})$.
  - Both figures are strictly **computed on demand**, NOT stored as independent editable sources of truth.
- **D3. Planned Procedures**: An Appointment may carry planned procedures for estimated duration/value and pre-filling its Attendance. These remain distinct from procedures actually recorded on the Attendance. Appointments carry **no planned products**.
- **D4. Client Required & Unique CPF**: In addition to standard contact and address fields, **CPF is mandatory and unique**, validated using the official Brazilian algorithm (MOD 11) and stored normalized (11 digits). Database enforces a unique constraint.
- **D5. In-App Reminders Only**: Reminders are strictly internal (Lembretes page and dashboard upcoming/overdue widget for PIX installments). No external messaging (WhatsApp, SMS, Email). Marking a reminder done does not alter payment ledger status.
- **D6. File Storage Security**: Uploaded files live on local disk **outside the public folder** (e.g. `./storage/uploads/`) and are served only through authenticated routes, never via predictable public URLs.
- **D7. Environment & Database Isolation**: SQL Server LocalDB is used. Migrations and integration tests run against it, and tests must execute against a **separate test database** (`PopoAppTest`), never the development database (`PopoApp`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Data / Auth | Single User Authentication | iron-session cookie auth with bcrypt password verification | `nickname`, `password` | Session cookie, User profile | 401 Unauthorized for invalid credentials | Dev Spec §29, Request D7 |
| 2 | Data / Client | Client Registration with Mandatory Unique CPF | Create/update Client with name, phone, email, birth date, address, notes, active status, and normalized 11-digit CPF | Client registration payload + CPF string | Created/updated Client entity | 400 Bad Request if invalid CPF; 409 Conflict if duplicate CPF | Request D4, AC 62 |
| 3 | Data / Client | Emergency Contacts Management | Client 1:N Emergency Contacts with relationship, phone, notes | Contact details, clientId | EmergencyContact entity | 400 if required fields missing | Dev Spec §4, §31 |
| 4 | Data / Client | Profile Photo Single Attachment | Single profile photo attachment for client; replacement deletes/overwrites old file without version history | Image file, clientId | Profile photo metadata / URL | 400 on invalid file format/size | Dev Spec §5, §30 |
| 5 | Data / Storage | Attachment Ownership Exclusivity | File attachment belongs to EITHER Client OR Attendance, never both, never neither | File buffer, metadata, clientId OR attendanceId | Attachment entity | Database CHECK constraint violation if both or neither provided | Dev Spec §6, §32 V14, AC 61 |
| 6 | Storage / Sec | Isolated Local Storage | Files saved to local disk directory outside `public/` using non-predictable UUID filenames | Uploaded file stream | Internal storage file path | 500 on filesystem write failure | Request D6, Dev Spec §39 |
| 7 | Storage / Sec | Authenticated Attachment Streaming | Secure route `/api/attachments/[id]` verifies session before streaming file | Attachment ID, Session cookie | Streamed file response with security headers | 401 if unauthenticated; 404 if not found | Request D6, AC 60 |
| 8 | Storage / Sec | Upload MIME & Size Validation | Validates allowed MIME types (JPEG, PNG, WebP, PDF) and max size (10MB) before saving | File buffer, headers | Validated upload stream | 400 if MIME invalid or size exceeded | Dev Spec §39, Checklist Phase 11 |
| 9 | Data / Agenda | Appointment Scheduling | Schedule appointment with client, date/time, estimated value, notes, planned procedures | Appointment creation data | Appointment entity + auto-created Pending Attendance | 400 if invalid date or missing client | Dev Spec §7, §8, D1 |
| 10 | Data / Agenda | Appointment Status Lifecycle | Valid statuses: `Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`. NO `Em atendimento`. | Status update action | Updated Appointment entity | 400 if status invalid or forbidden transition | Dev Spec §7, §32 V2, V3 |
| 11 | Data / Agenda | Rescheduling Workflow | Marks old appointment as `Reagendado`, creates new Appointment, cancels old pending attendance, creates new pending attendance | Original Appointment ID, new Date/Time | Old Appointment (`Reagendado`), New Appointment (`Agendado`), New Attendance (`Pendente`) | 400 if original appointment is completed/cancelled | Dev Spec §7, §32 V4, D1 |
| 12 | Data / Agenda | Manual Appointment Confirmation | Explicit user action to mark appointment `Confirmado` | Appointment ID | Updated Appointment (`Confirmado`) | 400 if invalid transition | Dev Spec §7, §32 |
| 13 | Data / Agenda | Cancellation with Reason | Cancel appointment recording reason; automatically cascades status `Cancelado` to pending Attendance | Appointment ID, cancellation reason string | Updated Appointment (`Cancelado`), Attendance (`Cancelado`) | 400 if reason missing (when required) | Dev Spec §7, D1 |
| 14 | Data / Agenda | No-Show Recording | Marks appointment as `Não compareceu`; cascades status `Cancelado` to pending Attendance | Appointment ID | Updated Appointment (`Não compareceu`), Attendance (`Cancelado`) | 400 if invalid transition | Dev Spec §7, D1 |
| 15 | Data / Agenda | Planned Procedures on Appointment | Procedures attached to Appointment for duration/value estimation and pre-filling Attendance; distinct from actual procedures | Appointment ID, Procedure IDs | PlannedProcedure records | 400 if procedure does not exist | Request D3 |
| 16 | Data / Attendance | Attendance Distinct Lifecycle | Attendance is distinct from Appointment. Statuses: `Pendente`, `Realizado`, `Cancelado`. Not completed merely because appointment exists. | Attendance creation / update | Attendance entity | 400 if attempting to create directly as `Realizado` | Dev Spec §8, §32 V5, V7, D1 |
| 17 | Data / Attendance | Multiple Attendances per Appointment | Appointment 1:N Attendance supported by schema and service logic | Appointment ID, Attendance data | New Attendance associated with Appointment | 400 if appointment does not exist | Dev Spec §8, §31, §32 V6 |
| 18 | Data / Pricing | Procedure Catalog Snapshot | Procedure standard value snapshotted (`standardValueSnapshot`) when linked to Attendance | Attendance ID, Procedure ID | AttendanceProcedure line-item | 400 if procedure inactive | Dev Spec §9, §10, §32 V12 |
| 19 | Data / Pricing | Independent Practiced Value | Every procedure on Attendance MUST have its own editable `practicedValue`, distinct from standard snapshot | AttendanceProcedure ID, practiced value | Updated AttendanceProcedure | 400 if practiced value is negative or missing | Dev Spec §11, §32 V8, V9 |
| 20 | Data / Pricing | Explicit Attendance Discount | Explicit discount applied at Attendance level; NOT inferred from standard vs practiced delta | Attendance ID, discount amount | Updated Attendance (`desconto`) | 400 if discount > total practiced values | Dev Spec §12, §32 V10, V11 |
| 21 | Data / Pricing | Computed Financial Totals | Total = sum(practicedValue) - discount; Outstanding = Total - sum(paid). Neither stored as static truth. | Attendance ID | Calculated financial breakdown object | N/A (deterministic computation) | Request D2, Dev Spec §13, §25 |
| 22 | Data / Clinical | One Medical Record per Attendance | MedicalRecord (`Prontuário`) 1:1 with Attendance. Stores clinical presentation, observations, conduct, instructions. | Attendance ID, clinical fields | MedicalRecord entity | 409 if duplicate record created for attendance | Dev Spec §19, §31, §32 V19 |
| 23 | Data / Inventory | Individual Stock Unit Traceability | Hierarchy: Product -> Lot -> IndividualStockUnit. Physical items tracked individually. | Product catalog, Lot details, Serial/Unit codes | Tracked StockUnit entities | 400 if invalid lot or missing serial | Dev Spec §14, §16, §32 V18 |
| 24 | Data / Inventory | Reusable vs Single-Use Classification | Products flagged as `isReusable: boolean`. Dictates usage constraints across attendances. | Product payload | Product entity with reusable flag | 400 if invalid classification | Dev Spec §15, §32 V15, V17 |
| 25 | Data / Inventory | Same-Client Reusable Unit Reuse | A reusable unit used by Client A in Attendance 1 can be used by Client A in Attendance 2 | Attendance ID, StockUnit ID | ProductUsage entity | 400 if validation fails | Dev Spec §15, §32 V15, AC 65 |
| 26 | Data / Inventory | Cross-Client Reuse Prevention | A physical unit used by Client A must NEVER be used by Client B, even if reusable | Attendance ID, StockUnit ID | Rejection error with clear Portuguese message | 400/422 Forbidden cross-client reuse error | Dev Spec §15, §32 V16, AC 59, AC 66 |
| 27 | Data / Inventory | Single-Use Re-consumption Prevention | A single-use physical unit cannot be recorded in more than one Attendance | Attendance ID, StockUnit ID | Rejection error | 400/422 Forbidden second-use error | Dev Spec §15, §32 V17, AC 59 |
| 28 | Data / Payment | Multi-Method Attendance Payments | Attendance supports multiple payment records with different methods (PIX, Credit Card, Cash, etc.) | Attendance ID, amount, method, status | Payment records | 400 if invalid payment data | Dev Spec §20, §21, §32 V20 |
| 29 | Data / Payment | Credit Card Installments Without Reminders | Credit card payments store installment count ($1..12$). Generates ZERO collection reminders. | Amount, method='CartaoCredito', installments count | Payment entity | 400 if installments < 1 | Dev Spec §22, §32 V21 |
| 30 | Data / Payment | PIX Installment Scheduling | Agreed schedule for PIX installments (total amount, count, interval/due dates) | Payment ID, total, installment count, first due date | Array of PixInstallment entities | 400 if dates or amounts invalid | Dev Spec §23, §45 |
| 31 | Data / Reminders | PIX Installment Due-Date Reminders | Reminders automatically generated from PIX installment schedule due dates | PixInstallment records | Reminder entities (type='parcela_pix') | 400 on invalid installment reference | Dev Spec §23, §24, §32 V22 |
| 32 | Data / Reminders | Reminder State Independence | Marking a reminder done/dismissed does NOT alter payment ledger or installment status | Reminder ID, action='complete'/'dismiss' | Updated Reminder status | 400 if reminder not found | Dev Spec §23, §32 V23, AC 68 |
| 33 | UX / Client | Consolidated Client History View | Client detail page organizes and derives history from real records (appointments, attendances, procedures, inventory, medical records, payments, attachments) | Client ID | Structured multi-tab client history view | 404 if client not found | Dev Spec §26, §41, AC 67 |
| 34 | Localization | Brazilian Portuguese (pt-BR) Interface | Complete interface, labels, tables, dialogs, validation messages, and date/currency formatting in pt-BR | System inputs | Rendered localized UI (BRL currency, dd/MM/yyyy dates) | Portuguese validation error messages | Dev Spec §33, §51 |
| 35 | Testing | Separate Test Database Setup | Isolated database `PopoAppTest` on SQL Server LocalDB used strictly for automated tests | `DATABASE_URL` override | Clean test schema via Prisma migrations | Test abort if pointing to production/development DB | Request D7 |
| 36 | Testing | Automated Test Runner Suite | Single command (`npm test`) executes unit, integration, and rule tests with 0 failures | Test command execution | Test summary report (pass/fail count) | Non-zero exit code on test failure | Request AC 51 |

---

## 3. Edge Cases & Failure Modes

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Client CPF Validation | Invalid CPF digits (e.g. `111.111.111-11` or invalid check digits `123.456.789-00`) | Server rejects with Portuguese message: `"CPF inválido"`. Registration aborted. |
| 2 | Client CPF Uniqueness | Creating Client with CPF already assigned to existing Client | Server rejects with `"CPF já cadastrado"`. If bypassed, SQL Server unique constraint `UQ_Client_CPF` throws violation. |
| 3 | Attachment Ownership | Insert Attachment with both `clientId` and `attendanceId` populated | Rejected by service layer. If bypassed, SQL Server CHECK constraint `CK_Attachment_Ownership` throws violation error. |
| 4 | Attachment Ownership | Insert Attachment with neither `clientId` nor `attendanceId` populated | Rejected by service layer. If bypassed, SQL Server CHECK constraint `CK_Attachment_Ownership` throws violation error. |
| 5 | Stock Unit Reuse | Single-use unit (`isReusable: false`) recorded in a second Attendance | Service layer rejects: `"Este produto é de uso único e já foi utilizado."` Operation aborted. |
| 6 | Stock Unit Reuse | Reusable unit (`isReusable: true`) assigned to Client A attempted to be recorded for Client B | Service layer rejects: `"Esta unidade de estoque já está vinculada a outro cliente."` Operation aborted. |
| 7 | Stock Unit Reuse | Reusable unit recorded in a second Attendance for the SAME Client A | Allowed and successfully recorded in `ProductUsage`. Traceability preserved. |
| 8 | Catalog Modification | Procedure standard price changed from R$ 500 to R$ 600 in catalog | Existing Attendances retain `standardValueSnapshot = 500.00` and original `practicedValue`. Historical records are unmodified. |
| 9 | Attendance Pricing | Procedure standard R$ 500, practiced R$ 400, discount R$ 0 (Example A) | Total is computed as R$ 400. System NEVER generates an automatic discount of R$ 100. Discount displays as R$ 0,00. |
| 10 | Attendance Pricing | Two procedures practiced total R$ 800, explicit discount R$ 100 (Example B) | Total is computed as R$ 700. Financial UI displays R$ 100 explicitly in `"Desconto"`. Outstanding reflects R$ 700 minus payments. |
| 11 | Rescheduling | Rescheduling an appointment from 10:00 to 14:00 on next week | Original appointment status changes to `Reagendado`. New appointment created as `Agendado`. Original pending attendance becomes `Cancelado`. New pending attendance created. |
| 12 | Cancellation | Cancelling an appointment with reason `"Cliente com febre"` | Appointment status becomes `Cancelado`, `motivoCancelamento` saved. Linked pending Attendance automatically becomes `Cancelado`. |
| 13 | No-Show | Marking appointment as `"Não compareceu"` | Appointment status becomes `Não compareceu`. Linked pending Attendance automatically becomes `Cancelado`. |
| 14 | Attendance Completion | Creating an appointment with planned procedures | Pending Attendance is created with status `Pendente`. Attendance status NEVER becomes `Realizado` automatically. |
| 15 | Credit Card Reminders | Payment recorded with method `"Cartão de Crédito"` and 6 installments | Payment saved with `numeroParcelas = 6`. Exactly ZERO reminders generated in the Reminder system. |
| 16 | PIX Reminders | Payment recorded with PIX installment schedule (5 installments) | 5 `PixInstallment` records created. 5 `Reminder` records created with corresponding due dates. |
| 17 | Reminder Dismissal | User marks PIX installment reminder as `"Concluído"` or `"Dispensado"` | Reminder status changes to `concluido`/`dispensado`. Corresponding `PixInstallment` and `Payment` statuses remain completely unchanged. |
| 18 | Unauthenticated Download | Request to `/api/attachments/[id]` without active session cookie | Server returns `401 Unauthorized` (or redirects to `/login`). File content is never streamed. |
| 19 | Path Traversal Attack | Filename uploaded containing `../../etc/passwd` or `..\..\secret.txt` | Storage service ignores client filename for disk path; saves file as `<uuid>.<ext>` in isolated storage root. |
| 20 | Medical Record Cardinality | Attempting to create a second MedicalRecord for the same Attendance | Database unique constraint `UQ_MedicalRecord_AttendanceId` rejects insert. Service layer returns 409 Conflict. |

---

## 4. Data Modeling & Prisma Schema Specification (SQL Server LocalDB)

### 4.1 SQL Server LocalDB Technical Constraints & Strategy
1. **Prisma Enums**:
   - *Limitation*: The Prisma `sqlserver` connector does **not** support Prisma `enum` declarations (`enum Status { ... }`). Defining an `enum` block causes Prisma migration/generation errors on SQL Server.
   - *Solution*: All status, method, and category fields are modeled as `String` in Prisma schema, with runtime validation enforced via TypeScript string literal unions and Zod schemas in the domain service layer.
2. **Financial Decimal Types**:
   - Floats cause cumulative IEEE 754 precision errors. All monetary values (`valorPadrao`, `standardValueSnapshot`, `practicedValue`, `desconto`, `valor`, `precoCusto`) use `@db.Decimal(10, 2)`.
3. **Primary Keys & Identifiers**:
   - Standardize on `String @id @default(uuid())` across all entities, maintaining consistency with existing `User` model.
4. **Relational Cascades & SQL Server Cycle Prevention**:
   - SQL Server raises error `1785` ("introducing FOREIGN KEY constraint may cause cycles or multiple cascade paths") when multiple cascade delete paths lead to the same table.
   - Strategy: Use `onDelete: Cascade` only for primary owned children (`EmergencyContact`, `PlannedProcedure`, `AttendanceProcedure`, `ProductLot`). For entities with multiple incoming foreign keys (`Attendance`, `Attachment`, `ProductUsage`), use `onDelete: NoAction` or `onDelete: Restrict` and manage cleanup within service transactions.
5. **Database-Level CHECK Constraints**:
   - SQL Server supports `CHECK` constraints. Prisma does not natively generate custom table CHECK constraints via schema DSL.
   - Strategy: Include custom SQL migration script (`migration.sql`) to create:
     ```sql
     ALTER TABLE [Attachment] ADD CONSTRAINT [CK_Attachment_Ownership]
     CHECK (([clientId] IS NOT NULL AND [attendanceId] IS NULL) OR ([clientId] IS NULL AND [attendanceId] IS NOT NULL));
     ```
     This satisfies the binding requirement: *"The database rejects an attachment row owning both a Client and an Attendance (or neither). This is verified by a test that bypasses the service layer."*

---

### 4.2 Comprehensive Target `schema.prisma`

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. AUTENTICAÇÃO E USUÁRIOS
// ==========================================
model User {
  id           String   @id @default(uuid())
  nickname     String   @unique
  displayName  String
  passwordHash String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// ==========================================
// 2. CLIENTE E CONTATOS
// ==========================================
model Client {
  id             String             @id @default(uuid())
  nome           String
  cpf            String             @unique // Obrigatório e único (normalizado 11 dígitos)
  telefone       String
  email          String?
  dataNascimento DateTime?
  endereco       String?
  observacoes    String?            @db.NVarChar(Max)
  status         String             @default("ativo") // 'ativo' | 'inativo'
  profilePhotoId String?            // Referência ao Anexo da foto de perfil
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  emergencyContacts EmergencyContact[]
  attachments       Attachment[]
  appointments      Appointment[]
  attendances       Attendance[]
  reminders         Reminder[]
  stockUnits        StockUnit[]        // Unidades reutilizáveis vinculadas ao cliente

  @@index([nome])
  @@index([status])
}

model EmergencyContact {
  id          String   @id @default(uuid())
  clientId    String
  nome        String
  telefone    String
  parentesco  String   // Relação com o cliente (mãe, cônjuge, etc.)
  observacoes String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
}

// ==========================================
// 3. AGENDAMENTO E PROCEDIMENTOS PLANEJADOS
// ==========================================
model Appointment {
  id                  String             @id @default(uuid())
  clientId            String
  dataHora            DateTime
  status              String             @default("Agendado") // 'Agendado', 'Confirmado', 'Concluído', 'Cancelado', 'Não compareceu', 'Reagendado'
  valorEstimado       Decimal?           @db.Decimal(10, 2)
  observacoes         String?            @db.NVarChar(Max)
  motivoCancelamento  String?
  rescheduledFromId   String?            // Aponta para o agendamento de origem
  rescheduledToId     String?            // Aponta para o novo agendamento criado
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  client              Client             @relation(fields: [clientId], references: [id], onDelete: NoAction)
  rescheduledFrom     Appointment?       @relation("RescheduleHistory", fields: [rescheduledFromId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  rescheduledTo       Appointment[]      @relation("RescheduleHistory")
  attendances         Attendance[]       // 1:N
  plannedProcedures   PlannedProcedure[]

  @@index([clientId])
  @@index([dataHora])
  @@index([status])
}

model PlannedProcedure {
  id            String      @id @default(uuid())
  appointmentId String
  procedureId   String
  ordem         Int         @default(0)
  createdAt     DateTime    @default(now())

  appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  procedure   Procedure   @relation(fields: [procedureId], references: [id], onDelete: NoAction)

  @@index([appointmentId])
  @@index([procedureId])
}

// ==========================================
// 4. ATENDIMENTO E CLÍNICA
// ==========================================
model Attendance {
  id            String                @id @default(uuid())
  appointmentId String
  clientId      String
  status        String                @default("Pendente") // 'Pendente', 'Realizado', 'Cancelado'
  dataHora      DateTime              @default(now())
  completedAt   DateTime?
  desconto      Decimal               @default(0.00) @db.Decimal(10, 2) // Desconto explícito do atendimento
  observacoes   String?               @db.NVarChar(Max)
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  appointment   Appointment           @relation(fields: [appointmentId], references: [id], onDelete: NoAction)
  client        Client                @relation(fields: [clientId], references: [id], onDelete: NoAction)
  procedures    AttendanceProcedure[] // Associação técnica (NÃO PerformedProcedure)
  productUsages ProductUsage[]
  medicalRecord MedicalRecord?
  attachments   Attachment[]
  payments      Payment[]

  @@index([appointmentId])
  @@index([clientId])
  @@index([status])
  @@index([dataHora])
}

model MedicalRecord {
  id                  String     @id @default(uuid())
  attendanceId        String     @unique // 1:1 estrito com Atendimento
  queixaPrincipal     String?    @db.NVarChar(Max)
  avaliacaoClinica    String?    @db.NVarChar(Max)
  condutaProcedimento String?    @db.NVarChar(Max)
  orientacoes         String?    @db.NVarChar(Max)
  observacoes         String?    @db.NVarChar(Max)
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt

  attendance Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
}

// ==========================================
// 5. CATÁLOGO DE PROCEDIMENTOS E PREÇOS
// ==========================================
model Procedure {
  id             String                 @id @default(uuid())
  nome           String
  descricao      String?                @db.NVarChar(Max)
  valorPadrao    Decimal                @db.Decimal(10, 2)
  duracaoMinutos Int
  categoria      String?
  isActive       Boolean                @default(true)
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  attendanceProcedures AttendanceProcedure[]
  plannedAppointments  PlannedProcedure[]
  productAssociations  ProcedureProduct[]

  @@index([nome])
  @@index([isActive])
}

model AttendanceProcedure {
  id                    String         @id @default(uuid())
  attendanceId          String
  procedureId           String
  standardValueSnapshot Decimal        @db.Decimal(10, 2) // Snapshot imutável do valor padrão na inclusão
  practicedValue        Decimal        @db.Decimal(10, 2) // Valor praticado obrigatório e independente
  observacoes           String?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  attendance   Attendance     @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  procedure    Procedure      @relation(fields: [procedureId], references: [id], onDelete: NoAction)
  productUsages ProductUsage[]

  @@index([attendanceId])
  @@index([procedureId])
}

// ==========================================
// 6. PRODUTOS, LOTES E ESTOQUE INDIVIDUAL
// ==========================================
model Product {
  id          String             @id @default(uuid())
  nome        String
  categoria   String?
  marca       String?
  descricao   String?            @db.NVarChar(Max)
  unidade     String             // 'frasco', 'ampola', 'seringa', 'caixa', etc.
  isReusable  Boolean            @default(false) // Reutilizável pelo mesmo cliente vs Uso único
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  lots                 ProductLot[]
  procedureAssociations ProcedureProduct[]

  @@index([nome])
  @@index([isActive])
}

model ProcedureProduct {
  procedureId String
  productId   String
  createdAt   DateTime @default(now())

  procedure Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([procedureId, productId])
}

model ProductLot {
  id            String      @id @default(uuid())
  productId     String
  numeroLote    String
  dataValidade  DateTime?
  dataAquisicao DateTime?
  precoCusto    Decimal?    @db.Decimal(10, 2)
  observacoes   String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  product    Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  stockUnits StockUnit[]

  @@index([productId])
  @@index([numeroLote])
}

model StockUnit {
  id              String         @id @default(uuid())
  lotId           String
  codigoSerial    String         @unique // Identificador físico único (ex: UNIT-001)
  status          String         @default("Disponivel") // 'Disponivel', 'EmUso', 'Esgotado', 'Descartado'
  currentClientId String?        // Vinculado ao cliente caso seja produto reutilizável em uso
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  lot           ProductLot     @relation(fields: [lotId], references: [id], onDelete: Cascade)
  currentClient Client?        @relation(fields: [currentClientId], references: [id], onDelete: NoAction)
  usages        ProductUsage[]

  @@index([lotId])
  @@index([status])
  @@index([currentClientId])
}

model ProductUsage {
  id                    String               @id @default(uuid())
  attendanceId          String
  stockUnitId           String
  attendanceProcedureId String?
  dataHora              DateTime             @default(now())
  observacoes           String?
  createdAt             DateTime             @default(now())

  attendance          Attendance           @relation(fields: [attendanceId], references: [id], onDelete: NoAction)
  stockUnit           StockUnit            @relation(fields: [stockUnitId], references: [id], onDelete: NoAction)
  attendanceProcedure AttendanceProcedure? @relation(fields: [attendanceProcedureId], references: [id], onDelete: NoAction)

  @@index([attendanceId])
  @@index([stockUnitId])
  @@index([attendanceProcedureId])
}

// ==========================================
// 7. ANEXOS E DOCUMENTOS
// ==========================================
model Attachment {
  id              String      @id @default(uuid())
  clientId        String?     // Pertence a Cliente OU Atendimento (exclusivo via CHECK)
  attendanceId    String?     // Pertence a Cliente OU Atendimento (exclusivo via CHECK)
  nomeOriginal    String
  nomeArquivo     String      // Nome do arquivo gerado no disco (UUID)
  caminhoRelativo String      // Caminho relativo dentro do STORAGE_ROOT
  mimeType        String
  tamanhoBytes    Int
  categoria       String?     // 'foto_perfil', 'documento', 'termo', 'exame', 'clinico'
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  client     Client?     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  attendance Attendance? @relation(fields: [attendanceId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([attendanceId])
}

// ==========================================
// 8. FINANCEIRO, PAGAMENTOS E LEMBRETES
// ==========================================
model Payment {
  id                     String           @id @default(uuid())
  attendanceId           String
  valor                  Decimal          @db.Decimal(10, 2)
  metodo                 String           // 'CartaoCredito', 'Pix', 'Dinheiro', 'CartaoDebito', 'Boleto', 'Transferencia'
  status                 String           @default("Pago") // 'Pago', 'Pendente', 'Cancelado'
  dataPagamento          DateTime?        @default(now())
  numeroParcelas         Int              @default(1)
  identificadorTransacao String?
  observacoes            String?
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  attendance      Attendance       @relation(fields: [attendanceId], references: [id], onDelete: NoAction)
  pixInstallments PixInstallment[]

  @@index([attendanceId])
  @@index([metodo])
  @@index([status])
}

model PixInstallment {
  id             String     @id @default(uuid())
  paymentId      String
  numeroParcela  Int
  totalParcelas  Int
  valor          Decimal    @db.Decimal(10, 2)
  dataVencimento DateTime
  dataPagamento  DateTime?
  status         String     @default("Pendente") // 'Pendente', 'Pago', 'Atrasado', 'Cancelado'
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  payment   Payment    @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  reminders Reminder[]

  @@index([paymentId])
  @@index([dataVencimento])
  @@index([status])
}

model Reminder {
  id               String          @id @default(uuid())
  clientId         String?
  pixInstallmentId String?
  titulo           String
  descricao        String?         @db.NVarChar(Max)
  dataVencimento   DateTime
  prioridade       String          @default("media") // 'baixa', 'media', 'alta'
  status           String          @default("pendente") // 'pendente', 'concluido', 'dispensado'
  tipo             String          @default("parcela_pix") // 'parcela_pix', 'retorno', 'geral'
  completedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  client         Client?         @relation(fields: [clientId], references: [id], onDelete: NoAction)
  pixInstallment PixInstallment? @relation(fields: [pixInstallmentId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([pixInstallmentId])
  @@index([dataVencimento])
  @@index([status])
}
```

---

## 5. File Storage Architecture & Security Boundaries

### 5.1 Storage Directory Isolation
- **Physical Root Directory**: The storage directory is located strictly outside the web document root (`public/`).
  - Default: `<project_root>/storage/uploads/`
  - Configurable via environment variable: `STORAGE_DIR=c:/Users/Vinicius/PopoApp/PopoApp/storage/uploads`
- **Directory Structure**:
  ```
  storage/
  └── uploads/
      ├── clients/          # Client-level files & profile photos
      └── attendances/      # Clinical encounter attachments
  ```
- **File Naming & Path Traversal Prevention**:
  - Uploaded files are written with cryptographically secure random names: `<uuid>.<ext>`.
  - The user's original filename is never used directly in the disk path.
  - Path traversal characters (`..`, `/`, `\`) are stripped or rendered irrelevant.
  - Subdirectories are created automatically if missing (`fs.promises.mkdir(dir, { recursive: true })`).

### 5.2 Upload Validation Pipeline
1. **Authentication Check**: Request must carry an active iron-session cookie with `isLoggedIn: true`.
2. **MIME Type Allowlist**:
   - Images: `image/jpeg`, `image/png`, `image/webp`
   - Documents: `application/pdf`
   - All other MIME types (e.g. executables, scripts, html, svg) are rejected with HTTP 400.
3. **Magic Byte Verification**: File header inspected to ensure payload matches declared MIME type.
4. **File Size Limit**: Maximum file size is strictly capped at 10 MB (10,485,760 bytes).
5. **Ownership Exclusivity Verification**: Request must supply either `clientId` OR `attendanceId`, never both, never neither.

### 5.3 Authenticated Retrieval & Streaming Endpoint
- **Route**: `GET /api/attachments/[id]` or `GET /api/attachments/[id]/download`
- **Access Control Protocol**:
  1. Inspect `session.isLoggedIn`. If false or missing, return `401 Unauthorized` (JSON or redirect).
  2. Query database for `Attachment` by `id`. If not found, return `404 Not Found`.
  3. Resolve absolute disk path: `path.join(STORAGE_DIR, attachment.caminhoRelativo, attachment.nomeArquivo)`.
  4. Verify file exists on disk. If missing, return `404 Not Found`.
  5. Stream file response with headers:
     - `Content-Type: <attachment.mimeType>`
     - `Content-Length: <attachment.tamanhoBytes>`
     - `Content-Disposition: inline; filename="<encodedOriginalName>"` (or `attachment` for download)
     - `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
     - `Cache-Control: private, no-cache, no-store, must-revalidate`

### 5.4 Profile Photo Lifecycle
- When updating a Client's profile photo:
  1. Upload new photo attachment with category `'foto_perfil'`.
  2. Retrieve existing `Client.profilePhotoId`.
  3. If previous attachment exists:
     - Unlink from Client.
     - Delete physical file from disk.
     - Delete previous `Attachment` database record.
  4. Update `Client.profilePhotoId` with new attachment ID.
  - Adheres to Dev Spec §5: *"When the profile photo is replaced, the previous profile photo does not need to be preserved as historical profile-photo data. It may be deleted/replaced."*

---

## 6. Localization & UX Requirements (Brazilian Portuguese pt-BR)

### 6.1 Domain Terminology Standardization
The entire user interface, notifications, dialogs, buttons, table headers, and error messages must strictly use standard Brazilian Portuguese terminology.

| Standard Term | Permitted Uses | Forbidden / Deprecated Terms |
|---------------|----------------|------------------------------|
| **Cliente** | Paciente / Usuário do serviço | Client, Usuário, User |
| **Agendamento** | Compromisso na agenda | Consulta, Consulta Marcada, Appointment |
| **Atendimento** | Encontro clínico presencial | Consulta, Consulta Realizada, Encounter |
| **Procedimento** | Item do catálogo de tratamentos | Tratamento, Serviço, Procedure |
| **Procedimentos do Atendimento** | Associação técnica no atendimento | Procedimento Realizado, PerformedProcedure |
| **Valor Padrão** | Preço de referência no catálogo | Preço Original, Standard Value |
| **Valor Praticado** | Preço real aplicado ao procedimento | Preço com Desconto, Practiced Value |
| **Desconto do Atendimento** | Desconto explícito sobre o atendimento | Desconto do Procedimento, Desconto Automático |
| **Produto** | Item catalogado de estoque | Insumo, Material, Product |
| **Lote** | Lote de fabricação do produto | Batch, Lote de Compra |
| **Unidade de Estoque** | Unidade física rastreável | Item, Serial Unit |
| **Uso de Produto** | Registro de utilização física | Consumo, Gasto de Produto |
| **Prontuário** | Registro clínico do atendimento | Histórico Médico, Anotações, Medical Record |
| **Anexo** | Documento ou foto vinculada | Arquivo, File, Upload |
| **Pagamento** | Registro financeiro do atendimento | Baixa, Recebimento, Payment |
| **Parcela** | Parcela de cartão ou PIX | Mensalidade, Prestação, Installment |
| **Lembrete** | Alerta interno no sistema | Tarefa, Notificação, Aviso |

### 6.2 Screen Layouts and Workflows

#### A. Clientes (`/clientes` and `/clientes/[id]`)
- **Lista de Clientes**:
  - Busca em tempo real por Nome ou CPF formatado.
  - Colunas: Nome, CPF, Telefone, E-mail, Status (badge Ativo/Inativo), Último Atendimento, Ações.
  - Ações: Ver Detalhes (`/clientes/[id]`), Editar, Desativar/Ativar.
  - Botão `"Novo Cliente"`: Dialog com validação Zod:
    - Nome completo (obrigatório)
    - CPF (obrigatório, máscara `000.000.000-00`, validação algorítmica)
    - Telefone (obrigatório, máscara `(00) 00000-0000`)
    - E-mail (opcional, validação de formato)
    - Data de Nascimento (opcional, formato `dd/MM/yyyy`)
    - Endereço completo (opcional)
    - Observações / Alergias (opcional)
    - Contatos de emergência inline (Nome, Telefone, Parentesco)
- **Página de Detalhes do Cliente (`/clientes/[id]`)**:
  - Cabeçalho com foto de perfil (com opção de upload/substituição direta), Nome, CPF, Status e contatos rápidos.
  - Abas organizadas:
    1. **Visão Geral**: Dados cadastrais, endereço, notas e contatos de emergência.
    2. **Agendamentos**: Histórico de agendamentos com data, hora, status e procedimentos planejados.
    3. **Atendimentos**: Lista de atendimentos com data, procedimentos, valor total, status de pagamento e link direto.
    4. **Procedimentos**: Histórico consolidado de todos os procedimentos realizados no cliente com valores praticados.
    5. **Uso de Produtos**: Histórico de unidades físicas utilizadas no cliente (lote, serial, data, atendimento).
    6. **Prontuários**: Linha do tempo dos registros clínicos de cada atendimento.
    7. **Financeiro**: Extrato de pagamentos efetuados e parcelas PIX pendentes.
    8. **Anexos**: Galeria de fotos e documentos do cliente, com upload e download autenticado.

#### B. Agenda (`/agenda`)
- **Visualização**: Abas Mês, Semana, Dia, com navegação de período (Hoje, Anterior, Próximo).
- **Status do Agendamento**:
  - `Agendado` (Azul / Info)
  - `Confirmado` (Verde / Sucesso)
  - `Concluído` (Cinza / Muted)
  - `Cancelado` (Vermelho / Error)
  - `Não compareceu` (Amarelo / Warning)
  - `Reagendado` (Roxo / Secondary)
- **Modal "Novo Agendamento"**:
  - Seleção de Cliente (autocomplete por nome/CPF)
  - Data e Horário
  - Procedimentos planejados (seleção múltipla do catálogo com cálculo estimado automático de duração e valor)
  - Observações
- **Modal de Detalhes / Ações**:
  - Botão `"Confirmar Agendamento"` (muda status para Confirmado)
  - Botão `"Ir para o Atendimento"` (navega para o Atendimento pendente correspondente)
  - Botão `"Reagendar"`: Abre modal para escolher nova data/hora. Transforma o atual em `Reagendado`, cancela o atendimento pendente anterior, cria novo agendamento com novo atendimento pendente.
  - Botão `"Cancelar"`: Exige motivo do cancelamento. Marca agendamento como `Cancelado` e atendimento pendente como `Cancelado`.
  - Botão `"Marcar Não Compareceu"`: Marca como `Não compareceu` e cancela o atendimento pendente.

#### C. Atendimentos (`/atendimentos` and `/atendimentos/[id]`)
- **Lista de Atendimentos**:
  - Filtros: Status (`Pendente`, `Realizado`, `Cancelado`), Período, Cliente.
  - Colunas: Data, Cliente, Procedimento(s), Total, Situação de Pagamento, Status do Atendimento.
- **Painel de Atendimento Clínico (`/atendimentos/[id]`)**:
  - **Identificação**: Nome do Cliente, data/hora e link para o agendamento de origem.
  - **Procedimentos Realizados**:
    - Adicionar procedimento do catálogo: exibe `Valor Padrão` (snapshot imutável).
    - Campo editável independente: `Valor Praticado (R$)`.
    - Campo opcional: Observações do procedimento.
  - **Composição Financeira**:
    - Subtotal dos Procedimentos: $\sum \text{Valor Praticado}$
    - Campo editável: `Desconto do Atendimento (R$)`
    - **Total do Atendimento**: $\text{Subtotal} - \text{Desconto}$
    - **Total Pago**: $\sum \text{Pagamentos 'Pago'}$
    - **Saldo Devedor / A Receber**: $\text{Total} - \text{Total Pago}$
  - **Rastreabilidade de Produtos (Estoque)**:
    - Seleção de Unidade Física de Estoque por Serial (`UNIT-XXX`).
    - Exibe Produto, Lote, Validade e classificação (Reutilizável vs Uso Único).
    - Validação instantânea: impede seleção de unidade já usada por outro cliente ou segunda utilização de unidade descartável.
  - **Prontuário Clínico (1:1)**:
    - Campos: Queixa Principal, Avaliação Clínica, Conduta / Procedimentos Realizados, Orientações pós-procedimento.
  - **Anexos do Atendimento**:
    - Upload de fotos pré/pós e documentos clínicos vinculados estritamente ao atendimento.
  - **Pagamentos**:
    - Adicionar pagamento: Valor, Forma (Cartão de Crédito, PIX, Dinheiro, Débito).
    - Se Cartão de Crédito: Número de parcelas ($1..12$). Sem lembretes.
    - Se PIX: Opção de parcelamento com geração de datas de vencimento. Gera lembretes internos.
  - **Ação Final**:
    - Botão `"Concluir Atendimento"`: Altera status para `Realizado`, registra `completedAt`, valida preenchimento mínimo.

#### D. Produtos e Estoque (`/produtos`)
- **Catálogo de Produtos**: Nome, Marca, Categoria, Unidade de Medida, Classificação (Reutilizável / Uso Único), Status.
- **Gerenciamento de Lotes**: Número do Lote, Data de Validade, Data de Aquisição, Preço de Custo.
- **Unidades Físicas**: Lista de seriais por lote, com status (`Disponível`, `Em Uso`, `Esgotado`, `Descartado`) e cliente associado (quando aplicável).
- **Rastreabilidade**: Consulta de onde cada unidade foi utilizada (qual cliente, data e atendimento).

#### E. Financeiro (`/financeiro`)
- **Cards do Mês**: Receitas Realizadas, Despesas, Saldo Operacional.
- **Extrato de Atendimentos**: Tabela de pagamentos por atendimento com status e forma de pagamento.
- **Controle de Parcelas PIX**: Acompanhamento de parcelas a vencer e atrasadas.

#### F. Lembretes (`/lembretes`)
- **Abas**: Todos, Pendentes, Em Andamento, Concluídos, Atrasados.
- **Cards de Lembretes**:
  - Destaque para parcelas PIX com data de vencimento, cliente e valor da parcela.
  - Ação: `"Concluir Lembrete"` ou `"Dispensar"`.
  - Nota de interface explícita: *"Concluir um lembrete apenas atualiza seu status de aviso e não altera o status do pagamento no financeiro."*

---

## 7. Testing Infrastructure Requirements

### 7.1 Database Isolation & Test Environment
- **Dedicated Test Database**: Tests must execute against `PopoAppTest` on SQL Server LocalDB.
- **Connection String in Test Environment**:
  ```env
  DATABASE_URL="sqlserver://localhost;database=PopoAppTest;integratedSecurity=true;trustServerCertificate=true;instanceName=MSSQLLocalDB"
  SESSION_SECRET="test-session-secret-key-must-have-at-least-32-characters"
  NODE_ENV="test"
  ```
- **Safety Guard**: Test runner script checks `DATABASE_URL` before running tests. If the database name is `PopoApp` (development DB), the process aborts immediately to prevent test teardown from wiping development records.
- **Database Reset & Migration**:
  - Command: `npx prisma migrate deploy` creates the test database schema.
  - Test helper resets data between test suites using clean transactional rollbacks or table truncates ordered by foreign keys.

### 7.2 Test Runner Configuration
- In Next.js 15 / TypeScript, Vitest or Jest is configured as the official runner.
- **Package Script**:
  ```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
  ```
- **Single Command Verification**: Running `npm test` executes the complete automated test suite and reports zero failures.

### 7.3 Seed Data Requirements (§50)
The seed script (`prisma/seed.ts` and `npm run db:seed`) must populate realistic clinical data that exercises all domain constraints:
1. Admin user (`admin` / `PopoApp2024!`).
2. Clients with valid CPFs, emergency contacts, addresses, notes, and profile photos.
3. Appointments in all 6 statuses (`Agendado`, `Confirmado`, `Concluído`, `Cancelado`, `Não compareceu`, `Reagendado`).
4. At least one pair of rescheduled appointments (`original.status = 'Reagendado'`, `new.status = 'Agendado'`).
5. Procedure catalog with standard reference values (e.g. Toxina R$ 1500, Preenchimento R$ 2500, Limpeza R$ 350).
6. Product catalog with reusable items (e.g. Frasco de Toxina 100U) and single-use items (e.g. Seringa descartável).
7. Lotes and individual serial units (`UNIT-001`, `UNIT-002`, etc.).
8. Attendances with snapshot values and practiced values reflecting Examples A & B:
   - Example A: Standard R$ 500, Practiced R$ 400, Discount R$ 0.
   - Example B: Two procedures practiced R$ 800, Explicit discount R$ 100.
9. Product usage records:
   - Reusable unit used across 2 attendances for Client A (Example C).
10. Medical records (Prontuário) for completed attendances.
11. Multi-method payments: Credit card with 3 installments; PIX with 4 scheduled installments.
12. PIX installment reminders generated with status `pendente` and `atrasado`.
13. Client-level attachments and Attendance-level attachments (Example E).

### 7.4 Test Suite Tiers 1–4 Mapping

#### Tier 1 — Unit & Domain Logic Tests
- `cpf.spec.ts`: Validates CPF algorithm:
  - Valid CPF with dots/dash -> true.
  - Valid CPF clean 11 digits -> true.
  - All repeating digits (`111.111.111-11`, `000.000.000-00`) -> false.
  - Invalid check digits -> false.
  - Normalizer strips non-digits -> 11 digits.
- `financial-calculation.spec.ts`:
  - Computes Total = sum(practicedValue) - discount.
  - Computes Outstanding = Total - sum(paidPayments).
  - Asserts Example A: standard 500, practiced 400, discount 0 -> total 400, discount 0 (no automatic discount).
  - Asserts Example B: practiced 800, discount 100 -> total 700.
- `status-machine.spec.ts`:
  - Validates permissible appointment and attendance transitions.
  - Asserts `Em atendimento` is rejected as an Appointment status.
- `reminder-rule.spec.ts`:
  - Asserts PIX installment schedules generate reminders.
  - Asserts credit card payments generate 0 reminders.

#### Tier 2 — Database Integrity & Constraint Tests (against `PopoAppTest`)
*Maps directly to §32 Critical Validations and Acceptance Criteria:*
- **V1 / AC 62**: Duplicate CPF rejected by database unique constraint `UQ_Client_CPF`.
- **V2 / V3**: Appointment status must be in allowed list; `Em atendimento` rejected.
- **V4 / AC 57**: Rescheduling sets old appointment to `Reagendado` and creates new `Agendado` appointment.
- **V5 / V6 / V7**: Appointment 1:N Attendance; Attendance created as `Pendente`; never `Realizado` on appointment creation.
- **V8 / V9 / V12**: AttendanceProcedure preserves snapshot and independent practiced value; modifying catalog does not rewrite attendance history.
- **V10 / V11**: Practiced value delta is not an automatic discount; discount is explicit.
- **V13**: Client supports multiple emergency contacts.
- **V14 / AC 61**: Database rejects Attachment with both Client and Attendance, or neither (CHECK constraint test bypassing service layer).
- **V15 / V16 / AC 59**: Physical unit reuse:
  - Reusable unit used twice by same Client -> succeeds.
  - Reusable unit used by Client A then attempted by Client B -> rejected by server/database.
- **V17 / AC 59**: Single-use unit attempted to be used in a second attendance -> rejected by server/database.
- **V18**: ProductUsage must link to an individual `StockUnit`.
- **V19**: MedicalRecord enforces 1:1 with Attendance; second record rejected by unique constraint.
- **V20**: Attendance supports multiple payments.
- **V21 / V22 / V23 / AC 68**: Reminder tests: PIX creates reminders; Credit Card creates 0 reminders; completing reminder does not change payment status.

#### Tier 3 — Service & API Layer Integration Tests
- **Auth & Route Protection (AC 60)**:
  - Unauthenticated GET to `/api/attachments/[id]` -> 401.
  - Unauthenticated GET to `/agenda`, `/clientes`, `/atendimentos` -> redirects to `/login`.
  - Authenticated GET to `/api/attachments/[id]` -> streams file with `nosniff` header.
- **Attendance Cascade Lifecycle (AC 57, D1)**:
  - Cancelling Appointment -> linked pending Attendance moves to `Cancelado`.
  - Marking Appointment `Não compareceu` -> linked pending Attendance moves to `Cancelado`.
  - Rescheduling Appointment -> old pending Attendance moves to `Cancelado`; new Appointment gets new `Pendente` Attendance.
- **File Upload Service**:
  - Validates MIME type allowlist (rejects `.exe`, `.html`, `.svg`).
  - Verifies file is written outside `public/` directory with UUID filename.

#### Tier 4 — End-to-End Workflow & Acceptance Verification (AC 65–68)
- **Full Clinical Workflow (AC 65)**:
  1. Authenticate user (`admin`).
  2. Create Client with valid CPF, 2 emergency contacts, and profile photo.
  3. Create Appointment with planned procedures.
  4. Confirm appointment manually (`Confirmado`).
  5. Open linked Attendance (`Pendente`).
  6. Add 2 procedures with practiced values different from catalog standard.
  7. Apply explicit attendance discount.
  8. Record product usage of a reusable unit.
  9. Fill Prontuário clinical fields.
  10. Upload attendance attachment.
  11. Record payment plan: PIX installment schedule + partial credit card payment.
  12. Mark Attendance as `Realizado`.
  13. Reload and verify persistence: financial summary explicitly displays standard values, practiced values, discount, total, paid, and outstanding.
- **Cross-Client Conflict Verification (AC 66)**:
  - Attempting to record the same physical unit for a different Client displays clear Portuguese error: `"Esta unidade de estoque já está vinculada a outro cliente."` and is not saved.
- **Client Detail Derivation (AC 67)**:
  - Inspecting Client detail page confirms all appointments, attendances, procedures, product usage, medical records, payments, and attachments are correctly aggregated from real records.
- **Reminder & Dashboard Sync (AC 68)**:
  - PIX reminders appear on Lembretes page and Dashboard. Credit card has no reminders. Marking reminder done leaves payment status unchanged.

### 7.5 Definition of Done (DoD) Verification Criteria
A task is marked `[x]` in `IMPLEMENTATION_CHECKLIST.md` only when:
1. Concrete, working implementation exists in code.
2. Integrated seamlessly into surrounding fullstack architecture.
3. Server-side validation and database constraints are active.
4. User interface exists with responsive layout and Portuguese text.
5. Backed by automated passing tests in the test suite.
6. Zero mock imports (`src/data/mock`) remain in authenticated routes.
7. `npm test`, `npm run build`, `npm run lint`, and `npm run db:seed` pass with zero errors.

---

## 8. Cross-Module Interfaces and Architectural Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│  - Next.js 15 App Router ((authenticated), login, api)                 │
│  - React 19 Client Components + Radix UI + Tailwind CSS                │
│  - Form validation: React Hook Form + Zod                              │
│  - Localization: src/i18n/pt-BR.ts                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Server Actions / API Routes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DOMAIN & SERVICE LAYER                          │
│  - ClientService       (CPF validation, emergency contacts, photos)    │
│  - AppointmentService  (Scheduling, status machine, rescheduling)      │
│  - AttendanceService   (Lifecycle, procedure pricing, discount, total) │
│  - InventoryService    (Lots, stock units, same-client/single-use)     │
│  - MedicalRecordService(Clinical Prontuário 1:1)                       │
│  - PaymentService      (Multi-method, credit installments, PIX)        │
│  - ReminderService     (PIX installment due-dates, done/dismiss)      │
│  - StorageService      (MIME verify, isolated disk storage, streaming) │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼                                  ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│       SESSION & SECURITY LAYER       │   │   DATA ACCESS LAYER         │
│  - iron-session cookie verification  │   │  - Prisma Client 6          │
│  - Route protection (middleware.ts)  │   │  - Transactions ($transaction│
│  - bcrypt password hashing           │   │  - LocalDB / PopoAppTest    │
└──────────────────────────────────────┘   └─────────────────────────────┘
```

### 8.1 Module Contracts & Dependency Rules
1. **Attendance -> Appointment**:
   - Attendance holds a foreign key to `Appointment`.
   - Appointment status updates (Cancel, Reschedule, No-Show) trigger service transactions that update linked pending Attendances.
   - Creating an Appointment creates an Attendance (`Pendente`).
2. **Attendance -> Procedure (Technical Line-Item)**:
   - Attendance does NOT reference a "PerformedProcedure" entity. It uses `AttendanceProcedure`.
   - Captures `standardValueSnapshot` and `practicedValue`.
   - Changing the catalog `Procedure` standard price NEVER modifies `AttendanceProcedure` records.
3. **Attendance -> Inventory**:
   - `ProductUsage` links `Attendance` to `StockUnit`.
   - Service transaction checks:
     - If `StockUnit.currentClientId` is null -> assign to `Attendance.clientId` and set status `EmUso`.
     - If `StockUnit.currentClientId` != `Attendance.clientId` -> REJECT (Cross-client reuse).
     - If `Product.isReusable == false` and `StockUnit.usages.length > 0` -> REJECT (Single-use reuse).
4. **Attendance -> Payments -> Reminders**:
   - Payments belong to Attendance.
   - PIX payment creates `PixInstallment` records.
   - `PixInstallment` creation triggers `ReminderService.createPixReminders()`.
   - Reminders are read projections: updating Reminder status NEVER mutates Payment or PixInstallment records.
5. **Storage -> Entities**:
   - `Attachment` table has nullable `clientId` and `attendanceId`.
   - Database constraint ensures exactly one is populated.
   - Physical files are strictly isolated from web-accessible directories.

---

## 9. Conclusion & Implementation Readiness

This specification provides the exhaustive, binding blueprint for architecture, schema, security, storage, Portuguese UX, and automated test infrastructure. All 24 critical validations, 5 data integrity examples (A–E), binding business decisions (D1–D7), and acceptance criteria have been fully mapped to concrete database fields, service invariants, and test assertions.
