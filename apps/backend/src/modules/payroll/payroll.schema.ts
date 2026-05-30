import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────
export const PayrollStatusEnum  = z.enum(['DRAFT', 'APPROVED', 'PAID', 'VOIDED']);
export const PayrollTypeEnum    = z.enum(['LABOR', 'SERVICE']);

// ─── Create Payroll ──────────────────────────────────────────
export const createPayrollSchema = z.object({
  projectId:   z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  type:        PayrollTypeEnum.default('LABOR'),
  description: z.string().min(5, 'Mínimo 5 caracteres').max(500),
  notes:       z.string().max(1000).optional(),
  lines:       z.array(z.object({
    description:  z.string().min(3).max(300),
    quantity:     z.number().positive(),
    unit:         z.string().min(1).max(30),
    unitPrice:    z.number().positive(),
    notes:        z.string().max(300).optional(),
    supplierName: z.string().max(200).optional(),
    bankName:     z.string().max(100).optional(),
    bankAccount:  z.string().max(100).optional(),
  })).optional().default([]),
});

// ─── Update Payroll (solo en DRAFT) ──────────────────────────
export const updatePayrollSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type:        PayrollTypeEnum.optional(),
  description: z.string().min(5).max(500).optional(),
  notes:       z.string().max(1000).optional().nullable(),
});

// ─── Add / Update a single line ──────────────────────────────
export const upsertLineSchema = z.object({
  description:  z.string().min(3).max(300),
  quantity:     z.number().positive(),
  unit:         z.string().min(1).max(30),
  unitPrice:    z.number().positive(),
  notes:        z.string().max(300).optional().nullable(),
  supplierName: z.string().max(200).optional().nullable(),
  bankName:     z.string().max(100).optional().nullable(),
  bankAccount:  z.string().max(100).optional().nullable(),
});

// ─── Mark as Paid ────────────────────────────────────────────
export const markPaidSchema = z.object({
  paymentMethod:    z.enum(['CASH', 'TRANSFER']),
  paymentDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  paymentBank:      z.string().max(100).optional(),
  paymentReference: z.string().max(100).optional(),
  receiptNumber:    z.string().max(50).optional(),
  receivedBy:       z.string().max(100).optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'CASH') {
    if (!data.receiptNumber || data.receiptNumber.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receiptNumber'],
        message: 'El número de recibo es obligatorio para pago en efectivo',
      });
    }
    if (!data.receivedBy || data.receivedBy.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receivedBy'],
        message: 'El nombre de quien recibe es obligatorio para pago en efectivo',
      });
    }
  }
});

// ─── Void ────────────────────────────────────────────────────
export const voidPayrollSchema = z.object({
  voidReason: z.string().min(5, 'Indique la razón de anulación').max(500),
});

// ─── Query (list) ────────────────────────────────────────────
export const payrollQuerySchema = z.object({
  projectId:   z.string().uuid().optional(),
  status:      PayrollStatusEnum.optional(),
  type:        PayrollTypeEnum.optional(),
  dateFrom:    z.string().optional(),
  dateTo:      z.string().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  orderBy:     z.enum(['createdAt', 'periodStart', 'totalAmount', 'number']).default('createdAt'),
  order:       z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePayrollInput  = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollInput  = z.infer<typeof updatePayrollSchema>;
export type UpsertLineInput     = z.infer<typeof upsertLineSchema>;
export type MarkPaidInput       = z.infer<typeof markPaidSchema>;
export type VoidPayrollInput    = z.infer<typeof voidPayrollSchema>;
export type PayrollQuery        = z.infer<typeof payrollQuerySchema>;
