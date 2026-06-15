import type { Request, Response, NextFunction } from 'express';
import * as svc from './credit-lines.service';

export async function listCreditLines(req: Request, res: Response, next: NextFunction) {
  try {
    const lines = await svc.listCreditLines(req.params.id);
    const withBalance = await Promise.all(
      lines.map(async (l) => ({ ...l, balance: await svc.getCreditLineBalance(l.id) }))
    );
    res.json({ success: true, data: withBalance });
  } catch (err) { next(err); }
}

export async function createCreditLine(req: Request, res: Response, next: NextFunction) {
  try {
    const line = await svc.createCreditLine(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data: line });
  } catch (err) { next(err); }
}

export async function updateCreditLine(req: Request, res: Response, next: NextFunction) {
  try {
    const line = await svc.updateCreditLine(req.params.lineId, req.body);
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
}

export async function toggleCreditLine(req: Request, res: Response, next: NextFunction) {
  try {
    const line = await svc.toggleCreditLine(req.params.lineId);
    res.json({ success: true, data: line });
  } catch (err) { next(err); }
}

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const balance = await svc.getCreditLineBalance(req.params.lineId);
    res.json({ success: true, data: balance });
  } catch (err) { next(err); }
}

export async function addPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await svc.addPayment(req.params.lineId, req.body, req.user!.userId);
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await svc.listPayments(req.params.lineId);
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
}
