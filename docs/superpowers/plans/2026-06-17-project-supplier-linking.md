# Project-Supplier Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link suppliers to projects (many-to-many) so operators/supervisors only see project-assigned suppliers when creating payment orders; admins see all.

**Architecture:** New `ProjectSupplier` join table in Prisma schema. Backend adds project-supplier CRUD endpoints and adds `projectId` filter to `listSuppliers`. Frontend adds assignment UI in ProjectDetailPage (admin/supervisor) and filters the supplier dropdown in PaymentOrdersPage by current project for non-admin roles.

**Tech Stack:** Prisma ORM, PostgreSQL, Node.js/Express TypeScript backend, React 18 + TanStack Query frontend.

---

## File Map

### Create
- `apps/backend/src/modules/suppliers/project-suppliers.service.ts` — CRUD for project-supplier assignments
- `apps/backend/src/modules/suppliers/project-suppliers.router.ts` — routes mounted at `/projects/:projectId/suppliers`

### Modify
- `apps/backend/prisma/schema.prisma` — add `ProjectSupplier` model; add relation to `Project` and `Supplier`
- `apps/backend/src/modules/suppliers/suppliers.service.ts` — add `projectId` filter to `listSuppliers`
- `apps/backend/src/modules/suppliers/suppliers.router.ts` — add new router mount for project-suppliers
- `apps/backend/src/modules/projects/projects.router.ts` — mount project-suppliers sub-router
- `apps/frontend/src/api/index.ts` — add `projectSuppliersApi`; update `suppliersApi.list` to accept `projectId`
- `apps/frontend/src/pages/projects/ProjectDetailPage.tsx` — add "Suplidores asignados" tab section
- `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx` — filter supplier list by project for non-admin roles

---

## Task 1: Prisma Schema — `ProjectSupplier` join table

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add `ProjectSupplier` model to schema**

  Find the `Supplier` model block and add the relation field, and the new model after it:

  ```prisma
  // In Supplier model, add inside the relations block:
  projects ProjectSupplier[]

  // New model (add after Supplier model):
  model ProjectSupplier {
    id         String   @id @default(uuid()) @db.Uuid
    projectId  String   @map("project_id") @db.Uuid
    supplierId String   @map("supplier_id") @db.Uuid
    createdAt  DateTime @default(now()) @map("created_at")

    project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
    supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

    @@unique([projectId, supplierId])
    @@map("project_suppliers")
  }
  ```

  In the `Project` model, add the relation:
  ```prisma
  // Inside Project model relations:
  assignedSuppliers ProjectSupplier[]
  ```

- [ ] **Step 2: Generate migration and regenerate client**

  ```bash
  cd /home/user/servingmi-appCG
  pnpm --filter backend db:generate
  ```

  Expected: `✔ Generated Prisma Client` with no errors.

  Note: migration will be created on the server via `migrate deploy`. Locally you can run `pnpm db:migrate` if you have Docker postgres available, but it's not required for the build to pass.

