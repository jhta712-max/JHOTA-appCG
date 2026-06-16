import { Request, Response, NextFunction } from 'express';
import * as service from './expenses.service';
import prisma from '../../config/database';

export async function checkDuplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, amount, expenseDate } = req.query as { projectId?: string; amount?: string; expenseDate?: string };
    if (!projectId || !amount || !expenseDate) {
      return res.json({ success: true, data: { duplicates: [] } });
    }
    const date = new Date(expenseDate + 'T12:00:00');
    const minus3 = new Date(date.getTime() - 3 * 86400000);
    const plus3  = new Date(date.getTime() + 3 * 86400000);
    const amt    = parseFloat(amount);
    const margin = amt * 0.001; // 0.1% tolerance

    const duplicates = await prisma.expense.findMany({
      where: {
        projectId,
        status: { not: 'VOIDED' },
        amount: { gte: amt - margin, lte: amt + margin },
        expenseDate: { gte: minus3, lte: plus3 },
      },
      select: {
        id: true, description: true, amount: true, expenseDate: true,
        registeredBy: { select: { name: true } },
        category: { select: { name: true } },
      },
      take: 5,
      orderBy: { expenseDate: 'desc' },
    });

    res.json({ success: true, data: { duplicates } });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getExpenses(req.query as any);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getExpenseById(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createExpense(req.body, req.user!.userId, req.user!.role);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateExpense(
      req.params.id,
      req.body,
      req.user!.userId,
      req.user!.role,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function voidExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.voidExpense(req.params.id, req.body, req.user!.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function hardDelete(req: Request, res: Response, next: NextFunction) {
  try {
    await service.hardDeleteExpense(req.params.id);
    res.json({ success: true, message: 'Gasto eliminado permanentemente' });
  } catch (err) { next(err); }
}

export async function bulkImport(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ success: false, error: 'Se requiere un array de filas en rows' });
      return;
    }
    const result = await service.bulkImportExpenses(rows, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getDashboardStats();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.approveExpense(req.params.id, req.user!.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      res.status(400).json({ success: false, error: 'El motivo de rechazo es requerido' });
      return;
    }
    const data = await service.rejectExpense(req.params.id, req.user!.userId, reason.trim());
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function suggestCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { description } = req.body;
    if (!description?.trim()) {
      res.status(400).json({ success: false, error: 'description es requerido' });
      return;
    }
    const data = await service.suggestCategory(description.trim());
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { tableName: 'expenses', recordId: req.params.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
}
