# Express Suppliers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "express suppliers" — one-time vendors created instantly during payment order creation with only name + bank info required and optional additional fields.

**Architecture:** Add `isExpress Boolean` to `Supplier` schema. Backend accepts `isExpress` on create and filters by it on list. Frontend extends `QuickCreateSupplierModal` with an `express` mode (simplified fields + collapsible extras), adds an `⚡ Express` button alongside `+ Registrado` in PaymentOrdersPage, adds an Express tab to SuppliersPage, and marks express suppliers with `⚡` in dropdowns.

**Tech Stack:** Prisma ORM, PostgreSQL, Express/TypeScript backend, React 18 + TanStack Query + Zustand frontend, Zod validation.

---

## File Map

### Create
- `apps/backend/prisma/migrations/20260617000002_add_is_express_to_suppliers/migration.sql`

### Modify
- `apps/backend/prisma/schema.prisma` — add `isExpress` field to `Supplier`
- `apps/backend/src/modules/suppliers/suppliers.schema.ts` — add `isExpress` to `createSupplierSchema`
- `apps/backend/src/modules/suppliers/suppliers.service.ts` — filter by `isExpress` in `listSuppliers`
- `apps/backend/src/modules/suppliers/suppliers.controller.ts` — pass `isExpress` query param to `listSuppliers`
- `apps/frontend/src/api/index.ts` — add `isExpress` to `suppliersApi.list` params
- `apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx` — add `mode` prop + express UI
- `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` — split `+ Nuevo` into `+ Registrado` / `⚡ Express`
- `apps/frontend/src/pages/suppliers/SuppliersPage.tsx` — add Express tab

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260617000002_add_is_express_to_suppliers/migration.sql`

- [ ] **Step 1: Add `isExpress` field to Supplier model**

  In `apps/backend/prisma/schema.prisma`, find the `Supplier` model. After the `isActive` line, add:

  ```prisma
  isExpress Boolean  @default(false) @map("is_express")
  ```

- [ ] **Step 2: Regenerate Prisma client**

  ```bash
  cd /home/user/servingmi-appCG && pnpm --filter backend db:generate
  ```

  Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Create migration SQL**

  Create file `apps/backend/prisma/migrations/20260617000002_add_is_express_to_suppliers/migration.sql`:

  ```sql
  ALTER TABLE "suppliers" ADD COLUMN "is_express" BOOLEAN NOT NULL DEFAULT false;
  ```

- [ ] **Step 4: Build backend**

  ```bash
  pnpm build:backend 2>&1 | tail -10
  ```

  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/prisma/schema.prisma \
          apps/backend/prisma/migrations/20260617000002_add_is_express_to_suppliers/ \
          apps/backend/src/generated/
  git commit -m "feat(schema): add isExpress field to Supplier"
  ```

---

## Task 2: Backend — schema validation + service + controller

**Files:**
- Modify: `apps/backend/src/modules/suppliers/suppliers.schema.ts`
- Modify: `apps/backend/src/modules/suppliers/suppliers.service.ts`
- Modify: `apps/backend/src/modules/suppliers/suppliers.controller.ts`

- [ ] **Step 1: Add `isExpress` to Zod create schema**

  In `apps/backend/src/modules/suppliers/suppliers.schema.ts`, find `createSupplierSchema` and add:

  ```typescript
  isExpress: z.boolean().optional().default(false),
  ```

  Also update the `CreateSupplierInput` type export if it exists (it's inferred from the schema via `z.infer` — no manual change needed if that's the case).

- [ ] **Step 2: Add `isExpress` filter to `listSuppliers`**

  In `apps/backend/src/modules/suppliers/suppliers.service.ts`, find `listSuppliers`:

  ```typescript
  // Current signature (approximate):
  export async function listSuppliers(search?: string, onlyActive = false, projectId?: string)
  ```

  Change to:
  ```typescript
  export async function listSuppliers(search?: string, onlyActive = false, projectId?: string, isExpress?: boolean)
  ```

  In the `where` clause, add:
  ```typescript
  // Add after existing conditions:
  ...(isExpress !== undefined ? { isExpress } : { isExpress: false }),
  ```

  This means: by default (no `isExpress` param), only registered suppliers are returned. Pass `isExpress: true` to get express-only.

