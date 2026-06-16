import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { getDashboardAlerts } from './dashboard.service';

const router = Router();
router.use(authenticate);

router.get('/alerts', async (req, res, next) => {
  try {
    const data = await getDashboardAlerts(req.user!.userId, req.user!.role);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
