import { Request, Response, NextFunction } from 'express';
import * as svc from './payroll.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.getPayrolls(req.query as any, req.user!.userId, req.user!.role);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
};

export const getOne = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.getPayrollById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.createPayroll(req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.updatePayroll(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.deletePayroll(req.params.id);
    res.json({ success: true, message: 'Nómina eliminada' });
  } catch (err) { next(err); }
};

export const addLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.addLine(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const updateLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.updateLine(req.params.id, req.params.lineId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const deleteLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.deleteLine(req.params.id, req.params.lineId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const approve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.approvePayroll(req.params.id, req.user!.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const markPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.markPayrollPaid(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const voidOne = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.voidPayroll(req.params.id, req.user!.userId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const exportExcel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.exportPayrollExcel(req.params.id, res);
  } catch (err) { next(err); }
};

export const exportDocx = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await svc.exportPayrollDocx(req.params.id, res);
  } catch (err) { next(err); }
};
