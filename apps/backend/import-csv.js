#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const csv = require('csv-parse/sync');

const prisma = new PrismaClient();

const parseDate = (dateStr) => {
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

const sanitizeText = (text) => {
  if (!text) return '';
  return text.trim();
};

async function cleanup() {
  console.log('\n=== LIMPIANDO BASE DE DATOS ===\n');

  try {
    // Eliminar todos los gastos primero (dependencia de clave foránea)
    const expensesDeleted = await prisma.expense.deleteMany({});
    console.log(`✓ Eliminados ${expensesDeleted.count} gastos`);

    // Eliminar todos los items del lote
    const itemsDeleted = await prisma.batchItem.deleteMany({});
    console.log(`✓ Eliminados ${itemsDeleted.count} items del lote`);

    // Eliminar todos los lotes
    const batchesDeleted = await prisma.batch.deleteMany({});
    console.log(`✓ Eliminados ${batchesDeleted.count} lotes`);

    // Verificar limpieza
    const expenseCount = await prisma.expense.count();
    const itemCount = await prisma.batchItem.count();
    const batchCount = await prisma.batch.count();

    console.log(`\nVerificación:`);
    console.log(`  Gastos: ${expenseCount}`);
    console.log(`  Items: ${itemCount}`);
    console.log(`  Lotes: ${batchCount}`);

    if (expenseCount === 0 && itemCount === 0 && batchCount === 0) {
      console.log('\n✓ ¡Limpieza completada exitosamente!\n');
      return true;
    }
    return false;
  } catch (error) {
    console.error('✗ Error durante limpieza:', error.message);
    return false;
  }
}

async function importCSV() {
  console.log('=== IMPORTANDO CSV ===\n');

  try {
    // Leer el archivo CSV
    const csvPath = path.join(__dirname, '../..', 'GASTOS_ARCHIVOS_MADRE_FINAL_CLEAN.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`✗ Archivo CSV no encontrado: ${csvPath}`);
      return false;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    console.log(`Total de registros en CSV: ${records.length}`);
    if (records.length === 0) {
      console.error('✗ CSV vacío o sin registros válidos');
      return false;
    }

    // Obtener código del lote del primer registro
    let batchCode = '';
    for (const record of records) {
      if (record.batch_code?.trim()) {
        batchCode = record.batch_code.trim();
        break;
      }
    }

    if (!batchCode) {
      console.error('✗ No se encontró batch_code válido en CSV');
      return false;
    }

    console.log(`Código de lote: ${batchCode}\n`);

    // Buscar o crear proyecto
    let project = await prisma.project.findUnique({
      where: { code: batchCode },
    });

    if (!project) {
      console.log(`Proyecto no encontrado. Creando ${batchCode}...`);
      project = await prisma.project.create({
        data: {
          code: batchCode,
          name: batchCode,
          budget: 0,
          batchesEnabled: true,
        },
      });
    }

    console.log(`✓ Proyecto: ${project.code}`);

    // Habilitar batches si no está habilitado
    if (!project.batchesEnabled) {
      await prisma.project.update({
        where: { id: project.id },
        data: { batchesEnabled: true },
      });
    }

    // Crear o buscar batch
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
          name: batchCode,
          budget: 0,
        },
      });
      console.log(`✓ Lote creado: ${batch.code}`);
    } else {
      console.log(`✓ Lote encontrado: ${batch.code}`);
    }

    // Procesar registros
    const items = {};
    let importedCount = 0;
    let duplicateCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowIndex = i + 1;

      try {
        // Validar campos requeridos
        const validationErrors = [];
        if (!record.batch_code?.trim()) validationErrors.push('batch_code vacío');
        if (!record.item_code?.trim()) validationErrors.push('item_code vacío');
        if (!record.descripcion?.trim()) validationErrors.push('descripcion vacío');
        if (!record.provincia?.trim()) validationErrors.push('provincia vacío');
        if (!record.sector?.trim()) validationErrors.push('sector vacío');

        const monto = parseFloat(record.monto || '0');
        if (isNaN(monto) || monto === 0) {
          validationErrors.push(`monto inválido: "${record.monto}"`);
        }

        if (validationErrors.length > 0) {
          errors.push(`Fila ${rowIndex}: ${validationErrors.join('; ')}`);
          continue;
        }

        const itemCode = sanitizeText(record.item_code);

        // Crear o buscar item
        if (!items[itemCode]) {
          let batchItem = await prisma.batchItem.findUnique({
            where: {
              batchId_code: {
                batchId: batch.id,
                code: itemCode,
              },
            },
          });

          if (!batchItem) {
            batchItem = await prisma.batchItem.create({
              data: {
                batchId: batch.id,
                code: itemCode,
                provincia: sanitizeText(record.provincia),
                sector: sanitizeText(record.sector),
                budget: 0,
              },
            });
          }

          items[itemCode] = batchItem;
        }

        const item = items[itemCode];
        const amount = parseFloat(record.monto);
        const expenseDate = parseDate(record.fecha);
        const descripcion = sanitizeText(record.descripcion);

        // Verificar duplicados
        const existingExpense = await prisma.expense.findFirst({
          where: {
            projectId: project.id,
            batchItemId: item.id,
            description: descripcion,
            amount: new Prisma.Decimal(amount),
            expenseDate: expenseDate,
          },
        });

        if (existingExpense) {
          duplicateCount++;
          console.log(`[FILA ${rowIndex}] ⊘ Duplicado detectado: ${descripcion}`);
          continue;
        }

        // Crear gasto
        await prisma.expense.create({
          data: {
            projectId: project.id,
            batchItemId: item.id,
            description: descripcion,
            category: sanitizeText(record.categoria || 'Otros'),
            amount: new Prisma.Decimal(amount),
            expenseDate: expenseDate,
            paymentMethod: sanitizeText(record.metodo_pago || 'CASH'),
            provider: sanitizeText(record.proveedor || 'N/A'),
            notes: sanitizeText(record.notas_originales || ''),
          },
        });

        importedCount++;
        if (importedCount % 50 === 0) {
          console.log(`  ... ${importedCount} gastos importados`);
        }
      } catch (error) {
        errors.push(`Fila ${rowIndex}: ${error.message}`);
      }
    }

    console.log(`\n=== RESULTADOS DE IMPORTACIÓN ===\n`);
    console.log(`✓ Gastos importados: ${importedCount}`);
    console.log(`⊘ Duplicados detectados: ${duplicateCount}`);

    if (errors.length > 0) {
      console.log(`\n✗ Errores (${errors.length}):`);
      errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... y ${errors.length - 10} errores más`);
      }
    }

    // Verificación final
    const finalExpenseCount = await prisma.expense.count();
    const finalItemCount = await prisma.batchItem.count();

    console.log(`\nVerificación final:`);
    console.log(`  Total gastos en BD: ${finalExpenseCount}`);
    console.log(`  Total items: ${finalItemCount}`);

    return importedCount === records.length - duplicateCount;
  } catch (error) {
    console.error('✗ Error durante importación:', error.message);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  HERRAMIENTA DE LIMPIEZA E IMPORTACIÓN  ║');
  console.log('╚════════════════════════════════════════╝');

  const cleanupSuccess = await cleanup();
  if (!cleanupSuccess) {
    console.error('\n✗ Falló la limpieza de la base de datos');
    process.exit(1);
  }

  const importSuccess = await importCSV();

  console.log('\n╔════════════════════════════════════════╗');
  if (importSuccess) {
    console.log('║  ✓ PROCESO COMPLETADO EXITOSAMENTE    ║');
  } else {
    console.log('║  ✗ PROCESO COMPLETADO CON ERRORES     ║');
  }
  console.log('╚════════════════════════════════════════╝\n');

  process.exit(importSuccess ? 0 : 1);
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
