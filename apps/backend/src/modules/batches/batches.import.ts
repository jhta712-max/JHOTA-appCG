import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../middlewares/errorHandler';
import * as csv from 'csv-parse/sync';

const prisma = new PrismaClient();

interface CsvRow {
  batch_code: string;
  item_code: string;
  provincia: string;
  sector: string;
  fecha: string;
  proveedor: string;
  descripcion: string;
  categoria: string;
  monto: string;
  metodo_pago: string;
  notas_originales: string;
}

export const importBatchesFromCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      return next(new AppError(400, 'No file provided'));
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[];

    if (records.length === 0) {
      return next(new AppError(400, 'CSV file is empty'));
    }

    // Obtener el código del lote del primer registro
    const batchCode = records[0].batch_code;
    if (!batchCode) {
      return next(new AppError(400, 'batch_code is required in CSV'));
    }

    // Buscar el proyecto
    const project = await prisma.project.findUnique({
      where: { code: batchCode },
    });

    if (!project) {
      return next(new AppError(404, `Project ${batchCode} not found`));
    }

    // Habilitar batches
    if (!project.batchesEnabled) {
      await prisma.project.update({
        where: { id: project.id },
        data: { batchesEnabled: true },
      });
    }

    // Crear o buscar el batch
    let batch = await prisma.batch.findUnique({
      where: {
        projectId_code: {
          projectId: project.id,
          code: batchCode,
        },
      },
    });

    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          projectId: project.id,
          code: batchCode,
          name: `Lote ${batchCode}`,
          description: 'Lote importado de datos históricos',
          totalBudget: 0,
          status: 'ACTIVE',
        },
      });
    }

    // Crear los items necesarios
    const itemsSet = new Set(records.map(r => r.item_code));
    const itemsMap = new Map<string, any>();

    for (const itemCode of itemsSet) {
      const record = records.find(r => r.item_code === itemCode);
      if (!record) continue;

      let item = await prisma.batchItem.findUnique({
        where: {
          batchId_code: {
            batchId: batch.id,
            code: itemCode,
          },
        },
      });

      if (!item) {
        item = await prisma.batchItem.create({
          data: {
            batchId: batch.id,
            code: itemCode,
            description: `Item ${itemCode} - ${record.sector}`,
            provincia: record.provincia,
            sector: record.sector,
            budget: 0,
            status: 'ACTIVE',
          },
        });
      }

      itemsMap.set(itemCode, item);
    }

    // Importar los gastos
    let createdExpenses = 0;
    let skippedExpenses = 0;

    for (const record of records) {
      const item = itemsMap.get(record.item_code);
      if (!item) {
        continue;
      }

      // Verificar si el gasto ya existe
      const existingExpense = await prisma.expense.findFirst({
        where: {
          projectId: project.id,
          batchItemId: item.id,
          description: record.descripcion,
          amount: parseFloat(record.monto),
        },
      });

      if (existingExpense) {
        skippedExpenses++;
        continue;
      }

      // Mapear categoría
      const categoryName = record.categoria || 'Otros';
      let category = await prisma.expenseCategory.findUnique({
        where: { name: categoryName },
      });

      if (!category) {
        category = await prisma.expenseCategory.create({
          data: {
            name: categoryName,
          },
        });
      }

      // Crear el gasto
      await prisma.expense.create({
        data: {
          projectId: project.id,
          batchItemId: item.id,
          categoryId: category.id,
          userId: project.createdById,
          amount: parseFloat(record.monto),
          description: record.descripcion,
          expenseDate: record.fecha ? new Date(record.fecha) : new Date(),
          paymentMethod: 'CASH',
          notes: record.notas_originales,
        },
      });

      createdExpenses++;
    }

    // Actualizar presupuesto total del batch
    const totalBudget = await prisma.expense.aggregate({
      where: {
        batchItem: {
          batchId: batch.id,
        },
      },
      _sum: { amount: true },
    });

    await prisma.batch.update({
      where: { id: batch.id },
      data: { totalBudget: totalBudget._sum.amount || 0 },
    });

    // Actualizar presupuesto de items
    for (const [itemCode, item] of itemsMap) {
      const itemTotal = await prisma.expense.aggregate({
        where: { batchItemId: item.id },
        _sum: { amount: true },
      });

      await prisma.batchItem.update({
        where: { id: item.id },
        data: { budget: itemTotal._sum.amount || 0 },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Batches and expenses imported successfully',
      data: {
        projectCode: project.code,
        batchCode: batch.code,
        itemsCount: itemsMap.size,
        expensesCreated: createdExpenses,
        expensesSkipped: skippedExpenses,
        totalBudget: totalBudget._sum.amount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
