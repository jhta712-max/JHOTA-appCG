/**
 * Análisis de Monitoreo con IA — SERVINGMI
 *
 * Usa Claude (Anthropic) para analizar el estado del sistema
 * y generar recomendaciones en lenguaje natural.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import {
  runHealthCheck,
  getApiMetrics,
  getBusinessStats,
} from './monitoring.service';
import prisma from '../../config/database';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export interface AiAnalysisResult {
  status:          'healthy' | 'warning' | 'critical';
  summary:         string;
  issues:          AiIssue[];
  recommendations: AiRecommendation[];
  positives:       string[];
  analyzedAt:      string;
}

export interface AiIssue {
  severity: 'high' | 'medium' | 'low';
  title:    string;
  detail:   string;
}

export interface AiRecommendation {
  priority: 'urgent' | 'normal' | 'optional';
  action:   string;
  reason:   string;
}

export async function runAiAnalysis(): Promise<AiAnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está configurada');
  }

  // ── Recopilar datos del sistema ───────────────────────────────
  const since2h  = new Date(Date.now() - 2  * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [health, metrics, bizStats, recentErrors, slowEndpoints] = await Promise.all([
    runHealthCheck(),
    getApiMetrics(24),
    getBusinessStats(since24h),
    // Errores recientes (últimas 2 horas)
    prisma.systemLog.findMany({
      where:   { level: 'error', createdAt: { gte: since2h } },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { message: true, category: true, endpoint: true, statusCode: true, duration: true, createdAt: true },
    }),
    // Endpoints más lentos (últimas 24h)
    prisma.systemLog.findMany({
      where:   { category: 'api', duration: { gte: 2000 }, createdAt: { gte: since24h } },
      orderBy: { duration: 'desc' },
      take:    5,
      select:  { endpoint: true, duration: true, statusCode: true },
    }),
  ]);

  // ── Construir contexto para Claude ───────────────────────────
  const systemContext = `
=== ESTADO ACTUAL DEL SISTEMA ===
Estado general: ${health.status.toUpperCase()}
Base de datos: ${health.dbOk ? 'CONECTADA ✅' : 'SIN CONEXIÓN ❌'}
Memoria usada: ${health.memoryUsedPct.toFixed(1)}%
Tiempo activo: ${Math.round(health.uptimeSeconds / 3600)}h ${Math.round((health.uptimeSeconds % 3600) / 60)}m
Tiempo de respuesta del health check: ${health.responseTime}ms

=== MÉTRICAS DE API (ÚLTIMAS 24H) ===
Total de peticiones: ${metrics.totalRequests}
Errores totales: ${metrics.errorCount}
Tasa de error: ${metrics.errorRate.toFixed(2)}%
Tiempo de respuesta promedio: ${metrics.avgResponseMs.toFixed(0)}ms
Distribución de códigos: ${JSON.stringify(metrics.statusCodes)}

Top endpoints más usados:
${metrics.topEndpoints.slice(0, 5).map(e => `  - ${e.endpoint}: ${e.count} llamadas`).join('\n')}

=== ERRORES RECIENTES (ÚLTIMAS 2H) ===
Total: ${recentErrors.length}
${recentErrors.slice(0, 10).map(e =>
  `  [${e.category}] ${e.message}${e.endpoint ? ` → ${e.endpoint}` : ''}${e.statusCode ? ` (${e.statusCode})` : ''}${e.duration ? ` ${e.duration}ms` : ''}`
).join('\n') || '  Sin errores recientes ✅'}

=== ENDPOINTS LENTOS (>2s, ÚLTIMAS 24H) ===
${slowEndpoints.map(e => `  - ${e.endpoint}: ${e.duration}ms (${e.statusCode})`).join('\n') || '  Sin endpoints lentos ✅'}

=== ACTIVIDAD DEL NEGOCIO (ÚLTIMAS 24H) ===
Nóminas procesadas: ${bizStats.payrolls}
Gastos registrados: ${bizStats.expenses}
Usuarios activos: ${bizStats.activeUsers}
`;

  // ── Prompt para Claude ────────────────────────────────────────
  const prompt = `Eres el asistente de monitoreo técnico del sistema SERVINGMI, una aplicación de gestión de gastos por proyectos para una empresa de ingeniería y minería en República Dominicana.

Analiza los siguientes datos del sistema y proporciona un diagnóstico completo en ESPAÑOL:

${systemContext}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin markdown, sin texto adicional):
{
  "status": "healthy" | "warning" | "critical",
  "summary": "Resumen ejecutivo del estado del sistema en 2-3 oraciones claras para un administrador no técnico",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "title": "Título corto del problema",
      "detail": "Explicación clara de qué está pasando y por qué es importante"
    }
  ],
  "recommendations": [
    {
      "priority": "urgent" | "normal" | "optional",
      "action": "Acción concreta a tomar",
      "reason": "Por qué se recomienda esta acción"
    }
  ],
  "positives": [
    "Aspecto positivo del sistema que vale la pena destacar"
  ]
}

Reglas:
- Si no hay problemas, el array "issues" debe estar vacío []
- Sé específico con los endpoints o categorías afectadas
- Las recomendaciones deben ser accionables e inmediatas
- El resumen debe ser comprensible para alguien sin conocimientos técnicos
- Incluye al menos 1-2 aspectos positivos aunque haya problemas
- Si la tasa de error es > 5%, es "warning"; si es > 15% o la DB está caída, es "critical"
- Si todo está bien, "status" = "healthy"`;

  // ── Llamar a Claude ───────────────────────────────────────────
  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',  // Rápido y económico para monitoreo
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = (response.content[0] as any).text?.trim() ?? '';

  // Parsear JSON de la respuesta
  let parsed: Omit<AiAnalysisResult, 'analyzedAt'>;
  try {
    // Extraer JSON aunque Claude agregue texto extra
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback si el parsing falla
    parsed = {
      status:          health.status === 'unhealthy' ? 'critical' : health.status === 'degraded' ? 'warning' : 'healthy',
      summary:         `El sistema está ${health.status === 'healthy' ? 'operando correctamente' : 'presentando inconvenientes'}. Tasa de error: ${metrics.errorRate.toFixed(2)}%, tiempo de respuesta promedio: ${metrics.avgResponseMs.toFixed(0)}ms.`,
      issues:          [],
      recommendations: [{ priority: 'normal', action: 'Revisar logs manualmente', reason: 'El análisis automático no pudo completarse' }],
      positives:       ['El servidor está en línea y respondiendo peticiones'],
    };
  }

  return { ...parsed, analyzedAt: new Date().toISOString() };
}
