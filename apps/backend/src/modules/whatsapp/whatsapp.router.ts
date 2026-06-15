import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from './whatsapp.controller';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// No authenticate middleware — UltraMsg doesn't send a JWT
// Token validation is handled inside the controller
router.post('/webhook', webhookLimiter, ctrl.webhook);

export default router;
