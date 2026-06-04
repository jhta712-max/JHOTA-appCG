# servingmi-appCG — Instrucciones para Claude

## Regla de deploy en Render

**Siempre hacer push a `main` después de cada cambio.**

Render auto-deploya desde `main`. El flujo es:
1. Desarrollar en la rama de feature asignada.
2. Merge a `main`.
3. `git push origin main` → Render lanza el redeploy automático.

---

## Stack tecnológico

- **Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + TanStack Query + Zustand
- **Monorepo**: pnpm workspaces (`apps/backend`, `apps/frontend`)
- **Deploy**: Render.com (auto-deploy desde `main`)
- **Rama de trabajo activa**: `claude/skills-directory-setup-tiPbm`

---

## Directorios clave — SIEMPRE informar al usuario cuál usar

| Tarea                                   | Directorio                                       |
|-----------------------------------------|--------------------------------------------------|
| Git, deploy, pnpm install               | `/home/user/servingmi-appCG`                     |
| Backend, Prisma, migraciones, seed      | `/home/user/servingmi-appCG/apps/backend`        |
| Frontend, TypeScript, vite              | `/home/user/servingmi-appCG/apps/frontend`       |
| Schema de BD                            | `/home/user/servingmi-appCG/apps/backend/prisma` |

**Regla**: Antes de dar cualquier comando al usuario, indicar el directorio exacto donde ejecutarlo.

---

## Arquitectura de la app

### Backend (`apps/backend/src/modules/`)
Cada módulo sigue el patrón: `controller → service → router → schema`

| Módulo           | Descripción                              |
|-----------------|------------------------------------------|
| auth             | JWT, login, password reset               |
| users            | CRUD usuarios, invitaciones              |
| projects         | Proyectos, summary financiero            |
| expenses         | Gastos, bulk import CSV, OCR             |
| categories       | Categorías de gastos                     |
| quotations       | Cotizaciones con pagos y adjuntos        |
| payment-orders   | Órdenes de pago, markAsPaid, link payroll|
| payroll          | Nóminas, líneas, importFromOrders        |
| office-expenses  | Gastos de oficina                        |
| beneficiaries    | Beneficiarios de órdenes de pago         |
| cards            | Tarjetas corporativas                    |
| reports          | Reportes y exportaciones                 |
| monitoring       | Health check, logs de sistema            |
| ocr              | Análisis de recibos con IA               |
| backup           | Export masivo de datos                   |

### Frontend (`apps/frontend/src/`)

```
pages/          ← Una carpeta por módulo, mismo nombre que las rutas
components/     ← Layout.tsx (nav, header) + componentes reutilizables
hooks/useRole.ts← RBAC centralizado — SIEMPRE usar este hook
stores/authStore.ts ← Zustand: user, tokens, viewAsRole
api/index.ts    ← Todos los endpoints del frontend
types/          ← Interfaces TypeScript compartidas
utils/date.ts   ← Formateo de fechas
```

---

## RBAC — Sistema de roles

### Hook centralizado: `useRole()`
**SIEMPRE usar `useRole()` en lugar de `useAuthStore` para permisos.**

```typescript
const { canCreateExpense, isSupervisor, isAdmin, isPreviewingRole } = useRole();
```

Cuando `admin` tiene `viewAsRole` activo, `useRole()` devuelve los permisos del rol seleccionado.
`realRole` siempre devuelve el rol real (admin).

### Roles y accesos

| Role        | Acceso                                                             |
|------------|---------------------------------------------------------------------|
| admin       | Todo + cambiar vista de rol (viewAsRole)                           |
| supervisor  | Proyectos, gastos, cotizaciones, nóminas, órdenes, reportes        |
| operator    | Ver proyectos/gastos/cotizaciones, crear gastos/cotizaciones/nóminas |
| auxiliar    | Ver + marcar órdenes pendientes, crear/editar nóminas              |
| financiero  | Solo lectura: proyectos, gastos, cotizaciones, reportes, exportar  |

### Nav items filtrados por rol (Layout.tsx)
La navegación usa `roles?: string[]` en cada item. `visibleItems` se filtra por `effectiveRole`.

---

## Flujos de negocio críticos

