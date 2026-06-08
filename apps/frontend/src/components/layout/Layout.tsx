import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Receipt, Users,
  Tag, LogOut, Menu, X, ChevronRight, BarChart3, Download, Wallet, Activity, FileText, CreditCard, Clock,
  Building2, FileCheck, Bell, Eye,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api';
import clsx from 'clsx';
import Header from './Header';
import RoleViewSwitcher from './RoleViewSwitcher';
import ThemeToggle from '../ThemeToggle';

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: string[];
};

const navItems: NavItem[] = [
  { to: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',        icon: FolderOpen,      label: 'Proyectos',        roles: ['admin', 'supervisor', 'operator', 'financiero'] },
  { to: '/expenses',        icon: Receipt,         label: 'Gastos',           roles: ['admin', 'supervisor', 'operator', 'financiero'] },
  { to: '/reports',         icon: BarChart3,       label: 'Reportes',         roles: ['admin', 'supervisor', 'financiero'] },
  { to: '/payrolls',        icon: Wallet,          label: 'Nóminas',          roles: ['admin', 'supervisor', 'operator', 'auxiliar'] },
  { to: '/quotations',      icon: FileText,        label: 'Cotizaciones',     roles: ['admin', 'supervisor', 'operator', 'financiero'] },
  { to: '/suppliers',       icon: Building2,       label: 'Suplidores',       roles: ['admin', 'supervisor', 'operator', 'financiero'] },
  { to: '/contratos-ajustados', icon: FileCheck,  label: 'Contratos Ajust.', roles: ['admin', 'supervisor', 'operator'] },
  { to: '/pending-orders',  icon: Clock,           label: 'Pagos Pendientes', roles: ['admin', 'supervisor', 'auxiliar'] },
  { to: '/export',          icon: Download,        label: 'Exportar Excel',   roles: ['admin', 'supervisor', 'financiero'] },
  { to: '/office-expenses', icon: Receipt,         label: 'Gtos. Oficina',    roles: ['admin', 'supervisor', 'financiero'] },
  { to: '/payment-orders',  icon: FileText,        label: 'Órd. de Pago',    roles: ['admin', 'supervisor'] },
  { to: '/users',                 icon: Users,      label: 'Usuarios',         roles: ['admin'] },
  { to: '/notification-contacts', icon: Bell,       label: 'Contactos Notif.', roles: ['admin'] },
  { to: '/categories',            icon: Tag,        label: 'Categorías',       roles: ['admin'] },
  { to: '/cards',                 icon: CreditCard, label: 'Tarjetas',         roles: ['admin'] },
  { to: '/monitoring',            icon: Activity,   label: 'Monitoreo',        roles: ['admin'] },
];

// Ícono de la aplicación
function AppIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <img src="/logo.png" alt="SERVINGMI" className={className} style={{ objectFit: 'contain' }}/>
  );
}

export default function Layout() {
  const { user, viewAsRole, clearAuth, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole     = user?.role?.name ?? '';
  const effectiveRole = (userRole === 'admin' && viewAsRole) ? viewAsRole : userRole;
  const isPreviewing  = userRole === 'admin' && !!viewAsRole;

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const visibleItems = navItems.filter((i) => !i.roles || i.roles.includes(effectiveRole));

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">

      {/* ── Sidebar desktop ──────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 fixed inset-y-0 left-0 z-30"
             style={{ background: '#1C1C1C' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <AppIcon className="w-9 h-10 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight tracking-wide">Sistema de Gastos</p>
            <p className="text-xs text-gray-400 truncate leading-tight">Control de Proyectos</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/10',
              )}
              style={({ isActive }) => isActive ? { background: '#F5C218' } : {}}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-white/10 p-3">
          {userRole === 'admin' && (
            <div className="mb-2 px-1">
              <RoleViewSwitcher dropUp compact />
            </div>
          )}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-semibold"
                 style={{ background: '#F5C218', color: '#1C1C1C' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">
                {isPreviewing ? `Viendo como ${viewAsRole}` : userRole}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Overlay móvil ────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar móvil (drawer) ────────────────────────── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 w-72 z-50 flex flex-col transition-transform duration-300 md:hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )} style={{ background: '#1C1C1C' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <AppIcon className="w-8 h-9 shrink-0" />
            <div>
              <p className="font-bold text-white tracking-wide">Sistema de Gastos</p>
              <p className="text-xs text-gray-400">Control de Proyectos</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'text-gray-900 font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/10',
              )}
              style={({ isActive }) => isActive ? { background: '#F5C218' } : {}}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 shrink-0">
          {userRole === 'admin' && (
            <div className="mb-2">
              <RoleViewSwitcher dropUp />
            </div>
          )}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                 style={{ background: '#F5C218' }}>
              <span className="text-gray-900 font-bold text-sm">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">
                {isPreviewing ? `Admin · viendo como ${viewAsRole}` : userRole}
              </p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 font-medium w-full px-3 py-2 rounded-lg hover:bg-red-900/30 transition-colors">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ───────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen min-w-0">

        {/* Header desktop */}
        <Header />

        {/* Header móvil */}
        <header className="md:hidden sticky top-0 z-20 border-b border-white/10 px-4 py-3 flex items-center gap-3"
                style={{ background: '#1C1C1C' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AppIcon className="w-6 h-7 shrink-0" />
            <span className="font-bold text-white text-sm tracking-wide">Sistema de Gastos</span>
          </div>
          <ThemeToggle />
          <RoleViewSwitcher compact />
        </header>

        {/* Banner de vista previa */}
        {isPreviewing && (
          <div className="flex items-center justify-between px-6 py-2 border-b" style={{ background: '#F5C218', borderColor: '#E5B300' }}>
            <p className="text-xs font-medium flex items-center gap-2" style={{ color: '#1C1C1C' }}>
              <Eye className="w-3.5 h-3.5" />
              Viendo como <strong>{viewAsRole}</strong> — Los datos son reales
            </p>
          </div>
        )}

        {/* Página */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        <footer className="border-t border-gray-100 bg-white py-3 px-6 text-center">
          <p className="text-xs text-gray-400">
            Desarrollado con{' '}
            <span className="font-medium text-gray-500">Cowork Claude AI</span>
            {' '}· © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
