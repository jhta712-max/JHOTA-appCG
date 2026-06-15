import { timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { env } from '../../config/env';
import { ultramsgWebhookSchema } from './whatsapp.schema';
import { processIncomingMessage } from './whatsapp.service';

function isValidToken(provided: unknown): boolean {
  try {
    const expected = env.ULTRAMSG_TOKEN;
    if (typeof provided !== 'string' || !expected) return false;
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const raw = req.body;
  if (!raw?.token || !isValidToken(raw.token)) {
    res.status(403).json({ success: false, error: 'Invalid token' });
    return;
  }

  const parsed = ultramsgWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    res.status(200).json({ success: true });
    return;
  }

  const { data } = parsed.data;

  if (data.isGroupMsg || data.type !== 'chat' || !data.body.trim()) {
    res.status(200).json({ success: true });
    return;
  }

  res.status(200).json({ success: true });

  setImmediate(async () => {
    try {
      await processIncomingMessage(data.from, data.body);
    } catch (err) {
      console.error('[whatsapp] processIncomingMessage error:', err);
    }
  });
}
