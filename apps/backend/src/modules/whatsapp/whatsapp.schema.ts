import { z } from 'zod';

export const ultramsgWebhookSchema = z.object({
  token:      z.string(),
  instanceId: z.string(),
  data: z.object({
    id:         z.string(),
    // UltraMsg sometimes appends "@c.us" or "@s.whatsapp.net" — strip it
    from:       z.string().transform(v => v.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '')),
    to:         z.string(),
    author:     z.string().optional(),
    pushname:   z.string().optional(),
    body:       z.string().default(''),
    type:       z.string(),
    time:       z.number(),
    isGroupMsg: z.boolean().default(false),
  }),
});

export type UltramsgWebhookPayload = z.infer<typeof ultramsgWebhookSchema>;
