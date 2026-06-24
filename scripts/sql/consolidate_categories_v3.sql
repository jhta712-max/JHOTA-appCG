-- ========================================================
-- CONSOLIDACIÓN DE CATEGORÍAS V3 - ENFOQUE MÁS ROBUSTO
-- ========================================================

-- Step 0: Ver qué categorías existen actualmente
-- ========================================================
-- SELECT id, name FROM expense_categories ORDER BY id;

-- Step 1: Crear categorías estándar si no existen
-- ========================================================
INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
VALUES
  ('VIÁTICOS', 'Gastos de viáticos y alimentación', true, true, NOW()),
  ('CAJA CHICA', 'Caja chica para gastos menores', true, true, NOW()),
  ('HERRAMIENTAS', 'Herramientas de trabajo', true, true, NOW()),
  ('MANO DE OBRA', 'Mano de obra y servicios de personal', true, true, NOW()),
  ('MATERIALES', 'Materiales de construcción y suministros', true, true, NOW()),
  ('OTROS', 'Otros gastos no categorizados', true, true, NOW()),
  ('SERVICIO', 'Servicios profesionales y contrataciones', true, true, NOW()),
  ('LOGISTICA', 'Gastos de logística y transporte', true, true, NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 2: Crear tabla temporal de mapeo OLD → NEW
-- ========================================================
CREATE TEMP TABLE category_mapping AS
SELECT
  ec.id as old_category_id,
  ec.name as old_name,
  CASE
    WHEN ec.name = 'VIÁTICOS' THEN (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS')
    WHEN ec.name = 'CAJA CHICA' THEN (SELECT id FROM expense_categories WHERE name = 'CAJA CHICA')
    WHEN ec.name = 'HERRAMIENTAS' THEN (SELECT id FROM expense_categories WHERE name = 'HERRAMIENTAS')
    WHEN ec.name = 'MANO DE OBRA' THEN (SELECT id FROM expense_categories WHERE name = 'MANO DE OBRA')
    WHEN ec.name = 'MATERIALES' THEN (SELECT id FROM expense_categories WHERE name = 'MATERIALES')
    WHEN ec.name = 'OTROS' THEN (SELECT id FROM expense_categories WHERE name = 'OTROS')
    WHEN ec.name = 'SERVICIO' THEN (SELECT id FROM expense_categories WHERE name = 'SERVICIO')
    WHEN ec.name = 'LOGISTICA' THEN (SELECT id FROM expense_categories WHERE name = 'LOGISTICA')
    -- Mapeos específicos para variantes
    WHEN LOWER(ec.name) IN ('viáticos', 'viaticos') THEN (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS')
    WHEN LOWER(TRIM(ec.name)) = 'caja chica' AND ec.name != 'CAJA CHICA' THEN (SELECT id FROM expense_categories WHERE name = 'CAJA CHICA')
    WHEN LOWER(TRIM(ec.name)) = 'herramientas' AND ec.name != 'HERRAMIENTAS' THEN (SELECT id FROM expense_categories WHERE name = 'HERRAMIENTAS')
    WHEN ec.name = 'MO' THEN (SELECT id FROM expense_categories WHERE name = 'MANO DE OBRA')
    WHEN LOWER(ec.name) LIKE '%mano de obra%' AND ec.name != 'MANO DE OBRA' THEN (SELECT id FROM expense_categories WHERE name = 'MANO DE OBRA')
    WHEN LOWER(TRIM(ec.name)) = 'materiales' AND ec.name != 'MATERIALES' THEN (SELECT id FROM expense_categories WHERE name = 'MATERIALES')
    WHEN LOWER(TRIM(ec.name)) = 'otros' AND ec.name != 'OTROS' THEN (SELECT id FROM expense_categories WHERE name = 'OTROS')
    WHEN LOWER(TRIM(ec.name)) IN ('servicios', 'servicio') AND ec.name != 'SERVICIO' THEN (SELECT id FROM expense_categories WHERE name = 'SERVICIO')
    WHEN LOWER(TRIM(ec.name)) IN ('logística', 'logistica') AND ec.name != 'LOGISTICA' THEN (SELECT id FROM expense_categories WHERE name = 'LOGISTICA')
    ELSE NULL
  END as new_category_id
FROM expense_categories ec
WHERE ec.name NOT IN ('VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA', 'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA');

-- Step 3: Aplicar el mapeo a los gastos
-- ========================================================
UPDATE expenses e
SET category_id = cm.new_category_id
FROM category_mapping cm
WHERE e.category_id = cm.old_category_id
  AND cm.new_category_id IS NOT NULL;

-- Step 4: Verificar que no quedan categorías huérfanas
-- ========================================================
-- Mostrar categorías sin gastos asignados (que pueden ser eliminadas)
SELECT ec.id, ec.name, COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
WHERE ec.name NOT IN ('VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA', 'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA')
GROUP BY ec.id, ec.name
HAVING COUNT(e.id) = 0;

-- Step 5: Eliminar categorías antiguas/duplicadas que no tienen gastos
-- ========================================================
DELETE FROM expense_categories ec
WHERE ec.name NOT IN ('VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA', 'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA')
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.category_id = ec.id);

-- Step 6: Resultado final - Conteo de gastos por categoría
-- ========================================================
SELECT
  ec.id,
  ec.name as category_name,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
GROUP BY ec.id, ec.name
ORDER BY expense_count DESC;