- [ ] **Step 3: Pass `isExpress` from controller**

  In `apps/backend/src/modules/suppliers/suppliers.controller.ts`, find the `list` handler. It currently reads `search`, `onlyActive`, `projectId` from `req.query`. Add:

  ```typescript
  const isExpress = req.query.isExpress === 'true' ? true : req.query.isExpress === 'false' ? false : undefined;
  ```

  Pass it to `listSuppliers`: `await service.listSuppliers(search, onlyActive, projectId, isExpress)`

- [ ] **Step 4: Build**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:backend 2>&1 | tail -10
  ```

  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/suppliers.schema.ts \
          apps/backend/src/modules/suppliers/suppliers.service.ts \
          apps/backend/src/modules/suppliers/suppliers.controller.ts
  git commit -m "feat(suppliers): add isExpress filter to list and create"
  ```

---

## Task 3: Frontend API update

**Files:**
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Add `isExpress` to `suppliersApi.list` params**

  Find `suppliersApi.list` in `apps/frontend/src/api/index.ts`:

  ```typescript
  // Current:
  list: (params?: { search?: string; onlyActive?: boolean; projectId?: string }) =>
  
  // Change to:
  list: (params?: { search?: string; onlyActive?: boolean; projectId?: string; isExpress?: boolean }) =>
  ```

- [ ] **Step 2: Add `isExpress` to the `Supplier` type**

  Find where `Supplier` type is defined (likely in `apps/frontend/src/types/index.ts` or inline). Add:
  ```typescript
  isExpress: boolean;
  ```

- [ ] **Step 3: Build frontend**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:frontend 2>&1 | tail -10
  ```

  Expected: build passes (possible TypeScript warnings if `isExpress` is missing from the type — fix those).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/frontend/src/api/index.ts apps/frontend/src/types/
  git commit -m "feat(api): add isExpress param to suppliersApi.list"
  ```

---

## Task 4: QuickCreateSupplierModal — express mode

**Files:**
- Modify: `apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx`

This task adds a `mode: 'registered' | 'express'` prop. In `express` mode: name + bank fields are shown upfront; an optional "Datos adicionales" section (collapsed by default) holds RNC/cédula, phone, email, notes. The supplier is created with `isExpress: true`.

- [ ] **Step 1: Read the current modal**

  Read `apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx` to understand the exact form state, submit handler, and JSX structure before making changes.

- [ ] **Step 2: Add `mode` prop and collapsible state**

  Change the props interface:
  ```typescript
  interface QuickCreateSupplierModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: (supplier: { id: string; name: string }) => void;
    mode?: 'registered' | 'express'; // default: 'registered'
  }
  ```

  Inside the component, add:
  ```typescript
  const isExpress = (mode ?? 'registered') === 'express';
  const [showExtra, setShowExtra] = useState(false);
  ```

- [ ] **Step 3: Update submit handler to pass `isExpress`**

  Find the call to `suppliersApi.create(...)`. Add `isExpress` to the payload:

  ```typescript
  // Find the create call and add isExpress:
  await suppliersApi.create({
    name,
    rnc: rnc || null,
    // ... existing fields ...
    isExpress,
  });
  ```

- [ ] **Step 4: Restructure JSX for express mode**

  In express mode the form shows:
  1. **Name** (always first, required)
  2. **Bank fields** (bank, accountType, accountNumber) — shown upfront in express mode, same as registered
  3. **"Datos adicionales" toggle** — only in express mode, collapsible

  Replace (or conditionally render) the RNC section:

  ```tsx
  {/* In express mode: show name first, then bank, then collapsible extras */}
  {/* In registered mode: keep existing order */}

  {isExpress && (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 font-['DM_Sans'] hover:text-gray-700"
      >
        {showExtra ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Datos adicionales (opcional)
      </button>
      {showExtra && (
        <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
          {/* RNC field */}
          {/* Cédula field */}
          {/* Phone field */}
          {/* Email field */}
          {/* Notes field */}
        </div>
      )}
    </div>
  )}
  ```

  Use the existing field JSX from the registered mode — just move them inside the collapsible section for express mode.

  Add `ChevronUp`, `ChevronDown` to the lucide-react import if not already present.

- [ ] **Step 5: Update the modal title**

  Show different title based on mode:
  ```tsx
  title={isExpress ? 'Nuevo Suplidor Express' : 'Nuevo Suplidor'}
  ```

