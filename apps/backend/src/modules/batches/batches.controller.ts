import { Request, Response, NextFunction } from 'express';
import { batchesService } from './batches.service';

// ============ BATCHES ============

export async function createBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const batch = await batchesService.createBatch(projectId, req.body);
    res.status(201).json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function getBatchesByProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const batches = await batchesService.getBatchesByProject(projectId);
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
}

export async function getBatchById(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    const batch = await batchesService.getBatchById(batchId);
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function updateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    const batch = await batchesService.updateBatch(batchId, req.body);
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function deleteBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    await batchesService.deleteBatch(batchId);
    res.json({ success: true, message: 'Lote eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

// ============ BATCH ITEMS ============

export async function createBatchItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    const item = await batchesService.createBatchItem(batchId, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function getBatchItemsByBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { batchId } = req.params;
    const items = await batchesService.getBatchItemsByBatch(batchId);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getBatchItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const item = await batchesService.getBatchItemById(itemId);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateBatchItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const item = await batchesService.updateBatchItem(itemId, req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function deleteBatchItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    await batchesService.deleteBatchItem(itemId);
    res.json({ success: true, message: 'Item del lote eliminado correctamente' });
  } catch (err) {
    next(err);
  }
}

// ============ PROJECT BATCHES TOGGLE ============

export async function enableBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const project = await batchesService.enableBatches(projectId);
    res.json({ success: true, data: project, message: 'Lotes habilitados correctamente' });
  } catch (err) {
    next(err);
  }
}

export async function disableBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = req.params;
    const project = await batchesService.disableBatches(projectId);
    res.json({ success: true, data: project, message: 'Lotes deshabilitados correctamente' });
  } catch (err) {
    next(err);
  }
}
