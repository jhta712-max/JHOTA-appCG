# PaymentOrder Completeness Fields + Exchange Rate Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paymentMethod and exchangeRate snapshot to PaymentOrder, with BCRD exchange rate validation UX and accountability checkbox in the pay modal.

**Architecture:** Backend migration adds 4 fields to PaymentOrder; new proxy endpoint fetches BCRD rates; frontend pay modal gains method selector, BCRD fetch button, and confirmation checkbox required when foreign currency is used.

**Tech Stack:** Prisma ORM migrations, Express proxy endpoint (node-fetch or native fetch), React + TanStack Query, TailwindCSS

---

## Overview of changes

| Layer | What changes |
|-------|-------------|
| `apps/backend/prisma/schema.prisma` | Add 4 fields to `PaymentOrder`: `paymentMethod`, `exchangeRate`, `exchangeRateValidatedBy`, `exchangeRateValidatedAt` |
| New migration | `pnpm db:migrate` generates SQL migration |
| `payment-orders.service.ts` | Update `markAsPaid` to accept and store new fields; propagate `paymentMethod` into `buildExpenseData` |
| `payment-orders.controller.ts` | Update `markAsPaid` controller to pass new fields; add `getBcrdRate` controller |
| `payment-orders.router.ts` | Add `GET /bcrd-rate` route |
| `apps/frontend/src/types/index.ts` | Extend `PaymentOrder` interface with 4 new fields |
| `apps/frontend/src/api/index.ts` (or `paymentOrdersApi`) | Add `getBcrdRate()` API client method |
| `PaymentOrdersPage.tsx` | Extend pay modal: payment method selector, BCRD fetch, editable rate, confirmation checkbox |

---

## Task 1 — Backend: Prisma schema migration

### 1.1 Edit `apps/backend/prisma/schema.prisma`

Locate the `PaymentOrder` model (lines 729–771). After the existing `paymentReference` field (line 745), add four new optional fields:

```prisma
// Completeness fields added 2026-06-10
paymentMethod             PaymentMethod? @map("payment_method")
exchangeRate              Decimal?       @map("exchange_rate")        @db.Decimal(10, 4)
exchangeRateValidatedBy   String?        @map("exchange_rate_validated_by") @db.Uuid
exchangeRateValidatedAt   DateTime?      @map("exchange_rate_validated_at")
```

The `PaymentMethod` enum already exists in the schema (defined at line 291) — no new enum needed.

Also add the relation reference to `User` for `exchangeRateValidatedBy`. In the `User` model, add:
```prisma
paymentOrdersExchangeValidated PaymentOrder[] @relation("PaymentOrderExchangeValidatedBy")
```

And in `PaymentOrder`, add the relation:
```prisma
exchangeRateValidator User? @relation("PaymentOrderExchangeValidatedBy", fields: [exchangeRateValidatedBy], references: [id])
```

Full diff for `PaymentOrder` model — the fields block after line 745 becomes:

```prisma
  paidAt                    DateTime?     @map("paid_at")
  paidById                  String?       @map("paid_by_id") @db.Uuid
  paymentBank               String?       @map("payment_bank")      @db.VarChar(100)
  paymentReference          String?       @map("payment_reference") @db.VarChar(100)
  // Completeness fields (2026-06-10)
  paymentMethod             PaymentMethod? @map("payment_method")
  exchangeRate              Decimal?       @map("exchange_rate")               @db.Decimal(10, 4)
  exchangeRateValidatedBy   String?        @map("exchange_rate_validated_by")  @db.Uuid
  exchangeRateValidatedAt   DateTime?      @map("exchange_rate_validated_at")
```

And in the relations block:
```prisma
  exchangeRateValidator User? @relation("PaymentOrderExchangeValidatedBy", fields: [exchangeRateValidatedBy], references: [id])
```

### 1.2 Update `User` model relations

In the `User` model, add at the end of the relation list (after `paymentOrdersPaid`):
```prisma
  paymentOrdersExchangeValidated PaymentOrder[] @relation("PaymentOrderExchangeValidatedBy")
```

### 1.3 Run migration

```bash
cd /home/user/servingmi-appCG

# Create and apply migration
pnpm db:migrate
# When prompted for migration name, enter: add_payment_order_completeness_fields
```

