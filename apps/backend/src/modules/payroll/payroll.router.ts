import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import {
  createPayrollSchema,
  updatePayrollSchema,
  upsertLineSchema,
  markPaidSchema,
  voidPayrollSchema,
  payrollQuerySchema,
} from './payroll.schema';
import * as ctrl from './payroll.controller';

const router = Router();
router.use(authenticate);

// ── List & Create ────────────────────────────────────────────
router.get('/',    validate(payrollQuerySchema, 'query'), ctrl.list);
router.post('/',   validate(createPayrollSchema), ctrl.create);

// ── Single payroll ────────────────────────────────────────────
router.get('/:id',    ctrl.getOne);
router.put('/:id',    authorize('admin', 'supervisor'), validate(updatePayrollSchema), ctrl.update);
router.delete('/:id', authorize('admin', 'supervisor'), ctrl.remove);

// ── Lines ─────────────────────────────────────────────────────
router.post('/:id/lines',                                            validate(upsertLineSchema), ctrl.addLine);
router.put('/:id/lines/:lineId',   authorize('admin', 'supervisor'), validate(upsertLineSchema), ctrl.updateLine);
router.delete('/:id/lines/:lineId',authorize('admin', 'supervisor'), ctrl.deleteLine);
router.patch('/:id/lines/:lineId/contrato-ajustado', ctrl.updateLineContratoAjustado);
router.patch('/:id/lines/:lineId/payment',           ctrl.recordLinePayment);

// ── Workflow actions (admin / supervisor only) ─────────────────
router.post('/:id/revert-to-draft',    authorize('admin', 'supervisor'), ctrl.revertToDraft);
router.post('/:id/revert-to-approved', authorize('admin'),               ctrl.revertToApproved);
router.post('/:id/import-from-orders', authorize('admin', 'supervisor'), ctrl.importLinesFromOrders);
router.post('/:id/approve',            authorize('admin', 'supervisor'), ctrl.approve);
router.post('/:id/pay',                authorize('admin', 'supervisor'), validate(markPaidSchema), ctrl.markPaid);
router.post('/:id/void',               authorize('admin', 'supervisor'), validate(voidPayrollSchema), ctrl.voidOne);

// ── Exports (auxiliar y financiero también pueden exportar) ────
router.get('/:id/export.xlsx', authorize('admin', 'supervisor', 'auxiliar', 'financiero'), ctrl.exportExcel);
router.get('/:id/export.docx', authorize('admin', 'supervisor', 'auxiliar', 'financiero'), ctrl.exportDocx);

export default router;
