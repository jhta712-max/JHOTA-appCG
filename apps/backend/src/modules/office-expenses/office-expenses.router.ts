import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './office-expenses.controller';

// @ts-ignore
const router: any = Router();

// Todos los endpoints requieren autenticación y rol admin o supervisor
router.use(authenticate, authorize('admin', 'supervisor'));

router.get('/',           ctrl.list);
router.get('/summary',    ctrl.summary);
router.get('/:id',        ctrl.getOne);
router.post('/',          ctrl.create);
router.put('/:id',        ctrl.update);
router.delete('/:id',     ctrl.voidExpense);

export default router;
