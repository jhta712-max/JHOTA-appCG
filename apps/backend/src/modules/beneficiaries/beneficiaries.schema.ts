import { z } from 'zod';

/** Normaliza variantes de tipo de cuenta al valor canónico */
function normalizeAccountType(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const v = val.toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (v === 'corriente' || v === 'cuenta corriente')                            return 'Cuenta Corriente';
  if (v === 'nomina'    || v === 'cuenta nomina' || v.includes('nomina'))       return 'Cuenta Nómina';
  if (v === 'ahorro'    || v === 'ahorros' || v === 'cuenta de ahorros')        return 'Cuenta de Ahorros';
  return val; // pasa tal cual al enum para que produzca el error descriptivo
}

export const createBeneficiarySchema = z.object({
  name:          z.string().min(2).max(200),
  bank:          z.string().min(2).max(100),
  accountType:   z.preprocess(normalizeAccountType,
                   z.enum(['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'])),
  accountNumber: z.string().min(4).max(50),
  cedula:        z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  phone:         z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
});

export const updateBeneficiarySchema = createBeneficiarySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiarySchema>;
