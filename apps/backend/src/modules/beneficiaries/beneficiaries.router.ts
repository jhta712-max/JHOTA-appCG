import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listBeneficiaries, getBeneficiary,
  createBeneficiary, updateBeneficiary, deactivateBeneficiary,
  bulkCreateBeneficiaries,
} from './beneficiaries.controller';

const router: any = Router();
router.use(authenticate);
router.use(authorize('admin', 'supervisor'));

router.get('/',          listBeneficiaries);
router.get('/:id',       getBeneficiary);
router.post('/',         createBeneficiary);
router.post('/bulk',     bulkCreateBeneficiaries);
router.put('/:id',       updateBeneficiary);
router.delete('/:id',    deactivateBeneficiary);

export default router;
