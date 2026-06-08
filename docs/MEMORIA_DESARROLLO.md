# MEMORIA DE DESARROLLO — SERVINGMI Sistema de Gastos
> Última actualización: Junio 2026

---

## ¿QUÉ ES EL SISTEMA?

**SERVINGMI** es un sistema interno de gestión de gastos para una empresa constructora dominicana.
Controla proyectos de construcción, gastos por proyecto, nóminas, cotizaciones, órdenes de pago,
contratos con suplidores, y cumplimiento fiscal DGII (comprobantes NCF/RNC).

**URL de producción:** Auto-deploy en Render.com desde rama `main`
**Stack:** Node.js + Express + TypeScript + Prisma + PostgreSQL (backend) / React 18 + Vite + TailwindCSS + TanStack Query (frontend)
**Monorepo:** pnpm workspaces (`apps/backend`, `apps/frontend`)

---

## ARQUITECTURA GENERAL

```
servingmi-appCG/
├── apps/
│   ├── backend/          Node.js + Express + Prisma
│   │   ├── src/modules/  Un módulo por dominio de negocio
│   │   └── prisma/       Schema PostgreSQL
│   └── frontend/         React 18 + Vite + TailwindCSS
│       └── src/
│           ├── pages/    Una carpeta por módulo
│           ├── components/layout/Layout.tsx
│           ├── hooks/useRole.ts   ← RBAC centralizado
│           ├── stores/authStore.ts ← Zustand
│           └── api/index.ts      ← Todos los endpoints
├── docs/                 Documentación en español
├── scripts/sql/          Scripts SQL de mantenimiento
├── data/gastos/          CSVs con datos históricos
└── templates/            Plantillas HTML (orden de pago)
```

---

## BASE DE DATOS — MODELOS PRISMA

| Modelo | Descripción |
|--------|-------------|
| `Role` | admin, supervisor, operator, auxiliar, financiero |
| `User` | Usuarios del sistema con rol asignado |
| `Project` | Proyectos de construcción (ACTIVE/PAUSED/COMPLETED/CANCELLED) |
| `ProjectAssignment` | Asignación de usuarios a proyectos |
| `ProjectAddendum` | Addendas/modificaciones de proyectos |
| `ProjectCubicacion` | Líneas de cubicación para análisis financiero |
| `CompanyCard` | Tarjetas corporativas de pago |
| `ExpenseCategory` | Categorías de gastos (Materiales, Servicios, Mano de obra, etc.) |
| `Expense` | Gastos registrados por proyecto (ACTIVE/VOIDED/PENDING/REJECTED) |
| `FiscalVoucher` | Comprobantes fiscales DGII (NCF, RNC, tipo) |
| `Attachment` | Archivos adjuntos (fotos de recibos, documentos) |
| `AuditLog` | Trazabilidad de cambios en el sistema |
| `Invitation` | Invitaciones para nuevos usuarios |
| `Payroll` | Nóminas (DRAFT/APPROVED/PAID/VOIDED) |
| `PayrollLine` | Líneas individuales dentro de una nómina |
| `SystemLog` | Logs internos del sistema |
| `HealthCheckResult` | Resultados de health checks |
| `RefreshToken` | Tokens de refresco JWT |
| `Quotation` | Cotizaciones de suplidores (8 estados posibles) |
| `QuotationPayment` | Pagos parciales de cotizaciones |
| `QuotationExpenseLink` | Vínculos cotización → gasto |
| `QuotationAttachment` | Archivos adjuntos de cotizaciones |
| `Supplier` | Directorio de suplidores (unificado con beneficiarios) |
| `PaymentOrder` | Órdenes de pago (SERVICIO/MATERIALS/PAYROLL) |
| `OfficeExpense` | Gastos de oficina y administración |
| `Batch` | Lotes de importación CSV |
| `BatchItem` | Ítems individuales dentro de un lote |
| `Notification` | Notificaciones in-app |
| `NotificationContact` | Contactos externos para WhatsApp/email |
| `ContratoAjustado` | Contratos ajustados por suplidor/proyecto |
| `ContratoAjustadoPago` | Pagos vinculados a contratos ajustados |
| `ServiceSubscription` | Subscripciones de servicios recurrentes (MonitoringPage) |

---

## MÓDULOS BACKEND (`apps/backend/src/modules/`)

