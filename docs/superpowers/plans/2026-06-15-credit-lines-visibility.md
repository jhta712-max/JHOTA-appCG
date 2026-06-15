# Credit Lines Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar el estado de líneas de crédito de suplidores en el dashboard (KPI card + tabla resumen), deshabilitar líneas sin disponible en el formulario de gastos, y agregar reporte Excel exportable.

**Architecture:** Nuevo servicio `credit-summary.service.ts` agrega balances de todas las líneas activas. Dos endpoints nuevos en `suppliers.router.ts` — uno JSON para dashboard y uno blob xlsx para reporte. El frontend consume el JSON con TanStack Query para el dashboard y descarga el blob directamente para el reporte.

**Tech Stack:** Express + Prisma + ExcelJS (ya instalado en backend), React 18 + TanStack Query, TailwindCSS design system #1C1C1C / #F5C218.

---

## Mapa de archivos

### Backend — crear
- `apps/backend/src/modules/suppliers/credit-summary.service.ts` — agrega balances de todas las líneas activas + genera xlsx

### Backend — modificar
- `apps/backend/src/modules/suppliers/suppliers.router.ts` — 2 rutas nuevas: `/credit-summary` y `/credit-report`
- `apps/backend/src/modules/suppliers/suppliers.controller.ts` — 2 handlers: `getCreditSummary`, `getCreditReport`

### Frontend — modificar
- `apps/frontend/src/api/index.ts` — agregar `getCreditSummary()` a `suppliersApi`
- `apps/frontend/src/pages/dashboard/DashboardPage.tsx` — KPI card "Deuda con suplidores" + sección tabla
- `apps/frontend/src/pages/expenses/NewExpensePage.tsx` — deshabilitar opciones sin disponible en el select de líneas
- `apps/frontend/src/pages/reports/ReportsPage.tsx` — nueva card "Estado de Crédito"

---

## Task 1: Backend — credit-summary.service.ts

**Files:**
- Create: `apps/backend/src/modules/suppliers/credit-summary.service.ts`
- Test: `apps/backend/src/modules/suppliers/__tests__/credit-summary.service.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/backend/src/modules/suppliers/__tests__/credit-summary.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/database', () => ({
  default: {
    supplierCreditLine: { findMany: vi.fn() },
    expense: { aggregate: vi.fn() },
  },
}));

import prisma from '../../../config/database';
import { getCreditSummary } from '../credit-summary.service';

beforeEach(() => vi.clearAllMocks());

describe('getCreditSummary', () => {
  it('returns aggregate totals and line list', async () => {
    vi.mocked(prisma.supplierCreditLine.findMany).mockResolvedValue([
      {
        id: 'line-1', supplierId: 's-1', creditLimit: 500000, isActive: true,
        updatedAt: new Date('2026-06-01'),
        payments: [{ amount: 100000 }],
        supplier: { id: 's-1', name: 'Ferretería ABC', rnc: '101234567' },
      } as any,
    ]);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: 300000 } } as any);

    const result = await getCreditSummary();

    expect(result.activeLines).toBe(1);
    expect(result.totalLimit).toBe(500000);
    // consumed=300000, paid=100000, pending=200000, available=300000
    expect(result.totalPending).toBe(200000);
    expect(result.totalAvailable).toBe(300000);
    expect(result.lines[0].supplierName).toBe('Ferretería ABC');
    expect(result.lines[0].pending).toBe(200000);
  });

  it('handles supplier with no expenses (consumed=0)', async () => {
    vi.mocked(prisma.supplierCreditLine.findMany).mockResolvedValue([
      {
        id: 'line-2', supplierId: 's-2', creditLimit: 200000, isActive: true,
        updatedAt: new Date(),
        payments: [],
        supplier: { id: 's-2', name: 'Materiales XYZ', rnc: null },
      } as any,
    ]);
    vi.mocked(prisma.expense.aggregate).mockResolvedValue({ _sum: { amount: null } } as any);

    const result = await getCreditSummary();
    expect(result.totalPending).toBe(0);
    expect(result.totalAvailable).toBe(200000);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

```bash
pnpm --filter backend test -- --run src/modules/suppliers/__tests__/credit-summary.service.test.ts
```

Expected: FAIL — `Cannot find module '../credit-summary.service'`

- [ ] **Step 3: Crear credit-summary.service.ts**

Crear `apps/backend/src/modules/suppliers/credit-summary.service.ts`:

```typescript
import prisma from '../../config/database';
import { Response } from 'express';
import ExcelJS from 'exceljs';

