import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name:             z.string().min(2).max(200),
  position:         z.string().min(2).max(100),
  hireDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  paymentFrequency: z.enum(['MONTHLY', 'BIWEEKLY']),
  baseSalary:       z.coerce.number().positive(),
  bankName:         z.string().max(100).optional().nullable(),
  bankAccount:      z.string().max(50).optional().nullable(),
  notes:            z.string().max(1000).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = z.object({
  status:    z.enum(['ACTIVE', 'SUSPENDED', 'RETIRED']).optional(),
  frequency: z.enum(['MONTHLY', 'BIWEEKLY']).optional(),
  page:      z.coerce.number().default(1),
  limit:     z.coerce.number().default(50),
});

export const createBenefitSchema = z.object({
  name:       z.string().min(2).max(100),
  amount:     z.coerce.number().positive(),
  affectsISR: z.boolean().default(true),
  isActive:   z.boolean().default(true),
});

export const updateBenefitSchema = createBenefitSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesInput  = z.infer<typeof listEmployeesSchema>;
export type CreateBenefitInput  = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput  = z.infer<typeof updateBenefitSchema>;
