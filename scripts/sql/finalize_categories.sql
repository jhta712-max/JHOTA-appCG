-- ========================================================
-- FINALIZAR CATEGORÍAS - AGREGAR COMBUSTIBLE COMO SISTEMA
-- ========================================================

-- Step 1: Agregar Combustible como categoría del sistema si no existe
-- ========================================================
INSERT INTO expense_categories (name, description, is_active, is_system, created_at)
VALUES ('COMBUSTIBLE', 'Gasoil, gasolina y combustibles para proyectos', true, true, NOW())
ON CONFLICT (name) DO UPDATE
SET is_system = true, description = 'Gasoil, gasolina y combustibles para proyectos'
WHERE expense_categories.name = 'COMBUSTIBLE';

-- Step 2: Consolidar "Combustible" (personalizada/antigua) → "COMBUSTIBLE" (sistema)
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'COMBUSTIBLE' AND is_system = true)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE LOWER(name) = 'combustible' AND is_system = false
);

-- Step 3: Consolidar Alimentación (personalizada) → ALIMENTACIÓN (sistema)
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'VIÁTICOS' AND is_system = true)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE name = 'Alimentación' AND is_system = false
);

-- Step 4: Eliminar categorías personalizadas duplicadas
DELETE FROM expense_categories
WHERE (name = 'Alimentación' AND is_system = false)
   OR (name = 'Combustible' AND is_system = false);

-- Step 5: Verificación final - 9 categorías estándar
-- ========================================================
SELECT '=== CATEGORÍAS DEL SISTEMA ===' as status;
SELECT
  ec.id,
  ec.name,
  ec.is_system,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
WHERE ec.is_system = true
GROUP BY ec.id, ec.name, ec.is_system
ORDER BY expense_count DESC;

SELECT '' as blank;
SELECT '=== ESTADO FINAL ===' as status;
SELECT
  COUNT(*) as total_categories,
  SUM(CASE WHEN is_system = true THEN 1 ELSE 0 END) as system_categories,
  (SELECT COUNT(*) FROM expenses) as total_expenses
FROM expense_categories;