| Módulo | Endpoints principales |
|--------|-----------------------|
| `auth` | Login, logout, refresh, me, forgot-password, reset-password |
| `users` | CRUD usuarios, invitaciones, cambio de contraseña |
| `projects` | CRUD proyectos, summary financiero, asignación de equipo, addendas, cubicaciones |
| `expenses` | CRUD gastos, bulk-import CSV, OCR, aprobación financiero/admin |
| `categories` | CRUD categorías de gastos |
| `quotations` | CRUD cotizaciones, pagos parciales, adjuntos, cambios de estado |
| `payment-orders` | CRUD órdenes de pago, markAsPaid, linkPayroll |
| `payroll` | CRUD nóminas, líneas, importFromOrders, export xlsx/docx |
| `office-expenses` | CRUD gastos de oficina, OCR, resumen mensual |
| `suppliers` | CRUD suplidores, historial de transacciones, activar/desactivar |
| `cards` | CRUD tarjetas corporativas |
| `reports` | Reportes Excel/PDF por proyecto, fecha, categoría |
| `monitoring` | Health check, logs del sistema, subscripciones de servicios |
| `ocr` | Análisis de recibos con IA (Google Gemini) |
| `backup` | Export masivo de datos en Excel |
| `invitations` | Aceptar invitaciones, activar cuentas |
| `notifications` | In-app, email, WhatsApp (multi-receptor) |
| `notification-contacts` | CRUD contactos externos de notificación |
| `batches` | Importación masiva de gastos desde CSV |
| `contratos-ajustados` | CRUD contratos, vínculos con órdenes de pago, progreso |
| `service-subscriptions` | CRUD subscripciones de servicios en MonitoringPage |

---

## SISTEMA RBAC — ROLES Y PERMISOS

Hook centralizado: `useRole()` en `apps/frontend/src/hooks/useRole.ts`

| Rol | Acceso |
|-----|--------|
| `admin` | Todo + cambiar vista de rol (viewAsRole) |
| `supervisor` | Proyectos, gastos, cotizaciones, nóminas, órdenes, reportes |
| `operator` | Ver proyectos/gastos/cotizaciones, crear gastos/cotizaciones/nóminas |
| `auxiliar` | Ver + marcar órdenes pendientes, crear/editar nóminas |
| `financiero` | Solo lectura: proyectos, gastos, cotizaciones, reportes, exportar. Aprueba/rechaza gastos |

**Funcionalidad especial Admin:** `viewAsRole` — puede ver la interfaz como cualquier otro rol sin perder acceso real.

---

## FLUJOS DE NEGOCIO CRÍTICOS

### 1. Flujo Orden de Pago → Nómina
```
1. Crear Orden de Pago (tipo PAYROLL)
2. Crear Nómina (DRAFT)
3. Desde nómina: Vincular Orden de Pago → paymentOrdersApi.linkPayroll(orderId, payrollId)
4. Desde nómina: Importar líneas → payrollApi.importFromOrders(payrollId)
5. Aprobar nómina
6. Exportar Excel o Word
```

### 2. Auto-creación de gastos al pagar órdenes
- Orden tipo `MATERIALS` → gasto automático categoría **"Materiales"**
- Orden tipo `SERVICIO` → gasto automático categoría **"Servicios"**
- Orden tipo `PAYROLL` → NO crea gasto individual (lo gestiona la nómina)

### 3. Flujo de aprobación de gastos
```
Operator crea gasto → estado PENDING
Financiero/Admin aprueba → estado ACTIVE
Financiero/Admin rechaza → estado REJECTED
```

### 4. Ciclo de cotizaciones
```
PENDING → APPROVED → ADVANCE_PAID → IN_PROGRESS
       → PARTIAL_INVOICED → INVOICED → PAID
       → CANCELLED (en cualquier punto)
```

---

## FUNCIONALIDADES DESARROLLADAS (cronológico)

### FUNDACIONES
- Sistema base Express + Prisma + PostgreSQL
- Auth JWT con refresh tokens
- CRUD de proyectos y gastos básicos
- Importación bulk de gastos desde CSV
- Sistema de lotes (batches) para gastos históricos

### MÓDULO NÓMINAS
- Creación de nóminas con líneas editables
- Vinculación Nómina ↔ Orden de Pago
- Importar líneas desde órdenes vinculadas
- Exportar nómina a Excel (.xlsx) y Word (.docx)
- Estados: DRAFT → APPROVED → PAID → VOIDED

### MÓDULO ÓRDENES DE PAGO
- Tipos: SERVICIO, MATERIALS, PAYROLL
- Bandeja de pendientes para rol auxiliar
- markAsPaid con auto-creación de gasto
- Filtros por estado, proyecto, tipo
- Acciones masivas (marcar múltiples como pagadas)

