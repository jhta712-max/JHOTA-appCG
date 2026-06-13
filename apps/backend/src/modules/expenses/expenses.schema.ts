import { z } from 'zod';
import { validateNCF, validateRNC, extractNCFType, isElectronicNCF } from '../../utils/fiscal.utils';

// ---------------------------------------------------------------
// Comprobante fiscal — validación NCF/e-NCF + RNC
// ---------------------------------------------------------------
const fiscalVoucherSchema = z.object({
  ncf: z
    .string({ required_error: 'El NCF es requerido' })
    .refine(validateNCF, {
      message: 'NCF inválido. Formato: B0100000001 (11 chars) o E310000000001 (13 chars)',
    }),
  supplierRnc: z
    .string({ required_error: 'El RNC del suplidor es requerido' })
    .refine(validateRNC, { message: 'RNC inválido. Debe tener 9 u 11 dígitos' }),
  supplierName: z
    .string({ required_error: 'El nombre del suplidor es requerido' })
    .min(2).max(200),
  itbisAmount: z.coerce.number().min(0).default(0),
});

// ---------------------------------------------------------------
// Schema base (ZodObject) — permite usar .partial() y .omit()
// El .refine() se aplica por separado para no romper esos métodos
// ---------------------------------------------------------------
const baseExpenseSchema = z.object({
  projectId:     z.string({ required_error: 'El proyecto es requerido' }).uuid(),
  categoryId:    z.coerce.number({ required_error: 'La categoría es requerida' }).int().positive(),
  expenseDate:   z.string({ required_error: 'La fecha es requerida' }).date('Formato inválido, use YYYY-MM-DD'),
  amount:        z.coerce.number({ required_error: 'El monto es requerido' }).positive('El monto debe ser mayor a 0'),
  description:   z.string({ required_error: 'La descripción es requerida' }).min(3).max(1000),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER'], {
    required_error: 'El método de pago es requerido',
  }),
  companyCardId: z.coerce.number().int().positive().optional(), // Requerido si paymentMethod = CARD
  hasFiscalDoc:    z.boolean().default(false),
  notes:           z.string().max(1000).optional(),
  fiscalVoucher:   fiscalVoucherSchema.optional(),
  // Moneda extranjera
  foreignAmount:   z.coerce.number().positive().optional().nullable(),
  foreignCurrency: z.string().max(10).optional().nullable(),
  exchangeRate:    z.coerce.number().positive().optional().nullable(),
  projectItemId:   z.string().uuid().optional().nullable(),
  batchItemId:     z.string().uuid().optional().nullable(),
});

// ---------------------------------------------------------------
// Crear gasto — con validación cruzada fiscal
// ---------------------------------------------------------------
export const createExpenseSchema = baseExpenseSchema
  .refine(
    (data) => {
      if (data.hasFiscalDoc && !data.fiscalVoucher) return false;
      return true;
    },
    { message: 'Debe ingresar los datos del comprobante fiscal (NCF, RNC y nombre del suplidor)', path: ['fiscalVoucher'] },
  )
  .refine(
    (data) => {
      if (data.paymentMethod === 'CARD' && !data.companyCardId) return false;
      return true;
    },
    { message: 'Debe seleccionar la tarjeta utilizada', path: ['companyCardId'] },
  );

// ---------------------------------------------------------------
// Actualizar gasto — todos los campos opcionales, sin projectId
// ---------------------------------------------------------------
export const updateExpenseSchema = baseExpenseSchema
  .omit({ projectId: true })
  .partial()
  .refine(
    (data) => {
      if (data.hasFiscalDoc && !data.fiscalVoucher) return false;
      return true;
    },
    { message: 'Debe ingresar los datos del comprobante fiscal (NCF, RNC y nombre del suplidor)', path: ['fiscalVoucher'] },
  );

// ---------------------------------------------------------------
// Anular gasto
// ---------------------------------------------------------------
export const voidExpenseSchema = z.object({
  reason: z.string({ required_error: 'El motivo de anulación es requerido' }).min(5).max(500),
});

// ---------------------------------------------------------------
// Filtros de consulta
// ---------------------------------------------------------------
export const expenseQuerySchema = z.object({
  page:          z.coerce.number().min(1).default(1),
  limit:         z.coerce.number().min(1).max(100).default(20),
  projectId:     z.string().uuid().optional(),
  categoryId:    z.coerce.number().int().positive().optional(),
  userId:        z.string().uuid().optional(),
  status:        z.enum(['PENDING_APPROVAL', 'ACTIVE', 'VOIDED', 'REJECTED']).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER']).optional(),
  hasFiscalDoc:  z.coerce.boolean().optional(),
  dateFrom:      z.string().date().optional(),
  dateTo:        z.string().date().optional(),
  minAmount:     z.coerce.number().optional(),
  maxAmount:     z.coerce.number().optional(),
  search:        z.string().optional(),
  orderBy:       z.enum(['expenseDate', 'amount', 'createdAt']).default('expenseDate'),
  order:         z.enum(['asc', 'desc']).default('desc'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type VoidExpenseInput   = z.infer<typeof voidExpenseSchema>;
export type ExpenseQuery       = z.infer<typeof expenseQuerySchema>;
