-- ========================================================
-- CONSOLIDACIÓN DE CATEGORÍAS DE GASTOS
-- ========================================================
-- Este script consolida categorías duplicadas y normaliza
-- nombres para asegurar consistencia en los reportes.

-- Step 1: Ensure target categories exist (create if missing)
-- ========================================================

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'VIÁTICOS', 'Gastos de viáticos y alimentación', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'VIÁTICOS');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'CAJA CHICA', 'Caja chica para gastos menores', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'CAJA CHICA');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'HERRAMIENTAS', 'Herramientas de trabajo', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'HERRAMIENTAS');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'MANO DE OBRA', 'Mano de obra y servicios de personal', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'MANO DE OBRA');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'MATERIALES', 'Materiales de construcción y suministros', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'MATERIALES');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'OTROS', 'Otros gastos no categorizados', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'OTROS');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'SERVICIO', 'Servicios profesionales y contrataciones', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'SERVICIO');

INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
SELECT 'LOGISTICA', 'Gastos de logística y transporte', true, true, NOW()
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'LOGISTICA');

-- Step 2: Consolidate Viáticos → ALIMENTACIÓN
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS')
WHERE category_id IN (SELECT id FROM expense_categories WHERE name = 'Viáticos' OR name = 'Viaticos');

-- Step 3: Consolidate Caja chica variants → CAJA CHICA
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'CAJA CHICA')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) IN (LOWER('Caja chica'), LOWER('caja chica'))
  AND name != 'CAJA CHICA'
);

-- Step 4: Consolidate Herramientas variants → HERRAMIENTAS
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'HERRAMIENTAS')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) IN (LOWER('Herramientas'), LOWER('herramientas'))
  AND name != 'HERRAMIENTAS'
);

-- Step 5: Consolidate MO variants → MANO DE OBRA
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'MANO DE OBRA')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE name = 'MO'
     OR name LIKE '%Mano de obra%'
     OR name LIKE '%mano de obra%'
  AND name != 'MANO DE OBRA'
);

-- Step 6: Consolidate Materiales variants → MATERIALES
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'MATERIALES')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) = LOWER('Materiales')
  AND name != 'MATERIALES'
);

-- Step 7: Consolidate Otros variants → OTROS
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'OTROS')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) = LOWER('Otros')
  AND name != 'OTROS'
);

-- Step 8: Consolidate Servicios variants → SERVICIO
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'SERVICIO')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) IN (LOWER('Servicios'), LOWER('Servicio'))
  AND name != 'SERVICIO'
);

-- Step 9: Consolidate Logística variants → LOGISTICA
-- ========================================================
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'LOGISTICA')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) IN (LOWER('Logística'), LOWER('Logistica'))
  AND name != 'LOGISTICA'
);

-- Step 10: Delete all duplicate/old category entries
-- ========================================================
DELETE FROM expense_categories
WHERE id NOT IN (
  SELECT id FROM expense_categories
  WHERE name IN (
    'VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA',
    'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA'
  )
)
AND is_system = false;

-- Step 11: Verify the consolidation - count expenses per category
-- ========================================================
SELECT
  ec.name as category_name,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
WHERE ec.id IN (SELECT id FROM expense_categories WHERE name IN (
  'VIÁTICOS', 'CAJA CHICA', 'HERRAMIENTAS', 'MANO DE OBRA',
  'MATERIALES', 'OTROS', 'SERVICIO', 'LOGISTICA'
))
GROUP BY ec.id, ec.name
ORDER BY expense_count DESC;
