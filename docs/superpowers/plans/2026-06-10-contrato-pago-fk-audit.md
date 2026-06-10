# ContratoAjustadoPago FK Relations — Audit + Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper Prisma @relation declarations to ContratoAjustadoPago for ordenPagoId, nominaId, gastoId, and creadoPorId — with a data audit to detect and clean orphaned records before applying FK constraints.

**Architecture:** Audit-first: run SQL queries to detect orphans, clean if found, then add @relation declarations and migrate. No data structure changes — same columns, same data, just FK enforcement added.

**Tech Stack:** Prisma ORM, PostgreSQL, psql / prisma db execute

---

## Task 1 — Data Audit (SQL queries, no schema changes)

**Purpose:** Detect orphaned records in `contrato_ajustado_pagos` before adding FK constraints. If orphans exist they must be NULLed out first; otherwise the migration will fail with a foreign key violation.

### How to connect

Option A — psql direct:
```bash
psql $DATABASE_URL
```

Option B — Prisma db execute (one statement at a time):
```bash
npx prisma db execute --stdin <<'SQL'
-- paste query here
SQL
```

---

### Step 1.1 — Baseline counts

Run first to understand the dataset size and field population.

```sql
SELECT
  COUNT(*)                                          AS total_pagos,
  COUNT(orden_pago_id)                              AS con_orden_pago,
  COUNT(nomina_id)                                  AS con_nomina,
  COUNT(gasto_id)                                   AS con_gasto,
  COUNT(creado_por)                                 AS con_creado_por
FROM contrato_ajustado_pagos;
```

**What the output means:**
- `total_pagos` = total rows in the table.
- The other columns = how many rows have each FK field populated (non-NULL).
- A count of 0 for a field means no rows use it → migration is safe for that FK with no cleanup needed.

---

### Step 1.2 — Orphan audit: ordenPagoId → payment_orders

```sql
SELECT cap.id, cap.orden_pago_id
FROM contrato_ajustado_pagos cap
WHERE cap.orden_pago_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payment_orders po WHERE po.id = cap.orden_pago_id
  );
```

**What the output means:**
- Zero rows → no orphans; safe to add FK.
- One or more rows → orphaned `orden_pago_id` values that point to non-existent payment orders. Run cleanup SQL below before migrating.

**Cleanup if orphans found:**
```sql
UPDATE contrato_ajustado_pagos
SET orden_pago_id = NULL
WHERE orden_pago_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payment_orders po WHERE po.id = orden_pago_id
  );
```

---

### Step 1.3 — Orphan audit: nominaId → payrolls

```sql
SELECT cap.id, cap.nomina_id
FROM contrato_ajustado_pagos cap
WHERE cap.nomina_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payrolls p WHERE p.id = cap.nomina_id
  );
```

**What the output means:**
- Zero rows → no orphans; safe to add FK.
- One or more rows → orphaned `nomina_id` values pointing to non-existent payrolls. Run cleanup SQL below before migrating.

**Cleanup if orphans found:**
```sql
UPDATE contrato_ajustado_pagos
SET nomina_id = NULL
WHERE nomina_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payrolls p WHERE p.id = nomina_id
  );
```

---

### Step 1.4 — Orphan audit: gastoId → expenses

```sql
SELECT cap.id, cap.gasto_id
FROM contrato_ajustado_pagos cap
WHERE cap.gasto_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = cap.gasto_id
  );
```

**What the output means:**
- Zero rows → no orphans; safe to add FK.
- One or more rows → orphaned `gasto_id` values pointing to non-existent expenses. Run cleanup SQL below before migrating.

**Cleanup if orphans found:**
```sql
UPDATE contrato_ajustado_pagos
SET gasto_id = NULL
WHERE gasto_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = gasto_id
  );
```

---

### Step 1.5 — Orphan audit: creadoPorId → users

Note: `creadoPorId` is NOT NULL (required field), so orphans here cannot be NULLed — they would have to be deleted or re-pointed to a valid user. This audit is critical.

```sql
SELECT cap.id, cap.creado_por
FROM contrato_ajustado_pagos cap
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = cap.creado_por
  );
```

**What the output means:**
- Zero rows → no orphans; safe to add FK.
- One or more rows → **BLOCKER**: these rows have a `creado_por` value that doesn't match any user. Because the field is required (NOT NULL), you cannot NULL it out. Options:
  1. Delete the orphaned pago rows (if they are stale/test data).
  2. Re-point `creado_por` to a valid admin user id.

  Find a valid admin user id to use in option 2:
  ```sql
  SELECT id, name, email FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'admin') LIMIT 1;
  ```

  Then update:
  ```sql
  UPDATE contrato_ajustado_pagos
  SET creado_por = '<valid-user-uuid>'
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = creado_por);
  ```

  Or delete:
  ```sql
  DELETE FROM contrato_ajustado_pagos
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = creado_por);
  ```

---

### Step 1.6 — Confirm all clear before proceeding

After running any cleanup, re-run all four orphan queries (Steps 1.2–1.5). All must return zero rows before proceeding to Task 2.

- [ ] Step 1.2 returns 0 rows
- [ ] Step 1.3 returns 0 rows
- [ ] Step 1.4 returns 0 rows
- [ ] Step 1.5 returns 0 rows

---

## Task 2 — Add Prisma Relations + Migrate

**Pre-condition:** Task 1 is complete and all orphan queries return 0 rows.

### Step 2.1 — Edit schema.prisma: add relations to ContratoAjustadoPago

File: `apps/backend/prisma/schema.prisma`

