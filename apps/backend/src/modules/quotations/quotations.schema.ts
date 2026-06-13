import { z } from 'zod';

// ── Schema base de cotización ──────────────────────────────────

const baseQuotationSchema = z.object({
  projectId:      z.string({ required_error: 'El proyecto es requerido' }).uuid(),
  categoryId:     z.coerce.number().int().positive().optional(),

  // Suplidor
  supplierId:     z.string().uuid().optional().nullable(),
  supplierName:   z.string({ required_error: 'El nombre del suplidor es requerido' }).min(2).max(200),
  supplierRnc:    z.string().max(11).optional(),

  // Documento
  quotationNumber: z.string().max(50).optional(),
  quotationDate:   z.string({ required_error: 'La fecha de cotización es requerida' })
                    .date('Formato inválido, use YYYY-MM-DD'),
  validUntil:      z.string().date('Formato inválido, use YYYY-MM-DD').optional(),

  // Montos
  currency:       z.enum(['DOP', 'USD', 'EUR']).default('DOP'),
  subtotal:       z.coerce.number({ required_error: 'El subtotal es requerido' })
                    .positive('El subtotal debe ser mayor a 0'),
  itbisAmount:    z.coerce.number().min(0).default(0),
  total:          z.coerce.number({ required_error: 'El total es requerido' })
                    .positive('El total debe ser mayor a 0'),

  // Condiciones
  description:    z.string({ required_error: 'La descripción es requerida' }).min(3).max(2000),
  paymentTerms:   z.string().max(500).optional(),
  advancePct:     z.coerce.number().min(0).max(100).optional(),
  deliveryDays:   z.coerce.number().int().positive().optional(),
  observations:   z.string().max(2000).optional(),
  notes:          z.string().max(1000).optional(),
  projectItemId:  z.string().uuid().optional().nullable(),
  batchItemId:    z.string().uuid().optional().nullable(),
});

// ── Crear cotización ───────────────────────────────────────────

export const createQuotationSchema = baseQuotationSchema;

// ── Actualizar cotización ──────────────────────────────────────

export const updateQuotationSchema = baseQuotationSchema
  .omit({ projectId: true })
  .partial();

// ── Cambiar estado ─────────────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.enum(
    ['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED', 'INVOICED', 'PAID', 'CANCELLED'],
    { required_error: 'El estado es requerido' },
  ),
  notes: z.string().max(500).optional(),
});

// ── Registrar pago / anticipo ──────────────────────────────────

export const createPaymentSchema = z.object({
  amount:        z.coerce.number({ required_error: 'El monto del pago es requerido' })
                   .positive('El monto debe ser mayor a 0'),
  paymentDate:   z.string({ required_error: 'La fecha del pago es requerida' })
                   .date('Formato inválido, use YYYY-MM-DD'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER'], {
    required_error: 'El método de pago es requerido',
  }),
  description:   z.string({ required_error: 'La descripción del pago es requerida' }).min(3).max(300),
  notes:         z.string().max(1000).optional(),
  // Si true, crea un Expense automáticamente en el proyecto
  createExpense: z.boolean().default(true),
  // Vincular a un expense existente en lugar de crear uno nuevo
  expenseId:     z.string().uuid().optional(),
});

// ── Vincular gasto/factura a cotización ────────────────────────

export const linkExpenseSchema = z.object({
  expenseId: z.string({ required_error: 'El ID del gasto es requerido' }).uuid(),
  linkType:  z.enum(['ADVANCE', 'PARTIAL_INVOICE', 'FINAL_INVOICE', 'COMPLEMENTARY'], {
    required_error: 'El tipo de vínculo es requerido',
  }),
  notes:     z.string().max(500).optional(),
});

// ── Filtros de consulta ────────────────────────────────────────

export const quotationQuerySchema = z.object({
  page:         z.coerce.number().min(1).default(1),
  limit:        z.coerce.number().min(1).max(100).default(20),
  projectId:    z.string().uuid().optional(),
  categoryId:   z.coerce.number().int().positive().optional(),
  status:       z.enum(['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS',
                         'PARTIAL_INVOICED', 'INVOICED', 'PAID', 'CANCELLED']).optional(),
  supplierId:   z.string().uuid().optional(),
  supplierName: z.string().optional(),
  dateFrom:     z.string().date().optional(),
  dateTo:       z.string().date().optional(),
  search:       z.string().optional(),
  overdue:      z.coerce.boolean().optional(), // true = vencidas sin respuesta (validUntil < hoy AND estado abierto)
  orderBy:      z.enum(['quotationDate', 'total', 'supplierName', 'createdAt', 'status']).default('quotationDate'),
  order:        z.enum(['asc', 'desc']).default('desc'),
});

// ── Tipos inferidos ────────────────────────────────────────────

export type CreateQuotationInput  = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput  = z.infer<typeof updateQuotationSchema>;
export type UpdateStatusInput     = z.infer<typeof updateStatusSchema>;
export type CreatePaymentInput    = z.infer<typeof createPaymentSchema>;
export type LinkExpenseInput      = z.infer<typeof linkExpenseSchema>;
export type QuotationQuery        = z.infer<typeof quotationQuerySchema>;
