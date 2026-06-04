import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Receipt, Users,
  Tag, LogOut, Menu, X, ChevronRight, BarChart3, Download, Wallet, Activity, FileText, CreditCard, Clock,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api';
import clsx from 'clsx';

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',   icon: FolderOpen,      label: 'Proyectos' },
  { to: '/expenses',   icon: Receipt,         label: 'Gastos' },
  { to: '/reports',    icon: BarChart3,        label: 'Reportes' },
  { to: '/payrolls',    icon: Wallet,    label: 'Nóminas' },
  { to: '/quotations', icon: FileText, label: 'Cotizaciones' },
  { to: '/export',      icon: Download,  label: 'Exportar Excel', adminOnly: true },
  { to: '/users',       icon: Users,     label: 'Usuarios',       adminOnly: true },
  { to: '/categories',  icon: Tag,        label: 'Categorías',     adminOnly: true },
  { to: '/pending-orders',   icon: Clock,      label: 'Pagos Pendientes' },
  { to: '/payment-orders',  icon: FileText,   label: 'Órd. de Pago',    adminOnly: true },
  { to: '/office-expenses', icon: Receipt,    label: 'Gtos. Oficina',   adminOnly: true },
  { to: '/cards',           icon: CreditCard, label: 'Tarjetas',        adminOnly: true },
  { to: '/monitoring',  icon: Activity,   label: 'Monitoreo',      adminOnly: true },
];

// Ícono SVG de la aplicación
function AppIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 1L39 11.5V36.5L20 47L1 36.5V11.5Z" fill="#1C1C1C" stroke="#F5C218" strokeWidth="1.5"/>
      <line x1="6"  y1="34" x2="22" y2="14" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
      <line x1="13" y1="38" x2="34" y2="14" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
      <line x1="18" y1="34" x2="34" y2="18" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
}

export default function Layout() {
  const { user, clearAuth, refreshToken } = useAuthStore();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  const visibleItems = navItems.filter((i) => !i.adminOnly || isAdmin);

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
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                 style={{ background: '#F5C218' }}>
              <span className="text-gray-900 text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user?.role?.name}</p>
            </div>
            <button onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition-colors" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
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

        <nav className="flex-1 px-3 py-4 space-y-0.5">
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

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
                 style={{ background: '#F5C218' }}>
              <span className="text-gray-900 font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.name}</p>
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
        {/* Header móvil */}
        <header className="md:hidden sticky top-0 z-20 border-b border-gray-200 px-4 py-3 flex items-center gap-3"
                style={{ background: '#1C1C1C' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-1">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <AppIcon className="w-6 h-7 shrink-0" />
            <span className="font-bold text-white text-sm tracking-wide">Sistema de Gastos</span>
          </div>
        </header>

        {/* Página */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Pie de página — créditos */}
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
