// src/schemas/dashboard.ts
import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year', 'all', 'custom']).optional().default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  refDate: z.string().optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
