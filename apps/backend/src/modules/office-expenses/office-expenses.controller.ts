import { Request, Response, NextFunction } from 'express';
import * as svc from './office-expenses.service';
import {
  createOfficeExpenseSchema,
  updateOfficeExpenseSchema,
  listOfficeExpensesSchema,
} from './office-expenses.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listOfficeExpensesSchema.parse(req.query);
    res.json({ success: true, ...(await svc.listOfficeExpenses(params)) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getOfficeExpenseById(req.params.id) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = createOfficeExpenseSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.status(201).json({ success: true, data: await svc.createOfficeExpense(data, userId) });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateOfficeExpenseSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateOfficeExpense(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function voidExpense(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.voidOfficeExpense(req.params.id) });
  } catch (err) { next(err); }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getOfficeExpenseSummary() });
  } catch (err) { next(err); }
}