- [ ] **Step 6: Build**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:frontend 2>&1 | tail -10
  ```

  Fix any TypeScript errors.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/frontend/src/components/suppliers/QuickCreateSupplierModal.tsx
  git commit -m "feat(suppliers): add express mode to QuickCreateSupplierModal"
  ```

---

## Task 5: PaymentOrdersPage — split `+ Nuevo` into two buttons

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

- [ ] **Step 1: Add `quickCreateMode` state**

  Find where `quickCreateOpen` state is declared. Add alongside it:
  ```typescript
  const [quickCreateMode, setQuickCreateMode] = useState<'registered' | 'express'>('registered');
  ```

- [ ] **Step 2: Replace the single `+ Nuevo` button with two buttons**

  Find the current `+ Nuevo` button that calls `setQuickCreateOpen(true)`. Replace with:

  ```tsx
  <button
    type="button"
    onClick={() => { setQuickCreateMode('registered'); setQuickCreateOpen(true); }}
    className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 font-bold uppercase font-['Barlow_Condensed'] hover:border-gray-500"
  >
    + Registrado
  </button>
  <button
    type="button"
    onClick={() => { setQuickCreateMode('express'); setQuickCreateOpen(true); }}
    className="text-xs border border-[#F5C218] text-[#F5C218] px-3 py-1.5 font-bold uppercase font-['Barlow_Condensed'] hover:bg-[#F5C218] hover:text-[#1C1C1C] transition-colors"
  >
    ⚡ Express
  </button>
  ```

- [ ] **Step 3: Pass `mode` to `QuickCreateSupplierModal`**

  Find `<QuickCreateSupplierModal` in the JSX. Add the `mode` prop:

  ```tsx
  <QuickCreateSupplierModal
    open={quickCreateOpen}
    onClose={() => setQuickCreateOpen(false)}
    onCreated={(s) => { /* existing handler */ }}
    mode={quickCreateMode}
  />
  ```

- [ ] **Step 4: Mark express suppliers with ⚡ in the dropdown**

  Find where supplier options are rendered in the dropdown (the `<option>` elements inside the supplier `<select>`). Change the display name:

  ```tsx
  // Current:
  <option key={s.id} value={s.id}>{s.name}</option>

  // Change to:
  <option key={s.id} value={s.id}>{s.isExpress ? `⚡ ${s.name}` : s.name}</option>
  ```

  Note: the suppliers query uses `suppliersApi.list({ onlyActive: true })` which now defaults to `isExpress: false` (registered only). To include express suppliers in the dropdown, update the query:

  ```typescript
  // Find the query that fetches active suppliers with bank accounts
  // Change to fetch both registered and express:
  queryFn: () => {
    const projectId = orderForm.projectId || undefined;
    if (!isAdmin && projectId) {
      return suppliersApi.list({ onlyActive: true, projectId });
    }
    return suppliersApi.list({ onlyActive: true });
  },
  ```

  But the backend now defaults to `isExpress: false`. We need to explicitly pass no `isExpress` filter (undefined) to get ALL suppliers regardless of express flag. Check `listSuppliers` in the backend: when `isExpress` is `undefined`, it should return ALL suppliers (registered + express).

  **Update the backend `listSuppliers` default behavior**: The condition should be:
  - `isExpress === true` → only express
  - `isExpress === false` → only registered
  - `isExpress === undefined` → ALL (both)

  This means the `SuppliersPage` passes `isExpress=false` explicitly to get only registered, and the payment order dropdown passes nothing (undefined) to get both.

  Go back to `apps/backend/src/modules/suppliers/suppliers.service.ts` and update the where clause:
  ```typescript
  // Change from:
  ...(isExpress !== undefined ? { isExpress } : { isExpress: false }),
  // To:
  ...(isExpress !== undefined ? { isExpress } : {}),
  ```

  And update `apps/backend/src/modules/suppliers/suppliers.controller.ts` — the `list` handler default stays `undefined` (no change needed there).

  And update `apps/frontend/src/pages/suppliers/SuppliersPage.tsx` to explicitly pass `isExpress=false` for the "Activos" tab (done in Task 6).

