import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import {
  createExpenseSchema,
  updateExpenseSchema,
  voidExpenseSchema,
  expenseQuerySchema,
} from './expenses.schema';
import * as ctrl from './expenses.controller';

const router = Router();
router.use(authenticate);
router.get('/stats',         ctrl.getStats);
router.post('/suggest-category', ctrl.suggestCategory);
router.get('/',              validate(expenseQuerySchema, 'query'), ctrl.list);
router.post('/bulk-import',  authorize('admin'), ctrl.bulkImport);
router.get('/:id',           ctrl.getOne);
router.post('/',             validate(createExpenseSchema), ctrl.create);
router.put('/:id',           validate(updateExpenseSchema), ctrl.update);
router.post('/:id/void',     authorize('admin', 'supervisor'), validate(voidExpenseSchema), ctrl.voidExpense);
router.post('/:id/approve',  authorize('admin', 'financiero'), ctrl.approve);
router.post('/:id/reject',   authorize('admin', 'financiero'), ctrl.reject);
router.delete('/:id',        authorize('admin'), ctrl.hardDelete);

export default router;
