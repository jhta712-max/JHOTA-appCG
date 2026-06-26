import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  orderType:     z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH', 'OFFICE']).default('SERVICIO'),
  payingCompany: z.string().min(2).max(200),
  supplierId:    z.string().uuid().optional().nullable(),
  projectId:     z.string().uuid().optional().nullable(),
  amount:        z.coerce.number().positive(),
  currency:      z.enum(['RD$', 'US$', '€']).default('RD$'),
  concept:       z.string().min(3).max(2000),
  notes:              z.string().max(500).optional(),
  payrollId:          z.string().uuid().optional(),
  bankAccountId:      z.string().uuid().optional(),
  contratoAjustadoId: z.string().uuid().optional().nullable(),
  quotationId:        z.string().uuid().optional().nullable(),
  projectItemId:      z.string().uuid().optional().nullable(),
  batchItemId:        z.string().uuid().optional().nullable(),
  creditLineId:       z.string().uuid().optional().nullable(),
  // OFFICE-only fields
  officeExpenseCategory: z.string().optional().nullable(),
  officeSupplierName:    z.string().max(200).optional().nullable(),
  // Auto-create payroll data (only when orderType === 'PAYROLL')
  payrollData: z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type:        z.enum(['LABOR', 'SERVICE']),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.orderType === 'OFFICE') {
    if (!data.officeExpenseCategory) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'officeExpenseCategory es requerido para órdenes OFFICE', path: ['officeExpenseCategory'] });
    }
    if (!data.supplierId && !data.officeSupplierName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe indicar un proveedor (supplierId o officeSupplierName) para órdenes OFFICE', path: ['officeSupplierName'] });
    }
  } else {
    if (!data.projectId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'projectId es requerido para este tipo de orden', path: ['projectId'] });
    }
    if (!data.supplierId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'supplierId es requerido para este tipo de orden', path: ['supplierId'] });
    }
  }
});

export const updatePaymentOrderSchema = createPaymentOrderSchema.innerType().partial();

export const querySchema = z.object({
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(500).default(20),
  status:     z.string().optional(),
  orderType:  z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH', 'OFFICE']).optional(),
  projectId:    z.string().uuid().optional(),
  supplierId:   z.string().uuid().optional(),
  createdById:  z.string().uuid().optional(),
  search:       z.string().optional(),
  orderBy:    z.enum(['createdAt', 'amount', 'number']).default('createdAt'),
  order:      z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type UpdatePaymentOrderInput = z.infer<typeof updatePaymentOrderSchema>;
export type PaymentOrderQuery       = z.infer<typeof querySchema>;
