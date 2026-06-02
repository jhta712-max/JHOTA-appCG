import { Router } from 'express';
import { batchesController } from './batches.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// ============ BATCHES ROUTES ============

// Crear un lote en un proyecto
router.post('/projects/:projectId/batches', batchesController.createBatch);

// Obtener todos los lotes de un proyecto
router.get('/projects/:projectId/batches', batchesController.getBatchesByProject);

// Obtener un lote específico
router.get('/batches/:batchId', batchesController.getBatchById);

// Actualizar un lote
router.patch('/batches/:batchId', batchesController.updateBatch);

// Eliminar un lote
router.delete('/batches/:batchId', batchesController.deleteBatch);

// ============ BATCH ITEMS ROUTES ============

// Crear un item en un lote
router.post('/batches/:batchId/items', batchesController.createBatchItem);

// Obtener todos los items de un lote
router.get('/batches/:batchId/items', batchesController.getBatchItemsByBatch);

// Obtener un item específico
router.get('/batch-items/:itemId', batchesController.getBatchItemById);

// Actualizar un item
router.patch('/batch-items/:itemId', batchesController.updateBatchItem);

// Eliminar un item
router.delete('/batch-items/:itemId', batchesController.deleteBatchItem);

// ============ PROJECT BATCHES TOGGLE ============

// Habilitar lotes en un proyecto
router.post('/projects/:projectId/batches/enable', batchesController.enableBatches);

// Deshabilitar lotes en un proyecto
router.post('/projects/:projectId/batches/disable', batchesController.disableBatches);

export default router;
