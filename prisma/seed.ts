import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Deterministically generates a mathematically valid CPF for seed fixtures
 * based strictly on Receita Federal MOD 11 rules.
 */
function generateValidCpf(seedNumber = 1): string {
  const base = String(seedNumber).padStart(8, '0').slice(-8);
  const prefix = `9${base}`; // 9 digits

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(prefix.charAt(i), 10) * (10 - i);
  }
  let d1 = (sum1 * 10) % 11;
  if (d1 === 10 || d1 === 11) d1 = 0;

  const prefixWithD1 = `${prefix}${d1}`;
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(prefixWithD1.charAt(i), 10) * (11 - i);
  }
  let d2 = (sum2 * 10) % 11;
  if (d2 === 10 || d2 === 11) d2 = 0;

  return `${prefixWithD1}${d2}`;
}

/**
 * Cleans the development database in reverse foreign-key dependency order
 * to ensure complete idempotency on repeated seed runs.
 */
async function cleanDatabase(): Promise<void> {
  console.log('Cleaning existing seed data from PopoApp database...');

  // Break self-referencing and circular foreign key constraints
  await prisma.$executeRawUnsafe(
    'UPDATE [Appointment] SET [rescheduledFromId] = NULL, [rescheduledToId] = NULL'
  );
  await prisma.$executeRawUnsafe('UPDATE [Client] SET [profilePhotoId] = NULL');
  await prisma.$executeRawUnsafe('UPDATE [StockUnit] SET [currentClientId] = NULL');
  await prisma.$executeRawUnsafe('UPDATE [FinancialMovement] SET [reversedFromId] = NULL');
  await prisma.$executeRawUnsafe('UPDATE [InventoryMovement] SET [reversedFromId] = NULL');

  const tablesInOrder = [
    'FinancialMovement',
    'FinancialSettlement',
    'FinancialObligation',
    'Reminder',
    'ReminderRecurrence',
    'PixInstallment',
    'Payment',
    'InventoryMovement',
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
    await prisma.$executeRawUnsafe(`DELETE FROM [${table}]`);
  }

  console.log('Existing tables cleaned successfully.');
}

