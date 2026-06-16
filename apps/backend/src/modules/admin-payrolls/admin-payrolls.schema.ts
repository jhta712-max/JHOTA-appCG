import { z } from 'zod';

export const createPayrollSchema = z.object({
  periodType:  z.enum(['MONTHLY', 'BIWEEKLY_1', 'BIWEEKLY_2']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:       z.string().max(1000).optional().nullable(),
});

export const listPayrollsSchema = z.object({
  status:     z.enum(['DRAFT', 'APPROVED', 'PAID', 'VOIDED']).optional(),
  periodType: z.enum(['MONTHLY', 'BIWEEKLY_1', 'BIWEEKLY_2']).optional(),
  year:       z.coerce.number().optional(),
  page:       z.coerce.number().default(1),
  limit:      z.coerce.number().default(20),
});

export const markPaidSchema = z.object({
  paymentMethod:    z.enum(['CASH', 'TRANSFER', 'CHECK']),
  paymentDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentBank:      z.string().max(100).optional().nullable(),
  paymentReference: z.string().max(100).optional().nullable(),
});

export const voidPayrollSchema = z.object({
  voidReason: z.string().min(5).max(500),
});

export const updateLineSchema = z.object({
  otherDeductions:     z.coerce.number().min(0),
  otherDeductionsNote: z.string().max(300).optional().nullable(),
});

export type CreatePayrollInput  = z.infer<typeof createPayrollSchema>;
export type ListPayrollsInput   = z.infer<typeof listPayrollsSchema>;
export type MarkPaidInput       = z.infer<typeof markPaidSchema>;
export type VoidPayrollInput    = z.infer<typeof voidPayrollSchema>;
export type UpdateLineInput     = z.infer<typeof updateLineSchema>;
