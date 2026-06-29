import { Request, Response, NextFunction } from 'express';
import * as service from './categories.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.all === 'true';
    const data = await service.getAll(includeInactive);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.update(Number(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function mergeCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.merge(Number(req.params.id), Number(req.body.targetId));
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remove(Number(req.params.id));
    res.json({ success: true, message: 'Categoría eliminada' });
  } catch (err) { next(err); }
}
