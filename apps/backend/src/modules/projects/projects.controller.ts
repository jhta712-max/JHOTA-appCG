import { Request, Response, NextFunction } from 'express';
import * as service from './projects.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getProjects(req.query as any, req.user!);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getProjectById(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getProjectSummary(req.params.id, req.user!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createProject(req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateProject(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteProject(req.params.id);
    res.json({ success: true, message: 'Proyecto eliminado' });
  } catch (err) { next(err); }
}

// ── Adendas ───────────────────────────────────────────────────
export async function listAddendums(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAddendums(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAddendum(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createAddendum(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateAddendum(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateAddendum(req.params.id, req.params.addendumId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeAddendum(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteAddendum(req.params.id, req.params.addendumId);
    res.json({ success: true, message: 'Adenda eliminada' });
  } catch (err) { next(err); }
}

// ── Cubicaciones y Avance ────────────────────────────────────
export async function getFinancialAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getFinancialAnalysis(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listCubicaciones(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getCubicaciones(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createCubicacion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createCubicacion(req.params.id, req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateCubicacion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateCubicacion(req.params.id, req.params.cubicacionId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeCubicacion(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteCubicacion(req.params.id, req.params.cubicacionId);
    res.json({ success: true, message: 'Cubicación eliminada' });
  } catch (err) { next(err); }
}

// ── Anticipos ─────────────────────────────────────────────────

export async function listAnticipos(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAnticipos(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createAnticipo(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateAnticipo(req.params.id, req.params.anticipoId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function removeAnticipo(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteAnticipo(req.params.id, req.params.anticipoId);
    res.json({ success: true, message: 'Anticipo eliminado' });
  } catch (err) { next(err); }
}

// ── Asignaciones de operadores ────────────────────────────────
export async function listAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAssignments(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function assignUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.assignUser(req.params.id, req.body.userId, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function unassignUser(req: Request, res: Response, next: NextFunction) {
  try {
    await service.unassignUser(req.params.id, req.params.userId);
    res.json({ success: true, message: 'Operador desasignado del proyecto' });
  } catch (err) { next(err); }
}

export async function aiSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.generateAiSummary(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── Items de proyecto ─────────────────────────────────────────
export async function listItems(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getProjectItems(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createProjectItem(req.params.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function listBatchItems(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getBatchItemsForProject(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateProjectItem(req.params.id, req.params.itemId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getPortfolio(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getPortfolioSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCategoryBudgets(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getCategoryBudgets(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function upsertCategoryBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const { categoryId, budget } = req.body;
    if (!categoryId || budget === undefined) {
      res.status(400).json({ success: false, error: 'categoryId y budget son requeridos', code: 'MISSING_FIELDS' });
      return;
    }
    const data = await service.upsertCategoryBudget(req.params.id, Number(categoryId), Number(budget));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteCategoryBudget(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteCategoryBudget(req.params.id, Number(req.params.categoryId));
    res.json({ success: true });
  } catch (err) { next(err); }
}
