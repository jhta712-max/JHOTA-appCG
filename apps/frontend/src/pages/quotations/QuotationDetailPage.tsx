import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Trash2, AlertCircle, Calendar, Building2,
  FileText, CreditCard, Clock, Percent, Paperclip,
  Plus, CheckCircle, X, Loader2, ExternalLink, Receipt,
} from 'lucide-react';
import { quotationsApi } from '../../api';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';
import { useRole } from '../../hooks/useRole';
import {
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS,
  QUOTATION_LINK_LABELS, PAYMENT_METHOD_LABELS_Q,
  type QuotationStatus,
} from '../../types/quotation';
import { fmtDate } from '../../utils/date';

function fmt(n: number, currency = 'DOP') {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(n);
}

function PctBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 100 ? '#22c55e' : clamped > 50 ? '#F5C218' : '#60a5fa';
  return (
    <div className="h-2 bg-gray-200 overflow-hidden">
      <div className="h-full transition-all" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

const ALL_STATUSES: QuotationStatus[] = [
  'PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS',
  'PARTIAL_INVOICED', 'INVOICED', 'PAID', 'CANCELLED',
];

const inputCls = "w-full border border-gray-300 rounded-none px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 font-['Barlow_Condensed'] mb-1";

export default function QuotationDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { isSupervisor: isAdmin } = useRole();

  const [showStatusForm,  setShowStatusForm]  = useState(false);
  const [newStatus,       setNewStatus]       = useState('');
  const [statusNote,      setStatusNote]      = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showDeleteConf,  setShowDeleteConf]  = useState(false);
  const [payErr,          setPayErr]          = useState('');
  const [statusErr,       setStatusErr]       = useState('');

  const [payForm, setPayForm] = useState({
    amount: '', paymentDate: '', paymentMethod: 'TRANSFER',
    description: '', notes: '', createExpense: true,
  });

  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ['quotation', id],
    queryFn:  () => quotationsApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const { data: summary } = useQuery({
    queryKey: ['quotation-summary', id],
    queryFn:  () => quotationsApi.getSummary(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const statusMutation = useMutation({
    mutationFn: () => quotationsApi.updateStatus(id!, { status: newStatus, notes: statusNote || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      setShowStatusForm(false); setNewStatus(''); setStatusNote(''); setStatusErr('');
    },
    onError: (err: any) => setStatusErr(err.response?.data?.error ?? 'Error al actualizar estado'),
  });

  const paymentMutation = useMutation({
    mutationFn: () => quotationsApi.createPayment(id!, {
      amount:        parseFloat(payForm.amount),
      paymentDate:   payForm.paymentDate,
      paymentMethod: payForm.paymentMethod,
      description:   payForm.description,
      notes:         payForm.notes || undefined,
      createExpense: payForm.createExpense,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotation-summary', id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      setShowPaymentForm(false);
      setPayForm({ amount: '', paymentDate: '', paymentMethod: 'TRANSFER', description: '', notes: '', createExpense: true });
      setPayErr('');
    },
    onError: (err: any) => setPayErr(err.response?.data?.error ?? 'Error al registrar pago'),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => quotationsApi.deletePayment(id!, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotation-summary', id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => quotationsApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      navigate('/quotations');
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attId: string) => quotationsApi.deleteAttachment(id!, attId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotation', id] }),
  });

  const uploadAttachment = async (file: File) => {
    await quotationsApi.uploadAttachment(id!, file);
    qc.invalidateQueries({ queryKey: ['quotation', id] });
  };

  if (isLoading) {
    const meta = PAGE_META['/quotations'];
    return (
      <div>
        <div className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5" style={{ background: '#1C1C1C' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}>
              {meta.module}
            </p>
            <h1 className="text-3xl uppercase tracking-widest text-white leading-none" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {meta.title}
            </h1>
          </div>
        </div>
        <div className="p-6"><DetailPageSkeleton sections={3} /></div>
      </div>
    );
  }
  if (error || !quotation) return (
    <div className="text-center py-20 font-['DM_Sans'] text-gray-400">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p>No se encontró la cotización</p>
      <button
        onClick={() => navigate('/quotations')}
        className="mt-4 px-4 py-2 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50"
      >
        Volver
      </button>
    </div>
  );

  const isCancelled = quotation.status === 'CANCELLED';
  const isPaid      = quotation.status === 'PAID';

  return (
    <div className="max-w-2xl mx-auto">

      {/* Hero header */}
      <div className="px-4 md:px-6 py-4 md:py-5 mb-6" style={{ background: '#1C1C1C' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-['DM_Sans'] text-sm">Cotizaciones</span>
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="font-['Barlow_Condensed'] uppercase tracking-wide text-3xl md:text-5xl text-white truncate">
                {quotation.supplierName}
              </h1>
              {quotation.quotationNumber && (
                <span className="font-['Space_Mono'] text-sm" style={{ color: '#F5C218' }}>
                  #{quotation.quotationNumber}
                </span>
              )}
            </div>
            <p className="font-['DM_Sans'] text-sm text-gray-400">
              <span className="font-['Space_Mono'] text-xs">{quotation.project.code}</span>
              {' — '}{quotation.project.name}
            </p>
          </div>
          {isAdmin && !isCancelled && !isPaid && (
            <Link
              to={`/quotations/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 font-['Barlow_Condensed'] uppercase text-xs font-bold shrink-0"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >
              <Edit className="w-3.5 h-3.5" /> Editar
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-5">

        {/* Status + change link */}
        <div className="flex items-center gap-3 flex-wrap px-1">
          <span className={`inline-flex items-center px-3 py-1 text-sm font-medium font-['DM_Sans'] ${
            QUOTATION_STATUS_COLORS[quotation.status as QuotationStatus]
          }`}>
            {QUOTATION_STATUS_LABELS[quotation.status as QuotationStatus]}
          </span>
          {quotation.currency !== 'DOP' && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 font-['Space_Mono']">
              {quotation.currency}
            </span>
          )}
          {isAdmin && !isCancelled && !isPaid && (
            <button
              onClick={() => setShowStatusForm(s => !s)}
              className="text-xs font-['Barlow_Condensed'] uppercase tracking-wide underline text-gray-500 hover:text-gray-900"
            >
              Cambiar estado
            </button>
          )}
        </div>

        {/* Status change form */}
        {showStatusForm && (
          <div className="border border-gray-200">
            <div className="px-5 py-3 font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white" style={{ background: '#1C1C1C' }}>
              Cambiar estado
            </div>
            <div className="p-5 space-y-3 bg-white">
              <select className={inputCls} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="">Seleccionar nuevo estado...</option>
                {ALL_STATUSES.filter(s => s !== quotation.status).map(s => (
                  <option key={s} value={s}>{QUOTATION_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <textarea rows={2} className={`${inputCls} resize-none`}
                placeholder="Nota sobre el cambio (opcional)"
                value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              {statusErr && <p className="text-xs text-red-500 font-['DM_Sans']">{statusErr}</p>}
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => { setShowStatusForm(false); setNewStatus(''); setStatusErr(''); }}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 py-2 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                  disabled={!newStatus || statusMutation.isPending}
                  onClick={() => statusMutation.mutate()}
                >
                  {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Financial summary */}
        {summary && (
          <div className="border border-gray-200">
            <div className="px-5 py-3" style={{ background: '#1C1C1C' }}>
              <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">Resumen financiero</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
              <div className="bg-white p-4 text-center">
                <p className="font-['Barlow_Condensed'] uppercase text-xs tracking-wide text-gray-500 mb-1">Total</p>
                <p className="font-['Space_Mono'] text-lg font-bold text-gray-900">{fmt(summary.total, quotation.currency)}</p>
              </div>
              <div className="bg-white p-4 text-center">
                <p className="font-['Barlow_Condensed'] uppercase text-xs tracking-wide text-gray-500 mb-1">Saldo</p>
                <p className={`font-['Space_Mono'] text-lg font-bold ${summary.pendingBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {fmt(summary.pendingBalance, quotation.currency)}
                </p>
              </div>
              <div className="bg-white p-4 text-center">
                <p className="font-['Barlow_Condensed'] uppercase text-xs tracking-wide text-gray-500 mb-1">Pagado</p>
                <p className="font-['Space_Mono'] text-lg font-bold text-blue-700">{fmt(summary.totalPaid, quotation.currency)}</p>
              </div>
              <div className="bg-white p-4 text-center">
                <p className="font-['Barlow_Condensed'] uppercase text-xs tracking-wide text-gray-500 mb-1">Vinculado</p>
                <p className="font-['Space_Mono'] text-lg font-bold text-purple-700">{fmt(summary.totalLinked, quotation.currency)}</p>
              </div>
            </div>
            <div className="bg-white px-5 pb-4 pt-3">
              <PctBar pct={summary.paidPct} />
              <p className="font-['Space_Mono'] text-xs text-gray-400 text-right mt-1">{summary.paidPct.toFixed(1)}% ejecutado</p>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="border border-gray-200">
          <div className="px-5 py-3" style={{ background: '#1C1C1C' }}>
            <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">Detalles</span>
          </div>
          <div className="p-4 md:p-5 space-y-4 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className={labelCls}>Fecha</p>
                  <p className="font-['Space_Mono'] text-sm text-gray-800">{fmtDate(quotation.quotationDate)}</p>
                </div>
              </div>

              {quotation.validUntil && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className={labelCls}>Válida hasta</p>
                    <p className="font-['Space_Mono'] text-sm text-gray-800">{fmtDate(quotation.validUntil)}</p>
                  </div>
                </div>
              )}

              {quotation.supplierRnc && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className={labelCls}>RNC</p>
                    <p className="font-['Space_Mono'] text-sm text-gray-800">{quotation.supplierRnc}</p>
                  </div>
                </div>
              )}

              {quotation.advancePct != null && (
                <div className="flex items-start gap-2">
                  <Percent className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className={labelCls}>% anticipo</p>
                    <p className="font-['Space_Mono'] text-sm text-gray-800">{quotation.advancePct}%</p>
                  </div>
                </div>
              )}

              {quotation.deliveryDays != null && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className={labelCls}>Días de entrega</p>
                    <p className="font-['Space_Mono'] text-sm text-gray-800">{quotation.deliveryDays} días</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 md:col-span-2">
                <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className={labelCls}>Subtotal / ITBIS / Total</p>
                  <p className="font-['Space_Mono'] text-sm text-gray-800">
                    {fmt(quotation.subtotal, quotation.currency)} / {fmt(quotation.itbisAmount, quotation.currency)} / <strong>{fmt(quotation.total, quotation.currency)}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className={labelCls}>Descripción</p>
              <p className="font-['DM_Sans'] text-sm text-gray-700 whitespace-pre-wrap">{quotation.description}</p>
            </div>

            {quotation.paymentTerms && (
              <div className="pt-3 border-t border-gray-100">
                <p className={labelCls}>Condiciones de pago</p>
                <p className="font-['DM_Sans'] text-sm text-gray-700">{quotation.paymentTerms}</p>
              </div>
            )}

            {quotation.observations && (
              <div className="pt-3 border-t border-gray-100">
                <p className={labelCls}>Observaciones</p>
                <p className="font-['DM_Sans'] text-sm text-gray-700">{quotation.observations}</p>
              </div>
            )}

            {quotation.notes && (
              <div className="pt-3 border-t border-gray-100">
                <p className={labelCls}>Notas internas</p>
                <p className="font-['DM_Sans'] text-sm text-gray-600 italic">{quotation.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payments */}
        <div className="border border-gray-200">
          <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1C1C1C' }}>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" style={{ color: '#F5C218' }} />
              <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">Pagos y anticipos</span>
              {quotation.payments && quotation.payments.length > 0 && (
                <span className="font-['Space_Mono'] text-xs px-2 py-0.5" style={{ background: '#F5C218', color: '#1C1C1C' }}>
                  {quotation.payments.length}
                </span>
              )}
            </div>
            {!isCancelled && !isPaid && (
              <button
                onClick={() => setShowPaymentForm(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase border border-gray-500 text-gray-300 hover:text-white hover:border-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar pago
              </button>
            )}
          </div>

          {showPaymentForm && (
            <div className="border-b border-gray-200 p-5 space-y-3 bg-amber-50">
              <p className="font-['Barlow_Condensed'] uppercase tracking-wide text-sm font-semibold text-amber-800">
                Nuevo pago / anticipo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Monto *</label>
                  <input type="number" step="0.01" min="0" className={`${inputCls} font-['Space_Mono']`}
                    placeholder="0.00" value={payForm.amount}
                    onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Fecha del pago *</label>
                  <input type="date" className={`${inputCls} font-['Space_Mono']`}
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Método de pago *</label>
                  <select className={inputCls} value={payForm.paymentMethod}
                    onChange={(e) => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CASH">Efectivo</option>
                    <option value="CHECK">Cheque</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Descripción *</label>
                  <input className={inputCls} placeholder="Ej: Anticipo 50% según cotización"
                    value={payForm.description}
                    onChange={(e) => setPayForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="createExpense"
                    checked={payForm.createExpense}
                    onChange={(e) => setPayForm(f => ({ ...f, createExpense: e.target.checked }))} />
                  <label htmlFor="createExpense" className="font-['DM_Sans'] text-xs text-gray-600 cursor-pointer">
                    Crear gasto automáticamente en el proyecto
                  </label>
                </div>
              </div>
              {payErr && <p className="text-xs text-red-500 font-['DM_Sans']">{payErr}</p>}
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => { setShowPaymentForm(false); setPayErr(''); }}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 py-2 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                  disabled={paymentMutation.isPending}
                  onClick={() => {
                    if (!payForm.amount || !payForm.paymentDate || !payForm.description) {
                      setPayErr('Completa los campos requeridos'); return;
                    }
                    paymentMutation.mutate();
                  }}
                >
                  {paymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Registrar pago'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white">
            {quotation.payments && quotation.payments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {quotation.payments.map((p) => (
                  <div key={p.id} className="flex items-stretch">
                    <div className="w-1 bg-green-500 shrink-0" />
                    <div className="flex-1 flex items-center gap-3 px-4 py-3">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-['DM_Sans'] text-sm font-medium text-gray-800">{p.description}</p>
                        <p className="font-['Space_Mono'] text-xs text-gray-400">
                          {fmtDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS_Q[p.paymentMethod]}
                          {p.expense && (
                            <Link to={`/expenses/${p.expense.id}`}
                              className="ml-2 text-blue-500 hover:text-blue-700 inline-flex items-center gap-1">
                              <Receipt className="w-3 h-3" /> Gasto
                            </Link>
                          )}
                        </p>
                      </div>
                      <p className="font-['Space_Mono'] text-sm font-bold text-gray-900 shrink-0">
                        {fmt(Number(p.amount), (p as any).currency ?? quotation.currency)}
                      </p>
                      {isAdmin && (
                        <button onClick={() => deletePaymentMutation.mutate(p.id)}
                          disabled={deletePaymentMutation.isPending}
                          className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-['DM_Sans'] text-sm text-gray-400 text-center py-6">No hay pagos registrados</p>
            )}
          </div>
        </div>

        {/* Expense links */}
        {quotation.expenseLinks && (
          <div className="border border-gray-200">
            <div className="flex items-center gap-2 px-5 py-3" style={{ background: '#1C1C1C' }}>
              <FileText className="w-4 h-4" style={{ color: '#F5C218' }} />
              <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">
                Facturas / gastos vinculados
              </span>
              {quotation.expenseLinks.length > 0 && (
                <span className="font-['Space_Mono'] text-xs px-2 py-0.5" style={{ background: '#F5C218', color: '#1C1C1C' }}>
                  {quotation.expenseLinks.length}
                </span>
              )}
            </div>
            <div className="bg-white">
              {quotation.expenseLinks.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {quotation.expenseLinks.map((lnk) => (
                    <div key={lnk.id} className="flex items-stretch">
                      <div className="w-1 bg-purple-500 shrink-0" />
                      <div className="flex-1 flex items-center gap-3 px-4 py-3">
                        <Receipt className="w-4 h-4 text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-['DM_Sans'] text-sm font-medium text-gray-800 truncate">{lnk.expense.description}</p>
                          <p className="font-['Space_Mono'] text-xs text-gray-400">
                            {fmtDate(lnk.expense.expenseDate)} · <span className="text-purple-600">{QUOTATION_LINK_LABELS[lnk.linkType]}</span>
                          </p>
                        </div>
                        <p className="font-['Space_Mono'] text-sm font-bold text-gray-900 shrink-0">
                          {fmt(Number(lnk.expense.amount), quotation.currency)}
                        </p>
                        <Link to={`/expenses/${lnk.expenseId}`} className="text-gray-300 hover:text-blue-500 transition-colors shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-['DM_Sans'] text-sm text-gray-400 text-center py-6">No hay gastos o facturas vinculadas aún</p>
              )}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div className="border border-gray-200">
          <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1C1C1C' }}>
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" style={{ color: '#F5C218' }} />
              <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">Adjuntos</span>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase border border-gray-500 text-gray-300 hover:text-white hover:border-white cursor-pointer transition-colors">
              <Plus className="w-3.5 h-3.5" /> Subir
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAttachment(f);
                  e.target.value = '';
                }} />
            </label>
          </div>
          <div className="bg-white">
            {quotation.attachments && quotation.attachments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {quotation.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-3">
                    <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                    <a href={quotationsApi.attachmentUrl(id!, att.id)} target="_blank" rel="noreferrer"
                      className="font-['DM_Sans'] text-sm text-gray-700 hover:underline flex-1 truncate">
                      {att.fileName}
                    </a>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    {isAdmin && (
                      <button onClick={() => deleteAttachmentMutation.mutate(att.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-['DM_Sans'] text-sm text-gray-400 text-center py-6">No hay adjuntos</p>
            )}
          </div>
        </div>

        {/* Delete */}
        {isAdmin && !isPaid && (
          <div className="pb-6">
            {!showDeleteConf ? (
              <button
                onClick={() => setShowDeleteConf(true)}
                className="w-full py-2.5 border-2 border-red-200 text-red-500 text-sm font-['Barlow_Condensed'] uppercase tracking-wide hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Eliminar cotización
              </button>
            ) : (
              <div className="border-2 border-red-200 p-5 space-y-4">
                <h3 className="font-['Barlow_Condensed'] uppercase tracking-wide text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> ¿Eliminar esta cotización?
                </h3>
                <p className="font-['DM_Sans'] text-sm text-gray-600">
                  Se eliminará la cotización de <strong>{quotation.supplierName}</strong> y todos sus
                  pagos y vínculos asociados. Esta acción no se puede revertir.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConf(false)}
                    className="flex-1 py-2.5 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-['Barlow_Condensed'] uppercase font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Eliminar</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
