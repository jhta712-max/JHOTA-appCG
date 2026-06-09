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

const CURRENCIES = ['RD$', 'US$', '€'] as const;

export const createBankAccountSchema = z.object({
  bank:          z.string().min(2).max(100),
  accountType:   z.enum(ACCOUNT_TYPES).default('Cuenta de Ahorros'),
  accountNumber: z.string().min(4).max(50),
  currency:      z.enum(CURRENCIES).default('RD$'),
  isDefault:     z.boolean().optional().default(false),
  notes:         z.string().max(200).optional().nullable(),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export type CreateSupplierInput    = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput    = z.infer<typeof updateSupplierSchema>;
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
