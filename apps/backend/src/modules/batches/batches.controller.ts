import { Request, Response, NextFunction } from 'express';
import { batchesService } from './batches.service';
import { validateSchema } from '../../lib/validation';
import {
  createBatchSchema,
  createBatchItemSchema,
  updateBatchSchema,
  updateBatchItemSchema,
} from './batches.schema';

export const batchesController = {
  // ============ BATCHES ============

  async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const validatedData = validateSchema(createBatchSchema, req.body);

      const batch = await batchesService.createBatch(projectId, validatedData);
      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  },

  async getBatchesByProject(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const batches = await batchesService.getBatchesByProject(projectId);
      res.json({ success: true, data: batches });
    } catch (error) {
      next(error);
    }
  },

  async getBatchById(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const batch = await batchesService.getBatchById(batchId);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  },

  async updateBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const validatedData = validateSchema(updateBatchSchema, req.body);

      const batch = await batchesService.updateBatch(batchId, validatedData);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  },

  async deleteBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      await batchesService.deleteBatch(batchId);
      res.json({ success: true, message: 'Lote eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  },

  // ============ BATCH ITEMS ============

  async createBatchItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const validatedData = validateSchema(createBatchItemSchema, req.body);

      const item = await batchesService.createBatchItem(batchId, validatedData);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async getBatchItemsByBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      const items = await batchesService.getBatchItemsByBatch(batchId);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  async getBatchItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const item = await batchesService.getBatchItemById(itemId);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async updateBatchItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      const validatedData = validateSchema(updateBatchItemSchema, req.body);

      const item = await batchesService.updateBatchItem(itemId, validatedData);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  },

  async deleteBatchItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemId } = req.params;
      await batchesService.deleteBatchItem(itemId);
      res.json({ success: true, message: 'Item del lote eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  },

  // ============ PROJECT BATCHES TOGGLE ============

  async enableBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const project = await batchesService.enableBatches(projectId);
      res.json({ success: true, data: project, message: 'Lotes habilitados correctamente' });
    } catch (error) {
      next(error);
    }
  },

  async disableBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const project = await batchesService.disableBatches(projectId);
      res.json({ success: true, data: project, message: 'Lotes deshabilitados correctamente' });
    } catch (error) {
      next(error);
    }
  },
};
