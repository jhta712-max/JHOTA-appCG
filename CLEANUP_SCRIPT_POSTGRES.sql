-- Script para limpiar datos de importación anterior (PostgreSQL)
-- EJECUTAR EN LA BD DE RENDER USANDO psql o pgAdmin

BEGIN;  -- Iniciar transacción para seguridad

-- 1. Obtener los IDs necesarios
WITH ids AS (
  SELECT 
    p.id as project_id,
    b.id as batch_id
  FROM "Project" p
  LEFT JOIN "Batch" b ON b."projectId" = p.id AND b.code = p.code
  WHERE p.code = 'MOPC-CCC-LPN-2021-0036'
)

-- 2. Eliminar gastos vinculados a los items del batch
DELETE FROM "Expense" 
WHERE "batchItemId" IN (
  SELECT bi.id 
  FROM "BatchItem" bi
  WHERE bi."batchId" IN (SELECT batch_id FROM ids WHERE batch_id IS NOT NULL)
);

-- 3. Eliminar items del batch
DELETE FROM "BatchItem" 
WHERE "batchId" IN (
  SELECT batch_id FROM ids WHERE batch_id IS NOT NULL
);

-- 4. Eliminar el batch
DELETE FROM "Batch" 
WHERE code = 'MOPC-CCC-LPN-2021-0036' 
AND "projectId" IN (
  SELECT id FROM "Project" WHERE code = 'MOPC-CCC-LPN-2021-0036'
);

-- 5. Verificar que el proyecto aún existe
SELECT id, code, name FROM "Project" WHERE code = 'MOPC-CCC-LPN-2021-0036';

-- Descomenta COMMIT para aplicar cambios, ROLLBACK para cancelar
-- COMMIT;
-- ROLLBACK;
