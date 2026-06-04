import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './notification-contacts.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/',     ctrl.list);
router.post('/',    ctrl.create);
router.put('/:id',  ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
