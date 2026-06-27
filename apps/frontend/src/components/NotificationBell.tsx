import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, X, AlertTriangle, Clock, Banknote } from 'lucide-react';
import { notificationsApi } from '../api';
import type { AppNotification } from '../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60)   return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  BUDGET_80:      <AlertTriangle className="w-4 h-4 text-amber-500" />,
  BUDGET_90:      <AlertTriangle className="w-4 h-4 text-red-500" />,
  PENDING_ORDERS: <Clock         className="w-4 h-4 text-orange-500" />,
  PAYROLL_UNPAID: <Banknote      className="w-4 h-4 text-purple-500" />,
};

export default function NotificationBell() {
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn:  () => notificationsApi.unreadCount(),
    select:   (r) => r.data.data.count,
    refetchInterval: 30_000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationsApi.list(),
    select:   (r) => r.data.data,
    enabled:  open,
  });

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

  const unreadCount = countData ?? 0;

  function handleClick(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2.5 transition-all hover:scale-110 hover:shadow-lg"
        style={{
          background: '#1D4ED8',
          color: '#0D1B48',
        }}
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[11px] font-bold flex items-center justify-center leading-none shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">
              Notificaciones
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5">
                  {unreadCount} nuevas
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 px-2 py-1 hover:bg-primary-50 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Leer todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[70vh]">
            {isLoading ? (
              <div className="py-10 text-center text-gray-400 text-sm">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] ?? <Bell className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 w-2 h-2 bg-blue-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
