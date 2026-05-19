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