- [ ] **Step 5: Build**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:backend 2>&1 | tail -5
  cd /home/user/servingmi-appCG && pnpm build:frontend 2>&1 | tail -5
  ```

  Both must pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/suppliers.service.ts \
          apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
  git commit -m "feat(payment-orders): add Express supplier button and ⚡ badge in dropdown"
  ```

---

## Task 6: SuppliersPage — Express tab

**Files:**
- Modify: `apps/frontend/src/pages/suppliers/SuppliersPage.tsx`

- [ ] **Step 1: Read the current SuppliersPage**

  Read `apps/frontend/src/pages/suppliers/SuppliersPage.tsx` to understand the current tab/filter state and query structure.

- [ ] **Step 2: Add `activeTab` state**

  Find the existing state declarations. Add:
  ```typescript
  const [activeTab, setActiveTab] = useState<'registered' | 'express'>('registered');
  ```

- [ ] **Step 3: Update the suppliers query to filter by tab**

  Find the query that calls `suppliersApi.list(...)`. Update `queryKey` and `queryFn` to include the tab:

  ```typescript
  queryKey: ['suppliers', debouncedSearch, activeTab],
  queryFn: () => suppliersApi.list({
    search: debouncedSearch || undefined,
    isExpress: activeTab === 'express',
  }),
  ```

  Note: for the `express` tab, `onlyActive` is NOT passed (express suppliers show regardless of isActive to allow managing them). For the `registered` tab, keep whatever `onlyActive` behavior exists currently.

- [ ] **Step 4: Add tab switcher JSX**

  Find where the search input or filter bar is in the JSX. Above or near it, add the tab switcher:

  ```tsx
  {/* Tab switcher */}
  <div className="flex border-b border-gray-200 mb-4">
    {(['registered', 'express'] as const).map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-xs font-bold uppercase font-['Barlow_Condensed'] tracking-[0.1em] border-b-2 transition-colors ${
          activeTab === tab
            ? 'border-[#F5C218] text-[#1C1C1C]'
            : 'border-transparent text-gray-400 hover:text-gray-600'
        }`}
      >
        {tab === 'registered' ? 'Registrados' : '⚡ Express'}
      </button>
    ))}
  </div>
  ```

- [ ] **Step 5: Build frontend**

  ```bash
  cd /home/user/servingmi-appCG && pnpm build:frontend 2>&1 | tail -10
  ```

  Expected: build passes.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/frontend/src/pages/suppliers/SuppliersPage.tsx
  git commit -m "feat(suppliers): add Express tab to SuppliersPage"
  ```

---

## Task 7: Push to production

- [ ] **Step 1: Push**

  ```bash
  cd /home/user/servingmi-appCG && git push origin main
  ```

---

## Self-Review

**Spec coverage:**
- ✅ `isExpress` field on Supplier: Task 1
- ✅ DB migration: Task 1
- ✅ Backend create accepts `isExpress`: Task 2
- ✅ Backend list filters by `isExpress`: Task 2 + Task 5 (default behavior corrected)
- ✅ Frontend API updated: Task 3
- ✅ QuickCreateSupplierModal express mode with collapsible extras: Task 4
- ✅ All optional fields (RNC, cédula, phone, email, notes) saved to DB: Task 4 (uses existing fields)
- ✅ Two buttons in PaymentOrdersPage (`+ Registrado` / `⚡ Express`): Task 5
- ✅ `⚡` badge in supplier dropdown: Task 5
- ✅ Express tab in SuppliersPage: Task 6
- ✅ Express suppliers hidden from Activos tab: Tasks 2+6 (explicit `isExpress=false` on Activos query)

**Type consistency:**
- `mode: 'registered' | 'express'` defined in Task 4, used in Task 5
- `isExpress: boolean` added to `Supplier` type in Task 3, used in Task 5 dropdown
- `listSuppliers(..., isExpress?: boolean)` defined in Task 2, controller wired in Task 2, frontend in Task 3

**Default behavior correction (Task 5):**
- Backend `listSuppliers` with `isExpress=undefined` returns ALL suppliers (payment order dropdown gets both)
- `SuppliersPage` Activos tab passes `isExpress=false` explicitly (registered only)
- `SuppliersPage` Express tab passes `isExpress=true` (express only)
- This is consistent and requires no breaking changes to existing callers that don't pass `isExpress`
