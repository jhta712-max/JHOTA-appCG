# Consolidar Sub-flujos Duplicados — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las 5 duplicaciones críticas de código de UI y lógica de negocio identificadas en el audit, creando componentes y utilidades compartidas que sean la única fuente de verdad para comprobantes fiscales, datos de transferencia, conversión de divisas, etiquetas de estado, y generación automática de gastos.

**Architecture:** Tres capas de cambios independientes — (1) utilidades frontend compartidas, (2) componentes React reutilizables en `components/shared/`, (3) función helper en backend que reemplaza 3 rutas duplicadas de creación de gastos. Cada tarea produce código funcional y verificable por sí sola. Las tareas 1-7 son frontend puro; la tarea 8 es backend puro.

**Tech Stack:** React 18 + TypeScript + TailwindCSS (frontend), Node.js + TypeScript + Prisma (backend). Sin nuevas dependencias.

---

## Mapa de Archivos

### Crear
- `apps/frontend/src/utils/fiscal.ts` — regex NCF/RNC y funciones de validación (SSOT frontend)
- `apps/frontend/src/utils/statusLabels.ts` — mapas de etiquetas de estado (SSOT frontend)
- `apps/frontend/src/components/shared/FiscalVoucherForm.tsx` — sub-formulario NCF reutilizable
- `apps/frontend/src/components/shared/TransferPaymentForm.tsx` — banco + No. transacción reutilizable
- `apps/frontend/src/components/shared/ForeignCurrencyInput.tsx` — input conversión divisas reutilizable

### Modificar
- `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` — usar los 3 nuevos componentes
- `apps/frontend/src/pages/expenses/NewExpensePage.tsx` — usar FiscalVoucherForm + ForeignCurrencyInput
- `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx` — usar TransferPaymentForm (×2)
- `apps/backend/src/modules/payment-orders/payment-orders.service.ts` — extraer helper de gasto
- `apps/backend/src/modules/payroll/payroll.service.ts` — usar el helper compartido

---

## Task 1: Utilidades fiscales en frontend (SSOT)

**Problema:** `NCF_REGEX`, `E_NCF_REGEX`, `RNC_REGEX` están definidas en `PaymentOrdersPage.tsx` (líneas 32-34) Y en `NewExpensePage.tsx` (líneas 25-27). `fiscal.utils.ts` ya existe en backend — el frontend necesita su propia versión.

**Files:**
- Create: `apps/frontend/src/utils/fiscal.ts`
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` (lines 32-34)
- Modify: `apps/frontend/src/pages/expenses/NewExpensePage.tsx` (lines 25-27)

- [ ] **Crear el archivo de utilidades**

```typescript
// apps/frontend/src/utils/fiscal.ts
export const NCF_REGEX   = /^[A-Z]\d{10}$/;
export const E_NCF_REGEX = /^E\d{12}$/;
export const RNC_REGEX   = /^\d{9}(\d{2})?$/;

export function validateNCF(v: string): boolean {
  return NCF_REGEX.test(v) || E_NCF_REGEX.test(v);
}
export function validateRNC(v: string): boolean {
  return RNC_REGEX.test(v);
}
```

- [ ] **Eliminar definiciones locales en PaymentOrdersPage.tsx**

Reemplazar líneas 32-34:
```typescript
// ANTES:
const NCF_REGEX    = /^[A-Z]\d{10}$/;
const E_NCF_REGEX  = /^E\d{12}$/;
const validateNcf  = (v: string) => NCF_REGEX.test(v) || E_NCF_REGEX.test(v);

