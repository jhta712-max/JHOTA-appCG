# Payment Orders — Tipo OFFICE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `OFFICE` order type to PaymentOrders so that when marked as paid, it auto-creates an `OfficeExpense` instead of a project `Expense`.

**Architecture:** Three-layer change — Prisma schema (nullable fields + 3 new fields), backend validation + `markAsPaid()` branch, frontend form conditional fields. The new OFFICE branch in `markAsPaid()` is isolated from existing SERVICIO/MATERIALS/PETTY_CASH/PAYROLL branches.

**Tech Stack:** Prisma ORM + PostgreSQL 16, TypeScript/Express backend, React 18 + react-hook-form frontend.

---

### Task 1: Prisma schema changes + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (lines 906–964)

- [ ] **Step 1: Make `projectId` and `supplierId` nullable in the PaymentOrder model**

In `apps/backend/prisma/schema.prisma`, change lines 911–912:

```prisma
// Before:
  supplierId    String    @map("supplier_id") @db.Uuid
  projectId     String    @map("project_id") @db.Uuid

// After:
  supplierId    String?   @map("supplier_id") @db.Uuid
  projectId     String?   @map("project_id") @db.Uuid
```

- [ ] **Step 2: Add 3 new fields to PaymentOrder (after line 930 — after `expenseId`)**

```prisma
  officeExpenseCategory String?   @map("office_expense_category") @db.VarChar(50)
  officeSupplierName    String?   @map("office_supplier_name")    @db.VarChar(200)
  officeExpenseId       String?   @map("office_expense_id")       @db.Text
```

- [ ] **Step 3: Update the `supplier` and `project` relations to be optional**

Change lines 939–940:
```prisma
// Before:
  supplier         Supplier          @relation(fields: [supplierId], references: [id])
  project          Project           @relation(fields: [projectId], references: [id])

// After:
  supplier         Supplier?         @relation(fields: [supplierId], references: [id])
  project          Project?          @relation(fields: [projectId], references: [id])
```

- [ ] **Step 4: Update the enum comment on `orderType` field (line 909)**

```prisma
// Before:
  orderType     String    @default("SERVICIO") @map("order_type") @db.VarChar(20) // SERVICIO | PAYROLL | MATERIALS

// After:
  orderType     String    @default("SERVICIO") @map("order_type") @db.VarChar(20) // SERVICIO | PAYROLL | MATERIALS | PETTY_CASH | OFFICE
```

- [ ] **Step 5: Create migration**

```bash
cd /home/user/servingmi-appCG
pnpm --filter backend db:generate
```

Expected: Prisma client generated successfully (no TypeScript errors).

Then create the migration SQL manually at `apps/backend/prisma/migrations/20260626000001_payment_orders_office_type/migration.sql`:

```sql
-- Make projectId and supplierId nullable
ALTER TABLE "payment_orders" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "payment_orders" ALTER COLUMN "supplier_id" DROP NOT NULL;

-- Add new office fields
ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "office_expense_category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "office_supplier_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "office_expense_id" TEXT;
```

- [ ] **Step 6: Verify build passes**

```bash
pnpm build:backend
```

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git config user.email noreply@anthropic.com && git config user.name Claude
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat: schema — payment_orders OFFICE type (nullable projectId/supplierId + 3 new fields)"
```

---

### Task 2: Backend — validation schema + OFFICE branch in `markAsPaid()`

**Files:**
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.schema.ts`
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.service.ts`

- [ ] **Step 1: Update the Zod schema to add OFFICE to `orderType` enum and make `projectId`/`supplierId` optional**

In `apps/backend/src/modules/payment-orders/payment-orders.schema.ts`, replace the entire file content:

```typescript
import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  orderType:     z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH', 'OFFICE']).default('SERVICIO'),
  payingCompany: z.string().min(2).max(200),
  supplierId:    z.string().uuid().optional().nullable(),
  projectId:     z.string().uuid().optional().nullable(),
  amount:        z.coerce.number().positive(),
  currency:      z.enum(['RD$', 'US$', '€']).default('RD$'),
  concept:       z.string().min(3).max(2000),
  notes:              z.string().max(500).optional(),
  payrollId:          z.string().uuid().optional(),
  bankAccountId:      z.string().uuid().optional(),
  contratoAjustadoId: z.string().uuid().optional().nullable(),
  quotationId:        z.string().uuid().optional().nullable(),
  projectItemId:      z.string().uuid().optional().nullable(),
  batchItemId:        z.string().uuid().optional().nullable(),
  creditLineId:       z.string().uuid().optional().nullable(),
  // OFFICE-only fields
  officeExpenseCategory: z.string().optional().nullable(),
  officeSupplierName:    z.string().max(200).optional().nullable(),
  // Auto-create payroll data (only when orderType === 'PAYROLL')
  payrollData: z.object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type:        z.enum(['LABOR', 'SERVICE']),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.orderType === 'OFFICE') {
    if (!data.officeExpenseCategory) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'officeExpenseCategory es requerido para órdenes OFFICE', path: ['officeExpenseCategory'] });
    }
    if (!data.supplierId && !data.officeSupplierName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe indicar un proveedor (supplierId o officeSupplierName) para órdenes OFFICE', path: ['officeSupplierName'] });
    }
  } else {
    if (!data.projectId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'projectId es requerido para este tipo de orden', path: ['projectId'] });
    }
    if (!data.supplierId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'supplierId es requerido para este tipo de orden', path: ['supplierId'] });
    }
  }
});

