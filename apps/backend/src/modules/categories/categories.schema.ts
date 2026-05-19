import { z } from 'zod';

export const createCategorySchema = z.object({
  name:        z.string({ required_error: 'El nombre es requerido' }).min(2).max(100),
  description: z.string().max(500).optional(),
  icon:        z.string().max(50).optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
