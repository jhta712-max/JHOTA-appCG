import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import prisma           from '../../config/database';
import { env }          from '../../config/env';

const router = Router();

async function generateBackup() {
  const safe = async (fn: () => Promise<any[]>) => { try { return await fn(); } catch { return []; } };

  const [
    roles, users, projects, projectAssignments, projectAddendums, projectCubicaciones,
    expenseCategories, expenses, fiscalVouchers, attachments, companyCards, auditLogs,
    invitations, payrolls, payrollLines, beneficiaries, paymentOrders,
    quotations, quotationPayments, quotationExpenseLinks, quotationAttachments,
    officeExpenses,
  ] = await Promise.all([
    safe(() => prisma.role.findMany()),
    safe(() => prisma.user.findMany({ select: { id:true, name:true, email:true, roleId:true, isActive:true, createdAt:true } })),
    safe(() => prisma.project.findMany()),
    safe(() => prisma.projectAssignment.findMany()),
    safe(() => prisma.projectAddendum.findMany()),
    safe(() => prisma.projectCubicacion.findMany()),
    safe(() => prisma.expenseCategory.findMany()),
    safe(() => prisma.expense.findMany()),
    safe(() => prisma.fiscalVoucher.findMany()),
    safe(() => prisma.attachment.findMany()),
    safe(() => prisma.companyCard.findMany()),
    safe(() => prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } })),
    safe(() => prisma.invitation.findMany()),
    safe(() => prisma.payroll.findMany()),
    safe(() => prisma.payrollLine.findMany()),
    safe(() => prisma.beneficiary.findMany()),
    safe(() => prisma.paymentOrder.findMany()),
    safe(() => prisma.quotation.findMany()),
    safe(() => prisma.quotationPayment.findMany()),
    safe(() => prisma.quotationExpenseLink.findMany()),
    safe(() => prisma.quotationAttachment.findMany()),
    safe(() => prisma.officeExpense.findMany()),
  ]);

  const tables = {
    roles, users, projects, projectAssignments, projectAddendums, projectCubicaciones,
    expenseCategories, expenses, fiscalVouchers, attachments, companyCards, auditLogs,
    invitations, payrolls, payrollLines, beneficiaries, paymentOrders,
    quotations, quotationPayments, quotationExpenseLinks, quotationAttachments, officeExpenses,
  };

  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(tables)) counts[k] = (v as any[]).length;
  return { tables, counts };
}

// GET /api/v1/backup/export — descarga manual (JWT admin)
router.get('/export', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
  try {
    const { tables, counts } = await generateBackup();
    const filename = 'backup_servingmi_' + new Date().toISOString().slice(0, 10) + '.json';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.json({ exportedAt: new Date().toISOString(), version: '2.0', database: 'servingmi', counts, tables });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/backup/auto — cron-job.org (x-backup-secret)
router.post('/auto', async (req: Request, res: Response) => {
  const secret = req.headers['x-backup-secret'] as string;
  if (!env.BACKUP_SECRET_KEY || secret !== env.BACKUP_SECRET_KEY) {
    res.status(401).json({ success: false, error: 'Clave invalida' }); return;
  }
  try {
    const { tables, counts } = await generateBackup();
    const backup   = JSON.stringify({ exportedAt: new Date().toISOString(), version: '2.0', counts, tables });
    const filename = 'backup_servingmi_' + new Date().toISOString().slice(0, 10) + '.json';
    const dest     = env.BACKUP_EMAIL ?? env.GMAIL_USER;
    if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD && dest) {
      const t = nodemailer.createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } });
      await t.sendMail({
        from: '"Backup SERVINGMI" <' + env.GMAIL_USER + '>',
        to: dest,
        subject: 'Backup automatico ' + new Date().toISOString().slice(0, 10),
        text: 'Registros: ' + JSON.stringify(counts),
        attachments: [{ filename, content: Buffer.from(backup), contentType: 'application/json' }],
      });
    }
    res.json({ success: true, counts, emailSent: !!dest });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET /api/v1/backup/ping — test sin auth
router.get('/ping', async (_req: Request, res: Response) => {
  try {
    const count = await prisma.expense.count();
    res.json({ ok: true, expenses: count, time: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
