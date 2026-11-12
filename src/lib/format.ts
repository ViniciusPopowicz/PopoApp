
export function formatCurrency(value: number | null | undefined): string {
  const val = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(d);
}

export function formatPhone(phone: string): string {
  const cleaned = ('' + phone).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export interface DurationProcedureLike {
  duracaoMinutos?: number | null;
  procedure?: {
    duracaoMinutos?: number | null;
  } | null;
}

export function calculateEstimatedDurationMinutes(
  procedures: Array<DurationProcedureLike | null | undefined> | null | undefined
): number {
  if (!Array.isArray(procedures) || procedures.length === 0) {
    return 0;
  }

  return procedures.reduce((sum, item) => {
    if (!item) return sum;
    const rawDuration =
      item.duracaoMinutos !== undefined && item.duracaoMinutos !== null
        ? item.duracaoMinutos
        : item.procedure?.duracaoMinutos;
    const numeric = Number(rawDuration);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return sum;
    }
    return sum + Math.round(numeric);
  }, 0);
}

export function formatDurationMinutes(totalMinutes: number | null | undefined): string {
  const numeric = Number(totalMinutes);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 min';
  }
  const mins = Math.round(numeric);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) {
    return `${mins} min (${hours}h)`;
  }
  return `${mins} min (${hours}h ${rem}min)`;
}
