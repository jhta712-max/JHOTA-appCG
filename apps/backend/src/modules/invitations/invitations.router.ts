import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import {
  createInvitation,
  verifyInvitationToken,
  acceptInvitation,
  listPendingInvitations,
  revokeInvitation,
} from './invitations.service';

const router = Router() as any;

// ── POST /invitations — Crear y enviar invitación (admin y supervisor)
router.post(
  '/',
  authenticate,
  authorize('admin', 'supervisor'),
  validate(z.object({
    email:  z.string().email('Email inválido'),
    roleId: z.number().int().positive(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createInvitation(
        req.user!.userId,
        req.body.email,
        req.body.roleId,
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

// ── GET /invitations — Listar invitaciones pendientes (admin y supervisor)
router.get(
  '/',
  authenticate,
  authorize('admin', 'supervisor'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await listPendingInvitations();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

// ── GET /invitations/verify/:token — Verificar token (público — sin auth)
router.get(
  '/verify/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await verifyInvitationToken(req.params.token);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

// ── POST /invitations/accept/:token — Aceptar invitación (público — sin auth)
router.post(
  '/accept/:token',
  validate(z.object({
    name:     z.string().min(2, 'El nombre es requerido').max(100),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await acceptInvitation(
        req.params.token,
        req.body.name,
        req.body.password,
      );
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  },
);

// ── DELETE /invitations/:id — Revocar invitación (admin y supervisor)
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'supervisor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await revokeInvitation(BigInt(req.params.id));
      res.json({ success: true, message: 'Invitación revocada' });
    } catch (err) { next(err); }
  },
);

export default router;
