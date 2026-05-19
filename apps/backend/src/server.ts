import { env } from './config/env';
import { logger } from './utils/logger';
import prisma from './config/database';
import app from './app';
import { startAllMonitoringJobs } from './jobs/healthMonitor';
import { forceFlush } from './middlewares/requestLogger';

async function start() {
  try {
    // Verificar conexión a la base de datos
    await prisma.$connect();
    logger.info('Conectado a PostgreSQL correctamente');

    const server = app.listen(env.PORT, () => {
      logger.info(`Servidor corriendo en http://localhost:${env.PORT}`);
      logger.info(`Ambiente: ${env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`Monitoring dashboard: http://localhost:${env.PORT}/api/v1/monitoring/dashboard`);
    });

    // Arrancar jobs de monitoreo solo en producción o si se activa explícitamente
    if (env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true') {
      startAllMonitoringJobs();
    }

    // Apagado limpio
    const shutdown = async (signal: string) => {
      logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
      await forceFlush(); // Guardar logs pendientes antes de cerrar
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Servidor cerrado. Hasta pronto.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Error al iniciar el servidor', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
