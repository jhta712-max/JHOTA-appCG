-- ============================================================
-- Migration: Add FK constraints to contrato_ajustado_pagos
-- Includes orphan cleanup preamble so it is safe to apply
-- even if stale data exists.
-- ============================================================

-- Step 1: Nullify orphaned optional FK references (safe no-ops if DB is clean)
UPDATE contrato_ajustado_pagos
SET orden_pago_id = NULL
WHERE orden_pago_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_orders po WHERE po.id = orden_pago_id);

UPDATE contrato_ajustado_pagos
SET nomina_id = NULL
WHERE nomina_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payrolls p WHERE p.id = nomina_id);

UPDATE contrato_ajustado_pagos
SET gasto_id = NULL
WHERE gasto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = gasto_id);

-- Step 2: Fix orphaned creado_por (re-point to oldest user)
-- This only fires if there are rows whose creado_por no longer exists in users.
UPDATE contrato_ajustado_pagos
SET creado_por = (SELECT id FROM users ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = creado_por);

-- Step 3: Add FK constraints
ALTER TABLE "contrato_ajustado_pagos"
  ADD CONSTRAINT "contrato_ajustado_pagos_orden_pago_id_fkey"
  FOREIGN KEY ("orden_pago_id") REFERENCES "payment_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contrato_ajustado_pagos"
  ADD CONSTRAINT "contrato_ajustado_pagos_nomina_id_fkey"
  FOREIGN KEY ("nomina_id") REFERENCES "payrolls"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contrato_ajustado_pagos"
  ADD CONSTRAINT "contrato_ajustado_pagos_gasto_id_fkey"
  FOREIGN KEY ("gasto_id") REFERENCES "expenses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contrato_ajustado_pagos"
  ADD CONSTRAINT "contrato_ajustado_pagos_creado_por_fkey"
  FOREIGN KEY ("creado_por") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
