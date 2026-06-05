import { Request, Response, NextFunction } from 'express';
import * as svc from './contratos-ajustados.service';
import {
  createContratoSchema, updateContratoSchema, queryContratoSchema,
  linkExpenseSchema,
} from './contratos-ajustados.schema';

export async function listContratos(req: Request, res: Response, next: NextFunction) {
  try {
    const query = queryContratoSchema.parse(req.query);
    res.json(await svc.getContratos(query));
  } catch (err) { next(err); }
}

export async function getContrato(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getContratoById(req.params.id) });
  } catch (err) { next(err); }
}

export async function createContrato(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createContratoSchema.parse(req.body);
    const c    = await svc.createContrato(data, (req as any).user.userId);
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function updateContrato(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateContratoSchema.parse(req.body);
    const c    = await svc.updateContrato(req.params.id, data, (req as any).user.userId);
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function deleteContrato(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteContrato(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function linkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { expenseId } = linkExpenseSchema.parse(req.body);
    const c = await svc.linkExpense(req.params.id, expenseId, (req as any).user.userId);
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function unlinkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { expenseId } = linkExpenseSchema.parse(req.body);
    const c = await svc.unlinkExpense(req.params.id, expenseId);
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function getResumen(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getResumen() });
  } catch (err) { next(err); }
}

export async function getAvailableExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getAvailableExpenses(req.params.id) });
  } catch (err) { next(err); }
}
