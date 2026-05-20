import { Request, Response, NextFunction } from 'express';
import * as service from './users.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAll();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id === 'me' ? req.user!.userId : req.params.id;
    const data = await service.getById(id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    // Un usuario solo puede editarse a sí mismo, salvo admin
    const id = req.params.id;
    if (req.user!.role !== 'admin' && req.user!.userId !== id) {
      res.status(403).json({ success: false, error: 'No puedes editar otro usuario' });
      return;
    }
    // Solo admin puede cambiar roleId e isActive — evitar escalada de privilegios
    const body = { ...req.body };
    if (req.user!.role !== 'admin') {
      delete body.roleId;
      delete body.isActive;
    }
    const data = await service.update(id, body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    await service.changePassword(req.user!.userId, req.body);
    res.json({ success: true, message: 'Contraseña actualizada. Por favor inicia sesión nuevamente.' });
  } catch (err) { next(err); }
}

export async function getRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getRoles();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
