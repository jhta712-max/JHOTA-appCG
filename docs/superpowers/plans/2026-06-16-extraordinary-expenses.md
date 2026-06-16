# Gastos Extraordinarios en Análisis Financiero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir gastos extraordinarios (comisiones, préstamos, impuestos, multas) por proyecto que solo afectan el análisis financiero, mostrando margen bruto y margen neto como líneas separadas.

**Architecture:** Nueva tabla `ProjectExtraordinaryExpense` con CRUD propio en el backend (patrón router→controller→service existente). El endpoint `GET /projects/:id/financial` incluye los extraordinarios y calcula `margenNeto`. El frontend añade una sección y dos tarjetas nuevas en el tab Análisis Financiero de `ProjectDetailPage`.

**Tech Stack:** Prisma + PostgreSQL (nueva migración), Express, Zod, React 18, TanStack Query, FormModal del design system (#1C1C1C / #F5C218).

---

## Archivos que se tocan

| Archivo | Acción |
|---|---|
| `apps/backend/prisma/schema.prisma` | Añadir modelo + enum |
| `apps/backend/prisma/migrations/20260616000003_add_extraordinary_expenses/migration.sql` | Crear |
| `apps/backend/src/modules/projects/projects.schema.ts` | Añadir schemas Zod |
| `apps/backend/src/modules/projects/projects.service.ts` | Añadir 4 funciones + enriquecer getFinancialAnalysis |
| `apps/backend/src/modules/projects/projects.controller.ts` | Añadir 4 handlers |
| `apps/backend/src/modules/projects/projects.router.ts` | Añadir 4 rutas |
| `apps/backend/src/modules/backup/backup.router.ts` | Añadir tabla al backup |
| `apps/frontend/src/types/index.ts` | Añadir tipos |
| `apps/frontend/src/api/index.ts` | Añadir métodos API |
| `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` | Añadir sección + modal + tarjetas |

---

## Task 1: Schema Prisma + migración

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260616000003_add_extraordinary_expenses/migration.sql`

- [ ] **Step 1: Añadir enum y modelo al schema**

En `apps/backend/prisma/schema.prisma`, añade el enum antes del modelo `Project` (o al final del archivo, antes del último modelo):

```prisma
enum ExtraordinaryExpenseCategory {
  COMISION
  PRESTAMO
  IMPUESTO
  MULTA
  OTRO
}
```

Y el modelo al final del archivo:

```prisma
model ProjectExtraordinaryExpense {
  id          String                       @id @default(cuid())
  projectId   String
  project     Project                      @relation(fields: [projectId], references: [id])
  description String
  amount      Decimal                      @db.Decimal(15, 2)
  date        DateTime                     @db.Date
  category    ExtraordinaryExpenseCategory
  notes       String?
  createdBy   String
  createdAt   DateTime                     @default(now())
  updatedAt   DateTime                     @updatedAt

  @@index([projectId])
  @@map("project_extraordinary_expenses")
}
```

En el modelo `Project`, añade la relación inversa junto a las demás relaciones:

```prisma
  extraordinaryExpenses ProjectExtraordinaryExpense[]
```

- [ ] **Step 2: Crear el archivo de migración SQL**

Crea el directorio y archivo:
`apps/backend/prisma/migrations/20260616000003_add_extraordinary_expenses/migration.sql`

```sql
-- CreateEnum
CREATE TYPE "ExtraordinaryExpenseCategory" AS ENUM ('COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO');

-- CreateTable
CREATE TABLE "project_extraordinary_expenses" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount"      DECIMAL(15,2) NOT NULL,
    "date"        DATE NOT NULL,
    "category"    "ExtraordinaryExpenseCategory" NOT NULL,
    "notes"       TEXT,
    "createdBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_extraordinary_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_extraordinary_expenses_projectId_idx" ON "project_extraordinary_expenses"("projectId");

-- AddForeignKey
ALTER TABLE "project_extraordinary_expenses"
    ADD CONSTRAINT "project_extraordinary_expenses_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerar el Prisma client**

```bash
pnpm --filter backend db:generate
```

Expected: `Generated Prisma Client` sin errores.

- [ ] **Step 4: Verificar que el build TypeScript pasa**

```bash
pnpm build:backend
```

Expected: sin errores de compilación.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma \
        apps/backend/prisma/migrations/20260616000003_add_extraordinary_expenses/
git commit -m "feat: add ProjectExtraordinaryExpense model and migration"
```

---

## Task 2: Backend — schemas Zod

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.schema.ts`

- [ ] **Step 1: Añadir schemas al final del archivo**

Abre `apps/backend/src/modules/projects/projects.schema.ts` y agrega al final:

```typescript
// ── Gastos Extraordinarios ───────────────────────────────────
export const createExtraordinaryExpenseSchema = z.object({
  description: z.string().min(1, 'La descripción es requerida').max(200),
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  category:    z.enum(['COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO']),
  notes:       z.string().max(500).optional(),
});

export const updateExtraordinaryExpenseSchema = createExtraordinaryExpenseSchema.partial();

export type CreateExtraordinaryExpenseInput = z.infer<typeof createExtraordinaryExpenseSchema>;
export type UpdateExtraordinaryExpenseInput = z.infer<typeof updateExtraordinaryExpenseSchema>;
```

- [ ] **Step 2: Verificar compilación**

```bash
pnpm build:backend
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/projects/projects.schema.ts
git commit -m "feat: add Zod schemas for extraordinary expenses"
```

---

## Task 3: Backend — service

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.service.ts`

- [ ] **Step 1: Añadir imports necesarios**

Al inicio de `projects.service.ts`, en la línea del import de schemas, añade los nuevos tipos:

```typescript
import {
  // ...existentes...
  CreateExtraordinaryExpenseInput,
  UpdateExtraordinaryExpenseInput,
} from './projects.schema';
```

- [ ] **Step 2: Enriquecer getFinancialAnalysis**

En la función `getFinancialAnalysis` (línea ~455), modifica el include y el cálculo. Reemplaza el bloque completo de la función:

```typescript
export async function getFinancialAnalysis(projectId: string) {
  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      addendums:             { select: { amount: true } },
      cubicaciones:          { orderBy: { number: 'asc' } },
      anticipos:             { orderBy: { number: 'asc' } },
      extraordinaryExpenses: { orderBy: { date: 'desc' } },
    },
  });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const addendumTotal   = project.addendums.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const totalBudget     = Number(project.estimatedBudget) + addendumTotal;

  const expenseStats = await prisma.expense.aggregate({
    where:  { projectId, status: 'ACTIVE' },
    _sum:   { amount: true },
    _count: { id: true },
  });

  const totalGastado       = Number(expenseStats._sum.amount ?? 0);
  const totalCubicado      = project.cubicaciones.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalAnticipos     = project.anticipos.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const totalCobrado       = totalAnticipos + totalCubicado;
  const margen             = totalCubicado - totalGastado;
  const totalExtraordinario = project.extraordinaryExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const margenNeto         = margen - totalExtraordinario;
  const lastProgress       = project.cubicaciones.length > 0
    ? Number(project.cubicaciones[project.cubicaciones.length - 1].progressPct)
    : 0;

  return {
    project: {
      id:              project.id,
      code:            project.code,
      name:            project.name,
      estimatedBudget: Number(project.estimatedBudget),
      addendumTotal,
      totalBudget,
    },
    financials: {
      totalCubicado,
      totalAnticipos,
      totalCobrado,
      totalGastado,
      margen,
      margenPct:         totalCubicado > 0 ? Math.round((margen / totalCubicado) * 10000) / 100 : 0,
      totalExtraordinario,
      margenNeto,
      margenNetoPct:     totalCubicado > 0 ? Math.round((margenNeto / totalCubicado) * 10000) / 100 : 0,
      lastProgressPct:   lastProgress,
      expenseCount:      expenseStats._count.id,
    },
    cubicaciones: project.cubicaciones.map((c: any) => ({
      id:          c.id,
      number:      c.number,
      amount:      Number(c.amount),
      progressPct: Number(c.progressPct),
      description: c.description,
      date:        c.date,
      ncf:         c.ncf ?? null,
      createdAt:   c.createdAt,
    })),
    anticipos: project.anticipos.map((a: any) => ({
      id:          a.id,
      number:      a.number,
      amount:      Number(a.amount),
      date:        a.date,
      ncf:         a.ncf ?? null,
      description: a.description ?? null,
      createdAt:   a.createdAt,
    })),
    extraordinaryExpenses: project.extraordinaryExpenses.map((e: any) => ({
      id:          e.id,
      description: e.description,
      amount:      Number(e.amount),
      date:        e.date,
      category:    e.category,
      notes:       e.notes ?? null,
      createdAt:   e.createdAt,
    })),
  };
}
```

- [ ] **Step 3: Añadir las 4 funciones CRUD al final del archivo**

```typescript
// ── Gastos Extraordinarios ───────────────────────────────────
export async function listExtraordinaryExpenses(projectId: string) {
  return prisma.projectExtraordinaryExpense.findMany({
    where:   { projectId },
    orderBy: { date: 'desc' },
  }).then(rows => rows.map(e => ({
    id:          e.id,
    description: e.description,
    amount:      Number(e.amount),
    date:        e.date,
    category:    e.category,
    notes:       e.notes ?? null,
    createdAt:   e.createdAt,
  })));
}

