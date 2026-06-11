import { z } from 'zod';

export const OFFICE_EXPENSE_CATEGORIES = [
  'CLEANING_SUPPLIES',
  'CONSUMABLES',
  'OFFICE_SERVICES',
  'BIDDING',
  'OFFICE_ASSETS',
  'OTHER',
] as const;

export const OFFICE_EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  CLEANING_SUPPLIES: 'Insumos de limpieza',
  CONSUMABLES:       'Material gastable',
  OFFICE_SERVICES:   'Servicios de oficina',
  BIDDING:           'Licitacion',
  OFFICE_ASSETS:     'Activos de oficina',
  OTHER:             'Otros gastos de oficina',
};

export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER'] as const;

export const createOfficeExpenseSchema = z.object({
  category:      z.enum(OFFICE_EXPENSE_CATEGORIES),
  description:   z.string().min(3).max(500),
  amount:        z.coerce.number().positive(),
  expenseDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  companyCardId: z.coerce.string().optional().nullable(),
  supplierId:    z.string().uuid().optional().nullable(),
  hasFiscalDoc:  z.boolean().default(false),
  fiscalDocNum:  z.string().max(50).optional().nullable(),
  notes:         z.string().max(1000).optional().nullable(),
});

export const updateOfficeExpenseSchema = createOfficeExpenseSchema.partial();

export const listOfficeExpensesSchema = z.object({
  page:         z.coerce.number().default(1),
  limit:        z.coerce.number().default(20),
  category:     z.enum(OFFICE_EXPENSE_CATEGORIES).optional(),
  from:         z.string().optional(),
  to:           z.string().optional(),
  hasFiscalDoc: z.coerce.boolean().optional(),
  orderBy:      z.enum(['expenseDate', 'amount', 'createdAt']).default('expenseDate'),
  order:        z.enum(['asc', 'desc']).default('desc'),
});

export type CreateOfficeExpenseInput = z.infer<typeof createOfficeExpenseSchema>;
export type UpdateOfficeExpenseInput = z.infer<typeof updateOfficeExpenseSchema>;
export type ListOfficeExpensesInput  = z.infer<typeof listOfficeExpensesSchema>;
