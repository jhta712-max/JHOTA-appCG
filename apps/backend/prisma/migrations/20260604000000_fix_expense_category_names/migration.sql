-- Fix auto-created expense categories with wrong casing/names
-- Reassign expenses from wrong categories to the correct seed categories,
-- then delete the incorrect ones if they're now empty.

-- 1. Ensure the correct categories exist
INSERT INTO expense_categories (name, description, is_active, is_system)
VALUES
  ('Materiales', 'Compra de materiales de construcción y suministros', true, true),
  ('Servicios',  'Servicios contratados externos', true, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Migrate expenses from wrong category names to correct ones
UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'Materiales')
WHERE category_id IN (SELECT id FROM expense_categories WHERE name IN ('MATERIALES', 'Materiales construccion', 'materiales'));

UPDATE expenses
SET category_id = (SELECT id FROM expense_categories WHERE name = 'Servicios')
WHERE category_id IN (SELECT id FROM expense_categories WHERE name IN ('SERVICIO', 'SERVICIOS', 'servicios'));

-- 3. Remove now-empty wrong categories
DELETE FROM expense_categories
WHERE name IN ('MATERIALES', 'SERVICIO', 'SERVICIOS', 'MANO DE OBRA')
  AND NOT EXISTS (SELECT 1 FROM expenses WHERE category_id = expense_categories.id)
  AND NOT EXISTS (SELECT 1 FROM quotations WHERE category_id = expense_categories.id);
