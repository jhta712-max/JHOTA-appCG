import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, X, AlertTriangle, Clock, Banknote, Bell } from 'lucide-react';
import { notificationsApi } from '../api';
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
        }`}
        style={{ background: '#1C1C1C' }}
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

        {/* Actions */}
        {unreadCount > 0 && (
          <div className="px-6 py-3 border-b border-white/10">
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              style={{ color: '#F5C218' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 194, 24, 0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como leídas
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <div className="animate-spin w-5 h-5 border-2 border-gray-600 border-t-yellow-400 rounded-full mx-auto mb-3" />
              Cargando notificaciones...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No hay notificaciones</p>
              <p className="text-gray-500 text-xs mt-1">Aquí aparecerán tus alertas y actualizaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {notifications.map((n) => (
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
          )}
        </div>
      </div>
    </>
  );
}