### Flujo Orden de Pago → Nómina (CORRECTO)
1. Crear Orden de Pago (tipo PAYROLL)
2. Crear Nómina (DRAFT)
3. Desde la nómina: **Vincular Orden de Pago** → `paymentOrdersApi.linkPayroll(orderId, payrollId)`
4. Desde la nómina: **Importar líneas** → `payrollApi.importFromOrders(payrollId)`
5. Aprobar nómina
6. Exportar (Excel/Word)

### Auto-creación de gastos al pagar órdenes
- Orden tipo `MATERIALS` → gasto con categoría `"Materiales"`
- Orden tipo `SERVICIO` → gasto con categoría `"Servicios"`
- Orden tipo `PAYROLL` → NO crea gasto individual (lo crea la nómina)

### Exportaciones de nómina
- Excel: `GET /payrolls/:id/export?format=xlsx`
- Word: `GET /payrolls/:id/export?format=docx`

---

## Patrones de código que seguir

### Manejo de errores en mutaciones
```typescript
useMutation({
  mutationFn: ...,
  onSuccess: ...,
  onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error genérico'),
})
```

### Paginación
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['key', ...filters, page],
  queryFn: () => api.list({ ...filters, page, limit: 20 }),
  select: (r) => r.data,
});
const items = data?.data ?? [];
const pagination = data?.pagination;
```

### Invalidar queries después de mutación
```typescript
const invalidate = () => {
  qc.invalidateQueries({ queryKey: ['payroll', id] });
  qc.invalidateQueries({ queryKey: ['payrolls'] });
};
```

---

## Base de datos — Schema clave

### Modelos principales
- `User` → roles: admin, supervisor, operator, auxiliar, financiero
- `Project` → status: ACTIVE, PAUSED, COMPLETED, CANCELLED
- `Expense` → status: ACTIVE, VOIDED | categoryId → ExpenseCategory
- `Payroll` → status: DRAFT, APPROVED, PAID, VOIDED | paymentOrder: PaymentOrder? (one-to-one)
- `PaymentOrder` → orderType: SERVICIO, MATERIALS, PAYROLL | status: PENDING, PAID, VOIDED
- `Quotation` → 8 estados posibles

### Relaciones importantes
- `PaymentOrder.payrollId` → FK a `Payroll` (un PaymentOrder tiene un Payroll)
- `PaymentOrder.expenseId` → FK a `Expense` (auto-creado al markAsPaid)
- `Payroll.paymentOrder` → relación inversa (uno a uno, campo singular)

**IMPORTANTE**: En `PAYROLL_INCLUDE` usar `paymentOrder` (singular), NO `paymentOrders`.

---

## Archivos de configuración y su ubicación

| Archivo                                    | Para qué                              |
|--------------------------------------------|---------------------------------------|
| `apps/backend/prisma/schema.prisma`        | Estructura completa de la BD          |
| `apps/backend/prisma/seed.ts`              | Roles y categorías iniciales          |
| `apps/backend/src/config/env.ts`           | Variables de entorno                  |
| `apps/frontend/src/api/index.ts`           | Todos los endpoints del frontend      |
| `apps/frontend/src/hooks/useRole.ts`       | RBAC — permisos por rol               |
| `apps/frontend/src/stores/authStore.ts`    | Estado de auth + viewAsRole           |
| `apps/frontend/src/components/layout/Layout.tsx` | Nav, header, RoleViewSwitcher  |
| `render.yaml`                              | Configuración de Render               |
| `docker-compose.yml`                       | BD local para desarrollo              |

---

## Documentación del proyecto

Ver `/docs/` para guías en español:
- `docs/PROYECTO.md` — Qué es el sistema, estructura, URLs
- `docs/COMANDOS.md` — Comandos con directorios (para no programadores)
- `docs/ROLES.md` — Tabla de permisos por rol
- `docs/FLUJOS.md` — Flujos de negocio paso a paso

Archivos organizados:
- `scripts/sql/` — Scripts SQL de mantenimiento
- `data/gastos/` — Archivos CSV con datos históricos
- `templates/` — Plantillas HTML (orden de pago)

---

## Categorías de gastos del seed (nombres exactos)

```
Materiales, Servicios, Mano de obra, Equipos, Transporte,
Combustible, Dietas, Otros
```

**CRÍTICO**: Al auto-crear gastos desde código, usar estos nombres exactos con el mismo casing.
El `upsert` de categorías es case-sensitive en PostgreSQL.
