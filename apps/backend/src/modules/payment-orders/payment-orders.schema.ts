import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  orderType:     z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS']).default('SERVICIO'),
  payingCompany: z.string().min(2).max(200),
  supplierId:    z.string().uuid(),
  projectId:     z.string().uuid(),
  amount:        z.coerce.number().positive(),
  currency:      z.enum(['RD$', 'US$', '€']).default('RD$'),
  concept:       z.string().min(3).max(2000),
  notes:             z.string().max(500).optional(),
  payrollId:         z.string().uuid().optional(),
  bankAccountId:     z.string().uuid().optional(),
  contratoAjustadoId: z.string().uuid().optional().nullable(),
});

export const updatePaymentOrderSchema = createPaymentOrderSchema.partial();

export const querySchema = z.object({
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(100).default(20),
  status:     z.enum(['PENDING', 'PAID']).optional(),
  orderType:  z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS']).optional(),
  projectId:  z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  search:     z.string().optional(),
  orderBy:    z.enum(['createdAt', 'amount', 'number']).default('createdAt'),
  order:      z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type UpdatePaymentOrderInput = z.infer<typeof updatePaymentOrderSchema>;
export type PaymentOrderQuery       = z.infer<typeof querySchema>;