Expected output:
```
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260610XXXXXX_add_payment_order_completeness_fields/
    └─ migration.sql

Your database is now in sync with your schema.

Running generate... (Use --skip-generate to skip the generators)
✔  Generated Prisma Client
```

### 1.4 Verify migration SQL

The generated `migration.sql` should contain:
```sql
ALTER TABLE "payment_orders" ADD COLUMN "payment_method" "payment_method";
ALTER TABLE "payment_orders" ADD COLUMN "exchange_rate" DECIMAL(10,4);
ALTER TABLE "payment_orders" ADD COLUMN "exchange_rate_validated_by" UUID;
ALTER TABLE "payment_orders" ADD COLUMN "exchange_rate_validated_at" TIMESTAMP(3);

ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_exchange_rate_validated_by_fkey"
  FOREIGN KEY ("exchange_rate_validated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] Edit `schema.prisma` — add 4 fields to `PaymentOrder`
- [ ] Edit `schema.prisma` — add `exchangeRateValidator` relation to `PaymentOrder`
- [ ] Edit `schema.prisma` — add `paymentOrdersExchangeValidated` relation to `User`
- [ ] Run `pnpm db:migrate` — confirm migration created and applied
- [ ] Verify migration SQL file looks correct
- [ ] Run `pnpm db:generate` if not auto-generated: `cd apps/backend && pnpm prisma generate`

### 1.5 Commit

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations/
git commit -m "feat(db): add paymentMethod + exchangeRate completeness fields to PaymentOrder"
```

---

## Task 2 — Backend: BCRD proxy endpoint + service updates

### 2.1 BCRD rate fetcher — new file `apps/backend/src/modules/payment-orders/bcrd-rate.ts`

Create this file:

```typescript
/**
 * bcrd-rate.ts
 * Fetches the daily USD exchange rate from the Banco Central RD public API.
 * Gracefully falls back if the API is unavailable.
 *
 * BCRD public endpoint (no auth required):
 *   https://estadisticas.bcrd.gov.do/api/
 *   Series: TC.MN.USD (tasa de cambio compra) and TC.MV.USD (tasa de cambio venta)
 *
 * If BCRD API is unreachable, returns { compra: null, venta: null, date: null, fallback: true }
 */

export interface BcrdRateResult {
  currency: string;
  compra:   number | null;
  venta:    number | null;
  date:     string | null;
  fallback: boolean;
  source:   string;
}

// BCRD API base — public, no auth
const BCRD_API_BASE = 'https://estadisticas.bcrd.gov.do/api/';

// Series codes: compra = buying rate, venta = selling rate (what banks charge customers)
const SERIES: Record<string, { compra: string; venta: string }> = {
  USD: { compra: 'TC.MN.USD', venta: 'TC.MV.USD' },
  EUR: { compra: 'TC.MN.EUR', venta: 'TC.MV.EUR' },
};

/**
 * Fetch a single BCRD time series (most recent value).
 * Returns null on any error.
 */
async function fetchSeries(seriesCode: string): Promise<{ value: number; date: string } | null> {
  try {
    // BCRD REST API: /series/{code}/data?limit=1&order=desc
    const url = `${BCRD_API_BASE}series/${encodeURIComponent(seriesCode)}/data?limit=1&order=desc`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const json = await res.json() as any;

    // Response shape (may vary): { data: [{ fecha: "2026-06-10", valor: 60.50 }] }
    const rows = json?.data ?? json?.result ?? json?.observations ?? [];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row   = rows[0];
    const value = Number(row?.valor ?? row?.value ?? row?.obs_value);
    const date  = String(row?.fecha ?? row?.date ?? row?.time_period ?? '');

    if (!isFinite(value) || value <= 0) return null;
    return { value, date };
  } catch {
    return null;
  }
}

/**
 * Public function called by the controller.
 * Supports currency = 'USD' | 'EUR'; defaults to USD.
 * EUR series codes may not exist on BCRD — fallback applies automatically.
 */
export async function getBcrdRate(currency = 'USD'): Promise<BcrdRateResult> {
  const series = SERIES[currency.toUpperCase()] ?? SERIES['USD'];
  const cur    = currency.toUpperCase() in SERIES ? currency.toUpperCase() : 'USD';

  const [compraResult, ventaResult] = await Promise.all([
    fetchSeries(series.compra),
    fetchSeries(series.venta),
  ]);

  if (!compraResult && !ventaResult) {
    return { currency: cur, compra: null, venta: null, date: null, fallback: true, source: 'bcrd' };
  }

  const date = ventaResult?.date ?? compraResult?.date ?? new Date().toISOString().slice(0, 10);

  return {
    currency: cur,
    compra:   compraResult?.value ?? null,
    venta:    ventaResult?.value  ?? null,
    date,
    fallback: false,
    source:   'bcrd',
  };
}
```

