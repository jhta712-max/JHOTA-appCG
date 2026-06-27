/**
 * Router de Monitoreo — JHOTA Construcciones
 *
 * Rutas públicas:
 *   GET /health/detailed        → health check detallado (sin auth, para Railway)
 *
 * Rutas protegidas (admin + supervisor):
 *   GET /api/v1/monitoring/dashboard       → resumen completo
 *   GET /api/v1/monitoring/logs            → logs paginados con filtros
 *   GET /api/v1/monitoring/metrics         → métricas de API
 *   GET /api/v1/monitoring/health/history  → historial de health checks
 */

import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  runHealthCheck,
  getDashboardSummary,
  getSystemLogs,
  getApiMetrics,
  getHealthHistory,
} from './monitoring.service';
import { runAiAnalysis } from './monitoring.ai';
import { listAll as listSubscriptions, getUpcomingPayments } from '../service-subscriptions/service-subscriptions.service';

const router = Router();

// ── Detallado (sin auth — Railway puede usarlo para health probes) ──
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const result = await runHealthCheck();
    const statusCode = result.status === 'unhealthy' ? 503
                     : result.status === 'degraded'  ? 207
                     : 200;
    res.status(statusCode).json({ success: true, data: result });
  } catch (err: any) {
    res.status(503).json({ success: false, status: 'unhealthy', error: err.message });
  }
});

// ── Dashboard (admin + supervisor) ────────────────────────────
router.get('/dashboard', authenticate, authorize('admin', 'supervisor'), async (_req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Logs paginados (admin + supervisor) ───────────────────────
router.get('/logs', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { level, category, dateFrom, dateTo, page, limit } = req.query as Record<string, string>;
    const result = await getSystemLogs({
      level, category, dateFrom, dateTo,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Métricas de API (admin + supervisor) ──────────────────────
router.get('/metrics', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const data  = await getApiMetrics(hours);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Historial de health checks (admin + supervisor) ───────────
router.get('/health/history', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const data  = await getHealthHistory(hours);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Análisis con IA (admin + supervisor) ──────────────────────
router.post('/ai-analyze', authenticate, authorize('admin', 'supervisor'), async (_req, res) => {
  try {
    const result = await runAiAnalysis();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Suscripciones de servicios (admin + supervisor) ───────────
router.get('/subscriptions', authenticate, authorize('admin', 'supervisor'), async (_req, res) => {
  try {
    const [all, upcoming] = await Promise.all([listSubscriptions(), getUpcomingPayments(7)]);
    const total = all.filter((s) => s.isActive).reduce((sum, s) => sum + Number(s.monthlyCost), 0);
    res.json({ success: true, data: { all, upcoming, totalMonthlyCost: total } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
