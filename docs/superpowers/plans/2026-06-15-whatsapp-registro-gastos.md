# WhatsApp — Registro de Gastos y Proyectos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to register expenses, create projects, and query balances by sending WhatsApp messages in natural Spanish, using Claude AI to extract intent and parameters, with mandatory confirmation before any write operation.

**Architecture:** UltraMsg webhook → `POST /api/v1/whatsapp/webhook` (token-validated, no user auth) → async `processIncomingMessage` → Claude AI agent (tool_use) to classify intent and extract data → conversation state machine stores context in `WhatsAppConversation.contextData` → confirmed actions call existing service layer directly. No writes to DB bypassing business logic.

**Tech Stack:** Node.js 24 + Express + TypeScript + Prisma (3 new models) + `@anthropic-ai/sdk` (already installed) + UltraMsg API (already configured)

---

## File Map

```
New files:
  apps/backend/prisma/migrations/20260615000000_add_whatsapp_module/migration.sql
  apps/backend/src/modules/whatsapp/whatsapp.schema.ts    — Zod for webhook payload
  apps/backend/src/modules/whatsapp/whatsapp.helpers.ts   — sendReply, normalizePhone, lookupUser
  apps/backend/src/modules/whatsapp/whatsapp.agent.ts     — Claude tool_use agent
  apps/backend/src/modules/whatsapp/whatsapp.service.ts   — processIncomingMessage state machine
  apps/backend/src/modules/whatsapp/whatsapp.controller.ts
  apps/backend/src/modules/whatsapp/whatsapp.router.ts
  apps/backend/src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts
  apps/backend/src/modules/whatsapp/__tests__/whatsapp.agent.test.ts

Modified files:
  apps/backend/prisma/schema.prisma              — 3 new models + User inverse relation
  apps/backend/src/config/env.ts                 — add WHATSAPP_WEBHOOK_SECRET (optional)
  apps/backend/src/app.ts                        — register whatsappRouter
```

---

## Task 1: Prisma Models + Migration

**Files:**
- Create: `apps/backend/prisma/migrations/20260615000000_add_whatsapp_module/migration.sql`
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Create migration file**

```bash
mkdir -p apps/backend/prisma/migrations/20260615000000_add_whatsapp_module
```

Create `apps/backend/prisma/migrations/20260615000000_add_whatsapp_module/migration.sql`:

```sql
-- WhatsApp integration tables

CREATE TABLE "whatsapp_conversations" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "phone_number" VARCHAR(30)  NOT NULL,
    "user_id"      UUID,
    "status"       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    "context_data" JSONB        NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_messages" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID         NOT NULL,
    "direction"       VARCHAR(10)  NOT NULL,
    "content"         TEXT         NOT NULL,
    "ai_intent"       VARCHAR(50),
    "processed"       BOOLEAN      NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_audit_logs" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "action"           VARCHAR(50)  NOT NULL,
    "entity_type"      VARCHAR(50),
    "entity_id"        VARCHAR(100),
    "request_payload"  JSONB        NOT NULL,
    "response_payload" JSONB        NOT NULL,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_conversations_phone_number_idx" ON "whatsapp_conversations"("phone_number");
CREATE INDEX "whatsapp_messages_conversation_id_idx"   ON "whatsapp_messages"("conversation_id");

ALTER TABLE "whatsapp_conversations"
    ADD CONSTRAINT "whatsapp_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2: Add models to schema.prisma**

Find the end of the `User` model in `apps/backend/prisma/schema.prisma` and add the inverse relation field:
```prisma
// Inside model User { ... } — add after the last existing relation:
whatsAppConversations WhatsAppConversation[] @relation("WhatsAppConversationUser")
```

Then append the three new models at the end of `schema.prisma`:

```prisma
// ── WhatsApp Integration ───────────────────────────────────────

model WhatsAppConversation {
  id          String   @id @default(uuid()) @db.Uuid
  phoneNumber String   @db.VarChar(30) @map("phone_number")
  userId      String?  @map("user_id") @db.Uuid
  status      String   @default("ACTIVE") @db.VarChar(20)
  contextData Json     @default("{}") @map("context_data")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user     User?             @relation("WhatsAppConversationUser", fields: [userId], references: [id], onDelete: SetNull)
  messages WhatsAppMessage[]

  @@index([phoneNumber])
  @@map("whatsapp_conversations")
}

