import { Router } from 'express';
import * as ctrl from './whatsapp.controller';

const router = Router();

// No authenticate middleware — UltraMsg doesn't send a JWT
// Token validation is handled inside the controller
router.post('/webhook', ctrl.webhook);

export default router;
