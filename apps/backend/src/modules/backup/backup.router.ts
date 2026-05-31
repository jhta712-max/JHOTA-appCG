import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import prisma           from '../../config/database';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

async function safeQuery(label: string, fn: () => Promise<any[]>): Promise<any[]> {
  try { return await fn(); } catch (e: any) {
    console.error(`Backup: error en tabla ${label} - ${e.message}`);
    return [];
  }
}

router.get('/export', async (_req: Request, res: Response) => {
  try {
    const tables: Record<string, any[]> = {};

    tables.roles                 = await safeQuery('roles',                 () => prisma.role.findMany());
    tables.users                 = await safeQuery('users',                 () => prisma.user.findMany({ select: { id:true, name:true, email:true, roleId:true, isActive:true, createdAt:true, updatedAt:true } }));
    tables.projects              = await safeQuery('projects',              () => prisma.project.findMany());
    tables.projectAssignments    = await safeQuery('projectAssignments',    () => prisma.projectAssignment.findMany());
    tables.projectAddendums      = await safeQuery('projectAddendums',      () => prisma.projectAddendum.findMany());
    tables.projectCubicaciones   = await safeQuery('projectCubicaciones',   () => prisma.projectCubicacion.findMany());
    tables.expenseCategories     = await safeQuery('expenseCategories',     () => prisma.expenseCategory.findMany());
    tables.expenses              = await safeQuery('expenses',              () => prisma.expense.findMany());
    tables.fiscalVouchers        = await safeQuery('fiscalVouchers',        () => prisma.fiscalVoucher.findMany());
    tables.attachments           = await safeQuery('attachments',           () => prisma.attachment.findMany());
    tables.companyCards          = await safeQuery('companyCards',          () => prisma.companyCard.findMany());
    tables.auditLogs             = await safeQuery('auditLogs',             () => prisma.auditLog.findMany());
    tables.invitations           = await safeQuery('invitations',           () => prisma.invitation.findMany());
    tables.payrolls              = await safeQuery('payrolls',              () => prisma.payroll.findMany());
    tables.payrollLines          = await safeQuery('payrollLines',          () => prisma.payrollLine.findMany());
    tables.beneficiaries         = await safeQuery('beneficiaries',         () => prisma.beneficiary.findMany());
    tables.paymentOrders         = await safeQuery('paymentOrders',         () => prisma.paymentOrder.findMany());
    tables.quotations            = await safeQuery('quotations',            () => prisma.quotation.findMany());
    tables.quotationPayments     = await safeQuery('quotationPayments',     () => prisma.quotationPayment.findMany());
    tables.quotationExpenseLinks = await safeQuery('quotationExpenseLinks', () => prisma.quotationExpenseLink.findMany());
    tables.quotationAttachments  = await safeQuery('quotationAttachments',  () => prisma.quotationAttachment.findMany());
    tables.officeExpenses        = await safeQuery('officeExpenses',        () => prisma.officeExpense.findMany());
    tables.systemLogs            = await safeQuery('systemLogs',            () => prisma.systemLog.findMany({ take: 1000, orderBy: { createdAt: 'desc' } }));
    tables.healthChecks          = await safeQuery('healthChecks',          () => prisma.healthCheckResult.findMany({ take: 500, orderBy: { createdAt: 'desc' } }));

    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(tables)) counts[k] = v.length;

    const backup = {
      exportedAt: new Date().toISOString(),
      version:    '2.0',
      database:   'servingmi',
      counts,
      tables,
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
