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

// GET /webhook — Meta Cloud API hub.challenge verification
router.get('/webhook', ctrl.verifyWebhook);

// POST /webhook — incoming messages (UltraMsg or Meta Cloud API)
// Token validation is handled inside the controller
router.post('/webhook', webhookLimiter, ctrl.webhook);

export default router;
