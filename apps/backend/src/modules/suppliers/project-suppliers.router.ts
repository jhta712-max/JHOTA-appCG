import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  listProjectSuppliers,
  assignSupplierToProject,
  removeSupplierFromProject,
  importFromPayments,
} from './project-suppliers.service';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listProjectSuppliers(req.params.projectId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

router.post('/', authorize('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ success: false, error: 'supplierId requerido' });
    const data = await assignSupplierToProject(req.params.projectId, supplierId);
    res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Suplidor ya asignado a este proyecto' });
    if (e.code === 'P2003') return res.status(404).json({ success: false, error: 'Suplidor o proyecto no encontrado' });
    res.status(500).json({ success: false, error: 'Error asignando suplidor' });
  }
});

router.post('/import-from-payments', authorize('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await importFromPayments(req.params.projectId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Error importando suplidores' });
  }
});

router.delete('/:supplierId', authorize('admin', 'supervisor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeSupplierFromProject(req.params.projectId, req.params.supplierId);
    res.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Asignación no encontrada' });
    next(e);
  }
});

export default router;
