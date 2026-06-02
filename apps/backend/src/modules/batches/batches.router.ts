import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import {
  createBatchSchema,
  updateBatchSchema,
  createBatchItemSchema,
  updateBatchItemSchema,
} from './batches.schema';
import * as ctrl from './batches.controller';

const router = Router();

router.use(authenticate);

// ============ BATCHES ROUTES ============

router.post('/projects/:projectId/batches', validate(createBatchSchema), ctrl.createBatch);
router.get('/projects/:projectId/batches', ctrl.getBatchesByProject);
router.get('/batches/:batchId', ctrl.getBatchById);
router.patch('/batches/:batchId', validate(updateBatchSchema), ctrl.updateBatch);
router.delete('/batches/:batchId', ctrl.deleteBatch);

// ============ BATCH ITEMS ROUTES ============

router.post('/batches/:batchId/items', validate(createBatchItemSchema), ctrl.createBatchItem);
router.get('/batches/:batchId/items', ctrl.getBatchItemsByBatch);
router.get('/batch-items/:itemId', ctrl.getBatchItemById);
router.patch('/batch-items/:itemId', validate(updateBatchItemSchema), ctrl.updateBatchItem);
router.delete('/batch-items/:itemId', ctrl.deleteBatchItem);

// ============ PROJECT BATCHES TOGGLE ============

router.post('/projects/:projectId/batches/enable', ctrl.enableBatches);
router.post('/projects/:projectId/batches/disable', ctrl.disableBatches);

export default router;
