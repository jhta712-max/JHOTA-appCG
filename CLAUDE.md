# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**ServingMI** es un sistema de control de gastos por proyectos para empresas constructoras en República Dominicana. Multiusuario con RBAC, reportes, exportación Excel/Word, OCR de facturas con IA, y notificaciones WhatsApp/Email.

## Stack

- **Backend:** Node.js 24 + Express + TypeScript + Prisma ORM + PostgreSQL 16
- **Frontend:** React 18 + Vite + TailwindCSS + TanStack Query + Zustand
- **Deploy:** Render.com (Docker), monorepo pnpm workspaces
- **Rama principal:** `main` (auto-deploy en Render)
- **Backend live:** https://servingmi-backend.onrender.com

## Comandos clave

```bash
# Desde la raíz del monorepo
pnpm install              # Instalar workspace completo
pnpm dev                  # Backend + frontend simultáneamente
pnpm build:backend        # Compilar TypeScript backend
pnpm build:frontend       # Build Vite frontend

# Base de datos
docker-compose up -d postgres   # Levantar PostgreSQL local
pnpm db:migrate                 # Ejecutar migraciones Prisma
pnpm db:generate                # Regenerar Prisma client tras cambios al schema

# Mantenimiento manual
pnpm --filter backend exec tsx ../../scripts/maintenance-agent.ts
```

## Arquitectura general

### Backend (`apps/backend/src/`)

Estructura por módulo: cada módulo tiene `router → controller → service`. El router registra las rutas, el controller maneja Request/Response, el service contiene la lógica de negocio con Prisma.

```
modules/
  auth/           # Login, refresh token, setup inicial
  users/          # Gestión de usuarios, invitaciones
  projects/       # Proyectos con presupuesto estimado
  expenses/       # Gastos de proyectos (con OCR de facturas)
  payroll/        # Nóminas vinculadas a proyectos
  payment-orders/ # Órdenes de pago (vinculadas a nóminas/gastos)
  suppliers/      # Proveedores (incluye beneficiarios)
  quotations/     # Cotizaciones con OCR
  office-expenses/# Gastos de oficina (separados de proyectos)
  ocr/            # OCR asíncrono: POST→jobId, GET polling
  monitoring/     # Health check + análisis IA (Claude API)
  notifications/  # In-app + WhatsApp (UltraMsg) + Email (Gmail SMTP)
  notification-contacts/ # Contactos externos para notificaciones
  reports/        # Exportación Excel/Word
  backup/         # Backup de BD
  batches/        # Lotes de pago
  cards/          # Tarjetas de crédito
  service-subscriptions/ # Suscripciones de servicios con alertas
  contratos-ajustados/   # Contratos ajustados de proyectos
jobs/
  businessNotifications.ts  # Cron diario 8 AM: alertas presupuesto/nóminas/órdenes
  healthMonitor.ts          # Monitor de salud del sistema
  quotationNotifications.ts # Alertas de cotizaciones próximas a vencer
```

**Autenticación:** JWT Bearer token. El middleware `authenticate` inyecta `req.user` con `{ userId, role, email }`. Acceso al rol directo via `req.user!.role` (string plano, ej: `'admin'`).

**Respuesta estándar:** `{ success: true, data: ... }` o `{ success: false, error: '...', code: 'ERROR_CODE' }`.

### Frontend (`apps/frontend/src/`)

```
pages/        # Una carpeta por dominio, rutas en main.tsx
components/   # Componentes reutilizables + layout/Layout.tsx (sidebar)
hooks/        # useRole(), useOcrPolling(), y otros custom hooks
stores/       # Zustand: authStore (usuario + viewAsRole)
api/          # index.ts centraliza todos los axios calls
```

**RBAC en frontend:** Usa siempre `useRole()` hook — nunca `useAuthStore` directamente para permisos. El hook expone flags como `isAdmin`, `canApprovePayroll`, `canViewReports`, etc., y soporta el modo "preview de rol" que admin puede activar.

