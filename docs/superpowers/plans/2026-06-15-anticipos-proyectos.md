# Anticipos y NCF en Proyectos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar modelo ProjectAnticipo (pagos del cliente antes de iniciar obra), campo NCF opcional en cubicaciones, y mostrar ambos en el análisis financiero del proyecto.

**Architecture:** Backend — nuevo modelo Prisma + 4 endpoints CRUD bajo `/projects/:id/anticipos` + actualización de `getFinancialAnalysis` para retornar `totalAnticipos` y `totalCobrado`. Frontend — nueva sección "Anticipos recibidos" en `ProjectFinancialPage`, tarjeta "Total cobrado", y campo NCF en el form de cubicaciones. La amortización del anticipo no se calcula automáticamente — viene incorporada en los montos de cubicaciones.

**Tech Stack:** Prisma ORM, Zod, Express, React 18, TanStack Query, TailwindCSS, Space Mono / Barlow Condensed / DM Sans fonts

---

## File Map

| Acción | Archivo |
|---|---|
| Modify | `apps/backend/prisma/schema.prisma` |
| Create | `apps/backend/prisma/migrations/20260615000002_add_anticipos/migration.sql` |
| Modify | `apps/backend/src/modules/projects/projects.schema.ts` |
| Modify | `apps/backend/src/modules/projects/projects.service.ts` |
| Modify | `apps/backend/src/modules/projects/projects.controller.ts` |
| Modify | `apps/backend/src/modules/projects/projects.router.ts` |
| Modify | `apps/frontend/src/types/index.ts` |
| Modify | `apps/frontend/src/api/index.ts` |
| Modify | `apps/frontend/src/pages/projects/ProjectFinancialPage.tsx` |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260615000002_add_anticipos/migration.sql`

### Context

- `ProjectCubicacion` está en línea ~171 del schema. Tabla: `project_cubicaciones`.
- `Project` tiene su bloque de relaciones en línea ~107–122. La tabla es `projects`.
- El schema usa `@db.Uuid` en todos los ids/fks — seguir ese patrón.

- [ ] **Step 1: Add `ncf` to ProjectCubicacion in schema.prisma**

Agregar después de `date`:
```prisma
ncf         String?  @db.VarChar(19)
```

El modelo completo queda:
```prisma
model ProjectCubicacion {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  number      Int
  amount      Decimal  @db.Decimal(15, 2)
  progressPct Decimal  @default(0) @map("progress_pct") @db.Decimal(5, 2)
  description String   @db.Text
  date        DateTime @db.Date
  ncf         String?  @db.VarChar(19)
  createdById String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User    @relation("CubicacionCreatedBy", fields: [createdById], references: [id])

  @@unique([projectId, number])
  @@index([projectId])
  @@map("project_cubicaciones")
}
```

- [ ] **Step 2: Add ProjectAnticipo model and update Project relations**

Agregar el nuevo modelo después de `ProjectCubicacion`:
```prisma
model ProjectAnticipo {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  number      Int
  amount      Decimal  @db.Decimal(15, 2)
  date        DateTime @db.Date
  ncf         String?  @db.VarChar(19)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, number])
  @@index([projectId])
  @@map("project_anticipos")
}
```

En el modelo `Project`, agregar la relación inversa (junto a `cubicaciones ProjectCubicacion[]`):
```prisma
anticipos    ProjectAnticipo[]
```

- [ ] **Step 3: Create migration SQL**

Crear directorio y archivo:
```
apps/backend/prisma/migrations/20260615000002_add_anticipos/migration.sql
```

Contenido:
```sql
-- Add ncf to project_cubicaciones
ALTER TABLE "project_cubicaciones" ADD COLUMN "ncf" VARCHAR(19);

-- Create project_anticipos
CREATE TABLE "project_anticipos" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"  UUID        NOT NULL,
  "number"      INTEGER     NOT NULL,
  "amount"      DECIMAL(15,2) NOT NULL,
  "date"        DATE        NOT NULL,
  "ncf"         VARCHAR(19),
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_anticipos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "project_anticipos"
  ADD CONSTRAINT "project_anticipos_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "project_anticipos_project_id_number_key"
  ON "project_anticipos"("project_id", "number");

