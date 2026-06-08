import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, BadgeCheck, Loader2, X, FileText, Wallet,
  ShoppingCart, Filter,
} from 'lucide-react';
import { paymentOrdersApi, projectsApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import type { PaymentOrder } from '../../types';

type OrderType = 'SERVICIO' | 'PAYROLL' | 'MATERIALS';

const TYPE_CFG: Record<OrderType, { label: string; cls: string }> = {
  SERVICIO:  { label: 'Servicio',   cls: 'bg-purple-100 text-purple-700' },
  PAYROLL:   { label: 'Nómina',     cls: 'bg-blue-100 text-blue-700' },
  MATERIALS: { label: 'Materiales', cls: 'bg-amber-100 text-amber-700' },
};
const TYPE_ICON: Record<OrderType, JSX.Element> = {
  SERVICIO:  <FileText className="w-4 h-4" />,
  PAYROLL:   <Wallet className="w-4 h-4" />,
  MATERIALS: <ShoppingCart className="w-4 h-4" />,
};

function fmtMonto(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
    queryKey: ['payment-orders', 'PENDING', filterProject, filterType],
    queryFn:  () => paymentOrdersApi.list({
      status: 'PENDING',
      ...(filterProject ? { projectId: filterProject } : {}),
      ...(filterType    ? { orderType: filterType }    : {}),
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Bandeja de Pagos Pendientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Órdenes de pago pendientes de procesar en todos los proyectos
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" /> Filtros
        </button>
      </div>

      {/* Resumen */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-600 font-medium mb-1">Órdenes pendientes</p>
            <p className="text-2xl font-bold text-amber-800">{orders.length}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-600 font-medium mb-1">Monto total pendiente</p>
            <p className="text-2xl font-bold text-amber-800">
              RD$ {totalMonto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Proyecto</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">Todos los proyectos</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de orden</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">Todos los tipos</option>
              <option value="SERVICIO">Servicio</option>
              <option value="PAYROLL">Nómina</option>
              <option value="MATERIALS">Materiales</option>
            </select>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BadgeCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No hay órdenes pendientes</p>
            <p className="text-xs mt-1">Todas las órdenes han sido procesadas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proyecto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Beneficiario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => {
                  const type = ((['SERVICIO', 'PAYROLL', 'MATERIALS'].includes(o.orderType) ? o.orderType : 'SERVICIO') as OrderType);
                  const cfg  = TYPE_CFG[type];
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                        OP-{String(o.number).padStart(3, '0')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
                          {TYPE_ICON[type]}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-gray-500">{o.project.code}</p>
                        <p className="text-xs text-gray-700 font-medium leading-tight max-w-[140px] truncate">{o.project.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{o.supplier.name}</p>
                        <p className="text-xs text-gray-400">{o.supplier.bank}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 max-w-[180px] truncate" title={o.concept}>{o.concept}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {fmtMonto(o.amount, o.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setConfirmId(o.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors mx-auto"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" /> Marcar pagada
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {confirmId && confirmOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Confirmar pago</h3>
              <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1 text-sm">
              <p className="text-xs text-gray-400 font-mono mb-2">OP-{String(confirmOrder.number).padStart(3, '0')}</p>
              <p><span className="text-gray-500">Suplidor:</span> <span className="font-semibold text-gray-900">{confirmOrder.supplier.name}</span></p>
              <p><span className="text-gray-500">Proyecto:</span> <span className="font-medium text-gray-700">{confirmOrder.project.code} — {confirmOrder.project.name}</span></p>
              <p><span className="text-gray-500">Concepto:</span> <span className="text-gray-700">{confirmOrder.concept}</span></p>
              <p className="pt-1 text-base font-bold text-green-700">{fmtMonto(confirmOrder.amount, confirmOrder.currency)}</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">¿Confirmas que esta orden fue pagada?</p>
            <div className="flex gap-2">
              <button
                onClick={() => markPaidMut.mutate(confirmId)}
                disabled={markPaidMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {markPaidMut.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
                  : <><BadgeCheck className="w-4 h-4" /> Confirmar pago</>
                }
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
