import { z } from 'zod';

export const createUserSchema = z.object({
  name:     z.string({ required_error: 'El nombre es requerido' }).min(2).max(100),
  email:    z.string({ required_error: 'El correo es requerido' }).email().toLowerCase(),
  password: z.string({ required_error: 'La contraseña es requerida' })
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  roleId:   z.coerce.number({ required_error: 'El rol es requerido' }).int().positive(),
  phone:    z.string().max(20).optional(),
});

export const updateUserSchema = z.object({
  name:           z.string().min(2).max(100).optional(),
  phone:          z.string().max(20).optional(),
  roleId:         z.coerce.number().int().positive().optional(),
  isActive:       z.boolean().optional(),
  whatsappOptIn:  z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'La contraseña actual es requerida' }),
  newPassword:     z.string({ required_error: 'La nueva contraseña es requerida' })
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'La nueva contraseña debe ser diferente a la actual',
  path: ['newPassword'],
});

export type CreateUserInput      = z.infer<typeof createUserSchema>;
export type UpdateUserInput      = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput  = z.infer<typeof changePasswordSchema>;
