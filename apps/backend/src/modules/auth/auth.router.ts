import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema';
import * as controller from './auth.controller';

const router: any = Router();

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), controller.loginHandler);

// POST /api/v1/auth/refresh
router.post('/refresh', validate(refreshSchema), controller.refreshHandler);

// POST /api/v1/auth/logout
router.post('/logout', controller.logoutHandler);

// GET /api/v1/auth/me  (requiere token)
router.get('/me', authenticate, controller.getMeHandler);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPasswordHandler);

// POST /api/v1/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPasswordHandler);

// DELETE /api/v1/auth/refresh-tokens  (solo admin — mantenimiento)
router.delete('/refresh-tokens', authenticate, controller.purgeRefreshTokensHandler);

export default router;
