# AI Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only dashboard that tracks Claude API token consumption per feature and per user, with cost estimation in USD and a configurable monthly spend alert via WhatsApp/email.

**Architecture:** A central wrapper service (`ai-usage.service.ts`) intercepts every Claude API call, captures `response.usage`, and persists it to a new `ai_usage_logs` table — silently, never blocking the main feature. A new backend module exposes aggregation endpoints. A new frontend page renders KPI cards, a cost progress bar, and two breakdown tables (by feature and by user), accessible only to admin.

**Tech Stack:** Node.js 24 + Express + TypeScript + Prisma + PostgreSQL backend; React 18 + Vite + TailwindCSS + TanStack Query frontend. Design system: `#1C1C1C`/`#F5C218`, Barlow Condensed / DM Sans / Space Mono, no rounded corners.

---

## File Map

**Create:**
- `apps/backend/prisma/migrations/20260622000001_add_ai_usage_logs/migration.sql`
- `apps/backend/src/services/ai-usage.service.ts` — wrapper + pricing constants
- `apps/backend/src/modules/ai-usage/ai-usage.router.ts`
- `apps/backend/src/modules/ai-usage/ai-usage.controller.ts`
- `apps/backend/src/modules/ai-usage/ai-usage.service.ts`
- `apps/backend/src/modules/ai-usage/__tests__/ai-usage.service.test.ts`
- `apps/frontend/src/pages/ai-usage/AiUsagePage.tsx`

**Modify:**
- `apps/backend/prisma/schema.prisma` — add `AiUsageLog` + `AiUsageAlert` models
- `apps/backend/src/modules/ocr/ocr.service.ts` — use wrapper (2 call sites, lines ~179 and ~206)
- `apps/backend/src/modules/whatsapp/whatsapp.agent.ts` — use wrapper (line ~206, inside loop)
- `apps/backend/src/modules/projects/projects.service.ts` — use wrapper (AI summary, line ~628)
- `apps/backend/src/modules/expenses/expenses.service.ts` — use wrapper (suggest category, line ~579)
- `apps/backend/src/modules/payment-orders/payment-orders.service.ts` — use wrapper (suggest concept, line ~844)
- `apps/backend/src/modules/monitoring/monitoring.ai.ts` — use wrapper (line ~154)
- `apps/backend/src/modules/suppliers/project-suppliers.service.ts` — use wrapper (line ~139)
- `apps/backend/src/app.ts` — register `/api/v1/ai-usage` router
- `apps/backend/src/jobs/businessNotifications.ts` — add monthly cost alert check
- `apps/frontend/src/api/index.ts` — add `aiUsageApi`
- `apps/frontend/src/main.tsx` — add lazy import + route `/ai-usage`
- `apps/frontend/src/components/layout/Layout.tsx` — add sidebar link

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260622000001_add_ai_usage_logs/migration.sql`

- [ ] **Step 1: Add models to schema.prisma**

Open `apps/backend/prisma/schema.prisma`. Add these two models at the end of the file (before the closing):

```prisma
model AiUsageLog {
  id           String   @id @default(cuid())
  feature      String
  model        String
  inputTokens  Int      @map("input_tokens")
  outputTokens Int      @map("output_tokens")
  userId       String?  @map("user_id")
  projectId    String?  @map("project_id")
  metadata     Json?
  createdAt    DateTime @default(now()) @map("created_at")

  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([feature, createdAt])
  @@index([userId, createdAt])
  @@map("ai_usage_logs")
}

model AiUsageAlert {
  id              String  @id @default(cuid())
  monthlyLimitUsd Decimal @map("monthly_limit_usd") @db.Decimal(10, 2)
  enabled         Boolean @default(true)

  @@map("ai_usage_alerts")
}
```

Also add the inverse relations on `User` and `Project` models. Find `model User` and add inside it:
```prisma
  aiUsageLogs     AiUsageLog[]
```
Find `model Project` and add inside it:
```prisma
  aiUsageLogs     AiUsageLog[]
