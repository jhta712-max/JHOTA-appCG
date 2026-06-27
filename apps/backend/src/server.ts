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
    try {
      // Resuelve baseline fallida (P3009) antes de deploy — safe to run always,
      // falla silenciosamente si la migración ya está en estado correcto.
      execSync('./node_modules/.bin/prisma migrate resolve --rolled-back 20260531000000_init_baseline --schema ./prisma/schema.prisma', { stdio: 'pipe', cwd: process.cwd() });
      execSync('./node_modules/.bin/prisma migrate resolve --applied   20260531000000_init_baseline --schema ./prisma/schema.prisma', { stdio: 'pipe', cwd: process.cwd() });
      logger.info('Baseline migration resuelta.');
    } catch (_) { /* no estaba en estado fallido, ignorar */ }

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
