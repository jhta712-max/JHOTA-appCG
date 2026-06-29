import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { addLog } from '../../middlewares/requestLogger';

const router = Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Demasiados reportes enviados. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', reportLimiter, async (req: Request, res: Response) => {
  const { message, statusCode, endpoint, userDescription } = req.body as {
    message?: string;
    statusCode?: number;
    endpoint?: string;
    userDescription?: string;
  };

  if (!message) {
    res.status(400).json({ success: false, error: 'message es requerido' });
    return;
  }

  const user = (req as any).user;
  const userName = user?.name ?? user?.email ?? 'Anónimo';
  const userId   = user?.userId ?? undefined;

  const now = new Date();
  const hora = now.toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  addLog({
    level:    'warn',
    category: 'user_report',
    message:  `Reporte de error de ${userName}: ${message}`,
    details:  { statusCode, endpoint, userDescription, userId },
    userId,
  });

  const dest = env.BACKUP_EMAIL ?? env.GMAIL_USER;

  if (env.RESEND_API_KEY && dest) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(env.RESEND_API_KEY);
      const from   = env.RESEND_FROM ?? 'JHOTA Construcciones <onboarding@resend.dev>';

      const html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:32px 16px;}
.card{background:#fff;max-width:520px;margin:0 auto;border-radius:8px;overflow:hidden;}
.header{background:#1C1C1C;padding:20px 24px;}
.header h1{color:#F5C218;font-size:18px;margin:0;}
.body{padding:24px;}
.row{margin-bottom:12px;font-size:14px;color:#374151;}
.label{font-weight:700;color:#1C1C1C;}
.desc{background:#FEF9E7;border:1px solid #F5C218;border-radius:6px;padding:12px;font-size:14px;color:#374151;margin-top:16px;}
.footer{padding:16px 24px;background:#f9fafb;font-size:12px;color:#9ca3af;}</style>
</head><body><div class="card">
<div class="header"><h1>🚨 Error reportado por usuario</h1></div>
<div class="body">
  <div class="row"><span class="label">Usuario:</span> ${userName}</div>
  <div class="row"><span class="label">Hora:</span> ${hora}</div>
  <div class="row"><span class="label">Ruta:</span> ${endpoint ?? 'desconocida'}</div>
  <div class="row"><span class="label">Error (${statusCode ?? '?'}):</span> ${message}</div>
  ${userDescription ? `<div class="desc"><strong>Descripción del usuario:</strong><br/>${userDescription}</div>` : ''}
</div>
<div class="footer">Reporte automático — JHOTA Construcciones</div>
</div></body></html>`;

      await resend.emails.send({
        from,
        to:      dest,
        subject: `🚨 Error reportado — ${endpoint ?? 'app'} (${statusCode ?? '?'})`,
        html,
      });
    } catch (mailErr: any) {
      console.error('[ErrorReport] Email failed:', mailErr.message);
    }
  }

  res.json({ success: true, message: 'Reporte enviado al administrador' });
});

export default router;
