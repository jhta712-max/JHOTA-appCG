# ServingMI — Roadmap de Mejoras
_Creado: 2026-06-16 / Última actualización: 2026-06-16_

---

## 🔴 ALTA PRIORIDAD — En progreso / próximos

### 1. ✅ Fix de fechas sospechosas — COMPLETADO (2026-06-16)
Warning inline cuando la fecha del gasto tiene ≥7 días (amarillo) o ≥30 días (rojo).
Archivos: `NewExpensePage.tsx`, `EditExpensePage.tsx`

### 2. ✅ Dashboard de alertas accionables — COMPLETADO (2026-06-16)
Panel "ATENCIÓN REQUERIDA" en dashboard con: órdenes pendientes, proyectos >85% presupuesto,
cotizaciones venciendo en ≤7 días, líneas de crédito >80%, suscripciones ≤30 días.
Archivos: `modules/dashboard/dashboard.service.ts`, `modules/dashboard/dashboard.router.ts`, `DashboardPage.tsx`

### 3. ✅ Aprobación de gastos en dos pasos — COMPLETADO (2026-06-16)
Badges PENDING_APPROVAL / APPROVED / REJECTED con botones aprobar/rechazar para admin y supervisor.
Modal de rechazo con motivo. `ExpensesPage.tsx` con mutations `approve` y `reject`.
Backend: `POST /expenses/:id/approve`, `POST /expenses/:id/reject`.

### 4. ✅ Historial de cambios visible (audit trail) — COMPLETADO (2026-06-16)
Servicio `audit.service.ts` con `logAudit()` fire-and-forget.
Registra create/update/approve/reject/void en gastos. Sección collapsible en `ExpenseDetailPage.tsx`.
Backend: `GET /expenses/:id/history` (admin y supervisor only).

---

## 🟡 IMPACTO MEDIO — Siguiente sprint

### 5. ✅ Importación masiva de gastos (CSV) — COMPLETADO (2026-06-16)
Backend (`POST /expenses/bulk-import`) y modal de vista previa ya existían.
Añadido botón "Plantilla" que descarga `plantilla-importacion-gastos.csv` con columnas y fila de ejemplo.
Archivos: `ExpensesPage.tsx`

### 6. 🔲 Presupuesto por categoría dentro del proyecto
Sub-presupuestos por categoría con alertas cuando se acerca al límite.
- Modelo `ProjectCategoryBudget` (projectId, categoryId, budget)
- Widget en detalle de proyecto

### 7. ✅ Duplicar orden de pago — COMPLETADO (2026-06-16)
Botón "Clonar" en el panel de detalle de la orden. Pre-rellena el formulario de creación con todos los
campos (orderType, empresa, suplidor, proyecto, monto, moneda, concepto, notas). Limpia payrollId,
batchItemId y creditLineId para que el usuario parta limpio.
Archivos: `PaymentOrdersPage.tsx`

### 8. ✅ Filtros guardados / vistas personalizadas — COMPLETADO (2026-06-16)
Hook `useSavedFilters(namespace)` + componente `SavedFiltersBar`. Persiste en `localStorage`.
Chips amarillos para aplicar vista guardada, ✕ para eliminar, "Guardar vista" para crear nueva.
Integrado en `ExpensesPage` (todos los filtros) y `PaymentOrdersPage` (status, tipo, creado por).
Archivos: `hooks/useSavedFilters.ts`, `components/ui/SavedFiltersBar.tsx`

---

## 🟢 CALIDAD DE DATOS

### 9. ✅ Detección de gastos duplicados — COMPLETADO (2026-06-16)
Todos los roles: al guardar, verifica monto ±0.1% y fecha ±3 días en el mismo proyecto.
Modal de confirmación lista duplicados con descripción, monto, fecha, categoría y autor.
Backend: `GET /expenses/check-duplicate`, Frontend: `NewExpensePage.tsx`

### 10. ✅ Validación de presupuesto en tiempo real — COMPLETADO (2026-06-16)
Solo admin: al seleccionar proyecto y escribir monto, muestra inline "disponible" y "después
de este gasto" (verde normal / rojo sobregiro). Usa `GET /projects/:id/summary`.
Archivos: `NewExpensePage.tsx`

### 11. ✅ Estado de órdenes de pago más granular — COMPLETADO (2026-06-16)
Estados: `IN_PROCESS` (azul), `REJECTED_BANK` (naranja). Flujo: PENDING → IN_PROCESS → PAID | REJECTED_BANK → PENDING.
Backend valida transiciones en `updatePaymentOrderStatus()`. Frontend con botones contextuales por estado.
Archivos: `payment-orders.service.ts`, `payment-orders.router.ts`, `PaymentOrdersPage.tsx`, `types/index.ts`

---

## 📊 REPORTES

### 12. 🔲 Reporte de varianza presupuesto vs. ejecución
Por proyecto: presupuesto estimado vs. gastado vs. comprometido (órdenes pendientes).
Exportable a Excel. Endpoint: `GET /reports/variance?projectId=`

### 13. ✅ Dashboard ejecutivo multi-proyecto — COMPLETADO (2026-06-16)
Tabla de portafolio en el dashboard (solo admin/supervisor). Backend: `GET /projects/portfolio`
devuelve todos los proyectos no cancelados con ejecutado, comprometido, disponible y % en una sola query.
Semáforo: verde <70%, amarillo 70–90%, naranja 90–100%, rojo >100%. Link a reporte de varianza.
Archivos: `projects.service.ts`, `projects.router.ts`, `projects.controller.ts`, `DashboardPage.tsx`

---

## Orden de ejecución sugerido
1. ~~Fix fechas~~ ✅
2. ~~Dashboard de alertas accionables~~ ✅
3. ~~Detección duplicados~~ ✅
4. ~~Validación presupuesto en tiempo real~~ ✅
5. Aprobación de gastos en dos pasos (#3)
6. Historial de cambios (#4)
7. Estado órdenes más granular (#11)
8. Reporte de varianza (#12)
9. Resto del backlog...
