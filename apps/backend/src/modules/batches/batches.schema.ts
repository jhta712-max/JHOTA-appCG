import { z } from 'zod';

export const createBatchSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  totalBudget: z.number().default(0),
});

export const updateBatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  totalBudget: z.number().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const createBatchItemSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().min(1),
  provincia: z.string().min(1).max(100),
  sector: z.string().min(1).max(200),
  budget: z.number().default(0),
});

export const updateBatchItemSchema = z.object({
  description: z.string().min(1).optional(),
  provincia: z.string().min(1).max(100).optional(),
  sector: z.string().min(1).max(200).optional(),
  budget: z.number().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});
