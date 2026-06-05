import { z } from 'zod';

export const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

export const createBeneficiarySchema = z.object({
  name:          z.string().min(2).max(200),
  bank:          z.string().min(2).max(100),
  accountType:   z.enum(ACCOUNT_TYPES),
  accountNumber: z.string().min(4).max(50),
  cedula:        z.string().max(20).optional(),
  phone:         z.string().max(20).optional(),
  supplierId:    z.string().uuid().optional().nullable(),
});

export const updateBeneficiarySchema = createBeneficiarySchema
  .partial()
  .extend({
    isActive:   z.boolean().optional(),
    supplierId: z.string().uuid().optional().nullable(),
  });

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiarySchema>;
