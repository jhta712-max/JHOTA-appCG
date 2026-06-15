import type { Request, Response } from 'express';
import * as svc from './credit-lines.service';

export async function listCreditLines(req: Request, res: Response) {
  const lines = await svc.listCreditLines(req.params.id);
  const withBalance = await Promise.all(
    lines.map(async (l) => ({ ...l, balance: await svc.getCreditLineBalance(l.id) }))
  );
  res.json({ success: true, data: withBalance });
}

export async function createCreditLine(req: Request, res: Response) {
  const line = await svc.createCreditLine(req.params.id, req.body, req.user!.userId);
  res.status(201).json({ success: true, data: line });
}

export async function updateCreditLine(req: Request, res: Response) {
  const line = await svc.updateCreditLine(req.params.lineId, req.body);
  res.json({ success: true, data: line });
}

export async function toggleCreditLine(req: Request, res: Response) {
  const line = await svc.toggleCreditLine(req.params.lineId);
  res.json({ success: true, data: line });
}

export async function getBalance(req: Request, res: Response) {
  const balance = await svc.getCreditLineBalance(req.params.lineId);
  res.json({ success: true, data: balance });
}

export async function addPayment(req: Request, res: Response) {
  const payment = await svc.addPayment(req.params.lineId, req.body, req.user!.userId);
  res.status(201).json({ success: true, data: payment });
}

export async function listPayments(req: Request, res: Response) {
  const payments = await svc.listPayments(req.params.lineId);
  res.json({ success: true, data: payments });
}