- [ ] **Step 3: Verify build passes**

  ```bash
  pnpm build:backend 2>&1 | tail -20
  ```

  Expected: `Build succeeded` / `0 errors`. If Prisma client errors appear, re-run `db:generate`.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/backend/prisma/schema.prisma
  git commit -m "feat(schema): add ProjectSupplier many-to-many join table"
  ```

---

## Task 2: Backend service + router for project-supplier assignments

**Files:**
- Create: `apps/backend/src/modules/suppliers/project-suppliers.service.ts`
- Create: `apps/backend/src/modules/suppliers/project-suppliers.router.ts`

- [ ] **Step 1: Write the service**

  ```typescript
  // apps/backend/src/modules/suppliers/project-suppliers.service.ts
  import { prisma } from '../../lib/prisma';

  export async function listProjectSuppliers(projectId: string) {
    return prisma.projectSupplier.findMany({
      where: { projectId },
      include: {
        supplier: {
          select: {
            id: true, name: true, rnc: true, isActive: true, bank: true,
            accountNumber: true, accountType: true,
            bankAccounts: { select: { id: true, bank: true, accountType: true, accountNumber: true, isDefault: true } },
          },
        },
      },
      orderBy: { supplier: { name: 'asc' } },
    });
  }

  export async function assignSupplierToProject(projectId: string, supplierId: string) {
    return prisma.projectSupplier.upsert({
      where: { projectId_supplierId: { projectId, supplierId } },
      create: { projectId, supplierId },
      update: {},
      include: { supplier: { select: { id: true, name: true, rnc: true, isActive: true } } },
    });
  }

  export async function removeSupplierFromProject(projectId: string, supplierId: string) {
    return prisma.projectSupplier.delete({
      where: { projectId_supplierId: { projectId, supplierId } },
    });
  }
  ```

- [ ] **Step 2: Write the router**

  ```typescript
  // apps/backend/src/modules/suppliers/project-suppliers.router.ts
  import { Router } from 'express';
  import { authenticate } from '../../middlewares/auth.middleware';
  import { authorize } from '../../middlewares/role.middleware';
  import {
    listProjectSuppliers,
    assignSupplierToProject,
    removeSupplierFromProject,
  } from './project-suppliers.service';

  const router = Router({ mergeParams: true }); // gives access to :projectId

  router.use(authenticate);

  // GET /projects/:projectId/suppliers
  router.get('/', async (req, res) => {
    try {
      const data = await listProjectSuppliers(req.params.projectId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Error fetching project suppliers' });
    }
  });

  // POST /projects/:projectId/suppliers  body: { supplierId }
  router.post('/', authorize('admin', 'supervisor'), async (req, res) => {
    try {
      const { supplierId } = req.body;
      if (!supplierId) return res.status(400).json({ success: false, error: 'supplierId requerido' });
      const data = await assignSupplierToProject(req.params.projectId, supplierId);
      res.status(201).json({ success: true, data });
    } catch (e: any) {
      if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Suplidor ya asignado a este proyecto' });
      res.status(500).json({ success: false, error: 'Error asignando suplidor' });
    }
  });

  // DELETE /projects/:projectId/suppliers/:supplierId
  router.delete('/:supplierId', authorize('admin', 'supervisor'), async (req, res) => {
    try {
      await removeSupplierFromProject(req.params.projectId, req.params.supplierId);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'P2025') return res.status(404).json({ success: false, error: 'Asignación no encontrada' });
      res.status(500).json({ success: false, error: 'Error eliminando asignación' });
    }
  });

  export default router;
  ```

- [ ] **Step 3: Mount the router in projects router**

  Open `apps/backend/src/modules/projects/projects.router.ts` and add near the top/end:

  ```typescript
  import projectSuppliersRouter from '../suppliers/project-suppliers.router';

  // Add AFTER existing project routes:
  router.use('/:projectId/suppliers', projectSuppliersRouter);
  ```

- [ ] **Step 4: Build and verify no errors**

  ```bash
  pnpm build:backend 2>&1 | tail -20
  ```

  Expected: `0 errors`.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/project-suppliers.service.ts \
          apps/backend/src/modules/suppliers/project-suppliers.router.ts \
          apps/backend/src/modules/projects/projects.router.ts
  git commit -m "feat(suppliers): add project-supplier assignment endpoints"
  ```

---

## Task 3: Backend — filter `listSuppliers` by `projectId`

**Files:**
- Modify: `apps/backend/src/modules/suppliers/suppliers.service.ts`

- [ ] **Step 1: Find the `listSuppliers` function signature**

  In `apps/backend/src/modules/suppliers/suppliers.service.ts`, find the function that handles listing (likely `listSuppliers` or similar). It accepts `search` and `onlyActive`. The query uses `prisma.supplier.findMany`.

- [ ] **Step 2: Add `projectId` parameter and join filter**

  Change the params type and add a conditional `where` clause:

  ```typescript
  // Before (approximate existing signature):
  export async function listSuppliers(params: { search?: string; onlyActive?: boolean }) {

  // After:
  export async function listSuppliers(params: { search?: string; onlyActive?: boolean; projectId?: string }) {
  ```

  In the `where` clause, add:
  ```typescript
  // Add inside where: { ... }
  ...(params.projectId
    ? { projects: { some: { projectId: params.projectId } } }
    : {}),
  ```

  This means: if `projectId` is provided, only return suppliers that have at least one `ProjectSupplier` record linking them to that project.

- [ ] **Step 3: Expose `projectId` in the controller**

  In `apps/backend/src/modules/suppliers/suppliers.controller.ts` (or wherever the list handler reads query params), add:

  ```typescript
  const projectId = req.query.projectId as string | undefined;
  // Pass to listSuppliers:
  const data = await listSuppliers({ search, onlyActive, projectId });
  ```