export interface CreditLineSummaryItem {
  supplierId:   string;
  supplierName: string;
  supplierRnc:  string | null;
  creditLineId: string;
  creditLimit:  number;
  consumed:     number;
  paid:         number;
  pending:      number;
  available:    number;
  isActive:     boolean;
  updatedAt:    Date;
}

export interface CreditSummary {
  totalPending:   number;
  totalAvailable: number;
  totalLimit:     number;
  activeLines:    number;
  lines:          CreditLineSummaryItem[];
}

function lineStatus(item: CreditLineSummaryItem): string {
  if (item.pending === 0)                                return 'SIN DEUDA';
  const ratio = item.available / item.creditLimit;
  if (ratio >= 0.20)                                     return 'EN ORDEN';
  if (ratio >= 0.10)                                     return 'BAJO';
  return 'CRÍTICO';
}

export async function getCreditSummary(includeInactive = false): Promise<CreditSummary> {
  const lines = await prisma.supplierCreditLine.findMany({
    where:   includeInactive ? {} : { isActive: true },
    include: {
      payments: { select: { amount: true } },
      supplier: { select: { id: true, name: true, rnc: true } },
    },
  });

  const items: CreditLineSummaryItem[] = await Promise.all(
    lines.map(async (line) => {
      const agg = await prisma.expense.aggregate({
        where: { creditLineId: line.id, status: { not: 'VOIDED' } },
        _sum:  { amount: true },
      });
      const consumed  = Number(agg._sum.amount ?? 0);
      const paid      = line.payments.reduce((s, p) => s + Number(p.amount), 0);
      const pending   = Math.max(consumed - paid, 0);
      const available = Math.max(Number(line.creditLimit) - pending, 0);

      return {
        supplierId:   line.supplier.id,
        supplierName: line.supplier.name,
        supplierRnc:  line.supplier.rnc ?? null,
        creditLineId: line.id,
        creditLimit:  Number(line.creditLimit),
        consumed,
        paid,
        pending,
        available,
        isActive:     line.isActive,
        updatedAt:    line.updatedAt,
      };
    })
  );

  // Ordenar por pending desc
  items.sort((a, b) => b.pending - a.pending);

  return {
    totalPending:   items.reduce((s, l) => s + l.pending, 0),
    totalAvailable: items.reduce((s, l) => s + l.available, 0),
    totalLimit:     items.reduce((s, l) => s + l.creditLimit, 0),
    activeLines:    items.filter((l) => l.isActive).length,
    lines:          items,
  };
}

