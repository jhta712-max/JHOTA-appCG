import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo es requerido' })
    .email('Formato de correo inválido')
    .toLowerCase(),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'El refresh token es requerido' }),
});

export type LoginInput    = z.infer<typeof loginSchema>;
export type RefreshInput  = z.infer<typeof refreshSchema>;
