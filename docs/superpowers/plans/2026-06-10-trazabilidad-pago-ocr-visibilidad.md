# Trazabilidad de Pago + OCR en Orden de Pago + Visibilidad NCF/Banco — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando una orden de pago se marca como pagada, los datos bancarios (banco + referencia) y fiscales (NCF completo) son visibles en los listados de gastos, el usuario puede escanear la factura con OCR para auto-rellenar el comprobante fiscal en ese mismo modal, y no necesita re-introducir ningún dato al revisar el gasto.

**Architecture:** Tres capas independientes: (1) backend incluye la relación `paymentOrder` al retornar gastos — sin migración, el vínculo ya existe en el schema; (2) frontend añade un botón "📷 Escanear" en `PaymentOrdersPage` que reutiliza `ocrApi.analyze()` y rellena `FiscalVoucherForm`; (3) frontend muestra NCF completo + banco/referencia en las filas de gasto en `ExpensesPage` y `ProjectDetailPage`.

**Tech Stack:** Node.js + Prisma (backend), React 18 + TanStack Query + TailwindCSS (frontend). Sin nuevas dependencias, sin migraciones de BD.

---

## Mapa de Archivos

### Modificar
- `apps/backend/src/modules/expenses/expenses.service.ts` — añadir `paymentOrder` al `EXPENSE_INCLUDE`
- `apps/frontend/src/types/index.ts` — añadir `paymentOrder?` a interfaz `Expense`
- `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` — añadir OCR en modal de pago
- `apps/frontend/src/pages/expenses/ExpensesPage.tsx` — mostrar NCF + banco/referencia en fila
- `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` — mostrar NCF + banco/referencia en fila

### No tocar
- `apps/backend/prisma/schema.prisma` — sin migración necesaria
- `apps/frontend/src/components/shared/FiscalVoucherForm.tsx` — ya funciona correctamente
- `apps/frontend/src/api/index.ts` — `ocrApi.analyze()` ya existe

---

## Task 1: Backend — exponer `paymentOrder` en el include de gastos

**Problema:** `EXPENSE_INCLUDE` en `expenses.service.ts` no incluye la relación `paymentOrder`, así que el banco emisor y la referencia nunca llegan al frontend aunque están guardados en `PaymentOrder.paymentBank` / `PaymentOrder.paymentReference`.

**Files:**
- Modify: `apps/backend/src/modules/expenses/expenses.service.ts` (línea ~12, `EXPENSE_INCLUDE`)

- [ ] **Leer el archivo para encontrar EXPENSE_INCLUDE**

```bash
grep -n "EXPENSE_INCLUDE\|fiscalVoucher\|attachments" \
  /home/user/servingmi-appCG/apps/backend/src/modules/expenses/expenses.service.ts | head -20
```

Esperado: ver la constante alrededor de la línea 12. Actualmente tiene `fiscalVoucher: true` como última entrada.

- [ ] **Añadir `paymentOrder` al include**

En `apps/backend/src/modules/expenses/expenses.service.ts`, ampliar `EXPENSE_INCLUDE`:

```typescript
const EXPENSE_INCLUDE = {
  project:      { select: { id: true, code: true, name: true } },
  category:     { select: { id: true, name: true, icon: true } },
  registeredBy: { select: { id: true, name: true } },
  companyCard:  { select: { id: true, holderName: true, lastFour: true, cardType: true, bank: true } },
  approvedBy:   { select: { id: true, name: true } },
  rejectedBy:   { select: { id: true, name: true } },
  fiscalVoucher: true,
  attachments:  { select: { id: true, fileName: true, mimeType: true, isPrimary: true, createdAt: true } },
  paymentOrder: { select: { id: true, paymentBank: true, paymentReference: true, paidAt: true } },
} as const;
```

- [ ] **Verificar que el backend compila**

```bash
cd /home/user/servingmi-appCG && pnpm build:backend 2>&1 | tail -5
```