export async function generateCreditReportXlsx(res: Response, includeInactive = false): Promise<void> {
  const summary = await getCreditSummary(includeInactive);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Estado de Crédito');

  // Título
  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'ESTADO DE CRÉDITO POR SUPLIDOR — SERVINGMI';
  ws.getCell('A1').font  = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  ws.getCell('A1').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Generado: ${new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  // Headers
  const headerRow = ws.addRow([
    'Suplidor', 'RNC', 'Límite Crédito', 'Consumido',
    'Pagado', 'Pendiente (Deuda)', 'Disponible', '% Utilización', 'Estado', 'Última Actividad',
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1C1C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(3).height = 22;

  const fmt = (n: number) => Number(n.toFixed(2));

  // Rows
  for (const item of summary.lines) {
    const pct = item.creditLimit > 0 ? ((item.pending / item.creditLimit) * 100).toFixed(1) : '0.0';
    const status = lineStatus(item);
    const row = ws.addRow([
      item.supplierName,
      item.supplierRnc ?? '',
      fmt(item.creditLimit),
      fmt(item.consumed),
      fmt(item.paid),
      fmt(item.pending),
      fmt(item.available),
      `${pct}%`,
      status,
      item.updatedAt.toLocaleDateString('es-DO'),
    ]);

    // Color de estado
    const statusCell = row.getCell(9);
    const pendingCell = row.getCell(6);
    if (status === 'CRÍTICO') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      pendingCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (status === 'BAJO') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      statusCell.font = { bold: true, color: { argb: 'FF854D0E' } };
    } else if (status === 'EN ORDEN') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { bold: true, color: { argb: 'FF166534' } };
    }
  }

  // Totals row
  const totalsRow = ws.addRow([
    'TOTALES', '', fmt(summary.totalLimit), '', '',
    fmt(summary.totalPending), fmt(summary.totalAvailable), '', '', '',
  ]);
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });

  // Column widths
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 14;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 12;
  ws.getColumn(10).width = 18;

  // Number format for money columns
  [3, 4, 5, 6, 7].forEach((col) => {
    ws.getColumn(col).numFmt = '#,##0.00';
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="credito-suplidores-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}
```

- [ ] **Step 4: Correr el test — debe pasar**

```bash
pnpm --filter backend test -- --run src/modules/suppliers/__tests__/credit-summary.service.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Verificar que compila**

```bash
pnpm build:backend
```

Expected: sin errores TypeScript.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/suppliers/credit-summary.service.ts \
        apps/backend/src/modules/suppliers/__tests__/credit-summary.service.test.ts
git commit -m "feat: credit-summary service with aggregate balance and xlsx report"
```

---

## Task 2: Backend — controller + rutas

**Files:**
- Modify: `apps/backend/src/modules/suppliers/suppliers.controller.ts`
- Modify: `apps/backend/src/modules/suppliers/suppliers.router.ts`

- [ ] **Step 1: Agregar handlers al controller**

En `apps/backend/src/modules/suppliers/suppliers.controller.ts`, agregar al bloque de imports:

```typescript
import { getCreditSummary, generateCreditReportXlsx } from './credit-summary.service';
```

Agregar los dos handlers al final del archivo (antes del cierre del módulo si hay):

```typescript
export async function getCreditSummaryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.status === 'all';
    const data = await getCreditSummary(includeInactive);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getCreditReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.status === 'all';
    await generateCreditReportXlsx(res, includeInactive);
  } catch (err) { next(err); }
}
```

- [ ] **Step 2: Agregar rutas en suppliers.router.ts**

En `apps/backend/src/modules/suppliers/suppliers.router.ts`, agregar import de los nuevos handlers:

```typescript
// Ya existe: import * as ctrl from './suppliers.controller';
// Los nuevos handlers se exportan del mismo archivo, no hace falta nuevo import
```

Agregar las 2 rutas ANTES de `router.get('/:id', ctrl.getOne)` (para que no conflicten con el param `:id`):

```typescript
router.get('/credit-summary', authorize('admin', 'supervisor'), ctrl.getCreditSummaryHandler);
router.get('/credit-report',  authorize('admin', 'supervisor'), ctrl.getCreditReportHandler);
```

> **Importante:** Estas rutas deben estar ANTES de `router.get('/:id', ...)` para que Express no interprete `credit-summary` como un `:id`.

- [ ] **Step 3: Verificar que compila**

```bash
pnpm build:backend
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/suppliers/suppliers.controller.ts \
        apps/backend/src/modules/suppliers/suppliers.router.ts
