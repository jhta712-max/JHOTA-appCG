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
pnpm install                            # Instalar workspace completo
pnpm dev                                # Backend :3001 + frontend :5173 simultáneamente
pnpm build:backend                      # Compilar TypeScript + typecheck backend
pnpm build:frontend                     # Build Vite frontend

# Base de datos
docker-compose up -d postgres           # Levantar PostgreSQL local
pnpm db:migrate                         # prisma migrate dev (requiere Docker postgres)
pnpm --filter backend db:generate       # Regenerar Prisma client tras cambios al schema
                                        # ⚠️ `pnpm db:generate` (sin --filter) NO existe

# Tests
pnpm --filter backend test              # Vitest (todos los tests)
pnpm --filter backend test -- --run src/modules/expenses/__tests__/  # un directorio
pnpm --filter backend test -- --run src/utils/__tests__/fiscal.utils.test.ts  # un archivo

# Mantenimiento manual
pnpm --filter backend exec tsx ../../scripts/maintenance-agent.ts
```

## Arquitectura general

### Backend (`apps/backend/src/`)

Estructura por módulo: `router → controller → service`. El router registra las rutas, el controller maneja Request/Response, el service contiene la lógica de negocio con Prisma.

```
modules/
  auth/           # Login, refresh token, setup inicial
  users/          # Gestión de usuarios, invitaciones
  projects/       # Proyectos con presupuesto estimado; campo batchesEnabled activa partidas/lotes
  expenses/       # Gastos de proyectos (con OCR de facturas); campos paymentBank + paymentReference para trazabilidad bancaria
  payroll/        # Nóminas vinculadas a proyectos
  payment-orders/ # Órdenes de pago (vinculadas a nóminas/gastos); al marcar PAID propaga paymentBank+paymentReference al gasto auto-generado
  suppliers/      # Proveedores (incluye beneficiarios); endpoint validate-rnc/:rnc → DGII; crédito: GET /credit-summary + /credit-report
  quotations/     # Cotizaciones con OCR
  office-expenses/# Gastos de oficina; usa texto libre supplierName (no FK a suppliers)
  admin-employees/# Empleados administrativos con historial salarial y beneficios fijos
  admin-payrolls/ # Nóminas administrativas independientes de proyectos; cálculos AFP/TSS/ISR automáticos
  ocr/            # OCR síncrono: POST devuelve resultado inline (ver nota OCR)
  monitoring/     # Health check + análisis IA (Claude API)
  notifications/  # In-app + WhatsApp (UltraMsg) + Email (Gmail SMTP)
  notification-contacts/ # Contactos externos para notificaciones
  reports/        # Exportación Excel/Word + DGII 606 (.xlsx)
  backup/         # Backup de BD (auth con timingSafeEqual)
  batches/        # Lotes de pago; POST /projects/:id/batches/enable|disable activa/desactiva partidas
  cards/          # Tarjetas de crédito empresariales
  service-subscriptions/ # Suscripciones de servicios con alertas de vencimiento
  contratos-ajustados/   # Contratos ajustados de proyectos
  whatsapp/       # Chatbot WhatsApp: webhook UltraMsg → agente IA (Claude Haiku tool_use) → ejecuta acciones
  ai-usage/       # Dashboard de consumo de tokens Claude API; endpoints admin-only: /summary /by-feature /by-user /alert (GET+PUT)
services/
  dgii.service.ts         # Lookup RNC → DGII API con cache in-memory 24h
  ai-usage.service.ts     # Wrapper central trackAiCall() — envuelve client.messages.create(), persiste log en ai_usage_logs via setImmediate (nunca bloquea)
jobs/
  businessNotifications.ts  # Cron diario 8 AM: alertas presupuesto/nóminas/órdenes + checkAiCostAlert() si costo mensual supera límite configurado
  healthMonitor.ts          # Monitor de salud del sistema (cada 5 min)
  quotationNotifications.ts # Alertas de cotizaciones próximas a vencer
```

**Autenticación:** JWT Bearer token. El middleware `authenticate` inyecta `req.user` con `{ userId, role, email }`. Acceso al rol directo via `req.user!.role` (string plano, ej: `'admin'`).

**Respuesta estándar:** `{ success: true, data: ... }` o `{ success: false, error: '...', code: 'ERROR_CODE' }`.

### Frontend (`apps/frontend/src/`)

```
pages/        # Una carpeta por dominio, rutas en main.tsx (todas lazy-loaded)
components/
  ui/         # FormModal.tsx (modal industrial estándar), otros shared
  shared/     # FiscalVoucherForm.tsx (con validación RNC inline → DGII)
  layout/     # Layout.tsx (sidebar)