### 2.2 Update `PaymentInfoInput` interface in `payment-orders.service.ts`

Locate the `PaymentInfoInput` interface (lines 55–59). Replace with:

```typescript
interface PaymentInfoInput {
  paymentBank?:            string | null;
  paymentReference?:       string | null;
  paymentMethod?:          string | null;  // PaymentMethod enum value
  exchangeRate?:           number | null;  // Required when currency != 'RD$'
  exchangeRateValidated?:  boolean;        // User confirmed the rate
}
```

### 2.3 Update `markAsPaid` service function

In `payment-orders.service.ts`, update the `markAsPaid` function signature:

```typescript
export async function markAsPaid(
  id: string,
  userId: string,
  fiscalVoucher?: FiscalVoucherInput | null,
  paymentInfo?: PaymentInfoInput | null,
)
```

Inside the function, in the `tx.paymentOrder.update(...)` call (lines 462–471), add the new fields:

```typescript
await tx.paymentOrder.update({
  where: { id },
  data: {
    status:                   'PAID',
    paidAt:                   new Date(),
    paidById:                 userId,
    paymentBank:              paymentInfo?.paymentBank      ?? null,
    paymentReference:         paymentInfo?.paymentReference ?? null,
    // New completeness fields
    paymentMethod:            (paymentInfo?.paymentMethod ?? 'TRANSFER') as any,
    exchangeRate:             paymentInfo?.exchangeRate    ?? null,
    exchangeRateValidatedBy:  (paymentInfo?.exchangeRate != null && paymentInfo?.exchangeRateValidated)
                                ? userId : null,
    exchangeRateValidatedAt:  (paymentInfo?.exchangeRate != null && paymentInfo?.exchangeRateValidated)
                                ? new Date() : null,
  },
});
```

Also update `buildExpenseData` call inside `markAsPaid` (the auto-created expense) to propagate `paymentMethod`:

```typescript
const expense = await tx.expense.create({
  data: {
    ...buildExpenseData({
      projectId:          po.projectId,
      categoryId:         category.id,
      userId,
      expenseDate:        new Date(),
      amount:             amountDOP,
      description:        `[${opRef}] ${po.concept}`,
      paymentMethod:      paymentInfo?.paymentMethod ?? 'TRANSFER',  // ← propagate
      hasFiscalDoc:       hasFiscal,
      notes:              `Auto-generado al confirmar ${opRef}. ...`,
      contratoAjustadoId: (po as any).contratoAjustadoId ?? null,
      ...(isForeign && foreignCurrencyISO ? {
        foreignAmount:   po.amount,
        foreignCurrency: foreignCurrencyISO,
        exchangeRate:    paymentInfo?.exchangeRate ?? undefined,
      } : {}),
    }),
    ...
  }
});
```

Also update `INCLUDE` constant to include the new relation:

```typescript
const INCLUDE = {
  supplier:               true,
  project:                { select: { id: true, code: true, name: true } },
  createdBy:              { select: { id: true, name: true } },
  paidBy:                 { select: { id: true, name: true } },
  exchangeRateValidator:  { select: { id: true, name: true } },   // ← new
  payroll:                { select: { id: true, number: true, type: true, totalAmount: true, periodStart: true, periodEnd: true, status: true } },
  expense:                { select: { id: true, amount: true, expenseDate: true, description: true, status: true } },
  contratoAjustado:       { select: { id: true, descripcionTrabajo: true, montoContratado: true, estado: true } },
} as const;
```

### 2.4 Add `getBcrdRate` controller function to `payment-orders.controller.ts`

Add at the top of the file, import the bcrd module:
```typescript
import { getBcrdRate } from './bcrd-rate';
```

