import { env } from '../../config/env';
import prisma from '../../config/database';

// ── Phone normalization ────────────────────────────────────────
export function normalizePhone(raw: string): string {
  let phone = raw
    .replace(/^whatsapp:/i, '')
    .replace(/[\s\-().]/g, '');
  if (!phone.startsWith('+')) phone = '+' + phone;
  return phone;
}

// ── Send a WhatsApp reply via UltraMsg ─────────────────────────
export async function sendWhatsAppReply(to: string, message: string): Promise<void> {
  const instanceId = env.ULTRAMSG_INSTANCE_ID;
  const token      = env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    console.warn('[whatsapp] ULTRAMSG_INSTANCE_ID or ULTRAMSG_TOKEN not set — skipping reply');
    return;
  }
  const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
  const body = new URLSearchParams({ token, to, body: message });
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      console.error('[whatsapp] UltraMsg error:', resp.status, await resp.text());
    }
  } catch (err) {
    console.error('[whatsapp] Failed to send reply:', err);
  }
}

// ── Lookup a user by normalized phone ─────────────────────────
// User.role is a Relation (Role model), not a string — access .role.name
export async function lookupUserByPhone(phone: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, phone: true, role: { select: { name: true } } },
  });
  const found = users.find(u => u.phone && normalizePhone(u.phone) === phone) ?? null;
  if (!found) return null;
  return { id: found.id, name: found.name, phone: found.phone, roleName: found.role.name };
}

// ── Find or create a WhatsApp conversation ─────────────────────
export async function findOrCreateConversation(phone: string, userId?: string) {
  const existing = await prisma.whatsAppConversation.findFirst({
    where: { phoneNumber: phone, status: 'ACTIVE' },
  });
  if (existing) return existing;
  return prisma.whatsAppConversation.create({
    data: { phoneNumber: phone, userId: userId ?? null, contextData: {} },
  });
}

// ── Save a message in the conversation log ─────────────────────
export async function saveMessage(
  conversationId: string,
  direction: 'incoming' | 'outgoing',
  content: string,
  aiIntent?: string,
) {
  return prisma.whatsAppMessage.create({
    data: { conversationId, direction, content, aiIntent: aiIntent ?? null, processed: true },
  });
}

// ── Audit log ──────────────────────────────────────────────────
export async function logAudit(
  action: string,
  entityType: string | null,
  entityId: string | null,
  requestPayload: object,
  responsePayload: object,
) {
  try {
    await prisma.whatsAppAuditLog.create({
      data: { action, entityType, entityId, requestPayload, responsePayload },
    });
  } catch (err) {
    console.error('[whatsapp] Audit log failed:', err);
  }
}
