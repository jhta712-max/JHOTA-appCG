import type { Request, Response, NextFunction } from 'express';
import * as svc from './payment-orders.service';
import { createPaymentOrderSchema, updatePaymentOrderSchema, querySchema } from './payment-orders.schema';
import { z } from 'zod';

export async function listPaymentOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const query = querySchema.parse(req.query);
    res.json(await svc.getPaymentOrders(query));
  } catch (err) { next(err); }
}

export async function getPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getPaymentOrderById(req.params.id) });
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

export async function markAsPaid(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.markAsPaid(req.params.id, (req as any).user.userId) });
  } catch (err) { next(err); }
}

export async function voidPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.voidPaymentOrder(req.params.id) });
  } catch (err) { next(err); }
}