Esperado: build exitoso, sin errores TypeScript.

- [ ] **Commit**

```bash
git add apps/backend/src/modules/expenses/expenses.service.ts
git commit -m "feat: incluir paymentOrder en EXPENSE_INCLUDE para exponer banco/referencia"
```

---

## Task 2: Frontend — tipo `Expense` incluye `paymentOrder`

**Problema:** El frontend tiene `interface Expense` en `types/index.ts` sin el campo `paymentOrder`. Aunque el API ya lo devuelve (tras Task 1), TypeScript lo desconoce.

**Files:**
- Modify: `apps/frontend/src/types/index.ts` (interfaz `Expense`, ~línea 56)

- [ ] **Leer la interfaz actual**

```bash
sed -n '56,82p' /home/user/servingmi-appCG/apps/frontend/src/types/index.ts
```

Esperado: ver `interface Expense { id, expenseDate, amount, ... fiscalVoucher?: FiscalVoucher; ... }`.

- [ ] **Añadir campo `paymentOrder` a la interfaz**

En `apps/frontend/src/types/index.ts`, añadir justo después de `fiscalVoucher?`:

```typescript
export interface Expense {
  id: string;
  expenseDate: string;
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER';
  hasFiscalDoc: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'VOIDED' | 'REJECTED';
  notes?: string;
  project: { id: string; code: string; name: string };
  projectId: string;
  category: { id: number; name: string; icon?: string };
  registeredBy: { id: string; name: string };
  companyCardId?: number;
  companyCard?: { id: number; holderName: string; lastFour: string; cardType: string; bank: string } | null;
  fiscalVoucher?: FiscalVoucher;
  paymentOrder?: { id: string; paymentBank: string | null; paymentReference: string | null; paidAt: string | null } | null;
  attachments: Attachment[];
  createdAt: string;
  voidedAt?: string;
  voidReason?: string;
  rejectionReason?: string | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt?: string | null;
  rejectedBy?: { id: string; name: string } | null;
  rejectedAt?: string | null;
}
```

- [ ] **Verificar compilación frontend**

```bash
cd /home/user/servingmi-appCG/apps/frontend && pnpm tsc --noEmit 2>&1 | grep -v TS5101
```

Esperado: 0 errores.

- [ ] **Commit**

```bash
git add apps/frontend/src/types/index.ts
git commit -m "feat: añadir paymentOrder a interfaz Expense en tipos frontend"
```

---

## Task 3: Frontend — mostrar NCF + banco/referencia en `ExpensesPage`

**Problema:** La fila de cada gasto muestra solo "· NCF" (badge), sin el número completo ni los datos bancarios.

**Files:**
- Modify: `apps/frontend/src/pages/expenses/ExpensesPage.tsx` (~línea 295-305)

- [ ] **Leer el bloque de fila actual**

```bash
sed -n '290,315p' /home/user/servingmi-appCG/apps/frontend/src/pages/expenses/ExpensesPage.tsx
```

Esperado: ver `<Link key={e.id} to={...}>` con `e.hasFiscalDoc && <span>· NCF</span>`.

- [ ] **Ampliar la segunda línea de texto de cada fila**

Reemplazar el bloque `<p className="text-xs text-gray-400 mt-0.5">` que contiene el badge NCF con:

```tsx
<p className="text-xs text-gray-400 mt-0.5">
  {selectedProjectId === 'all' && <span className="font-medium text-gray-500">{e.project.code} · </span>}
  {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
  {e.hasFiscalDoc && e.fiscalVoucher && (
    <span className="ml-1 text-blue-600 font-mono">· {e.fiscalVoucher.ncf}</span>
  )}
  {e.hasFiscalDoc && !e.fiscalVoucher && (
    <span className="ml-1 text-blue-500">· NCF</span>
  )}
  {e.paymentOrder?.paymentBank && (
    <span className="ml-1 text-gray-500">· {e.paymentOrder.paymentBank}</span>
  )}
  {e.paymentOrder?.paymentReference && (
    <span className="ml-1 font-mono text-gray-400">#{e.paymentOrder.paymentReference}</span>
  )}
</p>
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend && pnpm tsc --noEmit 2>&1 | grep -v TS5101
```

