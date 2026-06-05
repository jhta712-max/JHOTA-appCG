import { z } from 'zod';

export const createContratoSchema = z.object({
  projectId:          z.string().uuid(),
  supplierId:         z.string().uuid(),
  descripcionTrabajo: z.string().min(3).max(2000),
  montoContratado:    z.coerce.number().positive(),
  fechaContrato:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones:      z.string().max(2000).optional(),
});

export const updateContratoSchema = createContratoSchema.partial().extend({
  estado: z.enum(['ACTIVO', 'COMPLETADO', 'CANCELADO']).optional(),
});

export const queryContratoSchema = z.object({
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(100).default(20),
  projectId:  z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  estado:     z.enum(['ACTIVO', 'COMPLETADO', 'CANCELADO']).optional(),
  search:     z.string().optional(),
});

export const linkExpenseSchema = z.object({
  expenseId: z.string().uuid(),
});

export const addPagoSchema = z.object({
  ordenPagoId: z.string().uuid().optional(),
  nominaId:    z.string().uuid().optional(),
  gastoId:     z.string().uuid().optional(),
  monto:       z.coerce.number().positive(),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateContratoInput = z.infer<typeof createContratoSchema>;
export type UpdateContratoInput = z.infer<typeof updateContratoSchema>;
export type ContratoQuery       = z.infer<typeof queryContratoSchema>;
