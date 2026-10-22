
import { z } from 'zod';

export const loginSchema = z.object({
  nickname: z.string().min(2, 'O usuário deve ter pelo menos 2 caracteres'),
  password: z.string().min(4, 'A senha deve ter pelo menos 4 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
