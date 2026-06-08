import type { Request, Response, NextFunction } from 'express';
import * as svc from './payment-orders.service';
import { createPaymentOrderSchema, updatePaymentOrderSchema, querySchema } from './payment-orders.schema';
import { z } from 'zod';

export async function listPaymentOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const query    = querySchema.parse(req.query);
    const userCtx  = { userId: (req as any).user.userId, role: (req as any).user.role };
    res.json(await svc.getPaymentOrders(query, userCtx));
  } catch (err) { next(err); }
}

export async function getPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userCtx = { userId: (req as any).user.userId, role: (req as any).user.role };
    res.json({ success: true, data: await svc.getPaymentOrderById(req.params.id, userCtx) });
  } catch (err) { next(err); }
}

export async function getAvailablePayrolls(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.query);
    res.json({ success: true, data: await svc.getAvailablePayrolls(projectId) });
  } catch (err) { next(err); }
}

export async function getAvailableExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.query);
    res.json({ success: true, data: await svc.getAvailableExpenses(projectId) });
  } catch (err) { next(err); }
}

export async function createPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createPaymentOrderSchema.parse(req.body);
    const po   = await svc.createPaymentOrder(data, (req as any).user.userId);
    res.status(201).json({ success: true, data: po });
  } catch (err) { next(err); }
}

export async function updatePaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updatePaymentOrderSchema.parse(req.body);
    res.json({ success: true, data: await svc.updatePaymentOrder(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function linkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { expenseId } = z.object({ expenseId: z.string().uuid() }).parse(req.body);
    res.json({ success: true, data: await svc.linkExpense(req.params.id, expenseId) });
  } catch (err) { next(err); }
}

export async function unlinkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.unlinkExpense(req.params.id) });
  } catch (err) { next(err); }
}

export async function linkPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    const payrollId = req.body?.payrollId;
    if (!payrollId) { res.status(400).json({ success: false, error: 'payrollId requerido' }); return; }
    res.json({ success: true, data: await svc.linkPayroll(req.params.id, payrollId) });
  } catch (err) { next(err); }
}

export async function unlinkPayroll(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.unlinkPayroll(req.params.id) });
  } catch (err) { next(err); }
}

export async function markAsPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalVoucher = req.body?.fiscalVoucher ?? null;
    const paymentInfo   = req.body?.paymentInfo   ?? null;
    res.json({ success: true, data: await svc.markAsPaid(req.params.id, (req as any).user.userId, fiscalVoucher, paymentInfo) });
  } catch (err) { next(err); }
}

export async function generateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.generateExpenseForOrder(req.params.id, (req as any).user.userId) });
  } catch (err) { next(err); }
}

export async function voidPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.voidPaymentOrder(req.params.id) });
  } catch (err) { next(err); }
}

export async function hardDeletePaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.hardDeletePaymentOrder(req.params.id);
    res.json({ success: true, message: 'Orden eliminada permanentemente' });
  } catch (err) { next(err); }
}
