import { Request, Response, NextFunction } from 'express';
import * as svc from './admin-payrolls.service';
import {
  createPayrollSchema, listPayrollsSchema,
  markPaidSchema, voidPayrollSchema, updateLineSchema,
} from './admin-payrolls.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = listPayrollsSchema.parse(req.query);
    res.json({ success: true, ...(await svc.listPayrolls(q)) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getPayrollById(req.params.id) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = createPayrollSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.status(201).json({ success: true, data: await svc.createPayroll(data, userId) });
  } catch (err) { next(err); }
}

export async function updateLine(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateLineSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateLine(req.params.id, req.params.lineId, data) });
  } catch (err) { next(err); }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.approvePayroll(req.params.id, userId) });
  } catch (err) { next(err); }
}

export async function pay(req: Request, res: Response, next: NextFunction) {
  try {
    const data = markPaidSchema.parse(req.body);
    res.json({ success: true, data: await svc.markPayrollPaid(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function voidOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = voidPayrollSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.voidPayroll(req.params.id, data, userId) });
  } catch (err) { next(err); }
}

export async function exportExcel(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.exportExcel(req.params.id, res);
  } catch (err) { next(err); }
}
