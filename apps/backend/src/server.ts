import { execSync } from 'child_process';
import { env } from './config/env';
import { logger } from './utils/logger';
import prisma from './config/database';
import app from './app';
import { startAllMonitoringJobs } from './jobs/healthMonitor';
import { startQuotationNotificationJob } from './jobs/quotationNotifications';
import { startBusinessNotificationJob }  from './jobs/businessNotifications';
import { forceFlush } from './middlewares/requestLogger';

async function start() {
  try {
    // Resuelve migraciones en estado failed antes del deploy (P3009).
    // Cada resolve falla silenciosamente si la migración no está en ese estado.
    const rolledBack = [
      '20260531000000_init_baseline',
      '20260531000001_fill_baseline_gap',
      '20260602000001_add_bidding_to_office_expense_category',
    ];
    for (const m of rolledBack) {
      try {
        execSync(`./node_modules/.bin/prisma migrate resolve --rolled-back ${m} --schema ./prisma/schema.prisma`, { stdio: 'pipe', cwd: process.cwd() });
        logger.info(`Migration rolled-back: ${m}`);
      } catch (_) { /* no estaba en failed, ignorar */ }
    }
    // Marca la baseline como aplicada (los 20260518* ya crearon el schema base).
    try {
      execSync('./node_modules/.bin/prisma migrate resolve --applied 20260531000000_init_baseline --schema ./prisma/schema.prisma', { stdio: 'pipe', cwd: process.cwd() });
      logger.info('Baseline migration marcada como applied.');
    } catch (_) { /* ya está aplicada, ignorar */ }

    try {
      logger.info('Ejecutando migraciones de base de datos...');
      execSync('./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      logger.info('Migraciones completadas.');
    } catch (migrationErr) {
      logger.error('Error ejecutando migraciones (continuando de todos modos):', migrationErr);
    }

    await prisma.$connect();
    logger.info('Conectado a PostgreSQL correctamente');

    const server = app.listen(env.PORT, () => {
      logger.info(`Servidor corriendo en http://localhost:${env.PORT}`);
      logger.info(`Ambiente: ${env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`Monitoring dashboard: http://localhost:${env.PORT}/api/v1/monitoring/dashboard`);
    });

    if (env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true') {
      startAllMonitoringJobs();
    }

    // Notificaciones de cotizaciones — activo siempre que EMAIL esté configurado
    startQuotationNotificationJob();
    // Alertas de negocio: presupuesto, órdenes pendientes, nóminas sin pagar
    startBusinessNotificationJob();

    const shutdown = async (signal: string) => {
      logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
      await forceFlush();
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Servidor cerrado. Hasta pronto.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Error al iniciar servidor:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
/* Force redeploy on Tue Jun  2 20:26:36 UTC 2026 */
