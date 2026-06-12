import { useState, useCallback, useEffect } from 'react';

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin:      ['/', '/projects', '/expenses', '/payrolls', '/reports'],
  supervisor: ['/', '/projects', '/expenses', '/payrolls', '/quotations'],
  operator:   ['/', '/projects', '/expenses', '/payrolls'],
  auxiliar:   ['/', '/expenses', '/payment-orders', '/payrolls'],
  financiero: ['/', '/expenses', '/payment-orders', '/reports', '/export'],
};

function storageKey(userId: string) {
  return `pinned_nav_${userId}`;
}

function load(userId: string, role: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return ROLE_DEFAULTS[role] ?? ['/'];
}

function save(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch { /* ignore */ }
}

export function usePinnedNav(userId: string, role: string): {
  pinnedIds: string[];
  pin: (to: string) => void;
  unpin: (to: string) => void;
} {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => load(userId, role));

  useEffect(() => {
    setPinnedIds(load(userId, role));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pin = useCallback((to: string) => {
    setPinnedIds((prev) => {
      if (prev.includes(to)) return prev;
      const next = [...prev, to];
      save(userId, next);
      return next;
    });
  }, [userId]);

  const unpin = useCallback((to: string) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== to);
      save(userId, next);
      return next;
    });
  }, [userId]);

  return { pinnedIds, pin, unpin };
}
