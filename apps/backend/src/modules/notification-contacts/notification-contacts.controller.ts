import { Request, Response, NextFunction } from 'express';
import * as service from './notification-contacts.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listContacts();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.createContact(req.body, req.user!.userId);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.updateContact(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
