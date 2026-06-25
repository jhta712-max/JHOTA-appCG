# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que todas las páginas de SERVINGMI se vean y funcionen correctamente en móvil (≥320px), tablet (≥768px) y desktop (≥1024px).

**Architecture:** El patrón central es: las tablas con muchas columnas se convierten en tarjetas apiladas en móvil (`hidden md:block` para la tabla, `md:hidden` para las tarjetas). Los hero headers escalan con breakpoints Tailwind. Los formularios usan columna única en móvil y grid en desktop.

**Tech Stack:** React 18, Vite, TailwindCSS 3, sin librerías adicionales. Breakpoints: `sm` = 640px, `md` = 768px, `lg` = 1024px.

---

## Breakpoints de referencia (usar en todo el plan)

| Dispositivo | Breakpoint Tailwind | Ancho mínimo |
|---|---|---|
| Móvil | (base) | 320px |
| Tablet | `md:` | 768px |
| Desktop | `lg:` | 1024px |

## Patrón tabla→tarjeta (reutilizar en todas las tareas)

```tsx
{/* TABLA — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  <table>...</table>
</div>

{/* TARJETAS — solo móvil */}
<div className="md:hidden space-y-3">
  {items.map(item => (
    <div key={item.id} className="bg-white border border-gray-200 p-4">
      <div className="flex justify-between items-start">
        <span className="font-['Barlow_Condensed'] font-bold text-lg">{item.name}</span>
        <span className="font-['Space_Mono'] text-sm">{item.amount}</span>
      </div>
      {/* campos secundarios */}
      <div className="mt-2 text-sm text-gray-500 font-['DM_Sans'] space-y-1">
        <p>Campo: {item.field}</p>
      </div>
    </div>
  ))}
</div>
```

## Patrón hero header responsive (reutilizar en todas las tareas)

```tsx
{/* ANTES */}
<h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">

{/* DESPUÉS */}
<h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">
```

## Patrón hero band con padding responsive

```tsx
{/* ANTES */}
<div className="bg-[#1C1C1C] px-6 py-5">

{/* DESPUÉS */}
<div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5">
```

## Patrón formulario responsive (2 columnas en desktop, 1 en móvil)

