# Supplier Auto-Assign + AI Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Auto-assign suppliers to a project from existing payment history (deterministic). (2) AI agent that suggests additional suppliers based on office expense text and cross-project usage patterns.

**Architecture:** Two new backend endpoints added to the existing `project-suppliers.router.ts`. One service function does a deterministic DB scan. One calls Claude Haiku with project payment/expense data and returns ranked suggestions. Frontend adds two UI elements to ProjectDetailPage: an "Importar" button and a "Sugerencias IA" section.

**Tech Stack:** Prisma, Express, `@anthropic-ai/sdk` (already installed), React 18 + TanStack Query.

---

## File Map

### Modify
- `apps/backend/src/modules/suppliers/project-suppliers.service.ts` — add `importFromPayments()` and `getAiSuggestions()`
- `apps/backend/src/modules/suppliers/project-suppliers.router.ts` — add POST `/import-from-payments` and GET `/suggestions`
- `apps/frontend/src/api/index.ts` — add `importFromPayments` and `getSuggestions` to `projectSuppliersApi`
- `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` — add Import button + AI suggestions section

---

## Task 1: Backend — `importFromPayments` service function + endpoint

**Files:**
- Modify: `apps/backend/src/modules/suppliers/project-suppliers.service.ts`
- Modify: `apps/backend/src/modules/suppliers/project-suppliers.router.ts`

- [ ] **Step 1: Add `importFromPayments` to the service**

  Open `apps/backend/src/modules/suppliers/project-suppliers.service.ts` and add at the end:

  ```typescript
  export async function importFromPayments(projectId: string): Promise<{ imported: number; skipped: number }> {
    // Find all non-voided payment orders for this project that have a supplier
    const orders = await prisma.paymentOrder.findMany({
      where: { projectId, status: { not: 'VOIDED' }, supplierId: { not: null } },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });

    let imported = 0;
    let skipped  = 0;

    for (const order of orders) {
      if (!order.supplierId) continue;
      try {
        await prisma.projectSupplier.create({
          data: { projectId, supplierId: order.supplierId },
        });
        imported++;
      } catch (e: any) {
        if (e.code === 'P2002') skipped++; // already assigned
        else throw e;
      }
    }

    return { imported, skipped };
  }
  ```

- [ ] **Step 2: Add POST `/import-from-payments` to the router**

  In `apps/backend/src/modules/suppliers/project-suppliers.router.ts`, add the import and the route:

  ```typescript
  import {
    listProjectSuppliers,
    assignSupplierToProject,
    removeSupplierFromProject,
    importFromPayments,
  } from './project-suppliers.service';
  ```

  Add route BEFORE the DELETE `/:supplierId` route:

  ```typescript
  // POST /projects/:projectId/suppliers/import-from-payments
  router.post('/import-from-payments', authorize('admin', 'supervisor'), async (req, res) => {
    try {
      const result = await importFromPayments(req.params.projectId);
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Error importando suplidores' });
    }
  });
  ```

  **Important:** This route must be added BEFORE `/:supplierId` or Express will interpret `import-from-payments` as a supplierId param. Place it between the POST `/` route and the DELETE `/:supplierId` route.

- [ ] **Step 3: Build**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:backend 2>&1 | tail -10
  ```

  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/project-suppliers.service.ts \
          apps/backend/src/modules/suppliers/project-suppliers.router.ts
  git commit -m "feat(suppliers): add import-from-payments endpoint"
  ```

---

## Task 2: Backend — `getAiSuggestions` service function + endpoint

**Files:**
- Modify: `apps/backend/src/modules/suppliers/project-suppliers.service.ts`
- Modify: `apps/backend/src/modules/suppliers/project-suppliers.router.ts`

The AI agent will:
1. Collect context: already-assigned suppliers, payment orders for this project, office expenses with free-text `supplierName`, all active suppliers
2. Call Claude Haiku with this context
3. Return a list of ranked suggestions (supplierId, name, reason, confidence)

