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
      roles,
      projects,
      projectAssignments,
      projectAddendums,
      projectCubicaciones,
      expenseCategories,
      expenses,
      fiscalVouchers,
      attachments,
      companyCards,
      auditLogs,
      invitations,
      payrolls,
      payrollLines,
      systemLogs,
      healthChecks,
      quotations,
      quotationPayments,
      quotationExpenseLinks,
      quotationAttachments,
      beneficiaries,
      paymentOrders,
      officeExpenses,
      users,
    ] = await Promise.all([
      prisma.role.findMany(),
      prisma.project.findMany(),
      prisma.projectAssignment.findMany(),
      prisma.projectAddendum.findMany(),
      prisma.projectCubicacion.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.expense.findMany(),
      prisma.fiscalVoucher.findMany(),
      prisma.attachment.findMany(),
      prisma.companyCard.findMany(),
      prisma.auditLog.findMany(),
      prisma.invitation.findMany(),
      prisma.payroll.findMany(),
      prisma.payrollLine.findMany(),
      prisma.systemLog.findMany({ take: 1000, orderBy: { createdAt: 'desc' } }),
      prisma.healthCheckResult.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.quotation.findMany(),
      prisma.quotationPayment.findMany(),
      prisma.quotationExpenseLink.findMany(),
      prisma.quotationAttachment.findMany(),
      prisma.beneficiary.findMany(),
      prisma.paymentOrder.findMany(),
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
      version:    '2.0',
      database:   'servingmi',
      counts: {
        roles:                   roles.length,
        users:                   users.length,
        projects:                projects.length,
        projectAssignments:      projectAssignments.length,
        projectAddendums:        projectAddendums.length,
        projectCubicaciones:     projectCubicaciones.length,
        expenseCategories:       expenseCategories.length,
        expenses:                expenses.length,
        fiscalVouchers:          fiscalVouchers.length,
        attachments:             attachments.length,
        companyCards:            companyCards.length,
        auditLogs:               auditLogs.length,
        invitations:             invitations.length,
        payrolls:                payrolls.length,
        payrollLines:            payrollLines.length,
        beneficiaries:           beneficiaries.length,
        paymentOrders:           paymentOrders.length,
        quotations:              quotations.length,
        quotationPayments:       quotationPayments.length,
        quotationExpenseLinks:   quotationExpenseLinks.length,
        quotationAttachments:    quotationAttachments.length,
        officeExpenses:          officeExpenses.length,
        systemLogs:              systemLogs.length,
        healthChecks:            healthChecks.length,
      },
      tables: {
        roles, users, projects, projectAssignments, projectAddendums,
        projectCubicaciones, expenseCategories, expenses, fiscalVouchers,
        attachments, companyCards, auditLogs, invitations, payrolls, payrollLines,
        quotations, quotationPayments, quotationExpenseLinks, quotationAttachments,
        beneficiaries, paymentOrders, officeExpenses, systemLogs, healthChecks,
      },
    };

    const filename = 'backup_servingmi_' + new Date().toISOString().slice(0, 10) + '.json';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
