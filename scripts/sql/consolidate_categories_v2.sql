-- ========================================================
-- CONSOLIDACIÓN DE CATEGORÍAS DE GASTOS (V2)
-- Manejo seguro de constraints de foreign key
-- ========================================================

-- Step 1: Create standardized categories if they don't exist
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

-- Step 2: Get the ID of standardized categories for reference
-- ========================================================
-- First, reassign all expenses to standardized categories

-- Viáticos → ALIMENTACIÓN
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS' LIMIT 1)
WHERE category_id IN (SELECT id FROM expense_categories WHERE LOWER(name) IN ('viáticos', 'viaticos') AND name != 'VIÁTICOS');

-- Caja chica variants → CAJA CHICA
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'CAJA CHICA' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) = 'caja chica'
  AND name != 'CAJA CHICA'
);

-- Herramientas variants → HERRAMIENTAS
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'HERRAMIENTAS' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) = 'herramientas'
  AND name != 'HERRAMIENTAS'
);

-- MO and other Mano de obra variants → MANO DE OBRA
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'MANO DE OBRA' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE (name = 'MO' OR LOWER(name) LIKE '%mano de obra%' OR LOWER(name) LIKE '%mano_de_obra%')
  AND name != 'MANO DE OBRA'
);

-- Materiales variants → MATERIALES
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'MATERIALES' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) = 'materiales'
  AND name != 'MATERIALES'
);

-- Otros variants → OTROS
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'OTROS' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) = 'otros'
  AND name != 'OTROS'
);

-- Servicios/Servicio variants → SERVICIO
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'SERVICIO' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) IN ('servicios', 'servicio')
  AND name != 'SERVICIO'
);

-- Logística variants → LOGISTICA
UPDATE expenses SET category_id = (SELECT id FROM expense_categories WHERE name = 'LOGISTICA' LIMIT 1)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(TRIM(name)) IN ('logística', 'logistica')
  AND name != 'LOGISTICA'
);

-- Step 3: Delete all old/duplicate categories
-- Keep only the 8 standardized ones
-- ========================================================
DELETE FROM expense_categories
WHERE name NOT IN (
  'VIÁTICOS',
  'CAJA CHICA',
  'HERRAMIENTAS',
  'MANO DE OBRA',
  'MATERIALES',
  'OTROS',
  'SERVICIO',
  'LOGISTICA'
);

-- Step 4: Verify consolidation results
-- ========================================================
SELECT
  ec.id,
  ec.name as category_name,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
GROUP BY ec.id, ec.name
ORDER BY expense_count DESC;
