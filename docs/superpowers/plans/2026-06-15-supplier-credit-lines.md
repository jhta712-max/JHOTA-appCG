# Supplier Credit Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar gastos de proyecto a crédito de proveedor (sin pago inmediato), rastrear el balance de deuda, y registrar abonos/pagos parciales sin duplicar el gasto en el proyecto.

**Architecture:** Se agregan dos modelos nuevos al schema (`SupplierCreditLine` y `SupplierCreditPayment`) y un campo opcional `creditLineId` al modelo `Expense`. Un gasto con `creditLineId` poblado = recibido a crédito; su `paymentMethod` se fuerza a `OTHER`. Los pagos al proveedor se registran en `SupplierCreditPayment` — nunca como gastos nuevos. El frontend expone un módulo de líneas de crédito dentro de la página de Suplidores y agrega la opción "A crédito" al formulario de gastos.

**Tech Stack:** Prisma ORM + PostgreSQL, Express, Zod, React 18, TanStack Query, TailwindCSS, design system #1C1C1C / #F5C218.

---

## Mapa de archivos

### Backend — crear
- `apps/backend/prisma/migrations/20260615000003_add_credit_lines/migration.sql`
- `apps/backend/src/modules/suppliers/credit-lines.service.ts`
- `apps/backend/src/modules/suppliers/credit-lines.schema.ts`
- `apps/backend/src/modules/suppliers/credit-lines.controller.ts`
- `apps/backend/src/modules/suppliers/__tests__/credit-lines.service.test.ts`

### Backend — modificar
- `apps/backend/prisma/schema.prisma` — nuevos modelos + campo en Expense
- `apps/backend/src/modules/suppliers/suppliers.router.ts` — nuevas rutas credit-lines
- `apps/backend/src/modules/expenses/expenses.schema.ts` — campo `creditLineId` opcional
- `apps/backend/src/modules/expenses/expenses.service.ts` — lógica crédito en `createExpense`

### Frontend — crear
- `apps/frontend/src/pages/suppliers/SupplierCreditLinesPage.tsx` — modal dentro de SuppliersPage (no ruta nueva)

### Frontend — modificar
- `apps/frontend/src/types/index.ts` — tipos `SupplierCreditLine`, `SupplierCreditPayment`
- `apps/frontend/src/api/index.ts` — métodos API credit-lines
- `apps/frontend/src/pages/suppliers/SuppliersPage.tsx` — botón "Ver crédito" + panel lateral
- `apps/frontend/src/pages/expenses/ExpensesPage.tsx` — campo "A crédito" en formulario

---

## Task 1: Schema Prisma + migración SQL

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260615000003_add_credit_lines/migration.sql`

- [ ] **Step 1: Agregar modelos al schema**

En `apps/backend/prisma/schema.prisma`, después del modelo `SupplierBankAccount` (línea ~800), agregar:

```prisma
model SupplierCreditLine {
  id           String   @id @default(uuid()) @db.Uuid
  supplierId   String   @map("supplier_id") @db.Uuid
  creditLimit  Decimal  @map("credit_limit") @db.Decimal(15, 2)
  notes        String?  @db.Text
  isActive     Boolean  @default(true) @map("is_active")
  createdById  String   @map("created_by") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  supplier  Supplier              @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  createdBy User                  @relation("CreditLineCreatedBy", fields: [createdById], references: [id])
  expenses  Expense[]             @relation("ExpenseCreditLine")
  payments  SupplierCreditPayment[]

  @@index([supplierId])
  @@map("supplier_credit_lines")
}

model SupplierCreditPayment {
  id             String   @id @default(uuid()) @db.Uuid
  creditLineId   String   @map("credit_line_id") @db.Uuid
  amount         Decimal  @db.Decimal(15, 2)
  paymentDate    DateTime @map("payment_date") @db.Date
  paymentMethod  PaymentMethod @map("payment_method")
  reference      String?  @db.VarChar(100)
  notes          String?  @db.Text
  createdById    String   @map("created_by") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")

  creditLine SupplierCreditLine @relation(fields: [creditLineId], references: [id], onDelete: Cascade)
  createdBy  User               @relation("CreditPaymentCreatedBy", fields: [createdById], references: [id])

  @@index([creditLineId])
  @@map("supplier_credit_payments")
}
```

En el modelo `Supplier`, agregar la relación inversa:
```prisma
  creditLines        SupplierCreditLine[]
