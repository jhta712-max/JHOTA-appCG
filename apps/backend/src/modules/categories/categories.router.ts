import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import * as ctrl from './categories.controller';

const router = Router() as any;

router.use(authenticate);

router.get('/',     ctrl.list);
router.post('/',    authorize('admin'), validate(createCategorySchema), ctrl.create);
router.put('/:id',  authorize('admin'), validate(updateCategorySchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

export default router;
