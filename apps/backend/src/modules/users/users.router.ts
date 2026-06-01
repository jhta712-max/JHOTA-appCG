import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { createUserSchema, updateUserSchema, changePasswordSchema } from './users.schema';
import * as ctrl from './users.controller';

const router: any = Router();

router.use(authenticate);

// GET  /api/v1/users/roles
router.get('/roles', ctrl.getRoles);

// GET  /api/v1/users  — solo admin
router.get('/', authorize('admin'), ctrl.list);

// GET  /api/v1/users/me  o  /api/v1/users/:id
router.get('/:id', ctrl.getOne);

// POST /api/v1/users  — solo admin
router.post('/', authorize('admin'), validate(createUserSchema), ctrl.create);

// PUT  /api/v1/users/:id
router.put('/:id', validate(updateUserSchema), ctrl.update);

// POST /api/v1/users/change-password  — cualquier usuario para sí mismo
router.post('/change-password', validate(changePasswordSchema), ctrl.changePassword);

export default router;
