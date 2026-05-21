import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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

/** Importación masiva — devuelve detalle por fila */
export async function bulkCreateBeneficiaries(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = z.array(z.unknown()).parse(req.body);
    const userId = (req as any).user.id;
    const results: { index: number; name: string; status: 'ok' | 'error'; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      try {
        const data = createBeneficiarySchema.parse(raw);
        await svc.createBeneficiary(data, userId);
        results.push({ index: i, name: (raw as any).name ?? `Fila ${i + 1}`, status: 'ok' });
      } catch (e: any) {
        const msg = e?.errors?.[0]?.message ?? e?.message ?? 'Error desconocido';
        results.push({ index: i, name: (raw as any).name ?? `Fila ${i + 1}`, status: 'error', error: msg });
      }
    }

    const ok  = results.filter((r) => r.status === 'ok').length;
    const err = results.filter((r) => r.status === 'error').length;
    res.json({ success: true, data: { ok, err, results } });
  } catch (err) { next(err); }
}
