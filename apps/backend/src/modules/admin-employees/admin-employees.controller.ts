import { Request, Response, NextFunction } from 'express';
import * as svc from './admin-employees.service';
import {
  createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema,
  createBenefitSchema, updateBenefitSchema,
} from './admin-employees.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = listEmployeesSchema.parse(req.query);
    res.json({ success: true, ...(await svc.listEmployees(q)) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getEmployeeById(req.params.id) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = createEmployeeSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.status(201).json({ success: true, data: await svc.createEmployee(data, userId) });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = updateEmployeeSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.updateEmployee(req.params.id, data, userId) });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deleteEmployee(req.params.id) });
  } catch (err) { next(err); }
}

export async function addBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createBenefitSchema.parse(req.body);
    res.status(201).json({ success: true, data: await svc.addBenefit(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function updateBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateBenefitSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateBenefit(req.params.id, req.params.bId, data) });
  } catch (err) { next(err); }
}

export async function deleteBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deleteBenefit(req.params.id, req.params.bId) });
  } catch (err) { next(err); }
}
