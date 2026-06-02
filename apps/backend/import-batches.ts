import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

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

async function main() {
  try {
    console.log('🚀 Iniciando importación de lotes y gastos...\n');

    // Leer el CSV
    const csvPath = path.join(__dirname, 'GASTOS_AJUSTADO_PARA_IMPORTACION.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[];

    console.log(`📊 Total de registros en CSV: ${records.length}\n`);

    // Buscar o crear el proyecto
    const projectCode = 'MOPC-CCC-LPN-2021-0036';
    const project = await prisma.project.findUnique({
      where: { code: projectCode },
    });

    if (!project) {
      console.error(`❌ Proyecto ${projectCode} no encontrado`);
      process.exit(1);
    }

    console.log(`✅ Proyecto encontrado: ${project.name} (ID: ${project.id})\n`);

    // Habilitar batches en el proyecto
    if (!project.batchesEnabled) {
      await prisma.project.update({
        where: { id: project.id },
        data: { batchesEnabled: true },
      });
      console.log('✅ Modo batches habilitado en el proyecto\n');
    } else {
      console.log('ℹ️  Modo batches ya estaba habilitado\n');
    }

    // Crear o buscar el batch
    const batchCode = projectCode;
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
      console.log(`✅ Lote creado: ${batch.code} (ID: ${batch.id})\n`);
    } else {
      console.log(`ℹ️  Lote ya existe: ${batch.code} (ID: ${batch.id})\n`);
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
        console.log(`✅ Item creado: ${item.code} - ${item.sector}`);
      } else {
        console.log(`ℹ️  Item ya existe: ${item.code}`);
      }

      itemsMap.set(itemCode, item);
    }

    console.log(`\n📋 Total de items: ${itemsMap.size}\n`);

    // Importar los gastos
    let createdExpenses = 0;
    let skippedExpenses = 0;

    for (const record of records) {
      const item = itemsMap.get(record.item_code);
      if (!item) {
        console.error(`❌ Item ${record.item_code} no encontrado`);
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

    console.log(`✅ Gastos importados: ${createdExpenses}`);
    console.log(`⏭️  Gastos saltados (duplicados): ${skippedExpenses}\n`);

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

    console.log('📊 Resumen de importación:');
    console.log(`   Proyecto: ${project.code}`);
    console.log(`   Lote: ${batch.code}`);
    console.log(`   Items: ${itemsMap.size}`);
    console.log(`   Gastos creados: ${createdExpenses}`);
    console.log(`   Presupuesto total: RD$${(totalBudget._sum.amount || 0).toLocaleString('es-DO')}`);
    console.log('\n✅ Importación completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