```

En el modelo `Expense`, agregar campo y relación:
```prisma
  creditLineId   String?  @map("credit_line_id") @db.Uuid
  creditLine     SupplierCreditLine? @relation("ExpenseCreditLine", fields: [creditLineId], references: [id], onDelete: SetNull)
```
También agregar el índice: `@@index([creditLineId])` dentro de `@@map("expenses")`.

En el modelo `User`, agregar relaciones inversas:
```prisma
  creditLinesCreated   SupplierCreditLine[]    @relation("CreditLineCreatedBy")
  creditPaymentsCreated SupplierCreditPayment[] @relation("CreditPaymentCreatedBy")
```

- [ ] **Step 2: Crear migración SQL**

Crear `apps/backend/prisma/migrations/20260615000003_add_credit_lines/migration.sql`:

```sql
-- CreateTable supplier_credit_lines
CREATE TABLE "supplier_credit_lines" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id"  UUID         NOT NULL,
    "credit_limit" DECIMAL(15,2) NOT NULL,
    "notes"        TEXT,
    "is_active"    BOOLEAN      NOT NULL DEFAULT true,
    "created_by"   UUID         NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supplier_credit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable supplier_credit_payments
CREATE TABLE "supplier_credit_payments" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "credit_line_id" UUID         NOT NULL,
    "amount"         DECIMAL(15,2) NOT NULL,
    "payment_date"   DATE         NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "reference"      VARCHAR(100),
    "notes"          TEXT,
    "created_by"     UUID         NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_credit_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable expenses: add credit_line_id
ALTER TABLE "expenses" ADD COLUMN "credit_line_id" UUID;

-- AddForeignKey
ALTER TABLE "supplier_credit_lines" ADD CONSTRAINT "supplier_credit_lines_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_lines" ADD CONSTRAINT "supplier_credit_lines_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_payments" ADD CONSTRAINT "supplier_credit_payments_credit_line_id_fkey"
    FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_payments" ADD CONSTRAINT "supplier_credit_payments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_credit_line_id_fkey"
    FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "supplier_credit_lines_supplier_id_idx" ON "supplier_credit_lines"("supplier_id");
CREATE INDEX "supplier_credit_payments_credit_line_id_idx" ON "supplier_credit_payments"("credit_line_id");
CREATE INDEX "expenses_credit_line_id_idx" ON "expenses"("credit_line_id");
```

- [ ] **Step 3: Regenerar Prisma client**

```bash
pnpm --filter backend db:generate
```

Expected: `✔ Generated Prisma Client` sin errores.

- [ ] **Step 4: Verificar que compila**

```bash
pnpm build:backend
```

Expected: `tsc -p tsconfig.json` sin salida de error.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat: add SupplierCreditLine and SupplierCreditPayment models"
```

---

## Task 2: Backend — service de líneas de crédito

**Files:**
- Create: `apps/backend/src/modules/suppliers/credit-lines.schema.ts`
- Create: `apps/backend/src/modules/suppliers/credit-lines.service.ts`
- Create: `apps/backend/src/modules/suppliers/__tests__/credit-lines.service.test.ts`

- [ ] **Step 1: Escribir el test (TDD)**

Crear `apps/backend/src/modules/suppliers/__tests__/credit-lines.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../middlewares/errorHandler';

// Mock prisma antes del import del service
vi.mock('../../../config/database', () => ({
  default: {
    supplier: { findUnique: vi.fn() },
    supplierCreditLine: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    supplierCreditPayment: { create: vi.fn(), findMany: vi.fn() },
    expense: { aggregate: vi.fn() },
  },
}));

import prisma from '../../../config/database';
import * as svc from '../credit-lines.service';

const SUPPLIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID     = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINE_ID     = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

beforeEach(() => vi.clearAllMocks());

describe('createCreditLine', () => {
  it('throws 404 if supplier not found', async () => {
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue(null);
    await expect(svc.createCreditLine(SUPPLIER_ID, { creditLimit: 300000 }, USER_ID))
      .rejects.toThrow(AppError);
  });

  it('creates credit line for existing supplier', async () => {
    vi.mocked(prisma.supplier.findUnique).mockResolvedValue({ id: SUPPLIER_ID } as any);
    vi.mocked(prisma.supplierCreditLine.create).mockResolvedValue({
      id: LINE_ID, supplierId: SUPPLIER_ID, creditLimit: 300000, isActive: true,
    } as any);

    const result = await svc.createCreditLine(SUPPLIER_ID, { creditLimit: 300000 }, USER_ID);
    expect(result.creditLimit).toBe(300000);
    expect(prisma.supplierCreditLine.create).toHaveBeenCalledOnce();
  });
});

describe('getCreditLineBalance', () => {
  it('returns correct balance', async () => {
    vi.mocked(prisma.supplierCreditLine.findUnique).mockResolvedValue({
      id: LINE_ID, creditLimit: 300000, isActive: true,
      payments: [{ amount: 100000 }],
    } as any);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 200000 } } as any);

    const bal = await svc.getCreditLineBalance(LINE_ID);
    expect(bal.consumed).toBe(200000);
    expect(bal.paid).toBe(100000);
    expect(bal.pending).toBe(100000);   // consumed - paid
    expect(bal.available).toBe(200000); // limit - pending
  });
});

describe('addPayment', () => {
  it('throws 400 if payment exceeds pending amount', async () => {
    vi.mocked(prisma.supplierCreditLine.findUnique).mockResolvedValue({
      id: LINE_ID, creditLimit: 300000, isActive: true,
      payments: [{ amount: 200000 }],
    } as any);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 200000 } } as any);

    await expect(svc.addPayment(LINE_ID, { amount: 999999, paymentDate: '2026-06-15', paymentMethod: 'TRANSFER' }, USER_ID))
      .rejects.toThrow(AppError);
  });
});
```