export async function createExtraordinaryExpense(
  projectId: string,
  data: CreateExtraordinaryExpenseInput,
  userId: string,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const row = await prisma.projectExtraordinaryExpense.create({
    data: {
      projectId,
      description: data.description,
      amount:      data.amount,
      date:        new Date(data.date),
      category:    data.category,
      notes:       data.notes ?? null,
      createdBy:   userId,
    },
  });
  return { ...row, amount: Number(row.amount) };
}

export async function updateExtraordinaryExpense(
  projectId: string,
  expId: string,
  data: UpdateExtraordinaryExpenseInput,
) {
  const existing = await prisma.projectExtraordinaryExpense.findFirst({
    where: { id: expId, projectId },
  });
  if (!existing) throw new AppError(404, 'Gasto extraordinario no encontrado', 'NOT_FOUND');

  const row = await prisma.projectExtraordinaryExpense.update({
    where: { id: expId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount      !== undefined && { amount:      data.amount }),
      ...(data.date        !== undefined && { date:        new Date(data.date) }),
      ...(data.category    !== undefined && { category:    data.category }),
      ...(data.notes       !== undefined && { notes:       data.notes }),
    },
  });
  return { ...row, amount: Number(row.amount) };
}

export async function deleteExtraordinaryExpense(projectId: string, expId: string) {
  const existing = await prisma.projectExtraordinaryExpense.findFirst({
    where: { id: expId, projectId },
  });
  if (!existing) throw new AppError(404, 'Gasto extraordinario no encontrado', 'NOT_FOUND');
  await prisma.projectExtraordinaryExpense.delete({ where: { id: expId } });
}
```

- [ ] **Step 4: Verificar compilación**

```bash
pnpm build:backend
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/projects/projects.service.ts
git commit -m "feat: extraordinary expenses service + enrich getFinancialAnalysis"
```

---

## Task 4: Backend — controller y router

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.controller.ts`
- Modify: `apps/backend/src/modules/projects/projects.router.ts`