CREATE INDEX "project_anticipos_project_id_idx"
  ON "project_anticipos"("project_id");
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd /home/user/servingmi-appCG
pnpm --filter backend db:generate
```

Expected: `✔ Generated Prisma Client` sin errores.

- [ ] **Step 5: Verify build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: exit 0, sin errores TypeScript.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(anticipos): add ProjectAnticipo model and ncf to ProjectCubicacion"
```

---

## Task 2: Backend Zod schemas

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.schema.ts`

### Context

El archivo actual tiene `createCubicacionSchema` en línea ~53. La función `validateNCF` está exportada de `../../utils/fiscal.utils` — úsala en lugar de importar las regexes privadas.

- [ ] **Step 1: Add ncf to cubicacion schemas**

Modificar `createCubicacionSchema` para agregar `ncf` opcional:

```typescript
import { validateNCF } from '../../utils/fiscal.utils';

// Reemplazar el createCubicacionSchema existente:
export const createCubicacionSchema = z.object({
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  progressPct: z.coerce.number().min(0).max(100, 'El porcentaje debe estar entre 0 y 100').default(0),
  description: z.string().min(3, 'La descripción es requerida').max(1000),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  ncf:         z.string().max(19).optional().nullable()
                 .refine(v => !v || validateNCF(v), 'NCF inválido'),
});

export const updateCubicacionSchema = createCubicacionSchema.partial();

export type CreateCubicacionInput = z.infer<typeof createCubicacionSchema>;
export type UpdateCubicacionInput = z.infer<typeof updateCubicacionSchema>;
```

- [ ] **Step 2: Add anticipo schemas**

Agregar al final del archivo, antes de los tipos de items:

```typescript
// ── Anticipos ─────────────────────────────────────────────────

export const createAnticipoSchema = z.object({
  amount:      z.coerce.number().positive('El monto debe ser mayor a 0'),
  date:        z.string().date('Formato inválido, use YYYY-MM-DD'),
  ncf:         z.string().max(19).optional().nullable()
                 .refine(v => !v || validateNCF(v), 'NCF inválido'),
  description: z.string().max(500).optional().nullable(),
});

export const updateAnticipoSchema = createAnticipoSchema.partial();

export type CreateAnticipoInput = z.infer<typeof createAnticipoSchema>;
export type UpdateAnticipoInput = z.infer<typeof updateAnticipoSchema>;
```

- [ ] **Step 3: Verify build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/projects/projects.schema.ts
git commit -m "feat(anticipos): add Zod schemas for anticipos and ncf on cubicaciones"
```

---