// DESPUÉS — añadir al bloque de imports:
import { validateNCF, validateRNC } from '../../utils/fiscal';
```

Y reemplazar el uso de `validateNcf` por `validateNCF` en la validación del modal (buscar `validateNcf(fiscalForm.ncf`).

- [ ] **Eliminar definiciones locales en NewExpensePage.tsx**

Reemplazar líneas 25-27:
```typescript
// ANTES:
const NCF_REGEX   = /^[A-Z]\d{10}$/;
const E_NCF_REGEX = /^E\d{12}$/;
const RNC_REGEX   = /^\d{9}(\d{2})?$/;

// DESPUÉS — añadir al bloque de imports:
import { NCF_REGEX, E_NCF_REGEX, RNC_REGEX, validateNCF } from '../../utils/fiscal';
```

- [ ] **Verificar que el frontend compila sin errores**

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm tsc --noEmit
```
Esperado: 0 errores relacionados con NCF_REGEX o RNC_REGEX.

- [ ] **Commit**

```bash
git add apps/frontend/src/utils/fiscal.ts \
        apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx \
        apps/frontend/src/pages/expenses/NewExpensePage.tsx
git commit -m "refactor: centralizar regex NCF/RNC en utils/fiscal.ts"
```

---

## Task 2: Etiquetas de estado unificadas (SSOT)

**Problema:** El mismo mapa de estados (`DRAFT/APPROVED/PAID/VOIDED`) está definido como `STATUS_LABEL` + `STATUS_COLOR` en `PayrollsPage.tsx` y en `PayrollDetailPage.tsx` (duplicado exacto). `PaymentOrdersPage` tiene su propio `STATUS_CFG`.

**Files:**
- Create: `apps/frontend/src/utils/statusLabels.ts`
- Modify: `apps/frontend/src/pages/payroll/PayrollsPage.tsx`
- Modify: `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx`

- [ ] **Crear el archivo de etiquetas**

```typescript
// apps/frontend/src/utils/statusLabels.ts

// ── Nóminas ───────────────────────────────────────────────────
export const PAYROLL_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
export const PAYROLL_STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
  PAID:     'bg-green-100 text-green-800 border-green-300',
  VOIDED:   'bg-red-100 text-red-800 border-red-300',
};

// ── Órdenes de pago ───────────────────────────────────────────
export const PAYMENT_ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagada', VOIDED: 'Anulada',
};
export const PAYMENT_ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID:    'bg-green-100 text-green-700',
  VOIDED:  'bg-gray-100 text-gray-500',
};
```

- [ ] **Actualizar PayrollDetailPage.tsx**

Eliminar las líneas 12-19:
```typescript
// ELIMINAR estas constantes locales:
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
const STATUS_COLOR: Record<string, string> = { ... };
```

Añadir al bloque de imports:
```typescript
import { PAYROLL_STATUS_LABEL as STATUS_LABEL, PAYROLL_STATUS_COLOR as STATUS_COLOR } from '../../utils/statusLabels';
```

- [ ] **Actualizar PayrollsPage.tsx** (mismo patrón — eliminar constantes locales, importar desde statusLabels.ts)

- [ ] **Verificar que el frontend compila**

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm tsc --noEmit
```

- [ ] **Commit**

```bash
git add apps/frontend/src/utils/statusLabels.ts \
        apps/frontend/src/pages/payroll/PayrollsPage.tsx \
        apps/frontend/src/pages/payroll/PayrollDetailPage.tsx
git commit -m "refactor: centralizar etiquetas de estado en utils/statusLabels.ts"
```

---

## Task 3: Componente `<FiscalVoucherForm>`

**Problema:** El sub-formulario de 4 campos (NCF, RNC, Nombre suplidor, ITBIS) está implementado dos veces:
- `PaymentOrdersPage.tsx` líneas ~1182-1233: usa estado local `fiscalForm` con `setFiscalForm`
- `NewExpensePage.tsx` líneas ~685-756: usa `react-hook-form` con `register('fiscalVoucher.*')`

El componente necesita soportar ambos patrones de control (controlled con state + RHF).

**Files:**
- Create: `apps/frontend/src/components/shared/FiscalVoucherForm.tsx`
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`
- Modify: `apps/frontend/src/pages/expenses/NewExpensePage.tsx`

- [ ] **Crear el directorio y el componente**

```bash
mkdir -p /home/user/servingmi-appCG/apps/frontend/src/components/shared
```

```typescript
// apps/frontend/src/components/shared/FiscalVoucherForm.tsx
import { Receipt } from 'lucide-react';
import { NCF_REGEX, E_NCF_REGEX, RNC_REGEX } from '../../utils/fiscal';

export interface FiscalVoucherValue {
  hasFiscal:    boolean;
  ncf:          string;
  supplierRnc:  string;
  supplierName: string;
  itbisAmount:  string;
}

interface Props {
  value:    FiscalVoucherValue;
  onChange: (next: FiscalVoucherValue) => void;
  /** Prefill RNC/name from supplier when opening */
  defaultRnc?:  string;
  defaultName?: string;
  /** Optional: mark specific fields as AI-filled (violet ring) */
  aiFields?: Set<string>;
  error?: string;
}

export function FiscalVoucherForm({ value, onChange, defaultRnc, defaultName, aiFields, error }: Props) {
  const set = (patch: Partial<FiscalVoucherValue>) => onChange({ ...value, ...patch });

  const ncfError = value.ncf
    ? (!NCF_REGEX.test(value.ncf.toUpperCase()) && !E_NCF_REGEX.test(value.ncf.toUpperCase())
        ? 'NCF inválido (B0100000001 o E310000000001)' : '')
    : '';
  const rncError = value.supplierRnc
    ? (!RNC_REGEX.test(value.supplierRnc) ? 'RNC inválido (9 u 11 dígitos)' : '')
    : '';

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.hasFiscal}
          onChange={(e) =>
            set({
              hasFiscal:    e.target.checked,
              ncf:          '',
              supplierRnc:  e.target.checked ? (defaultRnc  ?? value.supplierRnc)  : value.supplierRnc,
              supplierName: e.target.checked ? (defaultName ?? value.supplierName) : value.supplierName,
            })
          }
          className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
        />
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-gray-400" />
          Tiene comprobante fiscal (NCF / e-NCF)
        </span>
      </label>

      {/* Campos fiscales */}
      {value.hasFiscal && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          {/* NCF */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              NCF / e-NCF <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.ncf}
              onChange={(e) => set({ ncf: e.target.value.toUpperCase() })}
              placeholder="B0100000001 o E310000000001"
              maxLength={13}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 uppercase ${
                aiFields?.has('ncf') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-400 mt-1">NCF: 11 chars (B0100000001) · e-NCF: 13 chars (E310000000001)</p>
            {ncfError && <p className="text-xs text-red-600 mt-0.5">{ncfError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* RNC */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                RNC del suplidor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={value.supplierRnc}
                onChange={(e) => set({ supplierRnc: e.target.value })}
                placeholder="101000000"
                maxLength={11}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                  aiFields?.has('supplierRnc') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
                }`}
              />
              {rncError && <p className="text-xs text-red-600 mt-0.5">{rncError}</p>}
            </div>

            {/* ITBIS */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ITBIS (RD$)</label>
              <input
                type="number"
                value={value.itbisAmount}
                onChange={(e) => set({ itbisAmount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                  aiFields?.has('itbisAmount') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Nombre suplidor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Nombre del suplidor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={value.supplierName}
              onChange={(e) => set({ supplierName: e.target.value })}
              placeholder="Razón social"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 ${
                aiFields?.has('supplierName') ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Refactorizar PaymentOrdersPage.tsx — reemplazar bloque fiscal en modal de pago**

Añadir import:
```typescript
import { FiscalVoucherForm, type FiscalVoucherValue } from '../../components/shared/FiscalVoucherForm';
```

Cambiar tipo del estado fiscal:
```typescript
// ANTES:
const [fiscalForm, setFiscalForm] = useState({ hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '' });

// DESPUÉS (mismo tipo, mismo shape — compatible):
const [fiscalForm, setFiscalForm] = useState<FiscalVoucherValue>({
  hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '',
});
```

Reemplazar el bloque JSX del comprobante fiscal en el modal de pago (el checkbox + campos expandibles) con:
```tsx
<FiscalVoucherForm
  value={fiscalForm}
  onChange={setFiscalForm}
  defaultRnc={payingOrder?.supplier?.rnc ?? ''}
  defaultName={payingOrder?.supplier?.name ?? ''}
  error={fiscalErr}
/>
```

- [ ] **Refactorizar NewExpensePage.tsx — reemplazar sección 3 (comprobante fiscal)**

El formulario de gasto usa `react-hook-form`, pero el sub-flujo fiscal ya usa `useState(hasFiscal)` separado. Añadir estado local compatible:

```typescript
// Añadir junto a hasFiscal:
const [fiscalValues, setFiscalValues] = useState<FiscalVoucherValue>({
  hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '',
});
```

Sincronizar `hasFiscal` con `fiscalValues.hasFiscal`:
```typescript
// Reemplazar todos los usos de setHasFiscal(true/false) con:
setFiscalValues((v) => ({ ...v, hasFiscal: true/false }));
```

Reemplazar la sección 3 completa del JSX (el bloque `<div className="card p-5 space-y-4">` que contiene el comprobante) con:
```tsx
<div className="card p-5 space-y-4">
  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
    <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">3</span>
    Comprobante fiscal
    {(aiFields.has('ncf') || aiFields.has('supplierName') || aiFields.has('supplierRnc')) && (
      <span className="text-xs font-normal text-violet-600 flex items-center gap-1 ml-1">
        <Sparkles className="w-3 h-3" /> datos detectados por IA
      </span>
    )}
  </h2>
  <FiscalVoucherForm
    value={fiscalValues}
    onChange={(next) => {
      setFiscalValues(next);
      // Sync AI-filled fields back to RHF for fiscal voucher fields
      if (next.ncf)          setValue('fiscalVoucher.ncf',          next.ncf);
      if (next.supplierRnc)  setValue('fiscalVoucher.supplierRnc',  next.supplierRnc);
      if (next.supplierName) setValue('fiscalVoucher.supplierName', next.supplierName);
      if (next.itbisAmount)  setValue('fiscalVoucher.itbisAmount',  Number(next.itbisAmount));
    }}
    aiFields={aiFields}
  />
</div>
```

Actualizar `onSubmit` para leer de `fiscalValues` en lugar de los campos RHF fiscales:
```typescript
// ANTES:
if (hasFiscal) {
  payload.fiscalVoucher = {
    ncf:          data.fiscalVoucher?.ncf?.toUpperCase(),
    supplierRnc:  data.fiscalVoucher?.supplierRnc,
    supplierName: data.fiscalVoucher?.supplierName,
    itbisAmount:  Number(data.fiscalVoucher?.itbisAmount ?? 0),
  };
}

// DESPUÉS:
if (fiscalValues.hasFiscal) {
  payload.hasFiscalDoc = true;
  payload.fiscalVoucher = {
    ncf:          fiscalValues.ncf.toUpperCase(),
    supplierRnc:  fiscalValues.supplierRnc,
    supplierName: fiscalValues.supplierName,
    itbisAmount:  Number(fiscalValues.itbisAmount ?? 0),
  };
}
```

También actualizar el callback de OCR (`handleAnalyze`) para sincronizar con `fiscalValues`:
```typescript
// Reemplazar el bloque que hace setHasFiscal(true) + setValue('fiscalVoucher.*'):
if (data.ncf || data.supplierName || data.supplierRnc || data.itbisAmount !== null) {
  setFiscalValues((v) => ({
    hasFiscal:    true,
    ncf:          data.ncf          ?? v.ncf,
    supplierRnc:  data.supplierRnc  ?? v.supplierRnc,
    supplierName: data.supplierName ?? v.supplierName,
    itbisAmount:  data.itbisAmount != null ? String(data.itbisAmount) : v.itbisAmount,
  }));
  // Rellenar también aiFields para los indicadores visuales
  if (data.ncf)          filled.add('ncf');
  if (data.supplierName) filled.add('supplierName');
  if (data.supplierRnc)  filled.add('supplierRnc');
  if (data.itbisAmount != null) filled.add('itbisAmount');
}
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm tsc --noEmit
```
Esperado: 0 errores.

- [ ] **Commit**

```bash
git add apps/frontend/src/components/shared/FiscalVoucherForm.tsx \
        apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx \
        apps/frontend/src/pages/expenses/NewExpensePage.tsx
git commit -m "refactor: extraer FiscalVoucherForm como componente compartido"
```

---

## Task 4: Componente `<TransferPaymentForm>`

**Problema:** El par banco + número de transacción aparece **3 veces**:
1. `PaymentOrdersPage.tsx` — modal "Confirmar pago" (líneas ~1267-1288)
2. `PayrollDetailPage.tsx` — modal "Registrar pago" (líneas ~783-797)
3. `PayrollDetailPage.tsx` — edición inline por línea de nómina (líneas ~574-603)

El modal de nómina tiene además el bloque de **pago en efectivo** (receiptNumber, receivedBy) que no existe en órdenes de pago. El componente lo soporta con `showCash`.

**Files:**
- Create: `apps/frontend/src/components/shared/TransferPaymentForm.tsx`
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`
- Modify: `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx`

- [ ] **Crear el componente**

```typescript
// apps/frontend/src/components/shared/TransferPaymentForm.tsx
import { Receipt, AlertTriangle } from 'lucide-react';

export interface TransferPaymentValue {
  paymentMethod:    'CASH' | 'TRANSFER';
  paymentDate?:     string;
  paymentBank:      string;
  paymentReference: string;
  receiptNumber?:   string;
  receivedBy?:      string;
}

interface Props {
  value:    TransferPaymentValue;
  onChange: (next: TransferPaymentValue) => void;
  /** Mostrar selector CASH/TRANSFER y fecha. Default: false (solo muestra banco+referencia) */
  showMethodSelector?: boolean;
  /** Mostrar bloque de efectivo (recibo + nombre). Solo relevante si showMethodSelector=true */
  showCash?: boolean;
  /** Label para el campo de banco. Default: "Banco emisor" */
  bankLabel?: string;
}

export function TransferPaymentForm({
  value, onChange,
  showMethodSelector = false,
  showCash = false,
  bankLabel = 'Banco emisor',
}: Props) {
  const set = (patch: Partial<TransferPaymentValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      {/* Método de pago — solo si showMethodSelector */}
      {showMethodSelector && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago *</label>
          <div className="flex gap-4 mb-1">
            {(['CASH', 'TRANSFER'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="payMethod"
                  value={m}
                  checked={value.paymentMethod === m}
                  onChange={() => set({ paymentMethod: m })}
                  className="accent-yellow-500"
                />
                {m === 'CASH' ? 'Efectivo' : 'Transferencia bancaria'}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Fecha de pago — solo si showMethodSelector */}
      {showMethodSelector && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago *</label>
          <input
            type="date"
            value={value.paymentDate ?? ''}
            onChange={(e) => set({ paymentDate: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
      )}

      {/* Banco + Referencia — cuando es transferencia */}
      {(!showMethodSelector || value.paymentMethod === 'TRANSFER') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{bankLabel}</label>
            <input
              type="text"
              value={value.paymentBank}
              onChange={(e) => set({ paymentBank: e.target.value })}
              placeholder="ej. BHD, BanReservas"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">No. de transacción</label>
            <input
              type="text"
              value={value.paymentReference}
              onChange={(e) => set({ paymentReference: e.target.value })}
              placeholder="ej. 123456789"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
            />
          </div>
        </div>
      )}

      {/* Efectivo: recibo + nombre — solo si showCash y método = CASH */}
      {showCash && showMethodSelector && value.paymentMethod === 'CASH' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Datos del recibo (obligatorios para efectivo)
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. de recibo *</label>
            <input
              type="text"
              value={value.receiptNumber ?? ''}
              onChange={(e) => set({ receiptNumber: e.target.value })}
              placeholder="Ej: REC-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de quien recibió *</label>
            <input
              type="text"
              value={value.receivedBy ?? ''}
              onChange={(e) => set({ receivedBy: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          {(!value.receiptNumber?.trim() || !value.receivedBy?.trim()) && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Complete el número de recibo y el nombre para confirmar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Refactorizar PaymentOrdersPage.tsx — modal de pago (sección "Transferencia")**

Añadir import:
```typescript
import { TransferPaymentForm, type TransferPaymentValue } from '../../components/shared/TransferPaymentForm';
```

Cambiar tipo del estado `payInfoForm`:
```typescript
// ANTES:
const [payInfoForm, setPayInfoForm] = useState({ paymentBank: '', paymentReference: '', exchangeRate: '' });

// DESPUÉS:
const [payInfoForm, setPayInfoForm] = useState<TransferPaymentValue & { exchangeRate: string }>({
  paymentMethod: 'TRANSFER', paymentBank: '', paymentReference: '', exchangeRate: '',
});
```

Reemplazar el bloque JSX "Información de transferencia" (el `<div className="space-y-3 border-t border-gray-100 pt-3">` con el grid banco+referencia) con:
```tsx
<div className="space-y-3 border-t border-gray-100 pt-3">
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transferencia (opcional)</p>

  {/* Tasa de cambio — solo divisas extranjeras (no toca TransferPaymentForm) */}
  {payingOrder.currency !== 'RD$' && (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
        💱 Orden en {payingOrder.currency} — Tasa de cambio requerida
      </p>
      <div className="flex items-center gap-2">
        <label className="block text-xs font-semibold text-gray-600 shrink-0">
          1 {payingOrder.currency} = RD$
        </label>
        <input
          type="number"
          value={payInfoForm.exchangeRate}
          onChange={(e) => setPayInfoForm((f) => ({ ...f, exchangeRate: e.target.value }))}
          placeholder="ej. 60.50"
          min="0.01"
          step="0.01"
          className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-amber-400"
        />
      </div>
      {payInfoForm.exchangeRate && Number(payInfoForm.exchangeRate) > 0 && (
        <p className="text-xs text-amber-700">
          Equivalente: RD$ {(Number(payingOrder.amount) * Number(payInfoForm.exchangeRate)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  )}

  <TransferPaymentForm
    value={payInfoForm}
    onChange={(next) => setPayInfoForm((f) => ({ ...f, ...next }))}
  />
</div>
```

- [ ] **Refactorizar PayrollDetailPage.tsx — modal "Registrar pago"**

Añadir import:
```typescript
import { TransferPaymentForm, type TransferPaymentValue } from '../../components/shared/TransferPaymentForm';
```

Cambiar tipo del estado `payForm`:
```typescript
// ANTES:
const [payForm, setPayForm] = useState({
  paymentMethod:    'TRANSFER' as 'CASH' | 'TRANSFER',
  paymentDate:      new Date().toISOString().slice(0, 10),
  paymentBank:      '',
  paymentReference: '',
  receiptNumber:    '',
  receivedBy:       '',
});

// DESPUÉS — mismo shape, tipo explícito:
const [payForm, setPayForm] = useState<TransferPaymentValue & { paymentDate: string }>({
  paymentMethod: 'TRANSFER',
  paymentDate:   new Date().toISOString().slice(0, 10),
  paymentBank: '', paymentReference: '', receiptNumber: '', receivedBy: '',
});
```

Reemplazar el bloque JSX dentro del `{payModal && ...}` que contiene el selector de método, fecha, banco, referencia, y efectivo con:
```tsx
<TransferPaymentForm
  value={payForm}
  onChange={(next) => setPayForm((f) => ({ ...f, ...next }))}
  showMethodSelector
  showCash
/>
```
(El campo `paymentDate` queda fuera del componente ya que es específico de nóminas — mantenerlo como input separado encima del `<TransferPaymentForm>`.)

- [ ] **Refactorizar PayrollDetailPage.tsx — edición inline de línea (banco + referencia por línea)**

El `paymentForm` de edición por línea (estado `paymentLineId` + `paymentForm`) también tiene el par banco/referencia. Reemplazar esos 2 inputs inline con:
```tsx
<TransferPaymentForm
  value={{ ...paymentForm, paymentMethod: 'TRANSFER' }}
  onChange={(next) => setPaymentForm((f) => ({ ...f, paymentBank: next.paymentBank, paymentReference: next.paymentReference }))}
  bankLabel="Banco origen"
/>
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm tsc --noEmit
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/shared/TransferPaymentForm.tsx \
        apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx \
        apps/frontend/src/pages/payroll/PayrollDetailPage.tsx
git commit -m "refactor: extraer TransferPaymentForm como componente compartido"
```

---

## Task 5: Componente `<ForeignCurrencyInput>`

**Problema:** El bloque de conversión de divisas (foreignCurrency + foreignAmount + exchangeRate + cálculo DOP automático) está implementado dos veces:
- `NewExpensePage.tsx` líneas ~534-584: checkbox + 3 inputs + cálculo automático
- `PaymentOrdersPage.tsx` líneas ~1240-1265: panel ámbar + input tasa + cálculo (solo tasa, no monto)

El componente cubre el caso completo (NewExpense). PaymentOrders solo necesita el input de tasa, que sigue siendo más simple — pero usa el mismo cálculo de equivalente.

**Files:**
- Create: `apps/frontend/src/components/shared/ForeignCurrencyInput.tsx`
- Modify: `apps/frontend/src/pages/expenses/NewExpensePage.tsx`

- [ ] **Crear el componente**

```typescript
// apps/frontend/src/components/shared/ForeignCurrencyInput.tsx

export const FOREIGN_CURRENCIES = [
  { code: 'USD', label: 'USD — Dólar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — Libra' },
  { code: 'CAD', label: 'CAD — Dólar canadiense' },
] as const;

export type ForeignCurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD';

export interface ForeignCurrencyValue {
  enabled:         boolean;
  currency:        ForeignCurrencyCode;
  foreignAmount:   string;
  exchangeRate:    string;
}

interface Props {
  value:    ForeignCurrencyValue;
  onChange: (next: ForeignCurrencyValue) => void;
  /** Callback para que el padre actualice su campo amount (DOP) */
  onDopChange?: (dop: number) => void;
}

export function ForeignCurrencyInput({ value, onChange, onDopChange }: Props) {
  const set = (patch: Partial<ForeignCurrencyValue>) => {
    const next = { ...value, ...patch };
    onChange(next);
    if (next.enabled && next.foreignAmount && next.exchangeRate) {
      const dop = parseFloat(next.foreignAmount) * parseFloat(next.exchangeRate);
      if (!isNaN(dop) && dop > 0) onDopChange?.(parseFloat(dop.toFixed(2)));
    }
  };

  const dopEquivalent =
    value.enabled && value.foreignAmount && value.exchangeRate
      ? parseFloat(value.foreignAmount) * parseFloat(value.exchangeRate)
      : null;

  return (
    <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="text-sm font-medium text-blue-800">💱 Pago realizado en moneda extranjera</span>
      </label>

      {value.enabled && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={value.currency}
                onChange={(e) => set({ currency: e.target.value as ForeignCurrencyCode })}
                className="input-field text-sm"
              >
                {FOREIGN_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monto en {value.currency} *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={value.foreignAmount}
                onChange={(e) => set({ foreignAmount: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tasa (1 {value.currency} = X DOP)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="ej: 60.50"
                value={value.exchangeRate}
                onChange={(e) => set({ exchangeRate: e.target.value })}
                className="input-field text-sm"
              />
            </div>
          </div>
          {dopEquivalent && dopEquivalent > 0 && (
            <p className="text-xs text-blue-600">
              Equivalente: RD$ {dopEquivalent.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              {' — '}El campo <strong>Monto (RD$)</strong> se actualizó automáticamente.
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Refactorizar NewExpensePage.tsx — reemplazar sección de moneda extranjera**

Añadir import:
```typescript
import { ForeignCurrencyInput, type ForeignCurrencyValue } from '../../components/shared/ForeignCurrencyInput';
```

Cambiar estado:
```typescript
// ANTES:
const [useForeign,      setUseForeign]     = useState(false);
const [foreignCurrency, setForeignCurrency] = useState('USD');

// DESPUÉS:
const [foreignCurrency, setForeignCurrency] = useState<ForeignCurrencyValue>({
  enabled: false, currency: 'USD', foreignAmount: '', exchangeRate: '',
});
```

Reemplazar el bloque JSX de moneda extranjera (el `<div className="rounded-xl border border-dashed border-blue-300 ...">`) con:
```tsx
<ForeignCurrencyInput
  value={foreignCurrency}
  onChange={setForeignCurrency}
  onDopChange={(dop) => setValue('amount', dop)}
/>
```

Actualizar `onSubmit` para leer de `foreignCurrency`:
```typescript
// ANTES:
if (useForeign && data.foreignAmount && data.exchangeRate) {
  payload.foreignAmount   = Number(data.foreignAmount);
  payload.foreignCurrency = foreignCurrency;
  payload.exchangeRate    = Number(data.exchangeRate);
  ...
}

// DESPUÉS:
if (foreignCurrency.enabled && foreignCurrency.foreignAmount && foreignCurrency.exchangeRate) {
  payload.foreignAmount   = Number(foreignCurrency.foreignAmount);
  payload.foreignCurrency = foreignCurrency.currency;
  payload.exchangeRate    = Number(foreignCurrency.exchangeRate);
  if (!data.amount || data.amount <= 0) {
    payload.amount = Number(foreignCurrency.foreignAmount) * Number(foreignCurrency.exchangeRate);
  }
}
```

- [ ] **Verificar compilación**

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm tsc --noEmit
```

- [ ] **Commit**

```bash
git add apps/frontend/src/components/shared/ForeignCurrencyInput.tsx \
        apps/frontend/src/pages/expenses/NewExpensePage.tsx
git commit -m "refactor: extraer ForeignCurrencyInput como componente compartido"
```

---

## Task 6: Helper backend `buildExpenseFromSource`

**Problema:** La lógica de creación de `Expense` está triplicada:
1. `markAsPaid()` en `payment-orders.service.ts` (líneas ~455-565) — gasto desde orden de pago
2. `approvePayroll()` en `payroll.service.ts` (líneas ~338-380) — gasto desde línea de nómina
3. `generateExpenseForOrder()` en `payment-orders.service.ts` (líneas ~579-625) — gasto retroactivo

Los tres crean un `Expense` con los mismos campos base pero con lógica similar esparcida.

**Strategy:** Extraer una función helper `buildExpenseData()` que construye el objeto `data` para `tx.expense.create()` sin hacer la query — cada caller sigue haciendo su propia transacción. Esto es una refactorización de bajo riesgo que no toca la lógica de negocio.

**Files:**
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.service.ts`
- Modify: `apps/backend/src/modules/payroll/payroll.service.ts`

- [ ] **Extraer la función helper en payment-orders.service.ts**

Añadir justo antes de `markAsPaid`:

```typescript
// ── Helper: construir datos de Expense desde una fuente ───────
interface ExpenseSourceData {
  projectId:          string;
  categoryId:         number;
  userId:             string;
  expenseDate:        Date;
  amount:             number;              // DOP
  description:        string;
  paymentMethod?:     string;
  hasFiscalDoc?:      boolean;
  notes?:             string;
  contratoAjustadoId?: string | null;
  // Divisa extranjera
  foreignAmount?:     Decimal | number | null;
  foreignCurrency?:   string | null;
  exchangeRate?:      number | null;
  // Comprobante fiscal
  fiscalVoucher?: {
    ncf:          string;
    supplierRnc:  string;
    supplierName: string;
    itbisAmount?: number;
  } | null;
}

export function buildExpenseData(src: ExpenseSourceData) {
  const base: any = {
    projectId:          src.projectId,
    categoryId:         src.categoryId,
    userId:             src.userId,
    expenseDate:        src.expenseDate,
    amount:             src.amount,
    description:        src.description,
    paymentMethod:      src.paymentMethod ?? 'TRANSFER',
    hasFiscalDoc:       src.hasFiscalDoc  ?? false,
    notes:              src.notes         ?? null,
    contratoAjustadoId: src.contratoAjustadoId ?? null,
  };

  if (src.foreignAmount && src.foreignCurrency) {
    base.foreignAmount   = src.foreignAmount;
    base.foreignCurrency = src.foreignCurrency;
    base.exchangeRate    = src.exchangeRate ?? null;
  }

  if (src.hasFiscalDoc && src.fiscalVoucher) {
    base.fiscalVoucher = {
      create: {
        ncf:          src.fiscalVoucher.ncf,
        ncfType:      extractNCFType(src.fiscalVoucher.ncf),
        isElectronic: isElectronicNCF(src.fiscalVoucher.ncf),
        supplierRnc:  src.fiscalVoucher.supplierRnc,
        supplierName: src.fiscalVoucher.supplierName,
        itbisAmount:  src.fiscalVoucher.itbisAmount ?? 0,
      },
    };
  }

  return base;
}
```

- [ ] **Refactorizar `markAsPaid` para usar el helper**

Reemplazar el bloque `const expense = await tx.expense.create({ data: { ... } })` con:

```typescript
const hasFiscal = !!(fiscalVoucher?.ncf);
const isForeign = po.currency !== 'RD$';
const exchangeRate = paymentInfo?.exchangeRate ?? null;
const amountDOP = isForeign && exchangeRate ? Number(po.amount) * exchangeRate : Number(po.amount);
const foreignCurrencyISO = po.currency === 'US$' ? 'USD' : po.currency === '€' ? 'EUR' : null;
const opRef = `OP-${String(po.number).padStart(3, '0')}`;

const expense = await tx.expense.create({
  data: buildExpenseData({
    projectId:    po.projectId,
    categoryId:   category.id,
    userId,
    expenseDate:  new Date(),
    amount:       amountDOP,
    description:  `[${opRef}] ${po.concept}`,
    hasFiscalDoc: hasFiscal,
    notes:        `Auto-generado al confirmar ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}. Empresa: ${po.payingCompany}.${isForeign ? ` Divisa: ${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? ` (TC: ${exchangeRate})` : ''}.` : ''}`,
    contratoAjustadoId: (po as any).contratoAjustadoId ?? null,
    foreignAmount:    isForeign ? po.amount : null,
    foreignCurrency:  isForeign ? foreignCurrencyISO : null,
    exchangeRate:     isForeign ? exchangeRate : null,
    fiscalVoucher:    hasFiscal ? fiscalVoucher : null,
  }),
});
```

- [ ] **Refactorizar `generateExpenseForOrder` para usar el helper**

En `generateExpenseForOrder`, reemplazar el bloque `tx.expense.create({ data: { ... } })` con la misma llamada a `buildExpenseData()` usando los datos de la orden.

- [ ] **Exportar `buildExpenseData` e importarla en payroll.service.ts**

```typescript
// apps/backend/src/modules/payroll/payroll.service.ts
// Añadir import:
import { buildExpenseData } from '../payment-orders/payment-orders.service';
```

Reemplazar en `approvePayroll` el bloque `tx.expense.create({ data: { ... } })` por línea:

```typescript
const expense = await tx.expense.create({
  data: buildExpenseData({
    projectId:    payroll.projectId,
    categoryId:   category.id,
    userId:       approvedById,
    expenseDate:  new Date(payroll.periodEnd),
    amount:       lineAmount,
    description:  `NOM-${String(payroll.number).padStart(3, '0')} — ${line.supplierName || 'Sin suplidor'}: ${line.description}`,
    hasFiscalDoc: false,
    notes:        `Línea ${line.lineNumber} de nómina. Auto-generado al aprobar.`,
    contratoAjustadoId: (line as any).contratoAjustadoId ?? null,
  }),
});
```

- [ ] **Verificar compilación del backend**

```bash
cd /home/user/servingmi-appCG/apps/backend
pnpm tsc --noEmit
```
Esperado: 0 errores.

- [ ] **Commit**

```bash
git add apps/backend/src/modules/payment-orders/payment-orders.service.ts \
        apps/backend/src/modules/payroll/payroll.service.ts
git commit -m "refactor: extraer buildExpenseData como helper compartido entre órdenes y nóminas"
```

---

## Task 7: Merge a main y push final

- [ ] **Merge feature branch a main**

```bash
git checkout main
git merge claude/happy-feynman-stMWv --no-ff \
  -m "refactor: consolidar sub-flujos duplicados (FiscalVoucher, TransferPayment, ForeignCurrency, statusLabels, buildExpenseData)"
git push origin main
```

- [ ] **Verificar que Render desplegó correctamente**

Ir a https://dashboard.render.com → confirmar que el deploy de `main` terminó sin errores.

---

## Checklist de cobertura

| Duplicación identificada | Tarea que la resuelve |
|-------------------------|----------------------|
| NCF_REGEX definida 2× en frontend | Task 1 |
| STATUS_LABEL/COLOR definidos 2× en payroll | Task 2 |
| Sub-formulario NCF/fiscal 2× (PaymentOrders + Expenses) | Task 3 |
| Banco + No. transacción 3× (PaymentOrders + Payroll×2) | Task 4 |
| Conversión moneda extranjera 2× | Task 5 |
| Auto-generación de Expense 3× en backend | Task 6 |

**Fuera de scope (próxima fase):**
- Conectar líneas de nómina al maestro de suplidores (requiere migración de BD: añadir FK `supplierId` a `PayrollLine`)
- Unificar los dos caminos de `QuotationPayment` (manual desde cotización + automático desde orden de pago)