```

- [ ] **Step 2: Create the migration SQL file**

Create directory `apps/backend/prisma/migrations/20260622000001_add_ai_usage_logs/` and inside it create `migration.sql`:

```sql
-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_alerts" (
    "id" TEXT NOT NULL,
    "monthly_limit_usd" DECIMAL(10,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm --filter backend db:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build:backend
```

Expected: exits 0, no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma \
        apps/backend/prisma/migrations/20260622000001_add_ai_usage_logs/
git commit -m "feat(ai-usage): add ai_usage_logs and ai_usage_alerts tables"
```

---

### Task 2: Central AI wrapper service

**Files:**
- Create: `apps/backend/src/services/ai-usage.service.ts`
- Test: `apps/backend/src/services/__tests__/ai-usage.service.test.ts` (if `__tests__` dir doesn't exist, create it)

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/services/__tests__/ai-usage.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('../../config/database', () => ({
  default: {
    aiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn(),
    };
  },
}));

import prisma from '../../config/database';
import { computeCostUsd, PRICING } from '../ai-usage.service';

describe('ai-usage.service', () => {
  it('computes cost correctly for input tokens', () => {
    // $1.00 per 1M input tokens
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(1.0);
    expect(computeCostUsd(500_000, 0)).toBeCloseTo(0.5);
    expect(computeCostUsd(0, 0)).toBe(0);
  });

  it('computes cost correctly for output tokens', () => {
    // $5.00 per 1M output tokens
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(5.0);
    expect(computeCostUsd(0, 200_000)).toBeCloseTo(1.0);
  });

  it('computes combined cost', () => {
    // 1M input ($1) + 1M output ($5) = $6
    expect(computeCostUsd(1_000_000, 1_000_000)).toBeCloseTo(6.0);
  });

  it('exposes PRICING constants', () => {
    expect(PRICING.INPUT_PER_MILLION).toBe(1.0);
    expect(PRICING.OUTPUT_PER_MILLION).toBe(5.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test -- --run src/services/__tests__/ai-usage.service.test.ts
```

Expected: FAIL — `computeCostUsd` and `PRICING` are not defined yet.

- [ ] **Step 3: Implement the wrapper service**

Create `apps/backend/src/services/ai-usage.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// ── Pricing constants — Haiku 4.5 (update here when model changes) ─────────
export const PRICING = {
  INPUT_PER_MILLION:  1.0,  // USD per 1M input tokens
  OUTPUT_PER_MILLION: 5.0,  // USD per 1M output tokens
} as const;

export type AiFeature =
  | 'OCR'
  | 'WHATSAPP'
  | 'AI_SUMMARY'
  | 'SUGGEST_CATEGORY'
  | 'SUGGEST_CONCEPT'
  | 'MONITORING'
  | 'SUPPLIER_SUGGESTIONS';

export interface TrackAiCallParams {
  feature:    AiFeature;
  request:    MessageCreateParamsNonStreaming;
  client:     Anthropic;
  userId?:    string;
  projectId?: string;
  metadata?:  Record<string, unknown>;
}

/** Compute estimated cost in USD from token counts. */
export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens  / 1_000_000) * PRICING.INPUT_PER_MILLION +
    (outputTokens / 1_000_000) * PRICING.OUTPUT_PER_MILLION
  );
}

/**
 * Drop-in wrapper for anthropic.messages.create().
 * Calls Claude, persists usage to ai_usage_logs, returns the response.
 * If the DB write fails it logs and continues — never blocks the caller.
 */
export async function trackAiCall(params: TrackAiCallParams): Promise<Anthropic.Message> {
  const { feature, request, client, userId, projectId, metadata } = params;

  const response = await client.messages.create(request);

  // Persist silently — don't let logging errors surface to callers
  setImmediate(async () => {
    try {
      await prisma.aiUsageLog.create({
        data: {
          feature,
          model:        response.model,
          inputTokens:  response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          userId:       userId  ?? null,
          projectId:    projectId ?? null,
          metadata:     metadata ?? null,
        },
      });
    } catch (err) {
      logger.error('[AiUsage] Failed to persist usage log:', err);
    }
  });

  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter backend test -- --run src/services/__tests__/ai-usage.service.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/ai-usage.service.ts \
        apps/backend/src/services/__tests__/ai-usage.service.test.ts
git commit -m "feat(ai-usage): add central Claude API wrapper with token tracking"
```

---

### Task 3: Wire wrapper into all 7 call sites

**Files:**
- Modify: `apps/backend/src/modules/ocr/ocr.service.ts`
- Modify: `apps/backend/src/modules/whatsapp/whatsapp.agent.ts`
- Modify: `apps/backend/src/modules/projects/projects.service.ts`
- Modify: `apps/backend/src/modules/expenses/expenses.service.ts`
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.service.ts`
- Modify: `apps/backend/src/modules/monitoring/monitoring.ai.ts`
- Modify: `apps/backend/src/modules/suppliers/project-suppliers.service.ts`

**Pattern for every call site:**
```typescript
// Before:
const response = await client.messages.create({ model, max_tokens, messages });

// After:
import { trackAiCall } from '../../services/ai-usage.service';
// ...
const response = await trackAiCall({
  feature:   'FEATURE_NAME',
  request:   { model, max_tokens, messages },
  client,
  userId,       // pass if available in scope, else omit
  projectId,    // pass if available in scope, else omit
});
```

- [ ] **Step 1: Update ocr.service.ts (2 call sites)**

In `apps/backend/src/modules/ocr/ocr.service.ts`:

Add import at top (after existing imports):
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

The function signature of `analyzeDocument` does not receive userId/projectId. Leave them omitted.

Replace first `client.messages.create` call (around line 179, inside `analyzeDocument`):
```typescript
// Before:
const response = await client.messages.create({
  model:      'claude-haiku-4-5',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        fileContentBlock,
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    },
  ],
});

// After:
const response = await trackAiCall({
  feature: 'OCR',
  client,
  request: {
    model:      'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          fileContentBlock,
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  },
});
```

There is a second `client.messages.create` in the same file (around line 206, inside the enrichment function). Apply the same pattern with `feature: 'OCR'`.

- [ ] **Step 2: Update whatsapp.agent.ts**

In `apps/backend/src/modules/whatsapp/whatsapp.agent.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

The loop calls `client.messages.create` on line ~206 inside `runAgent`. The function signature is `runAgent(history, currentMessage)` — no userId in scope. Replace:

```typescript
// Before:
const response = await client.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system:     SYSTEM_PROMPT,
  tools:      AGENT_TOOLS,
  messages:   loopMessages,
});

// After:
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
```

- [ ] **Step 3: Update projects.service.ts (AI Summary)**

In `apps/backend/src/modules/projects/projects.service.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

Find the `generateAiSummary` function (around line 620+). It receives `projectId` and uses `aiClient`. Replace:

```typescript
// Before:
const msg = await aiClient.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 350,
  messages:   [{ role: 'user', content: `...${context}` }],
});

// After:
const msg = await trackAiCall({
  feature:   'AI_SUMMARY',
  client:    aiClient,
  projectId,
  request: {
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages:   [{ role: 'user', content: `...${context}` }],
  },
});
```

(Keep the exact prompt string from the original — only wrap the call.)

- [ ] **Step 4: Update expenses.service.ts (Suggest Category)**

In `apps/backend/src/modules/expenses/expenses.service.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

Find `suggestCategory` function (line ~579). It uses `aiClient`. Replace:

```typescript
// Before:
const msg = await aiClient.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 50,
  messages: [{ role: 'user', content: `...` }],
});

