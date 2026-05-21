import { Request, Response, NextFunction } from 'express';
import * as service from './quotations.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getQuotations(req.query as any, req.user!);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getQuotationById(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getQuotationSummary(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createQuotation(req.body, req.user!.userId, req.user!.role);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateQuotation(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateStatus(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.deleteQuotation(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Pagos / anticipos ──────────────────────────────────────────

export async function createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createPayment(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deletePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.deletePayment(req.params.id, req.params.paymentId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Vínculos con gastos/facturas ───────────────────────────────

export async function linkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.linkExpense(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function unlinkExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.unlinkExpense(req.params.id, req.params.linkId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Sugerencias de cotización para un gasto ────────────────────

export async function suggest(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, supplierName, amount } = req.query as any;
    const data = await service.suggestQuotations(
      projectId,
      supplierName,
      amount ? parseFloat(amount) : undefined,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
