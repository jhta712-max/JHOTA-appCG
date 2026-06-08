import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../api';
import NotificationPanel from './NotificationPanel';
import { useState } from 'react';

interface NotificationBellProps {
  compact?: boolean;
}

export default function NotificationBell({ compact = false }: NotificationBellProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.unreadCount(),
    select: (r) => r.data.data.count,
    refetchInterval: 30_000,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    select: (r) => r.data.data,
    enabled: panelOpen,
  });

  const unreadCount = countData ?? 0;

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className={`relative p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${
          compact ? 'p-1.5' : ''
        }`}
        aria-label="Notificaciones"
        title="Notificaciones"
      >
        <Bell className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        {unreadCount > 0 && (
          <span
            className={`absolute top-0 right-0 flex items-center justify-center font-bold text-white rounded-full leading-none ${
              compact ? 'w-3 h-3 text-[8px]' : 'w-4 h-4 text-[10px]'
            }`}
            style={{ background: '#F5C218' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={isLoading}
      />
    </>
  );
}