## Task 3: Backend service — anticipo CRUD + financial analysis update

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.service.ts`

### Context

- Imports en línea 1–15. Ya importa de `./projects.schema` y de `../../lib/prisma`.
- `AppError` está importado de `../../utils/errors`.
- Las funciones de cubicacion están en líneas ~275–340.
- `getFinancialAnalysis` está en líneas ~392–445.
- El patrón de auto-increment es: `findFirst({ orderBy: { number: 'desc' } })` → `(last?.number ?? 0) + 1`.

- [ ] **Step 1: Add anticipo type imports**

En la línea de imports de `./projects.schema`, agregar `CreateAnticipoInput, UpdateAnticipoInput`:

```typescript
import {
  CreateProjectInput, UpdateProjectInput, ProjectQuery,
  CreateAddendumInput,
  CreateCubicacionInput, UpdateCubicacionInput,
  CreateAnticipoInput, UpdateAnticipoInput,
  CreateProjectItemInput,
} from './projects.schema';
```

- [ ] **Step 2: Update updateCubicacion to handle ncf**

Modificar la función `updateCubicacion` para incluir `ncf` en el update:

```typescript
export async function updateCubicacion(projectId: string, cubicacionId: string, data: UpdateCubicacionInput) {
  const existing = await prisma.projectCubicacion.findFirst({
    where: { id: cubicacionId, projectId },
  });
  if (!existing) throw new AppError(404, 'Cubicación no encontrada', 'NOT_FOUND');

  const updated = await prisma.projectCubicacion.update({
    where: { id: cubicacionId },
    data: {
      ...(data.amount      !== undefined && { amount: data.amount }),
      ...(data.progressPct !== undefined && { progressPct: data.progressPct }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date        !== undefined && { date: new Date(data.date) }),
      ...(data.ncf         !== undefined && { ncf: data.ncf ?? null }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return { ...updated, amount: Number(updated.amount), progressPct: Number(updated.progressPct) };
}
```

- [ ] **Step 3: Add anticipo CRUD functions**

Agregar después de `deleteCubicacion`, antes del comentario de asignaciones:

```typescript
// ── Anticipos ─────────────────────────────────────────────────

export async function getAnticipos(projectId: string) {
  await getProjectById(projectId);
  const rows = await prisma.projectAnticipo.findMany({
    where:   { projectId },
    orderBy: { number: 'asc' },
  });
  return rows.map((a) => ({ ...a, amount: Number(a.amount) }));
}

export async function createAnticipo(projectId: string, data: CreateAnticipoInput) {
  await getProjectById(projectId);

  const last = await prisma.projectAnticipo.findFirst({
    where:   { projectId },
    orderBy: { number: 'desc' },
    select:  { number: true },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const row = await prisma.projectAnticipo.create({
    data: {
      projectId,
      number:      nextNumber,
      amount:      data.amount,
      date:        new Date(data.date),
      ncf:         data.ncf ?? null,
      description: data.description ?? null,
    },
  });
  return { ...row, amount: Number(row.amount) };
}

export async function updateAnticipo(projectId: string, anticipoId: string, data: UpdateAnticipoInput) {
  const existing = await prisma.projectAnticipo.findFirst({
    where: { id: anticipoId, projectId },
  });
  if (!existing) throw new AppError(404, 'Anticipo no encontrado', 'NOT_FOUND');

  const updated = await prisma.projectAnticipo.update({
    where: { id: anticipoId },
    data: {
      ...(data.amount      !== undefined && { amount: data.amount }),
      ...(data.date        !== undefined && { date: new Date(data.date) }),
      ...(data.ncf         !== undefined && { ncf: data.ncf ?? null }),
      ...(data.description !== undefined && { description: data.description ?? null }),
    },
  });
  return { ...updated, amount: Number(updated.amount) };
}

export async function deleteAnticipo(projectId: string, anticipoId: string) {
  const existing = await prisma.projectAnticipo.findFirst({
    where: { id: anticipoId, projectId },
  });
  if (!existing) throw new AppError(404, 'Anticipo no encontrado', 'NOT_FOUND');
  await prisma.projectAnticipo.delete({ where: { id: anticipoId } });
  return existing;
}
```

- [ ] **Step 4: Update getFinancialAnalysis to include anticipos**

Modificar la función `getFinancialAnalysis` (líneas ~392–445):

```typescript
export async function getFinancialAnalysis(projectId: string) {
  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      addendums:    { select: { amount: true } },
      cubicaciones: { orderBy: { number: 'asc' } },
      anticipos:    { orderBy: { number: 'asc' } },
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

  const totalGastado    = Number(expenseStats._sum.amount ?? 0);
  const totalCubicado   = project.cubicaciones.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalAnticipos  = project.anticipos.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const totalCobrado    = totalAnticipos + totalCubicado;
  const margen          = totalCubicado - totalGastado;
  const lastProgress    = project.cubicaciones.length > 0
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
      totalGastado,
      totalAnticipos,
      totalCobrado,
      margen,
      margenPct:       totalCubicado > 0 ? Math.round((margen / totalCubicado) * 10000) / 100 : 0,
      lastProgressPct: lastProgress,
      expenseCount:    expenseStats._count.id,
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
  };
}
```

- [ ] **Step 5: Verify build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/projects/projects.service.ts
git commit -m "feat(anticipos): add anticipo CRUD service functions and update financial analysis"
```

---

## Task 4: Backend controller + router

**Files:**
- Modify: `apps/backend/src/modules/projects/projects.controller.ts`
- Modify: `apps/backend/src/modules/projects/projects.router.ts`

### Context

- El controller sigue el patrón: `try { const data = await service.X(...); res.json({ success: true, data }); } catch (err) { next(err); }`
- El router usa `authorize('admin', 'supervisor')` para writes y permite GET a todos los autenticados (ver línea ~90 donde `/:id/cubicaciones` GET usa `authorize('admin', 'supervisor')`, pero para anticipos el GET es para todos autenticados según spec).
- Los schemas se importan en el router: `import { createCubicacionSchema, updateCubicacionSchema } from './projects.schema'`.

- [ ] **Step 1: Add anticipo controller functions**

Agregar después de `removeCubicacion` en `projects.controller.ts`:

```typescript
// ── Anticipos ─────────────────────────────────────────────────

export async function listAnticipos(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAnticipos(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createAnticipo(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateAnticipo(req.params.id, req.params.anticipoId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteAnticipo(req.params.id, req.params.anticipoId);
    res.json({ success: true, message: 'Anticipo eliminado' });
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Add anticipo routes in router**

En `projects.router.ts`, agregar el import de los schemas nuevos:
```typescript
import {
  createProjectSchema, updateProjectSchema, projectQuerySchema,
  createAddendumSchema, updateAddendumSchema,
  createCubicacionSchema, updateCubicacionSchema,
  createAnticipoSchema, updateAnticipoSchema,
  createProjectItemSchema, updateProjectItemSchema,
} from './projects.schema';
```

Agregar los imports del controller (si no están ya todos en un `import * as ctrl`):
```typescript
import * as ctrl from './projects.controller';
```

Agregar las rutas después del bloque de cubicaciones:

```typescript
// GET    /api/v1/projects/:id/anticipos — todos los autenticados
router.get('/:id/anticipos',
  authenticate,
  ctrl.listAnticipos,
);

// POST   /api/v1/projects/:id/anticipos
router.post('/:id/anticipos',
  authorize('admin', 'supervisor'),
  validate(createAnticipoSchema),
  ctrl.createAnticipo,
);

// PATCH  /api/v1/projects/:id/anticipos/:anticipoId
router.patch('/:id/anticipos/:anticipoId',
  authorize('admin', 'supervisor'),
  validate(updateAnticipoSchema),
  ctrl.updateAnticipo,
);

// DELETE /api/v1/projects/:id/anticipos/:anticipoId
router.delete('/:id/anticipos/:anticipoId',
  authorize('admin', 'supervisor'),
  ctrl.removeAnticipo,
);
```

**Nota:** Verificar que `authenticate` esté importado en el router. Si el router ya aplica `authenticate` globalmente (via `router.use(authenticate)`), no es necesario repetirlo en las rutas GET.

- [ ] **Step 3: Verify build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/projects/projects.controller.ts \
        apps/backend/src/modules/projects/projects.router.ts
git commit -m "feat(anticipos): add anticipo controller and router endpoints"
```

---

## Task 5: Frontend types + API

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Modify: `apps/frontend/src/api/index.ts`

### Context

- `Cubicacion` interface está en línea ~153, `FinancialAnalysis` en línea ~164.
- Los API calls de proyectos están bajo `export const projectsApi = {` — agregar anticipo calls junto a los de cubicaciones.

- [ ] **Step 1: Update types**

En `apps/frontend/src/types/index.ts`:

Actualizar `Cubicacion` para incluir `ncf`:
```typescript
export interface Cubicacion {
  id: string;
  number: number;
  amount: number;
  progressPct: number;
  description: string;
  date: string;
  ncf?: string | null;
  createdBy?: { id: string; name: string };
  createdAt?: string;
}
```

Agregar interfaz `Anticipo` después de `Cubicacion`:
```typescript
export interface Anticipo {
  id: string;
  number: number;
  amount: number;
  date: string;
  ncf?: string | null;
  description?: string | null;
  createdAt?: string;
}
```

Actualizar `FinancialAnalysis`:
```typescript
export interface FinancialAnalysis {
  project: {
    id: string; code: string; name: string;
    estimatedBudget: number; addendumTotal: number; totalBudget: number;
  };
  financials: {
    totalCubicado: number;
    totalGastado: number;
    totalAnticipos: number;
    totalCobrado: number;
    margen: number;
    margenPct: number;
    lastProgressPct: number;
    expenseCount: number;
  };
  cubicaciones: Cubicacion[];
  anticipos: Anticipo[];
}
```

- [ ] **Step 2: Add anticipo API calls**

En `apps/frontend/src/api/index.ts`, dentro de `projectsApi`, agregar después de `deleteCubicacion`:

```typescript
// Anticipos
getAnticipos:      (projectId: string) =>
  api.get<{ success: boolean; data: Anticipo[] }>(`/projects/${projectId}/anticipos`),
createAnticipo:    (projectId: string, data: unknown) =>
  api.post<{ success: boolean; data: Anticipo }>(`/projects/${projectId}/anticipos`, data),
updateAnticipo:    (projectId: string, anticipoId: string, data: unknown) =>
  api.patch<{ success: boolean; data: Anticipo }>(`/projects/${projectId}/anticipos/${anticipoId}`, data),
deleteAnticipo:    (projectId: string, anticipoId: string) =>
  api.delete(`/projects/${projectId}/anticipos/${anticipoId}`),
```

Agregar el import de `Anticipo` al import de types (si hay uno en `api/index.ts`). Si los tipos se importan allí, agregar `Anticipo` a la lista. Si no hay import de types en ese archivo, el type check se hará via el generic de axios.

- [ ] **Step 3: Verify build (frontend)**

```bash
pnpm build:frontend 2>&1 | tail -10
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/types/index.ts apps/frontend/src/api/index.ts
git commit -m "feat(anticipos): add Anticipo type and API calls, update FinancialAnalysis type"
```

---

## Task 6: Frontend UI — ProjectFinancialPage

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectFinancialPage.tsx`

### Context

Este es el archivo más grande del cambio. Tiene ~960 líneas. Las secciones relevantes:
- **Líneas 1–50:** Imports
- **Líneas 150–310:** Setup, estado, queries, mutations de cubicaciones
- **Líneas 308–429:** Cards del resumen financiero (4 cards actuales)
- **Líneas 618–881:** Sección de cubicaciones (formulario + tabla)
- El diseño sigue el sistema industrial: `bg-[#1C1C1C]` headers, `font-['Barlow_Condensed']` headings, `font-['Space_Mono']` números, `bg-[#F5C218]` accents.
- Las mutations de cubicacion usan `queryClient.invalidateQueries({ queryKey: ['financial', projectId] })`.
- La data viene de: `const { data: financial } = useQuery({ queryKey: ['financial', projectId], queryFn: ... })`.

**Read the file before editing** — es muy largo y el contexto exacto de cada sección es crítico para no romper el layout existente.

- [ ] **Step 1: Add state and mutations for anticipos**

En la sección de state/queries (~línea 150–310), agregar después de las mutations de cubicaciones:

```typescript
// ── Anticipos state ───────────────────────────────────────────
const [anticipoForm, setAnticipoForm] = useState({
  amount: '', date: '', ncf: '', description: '',
});
const [editingAnticipoId, setEditingAnticipoId] = useState<string | null>(null);
const [showAnticipoForm, setShowAnticipoForm] = useState(false);

const createAnticipoMutation = useMutation({
  mutationFn: (data: unknown) => projectsApi.createAnticipo(projectId!, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', projectId] });
    setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
    setShowAnticipoForm(false);
  },
});

const updateAnticipoMutation = useMutation({
  mutationFn: ({ id, data }: { id: string; data: unknown }) =>
    projectsApi.updateAnticipo(projectId!, id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['financial', projectId] });
    setEditingAnticipoId(null);
    setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
  },
});

const deleteAnticipoMutation = useMutation({
  mutationFn: (id: string) => projectsApi.deleteAnticipo(projectId!, id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial', projectId] }),
});

const handleSaveAnticipo = () => {
  const payload = {
    amount:      parseFloat(anticipoForm.amount),
    date:        anticipoForm.date,
    ncf:         anticipoForm.ncf.trim() || null,
    description: anticipoForm.description.trim() || null,
  };
  if (editingAnticipoId) {
    updateAnticipoMutation.mutate({ id: editingAnticipoId, data: payload });
  } else {
    createAnticipoMutation.mutate(payload);
  }
};

const handleEditAnticipo = (anticipo: Anticipo) => {
  setEditingAnticipoId(anticipo.id);
  setAnticipoForm({
    amount:      String(anticipo.amount),
    date:        anticipo.date ? anticipo.date.split('T')[0] : '',
    ncf:         anticipo.ncf ?? '',
    description: anticipo.description ?? '',
  });
  setShowAnticipoForm(true);
};
```

Agregar el import de `Anticipo` si no está ya importado desde `../../types`.

- [ ] **Step 2: Add "Total cobrado" card to the summary cards section**

Localizar el grid de 4 cards (~líneas 308–429). Agregar una quinta card "Total cobrado" al final del grid:

```tsx
{/* Total Cobrado */}
<div className="bg-white border border-gray-200 p-6">
  <div className="flex items-center gap-2 mb-1">
    <span className="font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
      Total cobrado
    </span>
  </div>
  <div className="font-['Space_Mono'] text-2xl font-bold text-[#1C1C1C]">
    {formatCurrency(financial.financials.totalCobrado)}
  </div>
  <div className="mt-2 text-xs text-gray-500 font-['DM_Sans']">
    Anticipos ({formatCurrency(financial.financials.totalAnticipos)})
    {' + '}
    Cubicaciones ({formatCurrency(financial.financials.totalCubicado)})
  </div>
</div>
```

Ajustar el `grid-cols` del contenedor de cards si es necesario (de `grid-cols-4` a `grid-cols-5`, o mantener en 2 filas con `grid-cols-3` si la pantalla lo requiere — ver el grid actual antes de editar).

- [ ] **Step 3: Add anticipos section before cubicaciones section**

Localizar el inicio de la sección de cubicaciones (~línea 618). Insertar la sección de anticipos ANTES de ella:

```tsx
{/* ── Anticipos recibidos ─────────────────────────────── */}
<div className="bg-white border border-gray-200">
  {/* Header */}
  <div className="bg-[#1C1C1C] px-6 py-4 flex items-center justify-between">
    <h2 className="font-['Barlow_Condensed'] text-lg font-bold text-white uppercase tracking-wide">
      Anticipos recibidos
    </h2>
    {canEdit && (
      <button
        onClick={() => {
          setEditingAnticipoId(null);
          setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
          setShowAnticipoForm(v => !v);
        }}
        className="bg-[#F5C218] text-[#1C1C1C] px-3 py-1.5 text-xs font-['Barlow_Condensed'] font-bold uppercase tracking-wide hover:bg-yellow-400 transition-colors"
      >
        + Agregar anticipo
      </button>
    )}
  </div>

  {/* Form */}
  {showAnticipoForm && canEdit && (
    <div className="border-b border-gray-200 p-6 bg-gray-50">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
            Monto *
          </label>
          <input
            type="number"
            value={anticipoForm.amount}
            onChange={e => setAnticipoForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
            Fecha *
          </label>
          <input
            type="date"
            value={anticipoForm.date}
            onChange={e => setAnticipoForm(f => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
          />
        </div>
        <div>
          <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
            NCF
          </label>
          <input
            type="text"
            value={anticipoForm.ncf}
            onChange={e => setAnticipoForm(f => ({ ...f, ncf: e.target.value }))}
            className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
            placeholder="B0100000001 o E310000000001"
            maxLength={19}
          />
        </div>
        <div>
          <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
            Descripción
          </label>
          <input
            type="text"
            value={anticipoForm.description}
            onChange={e => setAnticipoForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
            placeholder="Anticipo contractual 20% según contrato"
            maxLength={500}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setShowAnticipoForm(false); setEditingAnticipoId(null); }}
          className="px-4 py-2 text-sm border border-gray-200 text-gray-600 font-['DM_Sans'] hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSaveAnticipo}
          disabled={!anticipoForm.amount || !anticipoForm.date || createAnticipoMutation.isPending || updateAnticipoMutation.isPending}
          className="px-4 py-2 text-sm bg-[#F5C218] text-[#1C1C1C] font-['Barlow_Condensed'] font-bold uppercase tracking-wide hover:bg-yellow-400 disabled:opacity-50 transition-colors"
        >
          {editingAnticipoId ? 'Guardar cambios' : 'Registrar anticipo'}
        </button>
      </div>
    </div>
  )}

  {/* Table */}
  {financial.anticipos.length === 0 ? (
    <div className="p-8 text-center text-gray-400 font-['DM_Sans'] text-sm">
      No hay anticipos registrados
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#1C1C1C]">
            <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">N°</th>
            <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Fecha</th>
            <th className="px-4 py-3 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Monto</th>
            <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">NCF</th>
            <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Descripción</th>
            {canEdit && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody>
          {financial.anticipos.map((anticipo, idx) => (
            <tr key={anticipo.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3 font-['Space_Mono'] text-sm text-gray-500">#{anticipo.number}</td>
              <td className="px-4 py-3 font-['DM_Sans'] text-sm text-gray-700">
                {new Date(anticipo.date).toLocaleDateString('es-DO')}
              </td>
              <td className="px-4 py-3 font-['Space_Mono'] text-sm font-bold text-[#1C1C1C] text-right">
                {formatCurrency(anticipo.amount)}
              </td>
              <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">
                {anticipo.ncf ?? '—'}
              </td>
              <td className="px-4 py-3 font-['DM_Sans'] text-sm text-gray-600">
                {anticipo.description ?? '—'}
              </td>
              {canEdit && (
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleEditAnticipo(anticipo)}
                      className="text-gray-400 hover:text-[#F5C218] transition-colors text-xs"
                      title="Editar"
                    >✏️</button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar este anticipo?')) deleteAnticipoMutation.mutate(anticipo.id); }}
                      className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                      title="Eliminar"
                    >🗑️</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200">
            <td colSpan={2} className="px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500">Total anticipos</td>
            <td className="px-4 py-3 font-['Space_Mono'] text-sm font-bold text-[#1C1C1C] text-right">
              {formatCurrency(financial.financials.totalAnticipos)}
            </td>
            <td colSpan={canEdit ? 3 : 2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )}
</div>
```

- [ ] **Step 4: Add NCF field to cubicaciones form**

En el formulario de crear/editar cubicación (~líneas 618–760), agregar el campo NCF después del campo `date`:

```tsx
<div>
  <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
    NCF
  </label>
  <input
    type="text"
    value={cubicacionForm.ncf ?? ''}
    onChange={e => setCubicacionForm(f => ({ ...f, ncf: e.target.value }))}
    className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
    placeholder="B0100000001 o E310000000001"
    maxLength={19}
  />
</div>
```

También agregar `ncf: string` al estado del form de cubicaciones (buscar donde se define `setCubicacionForm` con `amount`, `progressPct`, `description`, `date` y agregar `ncf: ''`).

En `handleSaveCubicacion`, incluir `ncf: cubicacionForm.ncf.trim() || null`.

En la tabla de cubicaciones, agregar columna NCF después de Fecha:
```tsx
<th className="...">NCF</th>
// ...
<td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">
  {cubicacion.ncf ?? '—'}
</td>
```

- [ ] **Step 5: Verify build (frontend)**

```bash
pnpm build:frontend 2>&1 | tail -10
```

Expected: exit 0, sin errores TypeScript.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/projects/ProjectFinancialPage.tsx
git commit -m "feat(anticipos): add anticipos section and NCF to financial analysis UI"
```

---

## Task 7: Push final

- [ ] **Step 1: Final backend build check**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 2: Final frontend build check**

```bash
pnpm build:frontend 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 3: Push**

```bash
git push origin claude/happy-feynman-stMWv
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: modelo `ProjectAnticipo` + `ncf` en `ProjectCubicacion` + migration
- ✅ Task 2: schemas Zod con `validateNCF`
- ✅ Task 3: CRUD service + `getFinancialAnalysis` con `totalAnticipos` + `totalCobrado`
- ✅ Task 4: 4 endpoints bajo `/projects/:id/anticipos` + permisos correctos
- ✅ Task 5: tipos `Anticipo`, `Cubicacion` actualizado, `FinancialAnalysis` actualizado
- ✅ Task 6: tarjeta "Total cobrado", sección anticipos ANTES de cubicaciones, NCF en cubicaciones
- ✅ `canEdit` — verificar que la página ya tenga esta variable (admins/supervisors); si no, usar `useRole()` hook

**Placeholder scan:** Ninguno encontrado.

**Type consistency:**
- `Anticipo` definido en Task 5, usado en Task 6 ✅
- `financial.anticipos` retornado por backend en Task 3, consumido en frontend Task 6 ✅
- `totalAnticipos`, `totalCobrado` definidos en Task 3, tipados en Task 5, usados en Task 6 ✅
