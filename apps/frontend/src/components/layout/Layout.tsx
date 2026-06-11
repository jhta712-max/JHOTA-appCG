import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Receipt, Users,
  Tag, LogOut, Menu, X, ChevronRight, BarChart3, Download, Wallet, Activity, FileText, CreditCard, Clock,
  Eye, ChevronDown, Building2, Bell, FileCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api';
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
          'flex items-center gap-1.5 border text-xs font-medium transition-colors font-[\'DM_Sans\']',
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
                'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 font-[\'DM_Sans\']',
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
      <div className="space-y-px">
        {children}
      </div>
    </div>
  );
}

function NavItemLink({ to, icon: Icon, label, onClick }: { to: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors relative font-[\'DM_Sans\']',
        isActive
          ? 'text-[#1C1C1C] font-semibold'
          : 'text-gray-400 hover:text-white hover:bg-white/8',
      )}
      style={({ isActive }) => isActive ? { background: '#F5C218' } : {}}
    >
      {({ isActive }) => (
        <>
          {!isActive && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-white/20" />
          )}
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, viewAsRole, clearAuth, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole      = user?.role?.name ?? '';
  const effectiveRole = (userRole === 'admin' && viewAsRole) ? viewAsRole : userRole;
  const isPreviewing  = userRole === 'admin' && !!viewAsRole;

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const visibleItems = navItems.filter((i) => !i.roles || i.roles.includes(effectiveRole));

  // Group items preserving order
  const groups: { key: string; label: string; items: NavItem[] }[] = [];
  for (const item of visibleItems) {
    const gKey = item.group ?? 'principal';
    let g = groups.find((g) => g.key === gKey);
    if (!g) { g = { key: gKey, label: GROUP_LABELS[gKey] ?? gKey, items: [] }; groups.push(g); }
    g.items.push(item);
  }

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {/* Nav */}
      <nav className="flex-1 px-2 pb-4 overflow-y-auto">
        {groups.map(({ key, label, items }) => (
          <NavGroup key={key} label={label}>
            {items.map(({ to, icon, label: itemLabel }) => (
              <NavItemLink key={to} to={to} icon={icon} label={itemLabel} onClick={onNavClick} />
            ))}
          </NavGroup>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
        {userRole === 'admin' && (
          <div className="px-1">
            <RoleViewSwitcher dropUp />
          </div>
        )}
        <div className="flex items-center gap-3 px-2 py-2">
          {/* Square avatar — industrial */}
          <div className="w-8 h-8 flex items-center justify-center shrink-0"
               style={{ background: '#F5C218' }}>
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
          <button onClick={handleLogout}
            className="text-gray-600 hover:text-red-400 transition-colors" title="Cerrar sesión">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">

      {/* ── Sidebar desktop ──────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 fixed inset-y-0 left-0 z-30"
             style={{ background: '#1C1C1C' }}>
        {/* Logo */}
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

        <SidebarContent />
      </aside>

      {/* ── Overlay móvil ────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar móvil (drawer) ────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 w-72 z-50 flex flex-col transition-transform duration-300 md:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )} style={{ background: '#1C1C1C' }}>
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

        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* ── Contenido principal ───────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen min-w-0">

        {/* Header móvil */}
        <header className="md:hidden sticky top-0 z-20 border-b border-white/10 px-4 py-3 flex items-center gap-3"
                style={{ background: '#1C1C1C' }}>
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

        {/* Banner de vista previa */}
        {isPreviewing && (
          <div className="hidden md:flex items-center justify-between border-b px-6 py-2"
               style={{ background: '#F5C218' }}>
            <p className="text-xs font-semibold text-[#1C1C1C] flex items-center gap-2 font-['DM_Sans']">
              <Eye className="w-3.5 h-3.5" />
              Viendo interfaz como <strong className="uppercase">{viewAsRole}</strong> — datos reales.
            </p>
          </div>
        )}

        {/* Página */}
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
