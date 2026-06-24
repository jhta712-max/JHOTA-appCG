-- ========================================================
-- LIMPIAR GASTOS ANTIGUOS E RE-CONSOLIDAR CATEGORÍAS
-- ========================================================

-- Step 1: Eliminar todos los gastos del proyecto MOPC-CCC-LPN-2021-0036
-- (Los 299 gastos importados anteriormente)
-- ========================================================
DELETE FROM expenses
WHERE project_id = (SELECT id FROM projects WHERE code = 'MOPC-CCC-LPN-2021-0036');

-- Step 2: Eliminar categorías huérfanas (sin gastos)
-- ========================================================
DELETE FROM expense_categories
WHERE NOT EXISTS (SELECT 1 FROM expenses e WHERE e.category_id = expense_categories.id)
  AND name NOT IN ('VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA', 'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA');

-- Step 3: Consolidar variantes restantes que hayan quedado
-- ========================================================
-- Consolidar Alimentación/alimentación → ALIMENTACIÓN
UPDATE expenses e
SET category_id = (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS' LIMIT 1)
WHERE e.category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) = 'alimentación' AND name != 'VIÁTICOS'
);

-- Consolidar Combustible → MATERIALES (si quedan)
UPDATE expenses e
SET category_id = (SELECT id FROM expense_categories WHERE name = 'MATERIALES' LIMIT 1)
WHERE e.category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) = 'combustible'
);

-- Step 4: Eliminar categorías duplicadas/viejas sin gastos
-- ========================================================
DELETE FROM expense_categories
WHERE NOT EXISTS (SELECT 1 FROM expenses e WHERE e.category_id = expense_categories.id)
  AND name NOT IN ('VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA', 'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA');

-- Step 5: Verificación final
-- ========================================================
SELECT '=== GASTOS POR CATEGORÍA ===' as status;
SELECT
  ec.id,
  ec.name as category_name,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
GROUP BY ec.id, ec.name
ORDER BY expense_count DESC;

SELECT '' as blank;
SELECT '=== VERIFICACIÓN ===' as status;
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM expenses WHERE project_id = (SELECT id FROM projects WHERE code = 'MOPC-CCC-LPN-2021-0036')) = 0
    THEN 'OK: No hay gastos del proyecto MOPC-CCC-LPN-2021-0036'
    ELSE 'ERROR: Aún hay gastos del proyecto'
  END as project_status,
  (SELECT COUNT(*) FROM expense_categories) as total_categories,
  (SELECT COUNT(*) FROM expenses) as total_expenses;