- [ ] **Step 1: Añadir 4 handlers al controller**

Al final de `apps/backend/src/modules/projects/projects.controller.ts`:

```typescript
// ── Gastos Extraordinarios ───────────────────────────────────
export async function listExtraordinaryExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listExtraordinaryExpenses(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createExtraordinaryExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createExtraordinaryExpense(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateExtraordinaryExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateExtraordinaryExpense(req.params.id, req.params.expId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteExtraordinaryExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteExtraordinaryExpense(req.params.id, req.params.expId);
    res.json({ success: true, message: 'Gasto extraordinario eliminado' });
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Añadir imports en el controller**

Al inicio del controller, en el import de service, añade las 4 funciones nuevas:

```typescript
import {
  // ...existentes...
  listExtraordinaryExpenses,
  createExtraordinaryExpense,
  updateExtraordinaryExpense,
  deleteExtraordinaryExpense,
} from './projects.service';
```

- [ ] **Step 3: Añadir 4 rutas al router**

Al final de `apps/backend/src/modules/projects/projects.router.ts`, antes de `export default router;`:

```typescript
// ── Gastos Extraordinarios ───────────────────────────────────
import {
  createExtraordinaryExpenseSchema,
  updateExtraordinaryExpenseSchema,
} from './projects.schema';

