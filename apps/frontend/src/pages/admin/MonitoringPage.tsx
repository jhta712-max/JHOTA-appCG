import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Database, Cpu, Clock, AlertTriangle, CheckCircle,
  XCircle, RefreshCw, TrendingUp, Zap, Users, FileText,
  Wallet, Server, AlertOctagon, Info, Bot, Sparkles,
  ThumbsUp, AlertCircle, Lightbulb, CreditCard, Pencil, Trash2,
  Download, Plus,
} from 'lucide-react';
import { monitoringApi, serviceSubscriptionsApi, type SystemLog, type AiAnalysisResult } from '../../api';
import type { ServiceSubscription, SubscriptionsOverview } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useRole } from '../../hooks/useRole';
import { Navigate } from 'react-router-dom';

// ─── Helpers ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  healthy:   { label: 'Saludable',  color: 'text-green-400',  bg: 'bg-green-950/40',  border: 'border-green-800', dot: 'bg-green-400'  },
  degraded:  { label: 'Degradado', color: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-800', dot: 'bg-yellow-400' },
  unhealthy: { label: 'CAÍDO',     color: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-800',    dot: 'bg-red-400'    },
};

const LOG_CONFIG = {
  error: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-950/30',     border: 'border-red-900/50'    },
  warn:  { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-950/20',  border: 'border-yellow-900/40' },
  info:  { icon: Info,          color: 'text-blue-400',   bg: 'bg-[#111]',         border: 'border-[#222]'        },
};

function fmt(n: number) { return n.toLocaleString('es-DO'); }
function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color = 'text-[#F5C218]',
}: { icon: any; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#1C1C1C] rounded-xl border border-[#2a2a2a] p-4 hover:border-[#F5C218]/40 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#111] mt-0.5">
          <Icon className="w-4 h-4 text-gray-600 group-hover:text-[#F5C218]/60 transition-colors" />
        </div>
        <div className="min-w-0">
          <p className="font-['DM_Sans'] text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`font-['Space_Mono'] text-xl font-bold mt-0.5 ${color}`}>{value}</p>
          {sub && <p className="font-['DM_Sans'] text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────
function MiniBarChart({ data }: { data: { hour: string; requests: number; errors: number }[] }) {
  if (!data.length) return <p className="font-['DM_Sans'] text-xs text-gray-600 py-4 text-center">Sin datos</p>;
  const maxVal = Math.max(...data.map(d => d.requests), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d) => {
        const reqH  = Math.round((d.requests / maxVal) * 100);
        const errH  = Math.round((d.errors   / maxVal) * 100);
        const label = d.hour.slice(11, 16);
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full flex flex-col justify-end" style={{ height: '52px' }}>
              <div style={{ height: `${reqH}%` }} className="w-full bg-[#F5C218]/40 rounded-t-sm relative">
                {errH > 0 && (
                  <div
                    style={{ height: `${(d.errors / d.requests) * 100}%` }}
                    className="w-full bg-red-500 absolute bottom-0 rounded-t-sm"
                  />
                )}
              </div>
            </div>
            <span className="font-['Space_Mono'] text-[8px] text-gray-600 leading-none">{label}</span>
            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#F5C218] text-[#1C1C1C] text-[10px] font-['Space_Mono'] rounded px-1.5 py-0.5 whitespace-nowrap z-10 font-bold">
              {d.requests} req / {d.errors} err
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Log row ──────────────────────────────────────────────────
function LogRow({ log }: { log: SystemLog }) {
  const cfg = LOG_CONFIG[log.level] ?? LOG_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 border-b last:border-0 ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className="font-['DM_Sans'] text-sm text-gray-300 truncate">{log.message}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="font-['Space_Mono'] text-[10px] text-gray-600">{timeAgo(log.createdAt)}</span>
          {log.endpoint && (
            <span className="font-['Space_Mono'] text-[10px] text-[#F5C218]/70 bg-[#1C1C1C] px-1.5 py-0.5 rounded border border-[#2a2a2a]">
              {log.method} {log.endpoint}
            </span>
          )}
          {log.statusCode && (
            <span className={`font-['Space_Mono'] text-[10px] px-1.5 py-0.5 rounded ${log.statusCode >= 500 ? 'bg-red-950/50 text-red-400' : log.statusCode >= 400 ? 'bg-yellow-950/40 text-yellow-400' : 'bg-[#1C1C1C] text-gray-500'}`}>
              {log.statusCode}
            </span>
          )}
          <span className="font-['Space_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-[#1C1C1C] text-gray-600 border border-[#2a2a2a]">
            {log.category}
          </span>
        </div>
      </div>
      {log.duration != null && (
        <span className="font-['Space_Mono'] text-[10px] text-gray-600 whitespace-nowrap">{log.duration}ms</span>
      )}
    </div>
  );
}

// ─── Urgency Badge ────────────────────────────────────────────
function UrgencyBadge({ days }: { days: number }) {
  if (days === 0) return <span className="font-['Space_Mono'] px-2 py-0.5 rounded text-xs font-bold bg-red-950/60 text-red-400 border border-red-800">HOY</span>;
  if (days === 1) return <span className="font-['Space_Mono'] px-2 py-0.5 rounded text-xs font-bold bg-yellow-950/60 text-yellow-400 border border-yellow-800">MAÑANA</span>;
  if (days <= 3)  return <span className="font-['Space_Mono'] px-2 py-0.5 rounded text-xs font-bold bg-[#F5C218]/10 text-[#F5C218] border border-[#F5C218]/30">{days} días</span>;
  return <span className="font-['Space_Mono'] px-2 py-0.5 rounded text-xs font-bold bg-[#1C1C1C] text-gray-500 border border-[#2a2a2a]">{days} días</span>;
}

// ─── Empty form state ─────────────────────────────────────────
const EMPTY_FORM = {
  name:          '',
  provider:      '',
  description:   '',
  monthlyCost:   '',
  currency:      'USD',
  billingDay:    '1',
  paymentMethod: '',
  url:           '',
  notes:         '',
  isActive:      true,
};

// ─── Subscriptions Tab ────────────────────────────────────────
function SubscriptionsTab() {
  const { isAdmin, isSupervisor } = useRole();
  const qc = useQueryClient();

  const [formModal,    setFormModal]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<ServiceSubscription | null>(null);
  const [form,         setForm]         = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [formErr,      setFormErr]      = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery({
    queryKey:  ['monitoring', 'subscriptions'],
    queryFn:   () => serviceSubscriptionsApi.overview().then(r => (r.data as any).data as SubscriptionsOverview),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['monitoring', 'subscriptions'] });
  };

  const createMut = useMutation({
    mutationFn: (d: unknown) => serviceSubscriptionsApi.create(d),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: any) => setFormErr(e.response?.data?.error ?? 'Error al crear servicio'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => serviceSubscriptionsApi.update(id, d),
    onSuccess:  () => { invalidate(); closeModal(); },
    onError:    (e: any) => setFormErr(e.response?.data?.error ?? 'Error al actualizar servicio'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => serviceSubscriptionsApi.remove(id),
    onSuccess:  () => { invalidate(); setDeleteConfirm(null); },
    onError:    (e: any) => alert(e.response?.data?.error ?? 'Error al eliminar'),
  });

  function openCreate() {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setFormErr(null);
    setFormModal(true);
  }

  function openEdit(item: ServiceSubscription) {
    setEditingItem(item);
    setForm({
      name:          item.name,
      provider:      item.provider,
      description:   item.description ?? '',
      monthlyCost:   String(item.monthlyCost),
      currency:      item.currency,
      billingDay:    String(item.billingDay),
      paymentMethod: item.paymentMethod ?? '',
      url:           item.url ?? '',
      notes:         item.notes ?? '',
      isActive:      item.isActive,
    });
    setFormErr(null);
    setFormModal(true);
  }

  function closeModal() {
    setFormModal(false);
    setEditingItem(null);
    setFormErr(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const payload = {
      name:          form.name.trim(),
      provider:      form.provider.trim(),
      description:   form.description.trim() || undefined,
      monthlyCost:   parseFloat(form.monthlyCost) || 0,
      currency:      form.currency,
      billingDay:    parseInt(form.billingDay, 10),
      paymentMethod: form.paymentMethod.trim() || undefined,
      url:           form.url.trim() || undefined,
      notes:         form.notes.trim() || undefined,
      isActive:      form.isActive,
    };
    if (!payload.name)     { setFormErr('El nombre es requerido'); return; }
    if (!payload.provider) { setFormErr('El proveedor es requerido'); return; }
    if (payload.billingDay < 1 || payload.billingDay > 31) { setFormErr('El día de cobro debe ser entre 1 y 31'); return; }

    if (editingItem) {
      updateMut.mutate({ id: editingItem.id, d: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  async function handleExportCsv() {
    try {
      const res = await serviceSubscriptionsApi.exportCsv();
      const blob = new Blob([(res as any).data], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `suscripciones_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar CSV');
    }
  }

  const allSubs   = overview?.all      ?? [];
  const upcoming  = overview?.upcoming  ?? [];
  const activeSubs = allSubs.filter(s => s.isActive);
  const totalMonthly = activeSubs.reduce((sum, s) => sum + Number(s.monthlyCost), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CreditCard className="w-7 h-7 animate-pulse mx-auto" style={{ color: '#F5C218' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-['Barlow_Condensed'] text-lg font-bold tracking-wide uppercase text-white flex items-center gap-2">
          <CreditCard className="w-4 h-4" style={{ color: '#F5C218' }} />
          Suscripciones de Servicios
        </h2>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg font-['DM_Sans']"
            style={{ background: '#F5C218', color: '#1C1C1C' }}
          >
            <Plus className="w-4 h-4" />
            Nuevo servicio
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#1C1C1C] rounded-xl border border-[#2a2a2a] p-4">
          <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-widest">Costo mensual total</p>
          <p className="font-['Space_Mono'] text-2xl font-bold mt-1" style={{ color: '#F5C218' }}>
            ${totalMonthly.toFixed(2)}
            <span className="font-['DM_Sans'] text-sm font-normal text-gray-500 ml-1">USD</span>
          </p>
        </div>
        <div className="bg-[#1C1C1C] rounded-xl border border-[#2a2a2a] p-4">
          <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-widest">Servicios activos</p>
          <p className="font-['Space_Mono'] text-2xl font-bold text-white mt-1">{activeSubs.length}</p>
        </div>
        <div className="bg-[#1C1C1C] rounded-xl border border-[#2a2a2a] p-4">
          <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-widest">Proximos 7 dias</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-['Space_Mono'] text-2xl font-bold text-white">{upcoming.length}</p>
            {upcoming.length > 0 && (
              <span className="font-['DM_Sans'] px-2 py-0.5 rounded text-xs font-bold bg-[#F5C218]/10 text-[#F5C218] border border-[#F5C218]/30">
                {upcoming.length} pago{upcoming.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming payments */}
      {upcoming.length > 0 && (
        <div className="bg-[#1C1C1C] rounded-xl border border-[#F5C218]/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F5C218]/10 bg-[#F5C218]/5">
            <h3 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-[#F5C218] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Pagos proximos (7 dias)
            </h3>
          </div>
          <div className="divide-y divide-[#222]">
            {upcoming.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <UrgencyBadge days={item.daysUntil} />
                  <div>
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-200">{item.name}</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-600">{item.provider} · dia {item.billingDay}</p>
                  </div>
                </div>
                <span className="font-['Space_Mono'] text-sm font-semibold text-[#F5C218]">
                  ${Number(item.monthlyCost).toFixed(2)} {item.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full subscriptions table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-widest text-gray-700">Todos los servicios</h3>
          <button
            onClick={handleExportCsv}
            className="font-['DM_Sans'] flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar CSV
          </button>
        </div>

        {allSubs.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-400">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-['DM_Sans'] text-sm">No hay servicios registrados.</p>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="font-['DM_Sans'] mt-3 text-sm font-medium underline"
                style={{ color: '#F5C218' }}
              >
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="font-['Barlow_Condensed'] text-left px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Servicio</th>
                    <th className="font-['Barlow_Condensed'] text-left px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Proveedor</th>
                    <th className="font-['Barlow_Condensed'] text-right px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Costo/mes</th>
                    <th className="font-['Barlow_Condensed'] text-center px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Dia cobro</th>
                    <th className="font-['Barlow_Condensed'] text-left px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Metodo pago</th>
                    <th className="font-['Barlow_Condensed'] text-center px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Estado</th>
                    {(isSupervisor || isAdmin) && (
                      <th className="font-['Barlow_Condensed'] text-center px-4 py-2.5 text-xs font-semibold tracking-widest uppercase text-gray-500">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allSubs.map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-['DM_Sans'] font-medium text-gray-900 ${!item.isActive ? 'line-through' : ''}`}>
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="font-['DM_Sans'] text-xs text-gray-400 truncate max-w-[200px]">{item.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-['DM_Sans']">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            style={{ color: '#F5C218' }}
                          >
                            {item.provider}
                          </a>
                        ) : (
                          item.provider
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-['Space_Mono'] font-semibold text-gray-900">
                        ${Number(item.monthlyCost).toFixed(2)}
                        <span className="font-['DM_Sans'] text-xs text-gray-400 ml-1">{item.currency}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-['Space_Mono'] text-gray-600">
                        {item.billingDay}
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-gray-500 text-xs">
                        {item.paymentMethod ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isActive ? (
                          <span className="font-['DM_Sans'] px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Activo</span>
                        ) : (
                          <span className="font-['DM_Sans'] px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactivo</span>
                        )}
                      </td>
                      {(isSupervisor || isAdmin) && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteConfirm(item.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={(isSupervisor || isAdmin) ? 7 : 6} className="px-4 py-2.5">
                      <span className="font-['Barlow_Condensed'] text-xs font-semibold tracking-wide uppercase text-gray-600">
                        Total activos: ${totalMonthly.toFixed(2)} USD/mes
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-900 mb-2">Confirmar eliminacion</h3>
            <p className="font-['DM_Sans'] text-sm text-gray-500 mb-4">Esta accion no se puede deshacer. El servicio sera eliminado permanentemente.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="font-['DM_Sans'] px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => removeMut.mutate(deleteConfirm)}
                disabled={removeMut.isPending}
                className="font-['DM_Sans'] px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removeMut.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {formModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-900">
                {editingItem ? 'Editar servicio' : 'Nuevo servicio'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formErr && (
                <div className="flex items-center gap-2 font-['DM_Sans'] text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formErr}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ej. Backend API"
                    className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required
                  />
                </div>
                <div>
                  <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">
                    Proveedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.provider}
                    onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                    placeholder="ej. Render, GitHub"
                    className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">Descripcion</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripcion breve del servicio"
                  className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">
                    Costo mensual <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.monthlyCost}
                    onChange={e => setForm(f => ({ ...f, monthlyCost: e.target.value }))}
                    placeholder="0.00"
                    className="font-['Space_Mono'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required
                  />
                </div>
                <div>
                  <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="USD">USD</option>
                    <option value="DOP">DOP</option>
                  </select>
                </div>
                <div>
                  <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">
                    Dia de cobro <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.billingDay}
                    onChange={e => setForm(f => ({ ...f, billingDay: e.target.value }))}
                    className="font-['Space_Mono'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">Metodo de pago</label>
                <input
                  type="text"
                  value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  placeholder="ej. Tarjeta de credito"
                  className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">URL del servicio</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://dashboard.render.com"
                  className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="font-['DM_Sans'] block text-xs font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Notas adicionales..."
                  className="font-['DM_Sans'] w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
              </div>

              {editingItem && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded accent-yellow-400"
                  />
                  <span className="font-['DM_Sans'] text-sm text-gray-700">Servicio activo</span>
                </label>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="font-['DM_Sans'] px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="font-['DM_Sans'] px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                >
                  {createMut.isPending || updateMut.isPending ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────
type TabId = 'dashboard' | 'suscripciones';

// ─── Main Page ────────────────────────────────────────────────
export default function MonitoringPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin';
  const isSupervisorOrAdmin = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const [logLevel,     setLogLevel]     = useState<string>('');
  const [logCat,       setLogCat]       = useState<string>('');
  const [logPage,      setLogPage]      = useState(1);
  const [backupLoading, setBackupLoading] = useState(false);

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const apiUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
      const res = await fetch(`${apiUrl}/backup/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al generar backup');
      if (!res.ok) {
        const errBody = await res.text();
        alert('Error ' + res.status + ': ' + errBody.slice(0, 300));
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `backup_servingmi_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Error al descargar backup: ' + e.message);
    } finally {
      setBackupLoading(false);
    }
  }

  // IA
  const [aiResult,  setAiResult]  = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState<string | null>(null);

  async function handleAiAnalyze() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await monitoringApi.aiAnalyze();
      setAiResult(res.data.data);
    } catch (err: any) {
      setAiError(err?.response?.data?.error ?? 'No se pudo completar el análisis de IA');
    } finally {
      setAiLoading(false);
    }
  }

  const { data: dashData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey:  ['monitoring-dashboard'],
    queryFn:   () => monitoringApi.dashboard().then(r => r.data.data),
    refetchInterval: 60_000,
    staleTime:       30_000,
    retry: 1,
    enabled: isSupervisorOrAdmin,
  });

  const { data: logsData } = useQuery({
    queryKey: ['monitoring-logs', logLevel, logCat, logPage],
    queryFn:  () => monitoringApi.logs({
      level:    logLevel  || undefined,
      category: logCat    || undefined,
      page:     logPage,
      limit:    30,
    }).then(r => r.data),
    staleTime: 15_000,
    enabled: !!dashData,
  });

  // Protección: admin y supervisor (DESPUÉS de todos los hooks)
  if (!isSupervisorOrAdmin) return <Navigate to="/" replace />;

  // Tab navigation
  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'dashboard',     label: 'Dashboard',     icon: Activity    },
    { id: 'suscripciones', label: 'Suscripciones', icon: CreditCard  },
  ];

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Hero header band */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-2" style={{ background: '#1C1C1C' }}>
        <div className="max-w-6xl flex items-start justify-between gap-4">
          <div>
            <p className="font-['Barlow_Condensed'] text-xs tracking-[0.25em] uppercase mb-1" style={{ color: '#F5C218' }}>
              ADMINISTRACIÓN / SISTEMA
            </p>
            <h1 className="font-['Barlow_Condensed'] text-4xl font-bold tracking-tight text-white uppercase">
              Monitoreo del Sistema
            </h1>
            {dashData && (
              <p className="font-['DM_Sans'] text-sm text-gray-500 mt-1">
                Última actualización: {new Date(dashData.generatedAt).toLocaleTimeString('es-DO')}
              </p>
            )}
            <div className="mt-2 w-12 h-0.5" style={{ background: '#F5C218' }} />
          </div>
          <div className="flex gap-2 shrink-0 mt-1">
            {isAdmin && activeTab === 'dashboard' && (
              <button
                onClick={handleBackup}
                disabled={backupLoading}
                className="font-['DM_Sans'] flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-2 border-green-500 text-green-400 rounded-lg hover:bg-green-950/40 disabled:opacity-50 transition-colors"
                title="Descargar backup completo de la base de datos"
              >
                {backupLoading ? '⏳ Generando...' : '💾 Backup BD'}
              </button>
            )}
            {activeTab === 'dashboard' && (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="font-['DM_Sans'] flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#333] text-gray-400 rounded-lg hover:border-[#444] hover:text-gray-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#2a2a2a] bg-[#1C1C1C] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`font-['Barlow_Condensed'] flex items-center gap-1.5 px-5 py-3 text-sm font-bold tracking-widest uppercase border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#F5C218] text-[#F5C218]'
                  : 'border-transparent text-gray-600 hover:text-gray-400 hover:border-[#444]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Suscripciones tab ────────────────────────────────── */}
      {activeTab === 'suscripciones' && <SubscriptionsTab />}

      {/* ── Dashboard tab ──────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Activity className="w-8 h-8 animate-pulse mx-auto mb-2" style={{ color: '#F5C218' }} />
                <p className="font-['DM_Sans'] text-sm text-gray-600">Cargando datos del sistema…</p>
              </div>
            </div>
          ) : isError || !dashData ? (
            <div className="bg-red-950/30 border border-red-800 rounded-xl p-6 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-['Barlow_Condensed'] font-bold text-red-400 tracking-wide uppercase">No se pudo cargar el dashboard</p>
                <p className="font-['DM_Sans'] text-sm text-red-500/80 mt-1">
                  {(error as any)?.response?.data?.error ?? 'Error al conectar con el backend. Verifica que el servidor esté corriendo.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="font-['DM_Sans'] mt-3 flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                </button>
              </div>
            </div>
          ) : (() => {
            const d = dashData;
            const statusCfg = STATUS_CONFIG[d.health.status] ?? STATUS_CONFIG.healthy;
            return (
              <>
                {/* Status banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${statusCfg.bg} ${statusCfg.border}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusCfg.dot} ${d.health.status !== 'healthy' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1">
                    <span className={`font-['Barlow_Condensed'] font-bold text-sm tracking-wide uppercase ${statusCfg.color}`}>
                      Sistema {statusCfg.label}
                    </span>
                    <span className="font-['DM_Sans'] text-sm text-gray-500 ml-3">
                      DB: {d.health.dbOk ? '✅ Conectada' : '❌ Sin conexión'} &nbsp;·&nbsp;
                      Uptime: <span className="font-['Space_Mono'] text-[#F5C218]">{fmtUptime(d.health.uptimeSeconds)}</span> &nbsp;·&nbsp;
                      Memoria: <span className="font-['Space_Mono']">{d.health.memoryUsedPct.toFixed(1)}%</span> &nbsp;·&nbsp;
                      Disponibilidad (1h): <span className="font-['Space_Mono'] text-[#F5C218]">{d.uptimePct.toFixed(2)}%</span>
                    </span>
                  </div>
                  <span className={`font-['Space_Mono'] text-xs px-2 py-0.5 rounded font-medium border ${statusCfg.border} ${statusCfg.color}`}>
                    {d.health.responseTime}ms
                  </span>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={Zap}       label="Requests (24h)"     value={fmt(d.metrics.totalRequests)} />
                  <StatCard icon={AlertOctagon} label="Errores (24h)"   value={d.metrics.errorCount}
                    color={d.metrics.errorCount > 20 ? 'text-red-400' : 'text-[#F5C218]'}
                    sub={`${d.metrics.errorRate.toFixed(1)}% tasa`} />
                  <StatCard icon={Clock}     label="Resp. promedio"      value={`${d.metrics.avgResponseMs.toFixed(0)}ms`}
                    color={d.metrics.avgResponseMs > 1000 ? 'text-yellow-400' : 'text-[#F5C218]'} />
                  <StatCard icon={Cpu}       label="Memoria usada"       value={`${d.health.memoryUsedPct.toFixed(1)}%`}
                    color={d.health.memoryUsedPct > 85 ? 'text-red-400' : 'text-[#F5C218]'} />
                  <StatCard icon={Wallet}    label="Nóminas hoy"         value={d.businessStats.payrolls} />
                  <StatCard icon={FileText}  label="Gastos hoy"          value={d.businessStats.expenses} />
                  <StatCard icon={Users}     label="Usuarios activos"    value={d.businessStats.activeUsers} sub="últimas 24h" />
                  <StatCard icon={Server}    label="Uptime"              value={fmtUptime(d.health.uptimeSeconds)} />
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Tráfico por hora */}
                  <div className="md:col-span-2 bg-[#111] rounded-xl border border-[#2a2a2a] p-4">
                    <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{ color: '#F5C218' }} />
                      Tráfico por hora (últimas 24h)
                      <span className="ml-auto font-['DM_Sans'] text-xs text-gray-600 font-normal normal-case tracking-normal">
                        <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: 'rgba(245,194,24,0.4)' }} />requests
                        <span className="inline-block w-2 h-2 bg-red-500 rounded-sm mr-1 ml-2" />errores
                      </span>
                    </h2>
                    <MiniBarChart data={d.metrics.hourlyData} />
                  </div>

                  {/* Top endpoints */}
                  <div className="bg-[#111] rounded-xl border border-[#2a2a2a] p-4">
                    <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-600" />
                      Endpoints top
                    </h2>
                    {d.metrics.topEndpoints.length === 0 ? (
                      <p className="font-['DM_Sans'] text-xs text-gray-600 py-4 text-center">Sin datos</p>
                    ) : (
                      <div className="space-y-2">
                        {d.metrics.topEndpoints.slice(0, 8).map((e, i) => {
                          const maxCount = d.metrics.topEndpoints[0]?.count ?? 1;
                          const pct      = (e.count / maxCount) * 100;
                          return (
                            <div key={i}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="font-['Space_Mono'] truncate max-w-[140px]" style={{ color: '#F5C218' }}>{e.endpoint.replace('/api/v1', '')}</span>
                                <span className="font-['Space_Mono'] font-semibold text-white ml-2">{e.count}</span>
                              </div>
                              <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                                <div style={{ width: `${pct}%`, background: '#F5C218' }} className="h-full rounded-full opacity-60" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status codes */}
                <div className="bg-[#111] rounded-xl border border-[#2a2a2a] p-4">
                  <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 mb-3">Distribución de códigos de respuesta (24h)</h2>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(d.metrics.statusCodes).map(([code, count]) => {
                      const colorMap: Record<string, string> = {
                        '2xx': 'bg-green-950/60 text-green-400 border-green-800',
                        '3xx': 'bg-blue-950/60 text-blue-400 border-blue-800',
                        '4xx': 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
                        '5xx': 'bg-red-950/60 text-red-400 border-red-800',
                      };
                      return (
                        <div key={code} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${colorMap[code] ?? 'bg-[#1C1C1C] text-gray-500 border-[#2a2a2a]'}`}>
                          <span className="font-['Space_Mono'] font-bold">{code}</span>
                          <span className="font-['Space_Mono'] font-semibold">{fmt(count as number)}</span>
                        </div>
                      );
                    })}
                    {Object.keys(d.metrics.statusCodes).length === 0 && (
                      <p className="font-['DM_Sans'] text-xs text-gray-600">Sin datos en las últimas 24h</p>
                    )}
                  </div>
                </div>

                {/* ── Asistente IA ─────────────────────────────────────── */}
                <div className="bg-[#0D0D0D] rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(245,194,24,0.3)' }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(245,194,24,0.15)' }}>
                    <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-300 flex items-center gap-2">
                      <Bot className="w-4 h-4" style={{ color: '#F5C218' }} />
                      Asistente IA — Análisis del sistema
                    </h2>
                    <button
                      onClick={handleAiAnalyze}
                      disabled={aiLoading}
                      className="font-['DM_Sans'] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-60"
                      style={{
                        background: '#F5C218',
                        color: '#1C1C1C',
                        boxShadow: '0 0 20px rgba(245,194,24,0.3)',
                      }}
                    >
                      {aiLoading
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analizando…</>
                        : <><Sparkles className="w-3.5 h-3.5" /> {aiResult ? 'Actualizar análisis' : 'Analizar con IA'}</>
                      }
                    </button>
                  </div>

                  {!aiResult && !aiLoading && !aiError && (
                    <div className="px-4 py-10 text-center">
                      <Bot className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#F5C218' }} />
                      <p className="font-['DM_Sans'] text-sm text-gray-600">Presiona <strong className="text-gray-400">Analizar con IA</strong> para obtener un diagnóstico en lenguaje natural del estado actual del sistema.</p>
                    </div>
                  )}

                  {aiLoading && (
                    <div className="px-4 py-10 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Bot className="w-5 h-5 animate-pulse" style={{ color: '#F5C218' }} />
                        <span className="font-['DM_Sans'] text-sm font-medium text-gray-400">Claude está analizando el sistema…</span>
                      </div>
                      <p className="font-['DM_Sans'] text-xs text-gray-600">Esto puede tomar unos segundos</p>
                    </div>
                  )}

                  {aiError && !aiLoading && (
                    <div className="px-4 py-4 flex items-start gap-2 text-red-400">
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="font-['DM_Sans'] text-sm">{aiError}</p>
                    </div>
                  )}

                  {aiResult && !aiLoading && (() => {
                    const AI_STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
                      healthy:  { label: 'Sistema saludable',  bg: 'bg-green-950/40',  text: 'text-green-400',  border: 'border-green-800'  },
                      warning:  { label: 'Atención requerida', bg: 'bg-yellow-950/40', text: 'text-yellow-400', border: 'border-yellow-800' },
                      critical: { label: 'Estado crítico',     bg: 'bg-red-950/40',    text: 'text-red-400',    border: 'border-red-800'    },
                    };
                    const SEVERITY_BADGE: Record<string, string> = {
                      high:   'bg-red-950/60 text-red-400 border-red-800',
                      medium: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
                      low:    'bg-blue-950/60 text-blue-400 border-blue-800',
                    };
                    const PRIORITY_BADGE: Record<string, string> = {
                      urgent:   'bg-red-950/60 text-red-400 border-red-800',
                      normal:   'bg-yellow-950/60 text-yellow-400 border-yellow-800',
                      optional: 'bg-[#1C1C1C] text-gray-500 border-[#2a2a2a]',
                    };
                    const SEVERITY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
                    const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', normal: 'Normal', optional: 'Opcional' };

                    const sc = AI_STATUS[aiResult.status] ?? AI_STATUS.healthy;

                    return (
                      <div className="p-4 space-y-4">
                        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
                          <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${sc.text}`} />
                          <div>
                            <p className={`font-['Barlow_Condensed'] text-sm font-bold tracking-wide uppercase mb-1 ${sc.text}`}>{sc.label}</p>
                            <p className="font-['DM_Sans'] text-sm text-gray-400 leading-relaxed">{aiResult.summary}</p>
                          </div>
                        </div>

                        {aiResult.issues.length > 0 && (
                          <div>
                            <h3 className="font-['Barlow_Condensed'] text-xs font-bold text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" /> Problemas detectados
                            </h3>
                            <div className="space-y-2">
                              {aiResult.issues.map((issue, i) => (
                                <div key={i} className="bg-[#1C1C1C] rounded-lg px-3 py-2.5 border border-[#2a2a2a]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-['Space_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded border ${SEVERITY_BADGE[issue.severity] ?? SEVERITY_BADGE.low}`}>
                                      {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                                    </span>
                                    <span className="font-['DM_Sans'] text-sm font-semibold text-gray-300">{issue.title}</span>
                                  </div>
                                  <p className="font-['DM_Sans'] text-xs text-gray-500 leading-relaxed">{issue.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {aiResult.recommendations.length > 0 && (
                          <div>
                            <h3 className="font-['Barlow_Condensed'] text-xs font-bold text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#F5C218' }} /> Recomendaciones
                            </h3>
                            <div className="space-y-2">
                              {aiResult.recommendations.map((rec, i) => (
                                <div key={i} className="bg-[#1C1C1C] rounded-lg px-3 py-2.5 border border-[#2a2a2a]">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-['Space_Mono'] text-[10px] font-semibold px-2 py-0.5 rounded border ${PRIORITY_BADGE[rec.priority] ?? PRIORITY_BADGE.normal}`}>
                                      {PRIORITY_LABEL[rec.priority] ?? rec.priority}
                                    </span>
                                    <span className="font-['DM_Sans'] text-sm font-semibold text-gray-300">{rec.action}</span>
                                  </div>
                                  <p className="font-['DM_Sans'] text-xs text-gray-500 leading-relaxed">{rec.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {aiResult.positives.length > 0 && (
                          <div>
                            <h3 className="font-['Barlow_Condensed'] text-xs font-bold text-gray-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <ThumbsUp className="w-3.5 h-3.5 text-green-400" /> Aspectos positivos
                            </h3>
                            <ul className="space-y-1">
                              {aiResult.positives.map((pos, i) => (
                                <li key={i} className="flex items-start gap-2 font-['DM_Sans'] text-sm text-gray-400">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                  {pos}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <p className="font-['Space_Mono'] text-[10px] text-gray-600 text-right">
                          Analizado por Claude AI · {new Date(aiResult.analyzedAt).toLocaleString('es-DO')}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Logs recientes */}
                <div className="bg-[#111] rounded-xl border border-[#2a2a2a] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#222] flex items-center justify-between">
                    <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Eventos recientes (errores y advertencias)
                    </h2>
                    <span className="font-['Space_Mono'] text-xs text-gray-600">{d.recentLogs.length} eventos en 24h</span>
                  </div>
                  <div className="divide-y divide-[#1a1a1a] max-h-64 overflow-y-auto">
                    {d.recentLogs.length === 0 ? (
                      <div className="flex items-center gap-2 px-4 py-6 font-['DM_Sans'] text-sm text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        Sin errores en las últimas 24 horas. ¡Todo marcha bien!
                      </div>
                    ) : (
                      d.recentLogs.map(log => <LogRow key={log.id} log={log} />)
                    )}
                  </div>
                </div>

                {/* Logs completos con filtros */}
                <div className="bg-[#111] rounded-xl border border-[#2a2a2a] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#222]">
                    <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 mb-3">Logs del sistema</h2>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={logLevel}
                        onChange={e => { setLogLevel(e.target.value); setLogPage(1); }}
                        className="font-['DM_Sans'] text-xs bg-[#1C1C1C] border border-[#333] text-gray-400 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        <option value="">Todos los niveles</option>
                        <option value="error">Error</option>
                        <option value="warn">Advertencia</option>
                        <option value="info">Info</option>
                      </select>
                      <select
                        value={logCat}
                        onChange={e => { setLogCat(e.target.value); setLogPage(1); }}
                        className="font-['DM_Sans'] text-xs bg-[#1C1C1C] border border-[#333] text-gray-400 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        <option value="">Todas las categorías</option>
                        <option value="api">API</option>
                        <option value="auth">Autenticación</option>
                        <option value="cron">Jobs programados</option>
                        <option value="database">Base de datos</option>
                        <option value="system">Sistema</option>
                      </select>
                    </div>
                  </div>

                  <div className="divide-y divide-[#1a1a1a] max-h-96 overflow-y-auto">
                    {(logsData?.data ?? []).length === 0 ? (
                      <p className="font-['DM_Sans'] px-4 py-6 text-sm text-gray-600 text-center">No hay logs con los filtros seleccionados.</p>
                    ) : (
                      (logsData?.data ?? []).map(log => <LogRow key={log.id} log={log} />)
                    )}
                  </div>

                  {logsData?.pagination && logsData.pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-[#222] flex items-center justify-between">
                      <span className="font-['Space_Mono'] text-xs text-gray-600">{logsData.pagination.total} logs totales</span>
                      <div className="flex gap-1">
                        <button
                          disabled={logPage <= 1}
                          onClick={() => setLogPage(p => p - 1)}
                          className="font-['Space_Mono'] text-xs px-2 py-1 border border-[#333] text-gray-500 rounded disabled:opacity-40 hover:bg-[#1C1C1C]"
                        >←</button>
                        <span className="font-['Space_Mono'] text-xs px-2 py-1 text-gray-600">Pág. {logPage} / {logsData.pagination.totalPages}</span>
                        <button
                          disabled={logPage >= logsData.pagination.totalPages}
                          onClick={() => setLogPage(p => p + 1)}
                          className="font-['Space_Mono'] text-xs px-2 py-1 border border-[#333] text-gray-500 rounded disabled:opacity-40 hover:bg-[#1C1C1C]"
                        >→</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info del servidor */}
                <div className="bg-[#111] rounded-xl border border-[#2a2a2a] p-4">
                  <h2 className="font-['Barlow_Condensed'] text-sm font-bold tracking-widest uppercase text-gray-400 mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4 text-gray-600" />
                    Información del servidor
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {Object.entries(d.health.details ?? {}).map(([key, val]) => (
                      <div key={key} className="bg-[#0D0D0D] rounded-lg px-3 py-2 border border-[#1a1a1a]">
                        <p className="font-['Barlow_Condensed'] text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">{key}</p>
                        <p className="font-['Space_Mono'] text-xs text-gray-400 truncate">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}

    </div>
  );
}