**OCR asíncrono:** El flujo es POST → recibe `jobId` (202) → poll GET `/ocr/jobs/:jobId` cada 2s hasta `completed`/`failed` (max 60s). Usar siempre el hook `useOcrPolling()` en los formularios — no llamar `ocrApi` directamente.

**Design system:** Industrial. Todas las páginas siguen este patrón exacto:
- Hero: `<div className="bg-[#1C1C1C]">` con breadcrumb `text-[#F5C218]` y H1 `font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight`
- Tipografías: `font-['Barlow_Condensed']` headings/labels, `font-['DM_Sans']` body, `font-['Space_Mono']` números/códigos
- Sin `rounded-xl`, `rounded-2xl`, `rounded-lg` en cards, panels ni modals — esquinas afiladas en todo
- Botón primario: `bg-[#F5C218] text-[#1C1C1C]` sin radius. Botón cancelar: `border border-gray-200 text-gray-600` sin radius
- Modal header: `bg-[#1C1C1C]` con título blanco uppercase, X gris → hover `text-[#F5C218]`
- Tabla: `thead` con `bg-[#1C1C1C]`, headers `font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]`
- Feedback OK: `bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218]` (nunca `bg-green-50`)
- Inputs: `border-gray-200` focus → `focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]`
- Outer wrapper de página: `min-h-screen bg-gray-50`

## Reglas concretas

1. **Docker:** Siempre `COPY apps ./apps` (TODO el workspace). Nunca `COPY apps/backend ./apps/backend`. Si cambia Dockerfile → test local: `docker build -f Dockerfile.backend .`

2. **Prisma:** Si cambias `schema.prisma` → ejecuta `pnpm run db:generate` ANTES de push. Schema debe tener: `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`

3. **Antes de cada push a main:** Ejecuta `workspace/DEPLOYMENT/DEPLOY_CHECKLIST.md`.

4. **WhatsApp (UltraMsg):** Env vars: `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `NOTIFY_WHATSAPP_TO` (fallback). Los destinatarios reales vienen de la BD (`notificationContact` + usuarios con `whatsappOptIn`). El endpoint `GET /api/v1/notifications/whatsapp-recipients` devuelve la lista combinada filtrable por tipo (`?type=BUDGET`). Tipos válidos: `BUDGET`, `PAYROLL`, `ORDERS`, `SERVICE_PAYMENTS`, `SYSTEM`, `SECURITY`. Campo `notifTypes String[]` en User y NotificationContact — array vacío = recibe todos.

5. **Agente de mantenimiento** (`scripts/maintenance-agent.ts`): corre en GitHub Actions (`.github/workflows/maintenance.yml`). Cache en `.maintenance-cache.json` en raíz del repo. Path calculado con `__dirname` (no `process.cwd()`). Triggers: cron semanal + `on: push: branches: [main]` (post-deploy). En modo post-deploy solo crea issue si hay degradación.

6. **Post-OCR Enrichment Agent** (`apps/backend/src/modules/ocr/ocr-enrichment.service.ts`): se llama después de OCR completo (no bloquea). Nivel 1 (alta confianza): match proveedor por RNC, duplicado NCF/eNCF, clasificación tipo comprobante (B01-B16 tradicional, E31-E45 eNCF electrónico), cruce con cotización abierta. Nivel 2 (solo warnings): validación ITBIS 10%-26%, tipos gubernamentales inusuales. Frontend: componente `OcrEnrichmentAlerts.tsx`, hook `useOcrPolling(projectId?)` llama `ocrApi.enrich()` en background tras OCR completo.

## Primeros pasos en una sesión

1. Lee `workspace/README.md` → brújula de dónde buscar
2. Lee `workspace/SESSION_NOTES/` → qué pasó antes
3. Si hay error de deploy → `workspace/TROUBLESHOOTING/DOCKER_ISSUES.md`
4. Si necesitas agregar módulo → `workspace/DEVELOPMENT_GUIDES/ADDING_NEW_MODULE.md`
