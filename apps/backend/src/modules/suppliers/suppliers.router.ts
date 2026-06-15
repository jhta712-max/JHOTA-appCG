import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.schema';
import * as ctrl from './suppliers.controller';
import { createCreditLineSchema, updateCreditLineSchema, addPaymentSchema } from './credit-lines.schema';
import * as creditCtrl from './credit-lines.controller';

const router = Router();
router.use(authenticate);

router.get('/validate-rnc/:rnc', ctrl.validateRnc);
router.get('/',            ctrl.list);
router.get('/:id/history', ctrl.getHistory);
router.get('/:id',         ctrl.getOne);
router.post('/',           authorize('admin', 'supervisor', 'operator', 'auxiliar'), validate(createSupplierSchema), ctrl.create);
router.put('/:id',         authorize('admin', 'supervisor'),             validate(updateSupplierSchema), ctrl.update);
router.patch('/:id/toggle', authorize('admin', 'supervisor'),            ctrl.toggleActive);

// Cuentas bancarias
router.get('/:id/bank-accounts',                         ctrl.listBankAccounts);
router.post('/:id/bank-accounts',                        authorize('admin', 'supervisor', 'auxiliar'), ctrl.addBankAccount);
router.put('/:id/bank-accounts/:accountId',              authorize('admin', 'supervisor'), ctrl.updateBankAccount);
router.delete('/:id/bank-accounts/:accountId',           authorize('admin', 'supervisor'), ctrl.deleteBankAccount);
router.patch('/:id/bank-accounts/:accountId/set-default', authorize('admin', 'supervisor'), ctrl.setDefaultBankAccount);

// Líneas de crédito
router.get('/:id/credit-lines',                   creditCtrl.listCreditLines);
router.post('/:id/credit-lines',                  authorize('admin', 'supervisor'), validate(createCreditLineSchema), creditCtrl.createCreditLine);
router.put('/:id/credit-lines/:lineId',           authorize('admin', 'supervisor'), validate(updateCreditLineSchema), creditCtrl.updateCreditLine);
router.patch('/:id/credit-lines/:lineId/toggle',  authorize('admin', 'supervisor'), creditCtrl.toggleCreditLine);
router.get('/:id/credit-lines/:lineId/balance',   creditCtrl.getBalance);
router.get('/:id/credit-lines/:lineId/payments',  creditCtrl.listPayments);
router.post('/:id/credit-lines/:lineId/payments', authorize('admin', 'supervisor'), validate(addPaymentSchema), creditCtrl.addPayment);

export default router;
