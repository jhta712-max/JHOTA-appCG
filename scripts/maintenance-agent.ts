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
import { execSync } from 'child_process';

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

interface HistoryEntry {
  analyzedAt:  string;
  status:      'healthy' | 'warning' | 'critical';
  errorRate:   number | null;
  issueCount:  number;
  issueUrl:    string | null;
}

interface Cache {
  lastAnalysis:     AiAnalysisResult | null;
  lastIssueUrl:     string | null;
  lastIssueNumber:  number | null;
  lastRunAt:        string | null;
  history:          HistoryEntry[];
}

interface AuditVulnerability {
  name:     string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  via:      string;
  range:    string;
}

interface AuditReport {
  vulnerabilities: AuditVulnerability[];
  totalHigh:       number;
  totalCritical:   number;
}

// ── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.SERVINGMI_BACKEND_URL ?? 'https://servingmi-backend.onrender.com';
const ADMIN_EMAIL = process.env.SERVINGMI_ADMIN_EMAIL ?? '';
const ADMIN_PASS  = process.env.SERVINGMI_ADMIN_PASS  ?? '';
const GH_TOKEN    = process.env.GH_TOKEN              ?? '';
const GH_REPO     = process.env.GH_REPO               ?? '';
const TRIGGER_TYPE = process.env.TRIGGER_TYPE ?? 'manual';   // 'weekly' | 'post-deploy' | 'manual'

const CACHE_PATH  = path.join(process.cwd(), '.maintenance-cache.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadCache(): Cache {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    return {
      lastAnalysis:    raw.lastAnalysis    ?? null,
      lastIssueUrl:    raw.lastIssueUrl    ?? null,
      lastIssueNumber: raw.lastIssueNumber ?? null,
      lastRunAt:       raw.lastRunAt       ?? null,
      history:         raw.history         ?? [],
    };
  } catch {
    return { lastAnalysis: null, lastIssueUrl: null, lastIssueNumber: null, lastRunAt: null, history: [] };
  }
}

function saveCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function pushHistory(cache: Cache, analysis: AiAnalysisResult, issueUrl: string | null): Cache {
  const entry: HistoryEntry = {
    analyzedAt:  analysis.analyzedAt,
    status:      analysis.status,
    errorRate:   null,
    issueCount:  analysis.issues.length,
    issueUrl,
  };
  const history = [entry, ...cache.history].slice(0, 4);
  return { ...cache, history };
}

function buildTrendSummary(history: HistoryEntry[]): string {
  if (history.length < 2) return '_Historial insuficiente (menos de 2 semanas)._';

  const statusLine = history
    .map(h => {
      const emoji = h.status === 'healthy' ? '✅' : h.status === 'warning' ? '⚠️' : '🚨';
      const date  = new Date(h.analyzedAt).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
      return `${date}: ${emoji} ${h.status} (${h.issueCount} issues)`;
    })
    .join('\n');

  // Detectar tendencia de degradación
  const statuses = history.map(h => h.status);
  const nonHealthyStreak = statuses.findIndex(s => s === 'healthy');
  let trendNote = '';
  if (nonHealthyStreak === -1) {
    trendNote = '⚠️ **El sistema lleva todas las semanas registradas sin alcanzar estado healthy.**';
  } else if (nonHealthyStreak === 0 && statuses.slice(1).every(s => s !== 'healthy')) {
    trendNote = '📈 Sistema mejoró esta semana respecto a semanas anteriores.';
  }

  return `${statusLine}${trendNote ? '\n\n' + trendNote : ''}`;
}

