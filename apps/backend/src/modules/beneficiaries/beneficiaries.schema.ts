import { z } from 'zod';

export const createBeneficiarySchema = z.object({
  name:          z.string().min(2).max(200),
  bank:          z.string().min(2).max(100),
  accountType:   z.enum(['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina']),
  accountNumber: z.string().min(4).max(50),
  cedula:        z.string().max(20).optional(),
  phone:         z.string().max(20).optional(),
});

export const updateBeneficiarySchema = createBeneficiarySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiarySchema>;
