import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import * as ctrl from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/unread-count',     ctrl.unreadCount);
router.get('/',                 ctrl.list);
router.patch('/read-all',       ctrl.markAllRead);
router.patch('/:id/read',       ctrl.markRead);
router.post('/run-checks',      ctrl.runChecks);
router.post('/test-whatsapp',   ctrl.testWhatsApp);

export default router;
