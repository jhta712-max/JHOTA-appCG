import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

export const BATCH_ITEM_SELECT = {
  select: { id: true, code: true, description: true, provincia: true, sector: true, budget: true },
} as const;

/**
 * Validates that a batchItemId belongs to the given project.
 * If the project has active batch items and no itemId is provided, throws PROJECT_ITEM_REQUIRED.
 * Pass { inherited: true } when the id is inherited from a parent record (skips required check).
 */
export async function resolveBatchItemId(
  projectId: string,
  batchItemId?: string | null,
  opts: { inherited?: boolean } = {},
): Promise<string | null> {
  if (batchItemId) {
    // Validate the item belongs to this project
    const item = await prisma.batchItem.findFirst({
      where: {
        id: batchItemId,
        batch: { projectId },
      },
    });
    if (!item) throw new AppError(400, 'El item no pertenece a este proyecto', 'INVALID_BATCH_ITEM');
    return batchItemId;
  }

  if (opts.inherited) return null;

  // Check if project has active batch items — if so, field is required
  const count = await prisma.batchItem.count({
    where: { batch: { projectId }, status: 'ACTIVE' },
  });
  if (count > 0) {
    throw new AppError(400, 'Este proyecto requiere identificar el ítem del gasto', 'PROJECT_ITEM_REQUIRED');
  }

  return null;
}
