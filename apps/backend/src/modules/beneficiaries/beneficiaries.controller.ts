import type { Request, Response, NextFunction } from 'express';
import * as svc from './beneficiaries.service';
import { createBeneficiarySchema, updateBeneficiarySchema } from './beneficiaries.schema';

export async function listBeneficiaries(req: Request, res: Response, next: NextFunction) {
  try {
    const onlyActive = req.query.active !== 'false';
    res.json({ success: true, data: await svc.getBeneficiaries(onlyActive) });
  } catch (err) { next(err); }
}

export async function getBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getBeneficiaryById(req.params.id) });
  } catch (err) { next(err); }
}

export async function createBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createBeneficiarySchema.parse(req.body);
    const b    = await svc.createBeneficiary(data, (req as any).user.id);
    res.status(201).json({ success: true, data: b });
  } catch (err) { next(err); }
}

export async function updateBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateBeneficiarySchema.parse(req.body);
    res.json({ success: true, data: await svc.updateBeneficiary(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function deactivateBeneficiary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deactivateBeneficiary(req.params.id) });
  } catch (err) { next(err); }
}