### MÓDULO COTIZACIONES
- 8 estados del ciclo de vida
- Pagos parciales con avances
- Adjuntos de archivos
- Alerta en dashboard de cotizaciones próximas a vencer
- Vínculo cotización → gasto al invoicar

### RBAC COMPLETO
- 5 roles con permisos granulares
- Hook `useRole()` centralizado
- `viewAsRole` para admin: simula vista de cualquier rol
- Navegación filtrada por rol efectivo
- RoleViewSwitcher en sidebar

### DASHBOARD CON GRÁFICAS
- Gráfica "Gastos por mes" (BarChart Recharts) — fondo negro, barras amarillas
- Gráfica "Gastos por categoría" (progress bars)
- Stats: proyectos activos, gastos, cotizaciones abiertas, pagos pendientes
- Alertas de cotizaciones próximas a vencer
- Proyectos activos con barra de ejecución presupuestaria
- Sección diferente según rol (auxiliar ve menos)

### SISTEMA DE NOTIFICACIONES (3 canales)
- **In-app:** Bell icon en header con badge contador
- **Email:** Alertas automáticas por SMTP
- **WhatsApp:** Integración API (opt-in por usuario)
- Multi-receptor: admins + contactos externos configurables
- Página de gestión de contactos externos (`/notification-contacts`)
- Endpoints de test manual para WhatsApp y email

### DIRECTORIO DE SUPLIDORES
- Perfil completo: nombre, RNC, teléfono, email, dirección, notas
- Activar/desactivar suplidores
- Historial de transacciones: cotizaciones + órdenes de pago
- Tabs en detalle: Resumen / Cotizaciones / Órdenes de Pago
- Enlace con módulo de órdenes y cotizaciones

### MÓDULO GASTOS DE OFICINA
- Gastos administrativos separados de gastos de proyectos
- OCR: escaneo de recibos con IA para autocompletar
- Categorías propias: limpieza, material gastable, servicios generales
- Resumen mensual con totales por categoría
- Vinculación con suplidor

### FLUJO DE APROBACIÓN DE GASTOS
- Gastos creados por operator quedan en estado PENDING
- Financiero y admin pueden aprobar o rechazar
- Gastos rechazados muestran motivo
- Filtro de gastos por estado en lista

### PWA Y LOGO
- Manifest.json con icono 192x192 y 512x512
- Logo SERVINGMI isotipo PNG como app icon
- Apple touch icon para iOS
- Instalable como app en móvil

### MÓDULO CONTRATOS AJUSTADOS
- Contratos entre empresa y suplidores por proyecto
- Monto contratado vs pagado vs pendiente
- Barra de progreso de ejecución por contrato
- Alertas de sobregirados (pagado > contratado)
- Vínculo a órdenes de pago como comprobante de pago
- Estados: ACTIVO / COMPLETADO / CANCELADO
- Tarjetas de resumen: total contratado, pagado, pendiente, activos

### SUBSCRIPCIONES DE SERVICIOS (MonitoringPage)
- Seguimiento de servicios recurrentes (hosting, dominios, software)
- Costo mensual, fecha de vencimiento, proveedor
- Alertas de renovación próxima
- Panel integrado en página de monitoreo del sistema

### UNIFICACIÓN BENEFICIARIOS → SUPLIDORES
- Eliminado módulo de beneficiarios separado
- Órdenes de pago ahora referencian directamente a `Supplier`
- Migración de datos: beneficiarios existentes migrados a suplidores
- `Supplier.legacyBeneficiaryId` como FK de compatibilidad
- Frontend actualizado en todas las referencias

### SISTEMA DE DISEÑO CONSERVADOR (SERVINGMI Brand)
- **Fuentes:** Barlow Condensed (títulos) + DM Sans (cuerpo) + Space Mono (códigos/números)
- **Colores:** `#1C1C1C` carbón + `#F5C218` amarillo + `#F8F9FA` surface
- **Clases CSS globales:** `.page-title`, `.module-label`, `.smi-btn`, `.smi-btn-yellow`
- **Todos los headers de página** actualizados con breadcrumb en Space Mono + título en Barlow Condensed 700
- **Sin fondos negros de página completa** — negro solo en sidebar, tabla headers, botones CTA, y la gráfica del dashboard
- **Gráfica dashboard:** fondo negro con barras amarillas para máximo contraste de marca

---

## PÁGINAS FRONTEND

