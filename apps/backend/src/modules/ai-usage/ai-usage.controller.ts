import type { Request, Response } from 'express';
import * as svc from './ai-usage.service';

export async function summary(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getMonthlySummary(month);
  res.json({ success: true, data });
}

export async function byFeature(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getByFeature(month);
  res.json({ success: true, data });
}

export async function byUser(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getByUser(month);
  res.json({ success: true, data });
}

export async function getAlert(_req: Request, res: Response) {
  const data = await svc.getAlert();
  res.json({ success: true, data });
}

export async function updateAlert(req: Request, res: Response) {
  const { monthlyLimitUsd, enabled } = req.body as { monthlyLimitUsd: number; enabled?: boolean };
  if (typeof monthlyLimitUsd !== 'number' || monthlyLimitUsd <= 0) {
    res.status(400).json({ success: false, error: 'monthlyLimitUsd must be a positive number' });
    return;
  }
  const data = await svc.upsertAlert(monthlyLimitUsd, enabled ?? true);
  res.json({ success: true, data });
}
