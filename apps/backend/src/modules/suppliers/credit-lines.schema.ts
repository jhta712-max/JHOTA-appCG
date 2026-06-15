import { z } from 'zod';

export const createCreditLineSchema = z.object({
  creditLimit: z.coerce.number().positive('El límite debe ser mayor a 0'),
  notes:       z.string().max(500).optional().nullable(),
});

export const updateCreditLineSchema = createCreditLineSchema.partial();

export const addPaymentSchema = z.object({
  amount:        z.coerce.number().positive('El monto debe ser mayor a 0'),
  paymentDate:   z.string().date('Formato inválido, use YYYY-MM-DD'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CHECK', 'OTHER']),
  reference:     z.string().max(100).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
});

export type CreateCreditLineInput = z.infer<typeof createCreditLineSchema>;
export type UpdateCreditLineInput = z.infer<typeof updateCreditLineSchema>;
export type AddPaymentInput       = z.infer<typeof addPaymentSchema>;
