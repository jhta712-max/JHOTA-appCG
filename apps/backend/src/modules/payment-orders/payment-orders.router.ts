import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listPaymentOrders, getPaymentOrder,
  getAvailablePayrolls, getAvailableExpenses, getAvailableContracts, getAvailableQuotations,
  createPaymentOrder, updatePaymentOrder,
  linkExpense, unlinkExpense,
  linkPayroll, unlinkPayroll,
  markAsPaid, revertToPending, voidPaymentOrder,
  generateExpense, hardDeletePaymentOrder,
} from './payment-orders.controller';

const router = Router();
router.use(authenticate);
// Auxiliar y financiero pueden ver y crear; PUT/acciones destructivas tienen restricciones propias
router.use(authorize('admin', 'supervisor', 'auxiliar', 'financiero'));

router.get('/',                       listPaymentOrders);
router.get('/available-payrolls',     getAvailablePayrolls);
router.get('/available-expenses',     getAvailableExpenses);
router.get('/available-contracts',    getAvailableContracts);
router.get('/available-quotations',   getAvailableQuotations);
router.get('/:id',                    getPaymentOrder);
router.post('/',                      createPaymentOrder);
router.put('/:id',                    authorize('admin', 'supervisor', 'financiero'), updatePaymentOrder);
router.post('/:id/link-expense',      linkExpense);
router.delete('/:id/link-expense',    authorize('admin', 'supervisor'), unlinkExpense);
router.post('/:id/link-payroll',      linkPayroll);
router.delete('/:id/link-payroll',    authorize('admin', 'supervisor'), unlinkPayroll);
router.post('/:id/pay',               markAsPaid);
router.post('/:id/generate-expense',  authorize('admin', 'supervisor'), generateExpense);
router.post('/:id/revert-to-pending', authorize('admin'), revertToPending);
router.post('/:id/void',              authorize('admin', 'supervisor'), voidPaymentOrder);
router.delete('/:id',                 authorize('admin'), hardDeletePaymentOrder);

export default router;
