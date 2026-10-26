// src/schemas/payment.ts
import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUSES, PIX_INSTALLMENT_STATUSES } from '@/types/payment';

export const recordPaymentSchema = z.object({
  valor: z
    .number({ required_error: 'O valor é obrigatório' })
    .positive('O valor do pagamento deve ser maior que zero'),
  metodo: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Método de pagamento inválido' }),
  }),
  status: z.enum(PAYMENT_STATUSES).optional().default('Pago'),
  dataPagamento: z.coerce.date().optional().default(() => new Date()),
  numeroParcelas: z
    .number()
    .int('O número de parcelas deve ser um número inteiro')
    .min(1, 'Mínimo de 1 parcela')
    .max(24, 'Máximo de 24 parcelas')
    .optional()
    .default(1),
  identificadorTransacao: z.string().trim().max(100).nullable().optional(),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const createPixScheduleSchema = z.object({
  valorTotal: z
    .number({ required_error: 'O valor total é obrigatório' })
    .positive('O valor total do parcelamento deve ser maior que zero'),
  numeroParcelas: z
    .number({ required_error: 'O número de parcelas é obrigatório' })
    .int('O número de parcelas deve ser um número inteiro')
    .min(1, 'O parcelamento PIX deve ter no mínimo 1 parcela')
    .max(24, 'O parcelamento PIX suporta no máximo 24 parcelas'),
  primeiroVencimento: z.coerce.date({
    required_error: 'A data do primeiro vencimento é obrigatória',
  }),
  intervaloDias: z
    .number()
    .int()
    .min(1, 'O intervalo deve ser de pelo menos 1 dia')
    .max(90, 'O intervalo máximo é de 90 dias')
    .optional()
    .default(30),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export const payPixInstallmentSchema = z.object({
  dataPagamento: z.coerce.date().optional().default(() => new Date()),
});

export const updatePixInstallmentStatusSchema = z.object({
  status: z.enum(PIX_INSTALLMENT_STATUSES, {
    errorMap: () => ({ message: 'Status de parcela PIX inválido' }),
  }),
  dataPagamento: z.coerce.date().nullable().optional(),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type CreatePixScheduleInput = z.input<typeof createPixScheduleSchema>;
export type PayPixInstallmentInput = z.input<typeof payPixInstallmentSchema>;
export type UpdatePixInstallmentStatusInput = z.infer<typeof updatePixInstallmentStatusSchema>;