- [ ] **Step 4: Build**

  ```bash
  pnpm build:backend 2>&1 | tail -20
  ```

  Expected: `0 errors`.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/modules/suppliers/suppliers.service.ts \
          apps/backend/src/modules/suppliers/suppliers.controller.ts
  git commit -m "feat(suppliers): add projectId filter to listSuppliers"
  ```

---

## Task 4: Frontend API — `projectSuppliersApi` + update `suppliersApi.list`

**Files:**
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Add `ProjectSupplierEntry` type near other supplier types**

  Find where `Supplier` type is defined or imported. Add:

  ```typescript
  export type ProjectSupplierEntry = {
    id: string;
    supplierId: string;
    projectId: string;
    supplier: Pick<Supplier, 'id' | 'name' | 'rnc' | 'isActive' | 'bank' | 'accountNumber' | 'accountType'> & {
      bankAccounts: SupplierBankAccount[];
    };
  };
  ```

- [ ] **Step 2: Update `suppliersApi.list` to accept `projectId`**

  Find:
  ```typescript
  list: (params?: { search?: string; onlyActive?: boolean }) =>
    api.get<{ success: boolean; data: Supplier[] }>('/suppliers', { params }),
  ```

  Change to:
  ```typescript
  list: (params?: { search?: string; onlyActive?: boolean; projectId?: string }) =>
    api.get<{ success: boolean; data: Supplier[] }>('/suppliers', { params }),
  ```

- [ ] **Step 3: Add `projectSuppliersApi` object**

  After the `suppliersApi` block, add:

  ```typescript
  export const projectSuppliersApi = {
    list: (projectId: string) =>
      api.get<{ success: boolean; data: ProjectSupplierEntry[] }>(`/projects/${projectId}/suppliers`),
    assign: (projectId: string, supplierId: string) =>
      api.post<{ success: boolean; data: ProjectSupplierEntry }>(`/projects/${projectId}/suppliers`, { supplierId }),
    remove: (projectId: string, supplierId: string) =>
      api.delete<{ success: boolean }>(`/projects/${projectId}/suppliers/${supplierId}`),
  };
  ```

- [ ] **Step 4: Verify TypeScript (frontend)**

  ```bash
  pnpm build:frontend 2>&1 | tail -20
  ```

  Expected: build passes or only unrelated warnings.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/frontend/src/api/index.ts
  git commit -m "feat(api): add projectSuppliersApi and projectId param to suppliersApi.list"
  ```

---

