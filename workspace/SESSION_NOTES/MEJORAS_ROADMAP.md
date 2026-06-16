# ServingMI — Roadmap de Mejoras
_Creado: 2026-06-16_

---

## 🔴 ALTA PRIORIDAD — En progreso / próximos

### 1. ✅ Fix de fechas sospechosas — COMPLETADO (2026-06-16)
Warning inline cuando la fecha del gasto tiene ≥7 días (amarillo) o ≥30 días (rojo).
Archivos: `NewExpensePage.tsx`, `EditExpensePage.tsx`

### 2. 🔲 Dashboard de alertas accionables
Panel "cosas que necesitan atención hoy" en el dashboard principal:
- Órdenes de pago pendientes de aprobación
- Proyectos con presupuesto al límite (>85% ejecutado)
- Cotizaciones próximas a vencer (≤7 días)
- Líneas de crédito casi agotadas (>80% consumido)
- Implementación: widget en `DashboardPage.tsx` + endpoint `GET /api/v1/dashboard/alerts`

### 3. 🔲 Aprobación de gastos en dos pasos
Flujo opcional por proyecto: `PENDING → APPROVED` que supervisor/admin debe activar.
- Campo `requiresApproval: Boolean` en `Project`
- Estado `PENDING` en `Expense` (ya existe el enum, verificar)
- Vista "Gastos pendientes de aprobación" para supervisores
- Operadores ven sus gastos en estado pendiente hasta aprobación

### 4. 🔲 Historial de cambios visible (audit trail)
Tab "Historial" en detalle de proyecto y gasto mostrando: quién, qué cambió, cuándo.
- Tabla `AuditLog` (modelo, modelId, userId, action, changes JSON, createdAt)
- Middleware Prisma que registra updates/deletes automáticamente
- UI: tab en `ProjectDetailPage.tsx` y `NewExpensePage.tsx`

---

## 🟡 IMPACTO MEDIO — Siguiente sprint

### 5. 🔲 Importación masiva de gastos (Excel/CSV)
Extender lógica de `batches.import.ts` para gastos normales sin lote.
Plantilla Excel descargable + endpoint `POST /expenses/import`.

### 6. 🔲 Presupuesto por categoría dentro del proyecto
Sub-presupuestos por categoría con alertas cuando se acerca al límite.
- Modelo `ProjectCategoryBudget` (projectId, categoryId, budget)
- Widget en detalle de proyecto

### 7. 🔲 Duplicar orden de pago / gasto recurrente
Botón "Clonar" en órdenes de pago — copia todos los campos, cambia fecha a hoy.
Frontend only (+ llamada POST con los datos pre-llenados).

### 8. 🔲 Filtros guardados / vistas personalizadas
Guardar combinación de filtros con nombre. Persistir en `localStorage` o en BD.
Aplica a: `ExpensesPage`, `PaymentOrdersPage`.

---

## 🟢 CALIDAD DE DATOS

### 9. 🔲 Detección de gastos duplicados
Al guardar gasto: verificar mismo proveedor + monto + fecha ±3 días → warning (no bloquea).
Backend: `GET /expenses/check-duplicate?supplierId=&amount=&date=`
Frontend: llamar en `onSubmit` antes de confirmar.

### 10. 🔲 Validación de presupuesto en tiempo real
Al ingresar monto en formulario de gasto, mostrar inline:
"Presupuesto disponible: RD$ X — quedaría RD$ Y después de este gasto."
Frontend only: usar query `projectBalance` que ya existe.

### 11. 🔲 Estado de órdenes de pago más granular
Agregar estados: `EN_PROCESO` (transferencia iniciada), `RECHAZADA` (banco rechazó).
- Migration: ampliar enum `PaymentOrderStatus`
- UI: badge nuevo color (azul para EN_PROCESO, naranja para RECHAZADA)

---

## 📊 REPORTES

### 12. 🔲 Reporte de varianza presupuesto vs. ejecución
Por proyecto: presupuesto estimado vs. gastado vs. comprometido (órdenes pendientes).
Exportable a Excel. Endpoint: `GET /reports/variance?projectId=`

### 13. 🔲 Dashboard ejecutivo multi-proyecto
Vista portafolio para admin: tabla de todos los proyectos con semáforo presupuestal.
Semáforo: verde <70%, amarillo 70-90%, rojo >90%.

---

## Orden de ejecución sugerido
1. ~~Fix fechas~~ ✅
2. Dashboard de alertas accionables (#2)
3. Detección duplicados (#9) — complementa fix de fechas
4. Validación presupuesto en tiempo real (#10)
5. Aprobación de gastos en dos pasos (#3)
6. Historial de cambios (#4)
7. Estado órdenes más granular (#11)
8. Reporte de varianza (#12)
9. Resto del backlog...
