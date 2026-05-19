import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { loginSchema, refreshSchema } from './auth.schema';
import * as controller from './auth.controller';
import { needsSetup, setupAdmin } from './auth.service';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), controller.loginHandler);

// POST /api/v1/auth/refresh
router.post('/refresh', validate(refreshSchema), controller.refreshHandler);

// POST /api/v1/auth/logout
router.post('/logout', controller.logoutHandler);

// GET /api/v1/auth/me  (requiere token)
router.get('/me', authenticate, controller.getMeHandler);

// ── Primer acceso ──────────────────────────────────────────────────────────────

// GET /api/v1/auth/needs-setup  — público, indica si el sistema aún no tiene usuarios
router.get('/needs-setup', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const required = await needsSetup();
    res.json({ success: true, data: { needsSetup: required } });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/setup  — crea el primer administrador (bloqueado si ya existen usuarios)
router.post(
  '/setup',
  validate(z.object({
    name:     z.string().min(2, 'El nombre es requerido').max(100),
    email:    z.string().email('Correo inválido').toLowerCase(),
    password: z.string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await setupAdmin(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  },
);

export default router;