```tsx
{/* ANTES */}
<div className="grid grid-cols-2 gap-4">

{/* DESPUÉS */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

---

## Task 1: Layout — sidebar tablet y header móvil

**Files:**
- Modify: `apps/frontend/src/components/layout/Layout.tsx`

El sidebar actual usa `md:` como breakpoint (768px). En tablets (768-1023px) el sidebar visible ocupa el 31% del ancho. Mejorar a `lg:` para que tablets usen drawer móvil también.

- [ ] **Step 1: Cambiar breakpoint del sidebar de `md:` a `lg:`**

Buscar y reemplazar todas las ocurrencias en Layout.tsx:
- `hidden md:flex` → `hidden lg:flex` (aside del sidebar desktop)
- `md:ml-60` → `lg:ml-60` (contenido principal)
- `md:hidden` → `lg:hidden` (header móvil y drawer)

```tsx
// aside del sidebar — línea ~370
<aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-[#1C1C1C] z-30">

// main content — línea ~450
<div className="lg:ml-60 flex flex-col min-h-screen">

// header móvil — línea ~460  
<header className="lg:hidden sticky top-0 z-20 bg-[#1C1C1C] px-4 py-3 flex items-center justify-between border-b border-white/10">

// drawer overlay — línea ~480
<div className={clsx("lg:hidden fixed inset-0 z-40", sidebarOpen ? "block" : "hidden")}>
```

- [ ] **Step 2: Ajustar padding del contenido principal en móvil**

```tsx
// Wrapper de página — aplicar en cada página individualmente (ver tareas siguientes)
// El main wrapper debe tener padding reducido en móvil
<main className="flex-1 overflow-y-auto">
```

- [ ] **Step 3: Verificar build**

```bash
pnpm build:frontend
```
Expected: sin errores TypeScript ni Vite.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/layout/Layout.tsx
git commit -m "feat(responsive): sidebar usa lg: breakpoint — tablet usa drawer móvil"
```

---

## Task 2: DashboardPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/dashboard/DashboardPage.tsx`

- [ ] **Step 1: Hero header y KPI grid**

Localizar el hero band (buscar `bg-\[#1C1C1C\]` near top) y el grid de KPI cards.

```tsx
{/* Hero — reducir padding y texto en móvil */}
<div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5">
  <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight">
    DASHBOARD
  </h1>
</div>

{/* KPI grid — era grid-cols-2 md:grid-cols-3 lg:grid-cols-5 */}
{/* Mantener 2 cols en móvil pero reducir gap y padding de cards */}
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 p-4 md:p-6">
```

- [ ] **Step 2: Tabla de portfolio — aplicar patrón tabla→tarjeta**

Buscar la tabla de proyectos (columnas: Proyecto, Presupuesto, Gastado, %, Estado). Envolver tabla en `hidden md:block` y añadir tarjetas móvil:

```tsx
{/* Tabla portfolio — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  <table>{/* código existente de la tabla sin cambios */}</table>
</div>

{/* Tarjetas portfolio — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {projects.map(p => (
    <div key={p.id} className="p-4">
      <div className="flex justify-between items-start mb-2">
        <span className="font-['Barlow_Condensed'] font-bold text-base uppercase">{p.name}</span>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono']", statusClass(p.status))}>
          {p.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Presupuesto</p>
          <p className="font-['Space_Mono']">{fmt(p.budgetEstimated)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Gastado</p>
          <p className="font-['Space_Mono']">{fmt(p.totalExpenses)}</p>
        </div>
      </div>
      {/* barra de progreso */}
      <div className="mt-2 h-1.5 bg-gray-100">
        <div className="h-1.5 bg-[#F5C218]" style={{ width: `${Math.min(p.pct, 100)}%` }} />
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Tabla de créditos — aplicar patrón tabla→tarjeta**

Buscar tabla de líneas de crédito (columnas: Suplidor, Límite, Consumido, Pendiente, Disponible).

```tsx
{/* Tabla créditos — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente sin cambios */}
</div>

{/* Tarjetas créditos — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {creditLines.map(cl => (
    <div key={cl.id} className="p-4">
      <p className="font-['Barlow_Condensed'] font-bold text-base uppercase mb-2">{cl.supplier?.name}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Límite</p>
          <p className="font-['Space_Mono']">{fmt(cl.creditLimit)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Disponible</p>
          <p className="font-['Space_Mono'] text-green-600">{fmt(cl.available)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Consumido</p>
          <p className="font-['Space_Mono']">{fmt(cl.consumed)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Pendiente</p>
          <p className="font-['Space_Mono'] text-red-600">{fmt(cl.pending)}</p>
        </div>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(responsive): DashboardPage — hero, KPI grid, tablas portfolio y créditos"
```

---

## Task 3: ExpensesPage + NewExpensePage + EditExpensePage responsive

**Files:**
- Modify: `apps/frontend/src/pages/expenses/ExpensesPage.tsx`
- Modify: `apps/frontend/src/pages/expenses/NewExpensePage.tsx`
- Modify: `apps/frontend/src/pages/expenses/EditExpensePage.tsx`

- [ ] **Step 1: ExpensesPage — hero y filtros**

```tsx
{/* Hero */}
<div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5">
  <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl ...">GASTOS</h1>
</div>

{/* Filtros — era grid-cols-2 sm:grid-cols-4 */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 md:p-6">
```

- [ ] **Step 2: ExpensesPage — tabla→tarjetas**

La tabla tiene columnas: Fecha, NCF, Proveedor, Categoría, Monto, Estado, Acciones.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {expenses.map(exp => (
    <div key={exp.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{exp.supplier?.name ?? exp.supplierName}</p>
          <p className="font-['Space_Mono'] text-xs text-gray-400 mt-0.5">{exp.ncf ?? '—'}</p>
        </div>
        <p className="font-['Space_Mono'] text-base font-bold">{fmt(exp.amount, exp.currency)}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500 font-['DM_Sans']">
          {exp.category?.name} · {new Date(exp.expenseDate).toLocaleDateString('es-DO')}
        </span>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono']", statusBadge(exp.status))}>
          {exp.status}
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        <Link to={`/expenses/${exp.id}`} className="text-xs text-[#F5C218] font-['DM_Sans']">Ver detalle →</Link>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: NewExpensePage / EditExpensePage — formularios en columna única móvil**

Buscar todos los `grid grid-cols-2` en ambos archivos y convertir a `grid grid-cols-1 md:grid-cols-2`.

```tsx
{/* Antes */}
<div className="grid grid-cols-2 gap-4">
{/* Después */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

También reducir padding del contenedor principal:
```tsx
{/* Antes */}
<div className="p-6">
{/* Después */}
<div className="p-4 md:p-6">
```

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/expenses/
git commit -m "feat(responsive): Expenses — filtros, tabla→tarjetas, formularios móvil"
```

---

## Task 4: ProjectsPage + ProjectDetailPage + ProjectFormPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectsPage.tsx`
- Modify: `apps/frontend/src/pages/projects/ProjectDetailPage.tsx`
- Modify: `apps/frontend/src/pages/projects/ProjectFormPage.tsx`

- [ ] **Step 1: ProjectsPage — hero y tabla→tarjetas**

Tabla de proyectos: Nombre, Estado, Presupuesto, Gastado, Fecha inicio.

```tsx
{/* Hero */}
<h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl ...">PROYECTOS</h1>

{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {projects.map(p => (
    <Link key={p.id} to={`/projects/${p.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start mb-1">
        <span className="font-['Barlow_Condensed'] font-bold text-base uppercase leading-tight">{p.name}</span>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono'] shrink-0 ml-2", statusClass(p.status))}>
          {p.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Presupuesto</p>
          <p className="font-['Space_Mono']">{fmt(p.budgetEstimated)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Gastado</p>
          <p className="font-['Space_Mono']">{fmt(p.totalExpenses)}</p>
        </div>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 2: ProjectDetailPage — tabs y secciones**

Las tabs de detalle de proyecto deben ser scrollables en móvil:

```tsx
{/* Tabs — scroll horizontal en móvil */}
<div className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide">
  {tabs.map(tab => (
    <button key={tab} className="shrink-0 px-4 py-3 text-sm ...">
      {tab}
    </button>
  ))}
</div>
```

Las tablas dentro del detalle (gastos, nóminas, anticipos) aplican el mismo patrón tabla→tarjeta.

- [ ] **Step 3: ProjectFormPage — formulario responsive**

```tsx
{/* Todos los grid de 2 columnas */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

{/* Padding del contenedor */}
<div className="p-4 md:p-6">
```

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/projects/
git commit -m "feat(responsive): Projects — lista tarjetas, detalle tabs scroll, formulario"
```

---

## Task 5: PayrollsPage + PayrollDetailPage + PayrollFormPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/payroll/PayrollsPage.tsx`
- Modify: `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx`
- Modify: `apps/frontend/src/pages/payroll/PayrollFormPage.tsx`

- [ ] **Step 1: PayrollsPage — tabla→tarjetas**

Tabla tiene 7 columnas: Período, Proyecto, Empleados, Bruto, Descuentos, Neto, Estado.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {payrolls.map(p => (
    <Link key={p.id} to={`/payrolls/${p.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{p.period}</p>
          <p className="text-xs text-gray-500 font-['DM_Sans'] mt-0.5">{p.project?.name ?? '—'}</p>
        </div>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono']", statusBadge(p.status))}>
          {p.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Bruto</p>
          <p className="font-['Space_Mono'] text-sm">{fmt(p.grossAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Desc.</p>
          <p className="font-['Space_Mono'] text-sm">{fmt(p.totalDeductions)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Neto</p>
          <p className="font-['Space_Mono'] text-sm font-bold">{fmt(p.netAmount)}</p>
        </div>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 2: PayrollDetailPage — tabla de líneas responsive**

Tabla de líneas (empleados): Nombre, Cargo, Bruto, Descuentos, Neto.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {lines.map(line => (
    <div key={line.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold">{line.employeeName}</p>
          <p className="text-xs text-gray-500">{line.position}</p>
        </div>
        <p className="font-['Space_Mono'] font-bold">{fmt(line.netAmount)}</p>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span>Bruto: <span className="font-['Space_Mono']">{fmt(line.grossAmount)}</span></span>
        <span>Desc: <span className="font-['Space_Mono']">{fmt(line.totalDeductions)}</span></span>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: PayrollFormPage — formulario responsive**

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="p-4 md:p-6">
```

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/payroll/
git commit -m "feat(responsive): Payrolls — lista tarjetas, detalle líneas, formulario"
```

---

## Task 6: SuppliersPage + SupplierDetailPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/suppliers/SuppliersPage.tsx`
- Modify: `apps/frontend/src/pages/suppliers/SupplierDetailPage.tsx`

- [ ] **Step 1: SuppliersPage — tabla→tarjetas**

Tabla: Nombre, RNC, Tipo, Banco, Estado.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {suppliers.map(s => (
    <Link key={s.id} to={`/suppliers/${s.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{s.name}</p>
          <p className="font-['Space_Mono'] text-xs text-gray-400 mt-0.5">{s.rnc ?? '—'}</p>
        </div>
        <span className={clsx("text-xs px-2 py-0.5", s.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {s.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1 font-['DM_Sans']">{s.supplierType} · {s.bank ?? '—'}</p>
    </Link>
  ))}
</div>
```

- [ ] **Step 2: SupplierDetailPage — 4 tablas con patrón tabla→tarjeta**

Aplicar el patrón a cada sección:
1. **Cuentas bancarias** (Banco, Tipo, Número, Por defecto)
2. **Líneas de crédito** (Descripción, Límite, Consumido, Disponible)
3. **Pagos de crédito** (Fecha, Monto, Descripción)
4. **Historial de gastos** (Fecha, NCF, Categoría, Monto, Estado)

Para cada tabla: `<div className="hidden md:block ...">tabla</div>` + `<div className="md:hidden ...">tarjetas</div>`.

Los resúmenes financieros en la parte superior (grid de KPIs del proveedor) cambiar de `grid-cols-3` a `grid grid-cols-2 md:grid-cols-3`.

- [ ] **Step 3: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/suppliers/
git commit -m "feat(responsive): Suppliers — lista y 4 tablas de detalle"
```

---

## Task 7: PaymentOrdersPage + PendingOrdersPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`
- Modify: `apps/frontend/src/pages/payment-orders/PendingOrdersPage.tsx`

- [ ] **Step 1: PaymentOrdersPage — tabla→tarjetas**

Tabla: Referencia, Suplidor, Monto, Banco destino, Estado, Fecha.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {orders.map(o => (
    <div key={o.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Space_Mono'] text-xs text-[#F5C218]">{o.referenceNumber}</p>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase mt-0.5">{o.supplier?.name}</p>
        </div>
        <p className="font-['Space_Mono'] font-bold text-base">{fmt(o.amount, o.currency)}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500 font-['DM_Sans']">{o.bankAccount?.bank ?? '—'}</p>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono']", statusBadge(o.status))}>
          {o.status}
        </span>
      </div>
      <div className="flex gap-3 mt-3">
        <button onClick={() => openEdit(o)} className="text-xs text-[#F5C218]">Editar</button>
        {o.status === 'PENDING' && (
          <button onClick={() => openMarkPaid(o)} className="text-xs text-green-600">Marcar Pagada</button>
        )}
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: PendingOrdersPage — mismo patrón**

Tabla pendientes tiene columnas similares. Aplicar mismo patrón tabla→tarjeta.

- [ ] **Step 3: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/payment-orders/
git commit -m "feat(responsive): PaymentOrders — tabla→tarjetas en lista y pendientes"
```

---

## Task 8: QuotationsPage + QuotationDetailPage + QuotationFormPage responsive

**Files:**
- Modify: `apps/frontend/src/pages/quotations/QuotationsPage.tsx`
- Modify: `apps/frontend/src/pages/quotations/QuotationDetailPage.tsx`
- Modify: `apps/frontend/src/pages/quotations/QuotationFormPage.tsx`

- [ ] **Step 1: QuotationsPage — tabla→tarjetas**

Tabla: Número, Proveedor, Monto, Moneda, Estado, Vencimiento.

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {quotations.map(q => (
    <Link key={q.id} to={`/quotations/${q.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Space_Mono'] text-xs text-[#F5C218]">{q.quotationNumber}</p>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{q.supplierName}</p>
        </div>
        <p className="font-['Space_Mono'] font-bold">{fmt(q.totalAmount, q.currency)}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-500">{q.expirationDate ? new Date(q.expirationDate).toLocaleDateString('es-DO') : '—'}</p>
        <span className={clsx("text-xs px-2 py-0.5", statusBadge(q.status))}>{q.status}</span>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 2: QuotationDetailPage — tabs scroll + tabla de pagos**

```tsx
{/* Tabs scrollables en móvil */}
<div className="flex overflow-x-auto border-b border-gray-200">
  {/* tabs existentes con shrink-0 */}
</div>

{/* Tabla de pagos → tarjetas móvil */}
{/* Tabla de items → tarjetas móvil */}
```

- [ ] **Step 3: QuotationFormPage — formulario**

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="p-4 md:p-6">
```

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/quotations/
git commit -m "feat(responsive): Quotations — lista, detalle y formulario responsive"
```

---

## Task 9: AdminPayrolls + AdminEmployees responsive

**Files:**
- Modify: `apps/frontend/src/pages/admin-payroll/AdminPayrollsPage.tsx`
- Modify: `apps/frontend/src/pages/admin-payroll/AdminPayrollDetailPage.tsx`
- Modify: `apps/frontend/src/pages/admin-payroll/AdminPayrollFormPage.tsx`
- Modify: `apps/frontend/src/pages/admin-payroll/AdminEmployeesPage.tsx`
- Modify: `apps/frontend/src/pages/admin-payroll/AdminEmployeeDetailPage.tsx`

- [ ] **Step 1: AdminPayrollsPage — tabla→tarjetas**

```tsx
{/* Tabla — solo desktop */}
<div className="hidden md:block overflow-x-auto">
  {/* tabla existente */}
</div>

{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {payrolls.map(p => (
    <Link key={p.id} to={`/admin-payrolls/${p.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{p.periodLabel}</p>
          <p className="text-xs text-gray-500">{p.frequency} · {p.employeeCount} empleados</p>
        </div>
        <span className={clsx("text-xs px-2 py-0.5 font-['Space_Mono']", statusBadge(p.status))}>{p.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Bruto</p>
          <p className="font-['Space_Mono'] text-sm">{fmt(p.grossAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-['Barlow_Condensed'] uppercase">Neto</p>
          <p className="font-['Space_Mono'] text-sm font-bold">{fmt(p.netAmount)}</p>
        </div>
      </div>
    </Link>
  ))}
</div>
```

- [ ] **Step 2: AdminEmployeesPage — tabla→tarjetas**

Tabla: Nombre, Cargo, Departamento, Salario, Estado.

```tsx
{/* Tarjetas — solo móvil */}
<div className="md:hidden divide-y divide-gray-100">
  {employees.map(e => (
    <Link key={e.id} to={`/admin-employees/${e.id}`} className="block p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-['Barlow_Condensed'] font-bold text-base uppercase">{e.name}</p>
          <p className="text-xs text-gray-500">{e.position} · {e.department}</p>
        </div>
        <p className="font-['Space_Mono'] text-sm">{fmt(e.baseSalary)}</p>
      </div>
      <span className={clsx("mt-2 inline-block text-xs px-2 py-0.5", e.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
        {e.status}
      </span>
    </Link>
  ))}
</div>
```

- [ ] **Step 3: AdminPayrollDetailPage + AdminEmployeeDetailPage — tablas internas**

Aplicar patrón tabla→tarjeta a las tablas de líneas de nómina y al historial salarial en el detalle del empleado.

- [ ] **Step 4: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/admin-payroll/
git commit -m "feat(responsive): AdminPayrolls y AdminEmployees — tablas→tarjetas"
```

---

## Task 10: Páginas restantes (OfficeExpenses, ContratosAjustados, CardsPage, CategoriesPage, UsersPage, AiUsagePage)

**Files:**
- Modify: `apps/frontend/src/pages/office-expenses/OfficeExpensesPage.tsx`
- Modify: `apps/frontend/src/pages/contratos-ajustados/ContratosAjustadosPage.tsx`
- Modify: `apps/frontend/src/pages/admin/CardsPage.tsx`
- Modify: `apps/frontend/src/pages/categories/CategoriesPage.tsx`
- Modify: `apps/frontend/src/pages/users/UsersPage.tsx`
- Modify: `apps/frontend/src/pages/ai-usage/AiUsagePage.tsx`

- [ ] **Step 1: Aplicar patrón tabla→tarjeta a cada página**

Para cada archivo, el patrón es idéntico:
1. Envolver `<table>` existente en `<div className="hidden md:block overflow-x-auto">`
2. Añadir `<div className="md:hidden divide-y divide-gray-100">` con tarjetas mostrando los campos más importantes
3. Cambiar hero header a `text-3xl md:text-5xl`
4. Cambiar padding del contenedor a `px-4 md:px-6 py-4 md:py-5`

**OfficeExpenses** — Tarjeta muestra: Fecha, Descripción, Proveedor, Monto, Estado
**ContratosAjustados** — Tarjeta muestra: Número contrato, Proyecto, Monto ajustado, Estado
**CardsPage** — Tarjeta muestra: Nombre tarjeta, Número, Banco, Límite, Disponible
**CategoriesPage** — Tarjeta muestra: Nombre categoría, Sistema/Custom, Activa
**UsersPage** — Tarjeta muestra: Nombre, Email, Rol, Estado
**AiUsagePage** — Los KPI cards ya usan grid responsive; las tablas by-feature y by-user aplican patrón

- [ ] **Step 2: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/office-expenses/ apps/frontend/src/pages/contratos-ajustados/ apps/frontend/src/pages/admin/ apps/frontend/src/pages/categories/ apps/frontend/src/pages/users/ apps/frontend/src/pages/ai-usage/
git commit -m "feat(responsive): páginas restantes — OfficeExpenses, Contratos, Cards, Categories, Users, AiUsage"
```

---

## Task 11: FormModal y componentes compartidos responsive

**Files:**
- Modify: `apps/frontend/src/components/ui/FormModal.tsx`

Los modales en móvil deben ocupar toda la pantalla (bottom sheet o full screen), no el centro flotante con `max-w-lg`.

- [ ] **Step 1: FormModal — full screen en móvil**

```tsx
{/* Overlay */}
<div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4">
  {/* Modal */}
  <div className="w-full md:max-w-lg md:w-full bg-white flex flex-col max-h-screen md:max-h-[90vh]">
    {/* Header — sin cambios */}
    <div className="bg-[#1C1C1C] px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
      ...
    </div>
    {/* Body — scrollable */}
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {children}
    </div>
    {/* Footer con botones */}
    <div className="shrink-0 border-t border-gray-200 px-4 md:px-6 py-4 flex justify-end gap-3">
      ...
    </div>
  </div>
</div>
```

Esto hace que en móvil el modal suba desde abajo (bottom sheet) y en desktop aparece centrado como antes.

- [ ] **Step 2: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/components/ui/FormModal.tsx
git commit -m "feat(responsive): FormModal — bottom sheet en móvil, centrado en desktop"
```

---

## Task 12: LoginPage y páginas de auth responsive

**Files:**
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: LoginPage — ajustar padding y ancho del formulario**

```tsx
{/* Wrapper — padding reducido en móvil */}
<div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center px-4">
  {/* Card del formulario */}
  <div className="w-full max-w-md bg-white p-6 md:p-8">
    {/* Logo/título */}
    <h1 className="font-['Barlow_Condensed'] text-4xl md:text-5xl font-bold uppercase">SERVINGMI</h1>
    ...
  </div>
</div>
```

- [ ] **Step 2: Build y commit**

```bash
pnpm build:frontend
git add apps/frontend/src/pages/auth/
git commit -m "feat(responsive): LoginPage y auth — formulario responsive en móvil"
```

---

## Verificación final

- [ ] **Abrir en Chrome DevTools en modo responsive** y verificar:
  - 375px (iPhone SE): sidebar oculto, drawer funciona, tablas muestran tarjetas, formularios en columna única
  - 768px (iPad): sidebar oculto (drawer), tablas muestran tabla completa
  - 1024px+: sidebar visible, layout desktop completo

- [ ] **Commit final**

```bash
git add .
git commit -m "feat: responsive design completo — móvil, tablet y desktop"
git push origin main
```
