import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import * as csv from 'csv-parse/sync';

interface CsvRow {
  batch_code?: string;
  item_code?: string;
  provincia?: string;
  sector?: string;
  fecha?: string;
  proveedor?: string;
  descripcion?: string;
  categoria?: string;
  monto?: string;
  metodo_pago?: string;
  notas_originales?: string;
}

interface ImportStats {
  totalRecords: number;
  createdExpenses: number;
  skippedExpenses: number;
  errorRecords: string[];
}

const validateAndSanitizeRecord = (record: CsvRow, rowIndex: number): { valid: boolean; error?: string; data?: CsvRow } => {
  const errors: string[] = [];

  // Validar campos requeridos
  if (!record.batch_code?.trim()) errors.push(`batch_code vacío`);
  if (!record.item_code?.trim()) errors.push(`item_code vacío`);
  if (!record.descripcion?.trim()) errors.push(`descripcion vacío`);
  if (!record.provincia?.trim()) errors.push(`provincia vacío`);
  if (!record.sector?.trim()) errors.push(`sector vacío`);

  // Validar monto (permite negativos para notas de crédito)
  const monto = parseFloat(record.monto || '0');
  if (isNaN(monto) || monto === 0) {
    errors.push(`monto inválido: "${record.monto}"`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Fila ${rowIndex + 1}: ${errors.join('; ')}`,
    };
  }

  return {
    valid: true,
    data: {
      batch_code: record.batch_code!.trim(),
      item_code: record.item_code!.trim(),
      provincia: record.provincia!.trim(),
      sector: record.sector!.trim(),
      fecha: record.fecha?.trim() || '',
      proveedor: record.proveedor?.trim() || 'N/A',
      descripcion: record.descripcion!.trim(),
      categoria: record.categoria?.trim() || 'Otros',
      monto: record.monto!.trim(),
      metodo_pago: record.metodo_pago?.trim() || 'CASH',
      notas_originales: record.notas_originales?.trim() || '',
    },
  };
};

const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();

  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    // Continuar con fecha actual
  }

  return new Date();
};

export const importBatchesFromCsv = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      return next(new AppError(400, 'No CSV file provided'));
    }

    let records: CsvRow[] = [];
    try {
      const csvContent = req.file.buffer.toString('utf-8');
      records = csv.parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }) as CsvRow[];
    } catch (parseError) {
      return next(new AppError(400, `CSV parsing error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
    }

    if (records.length === 0) {
      return next(new AppError(400, 'CSV file is empty or has no valid records'));
    }

    console.log(`[IMPORT] Total records in CSV: ${records.length}`);

    // Obtener el código del lote del primer registro válido
    let batchCode = '';
    for (const record of records) {
      if (record.batch_code?.trim()) {
        batchCode = record.batch_code.trim();
        break;
      }
    }

    if (!batchCode) {
      return next(new AppError(400, 'No valid batch_code found in CSV'));
    }

    // Buscar el proyecto
    const project = await prisma.project.findUnique({
      where: { code: batchCode },
    });

    if (!project) {
      return next(new AppError(404, `Project ${batchCode} not found`));
    }

    console.log(`[IMPORT] Found project: ${project.code}`);

    // Habilitar batches si no está habilitado
    if (!project.batchesEnabled) {
      await prisma.project.update({
        where: { id: project.id },
        data: { batchesEnabled: true },
      });
      console.log(`[IMPORT] Enabled batches mode for project`);
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
      console.log(`[IMPORT] Created batch: ${batchCode}`);
    } else {
      console.log(`[IMPORT] Batch already exists: ${batchCode}`);
    }

    // Crear los items necesarios
    const itemsSet = new Set<string>();
    records.forEach(r => {
      if (r.item_code?.trim()) {
        itemsSet.add(r.item_code.trim());
      }
    });

    const itemsMap = new Map<string, any>();

    for (const itemCode of itemsSet) {
      const record = records.find(r => r.item_code?.trim() === itemCode);
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
            description: `Item ${itemCode} - ${record.sector || 'N/A'}`,
            provincia: record.provincia || 'N/A',
            sector: record.sector || 'N/A',
            budget: 0,
            status: 'ACTIVE',
          },
        });
        console.log(`[IMPORT] Created item: ${itemCode}`);
      }

      itemsMap.set(itemCode, item);
    }

    console.log(`[IMPORT] Total items: ${itemsMap.size}`);

    // Importar los gastos con manejo de errores robusto
    const stats: ImportStats = {
      totalRecords: records.length,
      createdExpenses: 0,
      skippedExpenses: 0,
      errorRecords: [],
    };

    // Mapa de categorías en cache para evitar queries repetidas
    const categoryCache = new Map<string, any>();

    for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
      const record = records[rowIndex];

      try {
        // Validar y sanitizar registro
        const validation = validateAndSanitizeRecord(record, rowIndex);
        if (!validation.valid) {
          stats.errorRecords.push(validation.error!);
          continue;
        }

        const sanitized = validation.data!;
        const item = itemsMap.get(sanitized.item_code!);

        if (!item) {
          stats.errorRecords.push(`Fila ${rowIndex + 1}: Item ${sanitized.item_code} no encontrado`);
          continue;
        }

        // Parsear monto (permite negativos para notas de crédito)
        const amount = parseFloat(sanitized.monto!);
        if (isNaN(amount) || amount === 0) {
          stats.errorRecords.push(`Fila ${rowIndex + 1}: Monto inválido: ${sanitized.monto}`);
          continue;
        }

        // Verificar si el gasto ya existe (usando transacción para evitar duplicados)
        // Un gasto es duplicado solo si tiene TODOS estos campos iguales: item, descripción, monto Y fecha
        const parsedExpenseDate = parseDate(sanitized.fecha || '');
        const existingExpense = await prisma.expense.findFirst({
          where: {
            projectId: project.id,
            batchItemId: item.id,
            description: sanitized.descripcion!,
            amount: new Prisma.Decimal(amount),
            expenseDate: parsedExpenseDate,
          },
        });

        if (existingExpense) {
          stats.skippedExpenses++;
          continue;
        }

        // Obtener o crear categoría
        const categoryName = sanitized.categoria!;
        let category = categoryCache.get(categoryName);
        if (!category) {
          category = await prisma.expenseCategory.findUnique({
            where: { name: categoryName },
          });

          if (!category) {
            category = await prisma.expenseCategory.create({
              data: { name: categoryName },
            }).catch(err => {
              // Si falla por duplicado concurrente, buscar de nuevo
              return prisma.expenseCategory.findUnique({
                where: { name: categoryName },
              });
            });
          }

          categoryCache.set(categoryName, category);
        }

        if (!category) {
          stats.errorRecords.push(`Fila ${rowIndex + 1}: No se pudo crear/obtener categoría ${categoryName}`);
          continue;
        }

        // Crear el gasto
        await prisma.expense.create({
          data: {
            projectId: project.id,
            batchItemId: item.id,
            categoryId: category.id,
            userId: project.createdById,
            amount: new Prisma.Decimal(amount),
            description: sanitized.descripcion!,
            expenseDate: parseDate(sanitized.fecha || ''),
            paymentMethod: 'CASH',
            notes: sanitized.notas_originales || '',
          },
        }).catch(err => {
          // Si falla por duplicado concurrente, contar como saltado
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            stats.skippedExpenses++;
          } else {
            throw err;
          }
        });

        stats.createdExpenses++;

        // Log de progreso cada 50 registros
        if ((rowIndex + 1) % 50 === 0) {
          console.log(`[IMPORT] Processed ${rowIndex + 1}/${records.length} records`);
        }
      } catch (recordError) {
        const errorMsg = recordError instanceof Error ? recordError.message : String(recordError);
        stats.errorRecords.push(`Fila ${rowIndex + 1}: Error: ${errorMsg}`);
        console.error(`[IMPORT] Error in row ${rowIndex + 1}:`, recordError);
      }
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
      try {
        const itemTotal = await prisma.expense.aggregate({
          where: { batchItemId: item.id },
          _sum: { amount: true },
        });

        await prisma.batchItem.update({
          where: { id: item.id },
          data: { budget: itemTotal._sum.amount || 0 },
        });
      } catch (err) {
        console.error(`[IMPORT] Error updating budget for item ${itemCode}:`, err);
      }
    }

    console.log(`[IMPORT] Import completed. Created: ${stats.createdExpenses}, Skipped: ${stats.skippedExpenses}, Errors: ${stats.errorRecords.length}`);

    res.status(200).json({
      success: true,
      message: 'Import completed',
      data: {
        projectCode: project.code,
        batchCode: batch.code,
        itemsCount: itemsMap.size,
        expensesCreated: stats.createdExpenses,
        expensesSkipped: stats.skippedExpenses,
        errorRecords: stats.errorRecords.length,
        totalBudget: (totalBudget._sum.amount || 0).toString(),
        errors: stats.errorRecords.slice(0, 20), // Devolver primeros 20 errores
      },
    });
  } catch (error) {
    console.error('[IMPORT] Fatal error:', error);
    next(error);
  }
};