async function main() {
  console.log('=== Starting PopoApp Comprehensive Clinical Seed (Phase 15 / F28) ===');

  // Step 0: Ensure idempotency by resetting previous seed records
  await cleanDatabase();

  // Step 1: Storage directory and sample attachment files
  const storageDir = path.resolve(process.cwd(), 'storage', 'uploads');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const sampleTermoPath = path.join(storageDir, 'uuid-termo-mariana-seed.pdf');
  const sampleFotoPath = path.join(storageDir, 'uuid-foto-labios-antes-seed.jpg');
  if (!fs.existsSync(sampleTermoPath)) {
    fs.writeFileSync(sampleTermoPath, '%PDF-1.4 Termo de Consentimento Livre e Esclarecido PopoApp Seed');
  }
  if (!fs.existsSync(sampleFotoPath)) {
    fs.writeFileSync(sampleFotoPath, 'JPEG_SAMPLE_IMAGE_DATA_POPOAPP_SEED');
  }

  // Step 2: Admin User
  console.log('Seeding Admin user...');
  const passwordHash = await bcrypt.hash('PopoApp2024!', 12);
  const adminUser = await prisma.user.create({
    data: {
      nickname: 'admin',
      displayName: 'Dra. Emanuelle Noronha Popowicz',
      passwordHash,
      isActive: true,
    },
  });
  console.log(`Created admin user: ${adminUser.nickname} (${adminUser.displayName})`);

  // Step 3: Aesthetic Procedures across clinical categories
  console.log('Seeding Aesthetic Procedures catalog...');
  const procBotox = await prisma.procedure.create({
    data: {
      nome: 'Toxina Botulínica - Terço Superior',
      descricao: 'Aplicação de toxina botulínica no terço superior da face (fronte, glabela e periorbital) para atenuação de rugas dinâmicas.',
      valorPadrao: 500.0, // Standard value R$ 500.00 (per §47 Example A)
      duracaoMinutos: 45,
      categoria: 'Injetáveis',
      isActive: true,
    },
  });

  const procLabial = await prisma.procedure.create({
    data: {
      nome: 'Preenchimento Labial com Ácido Hialurônico',
      descricao: 'Escultura e volumização labial com ácido hialurônico reticulado, definição de contorno e arco do cupido.',
      valorPadrao: 1200.0,
      duracaoMinutos: 60,
      categoria: 'Injetáveis',
      isActive: true,
    },
  });

  const procBioestimulador = await prisma.procedure.create({
    data: {
      nome: 'Bioestimulador de Colágeno (Radiesse)',
      descricao: 'Bioestimulação de colágeno à base de hidroxiapatita de cálcio para melhora da firmeza e combate à flacidez dérmica.',
      valorPadrao: 1800.0,
      duracaoMinutos: 60,
      categoria: 'Injetáveis',
      isActive: true,
    },
  });

  const procLimpeza = await prisma.procedure.create({
    data: {
      nome: 'Limpeza de Pele Profunda com Extração',
      descricao: 'Higienização facial profunda com emoliência, extração de comedões, alta frequência e máscara calmante.',
      valorPadrao: 250.0,
      duracaoMinutos: 90,
      categoria: 'Facial',
      isActive: true,
    },
  });

  const procPeeling = await prisma.procedure.create({
    data: {
      nome: 'Peeling Químico Renovador (Ácido Glicólico)',
      descricao: 'Renovação celular e uniformização do tom da pele através de esfoliação química controlada.',
      valorPadrao: 350.0,
      duracaoMinutos: 45,
      categoria: 'Facial',
      isActive: true,
    },
  });

  const procMicroagulhamento = await prisma.procedure.create({
    data: {
      nome: 'Microagulhamento com Drug Delivery',
      descricao: 'Indução percutânea de colágeno associada à permeação de fatores de crescimento e ácido hialurônico estéril.',
      valorPadrao: 600.0,
      duracaoMinutos: 60,
      categoria: 'Facial',
      isActive: true,
    },
  });

  const procDrenagem = await prisma.procedure.create({
    data: {
      nome: 'Drenagem Linfática Corporal Manual',
      descricao: 'Técnica manual especializada para redução de edemas e retenção hídrica corporal.',
      valorPadrao: 180.0,
      duracaoMinutos: 60,
      categoria: 'Corporal',
      isActive: true,
    },
  });

  const procCriolipolise = await prisma.procedure.create({
    data: {
      nome: 'Criolipólise de Placas',
      descricao: 'Redução não invasiva de gordura localizada por congelamento seletivo de adipócitos.',
      valorPadrao: 850.0,
      duracaoMinutos: 90,
      categoria: 'Corporal',
      isActive: true,
    },
  });

  const procRinomodelacao = await prisma.procedure.create({
    data: {
      nome: 'Harmonização Facial - Rinomodelação',
      descricao: 'Correção sutil do dorso e ponta nasal utilizando preenchedor biocompatível de alta viscoelasticidade.',
      valorPadrao: 1500.0,
      duracaoMinutos: 60,
      categoria: 'Injetáveis',
      isActive: true,
    },
  });

  const procCapilar = await prisma.procedure.create({
    data: {
      nome: 'Terapia Capilar com Microinfusão (MMP)',
      descricao: 'Infusão controlada de ativos estéreis no couro cabeludo para estímulo folicular.',
      valorPadrao: 450.0,
      duracaoMinutos: 45,
      categoria: 'Capilar',
      isActive: true,
    },
  });
  console.log('Procedures seeded (10 clinical items across Facial, Corporal, Injetáveis, Capilar).');

  // Step 4: Products, Stock Lots, and Individual Stock Units
  console.log('Seeding Products, Lots, and Traceable Stock Units...');
  // Product 1: Reusable product per §15 & §47 Example C
  const prodBotox = await prisma.product.create({
    data: {
      nome: 'Botox 100U Frasco Multidose',
      categoria: 'Toxinas',
      marca: 'Allergan',
      unidade: 'frasco',
      isReusable: true, // Reusable by the SAME client per §15
      isActive: true,
      descricao: 'Toxina botulínica A liofilizada em frasco multidose estéril para reconstituição.',
    },
  });

  const lotBotoxA = await prisma.productLot.create({
    data: {
      productId: prodBotox.id,
      numeroLote: 'LOT-BTX-2026-A',
      dataValidade: new Date('2027-06-30'),
      dataAquisicao: new Date('2026-01-15'),
      precoCusto: 650.0,
      observacoes: 'Lote principal de toxina botulínica mantido sob refrigeração de 2°C a 8°C.',
    },
  });

  // Reusable unit UNIT-001 (used in Example C)
  const unitBotox001 = await prisma.stockUnit.create({
    data: {
      lotId: lotBotoxA.id,
      codigoSerial: 'UNIT-001',
      status: 'EmUso', // In use by Client A (Mariana)
    },
  });

  const unitBotox002 = await prisma.stockUnit.create({
    data: {
      lotId: lotBotoxA.id,
      codigoSerial: 'UNIT-BTX-002',
      status: 'Disponivel',
    },
  });

  const unitBotox003 = await prisma.stockUnit.create({
    data: {
      lotId: lotBotoxA.id,
      codigoSerial: 'UNIT-BTX-003',
      status: 'Disponivel',
    },
  });

  // Product 2: Single-use product per §15
  const prodKysse = await prisma.product.create({
    data: {
      nome: 'Restylane Kysse 1ml',
      categoria: 'Preenchedores',
      marca: 'Galderma',
      unidade: 'seringa',
      isReusable: false, // Single-use!
      isActive: true,
      descricao: 'Gel estéril de ácido hialurônico com lidocaína específico para volumização e contorno labial.',
    },
  });

  const lotKysse = await prisma.productLot.create({
    data: {
      productId: prodKysse.id,
      numeroLote: 'LOT-KYS-9921',
      dataValidade: new Date('2027-12-31'),
      dataAquisicao: new Date('2026-02-10'),
      precoCusto: 420.0,
      observacoes: 'Armazenado ao abrigo da luz solar e calor.',
    },
  });

  const unitKys001 = await prisma.stockUnit.create({
    data: {
      lotId: lotKysse.id,
      codigoSerial: 'UNIT-KYS-001',
      status: 'Disponivel',
    },
  });

  const unitKys002 = await prisma.stockUnit.create({
    data: {
      lotId: lotKysse.id,
      codigoSerial: 'UNIT-KYS-002',
      status: 'Disponivel',
    },
  });

  const unitKys003 = await prisma.stockUnit.create({
    data: {
      lotId: lotKysse.id,
      codigoSerial: 'UNIT-KYS-003',
      status: 'Disponivel',
    },
  });

  // Product 3: Bioestimulador (Single-use)
  const prodRadiesse = await prisma.product.create({
    data: {
      nome: 'Radiesse Duo 1.5ml',
      categoria: 'Bioestimuladores',
      marca: 'Merz',
      unidade: 'seringa',
      isReusable: false,
      isActive: true,
      descricao: 'Seringa preenchida com hidroxiapatita de cálcio em gel carreador.',
    },
  });

  const lotRadiesse = await prisma.productLot.create({
    data: {
      productId: prodRadiesse.id,
      numeroLote: 'LOT-RAD-4410',
      dataValidade: new Date('2027-08-30'),
      dataAquisicao: new Date('2026-03-01'),
      precoCusto: 780.0,
    },
  });

  const unitRad001 = await prisma.stockUnit.create({
    data: {
      lotId: lotRadiesse.id,
      codigoSerial: 'UNIT-RAD-001',
      status: 'Disponivel',
    },
  });

  const unitRad002 = await prisma.stockUnit.create({
    data: {
      lotId: lotRadiesse.id,
      codigoSerial: 'UNIT-RAD-002',
      status: 'Disponivel',
    },
  });

  // Product 4: Peeling Kit (Reusable)
  const prodPeelingKit = await prisma.product.create({
    data: {
      nome: 'Kit Peeling Ácido Glicólico 70%',
      categoria: 'Peelings',
      marca: 'Dermage',
      unidade: 'frasco',
      isReusable: true,
      isActive: true,
    },
  });

  const lotPeeling = await prisma.productLot.create({
    data: {
      productId: prodPeelingKit.id,
      numeroLote: 'LOT-GLY-1088',
      dataValidade: new Date('2028-01-31'),
      precoCusto: 150.0,
    },
  });

  await prisma.stockUnit.create({
    data: {
      lotId: lotPeeling.id,
      codigoSerial: 'UNIT-GLY-001',
      status: 'Disponivel',
    },
  });

  // Product 5: Expired lot example (to preserve boundary realism for V15)
  const prodAgulhas = await prisma.product.create({
    data: {
      nome: 'Agulhas 30G 4mm (Caixa 100 un)',
      categoria: 'Descartáveis',
      marca: 'BD',
      unidade: 'caixa',
      isReusable: false,
      isActive: true,
    },
  });

  const lotAgulhasExp = await prisma.productLot.create({
    data: {
      productId: prodAgulhas.id,
      numeroLote: 'LOT-AGU-2025-EXP',
      dataValidade: new Date('2025-01-01'), // Expired!
      precoCusto: 80.0,
      observacoes: 'Lote expirado mantido para rastreabilidade histórica e controle de bloqueio.',
    },
  });

  await prisma.stockUnit.create({
    data: {
      lotId: lotAgulhasExp.id,
      codigoSerial: 'UNIT-AGU-EXP-01',
      status: 'Disponivel',
    },
  });

  // Associate procedures with catalog products
  await prisma.procedureProduct.createMany({
    data: [
      { procedureId: procBotox.id, productId: prodBotox.id },
      { procedureId: procLabial.id, productId: prodKysse.id },
      { procedureId: procBioestimulador.id, productId: prodRadiesse.id },
      { procedureId: procPeeling.id, productId: prodPeelingKit.id },
    ],
  });
  console.log('Products, lots, stock units and procedure-product associations seeded.');

  // Step 5: Realistic Clinical Clients with Valid MOD 11 CPFs & Emergency Contacts
  console.log('Seeding Clients with valid CPFs and emergency contacts...');

  // Client 1 (Client A - Examples A, C, D, E)
  const clientMariana = await prisma.client.create({
    data: {
      nome: 'Mariana Silva Castro',
      cpf: generateValidCpf(101), // 90000010138 (valid MOD 11)
      telefone: '(11) 98765-4321',
      email: 'mariana.castro@exemplo.com.br',
      dataNascimento: new Date('1988-04-12'),
      endereco: 'Av. Paulista, 1500, Apto 82, Bela Vista, São Paulo - SP',
      observacoes: 'Paciente adepta de tratamentos preventivos. Relata leve sensibilidade a anestésicos tópicos.',
      status: 'ativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Carlos Castro',
            telefone: '(11) 98111-2233',
            parentesco: 'Cônjuge',
            observacoes: 'Ligar preferencialmente após as 18h',
            isActive: true,
          },
          {
            nome: 'Helena Silva',
            telefone: '(11) 97222-3344',
            parentesco: 'Mãe',
            isActive: true,
          },
        ],
      },
    },
  });

  // Link Mariana as the current client for reusable unit UNIT-001 (Example C)
  await prisma.stockUnit.update({
    where: { id: unitBotox001.id },
    data: { currentClientId: clientMariana.id },
  });

  // Client 2 (Client B - Example B)
  const clientBeatriz = await prisma.client.create({
    data: {
      nome: 'Beatriz Rocha Mendes',
      cpf: generateValidCpf(102), // 90000010219 (valid MOD 11)
      telefone: '(11) 97654-3210',
      email: 'beatriz.rocha@exemplo.com.br',
      dataNascimento: new Date('1994-08-25'),
      endereco: 'Rua Oscar Freire, 920, Cerqueira César, São Paulo - SP',
      observacoes: 'Interesse em harmonização e preenchimento labial sutil. Sem alergias conhecidas.',
      status: 'ativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Lucas Mendes',
            telefone: '(11) 99888-7766',
            parentesco: 'Irmão',
            isActive: true,
          },
        ],
      },
    },
  });

  // Client 3 (Client C - PIX installment schedule & in-app reminders)
  const clientJuliana = await prisma.client.create({
    data: {
      nome: 'Juliana Albuquerque Ferreira',
      cpf: generateValidCpf(103), // 90000010308 (valid MOD 11)
      telefone: '(21) 99123-4567',
      email: 'juliana.af@exemplo.com.br',
      dataNascimento: new Date('1982-11-03'),
      endereco: 'Rua Visconde de Pirajá, 440, Ipanema, Rio de Janeiro - RJ',
      observacoes: 'Tratamento continuado de bioestimulação e drenagem corporal.',
      status: 'ativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Roberto Ferreira',
            telefone: '(21) 98777-6655',
            parentesco: 'Esposo',
            isActive: true,
          },
        ],
      },
    },
  });

  // Client 4 (Client D - Credit card installments)
  const clientFernanda = await prisma.client.create({
    data: {
      nome: 'Fernanda Lima Vasconcelos',
      cpf: generateValidCpf(104), // 90000010480 (valid MOD 11)
      telefone: '(11) 98234-5678',
      email: 'fernanda.lima@exemplo.com.br',
      dataNascimento: new Date('1991-02-18'),
      endereco: 'Rua Haddock Lobo, 1307, Jardins, São Paulo - SP',
      observacoes: 'Plano de tratamento facial anual.',
      status: 'ativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Patrícia Lima',
            telefone: '(11) 97111-0022',
            parentesco: 'Irmã',
            isActive: true,
          },
        ],
      },
    },
  });

  // Client 5 (Client E - Upcoming scheduled calendar appointments)
  const clientCamila = await prisma.client.create({
    data: {
      nome: 'Camila Nogueira Duarte',
      cpf: generateValidCpf(105), // 90000010561 (valid MOD 11)
      telefone: '(11) 99345-6789',
      email: 'camila.duarte@exemplo.com.br',
      dataNascimento: new Date('1996-07-30'),
      endereco: 'Rua dos Pinheiros, 700, Pinheiros, São Paulo - SP',
      observacoes: 'Primeira consulta avaliativa de rejuvenescimento facial.',
      status: 'ativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Marcos Duarte',
            telefone: '(11) 99555-4433',
            parentesco: 'Pai',
            isActive: true,
          },
        ],
      },
    },
  });

  // Client 6 (Inactive client for status filter and soft-deactivation realism)
  const clientPatricia = await prisma.client.create({
    data: {
      nome: 'Patrícia Souza Gomes',
      cpf: generateValidCpf(106), // 90000010642 (valid MOD 11)
      telefone: '(11) 98456-7890',
      email: 'patricia.souza@exemplo.com.br',
      dataNascimento: new Date('1979-05-14'),
      endereco: 'Rua Pamplona, 450, Jardim Paulista, São Paulo - SP',
      observacoes: 'Mudou-se para o exterior em janeiro/2026. Cadastro inativo mantido para preservação do histórico clínico.',
      status: 'inativo',
      emergencyContacts: {
        create: [
          {
            nome: 'Renato Gomes',
            telefone: '(11) 98444-1122',
            parentesco: 'Esposo',
            isActive: false,
          },
        ],
      },
    },
  });
  console.log('Clients seeded (6 clients with valid CPFs, emergency contacts, addresses, notes).');

  // Step 6: Reproducing §47 Examples A through E
  console.log('Seeding Workflows reproducing §47 Examples A–E...');

  // -------------------------------------------------------------
  // EXAMPLE A (§47): Procedure practiced below standard value (no automatic discount)
  // Standard: R$ 500.00, Practiced: R$ 400.00, Explicit discount: R$ 0.00.
  // -------------------------------------------------------------
  const apptA = await prisma.appointment.create({
    data: {
      clientId: clientMariana.id,
      dataHora: new Date('2026-09-10T14:00:00Z'),
      status: 'Concluído',
      valorEstimado: 500.0,
      observacoes: 'Aplicação de toxina botulínica no terço superior acordada com valor promocional.',
      plannedProcedures: {
        create: [{ procedureId: procBotox.id, ordem: 0 }],
      },
    },
  });

  const attA = await prisma.attendance.create({
    data: {
      appointmentId: apptA.id,
      clientId: clientMariana.id,
      dataHora: new Date('2026-09-10T14:00:00Z'),
      completedAt: new Date('2026-09-10T14:45:00Z'),
      status: 'Realizado',
      desconto: 0.0, // Strictly R$ 0.00 explicit discount per Example A
      observacoes: 'Atendimento Exemplo A: valor praticado de R$ 400 abaixo do padrão de R$ 500 sem gerar desconto automático.',
    },
  });

  await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attA.id,
      procedureId: procBotox.id,
      standardValueSnapshot: 500.0, // Standard snapshot R$ 500.00
      practicedValue: 400.0, // Practiced value R$ 400.00
      observacoes: 'Valor promocional acordado para pacote inicial.',
    },
  });

  await prisma.payment.create({
    data: {
      attendanceId: attA.id,
      valor: 400.0,
      metodo: 'Pix',
      status: 'Pago',
      dataPagamento: new Date('2026-09-10T14:45:00Z'),
      identificadorTransacao: 'PIX-EXP-A-001',
      observacoes: 'Pagamento total via PIX no encerramento da consulta.',
    },
  });

  await prisma.medicalRecord.create({
    data: {
      attendanceId: attA.id,
      queixaPrincipal: 'Linhas de expressão frontais e glabelares acentuadas à contração.',
      avaliacaoClinica: 'Pele fototipo II, tônus preservado, rugas dinâmicas moderadas no terço superior.',
      condutaProcedimento: 'Aplicação de 50U de toxina botulínica nos pontos clássicos da fronte, glabela e periorbital.',
      orientacoes: 'Não massagear a região tratada; não deitar ou praticar atividade física nas próximas 4 horas.',
      observacoes: 'Procedimento bem tolerado sem intercorrências imediatas.',
    },
  });
  console.log('Example A seeded: Attendance with practiced R$ 400, standard snapshot R$ 500, explicit discount R$ 0.00.');

  // -------------------------------------------------------------
  // EXAMPLE B (§47): Explicit Attendance discount with multi-method payment settling account
  // Practiced Total: R$ 800.00 (500 + 300), Explicit discount: R$ 100.00 -> Net: R$ 700.00
  // Payments: R$ 300 Dinheiro + R$ 400 Cartão de Débito -> Paid: R$ 700.00, Outstanding: R$ 0.00
  // -------------------------------------------------------------
  const apptB = await prisma.appointment.create({
    data: {
      clientId: clientBeatriz.id,
      dataHora: new Date('2026-09-15T10:00:00Z'),
      status: 'Concluído',
      valorEstimado: 800.0,
      observacoes: 'Procedimento combinado de preenchimento labial e peeling facial.',
    },
  });

  const attB = await prisma.attendance.create({
    data: {
      appointmentId: apptB.id,
      clientId: clientBeatriz.id,
      dataHora: new Date('2026-09-15T10:00:00Z'),
      completedAt: new Date('2026-09-15T11:15:00Z'),
      status: 'Realizado',
      desconto: 100.0, // Explicit Attendance discount R$ 100.00
      observacoes: 'Atendimento Exemplo B: desconto explícito de R$ 100 concedido sobre a soma praticada de R$ 800.',
    },
  });

  await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attB.id,
      procedureId: procLabial.id,
      standardValueSnapshot: 1200.0,
      practicedValue: 500.0, // Practiced value 1: R$ 500.00
      observacoes: 'Valor promocional no combo estético.',
    },
  });

  await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attB.id,
      procedureId: procPeeling.id,
      standardValueSnapshot: 350.0,
      practicedValue: 300.0, // Practiced value 2: R$ 300.00
      observacoes: 'Peeling glicólico de renovação facial.',
    },
  });

  // Multi-method payment: R$ 300 Dinheiro + R$ 400 CartaoDebito
  await prisma.payment.create({
    data: {
      attendanceId: attB.id,
      valor: 300.0,
      metodo: 'Dinheiro',
      status: 'Pago',
      dataPagamento: new Date('2026-09-15T11:15:00Z'),
      observacoes: 'Entrada em espécie de R$ 300.',
    },
  });

  await prisma.payment.create({
    data: {
      attendanceId: attB.id,
      valor: 400.0,
      metodo: 'CartaoDebito',
      status: 'Pago',
      dataPagamento: new Date('2026-09-15T11:18:00Z'),
      identificadorTransacao: 'DEB-EXP-B-002',
      observacoes: 'Complemento de R$ 400 no cartão de débito liquidando integralmente o saldo devedor.',
    },
  });

  await prisma.medicalRecord.create({
    data: {
      attendanceId: attB.id,
      queixaPrincipal: 'Lábio superior com pouca definição e manchas superficiais na face.',
      avaliacaoClinica: 'Pele com fotodano leve; anatomia labial favorável à volumização delicada.',
      condutaProcedimento: 'Volumização labial com 1ml de ácido hialurônico e aplicação de peeling glicólico 70%.',
      orientacoes: 'Aplicar compressas frias nos lábios; protetor solar FPS 50 a cada 3 horas.',
    },
  });
  console.log('Example B seeded: Practiced total R$ 800, explicit discount R$ 100, settled via Dinheiro R$ 300 + Débito R$ 400.');

  // -------------------------------------------------------------
  // EXAMPLE C (§47): Reusable physical product allowed for same client
  // Unit UNIT-001 used by Client Mariana in Attendance C1, then reused in Attendance C2
  // -------------------------------------------------------------
  const apptC1 = await prisma.appointment.create({
    data: {
      clientId: clientMariana.id,
      dataHora: new Date('2026-08-01T15:00:00Z'),
      status: 'Concluído',
      valorEstimado: 500.0,
      observacoes: 'Primeira sessão do frasco de toxina botulínica.',
    },
  });

  const attC1 = await prisma.attendance.create({
    data: {
      appointmentId: apptC1.id,
      clientId: clientMariana.id,
      dataHora: new Date('2026-08-01T15:00:00Z'),
      completedAt: new Date('2026-08-01T15:45:00Z'),
      status: 'Realizado',
      desconto: 0.0,
    },
  });

  const attProcC1 = await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attC1.id,
      procedureId: procBotox.id,
      standardValueSnapshot: 500.0,
      practicedValue: 500.0,
    },
  });

  await prisma.productUsage.create({
    data: {
      attendanceId: attC1.id,
      stockUnitId: unitBotox001.id,
      attendanceProcedureId: attProcC1.id,
      dataHora: new Date('2026-08-01T15:20:00Z'),
      observacoes: 'Primeira aplicação de 50U do frasco UNIT-001 na paciente Mariana.',
    },
  });

  // Second appointment for Mariana reusing the same UNIT-001
  const apptC2 = await prisma.appointment.create({
    data: {
      clientId: clientMariana.id,
      dataHora: new Date('2026-08-16T15:30:00Z'),
      status: 'Concluído',
      valorEstimado: 250.0,
      observacoes: 'Retoque de 15 dias com o frasco remanescente.',
    },
  });

  const attC2 = await prisma.attendance.create({
    data: {
      appointmentId: apptC2.id,
      clientId: clientMariana.id,
      dataHora: new Date('2026-08-16T15:30:00Z'),
      completedAt: new Date('2026-08-16T16:00:00Z'),
      status: 'Realizado',
      desconto: 0.0,
    },
  });

  const attProcC2 = await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attC2.id,
      procedureId: procBotox.id,
      standardValueSnapshot: 500.0,
      practicedValue: 250.0,
    },
  });

  await prisma.productUsage.create({
    data: {
      attendanceId: attC2.id,
      stockUnitId: unitBotox001.id,
      attendanceProcedureId: attProcC2.id,
      dataHora: new Date('2026-08-16T15:45:00Z'),
      observacoes: 'Retoque de 20U utilizando o mesmo frasco UNIT-001 (reutilização pela mesma cliente permitida por §15).',
    },
  });
  console.log('Example C seeded: Reusable unit UNIT-001 traced across 2 Attendances for same client Mariana.');

  // -------------------------------------------------------------
  // EXAMPLE D (§47): Rescheduling workflow preserving historical linkage
  // Original Appointment status = 'Reagendado', original Attendance = 'Cancelado'.
  // New Appointment status = 'Agendado', new Attendance = 'Pendente'.
  // -------------------------------------------------------------
  const apptDOrig = await prisma.appointment.create({
    data: {
      clientId: clientMariana.id,
      dataHora: new Date('2026-10-05T09:00:00Z'),
      status: 'Reagendado',
      valorEstimado: 600.0,
      motivoCancelamento: 'Paciente em viagem de trabalho solicitou reagendamento para a semana seguinte.',
      observacoes: 'Horário original desmarcado e transferido para 12/10/2026.',
    },
  });

  // Associated attendance was automatically cancelled per D1
  await prisma.attendance.create({
    data: {
      appointmentId: apptDOrig.id,
      clientId: clientMariana.id,
      dataHora: new Date('2026-10-05T09:00:00Z'),
      status: 'Cancelado',
      observacoes: 'Atendimento cancelado em decorrência do reagendamento do agendamento de origem.',
    },
  });

  // New appointment created for the new date
  const apptDNew = await prisma.appointment.create({
    data: {
      clientId: clientMariana.id,
      dataHora: new Date('2026-10-12T14:30:00Z'),
      status: 'Agendado',
      valorEstimado: 600.0,
      rescheduledFromId: apptDOrig.id,
      observacoes: 'Novo agendamento derivado do reagendamento da consulta de 05/10/2026.',
    },
  });

  // Associated pending attendance for the new appointment per D1
  await prisma.attendance.create({
    data: {
      appointmentId: apptDNew.id,
      clientId: clientMariana.id,
      dataHora: new Date('2026-10-12T14:30:00Z'),
      status: 'Pendente',
      observacoes: 'Atendimento pendente para a nova data reagendada.',
    },
  });

  // Link original appointment to the new appointment
  await prisma.appointment.update({
    where: { id: apptDOrig.id },
    data: { rescheduledToId: apptDNew.id },
  });
  console.log('Example D seeded: Original appointment Reagendado linked to new appointment Agendado.');

  // -------------------------------------------------------------
  // EXAMPLE E (§47): Client vs Attendance attachment exclusivity
  // Client attachment (clientId non-null, attendanceId null)
  // Attendance attachment (attendanceId non-null, clientId null)
  // Respecting SQL Server CHECK constraint CK_Attachment_Ownership
  // -------------------------------------------------------------
  await prisma.attachment.create({
    data: {
      clientId: clientMariana.id,
      attendanceId: null, // Strictly null!
      nomeOriginal: 'termo_consentimento_geral_mariana.pdf',
      nomeArquivo: 'uuid-termo-mariana-seed.pdf',
      caminhoRelativo: './storage/uploads/uuid-termo-mariana-seed.pdf',
      mimeType: 'application/pdf',
      tamanhoBytes: 245760,
      categoria: 'termo',
    },
  });

  await prisma.attachment.create({
    data: {
      clientId: null, // Strictly null!
      attendanceId: attB.id,
      nomeOriginal: 'foto_labios_antes_procedimento.jpg',
      nomeArquivo: 'uuid-foto-labios-antes-seed.jpg',
      caminhoRelativo: './storage/uploads/uuid-foto-labios-antes-seed.jpg',
      mimeType: 'image/jpeg',
      tamanhoBytes: 1048576,
      categoria: 'clinico',
    },
  });
  console.log('Example E seeded: Client-level and Attendance-level attachments adhering to exclusivity constraint.');

  // Step 7: PIX Installment Schedules and Child PixInstallment Records
  console.log('Seeding PIX installment schedule with child records...');
  const apptJ = await prisma.appointment.create({
    data: {
      clientId: clientJuliana.id,
      dataHora: new Date('2026-09-20T16:00:00Z'),
      status: 'Concluído',
      valorEstimado: 1800.0,
      observacoes: 'Aplicação de bioestimulador de colágeno corporal.',
    },
  });

  const attJ = await prisma.attendance.create({
    data: {
      appointmentId: apptJ.id,
      clientId: clientJuliana.id,
      dataHora: new Date('2026-09-20T16:00:00Z'),
      completedAt: new Date('2026-09-20T17:00:00Z'),
      status: 'Realizado',
      desconto: 0.0,
    },
  });

  await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attJ.id,
      procedureId: procBioestimulador.id,
      standardValueSnapshot: 1800.0,
      practicedValue: 1800.0,
    },
  });

  const paymentPix = await prisma.payment.create({
    data: {
      attendanceId: attJ.id,
      valor: 1800.0,
      metodo: 'Pix',
      status: 'Pendente', // In progress across installments
      numeroParcelas: 3,
      observacoes: 'Parcelamento em 3x no PIX quinzenal/mensal.',
    },
  });

  const pixInst1 = await prisma.pixInstallment.create({
    data: {
      paymentId: paymentPix.id,
      numeroParcela: 1,
      totalParcelas: 3,
      valor: 600.0,
      dataVencimento: new Date('2026-09-20T17:00:00Z'),
      dataPagamento: new Date('2026-09-20T17:05:00Z'),
      status: 'Pago',
    },
  });

  const pixInst2 = await prisma.pixInstallment.create({
    data: {
      paymentId: paymentPix.id,
      numeroParcela: 2,
      totalParcelas: 3,
      valor: 600.0,
      dataVencimento: new Date('2026-10-10T23:59:59Z'), // Overdue as of current date
      dataPagamento: null,
      status: 'Atrasado',
    },
  });

  const pixInst3 = await prisma.pixInstallment.create({
    data: {
      paymentId: paymentPix.id,
      numeroParcela: 3,
      totalParcelas: 3,
      valor: 600.0,
      dataVencimento: new Date('2026-11-10T23:59:59Z'), // Upcoming
      dataPagamento: null,
      status: 'Pendente',
    },
  });
  console.log('PIX installments seeded: 3 parcelas (Pago, Atrasado, Pendente).');

  // Step 8: Credit Card Installment (stored count, zero reminders per D5)
  console.log('Seeding Credit Card payment with stored installments...');
  const apptF = await prisma.appointment.create({
    data: {
      clientId: clientFernanda.id,
      dataHora: new Date('2026-09-28T11:00:00Z'),
      status: 'Concluído',
      valorEstimado: 1200.0,
      observacoes: 'Preenchimento labial com cartão de crédito.',
    },
  });

  const attF = await prisma.attendance.create({
    data: {
      appointmentId: apptF.id,
      clientId: clientFernanda.id,
      dataHora: new Date('2026-09-28T11:00:00Z'),
      completedAt: new Date('2026-09-28T12:00:00Z'),
      status: 'Realizado',
      desconto: 0.0,
    },
  });

  await prisma.attendanceProcedure.create({
    data: {
      attendanceId: attF.id,
      procedureId: procLabial.id,
      standardValueSnapshot: 1200.0,
      practicedValue: 1200.0,
    },
  });

  await prisma.payment.create({
    data: {
      attendanceId: attF.id,
      valor: 1200.0,
      metodo: 'CartaoCredito',
      status: 'Pago',
      dataPagamento: new Date('2026-09-28T12:00:00Z'),
      numeroParcelas: 6, // 6 parcelas no cartão
      identificadorTransacao: 'CC-VISA-994182',
      observacoes: 'Aprovado em 6x no cartão de crédito na maquininha da clínica (sem parcelas PIX por D5).',
    },
  });
  console.log('Credit card payment seeded: R$ 1200 in 6 installments.');

  // Step 9: In-App Reminders (Upcoming, Overdue, and Completed)
  console.log('Seeding In-App Reminders...');
  // 1. Overdue PIX installment reminder
  await prisma.reminder.create({
    data: {
      clientId: clientJuliana.id,
      pixInstallmentId: pixInst2.id,
      titulo: 'Cobrança PIX: Parcela 2/3 vencida - Juliana Albuquerque',
      descricao: 'Parcela 2 de R$ 600,00 venceu em 10/10/2026. Entrar em contato via WhatsApp para envio de nova chave PIX.',
      dataVencimento: new Date('2026-10-10T23:59:59Z'),
      prioridade: 'alta',
      status: 'pendente',
      tipo: 'parcela_pix',
    },
  });

  // 2. Upcoming PIX installment reminder
  await prisma.reminder.create({
    data: {
      clientId: clientJuliana.id,
      pixInstallmentId: pixInst3.id,
      titulo: 'Aviso PIX: Parcela 3/3 a vencer - Juliana Albuquerque',
      descricao: 'Parcela 3 de R$ 600,00 vence em 10/11/2026.',
      dataVencimento: new Date('2026-11-10T23:59:59Z'),
      prioridade: 'media',
      status: 'pendente',
      tipo: 'parcela_pix',
    },
  });

  // 3. Clinical return reminder (completed)
  await prisma.reminder.create({
    data: {
      clientId: clientMariana.id,
      titulo: 'Retorno Clínico: Avaliação 15 dias Toxina Botulínica - Mariana Silva',
      descricao: 'Avaliar resultado estético do terço superior e eventual necessidade de retoque muscular.',
      dataVencimento: new Date('2026-09-25T14:00:00Z'),
      prioridade: 'media',
      status: 'concluido',
      tipo: 'retorno',
      completedAt: new Date('2026-09-25T15:00:00Z'),
    },
  });

  // 4. General reminder for upcoming appointment confirmation
  await prisma.reminder.create({
    data: {
      clientId: clientCamila.id,
      titulo: 'Confirmar presença: Primeira consulta de rejuvenescimento - Camila',
      descricao: 'Enviar mensagem de confirmação no WhatsApp 24 horas antes do agendamento.',
      dataVencimento: new Date('2026-10-25T10:00:00Z'),
      prioridade: 'baixa',
      status: 'pendente',
      tipo: 'geral',
    },
  });
  console.log('In-app reminders seeded (pending overdue, pending upcoming, completed return, general).');

  // Step 10: Rich Calendar Appointments for Dashboard & Agenda
  console.log('Seeding upcoming appointments for calendar richness...');
  const apptCamila = await prisma.appointment.create({
    data: {
      clientId: clientCamila.id,
      dataHora: new Date('2026-10-26T14:00:00Z'),
      status: 'Confirmado',
      valorEstimado: 250.0,
      observacoes: 'Paciente confirmou presença para limpeza de pele profunda.',
      plannedProcedures: {
        create: [{ procedureId: procLimpeza.id, ordem: 0 }],
      },
    },
  });

  await prisma.attendance.create({
    data: {
      appointmentId: apptCamila.id,
      clientId: clientCamila.id,
      dataHora: new Date('2026-10-26T14:00:00Z'),
      status: 'Pendente',
      observacoes: 'Atendimento aguardando realização no dia 26/10.',
    },
  });

  const apptFernandaUpcoming = await prisma.appointment.create({
    data: {
      clientId: clientFernanda.id,
      dataHora: new Date('2026-10-28T16:00:00Z'),
      status: 'Agendado',
      valorEstimado: 600.0,
      observacoes: 'Agendamento para sessão de microagulhamento com drug delivery.',
      plannedProcedures: {
        create: [{ procedureId: procMicroagulhamento.id, ordem: 0 }],
      },
    },
  });

  await prisma.attendance.create({
    data: {
      appointmentId: apptFernandaUpcoming.id,
      clientId: clientFernanda.id,
      dataHora: new Date('2026-10-28T16:00:00Z'),
      status: 'Pendente',
    },
  });

  const apptBeatrizNoShow = await prisma.appointment.create({
    data: {
      clientId: clientBeatriz.id,
      dataHora: new Date('2026-10-02T11:00:00Z'),
      status: 'Não compareceu',
      valorEstimado: 350.0,
      motivoCancelamento: 'Paciente não compareceu no horário agendado e não respondeu às tentativas de contato telefônico.',
      observacoes: 'Falta registrada no prontuário.',
    },
  });

  await prisma.attendance.create({
    data: {
      appointmentId: apptBeatrizNoShow.id,
      clientId: clientBeatriz.id,
      dataHora: new Date('2026-10-02T11:00:00Z'),
      status: 'Cancelado',
      observacoes: 'Atendimento cancelado por não comparecimento do paciente.',
    },
  });
  console.log('Upcoming and historical appointment records seeded.');

  console.log('=== PopoApp Clinical Seed Completed Successfully! ===');
}

main()
  .catch((e) => {
    console.error('Seed execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
