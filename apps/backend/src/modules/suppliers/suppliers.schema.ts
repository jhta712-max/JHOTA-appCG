import { z } from 'zod';

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

export const createSupplierSchema = z.object({
  name:          z.string().min(2).max(200),
  rnc:           z.string().length(9).or(z.string().length(11)).optional().nullable(),
  cedula:        z.string().max(20).optional().nullable(),
  phone:         z.string().max(20).optional().nullable(),
  email:         z.string().email().max(150).optional().nullable(),
  address:       z.string().max(500).optional().nullable(),
  notes:         z.string().max(1000).optional().nullable(),
  // Datos bancarios (opcionales — para recibir pagos directos)
  bank:          z.string().max(100).optional().nullable(),
  accountType:   z.enum(ACCOUNT_TYPES).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
