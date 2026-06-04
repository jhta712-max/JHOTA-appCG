-- Script para limpiar datos de importación anterior
-- ESTE SCRIPT DEBE EJECUTARSE SOLO EN LA BD DE RENDER

-- Variables (cambiar según necesario)
SET @project_code = 'MOPC-CCC-LPN-2021-0036';
SET @batch_code = 'MOPC-CCC-LPN-2021-0036';

-- 1. Obtener IDs necesarios
SELECT @project_id := id FROM public."Project" WHERE code = @project_code LIMIT 1;
SELECT @batch_id := id FROM public."Batch" WHERE code = @batch_code AND "projectId" = @project_id LIMIT 1;

-- 2. Eliminar gastos vinculados a los items del batch
DELETE FROM public."Expense" 
WHERE "batchItemId" IN (
  SELECT id FROM public."BatchItem" WHERE "batchId" = @batch_id
);

-- 3. Eliminar items del batch
DELETE FROM public."BatchItem" WHERE "batchId" = @batch_id;

-- 4. Eliminar el batch
DELETE FROM public."Batch" WHERE id = @batch_id;

-- 5. Verificar que el proyecto aún existe
SELECT id, code, name FROM public."Project" WHERE code = @project_code;

-- 6. Reportar resultado
SELECT 
  'Limpieza completada' as status,
  COUNT(*) as expenses_deleted
FROM public."Expense" 
WHERE "batchItemId" IS NULL AND "projectId" = @project_id;
