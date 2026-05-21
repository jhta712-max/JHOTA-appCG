import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listPaymentOrders, getPaymentOrder,
  createPaymentOrder, updatePaymentOrder,
  markAsPaid, voidPaymentOrder,
} from './payment-orders.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'supervisor'));

router.get('/',              listPaymentOrders);
router.get('/:id',           getPaymentOrder);
router.post('/',             createPaymentOrder);
router.put('/:id',           updatePaymentOrder);
router.post('/:id/pay',      markAsPaid);
router.post('/:id/void',     voidPaymentOrder);

export default router;
