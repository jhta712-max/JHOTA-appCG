import { Request, Response, NextFunction } from 'express';
import * as service from './notifications.service';

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
