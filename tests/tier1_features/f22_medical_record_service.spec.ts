import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prismaTest from '../helpers/db-client';
import { cleanTestDatabase, closeTestDatabase } from '../helpers/db-cleaner';
import { createTestClient, createTestAppointment } from '../helpers/test-fixtures';
import { MedicalRecordService } from '@/services/medical-record.service';
import { AttendanceService } from '@/services/attendance.service';
import { createMedicalRecordSchema } from '@/schemas/medical-record';
import { ValidationError, NotFoundError } from '@/lib/errors';

describe('Tier 1 Feature F22: Medical Record (Prontuário) Service (Phase 10, V19)', () => {
  beforeAll(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await cleanTestDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  it('F22.1: creates medical record with canonical clinical fields', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    const record = await MedicalRecordService.createMedicalRecord({
      attendanceId,
      queixaPrincipal: 'Rugas periorbitais e assimetria na sobrancelha direita',
      avaliacaoClinica: 'Pele com fotoenvelhecimento moderado (Glogau II), boa elasticidade',
      condutaProcedimento: 'Aplicação de toxina botulínica no terço superior (30U)',
      orientacoes: 'Não deitar por 4 horas, não massagear o local, evitar atividade física intensa hoje',
      observacoes: 'Fotos tiradas antes do procedimento anexadas ao atendimento',
    });

    expect(record.id).toBeDefined();
    expect(record.attendanceId).toBe(attendanceId);
    expect(record.queixaPrincipal).toContain('Rugas periorbitais');
    expect(record.avaliacaoClinica).toContain('Glogau II');
    expect(record.condutaProcedimento).toContain('30U');
    expect(record.orientacoes).toContain('Não deitar');
    expect(record.observacoes).toContain('Fotos tiradas');
  });

  it('F22.2: creates medical record resolving Brazilian clinical aliases into canonical columns', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    // Use schema parsing to transform aliases
    const parsed = createMedicalRecordSchema.parse({
      attendanceId,
      queixaPrincipal: 'Lábios finos',
      anamnese: 'Sem histórico de alergias a anestésicos locais',
      evolucaoClinica: 'Preenchimento de contorno e volume labial com 1ml de AH',
      orientacoesPosProcedimento: 'Compressas frias se houver edema',
      intercorrencias: 'Pequeno hematoma puntiforme em comissura labial esquerda',
    });

    const record = await MedicalRecordService.createMedicalRecord(parsed);

    expect(record.avaliacaoClinica).toBe('Sem histórico de alergias a anestésicos locais');
    expect(record.condutaProcedimento).toBe('Preenchimento de contorno e volume labial com 1ml de AH');
    expect(record.orientacoes).toBe('Compressas frias se houver edema');
    expect(record.observacoes).toContain('[Intercorrências]: Pequeno hematoma');
  });

  it('F22.3: updates medical record clinical observations', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    await MedicalRecordService.createMedicalRecord({
      attendanceId,
      queixaPrincipal: 'Avaliação inicial',
    });

    const updated = await MedicalRecordService.updateByAttendanceId(attendanceId, {
      condutaProcedimento: 'Procedimento finalizado com sucesso. Retorno agendado para 15 dias.',
    });

    expect(updated.condutaProcedimento).toBe('Procedimento finalizado com sucesso. Retorno agendado para 15 dias.');
  });

  it('F22.4: retrieves client medical records across multiple attendances', async () => {
    const client = await createTestClient();

    // Attendance 1
    const appt1 = await createTestAppointment(client.id);
    await MedicalRecordService.createMedicalRecord({
      attendanceId: appt1.attendances[0].id,
      queixaPrincipal: 'Sessão 1',
    });

    // Attendance 2
    const appt2 = await createTestAppointment(client.id);
    await MedicalRecordService.createMedicalRecord({
      attendanceId: appt2.attendances[0].id,
      queixaPrincipal: 'Sessão 2 - Retorno',
    });

    const records = await MedicalRecordService.getClientMedicalRecords(client.id);
    expect(records).toHaveLength(2);
  });

  it('F22.5: rejects creating medical record for cancelled attendance', async () => {
    const client = await createTestClient();
    const appt = await createTestAppointment(client.id);
    const attendanceId = appt.attendances[0].id;

    await AttendanceService.cancelAttendance(attendanceId);

    await expect(
      MedicalRecordService.createMedicalRecord({
        attendanceId,
        queixaPrincipal: 'Tentativa em atendimento cancelado',
      })
    ).rejects.toThrow(ValidationError);
  });
});
