import { z } from 'zod';
import { validateNCF } from '../../utils/fiscal.utils';

export const createProjectSchema = z.object({
  code: z
    .string({ required_error: 'El código es requerido' })
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .toUpperCase(),
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(3, 'Mínimo 3 caracteres')
    .max(200, 'Máximo 200 caracteres'),
  client:          z.string().max(200).optional(),
  location:        z.string().max(300).optional(),
  startDate:       z.string({ required_error: 'La fecha de inicio es requerida' }).date('Formato inválido, use YYYY-MM-DD'),
  endDate:         z.string().date('Formato inválido, use YYYY-MM-DD').optional(),
  estimatedBudget: z.coerce.number().min(0, 'El presupuesto no puede ser negativo').default(0),
  notes:           z.string().max(2000).optional(),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  });

export const projectQuerySchema = z.object({
  page:     z.coerce.number().min(1).default(1),
  limit:    z.coerce.number().min(1).max(200).default(20),
  status:   z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
  search:   z.string().optional(),
  orderBy:  z.enum(['createdAt', 'name', 'code', 'startDate']).default('createdAt'),
  order:    z.enum(['asc', 'desc']).default('desc'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectQuery       = z.infer<typeof projectQuerySchema>;

// ── Adendas de contrato ───────────────────────────────────────
export const createAddendumSchema = z.object({
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  description: z.string().min(3, 'La descripción es requerida').max(1000),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
});

export const updateAddendumSchema = createAddendumSchema.partial();

export type CreateAddendumInput = z.infer<typeof createAddendumSchema>;
export type UpdateAddendumInput = z.infer<typeof updateAddendumSchema>;

// ── Cubicaciones y Avance ────────────────────────────────────
export const createCubicacionSchema = z.object({
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  progressPct: z.coerce.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100').default(0),
  description: z.string().min(3, 'La descripción es requerida').max(1000),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  ncf:         z.string().max(19).optional().nullable()
                 .refine(v => !v || validateNCF(v), 'NCF inválido'),
});

export const updateCubicacionSchema = createCubicacionSchema.partial();

export type CreateCubicacionInput = z.infer<typeof createCubicacionSchema>;
export type UpdateCubicacionInput = z.infer<typeof updateCubicacionSchema>;

// ── Anticipos ─────────────────────────────────────────────────

export const createAnticipoSchema = z.object({
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  ncf:         z.string().max(19).optional().nullable()
                 .refine(v => !v || validateNCF(v), 'NCF inválido'),
  description: z.string().max(500).optional().nullable(),
});

export const updateAnticipoSchema = createAnticipoSchema.partial();

export type CreateAnticipoInput = z.infer<typeof createAnticipoSchema>;
export type UpdateAnticipoInput = z.infer<typeof updateAnticipoSchema>;

// ── Items de proyecto ─────────────────────────────────────────
export const createProjectItemSchema = z.object({
  name: z.string().min(2).max(300),
});
export const updateProjectItemSchema = z.object({
  name:   z.string().min(2).max(300).optional(),
  active: z.boolean().optional(),
});

export type CreateProjectItemInput = z.infer<typeof createProjectItemSchema>;
export type UpdateProjectItemInput = z.infer<typeof updateProjectItemSchema>;

// ── Gastos Extraordinarios ───────────────────────────────────
export const createExtraordinaryExpenseSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida').max(200),
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  category:    z.enum(['COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO']),
  notes:       z.string().max(500).optional(),
});

export const updateExtraordinaryExpenseSchema = createExtraordinaryExpenseSchema.partial();

export type CreateExtraordinaryExpenseInput = z.infer<typeof createExtraordinaryExpenseSchema>;
export type UpdateExtraordinaryExpenseInput = z.infer<typeof updateExtraordinaryExpenseSchema>;
