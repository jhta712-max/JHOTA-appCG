# Express Suppliers — Design Spec

## Goal

Allow creating one-time vendors ("suplidores express") quickly during payment order creation, without the full registration flow. Express suppliers need only a name and bank details to receive transfers, with optional additional fields saved to the DB.

## Architecture

A single boolean field `isExpress` on the existing `Supplier` model distinguishes express from registered suppliers. No schema changes to `PaymentOrder` — `supplierId` remains a required FK. Express suppliers are real supplier records, just created through a lighter flow.

---

## Data Model

**`schema.prisma` — Supplier model, add one field:**

```prisma
isExpress Boolean @default(false) @map("is_express")
```

All other `Supplier` fields remain unchanged. Optional fields (rnc, cedula, phone, email, notes) are already nullable — they apply to express suppliers too.

**Migration:** `20260617000002_add_is_express_to_suppliers`

---

## Backend

### `POST /suppliers` — existing endpoint
Accept `isExpress: boolean` in the request body. No new endpoint needed. The existing `createSupplierSchema` (Zod) gets `isExpress: z.boolean().optional().default(false)`.

### `GET /suppliers` — existing endpoint
Accept `isExpress: boolean` query param. When `isExpress=false` (default), exclude express suppliers from results. When `isExpress=true`, return only express. This keeps existing callers unaffected (they see only registered suppliers by default).

### `POST /suppliers` + bank account
Express suppliers are created with bank data inline: the backend creates the `Supplier` then immediately creates a `SupplierBankAccount` in the same request if `bank`, `accountType`, `accountNumber` are provided. This mirrors the existing `QuickCreateSupplierModal` two-step, but done server-side in a transaction.

---

## Frontend

### `QuickCreateSupplierModal` — extend with express mode

Prop: `mode: 'registered' | 'express'` (default `'registered'`).

**Express mode fields:**

| Field | Required | Notes |
|---|---|---|
| Nombre | ✅ | |
| Banco | ✅ | |
| Tipo de cuenta | ✅ | Ahorros / Corriente / Nómina |
| Número de cuenta | ✅ | |
| RNC / Cédula | — | Collapsible "Datos adicionales" section |
| Teléfono | — | Same section |
| Email | — | Same section |
| Notas | — | Same section |

"Datos adicionales" section starts collapsed. One tap expands it. All optional fields are saved to DB when provided.

### `PaymentOrdersPage` — two creation buttons

Replace the single `+ Nuevo` button with two:

```
[+ Registrado]   [⚡ Express]
```

- **Registrado** → opens existing `QuickCreateSupplierModal` (mode: 'registered')
- **Express** → opens `QuickCreateSupplierModal` (mode: 'express')

On success, both paths select the new supplier in the form and invalidate the suppliers cache.

### Supplier dropdown in payment orders

Express suppliers appear in the dropdown with a `⚡` prefix on their name:

```
⚡ Juan Pérez (plomero)
Sandy (herrero moca)
```

The existing filter `(s.bankAccounts?.length > 0 || (s.bank && s.accountNumber))` already handles bank account validation — express suppliers with bank data pass through automatically.

### `SuppliersPage` — "Express" tab

Add a second tab alongside "Activos":

- **Activos** — registered suppliers (`isExpress=false`, `isActive=true`) — current behavior
- **Express** — express suppliers (`isExpress=true`) — new tab

Express suppliers do NOT appear in the "Activos" tab. Each express supplier row shows the same actions as registered (view, toggle active, delete).

### `suppliersApi` — update `list` param

```typescript
list: (params?: { search?: string; onlyActive?: boolean; projectId?: string; isExpress?: boolean }) =>
```

Default call (`list()`) continues to return only registered suppliers (backend defaults `isExpress=false`).

---

## Project Assignment

Express suppliers use the same `ProjectSupplier` join table. They appear in the project assignment dropdown with `⚡` prefix. No changes to assignment logic.

---

## Design System Notes

- `⚡` badge: `text-[#F5C218] font-bold` inline before supplier name
- Express tab: same tab style as existing tabs in SuppliersPage
- "Datos adicionales" toggle: `ChevronDown`/`ChevronUp` icon, `text-gray-500 text-xs`
- All modals: `FormModal` component, no rounded corners, `bg-[#1C1C1C]` header
