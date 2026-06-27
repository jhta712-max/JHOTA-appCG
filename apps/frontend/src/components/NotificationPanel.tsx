import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, X, AlertTriangle, Clock, Banknote, Bell, Search } from 'lucide-react';
import { notificationsApi } from '../api';
import { useThemeStore } from '../stores/themeStore';
import type { AppNotification } from '../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  BUDGET_80: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  BUDGET_90: <AlertTriangle className="w-5 h-5 text-red-500" />,
  PENDING_ORDERS: <Clock className="w-5 h-5 text-orange-500" />,
  PAYROLL_UNPAID: <Banknote className="w-5 h-5 text-purple-500" />,
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
}

const NOTIFICATION_TYPES = [
  { id: 'BUDGET_80', label: 'Presupuesto 80%', color: 'text-amber-400' },
  { id: 'BUDGET_90', label: 'Presupuesto 90%', color: 'text-red-400' },
  { id: 'PENDING_ORDERS', label: 'Órdenes Pendientes', color: 'text-orange-400' },
  { id: 'PAYROLL_UNPAID', label: 'Nóminas Sin Pagar', color: 'text-purple-400' },
];

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  isLoading,
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const { theme } = useThemeStore();

  const isDark = theme === 'dark';

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      document.body.style.overflow = 'auto';
    };
  }, [open, onClose]);

  // Filtrar notificaciones por tipo y búsqueda
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filtrar por tipo
    if (selectedTypes.length > 0) {
      filtered = filtered.filter((n) => selectedTypes.includes(n.type));
    }

    // Filtrar por búsqueda
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [notifications, selectedTypes, search]);

  // Agrupar por tipo
  const grouped = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    filteredNotifications.forEach((n) => {
      if (!groups[n.type]) groups[n.type] = [];
      groups[n.type].push(n);
    });
    return groups;
  }, [filteredNotifications]);

  function toggleTypeFilter(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  function handleClick(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) {
      navigate(n.link);
      onClose();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel deslizante */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-screen w-full sm:w-96 z-50 transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'} border-l`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-white/10' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: '#1D4ED8' }}>
              <Bell className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h2 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>Notificaciones</h2>
              {unreadCount > 0 && (
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {unreadCount} nuevas
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-white hover:bg-white/10'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
            }`}
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Actions */}
        <div className={`px-4 py-3 border-b space-y-3 ${
          isDark ? 'border-white/10' : 'border-gray-200'
        }`}>
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full text-sm rounded-lg pl-9 pr-3 py-2 border transition-colors outline-none ${
                isDark
                  ? 'bg-white/5 text-white border-white/10 placeholder-gray-500 focus:bg-white/10 focus:border-white/20'
                  : 'bg-gray-50 text-gray-900 border-gray-300 placeholder-gray-400 focus:bg-white focus:border-gray-400'
              }`}
            />
          </div>

          {/* Filters */}
          {notifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TYPES.filter((type) =>
                notifications.some((n) => n.type === type.id)
              ).map((type) => {
                const count = notifications.filter((n) => n.type === type.id).length;
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleTypeFilter(type.id)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      selectedTypes.includes(type.id)
                        ? isDark
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-900'
                        : isDark
                          ? 'bg-white/5 text-gray-400 hover:bg-white/10'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isDark ? 'bg-white/10' : 'bg-white'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-1 ${
                  isDark
                    ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                    : 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200'
                } disabled:opacity-50`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Leer todas
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
          {isLoading ? (
            <div className={`py-12 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <div className={`animate-spin w-5 h-5 border-2 rounded-full mx-auto mb-3 ${
                isDark ? 'border-gray-600 border-t-yellow-400' : 'border-gray-300 border-t-yellow-500'
              }`} />
              Cargando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Bell className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No hay notificaciones</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Aquí aparecerán tus alertas y actualizaciones</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Bell className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sin resultados</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Intenta otro filtro o búsqueda</p>
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  {/* Tipo header */}
                  <div className={`px-6 py-2 sticky top-0 border-b ${
                    isDark
                      ? 'bg-white/3 border-white/5'
                      : 'bg-gray-100 border-gray-200'
                  }`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {NOTIFICATION_TYPES.find((t) => t.id === type)?.label || type}
                    </p>
                  </div>

                  {/* Items */}
                  <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-200'}`}>
                    {items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-6 py-4 flex items-start gap-3 transition-colors ${
                          isDark
                            ? `hover:bg-white/5 ${!n.isRead ? 'bg-white/5' : ''}`
                            : `hover:bg-gray-100 ${!n.isRead ? 'bg-yellow-50' : ''}`
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {TYPE_ICON[n.type] ?? <Bell className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug font-medium ${
                              !n.isRead
                                ? isDark
                                  ? 'text-white font-semibold'
                                  : 'text-gray-900 font-semibold'
                                : isDark
                                  ? 'text-gray-300'
                                  : 'text-gray-700'
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className={`text-xs mt-1 leading-snug line-clamp-2 ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {n.message}
                          </p>
                          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <span
                            className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: '#1D4ED8' }}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with stats */}
        {notifications.length > 0 && (
          <div className={`border-t px-6 py-3 text-xs ${
            isDark
              ? 'border-white/10 text-gray-500'
              : 'border-gray-200 text-gray-500'
          }`}>
            <div className="flex justify-between">
              <span>{notifications.length} total</span>
              <span>{unreadCount} no leída{unreadCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
