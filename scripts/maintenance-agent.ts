/**
 * SERVINGMI — Agente de Mantenimiento Semanal
 *
 * Flujo:
 *  1. Autentica en el backend con credenciales de admin
 *  2. Llama a POST /monitoring/ai-analyze (ya usa Claude internamente)
 *  3. Compara con el reporte anterior (cache en .maintenance-cache.json)
 *  4. Abre un GitHub Issue con el diagnóstico si hay issues nuevos o urgentes
 *
 * Uso:
 *   npx tsx scripts/maintenance-agent.ts
 *
 * Variables de entorno requeridas:
 *   SERVINGMI_ADMIN_EMAIL   — email del usuario admin
 *   SERVINGMI_ADMIN_PASS    — contraseña del usuario admin
 *   SERVINGMI_BACKEND_URL   — https://servingmi-backend.onrender.com
 *   GH_TOKEN                — GitHub token con permiso issues:write
 *   GH_REPO                 — owner/repo  ej: jhta712-max/servingmi-appcg
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AiIssue {
  severity: 'high' | 'medium' | 'low';
  title:    string;
  detail:   string;
}

interface AiRecommendation {
  priority: 'urgent' | 'normal' | 'optional';
  action:   string;
  reason:   string;
}

interface AiAnalysisResult {
  status:          'healthy' | 'warning' | 'critical';
  summary:         string;
  issues:          AiIssue[];
  recommendations: AiRecommendation[];
  positives:       string[];
  analyzedAt:      string;
}

interface Cache {
  lastAnalysis: AiAnalysisResult | null;
  lastIssueUrl: string | null;
  lastRunAt:    string | null;
}

// ── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.SERVINGMI_BACKEND_URL ?? 'https://servingmi-backend.onrender.com';
const ADMIN_EMAIL = process.env.SERVINGMI_ADMIN_EMAIL ?? '';
const ADMIN_PASS  = process.env.SERVINGMI_ADMIN_PASS  ?? '';
const GH_TOKEN    = process.env.GH_TOKEN              ?? '';
const GH_REPO     = process.env.GH_REPO               ?? '';

const CACHE_PATH  = path.join(process.cwd(), '.maintenance-cache.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return { lastAnalysis: null, lastIssueUrl: null, lastRunAt: null };
  }
}

function saveCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${url}: ${body}`);
  }
  return res.json();
}

// ── Paso 1: Login ────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  console.log('🔐 Autenticando en el backend...');
  const data = await fetchJson(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const token = data?.data?.accessToken ?? data?.accessToken;
  if (!token) throw new Error('No se recibió accessToken en la respuesta de login');
  console.log('   ✅ Token obtenido');
  return token;
}

// ── Paso 2: Análisis IA ──────────────────────────────────────────────────────

async function runAiAnalysis(token: string): Promise<AiAnalysisResult> {
  console.log('🤖 Solicitando análisis IA al backend...');
  const data = await fetchJson(`${BACKEND_URL}/monitoring/ai-analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result: AiAnalysisResult = data?.data ?? data;
  console.log(`   Estado del sistema: ${result.status.toUpperCase()}`);
  console.log(`   Issues detectados: ${result.issues.length}`);
  console.log(`   Recomendaciones: ${result.recommendations.length}`);
  return result;
}

// ── Paso 3: Decidir si abrir issue ───────────────────────────────────────────

function shouldOpenIssue(current: AiAnalysisResult, cache: Cache): boolean {
  // Siempre abrir si es critical
  if (current.status === 'critical') return true;
  // Abrir si hay issues de alta severidad
  if (current.issues.some(i => i.severity === 'high')) return true;
  // Abrir si hay recomendaciones urgentes
  if (current.recommendations.some(r => r.priority === 'urgent')) return true;
  // Si el estado cambió de healthy a warning
  if (cache.lastAnalysis?.status === 'healthy' && current.status === 'warning') return true;
  // No abrir si el sistema está sano y no hubo degradación
  return false;
}

// ── Paso 4: Formatear issue ──────────────────────────────────────────────────

const SEVERITY_EMOJI = { high: '🔴', medium: '🟡', low: '🟢' };
const STATUS_EMOJI   = { healthy: '✅', warning: '⚠️', critical: '🚨' };
const PRIORITY_EMOJI = { urgent: '🔥', normal: '📌', optional: '💡' };

function buildIssueBody(result: AiAnalysisResult, previousStatus?: string): string {
  const date = new Date().toLocaleDateString('es-DO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const issueLines: string[] = [];
  const recLines:   string[] = [];

  for (const issue of result.issues) {
    issueLines.push(`### ${SEVERITY_EMOJI[issue.severity]} ${issue.title}`);
    issueLines.push(`> ${issue.detail}`);
    issueLines.push('');
  }

  for (const rec of result.recommendations) {
    recLines.push(`- ${PRIORITY_EMOJI[rec.priority]} **${rec.action}**  `);
    recLines.push(`  *${rec.reason}*`);
  }

  const statusChange = previousStatus && previousStatus !== result.status
    ? `\n> ⚡ Cambio de estado: \`${previousStatus}\` → \`${result.status}\`\n`
    : '';

  return `## ${STATUS_EMOJI[result.status]} Diagnóstico Semanal — ${date}
${statusChange}
**Estado del sistema:** \`${result.status.toUpperCase()}\`

### 📋 Resumen Ejecutivo
${result.summary}

---

${result.issues.length > 0 ? `### 🔍 Problemas Detectados\n\n${issueLines.join('\n')}` : '### 🔍 Problemas Detectados\n\n_Sin problemas detectados._\n'}

---

### 💡 Recomendaciones

${recLines.length > 0 ? recLines.join('\n') : '_Sin recomendaciones adicionales._'}

---

### ✅ Aspectos Positivos

${result.positives.map(p => `- ${p}`).join('\n')}

---

<details>
<summary>📊 Metadatos del análisis</summary>

- **Analizado:** ${new Date(result.analyzedAt).toLocaleString('es-DO')}
- **Generado por:** Agente de Mantenimiento SERVINGMI (Claude via \`/monitoring/ai-analyze\`)
- **Backend:** \`${BACKEND_URL}\`

</details>
`;
}

// ── Paso 5: Crear GitHub Issue ───────────────────────────────────────────────

async function createGitHubIssue(result: AiAnalysisResult, previousStatus?: string): Promise<string> {
  if (!GH_TOKEN || !GH_REPO) {
    console.log('⚠️  GH_TOKEN o GH_REPO no configurados — saltando creación de issue');
    return '';
  }

  console.log('📝 Creando GitHub Issue...');

  const statusEmoji = STATUS_EMOJI[result.status];
  const weekDate = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
  const title = `${statusEmoji} Diagnóstico semanal [${result.status.toUpperCase()}] — ${weekDate}`;

  const labels = ['maintenance', 'automated'];
  if (result.status === 'critical') labels.push('priority: high');
  if (result.status === 'warning')  labels.push('priority: medium');

  const body = buildIssueBody(result, previousStatus);

  const data = await fetchJson(`https://api.github.com/repos/${GH_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  console.log(`   ✅ Issue creado: ${data.html_url}`);
  return data.html_url;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔧 SERVINGMI — Agente de Mantenimiento');
  console.log('━'.repeat(45));

  if (!ADMIN_EMAIL || !ADMIN_PASS) {
    console.error('❌ SERVINGMI_ADMIN_EMAIL y SERVINGMI_ADMIN_PASS son requeridos');
    process.exit(1);
  }

  const cache = loadCache();
  console.log(`📁 Último análisis: ${cache.lastRunAt ?? 'nunca'}`);

  // 1. Auth
  const token = await getAuthToken();

  // 2. Análisis IA (usa Claude internamente en el backend)
  const analysis = await runAiAnalysis(token);

  // 3. Decidir si crear issue
  const needsIssue = shouldOpenIssue(analysis, cache);
  console.log(`\n📊 Estado: ${analysis.status} | Abrir issue: ${needsIssue ? 'SÍ' : 'NO'}`);

  let issueUrl = '';
  if (needsIssue) {
    issueUrl = await createGitHubIssue(analysis, cache.lastAnalysis?.status);
  } else {
    console.log('✅ Sistema saludable — no se requiere issue esta semana');
  }

  // 4. Actualizar cache
  saveCache({
    lastAnalysis: analysis,
    lastIssueUrl: issueUrl || cache.lastIssueUrl,
    lastRunAt:    new Date().toISOString(),
  });

  console.log('\n✅ Agente completado\n');
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
