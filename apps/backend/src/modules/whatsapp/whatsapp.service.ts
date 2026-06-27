import prisma from '../../config/database';
import { createExpense } from '../expenses/expenses.service';
import { createProject } from '../projects/projects.service';
import { createPaymentOrder } from '../payment-orders/payment-orders.service';
import type { ConversationMessage, ConfirmationPayload } from './whatsapp.agent';
import { runAgent } from './whatsapp.agent';
import {
  normalizePhone,
  sendWhatsAppReply,
  lookupUserByPhone,
  findOrCreateConversation,
  saveMessage,
  logAudit,
} from './whatsapp.helpers';

type ConversationContext = {
  conversationHistory:  ConversationMessage[];
  pendingConfirmation:  ConfirmationPayload | null;
  awaitingConfirmation: boolean;
};

const CONFIRMATION_YES = /^(s[ií]|yes|ok|confirmar|confirm|claro|dale)/i;
const CONFIRMATION_NO  = /^(no|cancel|cancelar|nope)/i;
const MAX_HISTORY = 10;

async function executeConfirmedAction(
  confirmation: ConfirmationPayload,
  userId: string,
  userRole: string,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const PRIVILEGED_ROLES = ['admin', 'supervisor'];

  if (confirmation.intent === 'CREATE_EXPENSE') {
    const p = confirmation.payload as {
      projectId: string; amount: number; description: string;
      categoryId: number; paymentMethod: string;
    };
    const expense = await createExpense(
      {
        projectId:     p.projectId,
        categoryId:    p.categoryId,
        expenseDate:   today,
        amount:        p.amount,
        description:   p.description,
        paymentMethod: (p.paymentMethod ?? 'CASH') as 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER',
        hasFiscalDoc:  false,
      },
      userId,
      userRole,
    );
    await logAudit('CREATE_EXPENSE', 'expense', expense.id, p, { id: expense.id });
    return `✅ Gasto registrado.\nID: ${expense.id.substring(0, 8)}...\nMonto: RD$${Number(p.amount).toLocaleString('es-DO')}`;
  }

  if (confirmation.intent === 'CREATE_PROJECT' && !['admin', 'supervisor'].includes(userRole)) {
    return 'No tienes permisos para crear proyectos.';
  }

  if (confirmation.intent === 'CREATE_PAYMENT_ORDER' && !['admin', 'supervisor'].includes(userRole)) {
    return 'No tienes permisos para generar órdenes de pago.';
  }

  if (confirmation.intent === 'CREATE_PAYMENT_ORDER') {
    if (!PRIVILEGED_ROLES.includes(userRole)) {
      return '❌ No tienes permisos para crear órdenes de pago. Contacta a un administrador.';
    }
    const p = confirmation.payload as {
      supplierId: string; projectId: string; amount: number;
      concept: string; orderType: string; payingCompany: string; currency: string;
    };
    const order = await createPaymentOrder(
      {
        supplierId:    p.supplierId,
        projectId:     p.projectId,
        amount:        p.amount,
        concept:       p.concept,
        orderType:     (p.orderType ?? 'SERVICIO') as 'SERVICIO' | 'PAYROLL' | 'MATERIALS' | 'PETTY_CASH',
        payingCompany: p.payingCompany ?? 'JHOTA Construcciones',
        currency:      (p.currency ?? 'RD$') as 'RD$' | 'US$' | '€',
      },
      userId,
    );
    await logAudit('CREATE_PAYMENT_ORDER', 'payment_order', order.id, p, { id: order.id });
    return `✅ Orden de pago #${(order as { number: number }).number} creada.\nMonto: ${p.currency ?? 'RD$'}${Number(p.amount).toLocaleString('es-DO')}\nConcepto: ${p.concept}`;
  }

  if (confirmation.intent === 'CREATE_PROJECT') {
    if (!PRIVILEGED_ROLES.includes(userRole)) {
      return '❌ No tienes permisos para crear proyectos. Contacta a un administrador.';
    }
    const p = confirmation.payload as { name: string; code: string; startDate?: string };
    const project = await createProject(
      {
        name:            p.name,
        code:            p.code,
        startDate:       p.startDate ?? today,
        estimatedBudget: 0,
      },
      userId,
    );
    await logAudit('CREATE_PROJECT', 'project', project.id, p, { id: project.id });
    return `✅ Proyecto creado.\nNombre: ${project.name}\nCódigo: ${project.code}`;
  }

  return 'Acción completada.';
}

export async function processIncomingMessage(phone: string, body: string): Promise<void> {
  const normalizedPhone = normalizePhone(phone);
  const user = await lookupUserByPhone(normalizedPhone);

  if (!user) {
    await sendWhatsAppReply(
      normalizedPhone,
      '❌ No encontré una cuenta asociada a este número. Contacta al administrador.',
    );
    return;
  }

  const conversation = await findOrCreateConversation(normalizedPhone, user.id);
  await saveMessage(conversation.id, 'incoming', body);

  const ctx = (conversation.contextData as ConversationContext | null) ?? {
    conversationHistory:  [],
    pendingConfirmation:  null,
    awaitingConfirmation: false,
  };

  let replyText: string;

  if (ctx.awaitingConfirmation && ctx.pendingConfirmation) {
    if (CONFIRMATION_YES.test(body.trim())) {
      try {
        replyText = await executeConfirmedAction(ctx.pendingConfirmation, user.id, user.roleName ?? 'operator');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        replyText = `❌ Error al ejecutar: ${msg}`;
      }
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;
    } else if (CONFIRMATION_NO.test(body.trim())) {
      replyText = '❌ Operación cancelada. ¿En qué más te puedo ayudar?';
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;
    } else {
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;
      const result = await runAgent(ctx.conversationHistory, body);
      replyText = handleAgentResult(result, ctx);
    }
  } else {
    const result = await runAgent(ctx.conversationHistory, body);
    replyText = handleAgentResult(result, ctx);
  }

  ctx.conversationHistory.push({ role: 'user', content: body });
  ctx.conversationHistory.push({ role: 'assistant', content: replyText });
  if (ctx.conversationHistory.length > MAX_HISTORY) {
    ctx.conversationHistory = ctx.conversationHistory.slice(-MAX_HISTORY);
  }

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data:  { contextData: ctx as object, updatedAt: new Date() },
  });

  await sendWhatsAppReply(normalizedPhone, replyText);
  await saveMessage(conversation.id, 'outgoing', replyText);
}

function handleAgentResult(
  result: { replyText: string; confirmation: ConfirmationPayload | null },
  ctx: ConversationContext,
): string {
  if (result.confirmation) {
    ctx.pendingConfirmation  = result.confirmation;
    ctx.awaitingConfirmation = true;
    return `${result.confirmation.summary}\n\n¿Confirmar? Responde *Sí* o *No*`;
  }
  return result.replyText || 'No pude entender tu solicitud. Intenta de nuevo.';
}
