import { z } from 'zod';

export const createSchema = z.object({
  name:          z.string().min(1).max(100),
  provider:      z.string().min(1).max(100),
  description:   z.string().optional(),
  monthlyCost:   z.number().min(0),
  currency:      z.string().default('USD'),
  billingDay:    z.number().int().min(1).max(31),
  paymentMethod: z.string().optional(),
  url:           z.string().url().optional().or(z.literal('')),
  isActive:      z.boolean().default(true),
  notes:         z.string().optional(),
});

export const updateSchema = createSchema.partial();

export type CreateSubscriptionInput = z.infer<typeof createSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSchema>;
