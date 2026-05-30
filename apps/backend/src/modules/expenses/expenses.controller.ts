import { Request, Response, NextFunction } from 'express';
import * as service from './expenses.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getExpenses(req.query as any);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getExpenseById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createExpense(req.body, req.user!.userId, req.user!.role);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateExpense(
      req.params.id,
      req.body,
      req.user!.userId,
      req.user!.role,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function voidExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.voidExpense(req.params.id, req.body, req.user!.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function bulkImport(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'Se requiere un array de filas en rows' });
      return;
    }
    const result = await service.bulkImportExpenses(rows, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}
