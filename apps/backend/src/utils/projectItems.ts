import prisma from '../config/database';
import { AppError } from '../middlewares/errorHandler';

/**
 * Resuelve y valida el item de proyecto para un registro nuevo.
 *
 * Reglas:
 * - Si llega projectItemId: debe pertenecer al proyecto. Si está inactivo solo
 *   se acepta cuando viene heredado de un registro fuente (opts.inherited).
 * - Si NO llega y el proyecto tiene items activos: error PROJECT_ITEM_REQUIRED
 *   (salvo herencia, donde la fuente simplemente no tenía item).
 */
export async function resolveProjectItemId(
  projectId: string,
  projectItemId?: string | null,
  opts: { inherited?: boolean } = {},
): Promise<string | null> {
  if (projectItemId) {
    const item = await prisma.projectItem.findUnique({ where: { id: projectItemId } });
    if (!item || item.projectId !== projectId)
      throw new AppError(400, 'El item seleccionado no pertenece a este proyecto', 'INVALID_PROJECT_ITEM');
    if (!item.active && !opts.inherited)
      throw new AppError(400, 'El item del proyecto está inactivo', 'INVALID_PROJECT_ITEM');
    return item.id;
  }

  if (opts.inherited) return null;

  const activeItems = await prisma.projectItem.count({ where: { projectId, active: true } });
  if (activeItems > 0)
    throw new AppError(
      400,
      'Este proyecto tiene items definidos: selecciona el item al que pertenece el registro',
      'PROJECT_ITEM_REQUIRED',
    );
  return null;
}

/** Select estándar para incluir el item en respuestas. */
export const PROJECT_ITEM_SELECT = { select: { id: true, number: true, name: true, active: true } } as const;
