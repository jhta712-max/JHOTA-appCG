# Gastos Extraordinarios en Análisis Financiero — Diseño

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir registrar gastos extraordinarios (comisiones, préstamos, impuestos, multas, etc.) por proyecto que no son gastos directos del proyecto pero afectan el margen financiero, mostrando margen bruto y margen neto separados en el análisis financiero.

**Architecture:** Nueva tabla `ProjectExtraordinaryExpense` con CRUD propio. El endpoint `GET /projects/:id/financial` incluye los extraordinarios y calcula `margenNeto = margen - totalExtraordinario`. El frontend añade una sección en el tab Análisis Financiero de `ProjectDetailPage` con tabla y modal de gestión.

**Tech Stack:** Prisma + PostgreSQL (migración nueva), Express router/controller/service (patrón existente), React 18 + TanStack Query, FormModal del design system.

---

## Modelo de datos

```prisma
enum ExtraordinaryExpenseCategory {
  COMISION
  PRESTAMO
  IMPUESTO
  MULTA
  OTRO
}

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
}
```

`Project` model añade: `extraordinaryExpenses ProjectExtraordinaryExpense[]`

Migración: `20260616000003_add_extraordinary_expenses`

---

## Backend

### Rutas (`projects.router.ts`)
```
GET    /api/v1/projects/:id/extraordinary-expenses          — authenticate (todos)
POST   /api/v1/projects/:id/extraordinary-expenses          — authorize('admin')
PUT    /api/v1/projects/:id/extraordinary-expenses/:expId   — authorize('admin')
DELETE /api/v1/projects/:id/extraordinary-expenses/:expId   — authorize('admin')
```

### Service (`projects.service.ts`) — funciones nuevas
- `listExtraordinaryExpenses(projectId)` → array ordenado por date desc
- `createExtraordinaryExpense(projectId, data, userId)`
- `updateExtraordinaryExpense(projectId, expId, data)`
- `deleteExtraordinaryExpense(projectId, expId)`

### Enriquecimiento de `getFinancialAnalysis(projectId)`
Añade al resultado:
```ts
financials: {
  // ...existentes (totalCubicado, totalAnticipos, totalCobrado, totalGastado, margen, margenPct, lastProgressPct, expenseCount)
  totalExtraordinario: number,  // suma de extraordinary expenses
  margenNeto: number,           // margen - totalExtraordinario
  margenNetoPct: number,        // margenNeto / totalCubicado * 100 (0 si totalCubicado=0)
},
extraordinaryExpenses: [
  { id, description, amount, date, category, notes, createdAt }
]
```

### Schema de validación (`projects.schema.ts`)
```ts
export const createExtraordinaryExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount:      z.number().positive(),
  date:        z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  category:    z.enum(['COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO']),
  notes:       z.string().max(500).optional(),
});
export const updateExtraordinaryExpenseSchema = createExtraordinaryExpenseSchema.partial();
```

---

## Frontend

### API (`api/index.ts`)
```ts
interface ExtraordinaryExpense {
  id: string; projectId: string; description: string;
  amount: number; date: string;
  category: 'COMISION' | 'PRESTAMO' | 'IMPUESTO' | 'MULTA' | 'OTRO';
  notes?: string; createdAt: string;
}
// projectsApi añade:
extraordinaryExpenses: {
  list:   (projectId) => api.get(...)
  create: (projectId, data) => api.post(...)
  update: (projectId, expId, data) => api.put(...)
  remove: (projectId, expId) => api.delete(...)
}
```

`FinancialAnalysis` type añade:
```ts
financials: { ...existente, totalExtraordinario: number, margenNeto: number, margenNetoPct: number }
extraordinaryExpenses: ExtraordinaryExpense[]
```

### `ProjectDetailPage.tsx` — tab Análisis Financiero

**Tarjetas de resumen** — 2 nuevas junto al margen:
- "GASTOS EXTRD." — `font-['Space_Mono']`, monto en rojo con signo `-`
- "MARGEN NETO" — verde si positivo, rojo si negativo, con `margenNetoPct`

**Sección tabla** `GASTOS EXTRAORDINARIOS` — estilo idéntico a la sección Anticipos:
- Header `bg-[#1C1C1C]` con botón `+` visible solo para admin
- Columnas: Descripción, Categoría, Fecha, Monto, Notas, Acciones
- Categoría con badge de color: COMISION (azul), PRESTAMO (naranja), IMPUESTO (rojo), MULTA (amarillo), OTRO (gris)
- Acciones: editar (lápiz) y eliminar (trash) solo para admin

**Modal** — `<FormModal>` estándar:
- Campos: descripción (text), categoría (select), fecha (date), monto (number), notas (textarea, opcional)
- Mismo patrón que el modal de anticipos

### Etiquetas de categoría
```ts
const CATEGORY_LABELS = {
  COMISION: 'Comisión',
  PRESTAMO: 'Préstamo',
  IMPUESTO: 'Impuesto',
  MULTA:    'Multa',
  OTRO:     'Otro',
};
```

---

## Backup
`backup.router.ts` — añadir `prisma.projectExtraordinaryExpense.findMany()` al array de tablas.