- [ ] **Step 2: Correr test — debe fallar**

```bash
pnpm --filter backend test -- --run src/modules/suppliers/__tests__/credit-lines.service.test.ts
```

Expected: FAIL — `Cannot find module '../credit-lines.service'`

- [ ] **Step 3: Crear el schema Zod**

Crear `apps/backend/src/modules/suppliers/credit-lines.schema.ts`:

```typescript
import { z } from 'zod';

export const createCreditLineSchema = z.object({
  creditLimit: z.coerce.number().positive('El límite debe ser mayor a 0'),
  notes:       z.string().max(500).optional().nullable(),
});

export const updateCreditLineSchema = createCreditLineSchema.partial();

export const addPaymentSchema = z.object({
  amount:        z.coerce.number().positive('El monto debe ser mayor a 0'),
  paymentDate:   z.string().date('Formato inválido, use YYYY-MM-DD'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CHECK', 'OTHER']),
  reference:     z.string().max(100).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
});

export type CreateCreditLineInput = z.infer<typeof createCreditLineSchema>;
export type UpdateCreditLineInput = z.infer<typeof updateCreditLineSchema>;
export type AddPaymentInput       = z.infer<typeof addPaymentSchema>;
```

- [ ] **Step 4: Crear el service**

Crear `apps/backend/src/modules/suppliers/credit-lines.service.ts`:

```typescript
import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateCreditLineInput, UpdateCreditLineInput, AddPaymentInput } from './credit-lines.schema';

const LINE_INCLUDE = {
  supplier:  { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  payments:  { orderBy: { paymentDate: 'desc' as const } },
} as const;

export async function listCreditLines(supplierId: string) {
  return prisma.supplierCreditLine.findMany({
    where:   { supplierId },
    include: LINE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCreditLineBalance(lineId: string) {
  const line = await prisma.supplierCreditLine.findUnique({
    where:   { id: lineId },
    include: { payments: { select: { amount: true } } },
  });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  const consumed = Number(
    (await prisma.expense.aggregate({
      where: { creditLineId: lineId, status: { not: 'VOIDED' } },
      _sum:  { amount: true },
    }))._sum.amount ?? 0
  );
  const paid      = line.payments.reduce((s, p) => s + Number(p.amount), 0);
  const pending   = Math.max(consumed - paid, 0);
  const available = Math.max(Number(line.creditLimit) - pending, 0);

  return { lineId, creditLimit: Number(line.creditLimit), consumed, paid, pending, available };
}

export async function createCreditLine(supplierId: string, data: CreateCreditLineInput, userId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new AppError(404, 'Proveedor no encontrado', 'NOT_FOUND');

  return prisma.supplierCreditLine.create({
    data: {
      supplierId,
      creditLimit: data.creditLimit,
      notes:       data.notes ?? null,
      createdById: userId,
    },
    include: LINE_INCLUDE,
  });
}

export async function updateCreditLine(lineId: string, data: UpdateCreditLineInput) {
  const line = await prisma.supplierCreditLine.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  return prisma.supplierCreditLine.update({
    where:   { id: lineId },
    data:    { creditLimit: data.creditLimit, notes: data.notes },
    include: LINE_INCLUDE,
  });
}

export async function toggleCreditLine(lineId: string) {
  const line = await prisma.supplierCreditLine.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  return prisma.supplierCreditLine.update({
    where:   { id: lineId },
    data:    { isActive: !line.isActive },
    include: LINE_INCLUDE,
  });
}

export async function addPayment(lineId: string, data: AddPaymentInput, userId: string) {
  const bal = await getCreditLineBalance(lineId);
  if (data.amount > bal.pending + 0.01) {
    throw new AppError(400, `El pago (${data.amount}) supera la deuda pendiente (${bal.pending})`, 'EXCEEDS_BALANCE');
  }

  return prisma.supplierCreditPayment.create({
    data: {
      creditLineId:  lineId,
      amount:        data.amount,
      paymentDate:   new Date(data.paymentDate),
      paymentMethod: data.paymentMethod as any,
      reference:     data.reference ?? null,
      notes:         data.notes     ?? null,
      createdById:   userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function listPayments(lineId: string) {
  return prisma.supplierCreditPayment.findMany({
    where:   { creditLineId: lineId },
    orderBy: { paymentDate: 'desc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}
```

