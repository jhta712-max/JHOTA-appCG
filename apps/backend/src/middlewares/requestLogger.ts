/**
 * Middleware de Request Logger — SERVINGMI
 *
 * Registra cada petición a la API en la tabla system_logs:
 *   - Endpoint, método, status code, duración (ms)
 *   - Usuario autenticado (si aplica)
 *   - IP del cliente
 *   - Stack trace completo para errores 5xx
 */

import type { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

// Rutas que NO queremos registrar (para reducir ruido)
const SKIP_PATHS = ['/health', '/favicon.ico', '/uploads'];

// Intervalo de flush (acumula logs y los inserta en batch cada 5s)
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE    = 50;

interface LogEntry {
  level:      string;
  category:   string;
  message:    string;
  details?:   Record<string, unknown>;
  userId?:    string;
  endpoint?:  string;
  method?:    string;
  statusCode?: number;
  duration?:  number;
  ipAddress?: string;
}

const logBuffer: LogEntry[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushLogs();
  }, FLUSH_INTERVAL_MS);
}

async function flushLogs() {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0, MAX_BATCH_SIZE);
  try {
    await prisma.systemLog.createMany({ data: batch as any });
  } catch {
    // No romper la aplicación si falla el logging
  }
  if (logBuffer.length > 0) scheduleFlush();
}

/** Agrega un log al buffer para inserción asíncrona. */
export function addLog(entry: LogEntry) {
  logBuffer.push(entry);
  scheduleFlush();
}

/** Middleware principal para registrar requests/responses. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Saltar rutas excluidas
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  const startTime = Date.now();

  // Capturar cuando la respuesta termina
  res.on('finish', () => {
    const duration   = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level      = statusCode >= 500 ? 'error'
                     : statusCode >= 400 ? 'warn'
                     : 'info';

    // Endpoint normalizado (sin IDs en la URL para agrupar correctamente)
    const endpoint = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id');

    const entry: LogEntry = {
      level,
      category:   'api',
      message:    `${req.method} ${endpoint} → ${statusCode} (${duration}ms)`,
      endpoint,
      method:     req.method,
      statusCode,
      duration,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                  ?? req.socket?.remoteAddress
                  ?? undefined,
      userId:     (req as any).user?.userId ?? undefined,
    };

    // Para errores 5xx incluir más contexto
    if (statusCode >= 500) {
      entry.details = {
        query:   req.query,
        bodyKeys: req.body ? Object.keys(req.body) : [],
      };
    }

    addLog(entry);
  });

  next();
}

/** Registra un error de aplicación manualmente (desde errorHandler). */
export function logError(opts: {
  message:   string;
  category?: string;
  details?:  Record<string, unknown>;
  userId?:   string;
  endpoint?: string;
  method?:   string;
  statusCode?: number;
  duration?:   number;
}) {
  addLog({
    level:      'error',
    category:   opts.category ?? 'system',
    message:    opts.message,
    details:    opts.details,
    userId:     opts.userId,
    endpoint:   opts.endpoint,
    method:     opts.method,
    statusCode: opts.statusCode,
    duration:   opts.duration,
  });
}

/** Fuerza el flush inmediato (llamar al cerrar el proceso). */
export async function forceFlush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flushLogs();
}