// After:
const msg = await trackAiCall({
  feature: 'SUGGEST_CATEGORY',
  client:  aiClient,
  request: {
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages:   [{ role: 'user', content: `...` }],
  },
});
```

(Keep the exact prompt string from the original.)

- [ ] **Step 5: Update payment-orders.service.ts (Suggest Concept)**

In `apps/backend/src/modules/payment-orders/payment-orders.service.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

Find `suggestConcept` function (line ~844). It uses `aiClient`. Replace:

```typescript
// Before:
const msg = await aiClient.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 80,
  messages: [{ role: 'user', content: `...` }],
});

// After:
const msg = await trackAiCall({
  feature: 'SUGGEST_CONCEPT',
  client:  aiClient,
  request: {
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages:   [{ role: 'user', content: `...` }],
  },
});
```

(Keep the exact prompt string from the original.)

- [ ] **Step 6: Update monitoring.ai.ts**

In `apps/backend/src/modules/monitoring/monitoring.ai.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

Find the call to `client.messages.create` (around line 154). Replace:

```typescript
// Before:
const response = await client.messages.create({
  model:      'claude-haiku-4-5',
  max_tokens: 1500,
  messages: [{ role: 'user', content: prompt }],
});

// After:
const response = await trackAiCall({
  feature: 'MONITORING',
  client,
  request: {
    model:      'claude-haiku-4-5',
    max_tokens: 1500,
    messages:   [{ role: 'user', content: prompt }],
  },
});
```

- [ ] **Step 7: Update project-suppliers.service.ts**

In `apps/backend/src/modules/suppliers/project-suppliers.service.ts`:

Add import at top:
```typescript
import { trackAiCall } from '../../services/ai-usage.service';
```

Find the call to `client.messages.create` (around line 139). The function receives `projectId`. Replace:

```typescript
// Before:
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [{ role: 'user', content: `...` }],
});

// After:
const response = await trackAiCall({
  feature:   'SUPPLIER_SUGGESTIONS',
  client,
  projectId,
  request: {
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: `...` }],
  },
});
```

(Keep the exact prompt string from the original.)

- [ ] **Step 8: Build to verify no type errors**

```bash
pnpm build:backend
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/ocr/ocr.service.ts \
        apps/backend/src/modules/whatsapp/whatsapp.agent.ts \
        apps/backend/src/modules/projects/projects.service.ts \
        apps/backend/src/modules/expenses/expenses.service.ts \
        apps/backend/src/modules/payment-orders/payment-orders.service.ts \
        apps/backend/src/modules/monitoring/monitoring.ai.ts \
        apps/backend/src/modules/suppliers/project-suppliers.service.ts
git commit -m "feat(ai-usage): wire trackAiCall into all 7 Claude call sites"
```

---

### Task 4: Backend module — ai-usage router/controller/service

**Files:**
- Create: `apps/backend/src/modules/ai-usage/ai-usage.service.ts`
- Create: `apps/backend/src/modules/ai-usage/ai-usage.controller.ts`
- Create: `apps/backend/src/modules/ai-usage/ai-usage.router.ts`
- Create: `apps/backend/src/modules/ai-usage/__tests__/ai-usage.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/src/modules/ai-usage/__tests__/ai-usage.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/database', () => ({
  default: {
    aiUsageLog: {
      aggregate: vi.fn(),
      groupBy:   vi.fn(),
      findFirst: vi.fn(),
    },
    aiUsageAlert: {
      findFirst: vi.fn(),
      upsert:    vi.fn(),
    },
  },
}));

import prisma from '../../../config/database';
import { getMonthRange, getMonthlySummary } from '../ai-usage.service';

