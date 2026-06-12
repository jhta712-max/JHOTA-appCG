import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import {
  generateProjectExpensesExcel,
  generateFiscalReportExcel,
  generateProjectsSummaryExcel,
  generateProjectPDF,
  generateFullExpensesExcel,
  generate606Excel,
} from './reports.service';

const router = Router();

// Todos los reportes requieren autenticación y rol admin o supervisor
router.use(authenticate);
router.use(authorize('admin', 'supervisor'));

// ── GET /reports/projects/summary.xlsx
// Resumen financiero de todos los proyectos
router.get('/projects/summary.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateProjectsSummaryExcel(res);
  } catch (err) { next(err); }
});

// ── GET /reports/projects/:id/expenses.xlsx
// Gastos de un proyecto específico en Excel
router.get('/projects/:id/expenses.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateProjectExpensesExcel({
      projectId: req.params.id,
      startDate: req.query.startDate as string,
      endDate:   req.query.endDate   as string,
      status:    (req.query.status as string) || 'ACTIVE',
    }, res);
  } catch (err) { next(err); }
});

// ── GET /reports/projects/:id/expenses.pdf
// Gastos de un proyecto específico en PDF
router.get('/projects/:id/expenses.pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateProjectPDF({
      projectId: req.params.id,
      startDate: req.query.startDate as string,
      endDate:   req.query.endDate   as string,
      status:    (req.query.status as string) || 'ACTIVE',
    }, res);
  } catch (err) { next(err); }
});

// ── GET /reports/fiscal.xlsx
// Reporte de comprobantes fiscales (NCF) — útil para DGII
router.get('/fiscal.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateFiscalReportExcel({
      projectId: req.query.projectId as string,
      startDate: req.query.startDate as string,
      endDate:   req.query.endDate   as string,
    }, res);
  } catch (err) { next(err); }
});

// ── GET /reports/expenses/complete.xlsx
// Exportación completa multi-hoja: Gastos + Por Proyecto + Por Categoría + NCF
// Solo admin y supervisor (ya protegido por middleware global arriba)
router.get('/expenses/complete.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateFullExpensesExcel({
      projectId:     req.query.projectId    as string | undefined,
      categoryId:    req.query.categoryId   as string | undefined,
      paymentMethod: req.query.paymentMethod as string | undefined,
      status:        req.query.status        as string | undefined,
      startDate:     req.query.startDate     as string | undefined,
      endDate:       req.query.endDate       as string | undefined,
    }, res);
  } catch (err) { next(err); }
});

// ── GET /reports/606.xlsx?year=2026&month=5
// Formato 606 DGII: compras con comprobante fiscal del mes
router.get('/606.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now   = new Date();
    const year  = Number(req.query.year)  || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'Período inválido', code: 'INVALID_PERIOD' });
      return;
    }
    await generate606Excel(year, month, res);
  } catch (err) { next(err); }
});

export default router;