- [ ] **Step 5: Correr tests — deben pasar**

```bash
pnpm --filter backend test -- --run src/modules/suppliers/__tests__/credit-lines.service.test.ts
```

Expected: `3 tests passed`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/suppliers/
git commit -m "feat: credit-lines service with balance calculation and payment validation"
```

---

## Task 3: Backend — controller + rutas

**Files:**
- Create: `apps/backend/src/modules/suppliers/credit-lines.controller.ts`
- Modify: `apps/backend/src/modules/suppliers/suppliers.router.ts`

- [ ] **Step 1: Crear el controller**

Crear `apps/backend/src/modules/suppliers/credit-lines.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import * as svc from './credit-lines.service';

export async function listCreditLines(req: Request, res: Response) {
  const lines = await svc.listCreditLines(req.params.id);
  // Enriquecer cada línea con su balance
  const withBalance = await Promise.all(
    lines.map(async (l) => ({ ...l, balance: await svc.getCreditLineBalance(l.id) }))
  );
  res.json({ success: true, data: withBalance });
}

export async function createCreditLine(req: Request, res: Response) {
  const line = await svc.createCreditLine(req.params.id, req.body, req.user!.userId);
  res.status(201).json({ success: true, data: line });
}

export async function updateCreditLine(req: Request, res: Response) {
  const line = await svc.updateCreditLine(req.params.lineId, req.body);
  res.json({ success: true, data: line });
}

export async function toggleCreditLine(req: Request, res: Response) {
  const line = await svc.toggleCreditLine(req.params.lineId);
  res.json({ success: true, data: line });
}

export async function getBalance(req: Request, res: Response) {
  const balance = await svc.getCreditLineBalance(req.params.lineId);
  res.json({ success: true, data: balance });
}

export async function addPayment(req: Request, res: Response) {
  const payment = await svc.addPayment(req.params.lineId, req.body, req.user!.userId);
  res.status(201).json({ success: true, data: payment });
}

export async function listPayments(req: Request, res: Response) {
  const payments = await svc.listPayments(req.params.lineId);
  res.json({ success: true, data: payments });
}
```

- [ ] **Step 2: Agregar rutas en suppliers.router.ts**

En `apps/backend/src/modules/suppliers/suppliers.router.ts`, agregar imports y rutas después de las rutas de bank-accounts:

```typescript
import { createCreditLineSchema, updateCreditLineSchema, addPaymentSchema } from './credit-lines.schema';
import * as creditCtrl from './credit-lines.controller';

// Líneas de crédito
router.get('/:id/credit-lines',                              creditCtrl.listCreditLines);
router.post('/:id/credit-lines',                             authorize('admin', 'supervisor'), validate(createCreditLineSchema), creditCtrl.createCreditLine);
router.put('/:id/credit-lines/:lineId',                      authorize('admin', 'supervisor'), validate(updateCreditLineSchema), creditCtrl.updateCreditLine);
router.patch('/:id/credit-lines/:lineId/toggle',             authorize('admin', 'supervisor'), creditCtrl.toggleCreditLine);
router.get('/:id/credit-lines/:lineId/balance',              creditCtrl.getBalance);
router.get('/:id/credit-lines/:lineId/payments',             creditCtrl.listPayments);
router.post('/:id/credit-lines/:lineId/payments',            authorize('admin', 'supervisor'), validate(addPaymentSchema), creditCtrl.addPayment);
```

- [ ] **Step 3: Verificar que compila**

```bash
pnpm build:backend
```

Expected: sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/suppliers/
git commit -m "feat: credit-lines controller and routes"
```

