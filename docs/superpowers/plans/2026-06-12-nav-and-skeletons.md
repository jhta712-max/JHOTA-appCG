# Navigation Priority Rail + Skeleton States — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-configurable priority rail to the desktop sidebar (collapsing 16+ nav items into pinned favourites + a floating "Más" popover) and replace bare "Cargando…" loading states with layout-faithful skeleton screens across five key pages.

**Architecture:** Two independent features. Feature 1 touches only `Layout.tsx` + a new `usePinnedNav` hook. Feature 2 adds shared skeleton primitives and wires them into five existing pages — hero bands already render immediately on list pages, so only the content area below needs skeletons. `PayrollDetailPage` is the exception and needs its early-return `isLoading` block restructured.

**Tech Stack:** React 18, TanStack Query `isLoading`, localStorage, Tailwind `animate-pulse`, `clsx`, lucide-react.

---

## File Map

**New files:**
- `apps/frontend/src/hooks/usePinnedNav.ts`
- `apps/frontend/src/utils/routeMeta.ts`
- `apps/frontend/src/components/ui/Skeleton.tsx`
- `apps/frontend/src/components/ui/ListTableSkeleton.tsx`
- `apps/frontend/src/components/ui/ExpenseListSkeleton.tsx`
- `apps/frontend/src/components/ui/ProjectListSkeleton.tsx`
- `apps/frontend/src/components/ui/DetailPageSkeleton.tsx`

**Modified files:**
- `apps/frontend/src/components/layout/Layout.tsx`
- `apps/frontend/src/pages/payroll/PayrollsPage.tsx`
- `apps/frontend/src/pages/expenses/ExpensesPage.tsx`
- `apps/frontend/src/pages/projects/ProjectsPage.tsx`
- `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx`
- `apps/frontend/src/pages/suppliers/SuppliersPage.tsx`

---

## Task 1: `usePinnedNav` hook

**Files:**
- Create: `apps/frontend/src/hooks/usePinnedNav.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/frontend/src/hooks/usePinnedNav.ts
import { useState, useCallback } from 'react';

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin:      ['/', '/projects', '/expenses', '/payrolls', '/reports'],
  supervisor: ['/', '/projects', '/expenses', '/payrolls', '/quotations'],
  operator:   ['/', '/projects', '/expenses', '/payrolls'],
  auxiliar:   ['/', '/expenses', '/payment-orders', '/payrolls'],
  financiero: ['/', '/expenses', '/payment-orders', '/reports', '/export'],
};

function storageKey(userId: string) {
  return `pinned_nav_${userId}`;
}

function load(userId: string, role: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return ROLE_DEFAULTS[role] ?? ['/'];
}

function save(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch { /* ignore */ }
}

export function usePinnedNav(userId: string, role: string): {
  pinnedIds: string[];
  pin: (to: string) => void;
  unpin: (to: string) => void;
} {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => load(userId, role));

  const pin = useCallback((to: string) => {
    setPinnedIds((prev) => {
      if (prev.includes(to)) return prev;
      const next = [...prev, to];
      save(userId, next);
      return next;
    });
  }, [userId]);

  const unpin = useCallback((to: string) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== to);
      save(userId, next);
      return next;
    });
  }, [userId]);

  return { pinnedIds, pin, unpin };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0, no errors

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/hooks/usePinnedNav.ts
git commit -m "feat: add usePinnedNav hook with localStorage persistence and role defaults"
```

---

## Task 2: Layout.tsx — priority rail + floating popover

**Files:**
- Modify: `apps/frontend/src/components/layout/Layout.tsx`

The desktop sidebar changes from "show all nav items" to "show pinned items only + `··· Más` button that opens a fixed-position popover listing unpinned items with a pin affordance". Mobile drawer is untouched — it continues to show all items.