export const updatePaymentOrderSchema = createPaymentOrderSchema.partial();

export const querySchema = z.object({
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(500).default(20),
  status:     z.string().optional(),
  orderType:  z.enum(['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH', 'OFFICE']).optional(),
  projectId:    z.string().uuid().optional(),
  supplierId:   z.string().uuid().optional(),
  createdById:  z.string().uuid().optional(),
  search:       z.string().optional(),
  orderBy:    z.enum(['createdAt', 'amount', 'number']).default('createdAt'),
  order:      z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type UpdatePaymentOrderInput = z.infer<typeof updatePaymentOrderSchema>;
export type PaymentOrderQuery       = z.infer<typeof querySchema>;
```

- [ ] **Step 2: Add the OFFICE branch in `markAsPaid()` in `payment-orders.service.ts`**

The `markAsPaid()` function is at line 518. The condition at line 575 currently is:
```typescript
if (!po.expenseId && po.orderType !== 'PAYROLL') {
```

This needs to split into two branches. Replace lines 575–711 with:

```typescript
    // OFFICE orders: auto-create OfficeExpense
    if (po.orderType === 'OFFICE' && !(po as any).officeExpenseId) {
      const isForeign    = po.currency !== 'RD$';
      const exchangeRate = paymentInfo?.exchangeRate ?? null;
      if (isForeign && !exchangeRate) {
        throw new AppError(400, `Debe ingresar la tasa de cambio (TC) para órdenes en ${po.currency}`, 'EXCHANGE_RATE_REQUIRED');
      }
      const amountDOP = isForeign && exchangeRate
        ? Number(po.amount) * exchangeRate
        : Number(po.amount);

      const supplierName = (po as any).supplier?.name ?? (po as any).officeSupplierName ?? null;

      const officeExpense = await tx.officeExpense.create({
        data: {
          category:      (po as any).officeExpenseCategory as any,
          description:   po.concept,
          amount:        amountDOP,
          itbisAmount:   0,
          expenseDate:   new Date(),
          paymentMethod: (paymentInfo?.paymentMethod ?? 'TRANSFER') as any,
          supplierName:  supplierName,
          hasFiscalDoc:  !!(fiscalVoucher?.ncf),
          fiscalDocNum:  fiscalVoucher?.ncf ?? null,
          notes:         po.notes
            ? `[Orden de pago #${po.number}] ${po.notes}`
            : `Generado desde orden de pago #${po.number}`,
          createdById:   userId,
        },
      });

      await tx.paymentOrder.update({
        where: { id },
        data:  { officeExpenseId: officeExpense.id } as any,
      });
    }

    // Non-OFFICE, non-PAYROLL orders: auto-create project Expense
    if (!(po as any).expenseId && po.orderType !== 'PAYROLL' && po.orderType !== 'OFFICE') {
      const categoryName = po.orderType === 'MATERIALS' ? 'Materiales' : po.orderType === 'PETTY_CASH' ? 'Caja Chica' : 'Servicios';
      const category = await tx.expenseCategory.upsert({
        where:  { name: categoryName },
        update: { isActive: true },
        create: { name: categoryName, description: 'Auto-creada para órdenes de pago', isActive: true },
      });

      const opRef      = `OP-${String(po.number).padStart(3, '0')}`;
      const hasFiscal  = !!(fiscalVoucher?.ncf);

      const isForeign      = po.currency !== 'RD$';
      const exchangeRate   = paymentInfo?.exchangeRate ?? null;
      if (isForeign && !exchangeRate) {
        throw new AppError(400, `Debe ingresar la tasa de cambio (TC) para órdenes en ${po.currency}`, 'EXCHANGE_RATE_REQUIRED');
      }
      const amountDOP      = isForeign && exchangeRate
        ? Number(po.amount) * exchangeRate
        : Number(po.amount);
      const foreignCurrencyISO = po.currency === 'US$' ? 'USD' : po.currency === '€' ? 'EUR' : null;

      const expense = await tx.expense.create({
        data: {
          ...buildExpenseData({
            projectId:          (po as any).projectId,
            categoryId:         category.id,
            userId,
            expenseDate:        new Date(),
            amount:             amountDOP,
            description:        `[${opRef}] ${po.concept}`,
            paymentMethod:      paymentInfo?.paymentMethod ?? 'TRANSFER',
            paymentBank:        paymentInfo?.paymentBank      ?? null,
            paymentReference:   paymentInfo?.paymentReference ?? null,
            hasFiscalDoc:       hasFiscal,
            notes:              `Auto-generado al confirmar ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}. Empresa: ${po.payingCompany}.${isForeign ? ` Divisa original: ${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? ` (TC: ${exchangeRate})` : ''}.` : ''}`,
            contratoAjustadoId: (po as any).contratoAjustadoId ?? null,
            batchItemId:        (po as any).batchItemId ?? null,
            ...(isForeign && foreignCurrencyISO ? {
              foreignAmount:   po.amount,
              foreignCurrency: foreignCurrencyISO,
              exchangeRate:    exchangeRate ?? undefined,
            } : {}),
          }),
          ...(hasFiscal && fiscalVoucher ? {
            fiscalVoucher: {
              create: {
                ncf:          fiscalVoucher.ncf,
                ncfType:      extractNCFType(fiscalVoucher.ncf),
                isElectronic: isElectronicNCF(fiscalVoucher.ncf),
                supplierRnc:  fiscalVoucher.supplierRnc,
                supplierName: fiscalVoucher.supplierName,
                itbisAmount:  fiscalVoucher.itbisAmount ?? 0,
              },
            },
          } : {}),
        } as any,
      });

      // Link expense to quotation if this SERVICIO order has a quotation linked
      if ((po as any).quotationId) {
        const quotation = await tx.quotation.findUnique({ where: { id: (po as any).quotationId } });
        if (quotation) {
          const lastPayment = await tx.quotationPayment.findFirst({
            where:   { quotationId: (po as any).quotationId },
            orderBy: { sequence: 'desc' },
          });
          const nextSeq = (lastPayment?.sequence ?? 0) + 1;

          const poAmount     = Number(po.amount);
          const quotCurrency = quotation.currency;
          const poCurrency   = po.currency;

          let quotationAmount: number;
          if (poCurrency === quotCurrency) {
            quotationAmount = poAmount;
          } else if (isForeign && quotCurrency === 'RD$' && exchangeRate) {
            quotationAmount = amountDOP;
          } else if (poCurrency === 'RD$' && quotCurrency !== 'RD$' && exchangeRate) {
            quotationAmount = poAmount / exchangeRate;
          } else {
            quotationAmount = poAmount;
          }

          await tx.quotationPayment.create({
            data: {
              quotationId:   (po as any).quotationId,
              expenseId:     expense.id,
              sequence:      nextSeq,
              amount:        quotationAmount,
              currency:      quotCurrency,
              paymentDate:   new Date(),
              paymentMethod: 'TRANSFER',
              description:   `Pago desde ${opRef}${isForeign ? ` (${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? ` × TC ${exchangeRate}` : ''})` : ''}`,
              notes:         isForeign ? `Divisa: ${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? `. Tasa de cambio: 1 ${po.currency} = RD$ ${exchangeRate}` : ''}` : null,
              createdById:   userId,
            },
          });
        }

        await tx.quotationExpenseLink.create({
          data: {
            quotationId: (po as any).quotationId,
            expenseId:   expense.id,
            linkType:    'PARTIAL_INVOICE',
            notes:       `Auto-vinculado desde ${opRef}${isForeign ? ` | ${po.currency} ${Number(po.amount).toFixed(2)}` : ''}`,
            createdById: userId,
          },
        });
      }

      // Register advance in contrato ajustado if linked
      if ((po as any).contratoAjustadoId) {
        await tx.contratoAjustadoPago.create({
          data: {
            contratoAjustadoId: (po as any).contratoAjustadoId,
            ordenPagoId:        po.id,
            gastoId:            expense.id,
            monto:              po.amount,
            fecha:              new Date(),
            creadoPorId:        userId,
          },
        });
      }

      await tx.paymentOrder.update({ where: { id }, data: { expenseId: expense.id } });
    }

    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
```

- [ ] **Step 3: Verify build passes**

```bash
pnpm build:backend
```

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git config user.email noreply@anthropic.com && git config user.name Claude
git add apps/backend/src/modules/payment-orders/
git commit -m "feat: backend — payment orders OFFICE type validation and markAsPaid branch"
```

---

### Task 3: Backend — `generatedText` for OFFICE orders

**Files:**
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.service.ts`

The `generatedText` field is built somewhere in the service (search for `generatedText`). Find the function that builds it and add an OFFICE branch.

- [ ] **Step 1: Find the generatedText builder**

```bash
grep -n "generatedText\|generated_text\|buildWhatsApp\|buildText" apps/backend/src/modules/payment-orders/payment-orders.service.ts | head -30
```

- [ ] **Step 2: Add OFFICE case to the generatedText builder**

When `orderType === 'OFFICE'`, the text should be:

```
🏢 GASTO DE OFICINA
Orden: OP-XXX
Concepto: {concept}
Monto: {currency} {amount}
Categoría: {officeExpenseCategory in Spanish}
Proveedor: {supplier.name ?? officeSupplierName ?? 'No especificado'}
Empresa: {payingCompany}
```

The category label mapping:
```typescript
const OFFICE_CATEGORY_LABELS: Record<string, string> = {
  CLEANING_SUPPLIES: 'Insumos de Limpieza',
  CONSUMABLES:       'Material Gastable',
  OFFICE_SERVICES:   'Servicios de Oficina',
  BIDDING:           'Licitación',
  OFFICE_ASSETS:     'Activos de Oficina',
  OTHER:             'Otros Gastos de Oficina',
};
```

- [ ] **Step 3: Verify build passes**

```bash
pnpm build:backend
```

- [ ] **Step 4: Commit**

```bash
git config user.email noreply@anthropic.com && git config user.name Claude
git add apps/backend/src/modules/payment-orders/
git commit -m "feat: backend — OFFICE order generatedText for WhatsApp"
```

---

### Task 4: Frontend — Form conditional fields for OFFICE type

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

- [ ] **Step 1: Add OFFICE to the orderType options in the form**

In `PaymentOrdersPage.tsx`, find the `orderType` selector (look for `SERVICIO`, `PAYROLL`, `MATERIALS`, `PETTY_CASH` options). Add:

```tsx
<option value="OFFICE">Gasto de Oficina</option>
```

- [ ] **Step 2: Read the form to understand its structure**

```bash
grep -n "orderType\|projectId\|supplierId\|Proyecto\|Proveedor" apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx | head -40
```

- [ ] **Step 3: Hide the Proyecto field when orderType === 'OFFICE'**

Find the "Proyecto" form field and wrap it with a conditional:
```tsx
{watchedOrderType !== 'OFFICE' && (
  <div> {/* existing Proyecto field */} </div>
)}
```

Where `watchedOrderType` is obtained from `watch('orderType')` — already used in the form (check if it exists, add if not).

- [ ] **Step 4: Make Proveedor optional when orderType === 'OFFICE', add free-text fallback**

Find the supplierId selector. When `orderType === 'OFFICE'`:
- Remove the required asterisk (change label)
- Add a free-text "Nombre del proveedor" field below the selector that appears when supplierId is not selected

```tsx
{watchedOrderType === 'OFFICE' && !watchedSupplierId && (
  <div>
    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
      Nombre del proveedor
    </label>
    <input
      {...register('officeSupplierName')}
      className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
      placeholder="Ej: Ferretería La Industrial"
    />
  </div>
)}
```

- [ ] **Step 5: Add Categoría de gasto field (required for OFFICE)**

```tsx
{watchedOrderType === 'OFFICE' && (
  <div>
    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
      Categoría de gasto <span className="text-red-500">*</span>
    </label>
    <select
      {...register('officeExpenseCategory')}
      className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
    >
      <option value="">Seleccionar categoría...</option>
      <option value="CLEANING_SUPPLIES">Insumos de Limpieza</option>
      <option value="CONSUMABLES">Material Gastable</option>
      <option value="OFFICE_SERVICES">Servicios de Oficina</option>
      <option value="BIDDING">Licitación</option>
      <option value="OFFICE_ASSETS">Activos de Oficina</option>
      <option value="OTHER">Otros Gastos de Oficina</option>
    </select>
  </div>
)}
```

- [ ] **Step 6: Register the new fields in react-hook-form**

In the `useForm` call, add default values for new fields:
```typescript
officeExpenseCategory: '',
officeSupplierName: '',
```

- [ ] **Step 7: Include new fields in the submit payload**

In the `onSubmit` handler, make sure the payload includes `officeExpenseCategory` and `officeSupplierName` when `orderType === 'OFFICE'`, and that `projectId` and `supplierId` are excluded/nulled for OFFICE orders.

Pattern: before sending, build the payload like:
```typescript
const payload = {
  ...formData,
  projectId: formData.orderType === 'OFFICE' ? null : formData.projectId,
  supplierId: formData.orderType === 'OFFICE' && !formData.supplierId ? null : formData.supplierId,
};
```

- [ ] **Step 8: Verify build passes**

```bash
pnpm build:frontend
```

Expected: No TypeScript/ESBuild errors.

- [ ] **Step 9: Commit**

```bash
git config user.email noreply@anthropic.com && git config user.name Claude
git add apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
git commit -m "feat: frontend — payment orders OFFICE type form (conditional project/supplier/category fields)"
```

---

### Task 5: Frontend — OFFICE badge in list + officeExpenseId link

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

- [ ] **Step 1: Add OFFICE to the orderType badge/chip renderer**

Find the section that renders the orderType label (look for `SERVICIO`, `Servicio`, `PAYROLL`, `MATERIALS`, `PETTY_CASH`). Add:

```tsx
// In the label/chip map:
OFFICE: 'Gasto de Oficina',
```

Or if it uses a switch/if chain, add the OFFICE case producing `'Gasto de Oficina'`.

- [ ] **Step 2: Add OFFICE to the query filter dropdown (if one exists)**

If there's a filter by `orderType` in the list view, add:
```tsx
<option value="OFFICE">Gasto de Oficina</option>
```

- [ ] **Step 3: Show "Ver gasto de oficina" link when `officeExpenseId` is present**

In the order detail/row expanded view (or wherever `expenseId` link appears), add a parallel block:
```tsx
{order.officeExpenseId && (
  <a
    href="/office-expenses"
    className="text-xs font-['DM_Sans'] text-[#F5C218] underline"
  >
    Ver gasto de oficina →
  </a>
)}
```

- [ ] **Step 4: Verify build**

```bash
pnpm build:frontend
```

- [ ] **Step 5: Commit and push**

```bash
git config user.email noreply@anthropic.com && git config user.name Claude
git add apps/frontend/src/pages/payment-orders/
git commit -m "feat: frontend — OFFICE badge, filter, and officeExpenseId link in payment orders"
git push -u origin claude/happy-feynman-stMWv
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Task 1: Schema — `projectId`/`supplierId` nullable, 3 new fields, migration SQL
- ✅ Task 2: Backend — Zod validation with `.superRefine()`, `markAsPaid()` OFFICE branch
- ✅ Task 3: Backend — `generatedText` for OFFICE orders (WhatsApp)
- ✅ Task 4: Frontend — form hides Proyecto, Proveedor optional + free text, Categoría selector
- ✅ Task 5: Frontend — badge "Gasto de Oficina", filter option, officeExpenseId link

**Constraints verified against spec:**
- Cannot mark PAID without `officeExpenseCategory` — enforced at Zod level AND `markAsPaid()` uses `(po as any).officeExpenseCategory as any` (Prisma will throw if null passed to non-nullable enum, so validating at schema layer is the right gate)
- Currency conversion reused from existing logic (same pattern as SERVICIO branch)
- `hasFiscalDoc`/`fiscalDocNum` propagated from existing `fiscalVoucher` input
- `officeExpenseId` FK saved after creation → bidirectional traceability
- No changes to `buildExpenseData()` or OfficeExpense module — ✅

**Placeholders:** None.

**Type consistency:** `officeExpenseCategory` passed as `any` cast to avoid TS narrowing issues with dynamic string → `OfficeExpenseCategory` enum.