---

## Task 4: Backend — campo creditLineId en Expense

**Files:**
- Modify: `apps/backend/src/modules/expenses/expenses.schema.ts`
- Modify: `apps/backend/src/modules/expenses/expenses.service.ts`

- [ ] **Step 1: Agregar campo al schema Zod de expenses**

En `apps/backend/src/modules/expenses/expenses.schema.ts`, en `baseExpenseSchema`, agregar:

```typescript
  creditLineId: z.string().uuid().optional().nullable(),
```

- [ ] **Step 2: Actualizar createExpense para manejar crédito**

En `apps/backend/src/modules/expenses/expenses.service.ts`, dentro de `createExpense`, antes de `prisma.expense.create`:

```typescript
  // Validar línea de crédito si se indica
  if ((data as any).creditLineId) {
    const line = await prisma.supplierCreditLine.findUnique({
      where: { id: (data as any).creditLineId },
    });
    if (!line || !line.isActive) throw new AppError(400, 'Línea de crédito no encontrada o inactiva', 'INVALID_CREDIT_LINE');
    if (line.supplierId !== (data as any).supplierId && (data as any).supplierId) {
      throw new AppError(400, 'La línea de crédito no pertenece al proveedor indicado', 'CREDIT_LINE_MISMATCH');
    }
  }
```

En `prisma.expense.create({ data: { ... } })`, agregar dentro del objeto `data`:

```typescript
      creditLineId: (data as any).creditLineId ?? null,
```

En `EXPENSE_INCLUDE`, agregar:
```typescript
  creditLine: { select: { id: true, supplierId: true, creditLimit: true, supplier: { select: { name: true } } } },
```

- [ ] **Step 3: Verificar que compila**

```bash
pnpm build:backend
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/expenses/
git commit -m "feat: add creditLineId field to expense creation"
```

---

## Task 5: Frontend — tipos y API

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Agregar tipos**

En `apps/frontend/src/types/index.ts`, agregar:

```typescript
export interface SupplierCreditLine {
  id: string;
  supplierId: string;
  creditLimit: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  supplier?: { id: string; name: string };
  balance?: {
    lineId: string;
    creditLimit: number;
    consumed: number;
    paid: number;
    pending: number;
    available: number;
  };
  payments?: SupplierCreditPayment[];
}

export interface SupplierCreditPayment {
  id: string;
  creditLineId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string };
}
```

En la interfaz `Expense` existente, agregar:
```typescript
  creditLineId?: string | null;
  creditLine?: { id: string; supplierId: string; creditLimit: number; supplier: { name: string } } | null;
```

- [ ] **Step 2: Agregar métodos a la API**

En `apps/frontend/src/api/index.ts`, agregar a `suppliersApi`:

```typescript
  // Líneas de crédito
  getCreditLines: (supplierId: string) =>
    api.get<{ success: boolean; data: SupplierCreditLine[] }>(`/suppliers/${supplierId}/credit-lines`),
  createCreditLine: (supplierId: string, data: { creditLimit: number; notes?: string }) =>
    api.post<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines`, data),
  updateCreditLine: (supplierId: string, lineId: string, data: { creditLimit?: number; notes?: string }) =>
    api.put<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines/${lineId}`, data),
  toggleCreditLine: (supplierId: string, lineId: string) =>
    api.patch<{ success: boolean; data: SupplierCreditLine }>(`/suppliers/${supplierId}/credit-lines/${lineId}/toggle`),
  getCreditLineBalance: (supplierId: string, lineId: string) =>
    api.get<{ success: boolean; data: SupplierCreditLine['balance'] }>(`/suppliers/${supplierId}/credit-lines/${lineId}/balance`),
  addCreditPayment: (supplierId: string, lineId: string, data: { amount: number; paymentDate: string; paymentMethod: string; reference?: string; notes?: string }) =>
    api.post<{ success: boolean; data: SupplierCreditPayment }>(`/suppliers/${supplierId}/credit-lines/${lineId}/payments`, data),
  getCreditPayments: (supplierId: string, lineId: string) =>
    api.get<{ success: boolean; data: SupplierCreditPayment[] }>(`/suppliers/${supplierId}/credit-lines/${lineId}/payments`),
```

Asegurarse de importar `SupplierCreditLine, SupplierCreditPayment` en `api/index.ts` si no están ya importados desde `types`.