## Task 5: Frontend — "Suplidores" section in ProjectDetailPage

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectDetailPage.tsx`

- [ ] **Step 1: Add imports at top of file**

  ```typescript
  import { projectSuppliersApi, suppliersApi, type ProjectSupplierEntry } from '../../api';
  import { Trash2, UserPlus } from 'lucide-react';
  import { useRole } from '../../hooks/useRole';
  ```

- [ ] **Step 2: Add queries + mutation inside the component function**

  ```typescript
  const { isAdmin, isSupervisor } = useRole();
  const canManageSuppliers = isAdmin || isSupervisor;

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [addSupplierId, setAddSupplierId] = useState('');

  const { data: projSuppliersRes } = useQuery({
    queryKey: ['project-suppliers', id],
    queryFn: () => projectSuppliersApi.list(id!),
    enabled: !!id,
  });
  const assignedSuppliers: ProjectSupplierEntry[] = projSuppliersRes?.data.data ?? [];

  const { data: allSuppliersRes } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.list({ onlyActive: true }),
    enabled: canManageSuppliers && showAddSupplier,
  });
  const allSuppliers = allSuppliersRes?.data.data ?? [];

  const assignMut = useMutation({
    mutationFn: (supplierId: string) => projectSuppliersApi.assign(id!, supplierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-suppliers', id] });
      setShowAddSupplier(false);
      setAddSupplierId('');
    },
  });

  const removeMut = useMutation({
    mutationFn: (supplierId: string) => projectSuppliersApi.remove(id!, supplierId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-suppliers', id] }),
  });
  ```

- [ ] **Step 3: Add suppliers section to JSX**

  Inside the existing grid layout of ProjectDetailPage, add a new card section (similar in style to existing cards in that page — white bg, border, p-6):

  ```tsx
  {/* Suplidores asignados */}
  <div className="bg-white border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em]">
        Suplidores Asignados
      </h2>
      {canManageSuppliers && (
        <button
          onClick={() => setShowAddSupplier(true)}
          className="flex items-center gap-1 text-xs bg-[#F5C218] text-[#1C1C1C] px-3 py-1 font-bold uppercase font-['Barlow_Condensed']"
        >
          <UserPlus size={12} /> Agregar
        </button>
      )}
    </div>

    {showAddSupplier && (
      <div className="flex gap-2 mb-4">
        <select
          value={addSupplierId}
          onChange={(e) => setAddSupplierId(e.target.value)}
          className="flex-1 border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218]"
        >
          <option value="">— Seleccionar suplidor —</option>
          {allSuppliers
            .filter((s) => !assignedSuppliers.some((a) => a.supplierId === s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` (${s.rnc})` : ''}</option>
            ))}
        </select>
        <button
          onClick={() => addSupplierId && assignMut.mutate(addSupplierId)}
          disabled={!addSupplierId || assignMut.isPending}
          className="px-4 py-2 text-xs font-bold uppercase font-['Barlow_Condensed'] bg-[#F5C218] text-[#1C1C1C] disabled:opacity-50"
        >
          Asignar
        </button>
        <button
          onClick={() => { setShowAddSupplier(false); setAddSupplierId(''); }}
          className="px-3 py-2 text-xs border border-gray-200 text-gray-600 font-['Barlow_Condensed'] uppercase"
        >
          Cancelar
        </button>
      </div>
    )}

    {assignedSuppliers.length === 0 ? (
      <p className="text-sm text-gray-400 font-['DM_Sans']">Sin suplidores asignados</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1C1C1C]">
            {['Nombre', 'RNC', ''].map((h) => (
              <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assignedSuppliers.map((a) => (
            <tr key={a.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-['DM_Sans']">{a.supplier.name}</td>
              <td className="px-3 py-2 font-['Space_Mono'] text-xs text-gray-500">{a.supplier.rnc ?? '—'}</td>
              <td className="px-3 py-2">
                {canManageSuppliers && (
                  <button
                    onClick={() => removeMut.mutate(a.supplierId)}
                    disabled={removeMut.isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
  ```

- [ ] **Step 4: Build frontend**

  ```bash
  pnpm build:frontend 2>&1 | tail -20
  ```

  Expected: build passes.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/frontend/src/pages/projects/ProjectDetailPage.tsx
  git commit -m "feat(projects): add supplier assignment UI to ProjectDetailPage"
  ```

---

## Task 6: Frontend — filter suppliers by project in PaymentOrdersPage

**Files:**
- Modify: `apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx`

The goal: when a non-admin user is creating a payment order and has selected a `projectId`, the supplier dropdown shows only suppliers assigned to that project. Admins always see all.

- [ ] **Step 1: Add role hook import**

  At top of the file, ensure this import exists:
  ```typescript
  import { useRole } from '../../hooks/useRole';
  ```

- [ ] **Step 2: Read the role inside the component**

  After existing `useAuthStore` or state hooks near the top of the component:
  ```typescript
  const { isAdmin } = useRole();
  ```

- [ ] **Step 3: Change the suppliers query**

  Find (around line 270):
  ```typescript
  queryFn:  () => suppliersApi.list({ onlyActive: true }),
  ```

  Change to:
  ```typescript
  queryFn: () => {
    const projectId = form.projectId || undefined;
    // Admins see all; others see only project-assigned suppliers (when a project is selected)
    if (!isAdmin && projectId) {
      return suppliersApi.list({ onlyActive: true, projectId });
    }
    return suppliersApi.list({ onlyActive: true });
  },
  ```

  And update the `queryKey` to include the projectId and role so it refetches when project changes:
  ```typescript
  queryKey: ['suppliers', 'active', isAdmin ? 'all' : form.projectId],
  ```

  `form` here refers to the `OrderForm` state — find the actual state variable name in the file (it might be `form`, `orderForm`, or similar). Use the correct name.

- [ ] **Step 4: Build frontend**

  ```bash
  pnpm build:frontend 2>&1 | tail -20
  ```

  Expected: build passes.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/frontend/src/pages/payment-orders/PaymentOrdersPage.tsx
  git commit -m "feat(payment-orders): filter supplier dropdown by project for non-admin roles"
  ```

---

## Task 7: Database migration for production

**Files:**
- Modify: none (migration auto-generated)

- [ ] **Step 1: Create migration**

  If Docker postgres is available:
  ```bash
  cd /home/user/servingmi-appCG
  pnpm db:migrate
  # When prompted for migration name: project_supplier_linking
  ```

  If NOT available locally (typical in CI/remote), the migration will be created and deployed by Render's `preDeployCommand: prisma migrate deploy`. The schema change and generated client are enough to push.

- [ ] **Step 2: Push to branch**

  ```bash
  git push -u origin claude/happy-feynman-stMWv
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Many-to-many join table: Task 1
- ✅ Backend CRUD for project-supplier assignments: Task 2  
- ✅ `listSuppliers` filtered by `projectId`: Task 3
- ✅ Frontend API layer: Task 4
- ✅ Admin/supervisor can assign suppliers to project: Task 5
- ✅ Operators/supervisors see only project suppliers in payment order form: Task 6
- ✅ Admin always sees all suppliers: Task 6 (isAdmin check)
- ✅ Deployment migration: Task 7

**Type consistency:**
- `ProjectSupplierEntry` used in Task 4 and Task 5 consistently
- `projectId_supplierId` unique constraint matches Prisma's generated composite key name
- `projectSuppliersApi` used identically in Tasks 4 and 5

**Potential issues noted:**
- Task 6 uses `form.projectId` — implementer must check the actual state variable name in PaymentOrdersPage (look for `useState<OrderForm>`)
- The `queryKey` refetch when project changes depends on `form.projectId` being in the key — make sure it's the correct state variable reference
- The `EMPTY_ORDER.projectId` is `''` so the filter won't fire until a project is selected (correct behavior)
