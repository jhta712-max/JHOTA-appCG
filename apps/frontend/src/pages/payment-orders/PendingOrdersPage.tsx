import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, BadgeCheck, Loader2, X, FileText, Wallet,
  ShoppingCart, Filter,
} from 'lucide-react';
import { paymentOrdersApi, projectsApi } from '../../api';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { useAuthStore } from '../../stores/authStore';
import type { PaymentOrder } from '../../types';

type OrderType = 'SERVICIO' | 'PAYROLL' | 'MATERIALS' | 'PETTY_CASH';

const TYPE_CFG: Record<OrderType, { label: string; cls: string }> = {
  SERVICIO:   { label: 'Servicio',   cls: 'bg-purple-100 text-purple-700' },
  PAYROLL:    { label: 'Nómina',     cls: 'bg-blue-100 text-blue-700'    },
  MATERIALS:  { label: 'Materiales', cls: 'bg-amber-100 text-amber-700'  },
  PETTY_CASH: { label: 'Caja chica', cls: 'bg-green-100 text-green-700'  },
};
const TYPE_ICON: Record<OrderType, JSX.Element> = {
  SERVICIO:   <FileText className="w-3.5 h-3.5" />,
  PAYROLL:    <Wallet className="w-3.5 h-3.5" />,
  MATERIALS:  <ShoppingCart className="w-3.5 h-3.5" />,
  PETTY_CASH: <Wallet className="w-3.5 h-3.5" />,
};

