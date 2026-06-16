import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './admin-payrolls.controller';

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.list);
router.post('/',   authorize('admin', 'supervisor'), ctrl.create);
router.get('/:id', ctrl.getOne);

router.patch('/:id/lines/:lineId', authorize('admin', 'supervisor'), ctrl.updateLine);
router.post('/:id/approve',        authorize('admin', 'supervisor'), ctrl.approve);
router.post('/:id/pay',            authorize('admin', 'supervisor'), ctrl.pay);
router.post('/:id/void',           authorize('admin'),               ctrl.voidOne);

router.get('/:id/export.xlsx', authorize('admin', 'supervisor', 'financiero'), ctrl.exportExcel);

export default router;
