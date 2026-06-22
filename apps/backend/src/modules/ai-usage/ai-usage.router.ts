import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './ai-usage.controller';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/summary',    ctrl.summary);
router.get('/by-feature', ctrl.byFeature);
router.get('/by-user',    ctrl.byUser);
router.get('/alert',      ctrl.getAlert);
router.put('/alert',      ctrl.updateAlert);

export default router;
