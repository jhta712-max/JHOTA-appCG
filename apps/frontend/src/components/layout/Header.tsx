import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import RoleViewSwitcher from './RoleViewSwitcher';

export default function Header() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* ignore */
    }
    clearAuth();
    navigate('/login');
  };

  return (
    <header
      className="h-16 border-b border-white/10 flex items-center justify-between px-6 fixed top-0 right-0 left-60 z-20 md:block hidden"
      style={{ background: '#1C1C1C' }}
    >
      {/* Left section */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Role Switcher (Admin only) */}
        {user?.role?.name === 'admin' && (
          <div className="hidden lg:block">
            <RoleViewSwitcher compact />
          </div>
        )}

        {/* User Info + Actions */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-semibold text-sm"
            style={{ background: '#F5C218', color: '#1C1C1C' }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>

          {/* User name (hidden on small screens) */}
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate capitalize">{user?.role?.name}</p>
          </div>

          {/* Notifications */}
          <div className="border-l border-white/10 pl-3">
            <NotificationBell compact />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
