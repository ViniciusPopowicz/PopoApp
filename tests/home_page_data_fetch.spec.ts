import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/format';
import { DashboardService } from '@/services/dashboard.service';

describe('Home Page Data Fetch & Format Resilience', () => {
  describe('Format Helper Resilience (zero throws on invalid or null/undefined values)', () => {
    it('formatDate handles null, undefined, invalid dates, and ISO strings without throwing', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate(new Date(NaN))).toBe('—');
      expect(formatDate('invalid-date')).toBe('—');
      expect(formatDate('2026-10-30T15:00:00Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatDate(new Date('2026-10-30T15:00:00Z'))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('formatDateTime handles null, undefined, invalid dates, and ISO strings without throwing', () => {
      expect(formatDateTime(null)).toBe('—');
      expect(formatDateTime(undefined)).toBe('—');
      expect(formatDateTime(new Date(NaN))).toBe('—');
      expect(formatDateTime('invalid-date')).toBe('—');
      expect(formatDateTime('2026-10-30T15:00:00Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatDateTime(new Date('2026-10-30T15:00:00Z'))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('formatTime handles null, undefined, and valid inputs safely', () => {
      expect(formatTime(null)).toBe('—');
      expect(formatTime(undefined)).toBe('—');
      expect(formatTime(new Date(NaN))).toBe('—');
      expect(formatTime('invalid')).toBe('—');
      expect(formatTime('2026-10-30T15:30:00Z')).toMatch(/\d{2}:\d{2}/);
    });

    it('formatCurrency handles null, undefined, NaN, and numbers safely', () => {
      expect(formatCurrency(null)).toContain('0,00');
      expect(formatCurrency(undefined)).toContain('0,00');
      expect(formatCurrency(NaN)).toContain('0,00');
      expect(formatCurrency(1250.5)).toContain('1.250,50');
    });
  });

  describe('DashboardService Date Range computation', () => {
    it('correctly calculates today range', () => {
      const ref = new Date(2026, 9, 30, 15, 30);
      const range = DashboardService.getDateRange('today', ref);
      expect(range.startDate.getDate()).toBe(30);
      expect(range.startDate.getHours()).toBe(0);
      expect(range.endDate.getDate()).toBe(30);
      expect(range.endDate.getHours()).toBe(23);
    });

    it('correctly calculates month range', () => {
      const ref = new Date(2026, 9, 15);
      const range = DashboardService.getDateRange('month', ref);
      expect(range.startDate.getDate()).toBe(1);
      expect(range.endDate.getDate()).toBe(31);
    });
  });
});