hooks/        # useRole(), useOcrPolling(), useRncValidation()
stores/       # Zustand: authStore (usuario + viewAsRole)
api/
  client.ts   # axios con interceptor de refresh token automático
  index.ts    # todos los API calls centralizados
utils/
  fiscal.ts   # NCF_REGEX, E_NCF_REGEX, RNC_REGEX para el frontend
```

**RBAC en frontend:** Usa siempre `useRole()` hook — nunca `useAuthStore` directamente para permisos. El hook expone flags como `isAdmin`, `canApprovePayroll`, `canViewReports`, etc., y soporta el modo "preview de rol" que admin puede activar.

**OCR (importante):** El backend procesa OCR sincrónicamente en Render free tier — los jobs en background se matan. El POST devuelve el resultado inline: `{ status: 'completed', result: OcrResult, jobId }`. El hook `useOcrPolling()` detecta esto y omite el polling. El fallback de polling sigue existiendo para futuros modos async. **Usar siempre `useOcrPolling()` — nunca `ocrApi` directamente.** Frontend: componente `OcrEnrichmentAlerts.tsx`, hook `useOcrPolling(projectId?)` llama `ocrApi.enrich()` en background tras OCR completo.

**Design system — industrial (#1C1C1C / #F5C218):** Todas las páginas siguen este patrón exacto:
- Hero: `<div className="bg-[#1C1C1C]">` con breadcrumb `text-[#F5C218]` y H1 `font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight`
- Tipografías: `font-['Barlow_Condensed']` headings/labels, `font-['DM_Sans']` body, `font-['Space_Mono']` números/códigos
- Sin `rounded-xl`, `rounded-2xl`, `rounded-lg` en cards, panels ni modals — esquinas afiladas en todo
- Botón primario: `bg-[#F5C218] text-[#1C1C1C]` sin radius. Botón cancelar: `border border-gray-200 text-gray-600` sin radius
- Modal: usar `<FormModal>` de `components/ui/FormModal.tsx` — header `bg-[#1C1C1C]`, título blanco uppercase, X gris → hover `text-[#F5C218]`
- Tabla: `thead` con `bg-[#1C1C1C]`, headers `font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]`
- Feedback OK: `bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218]` (nunca `bg-green-50`)
- Inputs: `border-gray-200` focus → `focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]`
- Outer wrapper de página: `min-h-screen bg-gray-50`

**Axios generics y el wrapper de respuesta:** `api.post<T>` donde `T` es el tipo de `res.data` (no del dato interno). El backend siempre devuelve `{ success, data: T }`. Por tanto: `api.post<{ success: boolean; data: MiTipo }>('/ruta', body)` y acceder con `res.data.data`. Tipar solo el dato interno (`api.post<MiTipo>`) causa que `res.data.data` sea `undefined` en runtime.

**Vite/esbuild TDZ en producción:** Si en un componente React se usa una variable de `useForm` (ej: `watch`, `setValue`) ANTES de la línea donde se llama a `useForm({...})`, el build de producción falla con `ReferenceError: Cannot access 'X' before initialization`. El minificador combina las declaraciones `const` en una sola cadena, haciendo visible el TDZ. Regla: llamar siempre a `useForm()` ANTES de usar cualquiera de sus valores retornados (`watch`, `setValue`, etc.).

**Líneas de crédito de suplidores:** Modelos `SupplierCreditLine` y `SupplierCreditPayment`. Balance calculado en runtime: `consumed` = suma de `Expense` no-VOID con `creditLineId`; `paid` = suma de `SupplierCreditPayment.amount`; `pending = consumed - paid`; `available = creditLimit - pending`. La lógica de agregación global está en `modules/suppliers/credit-summary.service.ts`. Cuando una `PaymentOrder` con `creditLineId` se marca como pagada (`markAsPaid`), se auto-crea un `SupplierCreditPayment` dentro de la misma transacción. Rutas `/credit-summary` y `/credit-report` deben ir ANTES de `/:id` en el router o Express las captura como parámetro.

**Trazabilidad bancaria de pagos (Orden de Pago → Gasto):** Cuando se marca una `PaymentOrder` como pagada, los campos `paymentBank` y `paymentReference` se propagan automáticamente al `Expense` auto-generado dentro de la misma transacción. Esto ocurre en `buildExpenseData()` en `payment-orders.service.ts` — la función acepta `paymentBank?` y `paymentReference?` en `ExpenseSourceData` y los incluye en el objeto Prisma. No modificar este flujo sin verificar que ambos campos se pasan desde `markAsPaid()` a `buildExpenseData()`.

**Consumo de IA (ai_usage_logs):** Toda llamada a Claude API debe pasar por `trackAiCall()` en `services/ai-usage.service.ts` en lugar de llamar `client.messages.create()` directamente. El wrapper acepta `{ feature, client, request, userId?, projectId?, metadata? }` y persiste el log en background (nunca bloquea). Features válidas: `'OCR' | 'WHATSAPP' | 'AI_SUMMARY' | 'SUGGEST_CATEGORY' | 'SUGGEST_CONCEPT' | 'MONITORING' | 'SUPPLIER_SUGGESTIONS'`. Pricing hardcodeado para Haiku 4.5: $1.00/M input, $5.00/M output. Tabla `ai_usage_alerts` tiene una sola fila de configuración (límite mensual + enabled). El cron diario llama `checkAiCostAlert()` y envía WhatsApp si el costo supera el límite.

**Toggle batchesEnabled en proyectos:** El campo `Project.batchesEnabled` (Boolean, default false) se activa/desactiva vía `POST /projects/:id/batches/enable` y `POST /projects/:id/batches/disable`. El formulario `ProjectFormPage.tsx` muestra el toggle en creación y edición. En creación: si el toggle está activo al guardar, llama a `enableBatches` después de crear. En edición: llama al endpoint inmediatamente al cambiar el toggle. El backend impide desactivar si ya existen partidas cargadas.

**Campos de pago en formulario de Gastos:** `Expense` tiene `paymentBank` y `paymentReference` (ambos opcionales). El formulario los muestra condicionalmente: aparecen cuando `paymentMethod === 'TRANSFER'` o `'CHECK'`. El selector de tarjeta corporativa (`companyCardId`) aparece cuando `paymentMethod === 'CARD'`. Migración: `20260623000001_add_payment_bank_reference_to_expenses`.

**Gastos de oficina vs Módulo de suplidores:** Los suplidores del módulo `/suppliers` son entidades continuas (servicios, materiales, mano de obra). Los gastos de oficina (`/office-expenses`) usan texto libre `supplierName` — no FK a la tabla `suppliers` — porque sus proveedores son ocasionales y no continuos.

**Nómina Administrativa vs Nóminas de Proyecto:** `modules/payroll/` maneja nóminas vinculadas a proyectos. `modules/admin-payrolls/` es completamente independiente — empleados de oficina sin FK a proyectos. Cálculos en `admin-payroll.calculations.ts`: AFP 2.87% + TSS 3.04% sobre salario base solamente; ISR RD 2024 progresivo sobre `taxableBase` (salario + beneficios con `affectsISR=true`); `grossAmount` = salario + todos los beneficios. Flujo: DRAFT → APPROVED → PAID → VOIDED. Crear nómina auto-genera líneas para todos los empleados ACTIVE con la frecuencia del período (MONTHLY o BIWEEKLY).

## Reglas concretas

1. **Docker:** Siempre `COPY apps ./apps` (TODO el workspace). Nunca `COPY apps/backend ./apps/backend`. Si cambia Dockerfile → test local: `docker build -f Dockerfile.backend .`

2. **Prisma:** Si cambias `schema.prisma` → ejecuta `pnpm --filter backend db:generate` ANTES de push. Schema debe tener: `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`. Al quitar una relación de un modelo, buscar también el lado inverso en el modelo relacionado (ej: quitar FK en `OfficeExpense` requiere quitar también `officeExpenses[]` en `Supplier`). Buscar además en todos los `*.service.ts` que puedan filtrar por el campo eliminado. **Si `pnpm build:backend` lanza `does not exist in type` para un campo que SÍ está en `schema.prisma`, el cliente Prisma está desactualizado — ejecuta `db:generate`.**

3. **Migrations en producción:** usar `prisma migrate deploy` (no `dev`) en Render. Configurado como `preDeployCommand` en `render.yaml`. La startup migration en `entrypoint.sh` solo corre si `SKIP_STARTUP_MIGRATIONS` no está seteada.

4. **Antes de cada push a main:** Ejecuta `workspace/DEPLOYMENT/DEPLOY_CHECKLIST.md`.

5. **Modelo de notificaciones WhatsApp — dos implementaciones:** `apps/backend/src/services/notifications.service.ts` (alertas del sistema/jobs) y `apps/backend/src/modules/notifications/notifications.service.ts` (in-app + WhatsApp con `getWhatsAppRecipients`). Ambas deben usar `getWhatsAppRecipients(type?)` del módulo para respetar los `notifTypes` configurados en la BD. Si se agrega una alerta nueva, asegurarse de pasar el tipo correcto a `sendWhatsApp(message, 'TIPO')`. Tipos válidos: `BUDGET`, `PAYROLL`, `ORDERS`, `SERVICE_PAYMENTS`, `SYSTEM`, `SECURITY`.

6. **WhatsApp (UltraMsg) — notificaciones salientes:** Env vars: `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `NOTIFY_WHATSAPP_TO` (fallback). Los destinatarios reales vienen de la BD (`notificationContact` + usuarios con `whatsappOptIn`). El endpoint `GET /api/v1/notifications/whatsapp-recipients` devuelve la lista combinada filtrable por tipo (`?type=BUDGET`). Campo `notifTypes String[]` en User y NotificationContact — array vacío = recibe todos.

7. **Módulo WhatsApp chatbot** (`modules/whatsapp/`): Webhook en `POST /api/v1/whatsapp/webhook` (sin `authenticate`, sin `apiLimiter`, rate limit propio 30 req/min). Flujo: UltraMsg → `whatsapp.controller.ts` valida token con `timingSafeEqual` → ACK inmediato con 200 → `setImmediate` procesa async → `whatsapp.service.ts` maneja máquina de estados (ACTIVE / AWAITING_CONFIRMATION) → `whatsapp.agent.ts` corre Claude Haiku con 5 tools read-only (`list_projects`, `list_expense_categories`, `list_suppliers`, `get_project_balance`, `request_confirmation`) → usuario confirma con "Sí/No" → service ejecuta write contra los módulos existentes.
    - Contexto multi-turno en `WhatsAppConversation.contextData` (JSON). Historial limitado a últimos 10 mensajes.
    - `CREATE_PROJECT` y `CREATE_PAYMENT_ORDER` requieren rol `admin` o `supervisor`.
    - `lookupUserByPhone` compara número normalizado (`+1849...`) con campo `phone` del User. Si no hay match, usuario es `guest` y solo puede hacer consultas de balance.
    - El agente **nunca escribe en BD directamente** — solo llama `request_confirmation` y el service hace el write tras confirmación explícita.
    - Tablas: `whatsapp_conversations` (upsert por `phoneNumber` único), `whatsapp_messages`, `whatsapp_audit_logs`.

8. **Agente de mantenimiento** (`scripts/maintenance-agent.ts`): corre en GitHub Actions (`.github/workflows/maintenance.yml`). Cache en `.maintenance-cache.json` en raíz del repo. Path calculado con `__dirname` (no `process.cwd()`). Triggers: cron semanal + `on: push: branches: [main]` (post-deploy). En modo post-deploy solo crea issue si hay degradación.

9. **Agente de validación RNC/DGII** (`apps/backend/src/services/dgii.service.ts`): `lookupRNC(rnc)` consulta `api.dgii.gov.do/api/contribuyentes`, cache in-memory 24h, timeout 6s. Endpoint: `GET /suppliers/validate-rnc/:rnc`. Frontend: hook `useRncValidation(rnc)` con debounce 800ms. Integrado en `SuppliersPage` y `FiscalVoucherForm`. Si DGII no responde, devuelve `{ unreachable: true }` — no bloquea el formulario.

10. **Post-OCR Enrichment Agent** (`apps/backend/src/modules/ocr/ocr-enrichment.service.ts`): se llama después de OCR completo (no bloquea). Nivel 1 (alta confianza): match proveedor por RNC, duplicado NCF/eNCF, clasificación tipo comprobante (B01-B16 tradicional, E31-E45 eNCF electrónico), cruce con cotización abierta. Nivel 2 (solo warnings): validación ITBIS 10%-26%, tipos gubernamentales inusuales.

**Decisión de diseño — duplicación en BD (auditado 2026-06-23):** Se analizó toda la BD y se decidió NO normalizar ninguna duplicación existente. Motivos: (1) `paymentBank`/`paymentReference` en `expenses`, `payrolls`, `payment_orders` son snapshots inmutables del momento del pago — correctos por diseño de auditoría. (2) `FiscalVoucher.supplierName`/`supplierRnc` capturan datos del comprobante fiscal tal como fue emitido — no deben sincronizarse con `Supplier`. (3) `Quotation.supplierName` es campo de búsqueda con índice propio, independiente del FK `supplierId` (que es opcional). (4) `Supplier.bank`/`accountNumber`/`accountType` son campos residuales usados como fallback cuando no existe `SupplierBankAccount` — necesarios para compatibilidad con registros anteriores. (5) `PaymentOrder.generatedText` es el mensaje WhatsApp formateado — campo de UX crítico leído en 10+ lugares del frontend.

## Trampas conocidas (bugs que ya ocurrieron)

**Fallback numérico en nullish coalescing:** `String(valor ?? '0')` — si `valor` es `null`, resulta en `"null"`. El fallback debe ser numérico: `String(valor ?? 0)`.

**Prisma client desactualizado:** Si `pnpm build:backend` muestra `does not exist in type 'SomeModelCreateInput'` para un campo que sí existe en `schema.prisma`, el cliente generado no está sincronizado — ejecuta `pnpm --filter backend db:generate`. Ocurre cuando el schema cambia pero el client no se regeneró (ej. después de un `git pull`).

**`buildPaginatedResponse` requiere objeto PaginationParams:** La función en `apps/backend/src/utils/pagination.ts` acepta `(data, total, { page, limit, skip })` como tercer argumento — no `page` y `limit` separados. Construir el objeto inline: `buildPaginatedResponse(data, total, { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit })`.

**Migración baseline en desarrollo local:** El repo tiene una migración `20260531000000_init_baseline` que es un snapshot completo del schema. `prisma migrate deploy` desde una BD vacía falla con `type "project_status" already exists` porque las migraciones `20260518*` también están presentes. Solución documentada en `.claude/skills/run-servingmi/SKILL.md` → Setup §4.

**`bankAccountId` en update de PaymentOrder:** El frontend envía `bankAccountId` en el payload tanto para crear como para editar. En creación se usa para lookup de cuenta bancaria; en actualización debe excluirse del spread de Prisma (no existe como campo en el modelo `PaymentOrder`). Se desestructura y descarta en la línea: `const { payrollId, bankAccountId: _bankAccountId, ... } = data as any`. Además, `bankAccountId` se usa para regenerar `generatedText` en el update — si el usuario cambió la cuenta, el texto debe reflejar la nueva cuenta, no la default.

**`buildExpenseData` y campos nuevos:** Al agregar un campo nuevo a `Expense`, hay 3 lugares que actualizar: (1) `ExpenseSourceData` interface en `payment-orders.service.ts`, (2) el return de `buildExpenseData()`, (3) la llamada a `buildExpenseData()` dentro de `markAsPaid()`. Omitir cualquiera de los tres causa que el campo no se propague al gasto auto-generado desde una orden de pago.

## Primeros pasos en una sesión

1. Lee `workspace/README.md` → brújula de dónde buscar
2. Lee `workspace/SESSION_NOTES/` → qué pasó antes
3. Si hay error de deploy → `workspace/TROUBLESHOOTING/DOCKER_ISSUES.md`
4. Si necesitas agregar módulo → `workspace/DEVELOPMENT_GUIDES/ADDING_NEW_MODULE.md`
5. Para correr y hacer screenshots de la app → usa el skill `/run-servingmi`

## Deploy Configuration (configured by /setup-deploy)
- Platform: Render (auto-deploy on push to main)
- Production URL (backend): https://jhota-backend.onrender.com
- Production URL (frontend): https://jhota-frontend.onrender.com
- Deploy workflow: automatic — Render picks up push to `main` branch
- Deploy status command: HTTP health check
- Merge method: merge commit
- Project type: web app (monorepo — backend API + frontend SPA, both Docker)
- Post-deploy health check: https://jhota-backend.onrender.com/health

### Notes
- Health check route in app: `GET /health` (matches render.yaml `healthCheckPath: /health`)
- Pre-deploy command (configured in render.yaml): `prisma migrate deploy`
- Current live backend (servingmi branding): https://servingmi-backend.onrender.com/health responds 200
- render.yaml service names: `jhota-backend` and `jhota-frontend`

### Custom deploy hooks
- Pre-merge: `pnpm build:backend` (TypeScript typecheck)
- Deploy trigger: automatic on push to `main`
- Deploy status: poll `https://jhota-backend.onrender.com/health` until 200
- Health check: https://jhota-backend.onrender.com/health
