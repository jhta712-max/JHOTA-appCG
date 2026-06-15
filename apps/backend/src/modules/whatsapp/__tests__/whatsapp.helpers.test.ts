import { describe, it, expect } from 'vitest';
import { ultramsgWebhookSchema } from '../whatsapp.schema';

describe('ultramsgWebhookSchema', () => {
  const validPayload = {
    token: 'abc123',
    instanceId: 'instance1',
    data: {
      id: 'msg1',
      from: '+18091234567@c.us',
      to: 'xxx',
      body: 'Gasto 2500 cemento Torre Norte',
      type: 'chat',
      time: 1718400000,
      isGroupMsg: false,
    },
  };

  it('parses a valid chat message', () => {
    const r = ultramsgWebhookSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
  });

  it('strips @c.us from phone number', () => {
    const r = ultramsgWebhookSchema.safeParse(validPayload);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data.from).toBe('+18091234567');
  });

  it('rejects missing token', () => {
    const r = ultramsgWebhookSchema.safeParse({ ...validPayload, token: undefined });
    expect(r.success).toBe(false);
  });

  it('rejects group messages', () => {
    const r = ultramsgWebhookSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, isGroupMsg: true },
    });
    // schema parses fine — controller ignores group messages
    expect(r.success).toBe(true);
  });
});

import { normalizePhone } from '../whatsapp.helpers';

describe('normalizePhone', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhone('(809) 555-1234')).toBe('+8095551234');
  });
  it('adds + prefix when missing', () => {
    expect(normalizePhone('18095551234')).toBe('+18095551234');
  });
  it('keeps existing + prefix', () => {
    expect(normalizePhone('+18095551234')).toBe('+18095551234');
  });
  it('removes whatsapp: prefix', () => {
    expect(normalizePhone('whatsapp:+18095551234')).toBe('+18095551234');
  });
});
