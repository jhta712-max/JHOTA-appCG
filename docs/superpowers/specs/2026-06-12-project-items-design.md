# Project Items — Spec de diseño

**Fecha:** 2026-06-12
**Objetivo:** Identificar a qué "item" (partida/lote) de un proyecto pertenece cada gasto, con el dato fluyendo automáticamente por todo el ciclo (cotización/nómina → orden de pago → gasto).

## Contexto

Proyectos de licitación (ej. MOPC-CCC-LPN-2021-0036) contienen varios items. Hoy los gastos solo se vinculan al proyecto, sin distinguir el item que los genera.

## Decisiones (aprobadas por el usuario)

1. **Items = solo identificación** — número + nombre, sin presupuesto propio.
2. **Obligatorio si el proyecto tiene items activos** — el backend rechaza crear orden de pago / gasto / nómina / cotización sin `projectItemId` cuando el proyecto tiene ≥1 item activo. Nullable en BD (histórico sin item).
3. **Alcance completo:** PaymentOrder, Expense, Payroll, Quotation.

## Modelo de datos

```prisma
model ProjectItem {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  number    Int                       // autoincremental por proyecto
  name      String   @db.VarChar(300)
  active    Boolean  @default(true)   // desactivar sin borrar histórico
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  project       Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  expenses      Expense[]
  paymentOrders PaymentOrder[]
  payrolls      Payroll[]
  quotations    Quotation[]

  @@unique([projectId, number])
  @@index([projectId])
  @@map("project_items")
}
```

FK `projectItemId String? @map("project_item_id") @db.Uuid` con `onDelete: SetNull` en: `Expense`, `PaymentOrder`, `Payroll`, `Quotation` (+ índice).

## Reglas de negocio

- **Validación al crear:** si `project.items.some(active)` y no llega `projectItemId` → 400 `PROJECT_ITEM_REQUIRED`. Si llega un item que no pertenece al proyecto o está inactivo → 400 `INVALID_PROJECT_ITEM`.
- **Herencia automática (continuidad):**
  - Orden de pago creada desde nómina → hereda `projectItemId` de la nómina.
  - Orden de pago creada desde cotización → hereda de la cotización.
  - Gasto generado desde orden de pago → hereda de la orden.
  - Gasto generado desde nómina/cotización (pago) → hereda de la fuente.
  - Si la fuente trae item, no se exige re-selección.
- **Edición:** items se pueden renombrar y desactivar; no se borran si tienen registros vinculados (la FK es SetNull, pero la UI solo ofrece desactivar).

## API

En el módulo `projects`:
- `GET    /projects/:id/items` — lista (incluye inactivos con flag)
- `POST   /projects/:id/items` — crear `{ name }` (number autoincremental) — admin/supervisor
- `PATCH  /projects/:id/items/:itemId` — `{ name?, active? }` — admin/supervisor

Los endpoints de creación de expenses/payment-orders/payrolls/quotations aceptan `projectItemId` opcional y aplican las reglas.

## Frontend

1. **ProjectDetailPage:** sección "Items del Proyecto" (tabla número + nombre + estado, modal FormModal para crear/editar, toggle activo). Visible para todos, editable admin/supervisor.
2. **Formularios** (gasto, orden de pago, nómina, cotización): al elegir proyecto se cargan sus items; si hay items activos se muestra select "Item del proyecto" requerido. Si no hay, no se muestra.
3. **Badges:** en listas/detalles mostrar `ITEM N` en Space Mono con borde, junto al proyecto.
4. **Herencia:** formularios que parten de una fuente con item lo muestran como solo-lectura.

## Fuera de alcance

- Presupuesto por item, reportes desglosados por item (data queda lista).
