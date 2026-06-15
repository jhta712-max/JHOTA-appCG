# Credit Lines Visibility — Design Spec

**Date:** 2026-06-15

## Goal

Mostrar el estado de las líneas de crédito de suplidores en el dashboard, ofrecer experiencia mejorada para operadores al crear gastos a crédito, y agregar un reporte Excel exportable. Todo sin nueva ruta.

## Architecture

- Nuevo endpoint `GET /suppliers/credit-summary` que agrega balance de todas las líneas activas
- Dashboard consume ese endpoint con TanStack Query (solo admin/supervisor)
- ReportsPage agrega opción "Estado de Crédito" que llama al mismo endpoint y exporta Excel vía `exceljs`
- Operadores: solo mejora UX en el selector de línea de crédito (deshabilitar líneas sin disponible)

---

## Feature 1: Dashboard — KPI card + sección

### KPI card (admin/supervisor únicamente)
- Título: `DEUDA CON SUPLIDORES`
- Valor: suma total de `pending` de todas las líneas activas (RD$)
- Sub-línea: `X líneas activas · RD$ Y disponible`
- Alerta amarilla (`#F5C218` border) si alguna línea tiene `available / creditLimit < 0.20`
- Click hace scroll a la sección de crédito del dashboard

### Sección "CRÉDITO DE SUPLIDORES" (al fondo del dashboard, antes de gastos recientes)
- Solo visible para admin/supervisor (`role.isAdmin || role.isSupervisor`)
- Tabla: Suplidor / Límite / Consumido / Pendiente / Disponible / Estado
- Estado badge:
  - `EN ORDEN` (verde bg-green-100) si `available / creditLimit >= 0.20`
  - `BAJO` (amarillo bg-yellow-100) si `0.10 <= available / creditLimit < 0.20`
  - `CRÍTICO` (rojo bg-red-100) si `available / creditLimit < 0.10`
  - `SIN DEUDA` (gris bg-gray-100) si `pending === 0`
- Máx 10 filas, ordenadas por `pending` desc
- Link "Ver todos en Suplidores →" al final

---

## Feature 2: Experiencia operadores en formulario de gastos

En `NewExpensePage.tsx`, cuando se selecciona una línea de crédito:
- Si `available <= 0`: opción deshabilitada con texto `(Sin disponible)`
- Si `available > 0`: muestra `Disponible: RD$ X` (ya existe, mantener)
- Sin otros cambios para operadores

---

## Feature 3: Reporte Excel "Estado de Crédito"

### UI (ReportsPage)
- Nueva card de reporte: "Estado de Crédito por Suplidor"
- Filtros: estado (`activas` / `todas`), sin filtro de fecha (snapshot actual)
- Solo visible para admin/supervisor
- Botón: "Exportar Excel"

### Columnas del Excel
| Columna | Fuente |
|---|---|
| Suplidor | supplierName |
| RNC | supplier.rnc |
| Límite de Crédito | creditLimit |
| Consumido | consumed |
| Pagado | paid |
| Pendiente (Deuda) | pending |
| Disponible | available |
| % Utilización | `(pending / creditLimit * 100).toFixed(1)` |
| Estado | EN ORDEN / BAJO / CRÍTICO / SIN DEUDA |
| Última actividad | updatedAt de la línea |

### Generación Excel (backend)
- Nuevo endpoint `GET /suppliers/credit-report` con query `?status=active|all`
- Usa `exceljs` (ya instalado en el proyecto) para generar `.xlsx`
- Responde con `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## Feature 4: Backend — endpoint de resumen global

### `GET /suppliers/credit-summary`
```json
{
  "totalPending": 450000,
  "totalAvailable": 1200000,
  "totalLimit": 1650000,
  "activeLines": 8,
  "lines": [
    {
      "supplierId": "uuid",
      "supplierName": "Ferretería XYZ",
      "supplierRnc": "101234567",
      "creditLineId": "uuid",
      "creditLimit": 500000,
      "consumed": 350000,
      "paid": 200000,
      "pending": 150000,
      "available": 350000,
      "isActive": true,
      "updatedAt": "2026-06-15T..."
    }
  ]
}
```

- Solo líneas activas (`isActive: true`) por defecto
- Query param `?status=all` incluye inactivas
- Ordenadas por `pending` desc

### `GET /suppliers/credit-report?status=active|all`
- Mismos datos que credit-summary
- Responde `.xlsx` binario (no JSON)

### Autorización
- Ambos endpoints: `authenticate` + `authorize('admin', 'supervisor')`

---

## Files

### Backend — crear
- `apps/backend/src/modules/suppliers/credit-summary.service.ts`

### Backend — modificar
- `apps/backend/src/modules/suppliers/suppliers.router.ts` — agregar 2 rutas nuevas
- `apps/backend/src/modules/suppliers/suppliers.controller.ts` — agregar 2 handlers

### Frontend — modificar
- `apps/frontend/src/api/index.ts` — agregar `getCreditSummary()`
- `apps/frontend/src/pages/dashboard/DashboardPage.tsx` — KPI card + sección
- `apps/frontend/src/pages/expenses/NewExpensePage.tsx` — deshabilitar líneas sin disponible
- `apps/frontend/src/pages/reports/ReportsPage.tsx` — nueva card de reporte

---

## Out of scope
- Historial de pagos en dashboard
- Notificaciones automáticas cuando crédito es crítico
- Filtro por proyecto en el reporte
