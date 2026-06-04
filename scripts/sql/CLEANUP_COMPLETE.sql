-- LIMPIEZA COMPLETA: Elimina TODOS los datos de batches, items y gastos
-- Ejecutar DENTRO de una transacción y hacer COMMIT explícito

BEGIN;

-- 1. Eliminar todos los gastos primero (foraneKey depende de batch_items)
DELETE FROM expenses WHERE id IS NOT NULL;

-- 2. Eliminar todos los items del lote
DELETE FROM batch_items WHERE id IS NOT NULL;

-- 3. Eliminar todos los lotes
DELETE FROM batches WHERE id IS NOT NULL;

-- Verificar que se eliminó todo
SELECT
  (SELECT COUNT(*) FROM expenses) as expenses_count,
  (SELECT COUNT(*) FROM batch_items) as batch_items_count,
  (SELECT COUNT(*) FROM batches) as batches_count;

-- ⚠️ IMPORTANTE: Ejecutar COMMIT solo si todo salió bien
-- COMMIT;

-- Si hay error, hacer ROLLBACK;
-- ROLLBACK;
