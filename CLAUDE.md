# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# servingmi-appCG — Instrucciones para Claude

## 🚀 Regla de deploy en Render

**Siempre hacer push a `main` después de cada cambio.**

Render auto-deploya desde `main`. El flujo es:
1. Desarrollar en la rama de feature asignada.
2. Merge a `main`.
3. `git push origin main` → Render lanza el redeploy automático.

**IMPORTANTE**: Backend y Frontend están en la **MISMA rama** (`main`). No hay ramas separadas.

---

## 📋 Comandos comunes

Ejecutar **siempre desde `/home/user/servingmi-appCG`** (raíz del monorepo).

### Desarrollo local
```bash
pnpm install                    # Instalar todas las dependencias del workspace
pnpm dev                        # Correr backend + frontend simultáneamente
pnpm dev:backend               # Solo backend (http://localhost:3001)
pnpm dev:frontend              # Solo frontend (http://localhost:5173)
```

### Base de datos
```bash
docker-compose up -d postgres  # Levantar PostgreSQL local
docker-compose down            # Bajar PostgreSQL
pnpm db:migrate                # Ejecutar migraciones (dev)
pnpm db:seed                   # Seed de roles y categorías
pnpm db:studio                 # Abrir Prisma Studio
```

### Build & Deploy
```bash
pnpm build:backend             # Compilar backend TypeScript
pnpm build:frontend            # Compilar frontend Vite
docker build -f Dockerfile.backend .   # Testear Docker build local
docker build -f Dockerfile.frontend .  # Testear Docker build local
```

### Verificaciones pre-commit
```bash
pnpm --filter backend db:generate      # Regenerar Prisma client
git status                             # Verificar archivos sin stage
git diff main                          # Revisar cambios vs main
```

---

## 🏗️ Stack tecnológico

- **Backend**: Node.js 24 + Express + TypeScript + Prisma ORM + PostgreSQL 16
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + TanStack Query + Zustand
- **Monorepo**: pnpm workspaces v9+ (`apps/backend`, `apps/frontend`)
- **Deploy**: Render.com (Docker, auto-deploy desde `main`)
- **Node version**: >=20.0.0 (Render usa 24)

---

## 📁 Directorios clave — SIEMPRE informar al usuario cuál usar

| Tarea                                   | Directorio                                       |
|-----------------------------------------|--------------------------------------------------|
| Git, deploy, pnpm install               | `/home/user/servingmi-appCG` (raíz)               |
| Backend, Prisma, migraciones            | `/home/user/servingmi-appCG/apps/backend`        |
| Frontend, Vite, React                   | `/home/user/servingmi-appCG/apps/frontend`       |
| Prisma schema & migraciones             | `/home/user/servingmi-appCG/apps/backend/prisma` |
| Docker configuration                    | `/home/user/servingmi-appCG` (Dockerfile.*)      |
| Render configuration                    | `/home/user/servingmi-appCG/render.yaml`         |

**REGLA**: Antes de dar cualquier comando al usuario, indicar el directorio exacto.

---

## 🏛️ Arquitectura de la app

