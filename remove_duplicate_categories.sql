-- ========================================================
-- ELIMINAR CATEGORÍAS DUPLICADAS/ANTIGUAS
-- ========================================================

-- Consolidar Alimentación (personalizada) → ALIMENTACIÓN (sistema)
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'ALIMENTACIÓN' AND is_system = true)
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE name = 'Alimentación' AND is_system = false
);

-- Consolidar Combustible → MATERIALES
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'MATERIALES')
WHERE category_id IN (
  SELECT id FROM expense_categories
  WHERE name = 'Combustible'
);

-- Eliminar categorías duplicadas/antiguas
DELETE FROM expense_categories
WHERE (name = 'Alimentación' AND is_system = false)
   OR (name = 'Combustible');

-- Verificación final
SELECT
  ec.id,
  ec.name,
  ec.is_system,
  COUNT(e.id) as expense_count
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
GROUP BY ec.id, ec.name, ec.is_system
ORDER BY is_system DESC, expense_count DESC;