model WhatsAppMessage {
  id             String   @id @default(uuid()) @db.Uuid
  conversationId String   @map("conversation_id") @db.Uuid
  direction      String   @db.VarChar(10)
  content        String   @db.Text
  aiIntent       String?  @map("ai_intent") @db.VarChar(50)
  processed      Boolean  @default(false)
  createdAt      DateTime @default(now()) @map("created_at")

  conversation WhatsAppConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("whatsapp_messages")
}

model WhatsAppAuditLog {
  id              String   @id @default(uuid()) @db.Uuid
  action          String   @db.VarChar(50)
  entityType      String?  @map("entity_type") @db.VarChar(50)
  entityId        String?  @map("entity_id") @db.VarChar(100)
  requestPayload  Json     @map("request_payload")
  responsePayload Json     @map("response_payload")
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("whatsapp_audit_logs")
}
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm --filter backend db:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Verify TypeScript can see the new types**

```bash
pnpm build:backend 2>&1 | grep -E "error|warning|✔"
```

Expected: build succeeds (exit 0, no errors).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/20260615000000_add_whatsapp_module/
git commit -m "feat(whatsapp): add Prisma models for WhatsApp integration"
```

---

## Task 2: Webhook Payload Schema

**Files:**
- Create: `apps/backend/src/modules/whatsapp/whatsapp.schema.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts`:

```typescript
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
    // schema should succeed but the controller will ignore group messages
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts
```

Expected: FAIL — `Cannot find module '../whatsapp.schema'`

- [ ] **Step 3: Create whatsapp.schema.ts**

```typescript
import { z } from 'zod';

export const ultramsgWebhookSchema = z.object({
  token:      z.string(),
  instanceId: z.string(),
  data: z.object({
    id:         z.string(),
    // UltraMsg sometimes appends "@c.us" — strip it
    from:       z.string().transform(v => v.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '')),
    to:         z.string(),
    author:     z.string().optional(),
    pushname:   z.string().optional(),
    body:       z.string().default(''),
    type:       z.string(),   // "chat" | "image" | "ptt" etc.
    time:       z.number(),
    isGroupMsg: z.boolean().default(false),
  }),
});