router.get('/:id/extraordinary-expenses',
  ctrl.listExtraordinaryExpenses,
);
router.post('/:id/extraordinary-expenses',
  authorize('admin'),
  validate(createExtraordinaryExpenseSchema),
  ctrl.createExtraordinaryExpense,
);
router.put('/:id/extraordinary-expenses/:expId',
  authorize('admin'),
  validate(updateExtraordinaryExpenseSchema),
  ctrl.updateExtraordinaryExpense,
);
router.delete('/:id/extraordinary-expenses/:expId',
  authorize('admin'),
  ctrl.deleteExtraordinaryExpense,
);
```

> **Nota:** el import de schemas ya existe al inicio del router — solo añade los dos nuevos al destructuring existente en lugar de repetir el import.

- [ ] **Step 4: Verificar compilación**

```bash
pnpm build:backend
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/projects/projects.controller.ts \
        apps/backend/src/modules/projects/projects.router.ts
git commit -m "feat: extraordinary expenses controller and router"
```

---

## Task 5: Backend — backup

**Files:**
- Modify: `apps/backend/src/modules/backup/backup.router.ts`

- [ ] **Step 1: Añadir tabla al generateBackup**

En `generateBackup()`, añade `extraordinaryExpenses` al array de `Promise.all` y al objeto `tables`:

En el `Promise.all`, añade al final de la lista:
```typescript
safe(() => prisma.projectExtraordinaryExpense.findMany()),
```

En la desestructuración añade:
```typescript
extraordinaryExpenses,
```

En el objeto `tables` añade:
```typescript
extraordinaryExpenses,
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/backup/backup.router.ts
git commit -m "feat: include extraordinary expenses in backup"
```

---

## Task 6: Frontend — tipos y API

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Añadir tipos en types/index.ts**

Añade al final (o junto a `Anticipo`):

```typescript
export type ExtraordinaryExpenseCategory = 'COMISION' | 'PRESTAMO' | 'IMPUESTO' | 'MULTA' | 'OTRO';

export interface ExtraordinaryExpense {
  id:          string;
  description: string;
  amount:      number;
  date:        string;
  category:    ExtraordinaryExpenseCategory;
  notes:       string | null;
  createdAt:   string;
}
```

En la interfaz `FinancialAnalysis` (búscala en `types/index.ts`), añade los campos nuevos en `financials` y el array:

```typescript
// Dentro de FinancialAnalysis.financials:
totalExtraordinario: number;
margenNeto:          number;
margenNetoPct:       number;

// Añade como propiedad de FinancialAnalysis:
extraordinaryExpenses: ExtraordinaryExpense[];
```

- [ ] **Step 2: Añadir métodos en api/index.ts**

En el import de types al inicio de `api/index.ts`, añade `ExtraordinaryExpense`.

En `projectsApi`, añade al final (antes del cierre `}`):

```typescript
// Gastos Extraordinarios
listExtraordinaryExpenses: (projectId: string) =>
  api.get<{ success: boolean; data: ExtraordinaryExpense[] }>(`/projects/${projectId}/extraordinary-expenses`),
