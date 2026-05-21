import { Router }       from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  listBeneficiaries, getBeneficiary,
  createBeneficiary, updateBeneficiary, deactivateBeneficiary,
} from './beneficiaries.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'supervisor'));

router.get('/',     listBeneficiaries);
router.get('/:id',  getBeneficiary);
router.post('/',    createBeneficiary);
router.put('/:id',  updateBeneficiary);
router.delete('/:id', deactivateBeneficiary);

export default router;