export type UltramsgWebhookPayload = z.infer<typeof ultramsgWebhookSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/whatsapp/
git commit -m "feat(whatsapp): add webhook payload schema"
```

---

## Task 3: Helper Functions

**Files:**
- Create: `apps/backend/src/modules/whatsapp/whatsapp.helpers.ts`
- Modify: `apps/backend/src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts`

- [ ] **Step 1: Add normalizePhone tests**

Append to `apps/backend/src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts
```

Expected: FAIL — `normalizePhone is not exported`

- [ ] **Step 3: Create whatsapp.helpers.ts**

```typescript
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
// Returns { id, name, phone, roleName } or null.
// User.role is a Relation (Role model) — access .name for the string.
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
      data: {
        action,
        entityType,
        entityId,
        requestPayload,
        responsePayload,
      },
    });
  } catch (err) {
    console.error('[whatsapp] Audit log failed:', err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts
```

Expected: 8 passed (4 schema + 4 phone).

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/whatsapp/
git commit -m "feat(whatsapp): add helper functions (phone, send reply, conversation)"
```

---

## Task 4: Claude Agent

**Files:**
- Create: `apps/backend/src/modules/whatsapp/whatsapp.agent.ts`
- Create: `apps/backend/src/modules/whatsapp/__tests__/whatsapp.agent.test.ts`

The agent receives the conversation history and current message, uses Claude with tool_use to classify intent, extract parameters, and either ask for clarification, call `request_confirmation` (when all data is collected), or return a direct answer (for balance queries). Claude never writes to the DB — the service layer does that after the user confirms.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/whatsapp/__tests__/whatsapp.agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMessages, extractConfirmation } from '../whatsapp.agent';

describe('buildMessages', () => {
  it('wraps history and current message into Anthropic messages array', () => {
    const history = [
      { role: 'user' as const, content: 'Gasto 3000' },
      { role: 'assistant' as const, content: '¿Para qué proyecto?' },
    ];
    const messages = buildMessages(history, 'Torre Norte');
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('user');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toBe('Torre Norte');
  });
});

describe('extractConfirmation', () => {
  it('returns null when there is no tool_use block', () => {
    const result = extractConfirmation([
      { type: 'text', text: '¿Para qué proyecto?' },
    ] as any[]);
    expect(result).toBeNull();
  });

  it('extracts confirmation payload from request_confirmation tool_use block', () => {
    const result = extractConfirmation([
      {
        type: 'tool_use',
        name: 'request_confirmation',
        input: {
          intent: 'CREATE_EXPENSE',
          payload: { projectId: 'uuid-1', amount: 2500, categoryId: 3, description: 'Cemento', paymentMethod: 'CASH' },
          summary: 'Gasto de RD$2,500 en cemento — Proyecto Torre Norte',
        },
      },
    ] as any[]);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('CREATE_EXPENSE');
    expect(result!.payload.amount).toBe(2500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.agent.test.ts
```

Expected: FAIL — `Cannot find module '../whatsapp.agent'`

- [ ] **Step 3: Create whatsapp.agent.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import prisma from '../../config/database';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? '' });

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export type ConfirmationPayload = {
  intent: 'CREATE_PROJECT' | 'CREATE_EXPENSE' | 'QUERY_BALANCE' | 'QUERY_EXPENSES';
  payload: Record<string, unknown>;
  summary: string;
};

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
      'No llames esta herramienta si aún faltan datos — en su lugar responde con una pregunta.',
    ].join(' '),
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: {
          type: 'string',
          enum: ['CREATE_PROJECT', 'CREATE_EXPENSE', 'QUERY_BALANCE', 'QUERY_EXPENSES'],
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
- Para CREATE_EXPENSE y CREATE_PROJECT: SIEMPRE llama a request_confirmation antes de ejecutar
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
3. startDate: la fecha de hoy en formato YYYY-MM-DD`;

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
      const input = block.input as ConfirmationPayload;
      return { intent: input.intent, payload: input.payload, summary: input.summary };
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

// ── Main agent call — returns reply text and optional confirmation ──
export type AgentResult = {
  replyText: string;
  confirmation: ConfirmationPayload | null;
};

export async function runAgent(
  history: ConversationMessage[],
  currentMessage: string,
): Promise<AgentResult> {
  const messages = buildMessages(history, currentMessage);

  // Agentic loop: Claude may call tools multiple times before final answer
  let loopMessages = [...messages];
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      tools:      AGENT_TOOLS,
      messages:   loopMessages,
    });

    // Check if Claude wants to call request_confirmation (no tool result needed)
    const confirmation = extractConfirmation(response.content);
    if (confirmation) {
      return { replyText: '', confirmation };
    }

    // Check if Claude called any data-fetching tool
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Final answer — plain text reply
      return { replyText: extractText(response.content), confirmation: null };
    }

    // Execute each tool and feed results back to Claude
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/__tests__/whatsapp.agent.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: TypeScript check**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/whatsapp/
git commit -m "feat(whatsapp): add Claude tool_use agent for intent detection"
```

---

## Task 5: Conversation State Machine

**Files:**
- Create: `apps/backend/src/modules/whatsapp/whatsapp.service.ts`

The state machine handles two states:
- **ACTIVE**: call the agent, process its result
- **AWAITING_CONFIRMATION**: check if user said yes/no, then act

Context stored in `WhatsAppConversation.contextData` as:
```typescript
{
  conversationHistory: ConversationMessage[];   // last 10 messages
  pendingConfirmation: ConfirmationPayload | null;
  awaitingConfirmation: boolean;
}
```

- [ ] **Step 1: Create whatsapp.service.ts**

```typescript
import prisma from '../../config/database';
import { createExpense } from '../expenses/expenses.service';
import { createProject } from '../projects/projects.service';
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

// ── Execute a confirmed action via the existing service layer ──
async function executeConfirmedAction(
  confirmation: ConfirmationPayload,
  userId: string,
  userRole: string,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (confirmation.intent === 'CREATE_EXPENSE') {
    const p = confirmation.payload as {
      projectId:     string;
      amount:        number;
      description:   string;
      categoryId:    number;
      paymentMethod: string;
    };
    const expense = await createExpense(
      {
        projectId:     p.projectId,
        categoryId:    p.categoryId,
        expenseDate:   today,
        amount:        p.amount,
        description:   p.description,
        paymentMethod: (p.paymentMethod ?? 'CASH') as any,
        hasFiscalDoc:  false,
      },
      userId,
      userRole,
    );
    await logAudit('CREATE_EXPENSE', 'expense', expense.id, p, { id: expense.id });
    return `✅ Gasto registrado exitosamente.\nID: ${expense.id.substring(0, 8)}...\nMonto: RD$${p.amount.toLocaleString('es-DO')}`;
  }

  if (confirmation.intent === 'CREATE_PROJECT') {
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
    return `✅ Proyecto creado exitosamente.\nNombre: ${project.name}\nCódigo: ${project.code}`;
  }

  return 'Acción completada.';
}

// ── Main entry point — called by the controller ───────────────
export async function processIncomingMessage(phone: string, body: string): Promise<void> {
  const normalizedPhone = normalizePhone(phone);
  const user = await lookupUserByPhone(normalizedPhone);

  if (!user) {
    await sendWhatsAppReply(
      normalizedPhone,
      '❌ No encontré una cuenta asociada a este número. Contacta al administrador del sistema.',
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

  // ── State: AWAITING_CONFIRMATION ──────────────────────────────
  if (ctx.awaitingConfirmation && ctx.pendingConfirmation) {
    if (CONFIRMATION_YES.test(body.trim())) {
      try {
        replyText = await executeConfirmedAction(ctx.pendingConfirmation, user.id, user.roleName ?? 'operator');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        replyText = `❌ Error al ejecutar la operación: ${msg}`;
      }
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;

    } else if (CONFIRMATION_NO.test(body.trim())) {
      replyText = '❌ Operación cancelada. ¿En qué más te puedo ayudar?';
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;

    } else {
      // Treat as new message — fall through to ACTIVE state
      ctx.pendingConfirmation  = null;
      ctx.awaitingConfirmation = false;
      const result = await runAgent(ctx.conversationHistory, body);
      replyText = await handleAgentResult(result, ctx);
    }

  // ── State: ACTIVE ─────────────────────────────────────────────
  } else {
    const result = await runAgent(ctx.conversationHistory, body);
    replyText = await handleAgentResult(result, ctx);
  }

  // Update conversation history (keep last MAX_HISTORY messages)
  ctx.conversationHistory.push({ role: 'user', content: body });
  ctx.conversationHistory.push({ role: 'assistant', content: replyText });
  if (ctx.conversationHistory.length > MAX_HISTORY) {
    ctx.conversationHistory = ctx.conversationHistory.slice(-MAX_HISTORY);
  }

  // Persist updated context
  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data:  { contextData: ctx as object, updatedAt: new Date() },
  });

  // Send reply and log
  await sendWhatsAppReply(normalizedPhone, replyText);
  await saveMessage(conversation.id, 'outgoing', replyText);
}

async function handleAgentResult(
  result: { replyText: string; confirmation: ConfirmationPayload | null },
  ctx: ConversationContext,
): Promise<string> {
  if (result.confirmation) {
    ctx.pendingConfirmation  = result.confirmation;
    ctx.awaitingConfirmation = true;
    return `${result.confirmation.summary}\n\n¿Confirmar? Responde *Sí* o *No*`;
  }
  return result.replyText || 'No pude entender tu solicitud. Intenta de nuevo.';
}
```

- [ ] **Step 2: TypeScript check**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: no errors. If you see `does not exist in type 'ProjectCreateInput'` for `estimatedBudget`, check the exact field name in `createProjectSchema` (`projects.schema.ts`) and match it exactly.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/whatsapp/whatsapp.service.ts
git commit -m "feat(whatsapp): add conversation state machine"
```

---

## Task 6: Controller + Router

**Files:**
- Create: `apps/backend/src/modules/whatsapp/whatsapp.controller.ts`
- Create: `apps/backend/src/modules/whatsapp/whatsapp.router.ts`

The webhook endpoint:
- Validates `body.token === env.ULTRAMSG_TOKEN` (rejects unknown callers)
- Ignores group messages and non-text messages
- Responds 200 immediately (UltraMsg needs fast ACK)
- Processes message asynchronously (`setImmediate`)

- [ ] **Step 1: Create whatsapp.controller.ts**

```typescript
import { Request, Response } from 'express';
import { env } from '../../config/env';
import { ultramsgWebhookSchema } from './whatsapp.schema';
import { processIncomingMessage } from './whatsapp.service';

export async function webhook(req: Request, res: Response): Promise<void> {
  // Validate UltraMsg token
  const raw = req.body;
  if (!raw?.token || raw.token !== env.ULTRAMSG_TOKEN) {
    res.status(403).json({ success: false, error: 'Invalid token' });
    return;
  }

  // Parse and validate payload
  const parsed = ultramsgWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    res.status(200).json({ success: true }); // ACK but ignore malformed
    return;
  }

  const { data } = parsed.data;

  // Ignore group messages and non-text messages
  if (data.isGroupMsg || data.type !== 'chat' || !data.body.trim()) {
    res.status(200).json({ success: true });
    return;
  }

  // ACK immediately — UltraMsg times out at ~5s
  res.status(200).json({ success: true });

  // Process asynchronously
  setImmediate(async () => {
    try {
      await processIncomingMessage(data.from, data.body);
    } catch (err) {
      console.error('[whatsapp] processIncomingMessage error:', err);
    }
  });
}
```

- [ ] **Step 2: Create whatsapp.router.ts**

```typescript
import { Router } from 'express';
import * as ctrl from './whatsapp.controller';

const router = Router();

// No authenticate middleware — UltraMsg doesn't send a JWT
// Token validation is handled inside the controller
router.post('/webhook', ctrl.webhook);

export default router;
```

- [ ] **Step 3: Register in app.ts**

In `apps/backend/src/app.ts`, add after the existing imports (around line 29):

```typescript
import whatsappRouter from './modules/whatsapp/whatsapp.router';
```

And add after the other `app.use` registrations (around line 125, before `app.use(errorHandler)`):

```typescript
// WhatsApp webhook — no apiLimiter here (UltraMsg needs 200 quickly, token-validated inside)
app.use('/api/v1/whatsapp', whatsappRouter);
```

- [ ] **Step 4: TypeScript check + build**

```bash
pnpm build:backend 2>&1 | tail -10
```

Expected: compiled successfully, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/whatsapp/whatsapp.controller.ts \
        apps/backend/src/modules/whatsapp/whatsapp.router.ts \
        apps/backend/src/app.ts
git commit -m "feat(whatsapp): add controller, router, and register webhook endpoint"
```

---

## Task 7: Tests + Final Build

**Files:**
- Modify: `apps/backend/src/modules/whatsapp/__tests__/whatsapp.helpers.test.ts` (already exists)
- Create: integration smoke test in same file

- [ ] **Step 1: Run all existing tests — should still pass**

```bash
pnpm --filter backend test -- --run src/modules/whatsapp/
```

Expected: all pass (helpers + agent unit tests).

- [ ] **Step 2: Full backend build**

```bash
pnpm build:backend
```

Expected: exit 0, no TypeScript errors.

- [ ] **Step 3: Full frontend build (regression check)**

```bash
pnpm build:frontend 2>&1 | tail -5
```

Expected: `✓ built in Xs`

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter backend test 2>&1 | tail -10
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Commit + push**

```bash
git add -A
git commit -m "feat(whatsapp): complete Phase 1 implementation — webhook, agent, state machine"
git push -u origin main
```

---

## Task 8: Environment + UltraMsg Webhook Configuration

This task is manual — no code changes.

- [ ] **Step 1: Confirm env vars exist in Render**

In the Render dashboard for `servingmi-backend`, verify these are set:
- `ULTRAMSG_INSTANCE_ID` — from UltraMsg dashboard
- `ULTRAMSG_TOKEN` — from UltraMsg dashboard
- `ANTHROPIC_API_KEY` — already set (used by OCR)

- [ ] **Step 2: Configure UltraMsg webhook URL**

In the UltraMsg dashboard → Webhooks → set URL to:
```
https://servingmi-backend.onrender.com/api/v1/whatsapp/webhook
```

- [ ] **Step 3: Link user phone numbers**

Each user who will send WhatsApp messages must have their `phone` field set in the DB (in E.164 format: `+18091234567`). They do **not** need `whatsappOptIn=true` — that field is for receiving outbound notifications, not for using the bot.

Update via the Users admin UI or directly in the DB:
```sql
UPDATE users SET phone = '+18091234567' WHERE email = 'jhta.712@gmail.com';
```

- [ ] **Step 4: Smoke test — send a WhatsApp message**

From the linked phone number, send: `Balance [nombre de proyecto]`

Expected:
- Bot replies with balance info within 10 seconds
- `whatsapp_conversations`, `whatsapp_messages`, and `whatsapp_audit_logs` tables have new rows

---

## Out of Scope (Phase 2)

- **OCR for invoice images**: when `data.type === 'image'`, download the media from UltraMsg, pass to the existing OCR service, extract amount/supplier, then enter the normal expense flow.
- **Email and voice assistant channels**: architecture is already channel-agnostic; add new routers/webhooks calling `processIncomingMessage` with different sources.
- **Multi-language support**: SYSTEM_PROMPT is Spanish-only; add language detection if needed.