describe('getMonthRange', () => {
  it('returns start and end of month for 2026-06', () => {
    const { start, end } = getMonthRange('2026-06');
    expect(start).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(end.getMonth()).toBe(5); // June = 5
    expect(end.getDate()).toBe(30);
  });

  it('handles February', () => {
    const { start, end } = getMonthRange('2026-02');
    expect(end.getDate()).toBe(28);
  });
});

describe('getMonthlySummary', () => {
  beforeEach(() => {
    vi.mocked(prisma.aiUsageLog.aggregate).mockResolvedValue({
      _sum: { inputTokens: 100_000, outputTokens: 20_000 },
      _count: { id: 42 },
    } as any);
  });

  it('computes cost from token sums', async () => {
    const result = await getMonthlySummary('2026-06');
    // 100k input @ $1/M = $0.10; 20k output @ $5/M = $0.10; total = $0.20
    expect(result.estimatedCostUsd).toBeCloseTo(0.20);
    expect(result.totalCalls).toBe(42);
    expect(result.totalInputTokens).toBe(100_000);
    expect(result.totalOutputTokens).toBe(20_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test -- --run src/modules/ai-usage/__tests__/ai-usage.service.test.ts
```

Expected: FAIL — `getMonthRange` and `getMonthlySummary` not found.

- [ ] **Step 3: Implement ai-usage.service.ts**

Create `apps/backend/src/modules/ai-usage/ai-usage.service.ts`:

```typescript
import prisma from '../../config/database';
import { computeCostUsd } from '../../services/ai-usage.service';

export interface MonthlySummary {
  month:              string;
  totalInputTokens:   number;
  totalOutputTokens:  number;
  estimatedCostUsd:   number;
  totalCalls:         number;
}

export interface FeatureBreakdown {
  feature:           string;
  calls:             number;
  inputTokens:       number;
  outputTokens:      number;
  estimatedCostUsd:  number;
  pctOfTotal:        number;
}

export interface UserBreakdown {
  userId:            string | null;
  userName:          string;
  userRole:          string;
  calls:             number;
  totalTokens:       number;
  estimatedCostUsd:  number;
}

export interface AlertConfig {
  id:              string;
  monthlyLimitUsd: number;
  enabled:         boolean;
}

/** Returns UTC start/end Date objects for a YYYY-MM string. */
export function getMonthRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999)); // last day
  return { start, end };
}

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const { start, end } = getMonthRange(month);

  const agg = await prisma.aiUsageLog.aggregate({
    where:    { createdAt: { gte: start, lte: end } },
    _sum:     { inputTokens: true, outputTokens: true },
    _count:   { id: true },
  });

  const inputTokens  = agg._sum.inputTokens  ?? 0;
  const outputTokens = agg._sum.outputTokens ?? 0;

  return {
    month,
    totalInputTokens:  inputTokens,
    totalOutputTokens: outputTokens,
    estimatedCostUsd:  computeCostUsd(inputTokens, outputTokens),
    totalCalls:        agg._count.id ?? 0,
  };
}

export async function getByFeature(month: string): Promise<FeatureBreakdown[]> {
  const { start, end } = getMonthRange(month);

  const rows = await prisma.aiUsageLog.groupBy({
    by:    ['feature'],
    where: { createdAt: { gte: start, lte: end } },
    _sum:  { inputTokens: true, outputTokens: true },
    _count: { id: true },
  });

  const totalCost = rows.reduce(
    (s, r) => s + computeCostUsd(r._sum.inputTokens ?? 0, r._sum.outputTokens ?? 0),
    0,
  );

  return rows.map((r) => {
    const cost = computeCostUsd(r._sum.inputTokens ?? 0, r._sum.outputTokens ?? 0);
    return {
      feature:          r.feature,
      calls:            r._count.id,
      inputTokens:      r._sum.inputTokens  ?? 0,
      outputTokens:     r._sum.outputTokens ?? 0,
      estimatedCostUsd: cost,
      pctOfTotal:       totalCost > 0 ? (cost / totalCost) * 100 : 0,
    };
  }).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
}

export async function getByUser(month: string): Promise<UserBreakdown[]> {
  const { start, end } = getMonthRange(month);

  const rows = await prisma.aiUsageLog.groupBy({
    by:    ['userId'],
    where: { createdAt: { gte: start, lte: end } },
    _sum:  { inputTokens: true, outputTokens: true },
    _count: { id: true },
  });

  // Fetch user details for non-null userIds
  const userIds = rows.map((r) => r.userId).filter((id): id is string => id !== null);
  const users   = userIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true, role: { select: { name: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const user = r.userId ? userMap.get(r.userId) : null;
    const input  = r._sum.inputTokens  ?? 0;
    const output = r._sum.outputTokens ?? 0;
    return {
      userId:           r.userId,
      userName:         user?.name ?? 'Sistema (cron)',
      userRole:         user?.role?.name ?? '—',
      calls:            r._count.id,
      totalTokens:      input + output,
      estimatedCostUsd: computeCostUsd(input, output),
    };
  }).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
}

export async function getAlert(): Promise<AlertConfig | null> {
  const row = await prisma.aiUsageAlert.findFirst();
  if (!row) return null;
  return {
    id:              row.id,
    monthlyLimitUsd: Number(row.monthlyLimitUsd),
    enabled:         row.enabled,
  };
}

export async function upsertAlert(monthlyLimitUsd: number, enabled = true): Promise<AlertConfig> {
  const existing = await prisma.aiUsageAlert.findFirst();
  const row = existing
    ? await prisma.aiUsageAlert.update({
        where: { id: existing.id },
        data:  { monthlyLimitUsd, enabled },
      })
    : await prisma.aiUsageAlert.create({
        data: { monthlyLimitUsd, enabled },
      });
  return {
    id:              row.id,
    monthlyLimitUsd: Number(row.monthlyLimitUsd),
    enabled:         row.enabled,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- --run src/modules/ai-usage/__tests__/ai-usage.service.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Implement controller**

Create `apps/backend/src/modules/ai-usage/ai-usage.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import * as svc from './ai-usage.service';

export async function summary(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getMonthlySummary(month);
  res.json({ success: true, data });
}

export async function byFeature(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getByFeature(month);
  res.json({ success: true, data });
}

export async function byUser(req: Request, res: Response) {
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const data  = await svc.getByUser(month);
  res.json({ success: true, data });
}

export async function getAlert(_req: Request, res: Response) {
  const data = await svc.getAlert();
  res.json({ success: true, data });
}

export async function updateAlert(req: Request, res: Response) {
  const { monthlyLimitUsd, enabled } = req.body as { monthlyLimitUsd: number; enabled?: boolean };
  if (typeof monthlyLimitUsd !== 'number' || monthlyLimitUsd <= 0) {
    res.status(400).json({ success: false, error: 'monthlyLimitUsd must be a positive number' });
    return;
  }
  const data = await svc.upsertAlert(monthlyLimitUsd, enabled ?? true);
  res.json({ success: true, data });
}
```

- [ ] **Step 6: Implement router**

Create `apps/backend/src/modules/ai-usage/ai-usage.router.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './ai-usage.controller';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/summary',    ctrl.summary);
router.get('/by-feature', ctrl.byFeature);
router.get('/by-user',    ctrl.byUser);
router.get('/alert',      ctrl.getAlert);
router.put('/alert',      ctrl.updateAlert);

export default router;
```

- [ ] **Step 7: Build to verify**

```bash
pnpm build:backend
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/ai-usage/
git commit -m "feat(ai-usage): add ai-usage module with summary/by-feature/by-user/alert endpoints"
```

---

### Task 5: Register module in app.ts

**Files:**
- Modify: `apps/backend/src/app.ts`

- [ ] **Step 1: Add import and route**

In `apps/backend/src/app.ts`:

Add import with the other module imports (after `adminPayrollsRouter`):
```typescript
import aiUsageRouter from './modules/ai-usage/ai-usage.router';
```

Add route registration after the last `app.use` for admin modules (after `adminPayrollsRouter` line):
```typescript
app.use('/api/v1/ai-usage', apiLimiter, aiUsageRouter);
```

- [ ] **Step 2: Build and verify**

```bash
pnpm build:backend
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/app.ts
git commit -m "feat(ai-usage): register /api/v1/ai-usage router in app.ts"
```

---

### Task 6: Monthly cost alert in cron job

**Files:**
- Modify: `apps/backend/src/jobs/businessNotifications.ts`

- [ ] **Step 1: Add the alert check function**

In `apps/backend/src/jobs/businessNotifications.ts`, add the import at the top (with the existing imports):

```typescript
import { getMonthlySummary, getAlert } from '../modules/ai-usage/ai-usage.service';
```

Then add this function near the other alert functions (before the main `runBusinessNotifications` export):

```typescript
async function checkAiCostAlert(): Promise<void> {
  try {
    const alertConfig = await getAlert();
    if (!alertConfig || !alertConfig.enabled) return;

    const month   = new Date().toISOString().slice(0, 7);
    const summary = await getMonthlySummary(month);

    if (summary.estimatedCostUsd >= alertConfig.monthlyLimitUsd) {
      const pct     = ((summary.estimatedCostUsd / alertConfig.monthlyLimitUsd) * 100).toFixed(0);
      const message = `⚠️ *ALERTA CONSUMO IA* — SERVINGMI\n\nEl costo estimado de Claude API en ${month} es *$${summary.estimatedCostUsd.toFixed(4)} USD* (${pct}% del límite de $${alertConfig.monthlyLimitUsd} USD).\n\nTokens de entrada: ${summary.totalInputTokens.toLocaleString()}\nTokens de salida: ${summary.totalOutputTokens.toLocaleString()}\nLlamadas totales: ${summary.totalCalls}`;
      await sendWhatsApp(message, 'SYSTEM');
      await sendEmail(
        '⚠️ Alerta consumo IA — SERVINGMI',
        message.replace(/\*/g, ''),
        'SYSTEM',
      );
    }
  } catch (err) {
    logger.error('[BusinessNotifications] Error checking AI cost alert:', err);
  }
}
```

- [ ] **Step 2: Call checkAiCostAlert from the main function**

Find the main exported function (likely `runBusinessNotifications` or similar). Add a call to `checkAiCostAlert()` inside it, alongside the other checks:

```typescript
await checkAiCostAlert();
```

- [ ] **Step 3: Verify sendEmail signature**

Look for `sendEmail` in `businessNotifications.ts`. It may be called differently (some files use `sendNotificationEmail`). Match the existing signature exactly. If `sendEmail` doesn't exist in that file, use `sendWhatsApp` only and note it.

- [ ] **Step 4: Build and verify**

```bash
pnpm build:backend
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/jobs/businessNotifications.ts
git commit -m "feat(ai-usage): add monthly AI cost alert to daily notification cron"
```

---

### Task 7: Frontend API client

**Files:**
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Add aiUsageApi**

Open `apps/frontend/src/api/index.ts`. Add the following at the end of the file (or grouped with other admin APIs):

```typescript
// ─── AI Usage ──────────────────────────────────────────────────
export const aiUsageApi = {
  getSummary:  (month: string) =>
    api.get<{ success: boolean; data: AiUsageSummary }>(`/ai-usage/summary?month=${month}`),
  getByFeature: (month: string) =>
    api.get<{ success: boolean; data: AiFeatureBreakdown[] }>(`/ai-usage/by-feature?month=${month}`),
  getByUser:   (month: string) =>
    api.get<{ success: boolean; data: AiUserBreakdown[] }>(`/ai-usage/by-user?month=${month}`),
  getAlert:    () =>
    api.get<{ success: boolean; data: AiUsageAlert | null }>('/ai-usage/alert'),
  updateAlert: (monthlyLimitUsd: number, enabled: boolean) =>
    api.put<{ success: boolean; data: AiUsageAlert }>('/ai-usage/alert', { monthlyLimitUsd, enabled }),
};

export interface AiUsageSummary {
  month:             string;
  totalInputTokens:  number;
  totalOutputTokens: number;
  estimatedCostUsd:  number;
  totalCalls:        number;
}

export interface AiFeatureBreakdown {
  feature:          string;
  calls:            number;
  inputTokens:      number;
  outputTokens:     number;
  estimatedCostUsd: number;
  pctOfTotal:       number;
}

export interface AiUserBreakdown {
  userId:           string | null;
  userName:         string;
  userRole:         string;
  calls:            number;
  totalTokens:      number;
  estimatedCostUsd: number;
}

export interface AiUsageAlert {
  id:              string;
  monthlyLimitUsd: number;
  enabled:         boolean;
}
```

- [ ] **Step 2: Build frontend to verify**

```bash
pnpm build:frontend
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/api/index.ts
git commit -m "feat(ai-usage): add aiUsageApi client + TypeScript interfaces"
```

---

### Task 8: Frontend AiUsagePage

**Files:**
- Create: `apps/frontend/src/pages/ai-usage/AiUsagePage.tsx`

- [ ] **Step 1: Create the page**

Create `apps/frontend/src/pages/ai-usage/AiUsagePage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Cpu, TrendingUp, Hash, DollarSign, AlertTriangle } from 'lucide-react';
import { aiUsageApi, type AiFeatureBreakdown, type AiUserBreakdown, type AiUsageSummary, type AiUsageAlert } from '../../api';
import { useRole } from '../../hooks/useRole';

const FEATURE_LABELS: Record<string, string> = {
  OCR:                  'OCR de Facturas',
  WHATSAPP:             'Chatbot WhatsApp',
  AI_SUMMARY:           'Resumen IA de Proyecto',
  SUGGEST_CATEGORY:     'Sugerencia de Categoría',
  SUGGEST_CONCEPT:      'Sugerencia de Concepto',
  MONITORING:           'Análisis de Monitoreo',
  SUPPLIER_SUGGESTIONS: 'Sugerencias de Suplidores',
};

function fmt(n: number): string {
  return n.toLocaleString('es-DO');
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('es-DO', { month: 'long', year: 'numeric' });
}

export default function AiUsagePage() {
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [limitInput, setLimitInput] = useState('');
  const [editingLimit, setEditingLimit] = useState(false);

  const { data: summaryData } = useQuery({
    queryKey: ['ai-usage-summary', month],
    queryFn:  () => aiUsageApi.getSummary(month).then(r => r.data.data),
    enabled:  isAdmin,
  });

  const { data: featureData = [] } = useQuery({
    queryKey: ['ai-usage-feature', month],
    queryFn:  () => aiUsageApi.getByFeature(month).then(r => r.data.data),
    enabled:  isAdmin,
  });

  const { data: userData = [] } = useQuery({
    queryKey: ['ai-usage-user', month],
    queryFn:  () => aiUsageApi.getByUser(month).then(r => r.data.data),
    enabled:  isAdmin,
  });

  const { data: alertData } = useQuery({
    queryKey: ['ai-usage-alert'],
    queryFn:  () => aiUsageApi.getAlert().then(r => r.data.data),
    enabled:  isAdmin,
  });

  const updateAlertMutation = useMutation({
    mutationFn: ({ limit, enabled }: { limit: number; enabled: boolean }) =>
      aiUsageApi.updateAlert(limit, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-usage-alert'] });
      setEditingLimit(false);
    },
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-['DM_Sans']">Acceso restringido.</p>
      </div>
    );
  }

  const summary: AiUsageSummary = summaryData ?? {
    month, totalInputTokens: 0, totalOutputTokens: 0, estimatedCostUsd: 0, totalCalls: 0,
  };

  const alert: AiUsageAlert | null = alertData ?? null;
  const limitPct = alert && alert.monthlyLimitUsd > 0
    ? Math.min((summary.estimatedCostUsd / alert.monthlyLimitUsd) * 100, 100)
    : null;
  const limitColor = limitPct == null ? '#F5C218'
    : limitPct >= 100 ? '#ef4444'
    : limitPct >= 75  ? '#f59e0b'
    : '#22c55e';

  const isCurrentMonth = month === currentMonth;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#1C1C1C] px-6 py-8">
        <p className="font-['Barlow_Condensed'] text-xs text-[#F5C218] uppercase tracking-[0.2em] mb-2">
          Administración / IA
        </p>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
            Consumo de IA
          </h1>
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(prevMonth(month))}
              className="p-1 text-gray-400 hover:text-[#F5C218] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-['Space_Mono'] text-sm text-white capitalize min-w-[160px] text-center">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => setMonth(nextMonth(month))}
              disabled={isCurrentMonth}
              className="p-1 text-gray-400 hover:text-[#F5C218] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Hash,       label: 'Tokens Entrada',  value: fmt(summary.totalInputTokens),  sub: 'input tokens' },
            { icon: TrendingUp, label: 'Tokens Salida',   value: fmt(summary.totalOutputTokens), sub: 'output tokens' },
            { icon: DollarSign, label: 'Costo Estimado',  value: fmtUsd(summary.estimatedCostUsd), sub: 'USD este mes', big: true },
            { icon: Cpu,        label: 'Llamadas Totales', value: fmt(summary.totalCalls),        sub: 'a Claude API' },
          ].map(({ icon: Icon, label, value, sub, big }) => (
            <div key={label} className="bg-white border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-[#F5C218]" />
                <span className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-[0.15em]">
                  {label}
                </span>
              </div>
              <p className={`font-['Space_Mono'] ${big ? 'text-3xl text-[#1C1C1C]' : 'text-2xl text-gray-800'} font-bold`}>
                {value}
              </p>
              <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Cost Limit */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F5C218]" />
              <span className="font-['Barlow_Condensed'] text-sm uppercase tracking-[0.15em] text-gray-700">
                Límite mensual de costo
              </span>
            </div>
            {!editingLimit ? (
              <button
                onClick={() => { setLimitInput(String(alert?.monthlyLimitUsd ?? '')); setEditingLimit(true); }}
                className="font-['DM_Sans'] text-xs text-[#1C1C1C] bg-[#F5C218] px-3 py-1.5"
              >
                {alert ? 'Editar límite' : 'Configurar límite'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-['Space_Mono'] text-sm text-gray-500">USD $</span>
                <input
                  type="number"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  className="border border-gray-200 px-2 py-1 font-['Space_Mono'] text-sm w-24 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                  min="0.01"
                  step="0.01"
                />
                <button
                  onClick={() => updateAlertMutation.mutate({ limit: parseFloat(limitInput), enabled: true })}
                  disabled={!limitInput || parseFloat(limitInput) <= 0 || updateAlertMutation.isPending}
                  className="font-['DM_Sans'] text-xs bg-[#1C1C1C] text-white px-3 py-1.5 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingLimit(false)}
                  className="font-['DM_Sans'] text-xs border border-gray-200 text-gray-600 px-3 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {alert && limitPct !== null ? (
            <>
              <div className="flex justify-between mb-1">
                <span className="font-['Space_Mono'] text-xs text-gray-500">
                  {fmtUsd(summary.estimatedCostUsd)} / ${alert.monthlyLimitUsd.toFixed(2)} USD
                </span>
                <span className="font-['Space_Mono'] text-xs" style={{ color: limitColor }}>
                  {limitPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100">
                <div
                  className="h-2 transition-all"
                  style={{ width: `${limitPct}%`, backgroundColor: limitColor }}
                />
              </div>
              {limitPct >= 100 && (
                <p className="font-['DM_Sans'] text-xs text-red-500 mt-2">
                  ⚠️ Límite superado. Se enviará alerta WhatsApp/email en la próxima verificación diaria.
                </p>
              )}
            </>
          ) : (
            <p className="font-['DM_Sans'] text-sm text-gray-400">
              Sin límite configurado. Define un límite para recibir alertas cuando el costo mensual lo supere.
            </p>
          )}
        </div>

        {/* By Feature Table */}
        <div className="bg-white border border-gray-200">
          <div className="bg-[#1C1C1C] px-5 py-3">
            <h2 className="font-['Barlow_Condensed'] text-sm font-bold text-white uppercase tracking-[0.15em]">
              Desglose por Feature
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#1C1C1C]">
              <tr>
                {['Feature', 'Llamadas', 'Tokens Entrada', 'Tokens Salida', 'Costo USD', '% Total'].map(h => (
                  <th key={h} className="px-4 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-['DM_Sans'] text-gray-400">
                    Sin datos para {monthLabel(month)}
                  </td>
                </tr>
              ) : featureData.map((row: AiFeatureBreakdown) => (
                <tr key={row.feature} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-['DM_Sans'] text-gray-800">
                    {FEATURE_LABELS[row.feature] ?? row.feature}
                  </td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">{fmt(row.calls)}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">{fmt(row.inputTokens)}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">{fmt(row.outputTokens)}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-[#1C1C1C] font-bold">{fmtUsd(row.estimatedCostUsd)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100">
                        <div className="h-1.5 bg-[#F5C218]" style={{ width: `${row.pctOfTotal}%` }} />
                      </div>
                      <span className="font-['Space_Mono'] text-xs text-gray-500 w-10 text-right">
                        {row.pctOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By User Table */}
        <div className="bg-white border border-gray-200">
          <div className="bg-[#1C1C1C] px-5 py-3">
            <h2 className="font-['Barlow_Condensed'] text-sm font-bold text-white uppercase tracking-[0.15em]">
              Desglose por Usuario
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#1C1C1C]">
              <tr>
                {['Usuario', 'Rol', 'Llamadas', 'Total Tokens', 'Costo USD'].map(h => (
                  <th key={h} className="px-4 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-['DM_Sans'] text-gray-400">
                    Sin datos para {monthLabel(month)}
                  </td>
                </tr>
              ) : userData.map((row: AiUserBreakdown, i: number) => (
                <tr key={row.userId ?? `sys-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-['DM_Sans'] text-gray-800">{row.userName}</td>
                  <td className="px-4 py-3 font-['DM_Sans'] text-gray-500 capitalize">{row.userRole}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">{fmt(row.calls)}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">{fmt(row.totalTokens)}</td>
                  <td className="px-4 py-3 font-['Space_Mono'] text-[#1C1C1C] font-bold">{fmtUsd(row.estimatedCostUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm build:frontend
```

Expected: exits 0 with no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/ai-usage/AiUsagePage.tsx
git commit -m "feat(ai-usage): add AiUsagePage with KPI cards, cost limit, and breakdown tables"
```

---

### Task 9: Wire frontend — route + sidebar

**Files:**
- Modify: `apps/frontend/src/main.tsx`
- Modify: `apps/frontend/src/components/layout/Layout.tsx`

- [ ] **Step 1: Add lazy import and route in main.tsx**

In `apps/frontend/src/main.tsx`:

Add the lazy import alongside the other admin page imports (after `MonitoringPage`):
```typescript
const AiUsagePage = lazy(() => import('./pages/ai-usage/AiUsagePage'));
```

Add the route inside the Layout's child routes, alongside the other admin routes (near `monitoring`):
```tsx
<Route path="ai-usage" element={<AiUsagePage />} />
```

- [ ] **Step 2: Add sidebar link in Layout.tsx**

In `apps/frontend/src/components/layout/Layout.tsx`:

Find the `navItems` array. Add a new entry after the `monitoring` entry:
```typescript
{ to: '/ai-usage', icon: Cpu, label: 'Consumo IA', group: 'admin', roles: ['admin'] },
```

Add `Cpu` to the lucide-react import at the top of the file:
```typescript
import { ..., Cpu } from 'lucide-react';
```

- [ ] **Step 3: Build to verify**

```bash
pnpm build:frontend
```

Expected: exits 0.

- [ ] **Step 4: Run all backend tests**

```bash
pnpm --filter backend test -- --run
```

Expected: all tests pass.

- [ ] **Step 5: Final commit and push**

```bash
git add apps/frontend/src/main.tsx \
        apps/frontend/src/components/layout/Layout.tsx
git commit -m "feat(ai-usage): add route /ai-usage and sidebar link under Administración"

git push -u origin main
```

---

## Self-Review

**Spec coverage check:**
- ✅ `ai_usage_logs` + `ai_usage_alerts` tables → Task 1
- ✅ Central wrapper (`trackAiCall`) → Task 2
- ✅ All 7 call sites wired → Task 3
- ✅ 5 backend endpoints (summary, by-feature, by-user, get/put alert) → Task 4
- ✅ Module registered in app.ts → Task 5
- ✅ Daily cron alert (WhatsApp + email) → Task 6
- ✅ Frontend API client + types → Task 7
- ✅ AiUsagePage with hero, KPI cards, progress bar, 2 tables → Task 8
- ✅ Route `/ai-usage` + sidebar link (admin-only) → Task 9
- ✅ Month selector (prev/next) → Task 8
- ✅ Inline limit editor → Task 8
- ✅ "Sistema (cron)" for null userId → Task 4 service + Task 8

**Placeholder scan:** None found.

**Type consistency:**
- `AiFeature` type defined in `ai-usage.service.ts` (backend services layer) and used in wrapper
- Frontend interfaces `AiUsageSummary`, `AiFeatureBreakdown`, `AiUserBreakdown`, `AiUsageAlert` defined in `api/index.ts` and imported in page
- `computeCostUsd` exported from wrapper service and imported by module service — consistent name throughout
