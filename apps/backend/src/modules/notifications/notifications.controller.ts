import { Request, Response, NextFunction } from 'express';
import * as service from './notifications.service';
import { runBusinessNotifications } from '../../jobs/businessNotifications';
import { AppError } from '../../middlewares/errorHandler';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getUserNotifications(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await service.getUnreadCount(req.user!.userId);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await service.markAsRead(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await service.markAllAsRead(req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function runChecks(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Solo administradores', 'FORBIDDEN');
    await runBusinessNotifications();
    res.json({ success: true, message: 'Revisión de alertas ejecutada. Revisa los logs para detalles.' });
  } catch (err) { next(err); }
}

export async function testWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Solo administradores', 'FORBIDDEN');
    await service.sendTestWhatsApp();
    res.json({ success: true, message: 'Mensaje de prueba enviado. Revisa tu WhatsApp.' });
  } catch (err) { next(err); }
}

export async function whatsappRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== 'admin') throw new AppError(403, 'Solo administradores', 'FORBIDDEN');
    const recipients = await service.getWhatsAppRecipients();
    res.json({ success: true, data: { recipients } });
  } catch (err) { next(err); }
}
