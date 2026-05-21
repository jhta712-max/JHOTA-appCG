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

// GET  /api/v1/expenses
router.get('/',    validate(expenseQuerySchema, 'query'), ctrl.list);

// GET  /api/v1/expenses/:id
router.get('/:id', ctrl.getOne);

// POST /api/v1/expenses  — todos los roles
router.post('/',   validate(createExpenseSchema), ctrl.create);

// PUT  /api/v1/expenses/:id
router.put('/:id', validate(updateExpenseSchema), ctrl.update);

// POST /api/v1/expenses/:id/void  — solo admin y supervisor
router.post('/:id/void', authorize('admin', 'supervisor'), validate(voidExpenseSchema), ctrl.voidExpense);

export default router;
