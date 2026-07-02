import { z } from 'zod';

const baseContratoSchema = z.object({
  projectId:          z.string().uuid(),
  supplierId:         z.string().uuid(),
  descripcionTrabajo: z.string().min(3).max(2000),
  modalidad:          z.enum(['MONTO_FIJO', 'PRECIO_UNITARIO']).default('MONTO_FIJO'),
  // MONTO_FIJO: monto requerido. PRECIO_UNITARIO: se calcula desde precio × cantidad (opcional aquí).
  montoContratado:    z.coerce.number().positive().optional(),
  // PRECIO_UNITARIO: precio requerido, unidad requerida, cantidad estimada opcional.
  precioUnitario:     z.coerce.number().positive().optional().nullable(),
  unidad:             z.string().max(30).nullable().optional(),
  cantidadEstimada:   z.coerce.number().positive().optional().nullable(),
  fechaContrato:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observaciones:      z.string().max(2000).nullable().optional(),
});

// Validación cruzada según modalidad
export const createContratoSchema = baseContratoSchema.refine(
  (data) => {
    if (data.modalidad === 'PRECIO_UNITARIO') {
      return data.precioUnitario != null && data.precioUnitario > 0 && !!data.unidad && !!data.unidad.trim();
    }
    // MONTO_FIJO (default)
    return data.montoContratado != null && data.montoContratado > 0;
  },
  {
    message: 'Para MONTO_FIJO indique el monto contratado (> 0). Para PRECIO_UNITARIO indique precio unitario (> 0) y unidad.',
    path: ['modalidad'],
  },
);

export const updateContratoSchema = baseContratoSchema.partial().extend({
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
