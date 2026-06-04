import { Request, Response, NextFunction } from 'express';
import * as service from './suppliers.service';
import type { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listSuppliers(req.query.search as string, req.query.onlyActive === 'true');
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getSupplierById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getSupplierHistory(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createSupplier(req.body as CreateSupplierInput, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateSupplier(req.params.id, req.body as UpdateSupplierInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.toggleSupplierActive(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
