# Payment Orders — Tipo OFFICE (Gasto de Oficina) Design

## Goal

Agregar un nuevo tipo de orden de pago `OFFICE` que, al marcarse como pagada, genera automáticamente un `OfficeExpense` en lugar de un `Expense` de proyecto. Las órdenes OFFICE no requieren proyecto y el proveedor es opcional (FK registrado o nombre libre).

## Architecture

El cambio es una extensión del flujo `markAsPaid()` existente. Se agrega una rama nueva para `orderType === 'OFFICE'` sin tocar las ramas SERVICIO, PAYROLL, MATERIALS ni PETTY_CASH. Los cambios se concentran en:

1. **Schema** — dos campos existentes se vuelven nullable + tres campos nuevos
2. **Backend** — validación y rama en `markAsPaid()`
3. **Frontend** — formulario condicional y label en lista

## Data Model Changes

### `PaymentOrder` — campos modificados

| Campo | Antes | Después | Motivo |
|---|---|---|---|
| `projectId` | `String` (required) | `String?` (nullable) | OFFICE no tiene proyecto |
| `supplierId` | `String` (required) | `String?` (nullable) | OFFICE puede usar nombre libre |

### `PaymentOrder` — campos nuevos

| Campo | Tipo | Descripción |
|---|---|---|
| `officeExpenseCategory` | `String?` | Categoría OfficeExpense destino (requerido para OFFICE) |
| `officeSupplierName` | `String? @db.VarChar(200)` | Nombre libre cuando no hay supplierId (solo OFFICE) |
| `officeExpenseId` | `String?` | FK → `office_expenses.id` generado al pagar |

### Migración SQL

```sql
-- Hacer campos nullable
ALTER TABLE "payment_orders" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "payment_orders" ALTER COLUMN "supplier_id" DROP NOT NULL;

-- Nuevos campos
ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "office_expense_category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "office_supplier_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "office_expense_id" TEXT REFERENCES "office_expenses"("id") ON DELETE SET NULL;
```

## Backend

### Validación (payment-orders.service.ts o router)

**Para `orderType === 'OFFICE'`:**
- `projectId` → ignorado / no requerido
- `supplierId` → opcional
- Si `supplierId` es null → `officeSupplierName` requerido
- `officeExpenseCategory` → requerido (debe ser valor válido de `OfficeExpenseCategory`)

**Para cualquier otro tipo:**
- `projectId` → requerido (comportamiento actual, sin cambio)
- Comportamiento actual sin modificación

### `markAsPaid()` — rama OFFICE

Cuando `order.orderType === 'OFFICE'` y `order.officeExpenseId === null`:

```typescript
const supplierName = order.supplier?.name ?? order.officeSupplierName ?? null;
const amountDOP = order.currency !== 'RD$'
  ? Number(order.amount) * (order.exchangeRate ?? 1)
  : Number(order.amount);

const officeExpense = await prisma.officeExpense.create({
  data: {
    category: order.officeExpenseCategory as OfficeExpenseCategory,
    description: order.concept,
    amount: new Decimal(amountDOP),
    itbisAmount: new Decimal(0),
    expenseDate: paidAt,
    paymentMethod: paymentMethod,
    supplierName: supplierName,
    hasFiscalDoc: order.hasFiscalDoc ?? false,
    fiscalDocNum: order.fiscalDocNum ?? null,
    notes: order.notes
      ? `[Orden de pago #${order.number}] ${order.notes}`
      : `Generado desde orden de pago #${order.number}`,
    createdById: paidById,
  },
});

// Guardar FK inversa
await prisma.paymentOrder.update({
  where: { id: order.id },
  data: { officeExpenseId: officeExpense.id },
});
```

Esta rama corre dentro de la misma transacción Prisma que actualiza el estado de la orden.

### `buildExpenseData()` — sin cambios

La función existente no se toca. Solo se llama cuando `orderType !== 'OFFICE'`.

### `generatedText` (WhatsApp)

Para OFFICE, el texto generado incluye: número de orden, concepto, monto, nombre del proveedor (si existe), y categoría de gasto de oficina en español.

## Frontend

### Formulario de nueva/editar orden (`PaymentOrdersPage`)

**Cuando `orderType === 'OFFICE'`:**
- Campo **Proyecto** → oculto (no se envía en el payload)
- Campo **Proveedor** → opcional; el selector FK sigue disponible pero sin asterisco de requerido; aparece campo de texto "Nombre del proveedor" si no se selecciona FK
- Nuevo campo **Categoría de gasto** → selector requerido con las 6 opciones:
  - `CLEANING_SUPPLIES` → "Insumos de Limpieza"
  - `CONSUMABLES` → "Material Gastable"
  - `OFFICE_SERVICES` → "Servicios de Oficina"
  - `BIDDING` → "Licitación"
  - `OFFICE_ASSETS` → "Activos de Oficina"
  - `OTHER` → "Otros Gastos de Oficina"

**Cuando cualquier otro tipo:**
- Campo Proyecto requerido (comportamiento actual)
- Sin cambios

### Lista de órdenes

El tipo se muestra como chip/badge:

| Valor BD | Label visible |
|---|---|
| `SERVICIO` | Servicio |
| `PAYROLL` | Nómina |
| `MATERIALS` | Materiales |
| `PETTY_CASH` | Caja chica |
| `OFFICE` | **Gasto de Oficina** |

### Detalle de orden (si aplica)

Si `officeExpenseId` está presente, mostrar enlace "Ver gasto de oficina →" que navega a `/office-expenses` (o al detalle si existe).

## Constraints

- Las órdenes OFFICE en estado PAID tienen trazabilidad en ambas direcciones: `PaymentOrder.officeExpenseId` → `OfficeExpense`; el campo `notes` del gasto referencia el número de orden.
- No se puede marcar PAID una orden OFFICE sin `officeExpenseCategory`.
- El módulo de gastos de oficina no se modifica — el `OfficeExpense` generado es idéntico a uno creado manualmente.
- Conversión de moneda: si la orden es en USD o EUR, el monto se convierte a DOP usando `exchangeRate` antes de crear el `OfficeExpense` (igual que el flujo de `Expense` actual).
- El campo `hasFiscalDoc` / `fiscalDocNum` ya existe en `PaymentOrder` — se propaga directamente al `OfficeExpense`.
