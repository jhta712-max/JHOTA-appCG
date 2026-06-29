import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

export async function getAll(includeInactive = false) {
  return prisma.expenseCategory.findMany({
    where:   includeInactive ? {} : { isActive: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
}

export async function getById(id: number) {
  const cat = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!cat) throw new AppError(404, 'Categoría no encontrada', 'NOT_FOUND');
  return cat;
}

export async function create(data: CreateCategoryInput) {
  const existing = await prisma.expenseCategory.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError(409, `Ya existe la categoría "${data.name}"`, 'DUPLICATE');
  return prisma.expenseCategory.create({ data });
}

export async function update(id: number, data: UpdateCategoryInput) {
  const cat = await getById(id);
  if (cat.isSystem && data.name && data.name !== cat.name) {
    throw new AppError(400, 'No se puede cambiar el nombre de una categoría del sistema', 'SYSTEM_CATEGORY');
  }
  return prisma.expenseCategory.update({ where: { id }, data });
}

export async function merge(sourceId: number, targetId: number) {
  if (sourceId === targetId) throw new AppError(400, 'La categoría origen y destino no pueden ser la misma', 'SAME_CATEGORY');
  const [source, target] = await Promise.all([getById(sourceId), getById(targetId)]);
  if (source.isSystem) throw new AppError(400, 'No se puede fusionar una categoría del sistema como origen', 'SYSTEM_CATEGORY');

  await prisma.$transaction([
    prisma.expense.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } }),
    prisma.quotation.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } }),
    prisma.projectCategoryBudget.deleteMany({ where: { categoryId: sourceId } }),
    prisma.expenseCategory.delete({ where: { id: sourceId } }),
  ]);

  return { merged: source.name, into: target.name };
}

export async function remove(id: number) {
  const cat = await getById(id);
  if (cat.isSystem) {
    throw new AppError(400, 'No se pueden eliminar las categorías del sistema', 'SYSTEM_CATEGORY');
  }
  const inUse = await prisma.expense.count({ where: { categoryId: id } });
  if (inUse > 0) {
    throw new AppError(409, `Esta categoría tiene ${inUse} gasto(s) asociado(s). Desactívala en su lugar.`, 'IN_USE');
  }
  await prisma.expenseCategory.delete({ where: { id } });
  return cat;
}