| Página | Ruta | Módulo |
|--------|------|--------|
| Dashboard | `/` | dashboard |
| Login | `/login` | auth |
| Olvidé contraseña | `/forgot-password` | auth |
| Reset contraseña | `/reset-password` | auth |
| Setup inicial | `/setup` | auth |
| Aceptar invitación | `/invite/:token` | invitations |
| Proyectos (lista) | `/projects` | projects |
| Proyecto (detalle) | `/projects/:id` | projects |
| Proyecto (crear/editar) | `/projects/new`, `/projects/:id/edit` | projects |
| Análisis financiero | `/projects/:id/financial` | projects |
| Importar lotes CSV | `/projects/import-batches` | projects |
| Gastos (lista) | `/expenses` | expenses |
| Gasto (detalle) | `/expenses/:id` | expenses |
| Gasto (nuevo) | `/expenses/new` | expenses |
| Gasto (editar) | `/expenses/:id/edit` | expenses |
| Nóminas (lista) | `/payrolls` | payroll |
| Nómina (detalle) | `/payrolls/:id` | payroll |
| Nómina (crear/editar) | `/payrolls/new`, `/payrolls/:id/edit` | payroll |
| Órdenes de pago | `/payment-orders` | payment-orders |
| Pagos pendientes | `/pending-orders` | payment-orders |
| Cotizaciones (lista) | `/quotations` | quotations |
| Cotización (detalle) | `/quotations/:id` | quotations |
| Cotización (crear/editar) | `/quotations/new`, `/quotations/:id/edit` | quotations |
| Suplidores (lista) | `/suppliers` | suppliers |
| Suplidor (detalle) | `/suppliers/:id` | suppliers |
| Contratos Ajustados | `/contratos-ajustados` | contratos-ajustados |
| Gastos de Oficina | `/office-expenses` | office-expenses |
| Reportes | `/reports` | reports |
| Exportación | `/export` | reports |
| Usuarios | `/users` | users |
| Categorías | `/categories` | categories |
| Tarjetas | `/cards` | admin |
| Monitoreo | `/monitoring` | admin |
| Contactos notif. | `/notification-contacts` | admin |

---

## CATEGORÍAS DE GASTOS (seed exacto)

```
Materiales · Servicios · Mano de obra · Equipos · Transporte
Combustible · Dietas · Otros
```
> ⚠️ **CRÍTICO:** Al auto-crear gastos por código usar estos nombres exactos. El upsert es case-sensitive en PostgreSQL.

---

## CONFIGURACIÓN DE PRODUCCIÓN

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL en Render |
| `JWT_SECRET` | Secret para firmar tokens |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens |
| `GEMINI_API_KEY` | Google Gemini para OCR |
| `SMTP_HOST/PORT/USER/PASS` | Configuración email |
| `WHATSAPP_API_URL/TOKEN` | API WhatsApp para notificaciones |
| `NOTIFY_EMAIL` | Email del admin que recibe alertas |
| `BACKUP_EMAIL` | Email para backups automáticos |

**Deploy:** `git push origin main` → Render auto-deploya backend y frontend.

---

## PATRONES DE CÓDIGO ESTABLECIDOS

### Mutaciones con manejo de error
```typescript
useMutation({
  mutationFn: ...,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['key'] }),
  onError: (e: any) => setError(e.response?.data?.error ?? 'Error genérico'),
})
```

### Paginación estándar
```typescript
const { data } = useQuery({
  queryKey: ['key', ...filters, page],
  queryFn: () => api.list({ ...filters, page, limit: 20 }),
  select: (r) => r.data,
});
const items = data?.data ?? [];
const pagination = data?.pagination;
```

### Relaciones Prisma importantes
- `PaymentOrder.payrollId` → FK a `Payroll`
- `PaymentOrder.expenseId` → FK a `Expense` (auto al markAsPaid)
- `Payroll.paymentOrder` → relación **singular** (uno a uno)
- `Supplier` reemplaza a `Beneficiary` en órdenes de pago

---

## DOCUMENTACIÓN RELACIONADA

- `docs/PROYECTO.md` — Qué es el sistema, estructura, URLs
- `docs/COMANDOS.md` — Comandos con directorios exactos
- `docs/ROLES.md` — Tabla detallada de permisos por rol
- `docs/FLUJOS.md` — Flujos de negocio paso a paso
- `docs/MEMORIA_DESARROLLO.md` — Este archivo

---

*Documento generado con Claude Code — actualizar cada vez que se añada un módulo o funcionalidad mayor.*
