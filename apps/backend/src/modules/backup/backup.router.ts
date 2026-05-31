import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import prisma           from '../../config/database';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/export', async (_req: Request, res: Response) => {
  try {
    const [
      roles, projects, expenseCategories, expenses, fiscalVouchers,
      companyCards, payrolls, payrollLines, beneficiaries, paymentOrders,
      quotations, quotationPayments, officeExpenses,
      users,
    ] = await Promise.all([
      prisma.role.findMany(),
      prisma.project.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.expense.findMany(),
      prisma.fiscalVoucher.findMany(),
      prisma.companyCard.findMany(),
      prisma.payroll.findMany(),
      prisma.payrollLine.findMany(),
      prisma.beneficiary.findMany(),
      prisma.paymentOrder.findMany(),
      prisma.quotation.findMany(),
      prisma.quotationPayment.findMany(),
      prisma.officeExpense.findMany(),
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, roleId: true,
          isActive: true, createdAt: true, updatedAt: true,
        },
      }),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version:    '1.0',
      database:   'servingmi',
      counts: {
        projects:       projects.length,
        expenses:       expenses.length,
        payrolls:       payrolls.length,
        payrollLines:   payrollLines.length,
        paymentOrders:  paymentOrders.length,
        quotations:     quotations.length,
        beneficiaries:  beneficiaries.length,
        officeExpenses: officeExpenses.length,
        users:          users.length,
      },
      tables: {
        roles, users, projects, expenseCategories, expenses, fiscalVouchers,
        companyCards, payrolls, payrollLines, beneficiaries, paymentOrders,
        quotations, quotationPayments, officeExpenses,
      },
    };

    const filename = `backup_servingmi_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