- [ ] **Step 3: Verificar que compila**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/types/index.ts apps/frontend/src/api/index.ts
git commit -m "feat: frontend types and API methods for credit lines"
```

---

## Task 6: Frontend — panel de crédito en SuppliersPage

**Files:**
- Modify: `apps/frontend/src/pages/suppliers/SuppliersPage.tsx`

Este task agrega una sección "Línea de Crédito" dentro del modal de edición de suplidor (igual que la sección de Cuentas Bancarias). Aparece cuando `modal === 'edit'`.

- [ ] **Step 1: Leer SuppliersPage.tsx para entender el patrón actual**

Leer el archivo completo. El patrón es: modal `'edit'` → sección de cuentas bancarias en `{modal === 'edit' && editing && role.canManageSuppliers && (...)}`. Replicar el mismo patrón para crédito.

- [ ] **Step 2: Agregar estado y queries de crédito**

Dentro del componente, agregar después de los estados de bankAccounts:

```typescript
const [showCreditForm, setShowCreditForm]   = useState(false);
const [editingLine, setEditingLine]         = useState<SupplierCreditLine | null>(null);
const [creditForm, setCreditForm]           = useState({ creditLimit: '', notes: '' });
const [creditError, setCreditError]         = useState('');
const [showPaymentForm, setShowPaymentForm] = useState(false);
const [paymentForm, setPaymentForm]         = useState({ amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'TRANSFER', reference: '', notes: '' });
const [paymentError, setPaymentError]       = useState('');
const [selectedLineId, setSelectedLineId]   = useState<string | null>(null);

const { data: creditLines, refetch: refetchCreditLines } = useQuery({
  queryKey: ['supplier-credit-lines', editing?.id],
  queryFn:  () => suppliersApi.getCreditLines(editing!.id).then(r => r.data.data),
  enabled:  !!editing?.id,
});
```

- [ ] **Step 3: Agregar mutations de crédito**

```typescript
const createCreditLineMutation = useMutation({
  mutationFn: (data: { creditLimit: number; notes?: string }) =>
    suppliersApi.createCreditLine(editing!.id, data),
  onSuccess: () => { refetchCreditLines(); setShowCreditForm(false); setCreditForm({ creditLimit: '', notes: '' }); setCreditError(''); },
  onError: (e: any) => setCreditError(e.response?.data?.error ?? 'Error al crear línea de crédito'),
});

const toggleCreditLineMutation = useMutation({
  mutationFn: (lineId: string) => suppliersApi.toggleCreditLine(editing!.id, lineId),
  onSuccess: () => refetchCreditLines(),
  onError: (e: any) => setCreditError(e.response?.data?.error ?? 'Error'),
});

