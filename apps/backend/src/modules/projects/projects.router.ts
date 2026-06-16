import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import {
  createProjectSchema, updateProjectSchema, projectQuerySchema,
  createAddendumSchema, updateAddendumSchema,
  createCubicacionSchema, updateCubicacionSchema,
  createAnticipoSchema, updateAnticipoSchema,
  createProjectItemSchema, updateProjectItemSchema,
} from './projects.schema';
import * as ctrl from './projects.controller';

const router = Router();

// Todos los endpoints requieren estar autenticado
router.use(authenticate);

// GET  /api/v1/projects/portfolio  — must be before /:id
router.get('/portfolio', authorize('admin', 'supervisor'), ctrl.getPortfolio);

// GET  /api/v1/projects
router.get('/',    validate(projectQuerySchema, 'query'), ctrl.list);

// GET  /api/v1/projects/:id
router.get('/:id', ctrl.getOne);

// GET  /api/v1/projects/:id/summary
router.get('/:id/summary', ctrl.getSummary);

// POST /api/v1/projects/:id/ai-summary
router.post('/:id/ai-summary', ctrl.aiSummary);

// POST /api/v1/projects  — admin, supervisor y auxiliar
router.post('/',    authorize('admin', 'supervisor', 'auxiliar'), validate(createProjectSchema), ctrl.create);

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

// ── Anticipos ─────────────────────────────────────────────────
// GET    /api/v1/projects/:id/anticipos
router.get('/:id/anticipos',
  ctrl.listAnticipos,
);

// POST   /api/v1/projects/:id/anticipos
router.post('/:id/anticipos',
  authorize('admin', 'supervisor'),
  validate(createAnticipoSchema),
  ctrl.createAnticipo,
);

// PATCH  /api/v1/projects/:id/anticipos/:anticipoId
router.patch('/:id/anticipos/:anticipoId',
  authorize('admin', 'supervisor'),
  validate(updateAnticipoSchema),
  ctrl.updateAnticipo,
);

// DELETE /api/v1/projects/:id/anticipos/:anticipoId
router.delete('/:id/anticipos/:anticipoId',
  authorize('admin', 'supervisor'),
  ctrl.removeAnticipo,
);

// GET    /api/v1/projects/:id/items — visible para todos los autenticados
router.get('/:id/items', ctrl.listItems);

// GET    /api/v1/projects/:id/batch-items — batch items activos del proyecto
router.get('/:id/batch-items', ctrl.listBatchItems);// POST   /api/v1/projects/:id/items
router.post('/:id/items',
  authorize('admin', 'supervisor'),
  validate(createProjectItemSchema),
  ctrl.createItem,
);

// PATCH  /api/v1/projects/:id/items/:itemId — renombrar / activar / desactivar
router.patch('/:id/items/:itemId',
  authorize('admin', 'supervisor'),
  validate(updateProjectItemSchema),
  ctrl.updateItem,
);

export default router;
