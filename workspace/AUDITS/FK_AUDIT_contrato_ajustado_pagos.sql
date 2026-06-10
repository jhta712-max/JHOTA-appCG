-- ============================================================
-- AUDIT: contrato_ajustado_pagos FK orphan check
-- Run against the live DB before adding FK constraints.
-- Generated: 2026-06-10
-- ============================================================

-- Step 1: Baseline counts
SELECT
  COUNT(*)               AS total_pagos,
  COUNT(orden_pago_id)   AS con_orden_pago,
  COUNT(nomina_id)       AS con_nomina,
  COUNT(gasto_id)        AS con_gasto,
  COUNT(creado_por)      AS con_creado_por
FROM contrato_ajustado_pagos;

-- Step 2a: ordenPagoId orphans
SELECT cap.id, cap.orden_pago_id
FROM contrato_ajustado_pagos cap
WHERE cap.orden_pago_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_orders po WHERE po.id = cap.orden_pago_id);

-- Step 2b: nominaId orphans
SELECT cap.id, cap.nomina_id
FROM contrato_ajustado_pagos cap
WHERE cap.nomina_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payrolls p WHERE p.id = cap.nomina_id);

-- Step 2c: gastoId orphans
SELECT cap.id, cap.gasto_id
FROM contrato_ajustado_pagos cap
WHERE cap.gasto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = cap.gasto_id);

-- Step 2d: creadoPor orphans (critical — NOT NULL field)
SELECT cap.id, cap.creado_por
FROM contrato_ajustado_pagos cap
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cap.creado_por);

-- ============================================================
-- CLEANUP (run only if orphans found above)
-- ============================================================

-- Clean orphaned orden_pago_id
UPDATE contrato_ajustado_pagos SET orden_pago_id = NULL
WHERE orden_pago_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_orders po WHERE po.id = orden_pago_id);

-- Clean orphaned nomina_id
UPDATE contrato_ajustado_pagos SET nomina_id = NULL
WHERE nomina_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payrolls p WHERE p.id = nomina_id);

-- Clean orphaned gasto_id
UPDATE contrato_ajustado_pagos SET gasto_id = NULL
WHERE gasto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = gasto_id);

-- Fix orphaned creado_por (re-point to first valid admin user)
-- First find a valid user: SELECT id FROM users ORDER BY created_at LIMIT 1;
-- Then:
-- UPDATE contrato_ajustado_pagos SET creado_por = '<valid-user-uuid>'
-- WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = creado_por);
