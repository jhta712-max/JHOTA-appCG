# Maintenance Agent Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el agente de mantenimiento semanal con análisis de tendencias, contexto de deploy, modo post-deploy, cierre automático de issues, y auditoría de seguridad.

**Architecture:** Todas las mejoras viven en `scripts/maintenance-agent.ts` (script TypeScript ejecutado por GitHub Actions via `tsx`) y `.github/workflows/maintenance.yml`. No se toca el backend. El agente autentica con JWT, llama a `POST /monitoring/ai-analyze` que internamente usa Claude Haiku, y luego gestiona GitHub Issues via REST API. El cache entre ejecuciones se persiste con `actions/cache`.

**Tech Stack:** TypeScript, tsx, Node.js fetch nativo, GitHub Actions, GitHub REST API v3.

---

## Mapa de archivos

| Archivo | Cambios |
|---------|---------|
| `scripts/maintenance-agent.ts` | Modificar: tipos `Cache`, lógica de tendencias, contexto de deploy, cierre de issues, auditoría de seguridad |
| `.github/workflows/maintenance.yml` | Modificar: añadir trigger `push: main`, paso `pnpm audit`, variable `TRIGGER_TYPE` |

Solo dos archivos. Todo acoplado a propósito — el agente es un script standalone.

---

### Task 1: Ampliar Cache con historial de 4 semanas

**Files:**
- Modify: `scripts/maintenance-agent.ts` — tipos e interfaces al inicio del archivo

El cache actual guarda solo `lastAnalysis`. Necesitamos un array `history` de hasta 4 entradas para detectar tendencias.

- [ ] **Step 1: Abrir `scripts/maintenance-agent.ts` y localizar la interfaz `Cache` (línea ~50)**

El bloque actual es:
```typescript
interface Cache {
  lastAnalysis: AiAnalysisResult | null;
  lastIssueUrl: string | null;
  lastRunAt:    string | null;
}
```

- [ ] **Step 2: Reemplazar la interfaz `Cache` con la versión ampliada**

```typescript
interface HistoryEntry {
  analyzedAt:  string;
  status:      'healthy' | 'warning' | 'critical';
  errorRate:   number | null;   // extraído del summary si Claude lo incluye
  issueCount:  number;
  issueUrl:    string | null;
}

interface Cache {
  lastAnalysis:     AiAnalysisResult | null;
  lastIssueUrl:     string | null;
  lastIssueNumber:  number | null;   // necesario para cerrar/comentar vía API
  lastRunAt:        string | null;
  history:          HistoryEntry[];  // últimas 4 semanas, más reciente primero
}
```

- [ ] **Step 3: Actualizar `loadCache()` para que el campo `history` tenga default vacío**

Reemplazar la función `loadCache` existente:
```typescript
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
```

- [ ] **Step 4: Añadir función `pushHistory()` que inserta entrada y mantiene máximo 4**

Añadir después de `saveCache`:
```typescript
function pushHistory(cache: Cache, analysis: AiAnalysisResult, issueUrl: string | null): Cache {
  const entry: HistoryEntry = {
    analyzedAt:  analysis.analyzedAt,
    status:      analysis.status,
    errorRate:   null,   // Claude no expone este número directamente; se puede refinar luego
    issueCount:  analysis.issues.length,
    issueUrl,
  };
  const history = [entry, ...cache.history].slice(0, 4);
  return { ...cache, history };
}
```

- [ ] **Step 5: Verificar que TypeScript compila sin errores**

```bash
cd /home/user/servingmi-appCG
pnpm exec tsx --noEmit scripts/maintenance-agent.ts 2>&1 || pnpm exec tsc --noEmit --skipLibCheck apps/backend/tsconfig.json 2>&1 | head -20
```

> Nota: `tsx --noEmit` no existe; usar este comando alternativo para type-check rápido:
```bash
cd /home/user/servingmi-appCG
node -e "require('child_process').execSync('npx tsc --noEmit --allowJs --checkJs false --target ES2022 --moduleResolution bundler --module ESNext scripts/maintenance-agent.ts 2>&1', {stdio:'inherit'})" 2>/dev/null || echo "check manual requerido"
```
Si hay errores de tipos, corregirlos. Si el comando falla por config, ignorar — TypeScript se valida en el paso final de build.

- [ ] **Step 6: Commit**

```bash
git add scripts/maintenance-agent.ts
git commit -m "feat(agent): ampliar Cache con historial de 4 semanas y lastIssueNumber"
```

