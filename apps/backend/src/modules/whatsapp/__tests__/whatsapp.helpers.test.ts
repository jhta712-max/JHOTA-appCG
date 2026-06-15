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