const addPaymentMutation = useMutation({
  mutationFn: (data: { lineId: string; amount: number; paymentDate: string; paymentMethod: string; reference?: string; notes?: string }) =>
    suppliersApi.addCreditPayment(editing!.id, data.lineId, data),
  onSuccess: () => { refetchCreditLines(); setShowPaymentForm(false); setSelectedLineId(null); setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'TRANSFER', reference: '', notes: '' }); setPaymentError(''); },
  onError: (e: any) => setPaymentError(e.response?.data?.error ?? 'Error al registrar pago'),
});
```

- [ ] **Step 4: Agregar sección de crédito en el modal de edición**

Después del bloque `{modal === 'edit' && editing && role.canManageSuppliers && (...)}` de bank accounts, agregar:

```tsx
{modal === 'edit' && editing && role.canManageSuppliers && (
  <div className="border-t border-gray-100 px-6 pb-6 pt-5">
    <div className="flex items-center justify-between mb-4">
      <p className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-gray-400" />
        Línea de Crédito
      </p>
      {!showCreditForm && (
        <button type="button" onClick={() => setShowCreditForm(true)}
          className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 bg-[#F5C218] text-[#1C1C1C] hover:opacity-90 transition-opacity">
          + Nueva línea
        </button>
      )}
    </div>

    {/* Lista de líneas */}
    {creditLines && creditLines.length > 0 && creditLines.map((line) => (
      <div key={line.id} className={`mb-3 border ${line.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-['Barlow_Condensed'] text-sm font-bold uppercase">
            Límite: {line.balance ? `RD$ ${Number(line.balance.creditLimit).toLocaleString('es-DO')}` : `RD$ ${Number(line.creditLimit).toLocaleString('es-DO')}`}
          </span>
          <div className="flex gap-2 items-center">
            <span className={`text-xs px-2 py-0.5 font-bold ${line.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {line.isActive ? 'Activa' : 'Inactiva'}
            </span>
            <button type="button" onClick={() => toggleCreditLineMutation.mutate(line.id)}
              className="text-xs text-gray-400 hover:text-gray-700 underline">
              {line.isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
        {line.balance && (
          <div className="grid grid-cols-3 gap-2 text-xs font-['Space_Mono']">
            <div className="bg-gray-50 p-2">
              <div className="text-gray-400 uppercase text-[10px] font-['Barlow_Condensed']">Consumido</div>
              <div className="font-bold text-gray-800">{Number(line.balance.consumed).toLocaleString('es-DO')}</div>
            </div>
            <div className="bg-red-50 p-2">
              <div className="text-red-400 uppercase text-[10px] font-['Barlow_Condensed']">Pendiente</div>
              <div className="font-bold text-red-700">{Number(line.balance.pending).toLocaleString('es-DO')}</div>
            </div>
            <div className="bg-green-50 p-2">
              <div className="text-green-400 uppercase text-[10px] font-['Barlow_Condensed']">Disponible</div>
              <div className="font-bold text-green-700">{Number(line.balance.available).toLocaleString('es-DO')}</div>
            </div>
          </div>
        )}
        {line.isActive && line.balance && line.balance.pending > 0 && (
          <button type="button" onClick={() => { setSelectedLineId(line.id); setShowPaymentForm(true); }}
            className="mt-2 text-xs font-bold uppercase tracking-wide px-3 py-1 bg-[#1C1C1C] text-white hover:bg-gray-800 transition-colors">
            Registrar pago
          </button>
        )}
      </div>
    ))}

    {!creditLines?.length && !showCreditForm && (
      <p className="text-xs text-gray-400 font-['DM_Sans']">Sin líneas de crédito registradas.</p>
    )}

    {/* Formulario nueva línea */}
    {showCreditForm && (
      <form onSubmit={(e) => {
        e.preventDefault(); setCreditError('');
        const limit = Number(creditForm.creditLimit.replace(/,/g, ''));
        if (!limit || limit <= 0) { setCreditError('El límite debe ser mayor a 0'); return; }
        createCreditLineMutation.mutate({ creditLimit: limit, notes: creditForm.notes || undefined });
      }} className="border border-gray-200 p-4 space-y-3 mt-2">
        {creditError && <p className="text-xs text-red-600">{creditError}</p>}
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Límite de crédito *</label>
          <input className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
            value={creditForm.creditLimit}
            onChange={(e) => setCreditForm(f => ({ ...f, creditLimit: e.target.value }))}
            placeholder="300,000.00" />
        </div>
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Notas</label>
          <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
            value={creditForm.notes}
            onChange={(e) => setCreditForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Condiciones, plazo, etc." />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowCreditForm(false); setCreditError(''); }}
            className="flex-1 text-xs font-bold uppercase py-2 border border-gray-200 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={createCreditLineMutation.isPending}
            className="flex-1 text-xs font-bold uppercase py-2 bg-[#F5C218] text-[#1C1C1C] hover:opacity-90 disabled:opacity-50">
            {createCreditLineMutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    )}

    {/* Formulario pago */}
    {showPaymentForm && selectedLineId && (
      <form onSubmit={(e) => {
        e.preventDefault(); setPaymentError('');
        const amount = Number(paymentForm.amount.replace(/,/g, ''));
        if (!amount || amount <= 0) { setPaymentError('El monto debe ser mayor a 0'); return; }
        addPaymentMutation.mutate({ lineId: selectedLineId, amount, paymentDate: paymentForm.paymentDate, paymentMethod: paymentForm.paymentMethod, reference: paymentForm.reference || undefined, notes: paymentForm.notes || undefined });
      }} className="border border-[#F5C218]/40 p-4 space-y-3 mt-2 bg-yellow-50/30">
        <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide text-gray-700">Registrar pago / abono</p>
        {paymentError && <p className="text-xs text-red-600">{paymentError}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Monto *</label>
            <input className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="100,000.00" />
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Fecha *</label>
            <input type="date" className="w-full font-['Space_Mono'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm(f => ({ ...f, paymentDate: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Método *</label>
            <select className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
              <option value="TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
              <option value="CASH">Efectivo</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Referencia</label>
            <input className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="No. cheque / transferencia" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowPaymentForm(false); setSelectedLineId(null); setPaymentError(''); }}
            className="flex-1 text-xs font-bold uppercase py-2 border border-gray-200 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={addPaymentMutation.isPending}
            className="flex-1 text-xs font-bold uppercase py-2 bg-[#1C1C1C] text-white hover:bg-gray-800 disabled:opacity-50">
            {addPaymentMutation.isPending ? 'Guardando…' : 'Registrar pago'}
          </button>
        </div>
      </form>
    )}
  </div>
)}
```

- [ ] **Step 5: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/suppliers/SuppliersPage.tsx
git commit -m "feat: credit line panel in supplier edit modal"
```

---

## Task 7: Frontend — campo "A crédito" en formulario de gastos

**Files:**
- Modify: `apps/frontend/src/pages/expenses/ExpensesPage.tsx`

- [ ] **Step 1: Leer el formulario de gastos**

Leer `apps/frontend/src/pages/expenses/ExpensesPage.tsx` y localizar:
1. El campo `supplierId` (si existe) o `supplierName` en el formulario de creación
2. El campo `paymentMethod`
3. La función `handleSubmit` o la llamada a `createMutation`

- [ ] **Step 2: Agregar estado y query para líneas de crédito**

Después de los estados del formulario, agregar:

```typescript
const [selectedSupplierId, setSelectedSupplierId] = useState('');
const [useCreditLine, setUseCreditLine]           = useState(false);
const [creditLineId, setCreditLineId]             = useState('');

const { data: creditLines } = useQuery({
  queryKey: ['supplier-credit-lines-exp', selectedSupplierId],
  queryFn:  () => suppliersApi.getCreditLines(selectedSupplierId).then(r => r.data.data.filter(l => l.isActive)),
  enabled:  !!selectedSupplierId && useCreditLine,
});
```

- [ ] **Step 3: Agregar campo en el formulario**

Después del campo `paymentMethod` en el formulario, agregar:

```tsx
{/* Toggle crédito proveedor */}
<div className="border border-gray-100 p-3 bg-gray-50">
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={useCreditLine} onChange={(e) => {
      setUseCreditLine(e.target.checked);
      if (!e.target.checked) { setCreditLineId(''); setSelectedSupplierId(''); }
    }} className="accent-[#F5C218]" />
    <span className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700">
      Recibido a crédito de proveedor
    </span>
  </label>
  {useCreditLine && (
    <div className="mt-3 space-y-2">
      <div>
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Proveedor</label>
        <select className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
          value={selectedSupplierId}
          onChange={(e) => { setSelectedSupplierId(e.target.value); setCreditLineId(''); }}>
          <option value="">— Selecciona proveedor —</option>
          {/* usar la lista de suplidores activos ya cargados en la página */}
          {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {selectedSupplierId && (
        <div>
          <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Línea de crédito</label>
          <select className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
            value={creditLineId}
            onChange={(e) => setCreditLineId(e.target.value)}>
            <option value="">— Selecciona línea —</option>
            {creditLines?.map((l) => (
              <option key={l.id} value={l.id}>
                Límite: RD${Number(l.creditLimit).toLocaleString('es-DO')} — Disponible: RD${Number(l.balance?.available ?? l.creditLimit).toLocaleString('es-DO')}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Pasar creditLineId al submit**

En la llamada a `createMutation.mutate(...)`, agregar `creditLineId: useCreditLine && creditLineId ? creditLineId : undefined`.

Después del éxito de creación, resetear: `setUseCreditLine(false); setCreditLineId(''); setSelectedSupplierId('');`

- [ ] **Step 5: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores.

- [ ] **Step 6: Commit y push**

```bash
git add apps/frontend/src/pages/expenses/ExpensesPage.tsx
git commit -m "feat: add credit line selector to expense creation form"
git push origin main
```

---

## Task 8: Migración en producción

**Files:**
- No hay cambios de código — verificar que la migración corre en Render

- [ ] **Step 1: Verificar que el archivo de migración está en el repo**

```bash
ls apps/backend/prisma/migrations/20260615000003_add_credit_lines/
```

Expected: `migration.sql`

- [ ] **Step 2: Push a main si no está ya**

```bash
git push origin main
```

Render corre `prisma migrate deploy` como `preDeployCommand` — la migración se aplica automáticamente.

- [ ] **Step 3: Verificar en logs de Render**

En el dashboard de Render, verificar que el deploy log muestra:
```
Running migrations...
1 migration applied
```

- [ ] **Step 4: Verificar endpoint en producción**

```bash
curl https://servingmi-backend.onrender.com/api/v1/suppliers \
  -H "Authorization: Bearer <token>" | jq '.data[0]'
```

Expected: respuesta sin error.

- [ ] **Step 5: Commit final si faltara algo**

```bash
git add -A && git commit -m "chore: verify credit lines migration applied in production"
```