In the `ContratoAjustadoPago` model, replace the closing `@@index` / `@@map` block with the updated version that includes the four new relation fields:

**Current model (lines 981–997):**
```prisma
model ContratoAjustadoPago {
  id                 String   @id @default(uuid()) @db.Uuid
  contratoAjustadoId String   @map("contrato_ajustado_id") @db.Uuid
  ordenPagoId        String?  @map("orden_pago_id") @db.Uuid
  nominaId           String?  @map("nomina_id") @db.Uuid
  gastoId            String?  @map("gasto_id") @db.Uuid
  monto              Decimal  @db.Decimal(15, 2)
  fecha              DateTime @db.Date
  creadoPorId        String   @map("creado_por") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")

  contratoAjustado ContratoAjustado @relation(fields: [contratoAjustadoId], references: [id], onDelete: Cascade)

  @@index([contratoAjustadoId])
  @@index([gastoId])
  @@map("contrato_ajustado_pagos")
}
```

**New model (add the 4 relation lines after the existing `contratoAjustado` relation):**
```prisma
model ContratoAjustadoPago {
  id                 String   @id @default(uuid()) @db.Uuid
  contratoAjustadoId String   @map("contrato_ajustado_id") @db.Uuid
  ordenPagoId        String?  @map("orden_pago_id") @db.Uuid
  nominaId           String?  @map("nomina_id") @db.Uuid
  gastoId            String?  @map("gasto_id") @db.Uuid
  monto              Decimal  @db.Decimal(15, 2)
  fecha              DateTime @db.Date
  creadoPorId        String   @map("creado_por") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")

  contratoAjustado ContratoAjustado @relation(fields: [contratoAjustadoId], references: [id], onDelete: Cascade)
  ordenPago        PaymentOrder?    @relation("ContratoAjustadoPagoOrdenPago", fields: [ordenPagoId], references: [id], onDelete: SetNull)
  nomina           Payroll?         @relation("ContratoAjustadoPagoNomina",    fields: [nominaId],    references: [id], onDelete: SetNull)
  gasto            Expense?         @relation("ContratoAjustadoPagoGasto",     fields: [gastoId],     references: [id], onDelete: SetNull)
  creadoPor        User             @relation("ContratoAjustadoPagoCreadoPor", fields: [creadoPorId], references: [id])

  @@index([contratoAjustadoId])
  @@index([gastoId])
  @@index([ordenPagoId])
  @@index([nominaId])
  @@index([creadoPorId])
  @@map("contrato_ajustado_pagos")
}
```

- [ ] `ContratoAjustadoPago` model updated

---

### Step 2.2 — Add inverse relations on PaymentOrder

In the `PaymentOrder` model, add one line to the relations block (after the existing `quotation` relation):

```prisma
  contratoAjustadoPagos ContratoAjustadoPago[] @relation("ContratoAjustadoPagoOrdenPago")
```

- [ ] `PaymentOrder` model updated

---

### Step 2.3 — Add inverse relations on Payroll

In the `Payroll` model, add one line to the relations block (after the existing `lines` relation):

```prisma
  contratoAjustadoPagos ContratoAjustadoPago[] @relation("ContratoAjustadoPagoNomina")
```

- [ ] `Payroll` model updated

---

### Step 2.4 — Add inverse relations on Expense

In the `Expense` model, add one line to the relations block (after the existing `paymentOrder` relation):

```prisma
  contratoAjustadoPagos ContratoAjustadoPago[] @relation("ContratoAjustadoPagoGasto")
```

- [ ] `Expense` model updated

---

### Step 2.5 — Add inverse relation on User

In the `User` model, add one line to the relations block (after the existing `contratoAdendas` relation):

```prisma
  contratoAjustadoPagosCreadoPor ContratoAjustadoPago[] @relation("ContratoAjustadoPagoCreadoPor")
```

- [ ] `User` model updated

---

### Step 2.6 — Validate schema with Prisma

```bash
cd /home/user/servingmi-appCG
npx prisma validate --schema apps/backend/prisma/schema.prisma
```

Expected: no errors. Fix any relation naming conflicts before proceeding.

- [ ] `prisma validate` passes with no errors

---

### Step 2.7 — Generate Prisma client

```bash
pnpm db:generate
```

- [ ] Prisma client generated successfully

---

### Step 2.8 — Create and run migration

```bash
pnpm db:migrate
```

When prompted for a migration name, enter: `add_contrato_ajustado_pago_fk_relations`

This will:
1. Generate a new migration file in `apps/backend/prisma/migrations/`
2. Apply it to the database, adding the FK constraints with `ON DELETE SET NULL` for the optional fields and default behavior for `creadoPor`

- [ ] Migration applied successfully

---

### Step 2.9 — Build backend to verify TypeScript compiles

```bash
pnpm build:backend
```

Expected: exits with code 0, no TypeScript errors. If errors appear they will likely be in service/controller files that construct or query `ContratoAjustadoPago` — update those to use the new relation fields where needed.

- [ ] `pnpm build:backend` succeeds with no errors

---

### Step 2.10 — Commit and push

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat: add Prisma FK relations to ContratoAjustadoPago (ordenPago, nomina, gasto, creadoPor)"
git push origin main
```

- [ ] Changes committed and pushed to main

---

## Summary of table/model mappings used

| Prisma model     | DB table                   |
|------------------|---------------------------|
| ContratoAjustadoPago | `contrato_ajustado_pagos` |
| PaymentOrder     | `payment_orders`           |
| Payroll          | `payrolls`                 |
| Expense          | `expenses`                 |
| User             | `users`                    |
