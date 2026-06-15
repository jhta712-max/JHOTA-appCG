import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from './whatsapp.controller';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

// No authenticate middleware — UltraMsg doesn't send a JWT
// Token validation is handled inside the controller
router.post('/webhook', webhookLimiter, ctrl.webhook);

export default router;