git commit -m "feat: GET /suppliers/credit-summary and /credit-report endpoints"
```

---

## Task 3: Frontend — API method + tipos

**Files:**
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Agregar tipo CreditSummary**

En `apps/frontend/src/types/index.ts`, al final del archivo, agregar:

```typescript
export interface CreditSummary {
  totalPending:   number;
  totalAvailable: number;
  totalLimit:     number;
  activeLines:    number;
  lines: {
    supplierId:   string;
    supplierName: string;
    supplierRnc:  string | null;
    creditLineId: string;
    creditLimit:  number;
    consumed:     number;
    paid:         number;
    pending:      number;
    available:    number;
    isActive:     boolean;
    updatedAt:    string;
  }[];
}
```

- [ ] **Step 2: Agregar método a suppliersApi**

En `apps/frontend/src/api/index.ts`, buscar el bloque `suppliersApi` y agregar al final de sus métodos (antes del cierre `}`):

```typescript
  getCreditSummary: (status?: 'active' | 'all') =>
    api.get<{ success: boolean; data: CreditSummary }>('/suppliers/credit-summary', { params: status === 'all' ? { status: 'all' } : undefined }),
  downloadCreditReport: (status?: 'active' | 'all') =>
    api.get('/suppliers/credit-report', {
      params: status === 'all' ? { status: 'all' } : undefined,
      responseType: 'blob',
    }),
```

Agregar `CreditSummary` al import de tipos en `api/index.ts` si es necesario (buscar la línea que importa de `../types` y agregar `CreditSummary`).

- [ ] **Step 3: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/types/index.ts apps/frontend/src/api/index.ts
git commit -m "feat: CreditSummary type and API methods getCreditSummary + downloadCreditReport"
```

---

## Task 4: Frontend — Dashboard KPI card + sección tabla

**Files:**
- Modify: `apps/frontend/src/pages/dashboard/DashboardPage.tsx`

Leer el archivo antes de editar. El patrón de KPI cards es `div.border.border-gray-200.bg-white.p-4` con `style={{ borderTop: '3px solid COLOR' }}`. La grid es `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3`.

- [ ] **Step 1: Agregar query de credit summary**

En `DashboardPage.tsx`, después del import de `paymentOrdersApi`, agregar `suppliersApi`:

```typescript
import { projectsApi, expensesApi, quotationsApi, paymentOrdersApi, suppliersApi } from '../../api';
```

Agregar también `CreditCard` a los imports de lucide-react (busca la línea con `import { FolderOpen, Receipt, ...`):

```typescript
import {
  FolderOpen, Receipt, Plus, ArrowRight,
  AlertCircle, FileText, Clock, ChevronRight, TrendingUp, Wallet, CreditCard,
} from 'lucide-react';
```

Dentro del componente `DashboardPage`, después de la query de `pendingOrders`, agregar:

```typescript
const { data: creditSummary } = useQuery({
  queryKey: ['credit-summary'],
  queryFn:  () => suppliersApi.getCreditSummary().then(r => r.data.data),
  enabled:  isSupervisor,  // solo admin/supervisor
  staleTime: 5 * 60 * 1000,
});

const hasCriticalCreditLine = creditSummary?.lines.some(
  (l) => l.isActive && l.creditLimit > 0 && (l.available / l.creditLimit) < 0.20
) ?? false;
```

Nota: `isSupervisor` ya está disponible del hook `useRole()` que el componente ya usa.

- [ ] **Step 2: Agregar KPI card en la grid**

Busca el cierre de la grid de KPI cards (el `</div>` que cierra `<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">`). La grid tiene 5 cols. Agregar un 6º card visible solo para admin/supervisor, dentro de esa misma grid, ANTES del cierre `</div>`:

