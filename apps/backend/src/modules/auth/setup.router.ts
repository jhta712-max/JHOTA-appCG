import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate';
import { needsSetup, setupAdmin } from './auth.service';

const router = Router() as any;

// GET /api/v1/setup/check  — público
router.get('/check', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const required = await needsSetup();
    res.json({ success: true, data: { needsSetup: required } });
  } catch (err) { next(err); }
});

// POST /api/v1/setup  — crea el primer admin
router.post(
  '/',
  validate(z.object({
    name:     z.string().min(2).max(100),
    email:    z.string().email(),
    password: z.string().min(8)
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