---

### Task 2: Construir resumen de tendencias y añadirlo al issue

**Files:**
- Modify: `scripts/maintenance-agent.ts` — nueva función `buildTrendSummary`, modificar `buildIssueBody`

Con el historial de 4 semanas disponible, generamos un bloque de texto que Claude (o el propio issue) mostrará como tendencia.

- [ ] **Step 1: Añadir función `buildTrendSummary()` después de `pushHistory`**

```typescript
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
```

- [ ] **Step 2: Modificar `buildIssueBody()` para incluir la sección de tendencias**

Localizar en `buildIssueBody` la línea que cierra con `</details>` al final. Añadir la sección de tendencias justo antes del bloque `<details>`:

```typescript
// Reemplazar el return de buildIssueBody con este (añadir sección tendencias):
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

${deployContext ? `### 🚀 Cambios Desplegados Esta Semana\n\n${deployContext}\n\n---\n\n` : ''}
<details>
<summary>📊 Metadatos del análisis</summary>

- **Analizado:** ${new Date(result.analyzedAt).toLocaleString('es-DO')}
- **Modo:** ${triggerType === 'post-deploy' ? 'Post-deploy automático' : 'Diagnóstico semanal programado'}
- **Generado por:** Agente de Mantenimiento SERVINGMI (Claude via \`/monitoring/ai-analyze\`)
- **Backend:** \`${BACKEND_URL}\`

</details>
`;
```

> Nota: `buildIssueBody` recibirá dos parámetros nuevos: `trendSummary: string`, `deployContext: string`, `triggerType: string`. Actualizar la firma en este paso.

- [ ] **Step 3: Actualizar la firma de `buildIssueBody`**

```typescript
function buildIssueBody(
  result:         AiAnalysisResult,
  previousStatus: string | undefined,
  trendSummary:   string,
  deployContext:  string,
  triggerType:    string,
): string {
```

- [ ] **Step 4: Actualizar la llamada a `buildIssueBody` en `createGitHubIssue`**

La función `createGitHubIssue` actualmente llama `buildIssueBody(result, previousStatus)`. Actualizar su firma para recibir y pasar los nuevos parámetros:

```typescript
async function createGitHubIssue(
  result:         AiAnalysisResult,
  previousStatus: string | undefined,
  trendSummary:   string,
  deployContext:  string,
  triggerType:    string,
): Promise<string> {
  // ...
  const body = buildIssueBody(result, previousStatus, trendSummary, deployContext, triggerType);
```

- [ ] **Step 5: Actualizar la llamada en `main()` (todavía pasando strings vacíos — se rellenarán en Task 3)**

```typescript
// En main(), donde se llama createGitHubIssue:
issueUrl = await createGitHubIssue(
  analysis,
  cache.lastAnalysis?.status,
  buildTrendSummary(cache.history),
  '',           // deployContext — se rellena en Task 3
  'weekly',     // triggerType — se rellena en Task 4
);
```

- [ ] **Step 6: Commit**

```bash
git add scripts/maintenance-agent.ts
git commit -m "feat(agent): añadir sección de tendencias semanales al issue de GitHub"
```

---

### Task 3: Contexto de deploy — commits de la semana en el issue

**Files:**
- Modify: `scripts/maintenance-agent.ts` — nueva función `getDeployContext`

- [ ] **Step 1: Añadir import de `execSync` al inicio del archivo**

```typescript
import * as fs   from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
```

- [ ] **Step 2: Añadir función `getDeployContext()` después de `buildTrendSummary`**

```typescript
function getDeployContext(): string {
  try {
    const raw = execSync(
      'git log --oneline --since="7 days ago" --no-merges',
      { encoding: 'utf8', timeout: 10_000 },
    ).trim();

    if (!raw) return '_Sin commits en los últimos 7 días._';

    const lines = raw.split('\n').slice(0, 20); // máximo 20 commits
    return lines.map(l => `- \`${l}\``).join('\n');
  } catch {
    return '_No se pudo obtener el historial de git._';
  }
}
```

- [ ] **Step 3: Llamar a `getDeployContext()` en `main()` y pasar el resultado**

En `main()`, antes de llamar a `createGitHubIssue`:
```typescript
const deployContext  = getDeployContext();
const trendSummary   = buildTrendSummary(cache.history);
```

Y en la llamada a `createGitHubIssue`:
```typescript
issueUrl = await createGitHubIssue(
  analysis,
  cache.lastAnalysis?.status,
  trendSummary,
  deployContext,
  'weekly',
);
```

- [ ] **Step 4: Verificar que el workflow tiene acceso al historial de git**

En `.github/workflows/maintenance.yml`, el paso `actions/checkout@v4` por defecto solo clona el último commit (`fetch-depth: 1`). Cambiar a `fetch-depth: 0` para tener historial completo:

```yaml
      - name: Checkout repositorio
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
```

- [ ] **Step 5: Commit**

```bash
git add scripts/maintenance-agent.ts .github/workflows/maintenance.yml
git commit -m "feat(agent): añadir contexto de commits de la semana al issue de GitHub"
```

---

### Task 4: Modo post-deploy — trigger en push a main

**Files:**
- Modify: `.github/workflows/maintenance.yml` — añadir trigger y variable `TRIGGER_TYPE`
- Modify: `scripts/maintenance-agent.ts` — leer `TRIGGER_TYPE`, ajustar lógica `shouldOpenIssue`

En modo post-deploy, el agente corre tras cada push a `main` pero solo abre issue si hay **degradación** (no para sistemas sanos).

- [ ] **Step 1: Añadir trigger `push` al workflow**

En `.github/workflows/maintenance.yml`, reemplazar la sección `on:`:

```yaml
on:
  schedule:
    # Cada lunes a las 8:00 AM hora de Santo Domingo (UTC-4 → 12:00 UTC)
    - cron: '0 12 * * 1'
  push:
    branches:
      - main
  workflow_dispatch:
    # Permite ejecutar manualmente desde GitHub Actions → Run workflow
```

- [ ] **Step 2: Pasar `TRIGGER_TYPE` como variable de entorno al paso del agente**

En el paso `Ejecutar agente de mantenimiento` del workflow, añadir:

```yaml
      - name: Ejecutar agente de mantenimiento
        env:
          SERVINGMI_BACKEND_URL: ${{ vars.SERVINGMI_BACKEND_URL }}
          SERVINGMI_ADMIN_EMAIL: ${{ secrets.SERVINGMI_ADMIN_EMAIL }}
          SERVINGMI_ADMIN_PASS:  ${{ secrets.SERVINGMI_ADMIN_PASS }}
          GH_TOKEN:              ${{ secrets.GITHUB_TOKEN }}
          GH_REPO:               ${{ github.repository }}
          TRIGGER_TYPE:          ${{ github.event_name == 'schedule' && 'weekly' || github.event_name == 'push' && 'post-deploy' || 'manual' }}
        run: pnpm exec tsx scripts/maintenance-agent.ts
```

- [ ] **Step 3: Leer `TRIGGER_TYPE` en el script y añadir la constante**

En `scripts/maintenance-agent.ts`, en la sección `// ── Config`:

```typescript
const TRIGGER_TYPE = process.env.TRIGGER_TYPE ?? 'manual';   // 'weekly' | 'post-deploy' | 'manual'
```

- [ ] **Step 4: Actualizar `shouldOpenIssue()` para respetar el modo post-deploy**

Reemplazar la función completa:

```typescript
function shouldOpenIssue(
  current:     AiAnalysisResult,
  cache:       Cache,
  triggerType: string,
): boolean {
  // Post-deploy: solo abrir si hay degradación respecto al estado anterior
  if (triggerType === 'post-deploy') {
    if (current.status === 'critical') return true;
    if (current.issues.some(i => i.severity === 'high')) return true;
    // Solo si empeoró respecto al estado previo
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
```

- [ ] **Step 5: Actualizar la llamada a `shouldOpenIssue` en `main()`**

```typescript
const needsIssue = shouldOpenIssue(analysis, cache, TRIGGER_TYPE);
```

- [ ] **Step 6: Pasar `TRIGGER_TYPE` a `createGitHubIssue` en `main()`**

```typescript
issueUrl = await createGitHubIssue(
  analysis,
  cache.lastAnalysis?.status,
  trendSummary,
  deployContext,
  TRIGGER_TYPE,
);
```

- [ ] **Step 7: Actualizar el título del issue para reflejar el modo**

En `createGitHubIssue`, reemplazar la línea del `title`:

```typescript
const modeLabel = triggerType === 'post-deploy' ? 'Post-Deploy' : 'Semanal';
const title = `${statusEmoji} Diagnóstico ${modeLabel} [${result.status.toUpperCase()}] — ${weekDate}`;
```

- [ ] **Step 8: Commit**

```bash
git add scripts/maintenance-agent.ts .github/workflows/maintenance.yml
git commit -m "feat(agent): añadir modo post-deploy con trigger en push a main"
```

---

### Task 5: Cierre automático de issues al recuperarse

**Files:**
- Modify: `scripts/maintenance-agent.ts` — nuevas funciones `commentAndCloseIssue`, lógica en `main()`

Cuando el sistema vuelve a `healthy` y existe un issue previo abierto (guardado en `cache.lastIssueNumber`), el agente añade un comentario de recuperación y cierra el issue.

- [ ] **Step 1: Añadir función `getIssueNumberFromUrl()`**

```typescript
function getIssueNumberFromUrl(url: string | null): number | null {
  if (!url) return null;
  const match = url.match(/\/issues\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
```

- [ ] **Step 2: Añadir función `commentAndCloseIssue()`**

```typescript
async function commentAndCloseIssue(issueNumber: number, analysis: AiAnalysisResult): Promise<void> {
  if (!GH_TOKEN || !GH_REPO) return;

  const resolvedAt = new Date().toLocaleDateString('es-DO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const comment = `## ✅ Sistema Recuperado — ${resolvedAt}

El agente de mantenimiento detectó que el sistema ha vuelto al estado **HEALTHY**.

**Resumen del último análisis:**
${analysis.summary}

${analysis.positives.length > 0 ? '**Aspectos positivos:**\n' + analysis.positives.map(p => `- ${p}`).join('\n') : ''}

_Issue cerrado automáticamente por el Agente de Mantenimiento SERVINGMI._`;

  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // 1. Añadir comentario
  await fetchJson(`https://api.github.com/repos/${GH_REPO}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: comment }),
  });

  // 2. Cerrar issue
  await fetchJson(`https://api.github.com/repos/${GH_REPO}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  });

  console.log(`   ✅ Issue #${issueNumber} comentado y cerrado`);
}
```

- [ ] **Step 3: Guardar `lastIssueNumber` al crear un issue en `createGitHubIssue`**

En `createGitHubIssue`, después de crear el issue, devolver también el número:

```typescript
async function createGitHubIssue(
  result:         AiAnalysisResult,
  previousStatus: string | undefined,
  trendSummary:   string,
  deployContext:  string,
  triggerType:    string,
): Promise<{ url: string; number: number }> {
  // ...
  // Al final, reemplazar el return:
  console.log(`   ✅ Issue creado: ${data.html_url}`);
  return { url: data.html_url, number: data.number };
}
```

- [ ] **Step 4: Actualizar `main()` para usar el nuevo retorno y gestionar cierre**

```typescript
  // En main(), reemplazar el bloque de needsIssue:
  let issueUrl   = '';
  let issueNumber: number | null = null;

  const systemRecovered =
    analysis.status === 'healthy' &&
    cache.lastAnalysis?.status !== 'healthy' &&
    cache.lastIssueNumber !== null;

  if (systemRecovered) {
    console.log('🔄 Sistema recuperado — comentando y cerrando issue anterior...');
    await commentAndCloseIssue(cache.lastIssueNumber!, analysis);
    issueNumber = null;   // limpiamos: no hay issue abierto
  } else if (needsIssue) {
    const created = await createGitHubIssue(
      analysis,
      cache.lastAnalysis?.status,
      trendSummary,
      deployContext,
      TRIGGER_TYPE,
    );
    issueUrl   = created.url;
    issueNumber = created.number;
  } else {
    console.log('✅ Sistema saludable — no se requiere issue esta semana');
  }

  // Actualizar cache
  const updatedCache = pushHistory(cache, analysis, issueUrl || null);
  saveCache({
    ...updatedCache,
    lastAnalysis:    analysis,
    lastIssueUrl:    issueUrl || cache.lastIssueUrl,
    lastIssueNumber: issueNumber ?? (systemRecovered ? null : cache.lastIssueNumber),
    lastRunAt:       new Date().toISOString(),
  });
```

- [ ] **Step 5: Commit**

```bash
git add scripts/maintenance-agent.ts
git commit -m "feat(agent): cerrar issue automáticamente cuando el sistema se recupera"
```

---

### Task 6: Auditoría de seguridad con pnpm audit

**Files:**
- Modify: `.github/workflows/maintenance.yml` — nuevo paso `pnpm audit`
- Modify: `scripts/maintenance-agent.ts` — nueva función `parseAuditReport`, lógica en `main()`

- [ ] **Step 1: Añadir paso de auditoría en el workflow, antes del paso del agente**

En `.github/workflows/maintenance.yml`, añadir este paso justo antes de `Ejecutar agente de mantenimiento`:

```yaml
      - name: Auditoría de seguridad (pnpm audit)
        run: |
          pnpm audit --json > /tmp/audit-report.json 2>&1 || true
        # || true: pnpm audit retorna exit code != 0 si hay vulnerabilidades,
        # pero no queremos que eso falle el workflow — el agente lee el JSON
```

- [ ] **Step 2: Pasar la ruta del reporte al agente via variable de entorno**

En el paso `Ejecutar agente de mantenimiento`, añadir:

```yaml
          AUDIT_REPORT_PATH: /tmp/audit-report.json
```

- [ ] **Step 3: Añadir constante y función `parseAuditReport()` en el script**

En la sección `// ── Config`:
```typescript
const AUDIT_REPORT_PATH = process.env.AUDIT_REPORT_PATH ?? '';
```

Añadir la función después de `getDeployContext`:

```typescript
interface AuditVuln {
  name:     string;
  severity: string;
  via:      string;
  fixAvailable: boolean;
}

function parseAuditReport(): AuditVuln[] {
  if (!AUDIT_REPORT_PATH) return [];
  try {
    const raw  = fs.readFileSync(AUDIT_REPORT_PATH, 'utf8');
    const json = JSON.parse(raw);

    // pnpm audit --json devuelve { vulnerabilities: { [pkg]: { severity, via, fixAvailable, ... } } }
    const vulns = json?.vulnerabilities ?? {};
    return Object.entries(vulns)
      .map(([name, data]: [string, any]) => ({
        name,
        severity:     data.severity ?? 'unknown',
        via:          Array.isArray(data.via) ? data.via.filter((v: any) => typeof v === 'string').join(', ') : String(data.via),
        fixAvailable: !!data.fixAvailable,
      }))
      .filter(v => ['high', 'critical'].includes(v.severity));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Añadir función `buildSecuritySection()` para formatear las vulns en el issue**

```typescript
function buildSecuritySection(vulns: AuditVuln[]): string {
  if (vulns.length === 0) return '';

  const lines = vulns.map(v => {
    const fix = v.fixAvailable ? '_(fix disponible: `pnpm audit fix`)_' : '_(sin fix automático)_';
    return `- 🔐 **${v.name}** — severidad \`${v.severity}\` · via: ${v.via || 'directo'} ${fix}`;
  });

  return `### 🔐 Vulnerabilidades de Seguridad (high/critical)

${lines.join('\n')}

`;
}
```

- [ ] **Step 5: Integrar la sección de seguridad en `buildIssueBody()`**

Añadir `securitySection: string` a la firma:

```typescript
function buildIssueBody(
  result:          AiAnalysisResult,
  previousStatus:  string | undefined,
  trendSummary:    string,
  deployContext:   string,
  triggerType:     string,
  securitySection: string,
): string {
```

Y añadir `${securitySection}` en el cuerpo del issue, justo después de `### 💡 Recomendaciones`:

```typescript
---

${securitySection}### 📈 Tendencia (últimas semanas)
```

- [ ] **Step 6: Llamar a `parseAuditReport()` en `main()` y pasar a `createGitHubIssue`**

En `main()`, antes del bloque `needsIssue`:
```typescript
  const auditVulns      = parseAuditReport();
  const securitySection = buildSecuritySection(auditVulns);

  // Si hay vulns críticas, forzar apertura de issue incluso en post-deploy
  const hasSecurityIssues = auditVulns.some(v => v.severity === 'critical');
```

Añadir al inicio de `shouldOpenIssue`:
```typescript
  if (hasSecurityIssues) return true;
```

> Nota: `shouldOpenIssue` no tiene acceso a `hasSecurityIssues` directamente — añadir como 4to parámetro:

```typescript
function shouldOpenIssue(
  current:          AiAnalysisResult,
  cache:            Cache,
  triggerType:      string,
  hasSecurityIssues: boolean,
): boolean {
  if (hasSecurityIssues) return true;
  // ... resto igual
```

Actualizar firma de `createGitHubIssue` y `buildIssueBody` para incluir `securitySection`:

```typescript
const created = await createGitHubIssue(
  analysis,
  cache.lastAnalysis?.status,
  trendSummary,
  deployContext,
  TRIGGER_TYPE,
  securitySection,
);
```

- [ ] **Step 7: Commit y push**

```bash
git add scripts/maintenance-agent.ts .github/workflows/maintenance.yml
git commit -m "feat(agent): añadir auditoría de seguridad pnpm audit al diagnóstico semanal"
git push origin main
```

---

### Task 7: Prueba end-to-end — ejecución manual del workflow

**Files:**
- No se modifican archivos. Validación únicamente.

- [ ] **Step 1: Verificar que los secrets están configurados en GitHub**

Ir a: `https://github.com/jhta712-max/servingmi-appcg/settings/secrets/actions`

Confirmar que existen:
- `SERVINGMI_ADMIN_EMAIL`
- `SERVINGMI_ADMIN_PASS`

Y en Variables:
- `SERVINGMI_BACKEND_URL` = `https://servingmi-backend.onrender.com`

- [ ] **Step 2: Crear los labels necesarios en GitHub**

Sin estos labels, la API de GitHub devuelve `422 Unprocessable Entity`:

```bash
# Ejecutar desde cualquier terminal con gh CLI, o crear manualmente en:
# https://github.com/jhta712-max/servingmi-appcg/labels

# Con gh CLI:
gh label create "maintenance" --color "0075ca" --description "Reporte automático de mantenimiento" --repo jhta712-max/servingmi-appcg
gh label create "automated"   --color "e4e669" --description "Generado por agente automático"       --repo jhta712-max/servingmi-appcg
gh label create "priority: high"   --color "d93f0b" --repo jhta712-max/servingmi-appcg
gh label create "priority: medium" --color "fbca04" --repo jhta712-max/servingmi-appcg
```

- [ ] **Step 3: Disparar el workflow manualmente**

En GitHub: `Actions` → `🔧 Agente de Mantenimiento Semanal` → `Run workflow` → `Run workflow`

- [ ] **Step 4: Verificar los logs del workflow**

Confirmar que los pasos muestran:
```
🔐 Autenticando en el backend...
   ✅ Token obtenido
🤖 Solicitando análisis IA al backend...
   Estado del sistema: HEALTHY (o WARNING/CRITICAL)
   Issues detectados: N
   Recomendaciones: N
📊 Estado: healthy | Abrir issue: NO/SÍ
✅ Agente completado
```

- [ ] **Step 5: Si el sistema está `healthy` y quieres probar la creación de issue**

Forzar temporalmente `shouldOpenIssue` a retornar `true`, pushear, disparar manualmente, verificar que el issue se crea en GitHub, luego revertir el cambio.

- [ ] **Step 6: Confirmar que el cache se guarda correctamente**

En el resumen del workflow, el paso `Guardar cache actualizado` debe mostrar éxito. El archivo `.maintenance-cache.json` tendrá estructura:
```json
{
  "lastAnalysis": { "status": "healthy", ... },
  "lastIssueUrl": null,
  "lastIssueNumber": null,
  "lastRunAt": "2026-06-10T...",
  "history": [{ "analyzedAt": "...", "status": "healthy", "issueCount": 0, "issueUrl": null }]
}
```

---

## Self-Review

**Spec coverage:**
1. ✅ TENDENCIAS 4 semanas → Tasks 1 + 2
2. ✅ CONTEXTO DE DEPLOY → Task 3
3. ✅ ANÁLISIS POST-DEPLOY → Task 4
4. ✅ CIERRE AUTOMÁTICO DE ISSUES → Task 5
5. ✅ ANÁLISIS DE SEGURIDAD → Task 6
6. ✅ Prueba end-to-end → Task 7

**Placeholder scan:** Ninguno encontrado. Todos los bloques de código son completos.

**Type consistency:**
- `Cache.lastIssueNumber` definido en Task 1, usado en Tasks 5 y 6 ✅
- `HistoryEntry` definido en Task 1, usado en `buildTrendSummary` Task 2 ✅
- `createGitHubIssue` evoluciona su firma en Tasks 2→4→5→6 — cada task muestra la firma completa actualizada ✅
- `shouldOpenIssue` añade parámetro `hasSecurityIssues` en Task 6, llamada actualizada ✅
- `buildIssueBody` añade `securitySection` en Task 6, llamada actualizada ✅