createExtraordinaryExpense: (projectId: string, data: unknown) =>
  api.post<{ success: boolean; data: ExtraordinaryExpense }>(`/projects/${projectId}/extraordinary-expenses`, data),
updateExtraordinaryExpense: (projectId: string, expId: string, data: unknown) =>
  api.put<{ success: boolean; data: ExtraordinaryExpense }>(`/projects/${projectId}/extraordinary-expenses/${expId}`, data),
deleteExtraordinaryExpense: (projectId: string, expId: string) =>
  api.delete(`/projects/${projectId}/extraordinary-expenses/${expId}`),
```

- [ ] **Step 3: Verificar build frontend**

```bash
pnpm build:frontend
```

Expected: sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/types/index.ts \
        apps/frontend/src/api/index.ts
git commit -m "feat: add ExtraordinaryExpense types and API methods"
```

---

## Task 7: Frontend — UI en ProjectDetailPage

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectDetailPage.tsx`

Esta es la tarea más grande. Lee primero el bloque del tab "Análisis Financiero" para entender la estructura de tarjetas existentes y la sección de anticipos (que sirven de referencia visual).

- [ ] **Step 1: Añadir imports**

Al inicio del archivo, añade `ExtraordinaryExpense` y `ExtraordinaryExpenseCategory` al import de types. Añade `projectsApi` si aún no importa `listExtraordinaryExpenses`. Añade los íconos que necesites (busca el bloque de imports de `lucide-react` existente y añade `Zap` si no está):

```typescript
import { ..., Zap } from 'lucide-react';
import type { ..., ExtraordinaryExpense } from '../../types';
```

- [ ] **Step 2: Añadir estado y constantes para el modal**

Dentro del componente, junto al estado de anticipos, añade:

```typescript
const CATEGORY_LABELS: Record<string, string> = {
  COMISION: 'Comisión',
  PRESTAMO: 'Préstamo',
  IMPUESTO: 'Impuesto',
  MULTA:    'Multa',
  OTRO:     'Otro',
};

const CATEGORY_COLORS: Record<string, string> = {
  COMISION: 'bg-blue-100 text-blue-700',
  PRESTAMO: 'bg-orange-100 text-orange-700',
  IMPUESTO: 'bg-red-100 text-red-700',
  MULTA:    'bg-yellow-100 text-yellow-800',
  OTRO:     'bg-gray-100 text-gray-600',
};

const [extraModal, setExtraModal] = useState<{
  open: boolean;
  editing: ExtraordinaryExpense | null;
}>({ open: false, editing: null });

const [extraForm, setExtraForm] = useState({
  description: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'COMISION' as string,
  notes: '',
});
```

- [ ] **Step 3: Añadir mutations**

Junto a las mutations de anticipos, añade:

```typescript
const createExtraMut = useMutation({
  mutationFn: (data: unknown) =>
    projectsApi.createExtraordinaryExpense(projectId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', projectId] });
    setExtraModal({ open: false, editing: null });
  },
});

const updateExtraMut = useMutation({
  mutationFn: ({ expId, data }: { expId: string; data: unknown }) =>
    projectsApi.updateExtraordinaryExpense(projectId, expId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', projectId] });
    setExtraModal({ open: false, editing: null });
  },
});

const deleteExtraMut = useMutation({
  mutationFn: (expId: string) =>
    projectsApi.deleteExtraordinaryExpense(projectId, expId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', projectId] });
  },
});
```

- [ ] **Step 4: Añadir función para abrir el modal**

```typescript
function openExtraModal(editing: ExtraordinaryExpense | null) {
  setExtraForm(editing ? {
    description: editing.description,
    amount:      String(editing.amount),
    date:        editing.date.slice(0, 10),
    category:    editing.category,
    notes:       editing.notes ?? '',
  } : {
    description: '',
    amount:      '',
    date:        new Date().toISOString().slice(0, 10),
    category:    'COMISION',
    notes:       '',
  });
  setExtraModal({ open: true, editing });
}

