import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { loginSchema, refreshSchema } from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), controller.loginHandler);

// POST /api/v1/auth/refresh
router.post('/refresh', validate(refreshSchema), controller.refreshHandler);

// POST /api/v1/auth/logout
router.post('/logout', controller.logoutHandler);

// GET /api/v1/auth/me  (requiere token)
router.get('/me', authenticate, controller.getMeHandler);

export default router;
