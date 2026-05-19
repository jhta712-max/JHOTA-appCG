/**
 * Servicio de Monitoreo del Sistema — SERVINGMI
 *
 * Responsabilidades:
 *   - Verificar estado del servidor y BD (health check)
 *   - Leer logs del sistema paginados
 *   - Calcular métricas de uso de la API
 *   - Generar estadísticas para reportes
 */

import os from 'os';
import prisma from '../../config/database';

// ─── Estado interno: falla previa (para detectar recuperación) ─
let _lastWasDown = false;

export function setLastWasDown(val: boolean) { _lastWasDown = val; }
export function getLastWasDown(): boolean    { return _lastWasDown; }

// ─── Health Check ─────────────────────────────────────────────
export interface HealthResult {
  status:        'healthy' | 'degraded' | 'unhealthy';
  dbOk:          boolean;
  memoryUsedPct: number;
  uptimeSeconds: number;
  responseTime:  number;
  details:       Record<string, unknown>;
}

export async function runHealthCheck(): Promise<HealthResult> {
  const start = Date.now();

  // 1. Base de datos
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err: any) {
    dbError = err.message ?? 'unknown';
  }

  // 2. Memoria
  const totalMem    = os.totalmem();
  const freeMem     = os.freemem();
  const usedMemPct  = ((totalMem - freeMem) / totalMem) * 100;

  // 3. Uptime
  const uptimeSeconds = process.uptime();

  const responseTime = Date.now() - start;

  // Clasificar estado
  let status: HealthResult['status'] = 'healthy';
  if (!dbOk)            status = 'unhealthy';
  else if (usedMemPct > 90) status = 'degraded';

  const result: HealthResult = {
    status,
    dbOk,
    memoryUsedPct: parseFloat(usedMemPct.toFixed(2)),
    uptimeSeconds,
    responseTime,
    details: {
      nodeVersion:    process.version,
      platform:       process.platform,
      totalMemMb:     Math.round(totalMem / 1024 / 1024),
      freeMemMb:      Math.round(freeMem  / 1024 / 1024),
      cpuModel:       os.cpus()[0]?.model ?? 'unknown',
      cpuCount:       os.cpus().length,
      ...(dbError ? { dbError } : {}),
    },
  };

  // Persistir resultado en DB (fire and forget)
  prisma.healthCheckResult.create({
    data: {
      status:          result.status,
      dbOk:            result.dbOk,
      memoryUsedPct:   result.memoryUsedPct,
      uptimeSeconds:   result.uptimeSeconds,
      responseTime:    result.responseTime,
      details:         result.details,
    },
  }).catch(() => {/* silencioso si la DB está caída */});

  return result;
}

// ─── Limpiar registros de health check antiguos (>30 días) ────
export async function pruneOldHealthChecks(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.healthCheckResult.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}

// ─── Logs del sistema ─────────────────────────────────────────
export async function getSystemLogs(opts: {
  level?:    string;
  category?: string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}) {
  const page  = Math.max(1, opts.page  ?? 1);
  const limit = Math.min(100, opts.limit ?? 50);
  const skip  = (page - 1) * limit;

  const where: any = {};
  if (opts.level)    where.level    = opts.level;
  if (opts.category) where.category = opts.category;
  if (opts.dateFrom || opts.dateTo) {
    where.createdAt = {};
    if (opts.dateFrom) where.createdAt.gte = new Date(opts.dateFrom);
    if (opts.dateTo)   where.createdAt.lte = new Date(opts.dateTo + 'T23:59:59');
  }

  const [data, total] = await Promise.all([
    prisma.systemLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.systemLog.count({ where }),
  ]);

  return {
    data,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Métricas de la API (últimas N horas) ────────────────────
export async function getApiMetrics(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const logs = await prisma.systemLog.findMany({
    where: { category: 'api', createdAt: { gte: since } },
    select: { level: true, endpoint: true, method: true, statusCode: true, duration: true, createdAt: true },
  });

  const totalRequests = logs.length;
  const errorCount    = logs.filter(l => l.level === 'error').length;
  const durations     = logs.map(l => l.duration ?? 0).filter(d => d > 0);
  const avgResponseMs = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Top endpoints por volumen
  const endpointCounts: Record<string, number> = {};
  for (const l of logs) {
    if (l.endpoint) {
      endpointCounts[l.endpoint] = (endpointCounts[l.endpoint] ?? 0) + 1;
    }
  }
  const topEndpoints = Object.entries(endpointCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  // Error rate por hora (para gráfica)
  const hourlyBuckets: Record<string, { requests: number; errors: number }> = {};
  for (const l of logs) {
    const h = new Date(l.createdAt).toISOString().slice(0, 13) + ':00';
    if (!hourlyBuckets[h]) hourlyBuckets[h] = { requests: 0, errors: 0 };
    hourlyBuckets[h].requests++;
    if (l.level === 'error') hourlyBuckets[h].errors++;
  }
  const hourlyData = Object.entries(hourlyBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({ hour, ...v }));

  // Distribución de status codes
  const statusCodes: Record<string, number> = {};
  for (const l of logs) {
    if (l.statusCode) {
      const group = `${Math.floor(l.statusCode / 100)}xx`;
      statusCodes[group] = (statusCodes[group] ?? 0) + 1;
    }
  }

  return {
    period:         `${hours}h`,
    totalRequests,
    errorCount,
    errorRate:      totalRequests > 0 ? (errorCount / totalRequests * 100) : 0,
    avgResponseMs:  parseFloat(avgResponseMs.toFixed(2)),
    topEndpoints,
    hourlyData,
    statusCodes,
  };
}

// ─── Health check history (para el gráfico de estabilidad) ───
export async function getHealthHistory(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return prisma.healthCheckResult.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { status: true, dbOk: true, memoryUsedPct: true, responseTime: true, createdAt: true },
  });
}

// ─── Estadísticas del negocio (para reporte diario) ──────────
export async function getBusinessStats(since: Date) {
  const [payrolls, expenses, users] = await Promise.all([
    prisma.payroll.count({ where: { createdAt: { gte: since } } }),
    prisma.expense.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { lastLogin: { gte: since } } }),
  ]);
  return { payrolls, expenses, activeUsers: users };
}

// ─── Conteo de errores en ventana de tiempo ───────────────────
export async function countRecentErrors(windowMinutes: number): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return prisma.systemLog.count({
    where: { level: 'error', createdAt: { gte: since } },
  });
}

// ─── Dashboard summary (para la página de monitoreo) ─────────
export async function getDashboardSummary() {
  const now         = new Date();
  const last24h     = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastHour    = new Date(now.getTime() - 60 * 60 * 1000);

  const [health, metrics, recentLogs, businessStats, lastHealthChecks] = await Promise.all([
    runHealthCheck(),
    getApiMetrics(24),
    prisma.systemLog.findMany({
      where:   { level: { in: ['error', 'warn'] }, createdAt: { gte: last24h } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    getBusinessStats(last24h),
    prisma.healthCheckResult.findMany({
      where:   { createdAt: { gte: lastHour } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  // Uptime % en la última hora
  const uptimePct = lastHealthChecks.length > 0
    ? (lastHealthChecks.filter(h => h.status === 'healthy').length / lastHealthChecks.length) * 100
    : 100;

  return {
    health,
    metrics,
    recentLogs,
    businessStats,
    uptimePct: parseFloat(uptimePct.toFixed(2)),
    generatedAt: now.toISOString(),
  };
}
