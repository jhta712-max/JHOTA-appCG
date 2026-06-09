import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './contratos-ajustados.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'supervisor', 'operator', 'auxiliar', 'financiero'));

router.get('/resumen', ctrl.getResumen);
router.get('/',        ctrl.listContratos);
router.get('/:id',     ctrl.getContrato);
router.post('/',       authorize('admin', 'supervisor', 'auxiliar'), ctrl.createContrato);
router.put('/:id',     authorize('admin', 'supervisor'), ctrl.updateContrato);
router.delete('/:id',  authorize('admin', 'supervisor'), ctrl.deleteContrato);

router.get('/:id/available-expenses',    ctrl.getAvailableExpenses);
router.post('/:id/link-expense',         ctrl.linkExpense);
router.post('/:id/unlink-expense',       ctrl.unlinkExpense);

// Adendas por monto
router.post('/:id/adendas',             authorize('admin', 'supervisor'), ctrl.createAdenda);
router.delete('/:id/adendas/:adendaId', authorize('admin', 'supervisor'), ctrl.deleteAdenda);

export default router;