Key structural changes:
- Add imports: `MoreHorizontal`, `Pin` from lucide; `usePinnedNav` hook
- `NavItemLink` gains an optional `onUnpin` prop (shows `×` on hover)
- New `NavPopover` component (module-scope, receives props — not a closure)
- `DesktopSidebarContent` (closure component inside `Layout`) replaces the desktop use of `SidebarContent`
- `MobileSidebarContent` (rename of old `SidebarContent`) used only by mobile drawer
- `popoverOpen`, `anchorTop`, `moreRef` state/ref live in `Layout`

- [ ] **Step 1: Replace the entire file**

```tsx
// apps/frontend/src/components/layout/Layout.tsx
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Receipt, Users,
  Tag, LogOut, Menu, X, BarChart3, Download, Wallet, Activity, FileText, CreditCard, Clock,
  Eye, ChevronDown, Building2, Bell, FileCheck, MoreHorizontal, Pin,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api';
import { usePinnedNav } from '../../hooks/usePinnedNav';
import clsx from 'clsx';
import NotificationBell from '../NotificationBell';

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: string[];
  group?: string;
};

const navItems: NavItem[] = [
  { to: '/',                    icon: LayoutDashboard, label: 'Dashboard',        group: 'principal' },
  { to: '/projects',            icon: FolderOpen,      label: 'Proyectos',        group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/expenses',            icon: Receipt,         label: 'Gastos',           group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/payrolls',            icon: Wallet,          label: 'Nóminas',          group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'auxiliar', 'financiero'] },
  { to: '/payment-orders',      icon: FileText,        label: 'Órd. de Pago',     group: 'operaciones', roles: ['admin', 'supervisor', 'auxiliar', 'financiero'] },
  { to: '/pending-orders',      icon: Clock,           label: 'Pagos Pendientes', group: 'operaciones', roles: ['admin', 'auxiliar', 'financiero'] },
  { to: '/office-expenses',     icon: Receipt,         label: 'Gtos. Oficina',    group: 'operaciones', roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/suppliers',           icon: Building2,       label: 'Suplidores',       group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/quotations',          icon: FileText,        label: 'Cotizaciones',     group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/contratos-ajustados', icon: FileCheck,       label: 'Contratos Ajust.', group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'auxiliar', 'financiero'] },
  { to: '/reports',             icon: BarChart3,       label: 'Reportes',         group: 'reportes',    roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/export',              icon: Download,        label: 'Exportar Excel',   group: 'reportes',    roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/users',               icon: Users,           label: 'Usuarios',         group: 'admin',       roles: ['admin'] },
  { to: '/notification-contacts', icon: Bell,          label: 'Contactos Notif.', group: 'admin',       roles: ['admin'] },
  { to: '/categories',          icon: Tag,             label: 'Categorías',       group: 'admin',       roles: ['admin'] },
  { to: '/cards',               icon: CreditCard,      label: 'Tarjetas',         group: 'admin',       roles: ['admin'] },
  { to: '/monitoring',          icon: Activity,        label: 'Monitoreo',        group: 'admin',       roles: ['admin'] },
];

const GROUP_LABELS: Record<string, string> = {
  principal:   '',
  operaciones: 'Operaciones',
  reportes:    'Reportes',
  admin:       'Administración',
};

const ROLE_OPTIONS = [
  { value: '',           label: 'Admin (mi rol)' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator',   label: 'Operador' },
  { value: 'auxiliar',   label: 'Auxiliar administrativo' },
  { value: 'financiero', label: 'Financiero' },
];

function AppIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <img src="/logo.png" alt="SERVINGMI" className={className} style={{ objectFit: 'contain' }} />
  );
}

function RoleViewSwitcher({ compact = false, dropUp = false }: { compact?: boolean; dropUp?: boolean }) {
  const { user, viewAsRole, setViewAsRole } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (user?.role?.name !== 'admin') return null;

  const current = ROLE_OPTIONS.find((o) => o.value === (viewAsRole ?? '')) ?? ROLE_OPTIONS[0];
  const isPreviewing = !!viewAsRole;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-1.5 border text-xs font-medium transition-colors font-['DM_Sans']",
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
          isPreviewing
            ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
            : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20',
        )}
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span className="hidden sm:inline">Vista:</span>}
        <span className="max-w-[100px] truncate">{current.label}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div className={clsx(
          'absolute right-0 w-52 bg-[#1C1C1C] border border-white/10 py-1 z-50 shadow-2xl',
          dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
        )}>
          <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-500 uppercase tracking-widest font-['Barlow_Condensed']">
            Ver interfaz como
          </p>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setViewAsRole(opt.value || null); setOpen(false); }}
              className={clsx(
                "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 font-['DM_Sans']",
                (viewAsRole ?? '') === opt.value
                  ? 'text-[#F5C218] bg-white/5 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )}
            >
              <span className={clsx('w-1 h-1 shrink-0', (viewAsRole ?? '') === opt.value ? 'bg-[#F5C218]' : 'bg-transparent')} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      {label && (
        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 font-['Barlow_Condensed']">
          {label}
        </p>
      )}
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function NavItemLink({
  to, icon: Icon, label, onClick, onUnpin,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  onUnpin?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) => clsx(
        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors relative group font-['DM_Sans']",
        isActive
          ? 'text-[#1C1C1C] font-semibold'
          : 'text-gray-400 hover:text-white hover:bg-white/8',
      )}
      style={({ isActive }) => isActive ? { background: '#F5C218' } : {}}
    >
      {({ isActive }) => (
        <>
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 leading-none">{label}</span>
          {onUnpin && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnpin(); }}
              className={clsx(
                'opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
                isActive ? 'text-[#1C1C1C]/40 hover:text-[#1C1C1C]' : 'text-gray-600 hover:text-red-400',
              )}
              title="Quitar de favoritos"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      )}
    </NavLink>
  );
}

function NavPopover({
  unpinnedGroups,
  anchorTop,
  onPin,
  onClose,
}: {
  unpinnedGroups: { key: string; label: string; items: NavItem[] }[];
  anchorTop: number;
  onPin: (to: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: '244px',
        top: `${anchorTop}px`,
        width: '220px',
        background: '#1C1C1C',
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 60,
      }}
      className="shadow-2xl py-1 max-h-[70vh] overflow-y-auto"
    >
      {unpinnedGroups.map((g) => (
        <div key={g.key}>
          {g.label && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 font-['Barlow_Condensed']">
              {g.label}
            </p>
          )}
          {g.items.map(({ to, icon: Icon, label }) => (
            <div key={to} className="flex items-center group/row">
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) => clsx(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors flex-1 font-['DM_Sans']",
                  isActive ? 'text-[#F5C218]' : 'text-gray-400 hover:text-white hover:bg-white/8',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 leading-none">{label}</span>
              </NavLink>
              <button
                type="button"
                onClick={() => onPin(to)}
                className="pr-3 text-gray-600 hover:text-[#F5C218] transition-colors opacity-0 group-hover/row:opacity-100"
                title="Fijar en barra principal"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, viewAsRole, clearAuth, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchorTop,   setAnchorTop]   = useState(0);
  const moreRef = useRef<HTMLDivElement>(null);

  const userRole      = user?.role?.name ?? '';
  const effectiveRole = (userRole === 'admin' && viewAsRole) ? viewAsRole : userRole;
  const isPreviewing  = userRole === 'admin' && !!viewAsRole;

  const { pinnedIds, pin, unpin } = usePinnedNav(user?.id ?? '', userRole);

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const visibleItems = navItems.filter((i) => !i.roles || i.roles.includes(effectiveRole));

  const groups: { key: string; label: string; items: NavItem[] }[] = [];
  for (const item of visibleItems) {
    const gKey = item.group ?? 'principal';
    let g = groups.find((g) => g.key === gKey);
    if (!g) { g = { key: gKey, label: GROUP_LABELS[gKey] ?? gKey, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  const pinnedItems    = visibleItems.filter((i) => pinnedIds.includes(i.to));
  const unpinnedItems  = visibleItems.filter((i) => !pinnedIds.includes(i.to));
  const hasUnpinned    = unpinnedItems.length > 0;

  const pinnedGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => pinnedIds.includes(i.to)) }))
    .filter((g) => g.items.length > 0);

  const unpinnedGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !pinnedIds.includes(i.to)) }))
    .filter((g) => g.items.length > 0);

  function handleMoreClick() {
    if (moreRef.current) {
      const rect = moreRef.current.getBoundingClientRect();
      setAnchorTop(rect.top);
    }
    setPopoverOpen((v) => !v);
  }

  // Shared footer — used by both desktop and mobile sidebars
  const SidebarFooter = () => (
    <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
      {userRole === 'admin' && (
        <div className="px-1">
          <RoleViewSwitcher dropUp />
        </div>
      )}
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: '#F5C218' }}>
          <span className="text-[#1C1C1C] text-sm font-bold font-['Barlow_Condensed']">
            {user?.name?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate font-['DM_Sans'] leading-tight">{user?.name}</p>
          <p className="text-[10px] text-gray-500 truncate uppercase tracking-wide font-['Barlow_Condensed'] leading-tight">
            {isPreviewing ? `Admin · ${viewAsRole}` : userRole}
          </p>
        </div>
        <button onClick={handleLogout} className="text-gray-600 hover:text-red-400 transition-colors" title="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Desktop sidebar: pinned items only + ··· row
  const DesktopSidebarContent = () => (
    <>
      <nav className="flex-1 px-2 pb-4 overflow-y-auto">
        {pinnedGroups.map(({ key, label, items }) => (
          <NavGroup key={key} label={label}>
            {items.map(({ to, icon, label: itemLabel }) => (
              <NavItemLink
                key={to}
                to={to}
                icon={icon}
                label={itemLabel}
                onUnpin={() => unpin(to)}
              />
            ))}
          </NavGroup>
        ))}
        {hasUnpinned && (
          <div ref={moreRef} className="pt-3 px-2">
            <button
              type="button"
              onClick={handleMoreClick}
              className={clsx(
                "w-full flex items-center gap-3 px-1 py-2.5 text-sm font-medium transition-colors font-['DM_Sans']",
                popoverOpen
                  ? 'text-[#F5C218]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/8',
              )}
            >
              <MoreHorizontal className="w-4 h-4 shrink-0" />
              <span className="flex-1 leading-none">Más</span>
            </button>
          </div>
        )}
      </nav>
      <SidebarFooter />
    </>
  );

  // Mobile drawer: all items (unchanged behaviour)
  const MobileSidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <nav className="flex-1 px-2 pb-4 overflow-y-auto">
        {groups.map(({ key, label, items }) => (
          <NavGroup key={key} label={label}>
            {items.map(({ to, icon, label: itemLabel }) => (
              <NavItemLink key={to} to={to} icon={icon} label={itemLabel} onClick={onNavClick} />
            ))}
          </NavGroup>
        ))}
      </nav>
      <SidebarFooter />
    </>
  );

  // Suppress unused-variable warning — pinnedItems used for derivation only
  void pinnedItems;

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">

      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 fixed inset-y-0 left-0 z-30"
        style={{ background: '#1C1C1C' }}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <AppIcon className="w-9 h-10 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-white text-base uppercase tracking-widest leading-none font-['Barlow_Condensed']">
              SERVINGMI
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-tight mt-0.5 font-['Barlow_Condensed']">
              Control de Gastos
            </p>
          </div>
        </div>
        <DesktopSidebarContent />
      </aside>

      {/* Floating popover — rendered outside aside so it overflows correctly */}
      {popoverOpen && (
        <NavPopover
          unpinnedGroups={unpinnedGroups}
          anchorTop={anchorTop}
          onPin={(to) => { pin(to); setPopoverOpen(false); }}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {/* ── Mobile overlay ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────── */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 w-72 z-50 flex flex-col transition-transform duration-300 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: '#1C1C1C' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <AppIcon className="w-8 h-9 shrink-0" />
            <div>
              <p className="font-bold text-white uppercase tracking-widest font-['Barlow_Condensed']">SERVINGMI</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-['Barlow_Condensed']">Control de Gastos</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <MobileSidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen min-w-0">

        {/* Mobile header */}
        <header
          className="md:hidden sticky top-0 z-20 border-b border-white/10 px-4 py-3 flex items-center gap-3"
          style={{ background: '#1C1C1C' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AppIcon className="w-6 h-7 shrink-0" />
            <span className="font-bold text-white uppercase tracking-widest text-sm font-['Barlow_Condensed']">SERVINGMI</span>
          </div>
          <RoleViewSwitcher compact />
        </header>

        {/* Notification Bell */}
        <div className="fixed top-4 right-4 z-50">
          <NotificationBell />
        </div>

        {/* Role preview banner */}
        {isPreviewing && (
          <div
            className="hidden md:flex items-center justify-between border-b px-6 py-2"
            style={{ background: '#F5C218' }}
          >
            <p className="text-xs font-semibold text-[#1C1C1C] flex items-center gap-2 font-['DM_Sans']">
              <Eye className="w-3.5 h-3.5" />
              Viendo interfaz como <strong className="uppercase">{viewAsRole}</strong> — datos reales.
            </p>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        <footer className="border-t border-gray-100 bg-white py-3 px-6 text-center">
          <p className="text-xs text-gray-400 font-['DM_Sans']">
            Desarrollado con{' '}
            <span className="font-medium text-gray-500">Cowork Claude AI</span>
            {' '}· © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm build:frontend 2>&1 | tail -10`
