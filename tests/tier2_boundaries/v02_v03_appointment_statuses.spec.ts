import { describe, it, expect } from 'vitest';

export const ALLOWED_APPOINTMENT_STATUSES = [
  'Agendado',
  'Confirmado',
  'Concluído',
  'Cancelado',
  'Não compareceu',
  'Reagendado',
] as const;

export type AppointmentStatus = (typeof ALLOWED_APPOINTMENT_STATUSES)[number];

export function validateAppointmentStatus(status: string): boolean {
  return (ALLOWED_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

describe('Critical Validations V02 & V03: Appointment Status Domain Rules', () => {
  it('V02: should accept all 6 canonical appointment statuses', () => {
    for (const status of ALLOWED_APPOINTMENT_STATUSES) {
      expect(validateAppointmentStatus(status)).toBe(true);
    }
  });

  it('V03: should strictly REJECT "Em atendimento" as an Appointment status', () => {
    // Development Spec §27 & §32 explicit prohibition:
    // "Do not create an appointment status called Em atendimento."
    expect(validateAppointmentStatus('Em atendimento')).toBe(false);
    expect(validateAppointmentStatus('EM ATENDIMENTO')).toBe(false);
    expect(validateAppointmentStatus('em_atendimento')).toBe(false);
  });

  it('V02: should reject arbitrary or invalid status strings', () => {
    expect(validateAppointmentStatus('Pendente')).toBe(false); // Pendente is an Attendance status, NOT Appointment
    expect(validateAppointmentStatus('Realizado')).toBe(false); // Realizado is an Attendance status, NOT Appointment
    expect(validateAppointmentStatus('Finalizado')).toBe(false);
    expect(validateAppointmentStatus('Draft')).toBe(false);
    expect(validateAppointmentStatus('')).toBe(false);
  });

  it('should enforce case-sensitivity of status strings', () => {
    expect(validateAppointmentStatus('agendado')).toBe(false);
    expect(validateAppointmentStatus('CONFIRMADO')).toBe(false);
    expect(validateAppointmentStatus('concluído')).toBe(false);
  });

  it('should ensure the set of statuses contains exactly 6 values', () => {
    expect(ALLOWED_APPOINTMENT_STATUSES).toHaveLength(6);
  });
});
