import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import FormData from 'form-data';

dotenv.config();

async function importBatches() {
  try {
    console.log('🚀 Iniciando importación de lotes mediante API...\n');

    const csvPath = path.join(__dirname, 'GASTOS_AJUSTADO_PARA_IMPORTACION.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ Archivo CSV no encontrado: ${csvPath}`);
      process.exit(1);
    }

    // Intentar conectar al servidor backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiUrl = `${backendUrl}/api/v1/batches/import`;

    console.log(`📤 Subiendo CSV a: ${apiUrl}\n`);

    // Crear FormData con el archivo
    const form = new FormData();
    form.append('file', fs.createReadStream(csvPath), 'GASTOS_AJUSTADO_PARA_IMPORTACION.csv');

    // Obtener token de autenticación (opcional, pero recomendado)
    let authToken = '';
    if (process.env.AUTH_TOKEN) {
      authToken = process.env.AUTH_TOKEN;
    }

    // Usar fetch nativo si disponible (Node 18+), sino usar node-fetch
    const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');

    // Realizar la petición
    const response = await fetchFn(apiUrl, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Error en la importación (${response.status}):`);
      console.error(errorBody);
      process.exit(1);
    }

    const result = await response.json() as any;

    console.log('✅ Importación completada exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   Proyecto: ${result.data.projectCode}`);
    console.log(`   Lote: ${result.data.batchCode}`);
    console.log(`   Items: ${result.data.itemsCount}`);
    console.log(`   Gastos creados: ${result.data.expensesCreated}`);
    console.log(`   Gastos saltados (duplicados): ${result.data.expensesSkipped}`);
    console.log(`   Presupuesto total: RD$${(result.data.totalBudget).toLocaleString('es-DO')}\n`);

  } catch (error) {
    console.error('❌ Error durante la importación:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

importBatches();
