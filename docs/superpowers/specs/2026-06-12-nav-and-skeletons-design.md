# Navigation Priority Rail + Skeleton States — Design Spec

**Goal:** Reduce sidebar cognitive load by collapsing 16+ nav items to a user-configurable priority rail, and eliminate jarring blank-content flashes by rendering instant hero bands and layout-faithful skeletons.

**Architecture:** Two independent features sharing no state. Nav changes are isolated to `Layout.tsx` + a new hook. Skeleton changes are additive to individual pages.

**Tech Stack:** React 18, TanStack Query `isLoading`, localStorage, Tailwind CSS `animate-pulse`, `clsx`.

---

## Feature 1: Priority Rail + Floating Popover

### Behavior

The desktop sidebar (`w-60`, `bg-[#1C1C1C]`) renders only pinned nav items in the primary rail. At the bottom of the nav list — above the user footer — a permanent `··· Más` row triggers a floating popover listing all unpinned items.

The mobile drawer (`w-72`, slide-in) is **unchanged** — it continues showing all items flat, no pinning.

### Primary Rail

- Renders the pinned subset of `navItems` (filtered by role as today).
- Each `NavItemLink` gains a faint **unpin affordance**: on hover, a `×` appears at the far right of the row. Clicking it removes the item from pins and closes no panel (inline update). The `×` is `text-gray-600 hover:text-red-400`, `w-3.5 h-3.5`, absolutely positioned right edge.
- The `··· Más` row is always last in the rail. Styled identically to other nav rows (same height, same left-icon area using `MoreHorizontal` from lucide). Clicking toggles the popover.

### Floating Popover

- A `div` with `position: fixed`, anchored to the **right edge of the sidebar** (`left: 240px`) at the vertical position of the `···` row (captured via `useRef` + `getBoundingClientRect`).
- Width: `220px`. Background: `#1C1C1C`. Border: `1px solid rgba(255,255,255,0.1)`. Shadow: `shadow-2xl`.
- Closes on: outside click (`mousedown` listener), `Escape` key, successful pin action.
- **Does not show** items the user has already pinned.
- Groups items with the same `GROUP_LABELS` headers as today (`Operaciones`, `Reportes`, `Administración`). Groups with no visible items are omitted.
- Each row: same height as NavItemLink. Pin icon (`Pin` from lucide, `w-3.5 h-3.5`) on the far right, `text-gray-600 hover:text-[#F5C218]`. Clicking adds to pins + closes popover.
- If all items are pinned, the `···` row is hidden entirely.

### `usePinnedNav` Hook

**File:** `apps/frontend/src/hooks/usePinnedNav.ts`

```ts
// Returns [pinnedIds, pin(id), unpin(id)]
// Reads/writes localStorage key: `pinned_nav_${userId}`
// Falls back to ROLE_DEFAULTS[role] if no stored value
```

Default pins per role (item `to` values):

| Role | Default pins |
|---|---|
| `admin` | `/`, `/projects`, `/expenses`, `/payrolls`, `/reports` |
| `supervisor` | `/`, `/projects`, `/expenses`, `/payrolls`, `/quotations` |
| `operator` | `/`, `/projects`, `/expenses`, `/payrolls` |
| `auxiliar` | `/`, `/expenses`, `/payment-orders`, `/payrolls` |
| `financiero` | `/`, `/expenses`, `/payment-orders`, `/reports`, `/export` |

Hook signature:
```ts
function usePinnedNav(userId: string, role: string): {
  pinnedIds: string[];
  pin: (to: string) => void;
  unpin: (to: string) => void;
}
```

### Files Modified

- `apps/frontend/src/hooks/usePinnedNav.ts` — new
- `apps/frontend/src/components/layout/Layout.tsx` — consume hook, split `SidebarContent` into pinned rail + `···` row + popover component

---

## Feature 2: Skeleton States

### Pattern

Every targeted page follows the same two-layer render:

