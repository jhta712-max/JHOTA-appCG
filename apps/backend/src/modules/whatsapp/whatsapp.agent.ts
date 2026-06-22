import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../../config/env';
import prisma from '../../config/database';
import { trackAiCall } from '../../services/ai-usage.service';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? '' });

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export type ConfirmationPayload = {
  intent: 'CREATE_PROJECT' | 'CREATE_EXPENSE' | 'CREATE_PAYMENT_ORDER' | 'QUERY_BALANCE' | 'QUERY_EXPENSES';
  payload: Record<string, unknown>;
  summary: string;
};

const confirmationPayloadSchema = z.object({
  intent: z.enum(['CREATE_PROJECT', 'CREATE_EXPENSE', 'CREATE_PAYMENT_ORDER', 'QUERY_BALANCE', 'QUERY_EXPENSES']),
  payload: z.record(z.unknown()),
  summary: z.string().min(1),
});

// ── Tool definitions Claude can call ──────────────────────────
const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_projects',
    description: 'Lista los proyectos activos. Llama esto para resolver el nombre de un proyecto a su UUID.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_expense_categories',
    description: 'Lista las categorías disponibles para clasificar gastos.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_suppliers',
    description: 'Lista los suplidores activos del catálogo. Úsalo para resolver un nombre de suplidor a su UUID.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_project_balance',
    description: 'Obtiene balance financiero de un proyecto (presupuesto, gastos, disponible).',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'UUID del proyecto' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'request_confirmation',
    description: [
      'Llama esta herramienta ÚNICAMENTE cuando tengas TODOS los datos necesarios para ejecutar una acción.',
      'Para CREATE_EXPENSE necesitas: projectId, amount, description, categoryId, paymentMethod.',
      'Para CREATE_PROJECT necesitas: name, code (generado automáticamente), startDate (hoy).',
      'Para CREATE_PAYMENT_ORDER necesitas: supplierId, projectId, amount, concept, orderType (default SERVICIO), payingCompany (default SERVINGMI), currency (default RD$).',
      'No llames esta herramienta si aún faltan datos — en su lugar responde con una pregunta.',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: {
          type: 'string',
          enum: ['CREATE_PROJECT', 'CREATE_EXPENSE', 'CREATE_PAYMENT_ORDER', 'QUERY_BALANCE', 'QUERY_EXPENSES'],
        },
        payload: {
          type: 'object',
          description: 'Datos completos para la operación',
        },
        summary: {
          type: 'string',
          description: 'Resumen en español legible para mostrar al usuario en el mensaje de confirmación',
        },
      },
      required: ['intent', 'payload', 'summary'],
    },
  },
];

const SYSTEM_PROMPT = `Eres el asistente de gestión financiera de ServingMI.
Los usuarios te contactan por WhatsApp para registrar gastos, crear proyectos y consultar balances.

REGLAS:
- Responde SIEMPRE en español
- Mensajes CORTOS y directos (WhatsApp, no email)
- Para CREATE_EXPENSE, CREATE_PROJECT y CREATE_PAYMENT_ORDER: SIEMPRE llama a request_confirmation antes de ejecutar
- Para consultas (balance, gastos): responde directamente con los datos
- Si faltan datos, haz UNA sola pregunta a la vez
- No inventes proyectos ni categorías — usa las herramientas para obtener los datos reales

PARA GASTOS (CREATE_EXPENSE) necesitas:
1. projectId (usa list_projects para buscar por nombre)
2. amount (número positivo en RD$)
3. description (mínimo 3 caracteres)
4. categoryId (usa list_expense_categories y elige la más apropiada)
5. paymentMethod: por defecto CASH si el usuario no menciona forma de pago

PARA PROYECTOS (CREATE_PROJECT) necesitas:
1. name: el nombre que el usuario indica
2. code: genera automáticamente como primeras 3 letras de cada palabra separadas por "-" (ej. "Torre Norte" → "TOR-NOR"), todo en mayúsculas, máximo 15 chars
3. startDate: la fecha de hoy en formato YYYY-MM-DD

PARA ÓRDENES DE PAGO (CREATE_PAYMENT_ORDER) necesitas:
1. supplierId (usa list_suppliers para buscar por nombre)
2. projectId (usa list_projects para buscar por nombre)
3. amount (número positivo)
4. concept (descripción del pago, mínimo 3 caracteres)
5. orderType: SERVICIO | PAYROLL | MATERIALS | PETTY_CASH — infiere del concepto; default SERVICIO
6. payingCompany: "SERVINGMI" por defecto si el usuario no indica
7. currency: "RD$" | "US$" | "€" — default "RD$"`;

