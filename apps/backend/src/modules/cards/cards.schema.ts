import { z } from 'zod';

const CARD_TYPES = ['VISA', 'MASTERCARD', 'AMEX', 'DINERS', 'OTHER'] as const;

export const createCardSchema = z.object({
  holderName: z.string({ required_error: 'El nombre del tarjetahabiente es requerido' }).min(2).max(150),
  lastFour:   z.string({ required_error: 'Los últimos 4 dígitos son requeridos' })
               .length(4, 'Deben ser exactamente 4 dígitos')
               .regex(/^\d{4}$/, 'Solo se permiten dígitos'),
  cardType:   z.enum(CARD_TYPES, { required_error: 'El tipo de tarjeta es requerido' }),
  bank:       z.string({ required_error: 'El banco emisor es requerido' }).min(2).max(100),
});

export const updateCardSchema = createCardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
