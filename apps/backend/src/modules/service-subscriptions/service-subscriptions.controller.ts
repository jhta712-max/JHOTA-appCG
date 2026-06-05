import { Request, Response, NextFunction } from 'express';
import * as svc from './service-subscriptions.service';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from './service-subscriptions.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listAll();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.getOne(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.create(req.body as CreateSubscriptionInput);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.update(req.params.id, req.body as UpdateSubscriptionInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.remove(req.params.id);
    res.json({ success: true, message: 'Suscripción eliminada' });
  } catch (err) { next(err); }
}

export async function upcoming(req: Request, res: Response, next: NextFunction) {
  try {
    const daysAhead = req.query.days ? parseInt(req.query.days as string) : 7;
    const data = await svc.getUpcomingPayments(daysAhead);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await svc.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="suscripciones_servicios.csv"');
    res.send(csv);
  } catch (err) { next(err); }
}