- [ ] **Step 1: Add `getAiSuggestions` to the service**

  Add at the top of `project-suppliers.service.ts`:
  ```typescript
  import Anthropic from '@anthropic-ai/sdk';
  import { env } from '../../config/env';
  ```

  Add at the end of the file:

  ```typescript
  export type SupplierSuggestion = {
    supplierId: string;
    name: string;
    rnc: string | null;
    reason: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  export async function getAiSuggestions(projectId: string): Promise<SupplierSuggestion[]> {
    // 1. Already assigned supplier IDs (exclude from suggestions)
    const assigned = await prisma.projectSupplier.findMany({
      where: { projectId },
      select: { supplierId: true },
    });
    const assignedIds = new Set(assigned.map((a) => a.supplierId));

    // 2. Payment orders for this project (with supplier info)
    const orders = await prisma.paymentOrder.findMany({
      where: { projectId, status: { not: 'VOIDED' } },
      select: { supplierId: true, concept: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 3. All active suppliers NOT yet assigned
    const candidates = await prisma.supplier.findMany({
      where: { isActive: true, id: { notIn: [...assignedIds] }, deletedAt: null },
      select: { id: true, name: true, rnc: true },
      orderBy: { name: 'asc' },
    });

    // 4. Suppliers used in OTHER projects (cross-project usage signal)
    const crossProject = await prisma.projectSupplier.findMany({
      where: { projectId: { not: projectId }, supplierId: { in: candidates.map((c) => c.id) } },
      select: { supplierId: true, projectId: true },
    });
    const crossProjectCount: Record<string, number> = {};
    for (const cp of crossProject) {
      crossProjectCount[cp.supplierId] = (crossProjectCount[cp.supplierId] ?? 0) + 1;
    }

    if (candidates.length === 0) return [];

    // 5. Build prompt context
    const paymentSummary = orders
      .filter((o) => o.supplierId)
      .map((o) => `- ${o.supplier?.name ?? 'Desconocido'}: ${o.concept}`)
      .slice(0, 20)
      .join('\n');

    const candidateList = candidates
      .map((c) => `${c.id}|${c.name}${c.rnc ? `|RNC:${c.rnc}` : ''}|proyectos_previos:${crossProjectCount[c.id] ?? 0}`)
      .join('\n');

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Eres un asistente de una empresa constructora dominicana. Analiza los pagos realizados en este proyecto y sugiere cuáles de los suplidores candidatos deberían ser asignados.

PAGOS RECIENTES DEL PROYECTO (concepto):
${paymentSummary || 'Sin pagos registrados aún'}

SUPLIDORES CANDIDATOS (id|nombre|RNC|proyectos_previos):
${candidateList}

Devuelve SOLO un JSON válido con este formato, sin texto adicional:
[
  {"supplierId": "uuid", "reason": "razón breve en español", "confidence": "HIGH|MEDIUM|LOW"},
  ...
]

Reglas:
- Sugiere máximo 8 suplidores
- Solo incluye suplidores con relevancia real para el proyecto
- HIGH = muy probable (nombre match, tipo de trabajo similar)
- MEDIUM = posible (categoría relacionada, usado en varios proyectos)  
- LOW = especulativo
- Si no hay suficiente contexto para sugerir, devuelve []`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

    let raw: Array<{ supplierId: string; reason: string; confidence: string }> = [];
    try {
      raw = JSON.parse(text);
    } catch {
      return [];
    }

    // Map back to full suggestion objects
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    return raw
      .filter((r) => candidateMap.has(r.supplierId))
      .map((r) => {
        const c = candidateMap.get(r.supplierId)!;
        return {
          supplierId: c.id,
          name: c.name,
          rnc: c.rnc,
          reason: r.reason,
          confidence: r.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
        };
      });
  }
  ```

- [ ] **Step 2: Add GET `/suggestions` to the router**

  Add the import:
  ```typescript
  import {
    listProjectSuppliers,
    assignSupplierToProject,
    removeSupplierFromProject,
    importFromPayments,
    getAiSuggestions,
  } from './project-suppliers.service';
  ```

  Add route (BEFORE `/:supplierId`):

  ```typescript
  // GET /projects/:projectId/suppliers/suggestions
  router.get('/suggestions', authorize('admin', 'supervisor'), async (req, res) => {
    try {
      const data = await getAiSuggestions(req.params.projectId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Error generando sugerencias' });
    }
  });
  ```

- [ ] **Step 3: Check `env` config has `ANTHROPIC_API_KEY`**

  Run:
  ```bash
  grep -r "ANTHROPIC_API_KEY" apps/backend/src/config/ | head -5
  ```

  If the env config exports `ANTHROPIC_API_KEY`, use `env.ANTHROPIC_API_KEY`. If not, use `process.env.ANTHROPIC_API_KEY` directly.

- [ ] **Step 4: Build**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:backend 2>&1 | tail -15
  ```

  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/project-suppliers.service.ts \
          apps/backend/src/modules/suppliers/project-suppliers.router.ts
  git commit -m "feat(suppliers): add AI suggestions endpoint for project supplier assignment"
  ```

---

## Task 3: Frontend API + ProjectDetailPage UI

**Files:**
- Modify: `apps/frontend/src/api/index.ts`
- Modify: `apps/frontend/src/pages/projects/ProjectDetailPage.tsx`

- [ ] **Step 1: Add new API methods to `projectSuppliersApi`**

  In `apps/frontend/src/api/index.ts`, find the `projectSuppliersApi` object and add two methods:

  ```typescript
  export type SupplierSuggestion = {
    supplierId: string;
    name: string;
    rnc: string | null;
    reason: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  export const projectSuppliersApi = {
    list: (projectId: string) =>
      api.get<{ success: boolean; data: ProjectSupplierEntry[] }>(`/projects/${projectId}/suppliers`),
    assign: (projectId: string, supplierId: string) =>
      api.post<{ success: boolean; data: ProjectSupplierEntry }>(`/projects/${projectId}/suppliers`, { supplierId }),
    remove: (projectId: string, supplierId: string) =>
      api.delete<{ success: boolean }>(`/projects/${projectId}/suppliers/${supplierId}`),
    // NEW:
    importFromPayments: (projectId: string) =>
      api.post<{ success: boolean; data: { imported: number; skipped: number } }>(`/projects/${projectId}/suppliers/import-from-payments`, {}),
    getSuggestions: (projectId: string) =>
      api.get<{ success: boolean; data: SupplierSuggestion[] }>(`/projects/${projectId}/suppliers/suggestions`),
  };
  ```

- [ ] **Step 2: Add state + mutations for import and suggestions in ProjectDetailPage**

  Read `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` to find where `assignMut` and `removeMut` are declared. After them, add:

  ```typescript
  const [showSuggestions, setShowSuggestions] = useState(false);

  const importMut = useMutation({
    mutationFn: () => projectSuppliersApi.importFromPayments(id!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['project-suppliers', id] });
      const { imported, skipped } = res.data.data;
      alert(`Importados: ${imported} suplidores nuevos. Ya asignados: ${skipped}.`);
    },
  });

  const { data: suggestionsRes, isLoading: suggestionsLoading, refetch: fetchSuggestions } = useQuery({
    queryKey: ['supplier-suggestions', id],
    queryFn: () => projectSuppliersApi.getSuggestions(id!),
    enabled: false, // manual trigger only
  });
  const suggestions: SupplierSuggestion[] = suggestionsRes?.data.data ?? [];
  ```

  Also add `SupplierSuggestion` to the import from `../../api`:
  ```typescript
  import { projectSuppliersApi, suppliersApi, type ProjectSupplierEntry, type SupplierSuggestion } from '../../api';
  ```

- [ ] **Step 3: Add UI for Import button + AI suggestions in the Suplidores section**

  Find the "Suplidores Asignados" section in the JSX. In the header div (where the "Agregar" button is), add an "Importar" button alongside:

  ```tsx
  {/* Header with 3 buttons */}
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em]">
      Suplidores Asignados
    </h2>
    {canManageSuppliers && (
      <div className="flex gap-2">
        <button
          onClick={() => { setShowSuggestions(true); fetchSuggestions(); }}
          className="flex items-center gap-1 text-xs border border-[#F5C218] text-[#F5C218] px-3 py-1 font-bold uppercase font-['Barlow_Condensed'] hover:bg-[#F5C218] hover:text-[#1C1C1C] transition-colors"
        >
          <Sparkles size={12} /> IA
        </button>
        <button
          onClick={() => importMut.mutate()}
          disabled={importMut.isPending}
          className="flex items-center gap-1 text-xs border border-gray-300 text-gray-600 px-3 py-1 font-bold uppercase font-['Barlow_Condensed'] hover:border-gray-500 disabled:opacity-50"
        >
          <Download size={12} /> {importMut.isPending ? 'Importando…' : 'Importar'}
        </button>
        <button
          onClick={() => setShowAddSupplier(true)}
          className="flex items-center gap-1 text-xs bg-[#F5C218] text-[#1C1C1C] px-3 py-1 font-bold uppercase font-['Barlow_Condensed']"
        >
          <UserPlus size={12} /> Agregar
        </button>
      </div>
    )}
  </div>
  ```

  Add `Sparkles` and `Download` to the lucide-react import.

  After the header and add-form, add the AI suggestions panel (before the table):

  ```tsx
  {/* AI Suggestions Panel */}
  {showSuggestions && (
    <div className="mb-4 border border-[#F5C218]/30 bg-[#1C1C1C]/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase text-gray-500 tracking-[0.1em] flex items-center gap-1">
          <Sparkles size={11} /> Sugerencias de IA
        </p>
        <button onClick={() => setShowSuggestions(false)} className="text-gray-400 hover:text-gray-600 text-xs font-['DM_Sans']">✕</button>
      </div>
      {suggestionsLoading ? (
        <p className="text-xs text-gray-400 font-['DM_Sans']">Analizando pagos y suplidores…</p>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-gray-400 font-['DM_Sans']">Sin sugerencias. Agrega más pagos al proyecto primero.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <div key={s.supplierId} className="flex items-start justify-between gap-3 bg-white border border-gray-100 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold font-['DM_Sans'] text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500 font-['DM_Sans'] mt-0.5">{s.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold font-['Barlow_Condensed'] uppercase px-2 py-0.5 ${
                  s.confidence === 'HIGH'   ? 'bg-green-100 text-green-700' :
                  s.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-500'
                }`}>
                  {s.confidence === 'HIGH' ? 'Alta' : s.confidence === 'MEDIUM' ? 'Media' : 'Baja'}
                </span>
                <button
                  onClick={() => assignMut.mutate(s.supplierId)}
                  disabled={assignMut.isPending}
                  className="text-xs bg-[#F5C218] text-[#1C1C1C] px-2 py-1 font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50"
                >
                  Asignar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 4: Build frontend**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:frontend 2>&1 | tail -10
  ```

  Expected: build passes.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/frontend/src/api/index.ts \
          apps/frontend/src/pages/projects/ProjectDetailPage.tsx
  git commit -m "feat(projects): add import-from-payments and AI supplier suggestions UI"
  ```

---

## Task 4: Push to production

- [ ] **Step 1: Push**

  ```bash
  git push origin main
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Auto-assign from payments (deterministic): Task 1
- ✅ AI suggestions with confidence levels: Task 2
- ✅ Frontend buttons: Import + IA + Agregar: Task 3
- ✅ Suggestions show supplier name, reason, confidence, assign button: Task 3

**Type consistency:**
- `SupplierSuggestion` defined in backend service and mirrored in frontend `api/index.ts`
- `importFromPayments` returns `{ imported, skipped }` — matched in API type and UI alert

**Route order:** Both `/import-from-payments` and `/suggestions` are string routes that MUST appear before `/:supplierId` in the router — verified in Tasks 1 and 2.

**Claude model:** Using `claude-haiku-4-5-20251001` (cheapest, fast — appropriate for this classification task). Per CLAUDE.md, valid model IDs use exact strings.