Expected: exit 0, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/layout/Layout.tsx
git commit -m "feat: priority rail nav with user-configurable pinning and floating popover"
```

---

## Task 3: `routeMeta.ts` utility

**Files:**
- Create: `apps/frontend/src/utils/routeMeta.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/frontend/src/utils/routeMeta.ts
export const PAGE_META: Record<string, { module: string; title: string }> = {
  '/expenses':          { module: 'MÓDULO / GASTOS',        title: 'Gastos'        },
  '/payrolls':          { module: 'MÓDULO / NÓMINAS',       title: 'Nóminas'       },
  '/projects':          { module: 'MÓDULO / PROYECTOS',     title: 'Proyectos'     },
  '/suppliers':         { module: 'MÓDULO / SUPLIDORES',    title: 'Suplidores'    },
  '/payment-orders':    { module: 'MÓDULO / PAGOS',         title: 'Órd. de Pago'  },
  '/pending-orders':    { module: 'MÓDULO / PAGOS',         title: 'Pend. de Pago' },
  '/office-expenses':   { module: 'MÓDULO / OFICINA',       title: 'Gtos. Oficina' },
  '/quotations':        { module: 'MÓDULO / COTIZACIONES',  title: 'Cotizaciones'  },
  '/reports':           { module: 'MÓDULO / REPORTES',      title: 'Reportes'      },
  '/export':            { module: 'MÓDULO / REPORTES',      title: 'Exportar'      },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/utils/routeMeta.ts
git commit -m "feat: add PAGE_META route metadata for instant hero renders"
```

---

## Task 4: Skeleton primitives

**Files:**
- Create: `apps/frontend/src/components/ui/Skeleton.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/components/ui/Skeleton.tsx

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse ${className}`} />;
}

export function SkeletonText({
  lines = 2,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`bg-gray-200 animate-pulse h-3 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/Skeleton.tsx
git commit -m "feat: add SkeletonBlock and SkeletonText primitives"
```

---

## Task 5: `ListTableSkeleton`

**Files:**
- Create: `apps/frontend/src/components/ui/ListTableSkeleton.tsx`

Used by: PayrollsPage (cols=7).

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/components/ui/ListTableSkeleton.tsx
import { SkeletonBlock } from './Skeleton';

interface Props {
  cols: number;
  rows?: number;
  colWidths?: string[];
}

export function ListTableSkeleton({ cols, rows = 8, colWidths }: Props) {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead style={{ background: '#1C1C1C' }}>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3" style={{ width: colWidths?.[i] }}>
                <SkeletonBlock className="h-3 w-16 bg-gray-600" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonBlock
                    className={`h-4 ${c === 0 ? 'w-20' : c === cols - 1 ? 'w-16 ml-auto' : 'w-full'}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ui/ListTableSkeleton.tsx
git commit -m "feat: add ListTableSkeleton"
```

---

## Task 6: `ExpenseListSkeleton`

**Files:**
- Create: `apps/frontend/src/components/ui/ExpenseListSkeleton.tsx`

Mirrors ExpensesPage: tabs row of pill shapes + filter bar + 8 card rows with colored left-edge strip.

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/components/ui/ExpenseListSkeleton.tsx
import { SkeletonBlock } from './Skeleton';

export function ExpenseListSkeleton() {
  return (
    <div className="space-y-4 mt-5">
      {/* Project tabs row */}
      <div className="flex gap-0 border-b border-gray-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-9 w-20 mr-1" />
        ))}
      </div>
      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <SkeletonBlock className="h-10 flex-1 min-w-[180px]" />
        <SkeletonBlock className="h-10 w-40" />
        <SkeletonBlock className="h-10 w-52" />
        <SkeletonBlock className="h-10 w-24" />
      </div>
      {/* Card rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-1 self-stretch bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
            <div className="text-right space-y-2 shrink-0">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-16 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ui/ExpenseListSkeleton.tsx
git commit -m "feat: add ExpenseListSkeleton"
```

---

## Task 7: `ProjectListSkeleton`

**Files:**
- Create: `apps/frontend/src/components/ui/ProjectListSkeleton.tsx`

Mirrors ProjectsPage and SuppliersPage (both render icon-box + text card rows).

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/components/ui/ProjectListSkeleton.tsx
import { SkeletonBlock, SkeletonText } from './Skeleton';

export function ProjectListSkeleton() {
  return (
    <div className="space-y-4 mt-5">
      {/* Filter row */}
      <div className="flex gap-3 flex-wrap">
        <SkeletonBlock className="h-10 flex-1 min-w-[200px]" />
        <SkeletonBlock className="h-10 w-44" />
      </div>
      {/* Card rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-10 h-10 shrink-0" style={{ background: '#1C1C1C' }} />
            <div className="flex-1 min-w-0">
              <SkeletonText lines={2} />
            </div>
            <div className="hidden sm:block text-right space-y-1.5 shrink-0">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-3 w-16 ml-auto" />
            </div>
            <SkeletonBlock className="h-4 w-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/components/ui/ProjectListSkeleton.tsx
git commit -m "feat: add ProjectListSkeleton"
```

---

## Task 8: `DetailPageSkeleton`

**Files:**
- Create: `apps/frontend/src/components/ui/DetailPageSkeleton.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/components/ui/DetailPageSkeleton.tsx
import { SkeletonBlock, SkeletonText } from './Skeleton';

export function DetailPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="space-y-6">
      {/* Back-arrow + breadcrumb row */}
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-8" />
        <SkeletonBlock className="h-4 w-36" />
      </div>
      {/* 4 stat chips */}
      <div className="flex gap-4 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20 w-36" />
        ))}
      </div>
      {/* Content sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 p-6 space-y-4">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonText lines={3} />
          {i === 0 && (
            <div className="pt-2">
              <SkeletonText lines={4} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify all skeleton files build together**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/ui/DetailPageSkeleton.tsx
git commit -m "feat: add DetailPageSkeleton"
```

---

## Task 9: Wire skeleton into PayrollsPage

**Files:**
- Modify: `apps/frontend/src/pages/payroll/PayrollsPage.tsx`

The hero already renders immediately. Two changes: (a) count chip shows skeleton while loading, (b) "Cargando nóminas…" text replaced with `ListTableSkeleton`.

- [ ] **Step 1: Add imports**

After the existing import block, add:
```tsx
import { ListTableSkeleton } from '../../components/ui/ListTableSkeleton';
import { SkeletonBlock }     from '../../components/ui/Skeleton';
```

- [ ] **Step 2: Replace the count chip**

Find (the `<p>` showing total count in the hero band):
```tsx
          <p
            className="text-sm mt-1"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {total} nómina{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
```

Replace with:
```tsx
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-28 bg-gray-600" />
              : `${total} nómina${total !== 1 ? 's' : ''} registrada${total !== 1 ? 's' : ''}`
            }
          </p>
```

- [ ] **Step 3: Replace the loading state in the table area**

Find:
```tsx
        {isLoading ? (
          <div
            className="text-center py-12 text-gray-400 text-sm"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Cargando nóminas…
          </div>
        ) : filtered.length === 0 ? (
```

Replace with:
```tsx
        {isLoading ? (
          <ListTableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
```

- [ ] **Step 4: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/payroll/PayrollsPage.tsx
git commit -m "feat: skeleton loading state in PayrollsPage"
```

---

## Task 10: Wire skeleton into ExpensesPage

**Files:**
- Modify: `apps/frontend/src/pages/expenses/ExpensesPage.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { ExpenseListSkeleton } from '../../components/ui/ExpenseListSkeleton';
import { SkeletonBlock }       from '../../components/ui/Skeleton';
```

- [ ] **Step 2: Replace the count chip**

Find (hero band count line):
```tsx
          <p
            className="text-sm mt-1"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {pagination?.total ?? 0} gastos registrados
          </p>
```

Replace with:
```tsx
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-32 bg-gray-600" />
              : `${pagination?.total ?? 0} gastos registrados`
            }
          </p>
```

- [ ] **Step 3: Replace the loading state**

Find:
```tsx
        {isLoading ? (
          <div
            className="text-center py-12 text-gray-400"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            Cargando gastos...
          </div>
        ) : expenses.length === 0 ? (
```

Replace with:
```tsx
        {isLoading ? (
          <ExpenseListSkeleton />
        ) : expenses.length === 0 ? (
```

- [ ] **Step 4: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/expenses/ExpensesPage.tsx
git commit -m "feat: skeleton loading state in ExpensesPage"
```

---

## Task 11: Wire skeleton into ProjectsPage

**Files:**
- Modify: `apps/frontend/src/pages/projects/ProjectsPage.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { SkeletonBlock }        from '../../components/ui/Skeleton';
```

- [ ] **Step 2: Replace the count chip**

Find:
```tsx
          <p
            className="text-sm mt-1"
            style={{ fontFamily: "'Space Mono', monospace", color: '#F5C218' }}
          >
            {data?.pagination?.total ?? 0} proyectos registrados
          </p>
```

Replace with:
```tsx
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: "'Space Mono', monospace", color: '#F5C218' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-36 bg-gray-600" />
              : `${data?.pagination?.total ?? 0} proyectos registrados`
            }
          </p>
```

- [ ] **Step 3: Replace the loading state**

Find:
```tsx
      {isLoading ? (
        <div
          className="text-center py-12 text-gray-400"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Cargando proyectos...
        </div>
      ) : projects.length === 0 ? (
```

Replace with:
```tsx
      {isLoading ? (
        <ProjectListSkeleton />
      ) : projects.length === 0 ? (
```

- [ ] **Step 4: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/projects/ProjectsPage.tsx
git commit -m "feat: skeleton loading state in ProjectsPage"
```

---

## Task 12: Wire skeleton into PayrollDetailPage

**Files:**
- Modify: `apps/frontend/src/pages/payroll/PayrollDetailPage.tsx`

**Context:** This page has an early return `if (isLoading) return <div>Cargando nómina…</div>` at line ~99, which means the entire page is blank during loading — no hero renders at all. Replace it with a static hero (from `PAGE_META`) + `DetailPageSkeleton`.

- [ ] **Step 1: Add imports**

After existing imports:
```tsx
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';
```

- [ ] **Step 2: Replace the early return**

Find (around line 99):
```tsx
  if (isLoading) return <div className="text-center py-16 text-gray-400 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>Cargando nómina…</div>;
```

Replace with:
```tsx
  if (isLoading) {
    const meta = PAGE_META['/payrolls'];
    return (
      <div>
        <div className="flex items-center justify-between px-6 py-5" style={{ background: '#1C1C1C' }}>
          <div>
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}
            >
              {meta.module}
            </p>
            <h1
              className="text-3xl uppercase tracking-widest text-white leading-none"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              {meta.title}
            </h1>
          </div>
        </div>
        <div className="p-6">
          <DetailPageSkeleton sections={3} />
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/payroll/PayrollDetailPage.tsx
git commit -m "feat: instant hero + DetailPageSkeleton in PayrollDetailPage"
```

---

## Task 13: Wire skeleton into SuppliersPage

**Files:**
- Modify: `apps/frontend/src/pages/suppliers/SuppliersPage.tsx`

**Context:** The loading state (lines 239–243) shows an animated `Building2` icon + "Cargando suplidores..." text. Replace with `ProjectListSkeleton` (both pages render icon-box + text card rows). Also update the count chip — currently `{count}` where `count = suppliers?.length ?? 0` renders "0 suplidores" while loading.

- [ ] **Step 1: Add imports**

After existing imports:
```tsx
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { SkeletonBlock }        from '../../components/ui/Skeleton';
```

- [ ] **Step 2: Replace the count chip in the hero**

Find (in the hero band):
```tsx
            <p className="font-['Space_Mono'] text-sm mt-1" style={{ color: '#F5C218' }}>
              {count} suplidor{count !== 1 ? 'es' : ''} registrado{count !== 1 ? 's' : ''}
            </p>
```

Replace with:
```tsx
            <p className="font-['Space_Mono'] text-sm mt-1 h-5 flex items-center" style={{ color: '#F5C218' }}>
              {isLoading
                ? <SkeletonBlock className="h-4 w-32 bg-gray-600" />
                : `${count} suplidor${count !== 1 ? 'es' : ''} registrado${count !== 1 ? 's' : ''}`
              }
            </p>
```

- [ ] **Step 3: Replace the loading state**

Find:
```tsx
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Building2 className="w-8 h-8 animate-pulse" style={{ color: '#F5C218' }} />
            <p className="font-['DM_Sans'] text-sm text-gray-400">Cargando suplidores...</p>
          </div>
        ) : suppliers && suppliers.length > 0 ? (
```

Replace with:
```tsx
        {isLoading ? (
          <ProjectListSkeleton />
        ) : suppliers && suppliers.length > 0 ? (
```

- [ ] **Step 4: Verify build**

Run: `pnpm build:frontend 2>&1 | tail -5`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/suppliers/SuppliersPage.tsx
git commit -m "feat: skeleton loading state in SuppliersPage"
```

---

## Task 14: Final verification + push

- [ ] **Step 1: Full TypeScript check**

Run: `pnpm build:frontend 2>&1`
Expected: exit 0, no errors

- [ ] **Step 2: Backend tests (regression check)**

Run: `pnpm --filter backend test -- --run`
Expected: all pass

- [ ] **Step 3: Push branch**

```bash
git push -u origin claude/happy-feynman-stMWv
```
