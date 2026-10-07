import { z } from 'zod';
import { isValidCpf, normalizeCpf } from '@/lib/cpf';

export const emergencyContactInputSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome do contato deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  telefone: z
    .string()
    .trim()
    .min(8, 'Telefone do contato inválido')
    .max(20, 'Telefone muito longo'),
  parentesco: z
    .string()
    .trim()
    .min(2, 'Parentesco é obrigatório')
    .max(50, 'Parentesco muito longo'),
  observacoes: z
    .string()
    .trim()
    .max(500, 'Observações muito longas')
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateEmergencyContactSchema = emergencyContactInputSchema.partial();

export const createClientSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(150, 'Nome muito longo'),
  cpf: z
    .string()
    .trim()
    .min(1, 'CPF é obrigatório')
    .refine((val) => isValidCpf(val), {
      message: 'CPF inválido',
    })
    .transform((val) => normalizeCpf(val)),
  telefone: z
    .string()
    .trim()
    .min(8, 'Telefone inválido')
    .max(20, 'Telefone muito longo'),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal('')),
  dataNascimento: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  endereco: z
    .string()
    .trim()
    .max(255, 'Endereço muito longo')
    .optional()
    .nullable(),
  observacoes: z
    .string()
    .trim()
    .max(4000, 'Observações muito longas')
    .optional()
    .nullable(),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  emergencyContacts: z.array(emergencyContactInputSchema).optional().default([]),
});

export const updateClientSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(150)
    .optional(),
  cpf: z
    .string()
    .trim()
    .refine((val) => isValidCpf(val), { message: 'CPF inválido' })
    .transform((val) => normalizeCpf(val))
    .optional(),
  telefone: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .optional(),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal(''))
    .optional(),
  dataNascimento: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null))
    .optional(),
  endereco: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable(),
  observacoes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable(),
  status: z.enum(['ativo', 'inativo']).optional(),
});

export const clientListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ativo', 'inativo', 'todos']).optional().default('ativo'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactInputSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
