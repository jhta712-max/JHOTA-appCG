import { Request, Response, NextFunction } from 'express';
import * as service from './suppliers.service';
import { lookupRNC } from '../../services/dgii.service';
import { validateRNC, normalizeRNC } from '../../utils/fiscal.utils';
import { createBankAccountSchema, updateBankAccountSchema } from './suppliers.schema';
import type { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema';
import { getCreditSummary, generateCreditReportXlsx } from './credit-summary.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.query.projectId as string | undefined;
    const isExpress = req.query.isExpress === 'true' ? true : req.query.isExpress === 'false' ? false : undefined;
    const data = await service.listSuppliers(req.query.search as string, req.query.onlyActive === 'true', projectId, isExpress);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getSupplierById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getSupplierHistory(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createSupplier(req.body as CreateSupplierInput, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateSupplier(req.params.id, req.body as UpdateSupplierInput);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function validateRnc(req: Request, res: Response, next: NextFunction) {
  try {
    const rnc = normalizeRNC(req.params.rnc ?? '');
    if (!validateRNC(rnc)) {
      return res.status(400).json({ success: false, error: 'Formato de RNC inválido (9 u 11 dígitos)' });
    }
    const result = await lookupRNC(rnc);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function toggleActive(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.toggleSupplierActive(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listBankAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listBankAccounts(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function addBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createBankAccountSchema.parse(req.body);
    const data  = await service.addBankAccount(req.params.id, input);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateBankAccountSchema.parse(req.body);
    const data  = await service.updateBankAccount(req.params.id, req.params.accountId, input);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteBankAccount(req.params.id, req.params.accountId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function setDefaultBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.setDefaultBankAccount(req.params.id, req.params.accountId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCreditSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.status === 'all';
    const data = await getCreditSummary(includeInactive);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCreditReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.status === 'all';
    await generateCreditReportXlsx(res, includeInactive);
  } catch (err) { next(err); }
}

export async function listDeletedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.listDeletedSuppliers() }); } catch (err) { next(err); }
}

export async function restoreHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await service.restoreSupplier(req.params.id) }); } catch (err) { next(err); }
}

export async function permanentDeleteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await service.permanentDeleteSupplier(req.params.id); res.json({ success: true }); } catch (err) { next(err); }
}
