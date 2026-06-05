import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { createSchema, updateSchema } from './service-subscriptions.schema';
import * as ctrl from './service-subscriptions.controller';

const router = Router();
router.use(authenticate);

// Read routes — admin + supervisor
router.get('/',            authorize('admin', 'supervisor'), ctrl.list);
router.get('/upcoming',    authorize('admin', 'supervisor'), ctrl.upcoming);
router.get('/export/csv',  authorize('admin', 'supervisor'), ctrl.exportCsv);
router.get('/:id',         authorize('admin', 'supervisor'), ctrl.getOne);

// Write routes — admin only
router.post('/',    authorize('admin'), validate(createSchema), ctrl.create);
router.put('/:id',  authorize('admin'), validate(updateSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

export default router;
