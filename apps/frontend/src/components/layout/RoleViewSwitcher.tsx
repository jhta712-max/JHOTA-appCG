import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Eye, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

const ROLE_OPTIONS = [
  { value: '', label: 'Admin (mi rol)' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'auxiliar', label: 'Auxiliar administrativo' },
  { value: 'financiero', label: 'Financiero' },
];

export default function RoleViewSwitcher({ compact = false, dropUp = false }: { compact?: boolean; dropUp?: boolean }) {
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
          'flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors',
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
          isPreviewing
            ? 'bg-amber-100/20 border-amber-400/30 text-amber-400 hover:bg-amber-100/30'
            : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20',
        )}
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span className="hidden sm:inline">Vista:</span>}
        <span className="max-w-[100px] truncate">{current.label}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute right-0 w-52 bg-gray-900 rounded-xl shadow-xl border border-white/10 py-1 z-50',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Ver interfaz como
          </p>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setViewAsRole(opt.value || null);
                setOpen(false);
              }}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                (viewAsRole ?? '') === opt.value
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'text-gray-300 hover:bg-white/5',
              )}
            >
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  (viewAsRole ?? '') === opt.value ? 'bg-amber-400' : 'bg-white/20',
                )}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