function submitExtraForm() {
  const payload = {
    description: extraForm.description,
    amount:      parseFloat(extraForm.amount),
    date:        extraForm.date,
    category:    extraForm.category,
    notes:       extraForm.notes || undefined,
  };
  if (extraModal.editing) {
    updateExtraMut.mutate({ expId: extraModal.editing.id, data: payload });
  } else {
    createExtraMut.mutate(payload);
  }
}
```

- [ ] **Step 5: Añadir 2 tarjetas de resumen en el tab Análisis Financiero**

Dentro del tab de Análisis Financiero, busca el bloque de tarjetas de resumen (donde están "CUBICADO", "GASTOS", "MARGEN"). Añade dos tarjetas nuevas al final de ese grid:

```tsx
{/* Gastos Extraordinarios */}
<div className="bg-white border border-gray-200 p-4">
  <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider mb-1">
    Gastos Extrd.
  </p>
  <p className="font-['Space_Mono'] text-xl font-bold text-red-600">
    -{financial.financials.totalExtraordinario.toLocaleString('es-DO', {
      style: 'currency', currency: 'DOP', maximumFractionDigits: 0,
    })}
  </p>
  <p className="text-xs text-gray-400 mt-1">
    {financial.extraordinaryExpenses.length} registro{financial.extraordinaryExpenses.length !== 1 ? 's' : ''}
  </p>
</div>