Add a new exported controller function at the end of the file:
```typescript
export async function getBcrdRateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const currency = (req.query.currency as string) ?? 'USD';
    if (!['USD', 'EUR'].includes(currency.toUpperCase())) {
      res.status(400).json({ success: false, error: 'currency must be USD or EUR' });
      return;
    }
    const data = await getBcrdRate(currency);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}
```

### 2.5 Add route in `payment-orders.router.ts`

Import the new controller:
```typescript
import {
  listPaymentOrders, getPaymentOrder,
  getAvailablePayrolls, getAvailableExpenses, getAvailableContracts, getAvailableQuotations,
  createPaymentOrder, updatePaymentOrder,
  linkExpense, unlinkExpense,
  linkPayroll, unlinkPayroll,
  markAsPaid, revertToPending, voidPaymentOrder,
  generateExpense, hardDeletePaymentOrder, suggestConcept,
  getBcrdRateHandler,    // ← new
} from './payment-orders.controller';
```

Add route before `router.get('/:id', ...)` (so it doesn't get swallowed by the param route):
```typescript
router.get('/bcrd-rate', getBcrdRateHandler);
```

The updated route list (order matters — specifics before params):
```typescript
router.get('/',                       listPaymentOrders);
router.get('/available-payrolls',     getAvailablePayrolls);
router.get('/available-expenses',     getAvailableExpenses);
router.get('/available-contracts',    getAvailableContracts);
router.get('/available-quotations',   getAvailableQuotations);
router.get('/bcrd-rate',              getBcrdRateHandler);    // ← new, BEFORE /:id
router.get('/:id',                    getPaymentOrder);
```

### 2.6 Test the BCRD endpoint locally

```bash
# Start backend dev server
pnpm dev

# In another terminal — test with curl:
curl -s "http://localhost:3000/api/payment-orders/bcrd-rate?currency=USD" | jq .
```

Expected success response:
```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "compra": 59.80,
    "venta": 60.50,
    "date": "2026-06-10",
    "fallback": false,
    "source": "bcrd"
  }
}
```

Expected fallback response (if BCRD API unreachable):
```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "compra": null,
    "venta": null,
    "date": null,
    "fallback": true,
    "source": "bcrd"
  }
}
```

- [ ] Create `apps/backend/src/modules/payment-orders/bcrd-rate.ts` with content above
- [ ] Update `PaymentInfoInput` interface in service
- [ ] Update `markAsPaid` — store `paymentMethod`, `exchangeRate`, `exchangeRateValidatedBy`, `exchangeRateValidatedAt`
- [ ] Update `buildExpenseData` call — propagate `paymentMethod`
- [ ] Update `INCLUDE` constant — add `exchangeRateValidator`
- [ ] Add `getBcrdRateHandler` to controller
- [ ] Import and register `/bcrd-rate` route in router (before `/:id`)
- [ ] Test endpoint responds correctly

### 2.7 Commit

```bash
git add apps/backend/src/modules/payment-orders/
git commit -m "feat(payment-orders): BCRD proxy endpoint + paymentMethod/exchangeRate fields in markAsPaid"
```

---

## Task 3 — Frontend: Types + API client

### 3.1 Update `PaymentOrder` interface in `apps/frontend/src/types/index.ts`

Locate the `PaymentOrder` interface (line 179). Add new fields after `paymentReference`:

```typescript
export interface PaymentOrder {
  id:            string;
  number:        number;
  orderType:     'SERVICIO' | 'PAYROLL' | 'MATERIALS';
  payingCompany: string;
  supplierId:    string;
  supplier:      Supplier;
  projectId:     string;
  project:       { id: string; code: string; name: string };
  amount:        number;
  currency:      string;
  concept:       string;
  status:        'PENDING' | 'PAID' | 'VOIDED';
  generatedText: string | null;
  notes?:        string | null;
  paidAt?:                   string | null;
  paidBy?:                   { id: string; name: string } | null;
  paymentBank?:              string | null;
  paymentReference?:         string | null;
  // Completeness fields (2026-06-10)
  paymentMethod?:            'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER' | null;
  exchangeRate?:             number | null;
  exchangeRateValidatedBy?:  string | null;
  exchangeRateValidatedAt?:  string | null;
  exchangeRateValidator?:    { id: string; name: string } | null;
  payrollId?:         string | null;
  payroll?:      { id: string; number: number; type: string; totalAmount: number; periodStart: string; periodEnd: string; status: string } | null;
  expenseId?:    string | null;
  expense?:      { id: string; amount: number; expenseDate: string; description: string; status: string } | null;
  createdBy:     { id: string; name: string };
  createdAt:     string;
  updatedAt:     string;
}
```

### 3.2 Add `BcrdRateResult` type

In `apps/frontend/src/types/index.ts`, add near the end:

```typescript
export interface BcrdRateResult {
  currency: string;
  compra:   number | null;
  venta:    number | null;
  date:     string | null;
  fallback: boolean;
  source:   string;
}
```

### 3.3 Add `getBcrdRate` to the API client

Find where `paymentOrdersApi` is defined (likely in `apps/frontend/src/api/index.ts` or a dedicated file). Add:

```typescript
getBcrdRate: (currency = 'USD') =>
  api.get<{ success: boolean; data: BcrdRateResult }>('/payment-orders/bcrd-rate', {
    params: { currency },
  }),
```

To find the exact file and location:
```bash
grep -r "markAsPaid\|paymentOrdersApi" apps/frontend/src/api/ --include="*.ts" -l
```

Typical pattern in this codebase — add alongside other `paymentOrdersApi` methods:
```typescript
export const paymentOrdersApi = {
  list:             (params?: any)  => api.get('/payment-orders', { params }),
  get:              (id: string)    => api.get(`/payment-orders/${id}`),
  create:           (data: unknown) => api.post('/payment-orders', data),
  update:           (id: string, data: unknown) => api.put(`/payment-orders/${id}`, data),
  markAsPaid:       (id: string, fiscalVoucher?: any, paymentInfo?: any) =>
                      api.post(`/payment-orders/${id}/pay`, { fiscalVoucher, paymentInfo }),
  // ... existing methods ...
  getBcrdRate:      (currency = 'USD') =>
                      api.get<{ success: boolean; data: BcrdRateResult }>('/payment-orders/bcrd-rate', { params: { currency } }),
};
```

- [ ] Add 4 new fields to `PaymentOrder` interface in `types/index.ts`
- [ ] Add `BcrdRateResult` interface to `types/index.ts`
- [ ] Locate API client file and add `getBcrdRate` method to `paymentOrdersApi`

### 3.4 Commit

```bash
git add apps/frontend/src/types/index.ts apps/frontend/src/api/
git commit -m "feat(frontend): extend PaymentOrder type + add getBcrdRate API client"
```

---

## Task 4 — Frontend: Pay modal UI update

This is the largest change. The pay modal in `PaymentOrdersPage.tsx` needs:
1. Payment method selector (required for all currencies)
2. BCRD fetch button (shown when currency is USD or EUR)
3. Editable exchange rate field with compra/venta reference display
4. Confirmation checkbox (required when foreign currency is used)

### 4.1 Add new state to `PaymentOrdersPage`

Find the `payInfoForm` state declaration (line ~136):
```typescript
const [payInfoForm, setPayInfoForm] = useState({ paymentBank: '', paymentReference: '', exchangeRate: '' });
```

Replace with:
```typescript
const [payInfoForm, setPayInfoForm] = useState({
  paymentBank:       '',
  paymentReference:  '',
  paymentMethod:     'TRANSFER' as 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER',
  exchangeRate:      '',
  rateConfirmed:     false,   // the accountability checkbox
});
const [bcrdRate,     setBcrdRate]     = useState<import('../../types').BcrdRateResult | null>(null);
const [bcrdLoading,  setBcrdLoading]  = useState(false);
const [bcrdError,    setBcrdError]    = useState('');
```

### 4.2 Update `openPayModal` helper

The existing `openPayModal` (line ~143) resets `payInfoForm`. Update to include new fields:

```typescript
const openPayModal = (o: PaymentOrder) => {
  setOcrPayError('');
  setOcrPayLoading(false);
  setPayingOrder(o);
  setFiscalForm({ hasFiscal: false, ncf: '', supplierRnc: o.supplier?.rnc ?? '', supplierName: o.supplier?.name ?? '', itbisAmount: '' });
  setPayInfoForm({ paymentBank: '', paymentReference: '', paymentMethod: 'TRANSFER', exchangeRate: '', rateConfirmed: false });
  setBcrdRate(null);
  setBcrdError('');
  setFiscalErr('');
  setPayModal(true);
};
```

### 4.3 Add BCRD fetch handler

Add inside the component, near the other handlers:

```typescript
const handleFetchBcrdRate = async () => {
  if (!payingOrder) return;
  // Determine currency ISO code from order currency symbol
  const currencyMap: Record<string, string> = { 'US$': 'USD', '€': 'EUR', 'USD': 'USD', 'EUR': 'EUR' };
  const iso = currencyMap[payingOrder.currency] ?? 'USD';

  setBcrdLoading(true);
  setBcrdError('');
  try {
    const res  = await paymentOrdersApi.getBcrdRate(iso);
    const data = res.data.data;
    setBcrdRate(data);
    if (data.venta != null) {
      // Pre-fill with venta (selling) rate — what the company pays to buy foreign currency
      setPayInfoForm((f) => ({ ...f, exchangeRate: String(data.venta), rateConfirmed: false }));
    } else if (data.fallback) {
      setBcrdError('El BCRD no respondió. Ingresa la tasa manualmente.');
    }
  } catch {
    setBcrdError('No se pudo obtener la tasa del BCRD. Ingresa manualmente.');
  } finally {
    setBcrdLoading(false);
  }
};
```

### 4.4 Update `markPaidMut` mutation type

The existing mutation (line ~271):
```typescript
const markPaidMut = useMutation({
  mutationFn: ({ id, fiscalVoucher, paymentInfo }: {
    id: string;
    fiscalVoucher?: { ncf: string; supplierRnc: string; supplierName: string; itbisAmount?: number } | null;
    paymentInfo?:   { paymentBank?: string; paymentReference?: string } | null;
  }) => paymentOrdersApi.markAsPaid(id, fiscalVoucher, paymentInfo),
```

Update `paymentInfo` type:
```typescript
paymentInfo?: {
  paymentBank?:           string;
  paymentReference?:      string;
  paymentMethod?:         string;
  exchangeRate?:          number | null;
  exchangeRateValidated?: boolean;
} | null;
```

### 4.5 Update pay modal submission handler

Find the handleConfirmPayment / pay confirmation logic (search for `markPaidMut.mutate`). Update to include new fields:

```typescript
const handleConfirmPayment = () => {
  // Validate fiscal form if has fiscal
  if (fiscalForm.hasFiscal) {
    if (!validateNCF(fiscalForm.ncf)) return setFiscalErr('NCF inválido (11 o 13 caracteres)');
    if (!fiscalForm.supplierRnc.trim()) return setFiscalErr('RNC del suplidor es requerido');
    if (!fiscalForm.supplierName.trim()) return setFiscalErr('Nombre del suplidor es requerido');
  }

  // Validate exchange rate confirmation when foreign currency
  const isForeign = payingOrder?.currency !== 'RD$';
  if (isForeign && payInfoForm.exchangeRate && !payInfoForm.rateConfirmed) {
    setFiscalErr('Debes confirmar la tasa de cambio antes de continuar.');
    return;
  }

  markPaidMut.mutate({
    id: payingOrder!.id,
    fiscalVoucher: fiscalForm.hasFiscal
      ? {
          ncf:          fiscalForm.ncf,
          supplierRnc:  fiscalForm.supplierRnc,
          supplierName: fiscalForm.supplierName,
          itbisAmount:  fiscalForm.itbisAmount ? Number(fiscalForm.itbisAmount) : undefined,
        }
      : null,
    paymentInfo: {
      paymentBank:          payInfoForm.paymentBank   || undefined,
      paymentReference:     payInfoForm.paymentReference || undefined,
      paymentMethod:        payInfoForm.paymentMethod,
      exchangeRate:         payInfoForm.exchangeRate ? Number(payInfoForm.exchangeRate) : null,
      exchangeRateValidated: payInfoForm.rateConfirmed,
    },
  });
};
```

### 4.6 Pay modal JSX — add new fields

Find the pay modal JSX (search for `{payModal && (`). Inside the modal form, after the existing `TransferPaymentForm` or payment fields section, add:

```tsx
{/* Payment method selector — always shown */}
<div className="space-y-1.5">
  <label className="block text-sm font-medium text-gray-700">
    Método de pago <span className="text-red-500">*</span>
  </label>
  <select
    value={payInfoForm.paymentMethod}
    onChange={(e) => setPayInfoForm((f) => ({
      ...f,
      paymentMethod: e.target.value as typeof f.paymentMethod,
      rateConfirmed: false,
    }))}
    className="input-field"
  >
    <option value="TRANSFER">Transferencia bancaria</option>
    <option value="CASH">Efectivo</option>
    <option value="CARD">Tarjeta</option>
    <option value="CHECK">Cheque</option>
    <option value="OTHER">Otro</option>
  </select>
</div>

{/* Exchange rate section — only when foreign currency */}
{payingOrder?.currency !== 'RD$' && (
  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold text-blue-800">
        Tasa de cambio ({payingOrder?.currency} → RD$)
      </h4>
      <button
        type="button"
        onClick={handleFetchBcrdRate}
        disabled={bcrdLoading}
        className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      >
        {bcrdLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        Obtener tasa BCRD
      </button>
    </div>

    {/* BCRD reference rates */}
    {bcrdRate && !bcrdRate.fallback && (
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
          <p className="text-gray-500 font-medium">Compra (BCRD)</p>
          <p className="text-blue-800 font-bold text-base">
            {bcrdRate.compra != null ? `RD$ ${bcrdRate.compra.toFixed(2)}` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
          <p className="text-gray-500 font-medium">Venta (BCRD)</p>
          <p className="text-blue-800 font-bold text-base">
            {bcrdRate.venta != null ? `RD$ ${bcrdRate.venta.toFixed(2)}` : '—'}
          </p>
        </div>
        {bcrdRate.date && (
          <p className="col-span-2 text-gray-400 text-xs">
            Tasa oficial al {bcrdRate.date}
          </p>
        )}
      </div>
    )}

    {bcrdError && (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        {bcrdError}
      </p>
    )}

    {/* Editable rate field */}
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Tasa utilizada (1 {payingOrder?.currency === 'US$' ? 'USD' : payingOrder?.currency} = X RD$)
      </label>
      <input
        type="number"
        value={payInfoForm.exchangeRate}
        onChange={(e) => setPayInfoForm((f) => ({ ...f, exchangeRate: e.target.value, rateConfirmed: false }))}
        placeholder="ej: 60.50"
        min="0"
        step="0.01"
        className="input-field"
      />
      {payInfoForm.exchangeRate && Number(payInfoForm.exchangeRate) > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Equivalente: RD$ {(Number(payingOrder?.amount ?? 0) * Number(payInfoForm.exchangeRate))
            .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
    </div>

    {/* Accountability checkbox */}
    {payInfoForm.exchangeRate && Number(payInfoForm.exchangeRate) > 0 && (
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={payInfoForm.rateConfirmed}
          onChange={(e) => setPayInfoForm((f) => ({ ...f, rateConfirmed: e.target.checked }))}
          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-xs text-blue-900 leading-relaxed">
          Confirmo que la tasa de{' '}
          <strong>RD$ {Number(payInfoForm.exchangeRate).toFixed(2)}</strong> por{' '}
          <strong>{payingOrder?.currency === 'US$' ? 'USD' : payingOrder?.currency}</strong>{' '}
          es correcta a la fecha de{' '}
          <strong>{new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
        </span>
      </label>
    )}
  </div>
)}
```

Also add the `RefreshCw` import from lucide-react at the top of the file alongside existing imports:
```typescript
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  Pencil, ClipboardCopy, X,
  BadgeCheck, Clock, Wallet, Link, Unlink, ShoppingCart,
  MessageCircle, Sparkles, Camera, RefreshCw,   // ← add RefreshCw
} from 'lucide-react';
```

### 4.7 Show exchange rate in payment detail view

In the order detail panel (where `paidAt`, `paymentBank`, `paymentReference` are displayed), add:

```tsx
{/* Show payment method if present */}
{(viewingOrder as any)?.paymentMethod && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">Método de pago</span>
    <span className="font-medium">
      {{
        TRANSFER: 'Transferencia', CASH: 'Efectivo', CARD: 'Tarjeta',
        CHECK: 'Cheque', OTHER: 'Otro',
      }[(viewingOrder as any).paymentMethod] ?? (viewingOrder as any).paymentMethod}
    </span>
  </div>
)}
{/* Show exchange rate snapshot if present */}
{(viewingOrder as any)?.exchangeRate && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">Tasa de cambio</span>
    <span className="font-medium">RD$ {Number((viewingOrder as any).exchangeRate).toFixed(4)}</span>
  </div>
)}
{/* Show who validated the rate */}
{(viewingOrder as any)?.exchangeRateValidator && (
  <div className="flex justify-between text-sm">
    <span className="text-gray-500">Tasa confirmada por</span>
    <span className="font-medium text-green-700">
      {(viewingOrder as any).exchangeRateValidator.name}
      {(viewingOrder as any).exchangeRateValidatedAt && (
        <> · {fmtDate((viewingOrder as any).exchangeRateValidatedAt)}</>
      )}
    </span>
  </div>
)}
```

### 4.8 Disable pay confirm button when rate not confirmed

Find the pay modal's submit button. Add a `disabled` condition:

```tsx
<button
  onClick={handleConfirmPayment}
  disabled={
    markPaidMut.isPending ||
    (payingOrder?.currency !== 'RD$' && !!payInfoForm.exchangeRate && !payInfoForm.rateConfirmed)
  }
  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {markPaidMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar pago'}
</button>
```

- [ ] Add `bcrdRate`, `bcrdLoading`, `bcrdError` state
- [ ] Update `payInfoForm` state shape — add `paymentMethod`, `rateConfirmed`
- [ ] Update `openPayModal` to reset new fields
- [ ] Add `handleFetchBcrdRate` function
- [ ] Update `markPaidMut` type to include new paymentInfo fields
- [ ] Update `handleConfirmPayment` (or equivalent submit handler) — validate rateConfirmed
- [ ] Add `RefreshCw` to lucide-react imports
- [ ] Add payment method selector in pay modal JSX
- [ ] Add exchange rate section with BCRD fetch button in pay modal JSX
- [ ] Add accountability checkbox in pay modal JSX
- [ ] Disable submit button when rate not confirmed
- [ ] Add exchange rate snapshot + validator display in order detail view

### 4.9 Commit

```bash
git add apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
git commit -m "feat(frontend): pay modal — payment method selector, BCRD rate fetch, exchange rate confirmation checkbox"
```

---

## Final verification checklist

- [ ] `pnpm build:backend` — TypeScript compiles with no errors
- [ ] `pnpm build:frontend` — Vite builds with no errors
- [ ] `docker build -f Dockerfile.backend .` — Docker build succeeds (per CLAUDE.md rule #1)
- [ ] `pnpm db:generate` — Prisma client regenerated successfully after schema change
- [ ] Manual QA — create PENDING order with `US$` currency, open pay modal:
  - [ ] Payment method dropdown appears and defaults to "Transferencia"
  - [ ] "Obtener tasa BCRD" button appears
  - [ ] Clicking button fetches rate and pre-fills the exchange rate field
  - [ ] Editing exchange rate clears the checkbox
  - [ ] Checkbox text shows correct rate, currency, and today's date
  - [ ] Submit button is disabled until checkbox is checked
  - [ ] On successful payment, order detail shows paymentMethod, exchangeRate, and validator name
- [ ] Manual QA — create and pay order with `RD$` currency:
  - [ ] Exchange rate section does NOT appear
  - [ ] Payment proceeds normally with only paymentMethod stored
- [ ] Check Prisma DB — `exchangeRateValidatedBy` is populated only when foreign currency + confirmed

---

## Notes on BCRD API

The BCRD (Banco Central de la República Dominicana) statistics portal is at `https://estadisticas.bcrd.gov.do`. The exact REST API surface may differ from what is documented publicly. The `bcrd-rate.ts` fetcher is designed to:

1. Try the most likely REST endpoint pattern
2. Parse several possible response shapes
3. Return `fallback: true` gracefully on any error (timeout, 4xx, 5xx, malformed JSON)

If the BCRD endpoint returns data in a different structure, update only `fetchSeries()` in `bcrd-rate.ts` — the rest of the system is decoupled. A future improvement could add a cached/scheduled background refresh (e.g., once per day via a cron) to avoid blocking the modal on BCRD latency.

If the BCRD API proves consistently unavailable, consider using the Banco Popular or BHD exchange rate APIs, or a fallback to `api.exchangerate-api.com` with `DOP` as base.
