import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './admin-employees.controller';

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.list);
router.post('/',   authorize('admin', 'supervisor'), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', authorize('admin', 'supervisor'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

router.post('/:id/benefits',        authorize('admin', 'supervisor'), ctrl.addBenefit);
router.put('/:id/benefits/:bId',    authorize('admin', 'supervisor'), ctrl.updateBenefit);
router.delete('/:id/benefits/:bId', authorize('admin', 'supervisor'), ctrl.deleteBenefit);

export default router;
