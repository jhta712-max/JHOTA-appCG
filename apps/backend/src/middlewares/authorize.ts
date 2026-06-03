import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/**
 * Middleware de autorización por roles.
 * Usar después de authenticate().
 *
 * Ejemplo:
 *   router.post('/', authenticate, authorize('admin', 'supervisor'), handler)
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'No autenticado', 'UNAUTHORIZED'));
    }

    // Log para debugging
    console.log(`[AUTH] Usuario: ${req.user.email}, Rol: ${req.user.role}, Requerido: ${allowedRoles.join(', ')}`);

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          `Acceso denegado. Se requiere uno de los roles: ${allowedRoles.join(', ')}`,
          'FORBIDDEN',
        ),
      );
    }

    next();
  };
}
