import type { Request, Response, NextFunction } from 'express';
import * as cardsService from './cards.service';
import { createCardSchema, updateCardSchema } from './cards.schema';

export async function listCards(req: Request, res: Response, next: NextFunction) {
  try {
    const onlyActive = req.query.active === 'true';
    const cards = await cardsService.getCards(onlyActive);
    res.json({ success: true, data: cards });
  } catch (err) { next(err); }
}

export async function getCard(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.getCardById(Number(req.params.id));
    res.json({ success: true, data: card });
  } catch (err) { next(err); }
}

export async function createCard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createCardSchema.parse(req.body);
    const card = await cardsService.createCard(data);
    res.status(201).json({ success: true, data: card });
  } catch (err) { next(err); }
}

export async function updateCard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateCardSchema.parse(req.body);
    const card = await cardsService.updateCard(Number(req.params.id), data);
    res.json({ success: true, data: card });
  } catch (err) { next(err); }
}

export async function deactivateCard(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.deactivateCard(Number(req.params.id));
    res.json({ success: true, data: card });
  } catch (err) { next(err); }
}
