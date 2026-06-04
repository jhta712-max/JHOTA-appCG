import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.schema';
import * as ctrl from './suppliers.controller';

const router = Router();
router.use(authenticate);

router.get('/',            ctrl.list);
router.get('/:id/history', ctrl.getHistory);
router.get('/:id',         ctrl.getOne);
router.post('/',           authorize('admin', 'supervisor', 'operator'), validate(createSupplierSchema), ctrl.create);
router.put('/:id',         authorize('admin', 'supervisor'),             validate(updateSupplierSchema), ctrl.update);
router.patch('/:id/toggle', authorize('admin', 'supervisor'),            ctrl.toggleActive);

export default router;
