import { PrismaClient } from '@prisma/client';
import { AppError } from '../../lib/errors';

const prisma = new PrismaClient();

export const batchesService = {
  // ============ BATCHES ============

  async createBatch(projectId: string, data: { code: string; name: string; description?: string; totalBudget?: number }) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Proyecto no encontrado', 404);
    if (!project.batchesEnabled) {
      throw new AppError('Los lotes no están habilitados en este proyecto', 400);
    }

    const existingBatch = await prisma.batch.findUnique({
      where: { projectId_code: { projectId, code: data.code } },
    });
    if (existingBatch) throw new AppError('Ya existe un lote con este código', 400);

    return prisma.batch.create({
      data: {
        projectId,
        code: data.code,
        name: data.name,
        description: data.description,
        totalBudget: data.totalBudget || 0,
      },
      include: { items: true },
    });
  },

  async getBatchesByProject(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Proyecto no encontrado', 404);

    return prisma.batch.findMany({
      where: { projectId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getBatchById(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          include: {
            expenses: {
              where: { status: 'ACTIVE' },
              select: { id: true, amount: true },
            },
          },
        },
        project: true,
      },
    });

    if (!batch) throw new AppError('Lote no encontrado', 404);
    return batch;
  },

  async updateBatch(batchId: string, data: { name?: string; description?: string; totalBudget?: number; status?: string }) {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError('Lote no encontrado', 404);

    return prisma.batch.update({
      where: { id: batchId },
      data: {
        name: data.name,
        description: data.description,
        totalBudget: data.totalBudget,
        status: data.status,
      },
      include: { items: true },
    });
  },

  async deleteBatch(batchId: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { items: { include: { expenses: true } } },
    });

    if (!batch) throw new AppError('Lote no encontrado', 404);

    // Verificar si hay gastos vinculados
    const hasExpenses = batch.items.some((item) => item.expenses.length > 0);
    if (hasExpenses) {
      throw new AppError('No se puede eliminar un lote con gastos vinculados', 400);
    }

    return prisma.batch.delete({ where: { id: batchId } });
  },

  // ============ BATCH ITEMS ============

  async createBatchItem(
    batchId: string,
    data: { code: string; description: string; provincia: string; sector: string; budget?: number }
  ) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { project: true },
    });

    if (!batch) throw new AppError('Lote no encontrado', 404);
    if (!batch.project.batchesEnabled) {
      throw new AppError('Los lotes no están habilitados en el proyecto', 400);
    }

    const existingItem = await prisma.batchItem.findUnique({
      where: { batchId_code: { batchId, code: data.code } },
    });
    if (existingItem) throw new AppError('Ya existe un item con este código en el lote', 400);

    return prisma.batchItem.create({
      data: {
        batchId,
        code: data.code,
        description: data.description,
        provincia: data.provincia,
        sector: data.sector,
        budget: data.budget || 0,
      },
    });
  },

  async getBatchItemsByBatch(batchId: string) {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError('Lote no encontrado', 404);

    return prisma.batchItem.findMany({
      where: { batchId },
      include: {
        expenses: {
          where: { status: 'ACTIVE' },
          select: { id: true, amount: true, description: true, expenseDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getBatchItemById(itemId: string) {
    const item = await prisma.batchItem.findUnique({
      where: { id: itemId },
      include: {
        batch: { include: { project: true } },
        expenses: {
          where: { status: 'ACTIVE' },
          include: {
            category: true,
            registeredBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!item) throw new AppError('Item del lote no encontrado', 404);
    return item;
  },

  async updateBatchItem(
    itemId: string,
    data: { description?: string; provincia?: string; sector?: string; budget?: number; status?: string }
  ) {
    const item = await prisma.batchItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Item del lote no encontrado', 404);

    return prisma.batchItem.update({
      where: { id: itemId },
      data: {
        description: data.description,
        provincia: data.provincia,
        sector: data.sector,
        budget: data.budget,
        status: data.status,
      },
    });
  },

  async deleteBatchItem(itemId: string) {
    const item = await prisma.batchItem.findUnique({
      where: { id: itemId },
      include: { expenses: true },
    });

    if (!item) throw new AppError('Item del lote no encontrado', 404);

    // Verificar si hay gastos vinculados
    if (item.expenses.length > 0) {
      throw new AppError('No se puede eliminar un item con gastos vinculados', 400);
    }

    return prisma.batchItem.delete({ where: { id: itemId } });
  },

  // ============ PROJECT BATCHES TOGGLE ============

  async enableBatches(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Proyecto no encontrado', 404);

    return prisma.project.update({
      where: { id: projectId },
      data: { batchesEnabled: true },
    });
  },

  async disableBatches(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { batches: { include: { items: true } } },
    });

    if (!project) throw new AppError('Proyecto no encontrado', 404);
    if (!project.batchesEnabled) {
      throw new AppError('Los lotes ya están deshabilitados', 400);
    }

    // Validación: no permitir deshabilitar si hay lotes con items
    if (project.batches.length > 0) {
      const hasItems = project.batches.some((batch) => batch.items.length > 0);
      if (hasItems) {
        throw new AppError(
          'No se puede deshabilitar los lotes si existen lotes con items. Primero elimine los lotes.',
          400
        );
      }
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { batchesEnabled: false },
    });
  },
};