// ── Build Anthropic messages array ─────────────────────────────
export function buildMessages(
  history: ConversationMessage[],
  currentMessage: string,
): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = history.map(h => ({
    role: h.role,
    content: h.content,
  }));
  msgs.push({ role: 'user', content: currentMessage });
  return msgs;
}

// ── Extract confirmation payload from Claude content blocks ────
export function extractConfirmation(
  content: Anthropic.ContentBlock[],
): ConfirmationPayload | null {
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === 'request_confirmation') {
      const parsed = confirmationPayloadSchema.safeParse(block.input);
      if (!parsed.success) {
        console.error('[whatsapp] Invalid confirmation payload from AI:', parsed.error.flatten());
        return null;
      }
      return parsed.data;
    }
  }
  return null;
}

// ── Execute a data-fetching tool (no writes) ───────────────────
async function runTool(name: string, input: Record<string, string>): Promise<string> {
  if (name === 'list_projects') {
    const projects = await prisma.project.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return JSON.stringify(projects);
  }
  if (name === 'list_expense_categories') {
    const cats = await prisma.expenseCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return JSON.stringify(cats);
  }
  if (name === 'list_suppliers') {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, rnc: true },
      orderBy: { name: 'asc' },
    });
    return JSON.stringify(suppliers);
  }
  if (name === 'get_project_balance') {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { name: true, estimatedBudget: true },
    });
    if (!project) return JSON.stringify({ error: 'Proyecto no encontrado' });
    const agg = await prisma.expense.aggregate({
      where: { projectId: input.projectId, status: { not: 'VOIDED' } },
      _sum: { amount: true },
    });
    const total  = Number(agg._sum.amount ?? 0);
    const budget = Number(project.estimatedBudget);
    return JSON.stringify({ name: project.name, budget, totalExpenses: total, available: budget - total });
  }
  return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
}

// ── Extract text from Claude content blocks ────────────────────
function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

// ── Main agent call ────────────────────────────────────────────
export type AgentResult = {
  replyText: string;
  confirmation: ConfirmationPayload | null;
};

export async function runAgent(
  history: ConversationMessage[],
  currentMessage: string,
): Promise<AgentResult> {
  const messages = buildMessages(history, currentMessage);
  let loopMessages = [...messages];

  for (let i = 0; i < 5; i++) {
    const response = await trackAiCall({
      feature: 'WHATSAPP',
      client,
      request: {
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        tools:      AGENT_TOOLS,
        messages:   loopMessages,
      },
    });

    // Check for request_confirmation (no tool result needed — we handle it)
    const confirmation = extractConfirmation(response.content);
    if (confirmation) {
      return { replyText: '', confirmation };
    }

    // Check for data-fetching tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      return { replyText: extractText(response.content), confirmation: null };
    }

    // Execute tools and feed results back
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type:        'tool_result' as const,
        tool_use_id: block.id,
        content:     await runTool(block.name, block.input as Record<string, string>),
      })),
    );

    loopMessages = [
      ...loopMessages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const,      content: toolResults },
    ];
  }

  return { replyText: 'No pude procesar tu solicitud. Intenta de nuevo.', confirmation: null };
}
