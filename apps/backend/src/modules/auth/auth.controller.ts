import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import prisma from '../../config/database';

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await authService.logout(refreshToken);
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
  } catch (err) { next(err); }
}

export async function getMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/auth/refresh-tokens — Solo admin. Limpia todos los refresh tokens (uso único de mantenimiento). */
export async function purgeRefreshTokensHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Solo administradores' });
      return;
    }
    const result = await prisma.refreshToken.deleteMany();
    res.json({ success: true, message: `${result.count} refresh tokens eliminados.` });
  } catch (err) { next(err); }
}
