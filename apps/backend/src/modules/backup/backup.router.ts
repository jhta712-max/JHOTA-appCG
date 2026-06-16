import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import nodemailer from 'nodemailer';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import prisma           from '../../config/database';
import { env }          from '../../config/env';

const router = Router();

// Convierte BigInt a string para serialización JSON
const bigIntReplacer = (_key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;


async function generateBackup() {
  const safe = async (fn: () => Promise<any[]>) => { try { return await fn(); } catch { return []; } };

  const [
    roles, users, projects, projectAssignments, projectAddendums, projectCubicaciones,
    projectAnticipos, projectItems, projectCategoryBudgets,
    expenseCategories, expenses, fiscalVouchers, attachments, companyCards,
    auditLogs, invitations,
    payrolls, payrollLines, paymentOrders,
    batches, batchItems,
    suppliers, supplierBankAccounts, supplierCreditLines, supplierCreditPayments,
    quotations, quotationPayments, quotationExpenseLinks, quotationAttachments,
    officeExpenses,
    serviceSubscriptions,
    contratosAjustados, contratosAjustadosAdendas, contratosAjustadosPagos,
    notifications, notificationContacts,
    whatsappConversations, whatsappMessages,
  ] = await Promise.all([
    safe(() => prisma.role.findMany()),
    safe(() => prisma.user.findMany({ select: { id:true, name:true, email:true, roleId:true, isActive:true, phone:true, whatsappOptIn:true, notifTypes:true, createdAt:true } })),
    safe(() => prisma.project.findMany()),
    safe(() => prisma.projectAssignment.findMany()),
    safe(() => prisma.projectAddendum.findMany()),
    safe(() => prisma.projectCubicacion.findMany()),
    safe(() => prisma.projectAnticipo.findMany()),
    safe(() => prisma.projectItem.findMany()),
    safe(() => prisma.projectCategoryBudget.findMany()),
    safe(() => prisma.expenseCategory.findMany()),
    safe(() => prisma.expense.findMany()),
    safe(() => prisma.fiscalVoucher.findMany()),
    safe(() => prisma.attachment.findMany()),
    safe(() => prisma.companyCard.findMany()),
    safe(() => prisma.auditLog.findMany({ take: 1000, orderBy: { createdAt: 'desc' } })),
    safe(() => prisma.invitation.findMany()),
    safe(() => prisma.payroll.findMany()),
    safe(() => prisma.payrollLine.findMany()),
    safe(() => prisma.paymentOrder.findMany()),
    safe(() => prisma.batch.findMany()),
    safe(() => prisma.batchItem.findMany()),
    safe(() => prisma.supplier.findMany()),
    safe(() => prisma.supplierBankAccount.findMany()),
    safe(() => prisma.supplierCreditLine.findMany()),
    safe(() => prisma.supplierCreditPayment.findMany()),
    safe(() => prisma.quotation.findMany()),
    safe(() => prisma.quotationPayment.findMany()),
    safe(() => prisma.quotationExpenseLink.findMany()),
    safe(() => prisma.quotationAttachment.findMany()),
    safe(() => prisma.officeExpense.findMany()),
    safe(() => prisma.serviceSubscription.findMany()),
    safe(() => prisma.contratoAjustado.findMany()),
    safe(() => prisma.contratoAjustadoAdenda.findMany()),
    safe(() => prisma.contratoAjustadoPago.findMany()),
    safe(() => prisma.notification.findMany({ take: 500, orderBy: { createdAt: 'desc' } })),
    safe(() => prisma.notificationContact.findMany()),
    safe(() => prisma.whatsAppConversation.findMany()),
    safe(() => prisma.whatsAppMessage.findMany({ take: 1000, orderBy: { createdAt: 'desc' } })),
  ]);

  const tables = {
    roles, users, projects, projectAssignments, projectAddendums, projectCubicaciones,
    projectAnticipos, projectItems, projectCategoryBudgets,
    expenseCategories, expenses, fiscalVouchers, attachments, companyCards,
    auditLogs, invitations,
    payrolls, payrollLines, paymentOrders,
    batches, batchItems,
    suppliers, supplierBankAccounts, supplierCreditLines, supplierCreditPayments,
    quotations, quotationPayments, quotationExpenseLinks, quotationAttachments,
    officeExpenses,
    serviceSubscriptions,
    contratosAjustados, contratosAjustadosAdendas, contratosAjustadosPagos,
    notifications, notificationContacts,
    whatsappConversations, whatsappMessages,
  };

  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(tables)) counts[k] = (v as any[]).length;
  return { tables, counts };
}

// GET /api/v1/backup/export — descarga manual (JWT admin)
router.get('/export', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  console.log('[BACKUP] export by user:', (req as any).user?.userId);
  try {
    const { tables, counts } = await generateBackup();
    const filename = 'backup_servingmi_' + new Date().toISOString().slice(0, 10) + '.json';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), version: '3.0', database: 'servingmi', counts, tables }, bigIntReplacer));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/backup/auto — cron-job.org (x-backup-secret)
router.post('/auto', async (req: Request, res: Response) => {
  const secret = (req.headers['x-backup-secret'] as string) ?? '';
  const expected = env.BACKUP_SECRET_KEY ?? '';
  const secretBuf   = Buffer.from(secret);
  const expectedBuf = Buffer.from(expected);
  const valid = expected.length > 0
    && secretBuf.length === expectedBuf.length
    && timingSafeEqual(secretBuf, expectedBuf);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Clave invalida' }); return;
  }
  try {
    const { tables, counts } = await generateBackup();
    const backup   = JSON.stringify({ exportedAt: new Date().toISOString(), version: '3.0', counts, tables }, bigIntReplacer);
    const filename = 'backup_servingmi_' + new Date().toISOString().slice(0, 10) + '.json';
    const dest     = env.BACKUP_EMAIL ?? env.GMAIL_USER;

    let emailSent  = false;
    let emailError = '';
    if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD && dest) {
      try {
        const t = nodemailer.createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } });
        await t.sendMail({
          from: '"Backup SERVINGMI" <' + env.GMAIL_USER + '>',
          to: dest,
          subject: 'Backup automatico ' + new Date().toISOString().slice(0, 10),
          text: 'Registros: ' + JSON.stringify(counts),
          attachments: [{ filename, content: Buffer.from(backup), contentType: 'application/json' }],
        });
        emailSent = true;
      } catch (mailErr: any) {
        emailError = mailErr.message;
        console.error('[BACKUP] Email failed:', mailErr.message);
      }
    }

    res.json({ success: true, counts, emailSent, emailError: emailError || undefined });
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