```tsx
{/* Deuda con suplidores — solo admin/supervisor */}
{isSupervisor && (
  <div
    className="border bg-white p-4 col-span-2 md:col-span-1"
    style={{ borderTop: `3px solid ${hasCriticalCreditLine ? '#F5C218' : '#1C1C1C'}` }}>
    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed'] flex items-center gap-1">
      <CreditCard className="w-3 h-3" />
      Deuda con suplidores
    </p>
    <p
      className="font-['Space_Mono'] text-base font-bold mt-1 leading-tight truncate"
      style={{ color: hasCriticalCreditLine ? '#F5C218' : '#1C1C1C' }}>
      {creditSummary ? `RD$ ${Number(creditSummary.totalPending).toLocaleString('es-DO')}` : '—'}
    </p>
    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1 truncate">
      {creditSummary
        ? `${creditSummary.activeLines} líneas · Disp. RD$ ${Number(creditSummary.totalAvailable).toLocaleString('es-DO')}`
        : 'cargando...'}
    </p>
  </div>
)}
```

- [ ] **Step 3: Agregar sección tabla de crédito**

Busca la sección de pagos pendientes (`{pendingOrders.length > 0 && (`). Agregar la tabla de crédito ANTES de esa sección:

```tsx
{/* ── Crédito de suplidores — solo admin/supervisor ─── */}
{isSupervisor && creditSummary && creditSummary.lines.length > 0 && (
  <div>
    <SectionHeader
      icon={CreditCard}
      title="Crédito de Suplidores"
      action={<ViewAllLink to="/suppliers" label="Ver suplidores" />}
    />
    <div className="bg-white border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#1C1C1C' }}>
            {['Suplidor', 'Límite', 'Consumido', 'Pendiente', 'Disponible', 'Estado'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {creditSummary.lines.slice(0, 10).map((line) => {
            const ratio  = line.creditLimit > 0 ? line.available / line.creditLimit : 1;
            const status = line.pending === 0 ? 'SIN DEUDA'
              : ratio >= 0.20 ? 'EN ORDEN'
              : ratio >= 0.10 ? 'BAJO'
              : 'CRÍTICO';
            const statusStyle = status === 'CRÍTICO'
              ? 'bg-red-100 text-red-700'
              : status === 'BAJO'
              ? 'bg-yellow-100 text-yellow-700'
              : status === 'EN ORDEN'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500';
            const fmtMoney = (n: number) =>
              `RD$ ${Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            return (
              <tr key={line.creditLineId} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-['DM_Sans'] font-medium text-[#1C1C1C]">{line.supplierName}</td>
                <td className="px-4 py-2.5 font-['Space_Mono'] text-xs text-gray-500">{fmtMoney(line.creditLimit)}</td>
                <td className="px-4 py-2.5 font-['Space_Mono'] text-xs text-gray-500">{fmtMoney(line.consumed)}</td>
                <td className="px-4 py-2.5 font-['Space_Mono'] text-xs font-bold text-red-700">{fmtMoney(line.pending)}</td>
                <td className="px-4 py-2.5 font-['Space_Mono'] text-xs font-bold text-green-700">{fmtMoney(line.available)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 ${statusStyle}`}>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
)}
```

- [ ] **Step 4: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores TypeScript.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat: credit lines KPI card and supplier debt table in dashboard"
```

---

## Task 5: Frontend — deshabilitar líneas sin disponible en NewExpensePage

**Files:**
- Modify: `apps/frontend/src/pages/expenses/NewExpensePage.tsx`

- [ ] **Step 1: Leer el selector de líneas de crédito**

Buscar en `NewExpensePage.tsx` el bloque que renderiza las opciones de líneas:

```tsx
{(creditLinesForExpense as any[])?.map((l: any) => (
  <option key={l.id} value={l.id}>
    Límite RD${Number(l.creditLimit).toLocaleString('es-DO')} · Disp. RD${Number(l.balance?.available ?? l.creditLimit).toLocaleString('es-DO')}
  </option>
))}
```

- [ ] **Step 2: Reemplazar con opciones deshabilitadas cuando disponible = 0**

Reemplazar el bloque de options con:

```tsx
{(creditLinesForExpense as any[])?.map((l: any) => {
  const available = Number(l.balance?.available ?? l.creditLimit);
  const disabled  = available <= 0;
  return (
    <option key={l.id} value={l.id} disabled={disabled}>
      {disabled
        ? `${l.supplier?.name ?? 'Línea'} — Sin disponible`
        : `Límite RD$${Number(l.creditLimit).toLocaleString('es-DO')} · Disp. RD$${available.toLocaleString('es-DO')}`}
    </option>
  );
})}
```

- [ ] **Step 3: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/expenses/NewExpensePage.tsx
git commit -m "feat: disable credit lines with no available balance in expense form"
```

---

## Task 6: Frontend — reporte en ReportsPage

**Files:**
- Modify: `apps/frontend/src/pages/reports/ReportsPage.tsx`

Leer el archivo antes de editar. El patrón de report cards usa un componente `ReportCard` interno con props `icon`, `title`, `description`, y botones con función `downloadReport(path, filename)`. La función `downloadReport` usa `api.get(path, { responseType: 'blob' })`.

- [ ] **Step 1: Agregar import de CreditCard y suppliersApi**

En `ReportsPage.tsx`, buscar el import de lucide-react y agregar `CreditCard`. Buscar el import de la API y agregar `suppliersApi` si no está.

- [ ] **Step 2: Agregar estado de loading y función de descarga**

En el componente, después de los estados existentes de loading, agregar:

```typescript
const [loadingCredit, setLoadingCredit] = useState(false);

async function downloadCreditReport(status: 'active' | 'all' = 'active') {
  setLoadingCredit(true);
  try {
    const res = await suppliersApi.downloadCreditReport(status);
    const url  = URL.createObjectURL(new Blob([res.data]));
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `credito-suplidores-${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    setLoadingCredit(false);
  }
}
```

- [ ] **Step 3: Agregar card de reporte**

Buscar el cierre del bloque de report cards y agregar la nueva card. Solo visible para admin/supervisor (`{role.isSupervisor && (...)}` — el hook `useRole()` ya está disponible en la página):

```tsx
{role.isSupervisor && (
  <ReportCard
    icon={CreditCard}
    title="Estado de Crédito por Suplidor"
    description="Balance de líneas de crédito activas: consumido, pendiente, disponible y % utilización por proveedor.">
    <button
      onClick={() => downloadCreditReport('active')}
      disabled={loadingCredit}
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide font-['Barlow_Condensed'] bg-[#F5C218] text-[#1C1C1C] hover:opacity-90 disabled:opacity-50 transition-opacity">
      {loadingCredit ? 'Generando…' : 'Excel — Activas'}
    </button>
    <button
      onClick={() => downloadCreditReport('all')}
      disabled={loadingCredit}
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide font-['Barlow_Condensed'] border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
      {loadingCredit ? 'Generando…' : 'Excel — Todas'}
    </button>
  </ReportCard>
)}
```

> **Nota:** Si `ReportCard` acepta `children` como botones de acción, úsalo así. Si usa props `actions`, adapta el JSX al patrón exacto que encuentres en el archivo.

- [ ] **Step 4: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores TypeScript.

- [ ] **Step 5: Commit y push**

```bash
git add apps/frontend/src/pages/reports/ReportsPage.tsx
git commit -m "feat: credit report Excel download in ReportsPage"
git push origin main
```

---

## Task 7: Backend — vincular orden de pago a línea de crédito

Cuando una orden de pago se marca como PAGADA y tiene `creditLineId`, el sistema registra automáticamente un `SupplierCreditPayment`, reduciendo la deuda pendiente.

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260615000004_payment_order_credit_line/migration.sql`
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.schema.ts`
- Modify: `apps/backend/src/modules/payment-orders/payment-orders.service.ts`

- [ ] **Step 1: Agregar campo creditLineId al schema Prisma**

En `apps/backend/prisma/schema.prisma`, dentro del modelo `PaymentOrder`, agregar después de `quotationId`:

```prisma
  creditLineId       String?   @map("credit_line_id") @db.Uuid
```

Y después del bloque de relaciones, agregar:

```prisma
  creditLine         SupplierCreditLine? @relation("PaymentOrderCreditLine", fields: [creditLineId], references: [id], onDelete: SetNull)
```

Y en el modelo `SupplierCreditLine` (busca ese modelo), agregar la relación inversa:

```prisma
  paymentOrders SupmentOrderspayment PaymentOrder[] @relation("PaymentOrderCreditLine")
```

**IMPORTANTE:** La relación inversa en `SupplierCreditLine` se agrega así:

```prisma
  paymentOrders PaymentOrder[] @relation("PaymentOrderCreditLine")
```

Y en los índices de `PaymentOrder`:

```prisma
  @@index([creditLineId])
```

- [ ] **Step 2: Crear migración SQL**

Crear `apps/backend/prisma/migrations/20260615000004_payment_order_credit_line/migration.sql`:

```sql
-- Add creditLineId to payment_orders
ALTER TABLE "payment_orders" ADD COLUMN "credit_line_id" UUID;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_credit_line_id_fkey"
  FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payment_orders_credit_line_id_idx" ON "payment_orders"("credit_line_id");
```

- [ ] **Step 3: Regenerar Prisma client**

```bash
pnpm --filter backend db:generate
```

Expected: `Generated Prisma Client` sin errores.

- [ ] **Step 4: Actualizar el schema Zod de payment-orders**

En `apps/backend/src/modules/payment-orders/payment-orders.schema.ts`, busca el schema de creación (probablemente `createPaymentOrderSchema`) y agregar:

```typescript
  creditLineId: z.string().uuid().optional().nullable(),
```

- [ ] **Step 5: Registrar SupplierCreditPayment en markAsPaid**

En `apps/backend/src/modules/payment-orders/payment-orders.service.ts`, dentro de la función `markAsPaid`, buscar el `prisma.$transaction(async (tx) => {`. 

Agregar al principio del bloque de transacción, ANTES del `tx.paymentOrder.update`:

```typescript
// Importar PaymentMethod al inicio del archivo si no está:
// import { PaymentMethod } from '@prisma/client';
```

Al final del bloque de transacción, ANTES del `return tx.paymentOrder.findUniqueOrThrow(...)`:

```typescript
// Si la orden tiene línea de crédito, registrar el pago contra la línea
if ((po as any).creditLineId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  await tx.supplierCreditPayment.create({
    data: {
      creditLineId:  (po as any).creditLineId,
      amount:        Number(po.amount),
      paymentDate:   new Date(dateStr),
      paymentMethod: (paymentInfo?.paymentMethod ?? 'TRANSFER') as any,
      reference:     paymentInfo?.paymentReference ?? null,
      notes:         `Auto-registrado desde Orden de Pago #${po.number}`,
      createdById:   userId,
    },
  });
}
```

- [ ] **Step 6: Verificar que compila**

```bash
pnpm build:backend
```

Expected: sin errores TypeScript. Si hay error de tipo en `creditLineId`, añadir `(po as any).creditLineId` para acceder al campo.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma/schema.prisma \
        apps/backend/prisma/migrations/20260615000004_payment_order_credit_line/ \
        apps/backend/src/modules/payment-orders/payment-orders.schema.ts \
        apps/backend/src/modules/payment-orders/payment-orders.service.ts
git commit -m "feat: link payment order to credit line — auto-record SupplierCreditPayment on markAsPaid"
```

---

## Task 8: Frontend — selector de línea de crédito en PaymentOrdersPage

Cuando el usuario selecciona un suplidor y el tipo de orden es MATERIALS o SERVICIO, mostrar un toggle "Aplicar a línea de crédito" que carga las líneas activas del suplidor.

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

- [ ] **Step 1: Leer PaymentOrdersPage.tsx**

Leer el archivo completo. Necesitas entender:
1. Dónde está el estado del formulario (`orderForm` + `setOrderForm`)
2. Dónde se define `EMPTY_ORDER` (para agregar `creditLineId: ''` al estado inicial)
3. Dónde está el selector de suplidor (busca `Field label="Suplidor / Beneficiario *"`)
4. Dónde se llama `createMutation.mutate(...)` (para agregar `creditLineId`)
5. Qué imports ya existen

- [ ] **Step 2: Agregar creditLineId a OrderForm y EMPTY_ORDER**

Busca `type OrderForm = {` y agregar al final de la definición:

```typescript
  creditLineId: string;
```

Busca `const EMPTY_ORDER: OrderForm = {` y agregar al final del objeto:

```typescript
  creditLineId: '',
```

- [ ] **Step 3: Agregar estado y query de líneas de crédito**

Dentro del componente (después de los otros useState), agregar:

```typescript
const [useCreditLine, setUseCreditLine] = useState(false);

const { data: supplierCreditLines } = useQuery({
  queryKey: ['supplier-credit-lines-po', orderForm.supplierId],
  queryFn:  () => suppliersApi.getCreditLines(orderForm.supplierId).then(r => r.data.data.filter((l: any) => l.isActive)),
  enabled:  !!orderForm.supplierId && useCreditLine,
});
```

- [ ] **Step 4: Agregar toggle y selector en el formulario**

Busca el bloque que muestra los datos bancarios del suplidor (la sección que renderiza `🏦 banco · cuenta`). Después de ese bloque (y antes del siguiente Field), agregar:

```tsx
{/* Vincular a línea de crédito — solo si el suplidor tiene líneas activas */}
{orderForm.supplierId && ['MATERIALS', 'SERVICIO'].includes(orderForm.orderType) && (
  <div className="border border-gray-100 p-3 bg-gray-50 mb-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={useCreditLine}
        onChange={(e) => {
          setUseCreditLine(e.target.checked);
          if (!e.target.checked) setOrderForm(f => ({ ...f, creditLineId: '' }));
        }}
        className="accent-[#F5C218]"
      />
      <span className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700">
        Aplicar a línea de crédito
      </span>
    </label>
    {useCreditLine && (
      <div className="mt-3">
        <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
          Línea de crédito *
        </label>
        <select
          className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
          value={orderForm.creditLineId}
          onChange={(e) => setOrderForm(f => ({ ...f, creditLineId: e.target.value }))}>
          <option value="">— Selecciona línea —</option>
          {(supplierCreditLines as any[])?.map((l: any) => {
            const available = Number(l.balance?.available ?? l.creditLimit);
            const disabled  = available <= 0;
            return (
              <option key={l.id} value={l.id} disabled={disabled}>
                {disabled
                  ? `Sin disponible (Límite RD$${Number(l.creditLimit).toLocaleString('es-DO')})`
                  : `Límite RD$${Number(l.creditLimit).toLocaleString('es-DO')} · Disponible RD$${available.toLocaleString('es-DO')}`}
              </option>
            );
          })}
        </select>
        {!supplierCreditLines?.length && (
          <p className="text-xs text-gray-400 mt-1 font-['DM_Sans']">
            Este suplidor no tiene líneas de crédito activas.
          </p>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Pasar creditLineId al create mutation**

Busca donde se llama `createMutation.mutate(...)` o `paymentOrdersApi.create(...)`. Agregar `creditLineId: useCreditLine && orderForm.creditLineId ? orderForm.creditLineId : undefined` al objeto de datos.

- [ ] **Step 6: Resetear en closeModal o al limpiar el formulario**

Busca donde se resetea el formulario (probablemente `setOrderForm(EMPTY_ORDER)` o similar). Agregar después:

```typescript
setUseCreditLine(false);
```

- [ ] **Step 7: Verificar build**

```bash
pnpm build:frontend
```

Expected: `✓ built` sin errores TypeScript.

- [ ] **Step 8: Commit y push**

```bash
git add apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
git commit -m "feat: link payment order to supplier credit line in form"
git push origin main
```