function fmtMonto(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inputCls = "w-full border border-gray-300 rounded-none px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 font-['Barlow_Condensed'] mb-1";

export default function PendingOrdersPage() {
  const qc = useQueryClient();
  const { user, viewAsRole } = useAuthStore();
  const effectiveRole = viewAsRole || user?.role?.name || '';
  const canPay        = effectiveRole !== 'supervisor';
  const [filterProject, setFilterProject] = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [confirmId,     setConfirmId]     = useState<string | null>(null);
  const [toast,         setToast]         = useState('');
  const [showFilters,   setShowFilters]   = useState(false);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['payment-orders', 'unpaid', filterProject, filterType],
    queryFn:  () => paymentOrdersApi.list({
      status: 'PENDING,IN_PROCESS,REJECTED_BANK',
      ...(filterProject ? { projectId: filterProject } : {}),
      ...(filterType    ? { orderType: filterType }    : {}),
      limit: 200,
    }),
    select: (r) => (r.data as any).data as PaymentOrder[],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-full-list'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => (r.data?.data ?? []) as any[],
    staleTime: 0,
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => paymentOrdersApi.markAsPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-orders'] });
      setConfirmId(null);
      flash('✅ Orden marcada como pagada');
    },
    onError: (e: any) => {
      setConfirmId(null);
      flash(e.response?.data?.error || 'Error al marcar como pagada');
    },
  });

  const totalMonto = orders.reduce((sum, o) => sum + Number(o.amount), 0);

  const confirmOrder = orders.find((o) => o.id === confirmId);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 text-sm font-['DM_Sans'] font-semibold shadow-lg"
          style={{ background: '#1C1C1C', color: '#F5C218' }}
        >
          {toast}
        </div>
      )}

      {/* Hero header */}
      <div className="px-4 md:px-6 py-4 md:py-5 flex items-start md:items-end justify-between gap-4" style={{ background: '#1C1C1C' }}>
        <div>
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-1">
            MÓDULO / PAGOS PENDIENTES
          </p>
          <h1 className="font-['Barlow_Condensed'] uppercase tracking-wide text-3xl md:text-5xl font-bold text-white">
            Bandeja de Pagos Pendientes
          </h1>
          <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
            Órdenes pendientes, en proceso y rechazadas en todos los proyectos
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-['Barlow_Condensed'] uppercase tracking-wide font-bold shrink-0 transition-colors"
          style={showFilters
            ? { background: '#F5C218', color: '#1C1C1C' }
            : { background: 'transparent', color: '#9ca3af', border: '1px solid #4b5563' }
          }
        >
          <Filter className="w-4 h-4" /> Filtros
        </button>
      </div>

      {/* Summary cards */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          <div className="bg-white p-5 flex items-center gap-3">
            <div className="w-1 h-10 shrink-0" style={{ background: '#F5C218' }} />
            <div>
              <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-gray-500 mb-1">Órdenes sin pagar</p>
              <p className="font-['Space_Mono'] text-3xl font-bold text-gray-900">{orders.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 flex items-center gap-3">
            <div className="w-1 h-10 shrink-0" style={{ background: '#F5C218' }} />
            <div>
              <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-gray-500 mb-1">Monto total pendiente</p>
              <p className="font-['Space_Mono'] text-xl font-bold text-gray-900">
                RD$ {totalMonto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
          <div>
            <label className={labelCls}>Proyecto</label>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className={inputCls}>
              <option value="">Todos los proyectos</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo de orden</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputCls}>
              <option value="">Todos los tipos</option>
              <option value="SERVICIO">Servicio</option>
              <option value="PAYROLL">Nómina</option>
              <option value="MATERIALS">Materiales</option>
              <option value="PETTY_CASH">Caja chica</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 overflow-hidden">
        {isLoading ? (
          <ProjectListSkeleton />
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BadgeCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-sm">No hay órdenes sin pagar</p>
            <p className="font-['DM_Sans'] text-xs mt-1">Todas las órdenes han sido pagadas.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1C1C1C' }}>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">#</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Tipo</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Proyecto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Beneficiario</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Concepto</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Monto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Estado</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Fecha</th>
                    <th className="px-4 py-3 text-center font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => {
                    const type = ((['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH'].includes(o.orderType) ? o.orderType : 'SERVICIO') as OrderType);
                    const cfg  = TYPE_CFG[type];
                    return (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-400 whitespace-nowrap">
                          OP-{String(o.number).padStart(3, '0')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold font-['Barlow_Condensed'] uppercase ${cfg.cls}`}>
                            {TYPE_ICON[type]}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-['Space_Mono'] text-xs text-gray-500">{o.project.code}</p>
                          <p className="font-['DM_Sans'] text-xs text-gray-700 font-medium leading-tight max-w-[140px] truncate">{o.project.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-['DM_Sans'] font-medium text-gray-900">{o.supplier.name}</p>
                          <p className="font-['DM_Sans'] text-xs text-gray-400">{o.supplier.bank}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-['DM_Sans'] text-gray-700 max-w-[180px] truncate" title={o.concept}>{o.concept}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-['Space_Mono'] font-bold text-gray-900 whitespace-nowrap">
                          {fmtMonto(o.amount, o.currency)}
                        </td>
                        <td className="px-4 py-3">
                          {o.status === 'PENDING' && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-amber-100 text-amber-700">Pendiente</span>
                          )}
                          {o.status === 'IN_PROCESS' && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-blue-100 text-blue-700">En proceso</span>
                          )}
                          {o.status === 'REJECTED_BANK' && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-red-100 text-red-700">Rechazada</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500 whitespace-nowrap">
                          {fmtDate(o.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canPay ? (
                            <button
                              onClick={() => setConfirmId(o.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase font-bold transition-opacity mx-auto"
                              style={{ background: '#F5C218', color: '#1C1C1C' }}
                            >
                              <BadgeCheck className="w-3.5 h-3.5" /> Marcar pagada
                            </button>
                          ) : (
                            <span className="font-['DM_Sans'] text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {orders.map((o) => {
                const type = ((['SERVICIO', 'PAYROLL', 'MATERIALS', 'PETTY_CASH'].includes(o.orderType) ? o.orderType : 'SERVICIO') as OrderType);
                const cfg  = TYPE_CFG[type];
                return (
                  <div key={o.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-['Space_Mono'] text-xs text-gray-400 font-bold">OP-{String(o.number).padStart(3, '0')}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold font-['Barlow_Condensed'] uppercase ${cfg.cls}`}>
                          {TYPE_ICON[type]}{cfg.label}
                        </span>
                        {o.status === 'PENDING' && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-amber-100 text-amber-700">Pendiente</span>
                        )}
                        {o.status === 'IN_PROCESS' && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-blue-100 text-blue-700">En proceso</span>
                        )}
                        {o.status === 'REJECTED_BANK' && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-bold font-['Barlow_Condensed'] uppercase bg-red-100 text-red-700">Rechazada</span>
                        )}
                      </div>
                    </div>
                    <p className="font-['DM_Sans'] font-medium text-gray-900 text-sm">{o.supplier.name}</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-500 mt-0.5 line-clamp-2">{o.concept}</p>
                    <div className="flex items-end justify-between mt-2 gap-2">
                      <div>
                        <p className="font-['Space_Mono'] text-xs text-gray-400">{o.project.code}</p>
                        <p className="font-['DM_Sans'] text-xs text-gray-600 leading-tight">{o.project.name}</p>
                        <p className="font-['Space_Mono'] text-xs text-gray-400 mt-0.5">{fmtDate(o.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <p className="font-['Space_Mono'] font-bold text-gray-900 text-sm">{fmtMonto(o.amount, o.currency)}</p>
                        {canPay && (
                          <button
                            onClick={() => setConfirmId(o.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase font-bold"
                            style={{ background: '#F5C218', color: '#1C1C1C' }}
                          >
                            <BadgeCheck className="w-3.5 h-3.5" /> Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirmId && confirmOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1C1C1C' }}>
              <h3 className="font-['Barlow_Condensed'] uppercase tracking-wide text-white">Confirmar pago</h3>
              <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4 space-y-1.5">
                <p className="font-['Space_Mono'] text-xs text-gray-500 mb-2">
                  OP-{String(confirmOrder.number).padStart(3, '0')}
                </p>
                <p>
                  <span className="font-['Barlow_Condensed'] uppercase text-xs text-gray-500">Suplidor: </span>
                  <span className="font-['DM_Sans'] font-semibold text-gray-900">{confirmOrder.supplier.name}</span>
                </p>
                <p>
                  <span className="font-['Barlow_Condensed'] uppercase text-xs text-gray-500">Proyecto: </span>
                  <span className="font-['DM_Sans'] font-medium text-gray-700">
                    {confirmOrder.project.code} — {confirmOrder.project.name}
                  </span>
                </p>
                <p>
                  <span className="font-['Barlow_Condensed'] uppercase text-xs text-gray-500">Concepto: </span>
                  <span className="font-['DM_Sans'] text-gray-700">{confirmOrder.concept}</span>
                </p>
                <p className="pt-1 font-['Space_Mono'] text-xl font-bold text-gray-900">
                  {fmtMonto(confirmOrder.amount, confirmOrder.currency)}
                </p>
              </div>
              <p className="font-['DM_Sans'] text-sm text-gray-600">¿Confirmas que esta orden fue pagada?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => markPaidMut.mutate(confirmId)}
                  disabled={markPaidMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                >
                  {markPaidMut.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                    : <><BadgeCheck className="w-4 h-4" /> Confirmar pago</>
                  }
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="px-4 py-2.5 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
