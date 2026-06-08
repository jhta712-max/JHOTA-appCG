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
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: '#F5C218' }}>
              <Bell className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Notificaciones</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-400">
                  {unreadCount} nuevas
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Actions */}
        <div className="px-4 py-3 border-b border-white/10 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar notificaciones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 text-white text-sm rounded-lg pl-9 pr-3 py-2 border border-white/10 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-colors"
            />
          </div>

          {/* Filters */}
          {notifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TYPES.filter((type) =>
                notifications.some((n) => n.type === type.id)
              ).map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleTypeFilter(type.id)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                    selectedTypes.includes(type.id)
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {notifications.length > 0 && (
            <div className="flex gap-2 pt-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-1"
                  style={{ color: '#F5C218', background: 'rgba(245, 194, 24, 0.1)' }}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Leer todas
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <div className="animate-spin w-5 h-5 border-2 border-gray-600 border-t-yellow-400 rounded-full mx-auto mb-3" />
              Cargando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No hay notificaciones</p>
              <p className="text-gray-500 text-xs mt-1">Aquí aparecerán tus alertas y actualizaciones</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Sin resultados</p>
              <p className="text-gray-500 text-xs mt-1">Intenta otro filtro o búsqueda</p>
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  {/* Tipo header */}
                  <div className="px-6 py-2 bg-white/3 border-b border-white/5 sticky top-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {NOTIFICATION_TYPES.find((t) => t.id === type)?.label || type}
                    </p>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-white/5">
                    {items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-6 py-4 flex items-start gap-3 transition-colors hover:bg-white/5 ${
                          !n.isRead ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {TYPE_ICON[n.type] ?? <Bell className="w-5 h-5 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug font-medium ${
                              !n.isRead ? 'text-white font-semibold' : 'text-gray-300'
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 leading-snug line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#F5C218' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