- [ ] **Commit**

```bash
git add apps/frontend/src/pages/expenses/ExpensesPage.tsx
git commit -m "feat: mostrar NCF completo y banco/referencia en fila de gasto"
```

---

## Task 4: Frontend — mostrar NCF + banco/referencia en `ProjectDetailPage`

**Problema:** Misma situación que `ExpensesPage` pero en el panel de gastos del detalle de proyecto.

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` (~línea 383-391)

- [ ] **Leer el bloque de fila actual**

```bash
sed -n '380,400p' /home/user/servingmi-appCG/apps/frontend/src/pages/projects/ProjectDetailPage.tsx
```

Esperado: ver `e.hasFiscalDoc && <span className="text-blue-500 ml-1">· NCF</span>`.

- [ ] **Ampliar la segunda línea de texto de cada fila**

Reemplazar el `<p className="text-xs text-gray-400">` que contiene el badge NCF con:

```tsx
<p className="text-xs text-gray-400">
  {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
  {e.hasFiscalDoc && e.fiscalVoucher && (
    <span className="text-blue-600 font-mono ml-1">· {e.fiscalVoucher.ncf}</span>
  )}
  {e.hasFiscalDoc && !e.fiscalVoucher && (
    <span className="text-blue-500 ml-1">· NCF</span>
  )}
  {e.paymentOrder?.paymentBank && (
    <span className="ml-1 text-gray-500">· {e.paymentOrder.paymentBank}</span>
  )}
  {e.paymentOrder?.paymentReference && (
    <span className="ml-1 font-mono text-gray-400">#{e.paymentOrder.paymentReference}</span>
  )}
</p>
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend && pnpm tsc --noEmit 2>&1 | grep -v TS5101
```

- [ ] **Commit**

```bash
git add apps/frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat: mostrar NCF completo y banco/referencia en gastos del proyecto"
```

---

## Task 5: Frontend — OCR en modal "Confirmar pago" de `PaymentOrdersPage`

**Problema:** Cuando el usuario activa "Tiene comprobante fiscal (NCF)" en el modal de pago, tiene que teclear el NCF manualmente. Queremos que pueda escanear la factura con la cámara/archivo y auto-rellenar `FiscalVoucherForm`.

**Contexto:**
- `ocrApi` está importado en `NewExpensePage.tsx` desde `'../../api'`
- `ocrApi.analyze(file: File)` retorna `Promise<{ data: { data: OcrResult } }>`
- `OcrResult` tiene: `ncf`, `supplierRnc`, `supplierName`, `itbisAmount`, `date`, `amount`, `confidence`, `warnings`
- `FiscalVoucherForm` tiene `value/onChange` — para rellenarlo: `setFiscalForm({ hasFiscal: true, ncf, supplierRnc, supplierName, itbisAmount })`
- El modal de pago ya tiene: `fiscalForm`, `setFiscalForm`, `FiscalVoucherForm` montado
- Los estados del modal de pago son: `payModal`, `payingOrder`, `fiscalForm`, `payInfoForm`, `fiscalErr`

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

- [ ] **Añadir import de `ocrApi`**

En `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`, encontrar la línea de imports de la API:

```typescript
// ANTES (aproximado):
import { paymentOrdersApi, projectsApi, payrollApi, suppliersApi } from '../../api';

// DESPUÉS:
import { paymentOrdersApi, projectsApi, payrollApi, suppliersApi, ocrApi } from '../../api';
```

- [ ] **Añadir estado `ocrPayLoading` y ref `ocrPayInputRef`**

Justo después de la línea donde se define `conceptLoading` (~línea 141), añadir:

```typescript
const [ocrPayLoading, setOcrPayLoading] = useState(false);
const [ocrPayError,   setOcrPayError]   = useState('');
const ocrPayInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Añadir función `handleOcrPayScan`**

Justo después de `openPayModal` (~línea 150), añadir:

```typescript
const handleOcrPayScan = async (file: File) => {
  setOcrPayLoading(true);
  setOcrPayError('');
  try {
    const res  = await ocrApi.analyze(file);
    const data = res.data.data;
    if (data.ncf || data.supplierName || data.supplierRnc || data.itbisAmount !== null) {
      setFiscalForm((v) => ({
        hasFiscal:    true,
        ncf:          data.ncf          ?? v.ncf,
        supplierRnc:  data.supplierRnc  ?? v.supplierRnc,
        supplierName: data.supplierName ?? v.supplierName,
        itbisAmount:  data.itbisAmount != null ? String(data.itbisAmount) : v.itbisAmount,
      }));
    } else {
      setOcrPayError('No se detectaron datos fiscales en la imagen.');
    }
  } catch {
    setOcrPayError('Error al procesar la imagen. Intente de nuevo.');
  } finally {
    setOcrPayLoading(false);
  }
};
```

- [ ] **Añadir botón OCR y input oculto en el modal de pago**

En el JSX del modal de pago, encontrar el lugar donde se renderiza `<FiscalVoucherForm ... />`.
Justo ANTES del `<FiscalVoucherForm>`, añadir:

```tsx
{/* Input oculto para OCR */}
<input
  ref={ocrPayInputRef}
  type="file"
  accept="image/*,application/pdf"
  className="hidden"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) handleOcrPayScan(file);
    e.target.value = '';
  }}
/>
```

En la etiqueta de la sección de comprobante fiscal (el texto "Comprobante fiscal (opcional)" o similar), añadir el botón OCR a su derecha:

```tsx
<div className="flex items-center justify-between mb-2">
  <p className="text-sm font-semibold text-gray-700">Comprobante fiscal (opcional)</p>
  <button
    type="button"
    onClick={() => ocrPayInputRef.current?.click()}
    disabled={ocrPayLoading}
    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-300 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50">
    {ocrPayLoading
      ? <><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</>
      : <><Camera className="w-3 h-3" /> Escanear factura</>
    }
  </button>
</div>
```

- [ ] **Añadir `Camera` a los imports de lucide-react**

En la línea de imports de lucide-react, añadir `Camera`:

```typescript
import {
  FileText, Plus, CheckCircle, AlertCircle, Loader2,
  Pencil, ClipboardCopy, X,
  BadgeCheck, Clock, Wallet, Link, Unlink, ShoppingCart,
  MessageCircle, Sparkles, Camera,
} from 'lucide-react';
```

- [ ] **Mostrar error OCR si existe**

Justo después de `<FiscalVoucherForm ... />`, añadir:

```tsx
{ocrPayError && (
  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-1">{ocrPayError}</p>
)}
```

- [ ] **Limpiar `ocrPayError` y `ocrPayLoading` al cerrar el modal**

En la función `openPayModal`, añadir al inicio:

```typescript
setOcrPayError('');
setOcrPayLoading(false);
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend && pnpm tsc --noEmit 2>&1 | grep -v TS5101
```

Esperado: 0 errores.

- [ ] **Commit**

```bash
git add apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
git commit -m "feat: OCR de factura en modal 'Confirmar pago' de orden de pago"
```

---

## Task 6: Merge a main y push

**Files:** Solo git.

- [ ] **Merge feature branch a main**

```bash
cd /home/user/servingmi-appCG
git push origin claude/happy-feynman-stMWv
git checkout main
git merge claude/happy-feynman-stMWv --no-ff -m "feat: trazabilidad banco/NCF en gastos + OCR en confirmar pago"
git push origin main
```

Esperado: push exitoso, auto-deploy en Render.
