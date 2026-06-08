import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listPaymentOrders, getPaymentOrder,
  getAvailablePayrolls, getAvailableExpenses, getAvailableContracts,
  createPaymentOrder, updatePaymentOrder,
  linkExpense, unlinkExpense,
  linkPayroll, unlinkPayroll,
  markAsPaid, revertToPending, voidPaymentOrder,
  generateExpense, hardDeletePaymentOrder,
} from './payment-orders.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'supervisor'));

router.get('/',                       listPaymentOrders);
router.get('/available-payrolls',     getAvailablePayrolls);
router.get('/available-expenses',     getAvailableExpenses);
router.get('/available-contracts',    getAvailableContracts);
router.get('/:id',                    getPaymentOrder);
router.post('/',                      createPaymentOrder);
router.put('/:id',                    updatePaymentOrder);
router.post('/:id/link-expense',      linkExpense);
router.delete('/:id/link-expense',    unlinkExpense);
router.post('/:id/link-payroll',      linkPayroll);
router.delete('/:id/link-payroll',    unlinkPayroll);
router.post('/:id/pay',               markAsPaid);
router.post('/:id/generate-expense',  generateExpense);
router.post('/:id/revert-to-pending', authorize('admin'), revertToPending);
router.post('/:id/void',              voidPaymentOrder);
router.delete('/:id',                 authorize('admin'), hardDeletePaymentOrder);

export default router;