**Layer 1 — Hero band (immediate):** The `#1C1C1C` hero renders from a static `PAGE_META` lookup (keyed by route path), requiring zero API data. The count chip (e.g. "0 gastos registrados") is replaced with a `SkeletonBlock w-24 h-4` while loading.

**Layer 2 — Content skeleton (layout-faithful):** While `isLoading === true`, the content area below the hero renders a skeleton that mirrors the page's exact column/card structure. Transitions to real content when data arrives — no layout shift.

### Shared Primitives

**File:** `apps/frontend/src/components/ui/Skeleton.tsx`

```tsx
// SkeletonBlock — base rectangle
// Props: className (for w/h/rounded), as?: 'div' | 'span'
// Renders: bg-gray-200 animate-pulse

// SkeletonText — stacked text lines
// Props: lines: number, className for width
// Last line renders at w-3/5 (natural trailing edge)
```

Animation: `animate-pulse` (Tailwind built-in). Color: `bg-gray-200`. No custom keyframes needed.

### Page-Specific Skeleton Components

**`ListTableSkeleton`** (`components/ui/ListTableSkeleton.tsx`)
- Props: `cols: number`, `rows?: number` (default 8), `colWidths?: string[]`
- Renders: dark `thead` with `SkeletonBlock` per column header + `rows` tbody rows of pulsing cells
- Used by: PayrollsPage, SuppliersPage

**`ExpenseListSkeleton`** (`components/ui/ExpenseListSkeleton.tsx`)
- Tabs row: 5 `SkeletonBlock` pill shapes (`h-8 w-16`)
- Filter bar: search input skeleton + 2 select skeletons + sort control skeleton
- 8 card rows: `h-16` block with colored left-edge strip (`w-1 bg-gray-300`) + two text lines + currency block right-aligned

**`ProjectListSkeleton`** (`components/ui/ProjectListSkeleton.tsx`)
- Filter row: search + select skeletons
- 6 card rows: `w-10 h-10` dark icon box (static `bg-[#1C1C1C]`) + two `SkeletonText` lines + `w-24 h-5` currency block

**`DetailPageSkeleton`** (`components/ui/DetailPageSkeleton.tsx`)
- Props: `sections?: number` (default 3)
- Back-arrow row skeleton
- 4 stat chip skeletons in a row
- `sections` content blocks of varying height

### Pages Updated

| Page | Skeleton used | What replaces `isLoading` content |
|---|---|---|
| `ExpensesPage` | `ExpenseListSkeleton` | tabs + filter bar + card list |
| `PayrollsPage` | `ListTableSkeleton cols={7}` | filter panel + table |
| `ProjectsPage` | `ProjectListSkeleton` | filter row + card list |
| `PayrollDetailPage` | `DetailPageSkeleton sections={3}` | stat chips + line table + actions |
| `SuppliersPage` | `ListTableSkeleton cols={5}` | filter bar + table |

### Hero Instant-Render

A `PAGE_META` constant in `apps/frontend/src/utils/routeMeta.ts`:

```ts
export const PAGE_META: Record<string, { module: string; title: string }> = {
  '/expenses':  { module: 'MÓDULO / GASTOS',    title: 'Gastos'    },
  '/payrolls':  { module: 'MÓDULO / NÓMINAS',   title: 'Nóminas'   },
  '/projects':  { module: 'MÓDULO / PROYECTOS', title: 'Proyectos' },
  '/suppliers': { module: 'MÓDULO / SUPLIDORES', title: 'Suplidores' },
  // ...etc
};
```

Each page reads `PAGE_META[location.pathname]` and renders the hero band before data arrives. The count chip is conditionally replaced with a `SkeletonBlock` while `isLoading`.

---

## What This Does Not Change

- Mobile drawer layout
- Any API calls or TanStack Query setup
- Role-based item visibility (still filtered as today)
- The `RoleViewSwitcher` component
- Any page logic, mutations, or form behavior