### Backend (`apps/backend/src/modules/`)
Cada módulo sigue: `controller → service → router → schema (Zod)`

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
utils/          ← Helpers (date, formatting)
```

---

## 🔐 RBAC — Sistema de roles

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

---

## 💼 Flujos de negocio críticos

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

## 📊 Base de datos — Schema clave

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

## 🐳 Docker & Render — CRÍTICO para Deploy

### Estructura de Dockerfiles
- **Dockerfile** (copia del backend, se usa por defecto)
- **Dockerfile.backend** (Node.js 24 Alpine + Prisma)
- **Dockerfile.frontend** (Nginx Alpine)

### Reglas cruciales para NO repetir problemas:

1. **SIEMPRE copiar TODO el workspace**
   ```dockerfile
   COPY apps ./apps          # ✅ CORRECTO
   COPY apps/backend ./apps/backend    # ❌ INCORRECTO (quebra pnpm workspace)
   ```

2. **Ejecutar Prisma generate en Docker**
   ```dockerfile
   RUN pnpm run db:generate   # Regenerar con binary targets correctos
   RUN pnpm run build
   ```

3. **Prisma binary targets para Alpine OpenSSL 3.0**
   - Schema debe incluir: `"linux-musl-openssl-3.0.x"`
   - Ver: `apps/backend/prisma/schema.prisma`
   - Si lo cambias: ejecutar `pnpm run db:generate` ANTES de push

4. **Invalidación de cache Docker**
   - Dockerfiles tienen `ARG CACHE_BUST=default`
   - Si Render no actualiza a nuevo commit: revisar git status de Render

### Render.yaml — Configuración crítica
```yaml
preDeployCommand: cd apps/backend && pnpm run db:migrate:prod   # Backend
preDeployCommand: null                                           # Frontend
```

**Variables de entorno requeridas en Render:**
- NODE_ENV: production
- DATABASE_URL: (linked from PostgreSQL service)
- JWT_SECRET: (manual entry, >32 chars)
- JWT_REFRESH_SECRET: (manual entry, >32 chars)
- FRONTEND_URL: https://servingmi-frontend.onrender.com

---

## 🔧 Patrones de código

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

## ⚠️ Troubleshooting — Problemas comunes y soluciones

### "Cannot find module 'zod'" en Render
**Causa**: pnpm workspace incompleto durante install
- ✅ Solución: Asegurar `COPY apps ./apps` (TODO el workspace)
- ✅ Verificar: pnpm-lock.yaml referencia todas las apps

### "libquery_engine-linux-musl.so.node not found"
**Causa**: Prisma binary target incorrecto para Alpine OpenSSL 3.0
- ✅ Solución: Agregar `"linux-musl-openssl-3.0.x"` a binaryTargets en schema.prisma
- ✅ Verificar: `pnpm run db:generate` ejecutado en Docker before build

### Docker build no actualiza a nuevo commit
**Causa**: Docker cache layer stacking
- ✅ Solución: `ARG CACHE_BUST` en Dockerfile invalida cache
- ✅ Si aún falla: Render dashboard → rebuild (no re-deploy)

### Migraciones no ejecutadas en Render
**Causa**: preDeployCommand no configurado
- ✅ Verificar: render.yaml tiene `preDeployCommand: cd apps/backend && pnpm run db:migrate:prod`
- ✅ Verificar: Comando ejecuta ANTES de container start

---

## 📝 Categorías de gastos del seed (nombres exactos)

```
Materiales, Servicios, Mano de obra, Equipos, Transporte,
Combustible, Dietas, Otros
```

**CRÍTICO**: Al auto-crear gastos desde código, usar estos nombres exactos con el mismo casing.
El `upsert` de categorías es case-sensitive en PostgreSQL.

---

## 📚 Documentación del proyecto

Ver `/docs/` para guías en español:
- `docs/PROYECTO.md` — Qué es el sistema, estructura, URLs
- `docs/COMANDOS.md` — Comandos con directorios
- `docs/ROLES.md` — Tabla de permisos por rol
- `docs/FLUJOS.md` — Flujos de negocio paso a paso

Archivos organizados:
- `scripts/sql/` — Scripts SQL de mantenimiento
- `data/gastos/` — Archivos CSV con datos históricos
- `templates/` — Plantillas HTML

---

## 🔗 Archivos de configuración clave

| Archivo                                    | Descripción                           |
|--------------------------------------------|---------------------------------------|
| `apps/backend/prisma/schema.prisma`        | BD schema + binary targets            |
| `apps/backend/src/config/env.ts`           | Validación de env variables (Zod)     |
| `apps/frontend/src/api/index.ts`           | Todos los endpoints                   |
| `apps/frontend/src/hooks/useRole.ts`       | RBAC centralizad                      |
| `apps/frontend/src/stores/authStore.ts`    | Auth state + viewAsRole               |
| `render.yaml`                              | Render deployment config              |
| `Dockerfile`, `Dockerfile.backend`, `Dockerfile.frontend` | Docker multi-stage builds |
| `.dockerignore`                            | Archivos excluidos de Docker context  |
| `docker-compose.yml`                       | BD local para desarrollo              |
| `pnpm-workspace.yaml`                      | Configuración del workspace           |

---

## ✅ Checklist antes de cada push a main

- [ ] `pnpm install` — Dependencias actualizadas
- [ ] Backend: `pnpm run db:generate` si cambió schema.prisma
- [ ] Frontend: `pnpm build:frontend` compila sin errores
- [ ] Backend: `pnpm build:backend` compila sin errores
- [ ] `git status` — No hay archivos uncommitted
- [ ] `git diff main` — Revisar todos los cambios
- [ ] Si cambió Dockerfile: verificar `COPY apps ./apps`
- [ ] Si cambió schema.prisma: verificar binaryTargets completos
- [ ] `docker build -f Dockerfile.backend .` — Test local (opcional pero recomendado)

---

## 🔐 Secrets & Environment Variables

**NUNCA hardcodear secrets.** Usar Render environment variables:

### En código
```typescript
// ✅ CORRECTO
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = env.JWT_SECRET;  // Validado con Zod en startup

// ❌ INCORRECTO
const password = "hardcoded_secret_123";
```

### En Render.yaml
```yaml
JWT_SECRET: sync:false              # Manual entry in Render dashboard
JWT_REFRESH_SECRET: sync:false      # Manual entry
DATABASE_URL: fromDatabase          # Auto-linked from service
```

---

## 📞 Contacto y contexto

- **Stack**: Node.js 24, Express, Prisma, PostgreSQL 16, React, Vite
- **Deploy**: Render.com (auto desde main)
- **Estado**: LIVE (https://servingmi-backend.onrender.com)
- **Rama principal**: main (auto-deploy)
