/**
 * Jobs de Monitoreo Programados — SERVINGMI
 *
 * Requiere: npm install node-cron
 * (agregar al package.json: "node-cron": "^3.0.3" y "@types/node-cron": "^3.0.11")
 *
 * Schedules:
 *   - Health check:      cada 5 minutos
 *   - Alta tasa errores: cada 10 minutos
 *   - Reporte diario:    08:00 AM hora local
 *   - Reporte semanal:   Lunes 08:00 AM hora local
 *   - Limpieza logs:     Cada domingo 03:00 AM
 */

import cron from 'node-cron';
import {
  runHealthCheck,
  countRecentErrors,
  getApiMetrics,
  getBusinessStats,
  pruneOldHealthChecks,
  getLastWasDown,
  setLastWasDown,
} from '../modules/monitoring/monitoring.service';
import {
  notifySystemDown,
  notifySystemRecovered,
  notifyHighErrorRate,
  sendDailyReport,
  sendWeeklyReport,
} from '../services/notifications.service';
import { addLog } from '../middlewares/requestLogger';

const TZ = process.env.TZ ?? 'America/Santo_Domingo';

// ─── Umbral de error rate para alertas ───────────────────────
const ERROR_RATE_THRESHOLD = parseInt(process.env.MONITOR_ERROR_THRESHOLD ?? '15');
const ERROR_WINDOW_MIN     = 10;

// ─── Job 1: Health check cada 5 min ──────────────────────────
export function startHealthCheckJob() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await runHealthCheck();
      const wasDown = getLastWasDown();

      if (result.status === 'unhealthy') {
        // Solo notificar si acababa de estar bien (evitar spam)
        if (!wasDown) {
          setLastWasDown(true);
          await notifySystemDown({
            status:        result.status,
            dbOk:          result.dbOk,
            memoryUsedPct: result.memoryUsedPct,
            message:       result.dbOk
              ? `Memoria al ${result.memoryUsedPct.toFixed(1)}%`
              : 'No se puede conectar a la base de datos',
          });
          addLog({
            level:    'error',
            category: 'cron',
            message:  `Health check FAILED — status: ${result.status}`,
            details:  result.details as Record<string, unknown>,
          });
        }
      } else {
        // Sistema saludable
        if (wasDown) {
          setLastWasDown(false);
          await notifySystemRecovered();
          addLog({
            level:    'info',
            category: 'cron',
            message:  'Health check RECOVERED — sistema operacional',
          });
        }
      }
    } catch (err: any) {
      addLog({
        level:    'error',
        category: 'cron',
        message:  `Health check job error: ${err.message}`,
      });
    }
  }, { timezone: TZ });

  console.log('[Monitor] Health check job iniciado (cada 5 min)');
}

// ─── Job 2: Detección de alta tasa de errores cada 10 min ────
export function startErrorRateJob() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const count = await countRecentErrors(ERROR_WINDOW_MIN);
      if (count >= ERROR_RATE_THRESHOLD) {
        await notifyHighErrorRate(count, ERROR_WINDOW_MIN);
        addLog({
          level:    'warn',
          category: 'cron',
          message:  `Alta tasa de errores: ${count} en ${ERROR_WINDOW_MIN} min`,
        });
      }
    } catch (err: any) {
      addLog({
        level:    'error',
        category: 'cron',
        message:  `Error rate job error: ${err.message}`,
      });
    }
  }, { timezone: TZ });

  console.log('[Monitor] Error rate job iniciado (cada 10 min)');
}

// ─── Job 3: Reporte diario a las 8:00 AM ─────────────────────
export function startDailyReportJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const [metrics, bizStats] = await Promise.all([
        getApiMetrics(24),
        getBusinessStats(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ]);

      await sendDailyReport({
        totalRequests: metrics.totalRequests,
        errorCount:    metrics.errorCount,
        avgResponseMs: metrics.avgResponseMs,
        uptimeHours:   process.uptime() / 3600,
        dbStatus:      '✅ Conectada',
        activeUsers:   bizStats.activeUsers,
        topEndpoints:  metrics.topEndpoints,
      });

      addLog({
        level:    'info',
        category: 'cron',
        message:  'Reporte diario enviado exitosamente',
      });
    } catch (err: any) {
      addLog({
        level:    'error',
        category: 'cron',
        message:  `Daily report job error: ${err.message}`,
      });
    }
  }, { timezone: TZ });

  console.log('[Monitor] Daily report job iniciado (8:00 AM)');
}

// ─── Job 4: Reporte semanal lunes 8:00 AM ────────────────────
export function startWeeklyReportJob() {
  cron.schedule('0 8 * * 1', async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [metrics, bizStats] = await Promise.all([
        getApiMetrics(24 * 7),
        getBusinessStats(weekAgo),
      ]);

      const weekLabel = `${weekAgo.toLocaleDateString('es-DO')} — ${new Date().toLocaleDateString('es-DO')}`;

      await sendWeeklyReport({
        weekLabel,
        totalRequests:  metrics.totalRequests,
        errorCount:     metrics.errorCount,
        avgUptime:      98.5, // TODO: calcular desde health_check_results
        totalPayrolls:  bizStats.payrolls,
        totalExpenses:  bizStats.expenses,
      });

      addLog({
        level:    'info',
        category: 'cron',
        message:  `Reporte semanal enviado: ${weekLabel}`,
      });
    } catch (err: any) {
      addLog({
        level:    'error',
        category: 'cron',
        message:  `Weekly report job error: ${err.message}`,
      });
    }
  }, { timezone: TZ });

  console.log('[Monitor] Weekly report job iniciado (Lunes 8:00 AM)');
}

// ─── Job 5: Limpieza de logs antiguos (>30 días) cada domingo ─
export function startCleanupJob() {
  cron.schedule('0 3 * * 0', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count } = await import('../config/database').then(m =>
        m.default.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
      );
      await pruneOldHealthChecks();

      addLog({
        level:    'info',
        category: 'cron',
        message:  `Limpieza completada: ${count} logs eliminados (>30 días)`,
      });
    } catch (err: any) {
      addLog({
        level:    'error',
        category: 'cron',
        message:  `Cleanup job error: ${err.message}`,
      });
    }
  }, { timezone: TZ });

  console.log('[Monitor] Cleanup job iniciado (Domingos 3:00 AM)');
}

// ─── Arrancar todos los jobs ──────────────────────────────────
export function startAllMonitoringJobs() {
  startHealthCheckJob();
  startErrorRateJob();
  startDailyReportJob();
  startWeeklyReportJob();
  startCleanupJob();
  console.log('[Monitor] ✅ Todos los jobs de monitoreo activos');
}