{/* Margen Neto */}
<div className={`border p-4 ${financial.financials.margenNeto >= 0 ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
  <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider mb-1">
    Margen Neto
  </p>
  <p className={`font-['Space_Mono'] text-xl font-bold ${financial.financials.margenNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
    {financial.financials.margenNeto.toLocaleString('es-DO', {
      style: 'currency', currency: 'DOP', maximumFractionDigits: 0,
    })}
  </p>
  <p className="text-xs text-gray-400 mt-1">
    {financial.financials.margenNetoPct.toFixed(1)}% sobre cubicado
  </p>
</div>
```

- [ ] **Step 6: Añadir sección tabla de Gastos Extraordinarios**

Después de la sección de Anticipos (busca el bloque que empieza con "ANTICIPOS COBRADOS"), añade:

```tsx
{/* ── Gastos Extraordinarios ─────────────────────────────── */}
<div>
  <div className="bg-[#1C1C1C] px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Zap size={14} className="text-[#F5C218]" />
      <span className="font-['Barlow_Condensed'] text-sm text-white uppercase tracking-widest">
        Gastos Extraordinarios
      </span>
    </div>
    {isAdmin && (
      <button
        onClick={() => openExtraModal(null)}
        className="flex items-center gap-1 bg-[#F5C218] text-[#1C1C1C] px-3 py-1 text-xs font-bold font-['Barlow_Condensed'] uppercase hover:bg-yellow-400 transition-colors"
      >
        + Agregar
      </button>
    )}
  </div>

  {financial.extraordinaryExpenses.length === 0 ? (
    <div className="border border-t-0 border-gray-200 p-6 text-center text-sm text-gray-400">
      No hay gastos extraordinarios registrados
    </div>
  ) : (
    <table className="w-full text-sm border border-t-0 border-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {['Descripción', 'Categoría', 'Fecha', 'Monto', 'Notas', ''].map(h => (
            <th key={h} className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider px-4 py-2 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {financial.extraordinaryExpenses.map(e => (
          <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-2 font-['DM_Sans']">{e.description}</td>
            <td className="px-4 py-2">
              <span className={`text-xs px-2 py-0.5 font-['Barlow_Condensed'] uppercase font-bold ${CATEGORY_COLORS[e.category]}`}>
                {CATEGORY_LABELS[e.category]}
              </span>
            </td>
            <td className="px-4 py-2 font-['Space_Mono'] text-xs text-gray-500">
              {new Date(e.date).toLocaleDateString('es-DO')}
            </td>
            <td className="px-4 py-2 font-['Space_Mono'] text-red-600 font-bold">
              -{Number(e.amount).toLocaleString('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 })}
            </td>
            <td className="px-4 py-2 text-gray-500 text-xs max-w-[180px] truncate">
              {e.notes ?? '—'}
            </td>
            <td className="px-4 py-2">
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => openExtraModal(e)} className="text-gray-400 hover:text-[#F5C218]">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm('¿Eliminar este gasto extraordinario?')) deleteExtraMut.mutate(e.id); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
```

> **Nota:** `Pencil` y `Trash2` ya deben estar importados de lucide-react (se usan en otras secciones del mismo archivo). Verifica antes de añadir.

- [ ] **Step 7: Añadir el FormModal de creación/edición**

Al final del JSX del componente (junto a los otros modals), añade:

```tsx
{/* Modal Gasto Extraordinario */}
<FormModal
  isOpen={extraModal.open}
  onClose={() => setExtraModal({ open: false, editing: null })}
  title={extraModal.editing ? 'EDITAR GASTO EXTRAORDINARIO' : 'NUEVO GASTO EXTRAORDINARIO'}
  onSubmit={submitExtraForm}
  isSubmitting={createExtraMut.isPending || updateExtraMut.isPending}
>
  <div className="space-y-4">
    <div>
      <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
        Descripción *
      </label>
      <input
        type="text"
        value={extraForm.description}
        onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
        className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
        placeholder="Ej: Comisión bancaria enero"
        required
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
          Categoría *
        </label>
        <select
          value={extraForm.category}
          onChange={e => setExtraForm(f => ({ ...f, category: e.target.value }))}
          className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
        >
          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
          Fecha *
        </label>
        <input
          type="date"
          value={extraForm.date}
          onChange={e => setExtraForm(f => ({ ...f, date: e.target.value }))}
          className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
          required
        />
      </div>
    </div>

    <div>
      <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
        Monto (DOP) *
      </label>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={extraForm.amount}
        onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value }))}
        className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
        placeholder="0.00"
        required
      />
    </div>

    <div>
      <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
        Notas <span className="text-gray-400 normal-case">(opcional)</span>
      </label>
      <textarea
        value={extraForm.notes}
        onChange={e => setExtraForm(f => ({ ...f, notes: e.target.value }))}
        rows={2}
        className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] resize-none"
        placeholder="Detalles adicionales..."
      />
    </div>
  </div>
</FormModal>
```

- [ ] **Step 8: Verificar build**

```bash
pnpm build:frontend
```

Expected: sin errores de tipos ni de compilación.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat: extraordinary expenses UI in financial analysis tab"
```

---

## Task 8: Push final y verificación

- [ ] **Step 1: Verificar que todo compila**

```bash
pnpm build:backend && pnpm build:frontend
```

Expected: ambos sin errores.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verificar en Render**

El deploy automático en Render ejecutará `prisma migrate deploy` que aplicará la migración `20260616000003_add_extraordinary_expenses`. Verifica en el dashboard de Render que el deploy sea exitoso.

- [ ] **Step 4: Prueba manual**

1. Entra a un proyecto → tab Análisis Financiero
2. Como admin: click "+ Agregar" en la sección Gastos Extraordinarios
3. Completa el modal (descripción, categoría, fecha, monto, notas opcionales) → guardar
4. Verifica que aparece en la tabla con monto en rojo y badge de categoría
5. Verifica que "Gastos Extrd." y "Margen Neto" se actualizan en las tarjetas de resumen
6. Edita el gasto → verifica que los cambios se guardan
7. Elimina el gasto → verifica que desaparece y el margen vuelve al valor anterior
