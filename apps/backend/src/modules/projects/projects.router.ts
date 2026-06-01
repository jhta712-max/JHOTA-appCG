import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import {
  createProjectSchema, updateProjectSchema, projectQuerySchema,
  createAddendumSchema, updateAddendumSchema,
  createCubicacionSchema, updateCubicacionSchema,
} from './projects.schema';
import * as ctrl from './projects.controller';

// @ts-ignore
const router: any = Router();

// Todos los endpoints requieren estar autenticado
router.use(authenticate);

// GET  /api/v1/projects
router.get('/',    validate(projectQuerySchema, 'query'), ctrl.list);

// GET  /api/v1/projects/:id
router.get('/:id', ctrl.getOne);

// GET  /api/v1/projects/:id/summary
router.get('/:id/summary', ctrl.getSummary);

// POST /api/v1/projects  — solo admin y supervisor
router.post('/',    authorize('admin', 'supervisor'), validate(createProjectSchema), ctrl.create);

// PUT  /api/v1/projects/:id
router.put('/:id',  authorize('admin', 'supervisor'), validate(updateProjectSchema), ctrl.update);

// DELETE /api/v1/projects/:id  — solo admin
router.delete('/:id', authorize('admin'), ctrl.remove);

// ── Adendas de contrato ───────────────────────────────────────
// GET    /api/v1/projects/:id/addendums
router.get('/:id/addendums', ctrl.listAddendums);

// POST   /api/v1/projects/:id/addendums  — admin y supervisor
router.post('/:id/addendums',
  authorize('admin', 'supervisor'),
  validate(createAddendumSchema),
  ctrl.createAddendum,
);

// PUT    /api/v1/projects/:id/addendums/:addendumId
router.put('/:id/addendums/:addendumId',
  authorize('admin', 'supervisor'),
  validate(updateAddendumSchema),
  ctrl.updateAddendum,
);

// DELETE /api/v1/projects/:id/addendums/:addendumId  — solo admin
router.delete('/:id/addendums/:addendumId',
  authorize('admin'),
  ctrl.removeAddendum,
);

// ── Asignaciones de operadores ───────────────────────────────
// GET    /api/v1/projects/:id/assignments
router.get('/:id/assignments',
  authorize('admin', 'supervisor'),
  ctrl.listAssignments,
);

// POST   /api/v1/projects/:id/assignments  — body: { userId }
router.post('/:id/assignments',
  authorize('admin', 'supervisor'),
  ctrl.assignUser,
);

// DELETE /api/v1/projects/:id/assignments/:userId
router.delete('/:id/assignments/:userId',
  authorize('admin', 'supervisor'),
  ctrl.unassignUser,
);

// ── Cubicaciones y análisis financiero (admin y supervisor ONLY) ─
// GET    /api/v1/projects/:id/financial
router.get('/:id/financial',
  authorize('admin', 'supervisor'),
  ctrl.getFinancialAnalysis,
);

// GET    /api/v1/projects/:id/cubicaciones
router.get('/:id/cubicaciones',
  authorize('admin', 'supervisor'),
  ctrl.listCubicaciones,
);

// POST   /api/v1/projects/:id/cubicaciones
router.post('/:id/cubicaciones',
  authorize('admin', 'supervisor'),
  validate(createCubicacionSchema),
  ctrl.createCubicacion,
);

// PUT    /api/v1/projects/:id/cubicaciones/:cubicacionId
router.put('/:id/cubicaciones/:cubicacionId',
  authorize('admin', 'supervisor'),
  validate(updateCubicacionSchema),
  ctrl.updateCubicacion,
);

// DELETE /api/v1/projects/:id/cubicaciones/:cubicacionId
router.delete('/:id/cubicaciones/:cubicacionId',
  authorize('admin'),
  ctrl.removeCubicacion,
);

export default router;