function getDeployContext(): string {
  try {
    const raw = execSync(
      'git log --oneline --since="7 days ago" --no-merges',
      { encoding: 'utf8', timeout: 10_000 },
    ).trim();

    if (!raw) return '_Sin commits en los últimos 7 días._';

    const lines = raw.split('\n').slice(0, 20); // máximo 20 commits
    return lines.map(l => `- \`${l}\``).join('\n');
  } catch (err) {
    console.error('⚠️  getDeployContext() error:', err instanceof Error ? err.message : String(err));
    return '_No se pudo obtener el historial de git._';
  }
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

function runPnpmAudit(): AuditReport {
  try {
    const raw = execSync('pnpm audit --json 2>/dev/null || true', {
      encoding: 'utf8',
      timeout: 60_000,
    });
    const data = JSON.parse(raw);

    const vulns: AuditVulnerability[] = [];
    const advisories = data?.advisories ?? data?.vulnerabilities ?? {};

    for (const [name, info] of Object.entries(advisories)) {
      const v = info as any;
      if (!v || typeof v !== 'object') continue;
      vulns.push({
        name:     name,
        severity: v.severity ?? 'low',
        via:      Array.isArray(v.via)
          ? v.via.map((x: any) => typeof x === 'string' ? x : (x.name ?? x.title ?? '')).filter(Boolean).join(', ')
          : String(v.via ?? ''),
        range:    v.range ?? v.fixAvailable?.version ?? 'unknown',
      });
    }

    const totalHigh     = vulns.filter(v => v.severity === 'high').length;
    const totalCritical = vulns.filter(v => v.severity === 'critical').length;

    return { vulnerabilities: vulns, totalHigh, totalCritical };
  } catch (err) {
    console.error('⚠️  pnpm audit error:', err instanceof Error ? err.message : String(err));
    return { vulnerabilities: [], totalHigh: 0, totalCritical: 0 };
  }
}

function buildSecuritySection(audit: AuditReport): string {
  if (audit.vulnerabilities.length === 0) return '';

  const lines: string[] = [];
  for (const v of audit.vulnerabilities) {
    const emoji = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : '🟡';
    lines.push(`- ${emoji} **${v.name}** (${v.severity}) — afecta \`${v.range}\`${v.via ? ` vía ${v.via}` : ''}`);
  }

  return `### 🔒 Vulnerabilidades de Seguridad (pnpm audit)

${lines.join('\n')}

> _Ejecutar \`pnpm audit --fix\` para actualizar dependencias automáticamente._

---

`;
}

function shouldOpenIssue(
  current:     AiAnalysisResult,
  cache:       Cache,
  triggerType: string,
  audit:       AuditReport,
): boolean {
  // Security vulnerabilities always warrant an issue
  if (audit.totalCritical > 0 || audit.totalHigh > 0) return true;
  // Post-deploy: solo abrir si hay degradación respecto al estado anterior
  if (triggerType === 'post-deploy') {
    if (current.status === 'critical') return true;
    if (current.issues.some(i => i.severity === 'high')) return true;
    const prev = cache.lastAnalysis?.status;
    if (prev === 'healthy' && current.status !== 'healthy') return true;
    return false;
  }

  // Semanal/manual: lógica original
  if (current.status === 'critical') return true;
  if (current.issues.some(i => i.severity === 'high')) return true;
  if (current.recommendations.some(r => r.priority === 'urgent')) return true;
  if (cache.lastAnalysis?.status === 'healthy' && current.status === 'warning') return true;
  return false;
}

// ── Paso 4: Formatear issue ──────────────────────────────────────────────────

const SEVERITY_EMOJI = { high: '🔴', medium: '🟡', low: '🟢' };
const STATUS_EMOJI   = { healthy: '✅', warning: '⚠️', critical: '🚨' };
const PRIORITY_EMOJI = { urgent: '🔥', normal: '📌', optional: '💡' };

function buildIssueBody(
  result:          AiAnalysisResult,
  previousStatus:  string | undefined,
  trendSummary:    string,
  deployContext:   string,
  triggerType:     string,
  securitySection: string,
): string {
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

  return `## ${STATUS_EMOJI[result.status]} Diagnóstico ${triggerType === 'post-deploy' ? 'Post-Deploy' : 'Semanal'} — ${date}
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

### 📈 Tendencia (últimas semanas)

${trendSummary}

---

### ✅ Aspectos Positivos

${result.positives.map(p => `- ${p}`).join('\n')}

---

${securitySection}${deployContext ? `### 🚀 Cambios Desplegados Esta Semana\n\n${deployContext}\n\n---\n\n` : ''}<details>
<summary>📊 Metadatos del análisis</summary>

- **Analizado:** ${new Date(result.analyzedAt).toLocaleString('es-DO')}
- **Modo:** ${triggerType === 'post-deploy' ? 'Post-deploy automático' : 'Diagnóstico semanal programado'}
- **Generado por:** Agente de Mantenimiento SERVINGMI (Claude via \`/monitoring/ai-analyze\`)
- **Backend:** \`${BACKEND_URL}\`

</details>
`;
}

// ── Paso 5: Crear GitHub Issue ───────────────────────────────────────────────

async function createGitHubIssue(
  result:          AiAnalysisResult,
  previousStatus:  string | undefined,
  trendSummary:    string,
  deployContext:   string,
  triggerType:     string,
  securitySection: string,
): Promise<{ url: string; number: number }> {
  if (!GH_TOKEN || !GH_REPO) {
    console.log('⚠️  GH_TOKEN o GH_REPO no configurados — saltando creación de issue');
    return { url: '', number: 0 };
  }

  console.log('📝 Creando GitHub Issue...');

  const statusEmoji = STATUS_EMOJI[result.status];
  const weekDate = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
  const modeLabel = triggerType === 'post-deploy' ? 'Post-Deploy' : 'Semanal';
  const title = `${statusEmoji} Diagnóstico ${modeLabel} [${result.status.toUpperCase()}] — ${weekDate}`;

  const labels = ['maintenance', 'automated'];
  if (result.status === 'critical') labels.push('priority: high');
  if (result.status === 'warning')  labels.push('priority: medium');

  const body = buildIssueBody(result, previousStatus, trendSummary, deployContext, triggerType, securitySection);

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
  return { url: data.html_url as string, number: data.number as number };
}

// ── Helpers post-issue ───────────────────────────────────────────────────────

async function commentAndCloseIssue(issueNumber: number): Promise<void> {
  if (!GH_TOKEN || !GH_REPO) return;

  const base = `https://api.github.com/repos/${GH_REPO}/issues/${issueNumber}`;
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  await fetchJson(`${base}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      body: `✅ **Sistema recuperado** — ${new Date().toLocaleString('es-DO')}\n\nEl sistema ha vuelto al estado \`healthy\`. Tasa de error dentro de límites normales.\n\n> _Cierre automático por el Agente de Mantenimiento SERVINGMI_`,
    }),
  });

  await fetchJson(base, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  });

  console.log(`   ✅ Issue #${issueNumber} cerrado automáticamente`);
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

  // 2b. Security audit
  console.log('🔒 Ejecutando auditoría de seguridad...');
  const audit = runPnpmAudit();
  if (audit.vulnerabilities.length > 0) {
    console.log(`   ⚠️  ${audit.totalCritical} críticas, ${audit.totalHigh} altas, ${audit.vulnerabilities.length} total`);
  } else {
    console.log('   ✅ Sin vulnerabilidades detectadas');
  }

  // 3. Decidir si crear issue
  const needsIssue = shouldOpenIssue(analysis, cache, TRIGGER_TYPE, audit);
  console.log(`\n📊 Estado: ${analysis.status} | Abrir issue: ${needsIssue ? 'SÍ' : 'NO'}`);

  // Recovery: close issue if system is back to healthy
  const systemRecovered =
    analysis.status === 'healthy' &&
    cache.lastAnalysis?.status !== 'healthy' &&
    cache.lastIssueNumber !== null;

  if (systemRecovered && cache.lastIssueNumber) {
    console.log(`\n🔄 Sistema recuperado — cerrando issue #${cache.lastIssueNumber}...`);
    await commentAndCloseIssue(cache.lastIssueNumber);
  }

  let issueUrl = '';
  let issueNumber: number | null = null;
  if (needsIssue) {
    const deployContext = getDeployContext();
    const trendSummary = buildTrendSummary(cache.history);
    const securitySection = buildSecuritySection(audit);
    const created = await createGitHubIssue(
      analysis,
      cache.lastAnalysis?.status,
      trendSummary,
      deployContext,
      TRIGGER_TYPE,
      securitySection,
    );
    issueUrl = created.url;
    issueNumber = created.number !== 0 ? created.number : null;
  } else {
    console.log('✅ Sistema saludable — no se requiere issue esta semana');
  }

  // 4. Actualizar cache con history
  let newCache: Cache = {
    lastAnalysis: analysis,
    lastIssueUrl: issueUrl || (systemRecovered ? null : cache.lastIssueUrl),
    lastIssueNumber: issueNumber ?? (systemRecovered ? null : cache.lastIssueNumber),
    lastRunAt:    new Date().toISOString(),
    history:      cache.history,
  };
  newCache = pushHistory(newCache, analysis, issueUrl || cache.lastIssueUrl);
  saveCache(newCache);

  console.log('\n✅ Agente completado\n');
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
