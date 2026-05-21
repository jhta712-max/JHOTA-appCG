import { z } from 'zod';

const ACCOUNT_TYPES = ['Cuenta de Ahorros', 'Cuenta Corriente', 'Cuenta Nómina'] as const;

/** Normaliza variantes del tipo de cuenta al valor canónico aceptado */
function normalizeAccountType(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const v = val.toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
  if (v.includes('corriente'))  return 'Cuenta Corriente';
  if (v.includes('nomina'))     return 'Cuenta Nómina';
  if (v.includes('ahorro'))     return 'Cuenta de Ahorros';
  // Si ya viene en formato canónico exacto, pasa directo
  return val;
}

/** Convierte string vacío a undefined */
const optionalStr = (max: number) =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().max(max).optional(),
  );

export const createBeneficiarySchema = z.object({
  name:          z.string().min(2).max(200),
  bank:          z.string().min(2).max(100),
  accountType:   z.preprocess(normalizeAccountType, z.enum(ACCOUNT_TYPES)),
  accountNumber: z.string().min(4).max(50),
  cedula:        optionalStr(20),
  phone:         optionalStr(20),
});

export const updateBeneficiarySchema = createBeneficiarySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiarySchema>;
