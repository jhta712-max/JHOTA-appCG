// apps/frontend/src/components/layout/Layout.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
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
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: '/',                    icon: LayoutDashboard, label: 'Dashboard',        group: 'principal' },
  { to: '/projects',            icon: FolderOpen,      label: 'Proyectos',        group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/expenses',            icon: Receipt,         label: 'Gastos',           group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/payrolls',            icon: Wallet,          label: 'Nóminas',          group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'auxiliar', 'financiero'] },
  { to: '/payment-orders',      icon: FileText,        label: 'Órd. de Pago',     group: 'operaciones', roles: ['admin', 'supervisor', 'auxiliar', 'financiero'] },
  { to: '/pending-orders',      icon: Clock,           label: 'Pagos Pendientes', group: 'operaciones', roles: ['admin', 'auxiliar', 'financiero'] },
  { to: '/office-expenses',     icon: Receipt,         label: 'Gtos. Oficina',    group: 'gastos-admin', roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/suppliers',           icon: Building2,       label: 'Suplidores',       group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/quotations',          icon: FileText,        label: 'Cotizaciones',     group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'financiero', 'auxiliar'] },
  { to: '/contratos-ajustados', icon: FileCheck,       label: 'Contratos Ajust.', group: 'operaciones', roles: ['admin', 'supervisor', 'operator', 'auxiliar', 'financiero'] },
  { to: '/admin-payroll/employees', icon: Users,    label: 'Empleados Adm.',  group: 'gastos-admin', roles: ['admin', 'supervisor', 'financiero'], end: true },
  { to: '/admin-payroll',           icon: FileText,  label: 'Nómina Admin.',   group: 'gastos-admin', roles: ['admin', 'supervisor', 'financiero'], end: true },
  { to: '/reports',             icon: BarChart3,       label: 'Reportes',         group: 'reportes',    roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/export',              icon: Download,        label: 'Exportar Excel',   group: 'reportes',    roles: ['admin', 'supervisor', 'financiero', 'auxiliar'] },
  { to: '/users',               icon: Users,           label: 'Usuarios',         group: 'admin',       roles: ['admin'] },
  { to: '/notification-contacts', icon: Bell,          label: 'Contactos Notif.', group: 'admin',       roles: ['admin'] },
  { to: '/categories',          icon: Tag,             label: 'Categorías',       group: 'admin',       roles: ['admin'] },
  { to: '/cards',               icon: CreditCard,      label: 'Tarjetas',         group: 'admin',       roles: ['admin'] },
  { to: '/monitoring',          icon: Activity,        label: 'Monitoreo',        group: 'admin',       roles: ['admin'] },
];

const GROUP_LABELS: Record<string, string> = {
  principal:    '',
  operaciones:  'Operaciones',
  'gastos-admin': 'Gastos Administrativos',
  reportes:     'Reportes',
  admin:        'Administración',
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

function SidebarFooter({
  userRole,
  isPreviewing,
  viewAsRole,
  userName,
  onLogout,
}: {
  userRole: string;
  isPreviewing: boolean;
  viewAsRole: string | null;
  userName: string | undefined;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
      {userRole === 'admin' && (
        <div className="px-1">
          <RoleViewSwitcher dropUp />
        </div>
      )}
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: '#F5C218' }}>
          <span className="text-[#1C1C1C] text-sm font-bold font-['Barlow_Condensed']">
            {userName?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate font-['DM_Sans'] leading-tight">{userName}</p>
          <p className="text-[10px] text-gray-500 truncate uppercase tracking-wide font-['Barlow_Condensed'] leading-tight">
            {isPreviewing ? `Admin · ${viewAsRole}` : userRole}
          </p>
        </div>
        <button onClick={onLogout} className="text-gray-600 hover:text-red-400 transition-colors" title="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
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
  to, icon: Icon, label, onClick, onUnpin, end,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  onUnpin?: () => void;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end ?? to === '/'}
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
      id="nav-more-popover"
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
          {g.items.map(({ to, icon: Icon, label, end }) => (
            <div key={to} className="flex items-center group/row">
              <NavLink
                to={to}
                end={end ?? to === '/'}
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

  const handlePin = useCallback((to: string) => {
    pin(to);
    setPopoverOpen(false);
  }, [pin]);

  const handleClose = useCallback(() => setPopoverOpen(false), []);

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
        <>
          <nav className="flex-1 px-2 pb-4 overflow-y-auto">
            {pinnedGroups.map(({ key, label, items }) => (
              <NavGroup key={key} label={label}>
                {items.map(({ to, icon, label: itemLabel, end }) => (
                  <NavItemLink
                    key={to}
                    to={to}
                    icon={icon}
                    label={itemLabel}
                    end={end}
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
                  aria-expanded={popoverOpen}
                  aria-controls="nav-more-popover"
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
          <SidebarFooter
            userRole={userRole}
            isPreviewing={isPreviewing}
            viewAsRole={viewAsRole ?? null}
            userName={user?.name}
            onLogout={handleLogout}
          />
        </>
      </aside>

      {/* Floating popover — rendered outside aside so it overflows correctly */}
      {popoverOpen && (
        <NavPopover
          unpinnedGroups={unpinnedGroups}
          anchorTop={anchorTop}
          onPin={handlePin}
          onClose={handleClose}
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
          <button onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <>
          <nav className="flex-1 px-2 pb-4 overflow-y-auto">
            {groups.map(({ key, label, items }) => (
              <NavGroup key={key} label={label}>
                {items.map(({ to, icon, label: itemLabel }) => (
                  <NavItemLink key={to} to={to} icon={icon} label={itemLabel} onClick={() => setSidebarOpen(false)} />
                ))}
              </NavGroup>
            ))}
          </nav>
          <SidebarFooter
            userRole={userRole}
            isPreviewing={isPreviewing}
            viewAsRole={viewAsRole ?? null}
            userName={user?.name}
            onLogout={handleLogout}
          />
        </>
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
