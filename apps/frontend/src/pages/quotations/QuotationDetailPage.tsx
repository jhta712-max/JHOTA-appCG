import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Trash2, AlertCircle, Calendar, Building2,
  FileText, CreditCard, Clock, Percent, Paperclip,
  Plus, CheckCircle, X, Loader2, ExternalLink, Receipt,
} from 'lucide-react';
import { quotationsApi, projectsApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import type { Project } from '../../types';
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
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          clamped >= 100 ? 'bg-green-500' : clamped > 50 ? 'bg-amber-400' : 'bg-blue-400'
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

const ALL_STATUSES: QuotationStatus[] = [
  'PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS',
  'PARTIAL_INVOICED', 'INVOICED', 'PAID', 'CANCELLED',
];

export default function QuotationDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const user     = useAuthStore((s) => s.user);
  const isAdmin  = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  // UI state
  const [showStatusForm,     setShowStatusForm]     = useState(false);
  const [newStatus,          setNewStatus]          = useState('');
  const [statusNote,         setStatusNote]         = useState('');
  const [showProjectForm,    setShowProjectForm]    = useState(false);
  const [newProjectId,       setNewProjectId]       = useState('');
  const [showPaymentForm,    setShowPaymentForm]    = useState(false);
  const [showDeleteConf,     setShowDeleteConf]     = useState(false);
  const [payErr,             setPayErr]             = useState('');
  const [statusErr,          setStatusErr]          = useState('');
  const [projectErr,         setProjectErr]         = useState('');

  // Payment form
  const [payForm, setPayForm] = useState({
    amount: '', paymentDate: '', paymentMethod: 'TRANSFER',
    description: '', notes: '', createExpense: true,
  });

  // Queries
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

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn:  () => projectsApi.list({ limit: 1000 }),
    select:   (r: any) => r.data?.data || [],
  });

  // Mutations
  const statusMutation = useMutation({
    mutationFn: () => quotationsApi.updateStatus(id!, { status: newStatus, notes: statusNote || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      setShowStatusForm(false); setNewStatus(''); setStatusNote(''); setStatusErr('');
    },
    onError: (err: any) => setStatusErr(err.response?.data?.error ?? 'Error al actualizar estado'),
  });

  const projectMutation = useMutation({
    mutationFn: () => quotationsApi.changeProject(id!, { projectId: newProjectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      setShowProjectForm(false); setNewProjectId(''); setProjectErr('');
    },
    onError: (err: any) => setProjectErr(err.response?.data?.error ?? 'Error al cambiar proyecto'),
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

  // Upload
  const uploadAttachment = async (file: File) => {
    await quotationsApi.uploadAttachment(id!, file);
    qc.invalidateQueries({ queryKey: ['quotation', id] });
  };

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando cotización...</div>;
  if (error || !quotation) return (
    <div className="text-center py-20 text-gray-400">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p>No se encontró la cotización</p>
      <button onClick={() => navigate('/quotations')} className="btn-secondary mt-4">Volver</button>
    </div>
  );

  const isCancelled = quotation.status === 'CANCELLED';
  const isPaid      = quotation.status === 'PAID';

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{quotation.supplierName}</h1>
            {quotation.quotationNumber && (
              <span className="text-sm text-gray-400 font-mono">#{quotation.quotationNumber}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {quotation.project.code} — {quotation.project.name}
          </p>
        </div>
        {isAdmin && !isCancelled && !isPaid && (
          <Link to={`/quotations/${id}/edit`} className="btn-secondary text-sm shrink-0">
            <Edit className="w-4 h-4" /> Editar
          </Link>
        )}
      </div>

      {/* Estado badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          QUOTATION_STATUS_COLORS[quotation.status as QuotationStatus]
        }`}>
          {QUOTATION_STATUS_LABELS[quotation.status as QuotationStatus]}
        </span>
        {quotation.currency !== 'DOP' && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-mono">
            {quotation.currency}
          </span>
        )}
        {isAdmin && !isCancelled && !isPaid && (
          <>
            <button onClick={() => setShowStatusForm(s => !s)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium underline">
              Cambiar estado
            </button>
            <button onClick={() => setShowProjectForm(s => !s)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium underline">
              Cambiar proyecto
            </button>
          </>
        )}
      </div>

      {/* Form cambio de estado */}
      {showStatusForm && (
        <div className="card p-4 space-y-3 border-2 border-primary-200">
          <h3 className="font-semibold text-gray-800 text-sm">Cambiar estado</h3>
          <select className="input-field" value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}>
            <option value="">Seleccionar nuevo estado...</option>
            {ALL_STATUSES.filter(s => s !== quotation.status).map(s => (
              <option key={s} value={s}>{QUOTATION_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <textarea rows={2} className="input-field resize-none text-sm"
            placeholder="Nota sobre el cambio (opcional)"
            value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          {statusErr && <p className="text-xs text-red-500">{statusErr}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex-1"
              onClick={() => { setShowStatusForm(false); setNewStatus(''); setStatusErr(''); }}>
              Cancelar
            </button>
            <button className="btn-primary text-sm flex-1"
              disabled={!newStatus || statusMutation.isPending}
              onClick={() => statusMutation.mutate()}>
              {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {/* Form cambio de proyecto */}
      {showProjectForm && (
        <div className="card p-4 space-y-3 border-2 border-amber-200">
          <h3 className="font-semibold text-gray-800 text-sm">Cambiar proyecto</h3>
          <p className="text-xs text-gray-500">Se migrarán automáticamente todos los gastos vinculados al nuevo proyecto.</p>
          <select className="input-field" value={newProjectId}
            onChange={(e) => setNewProjectId(e.target.value)}>
            <option value="">Seleccionar nuevo proyecto...</option>
            {projects?.filter((p: Project) => p.id !== quotation.projectId && p.status === 'ACTIVE').map((p: Project) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          {projectErr && <p className="text-xs text-red-500">{projectErr}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex-1"
              onClick={() => { setShowProjectForm(false); setNewProjectId(''); setProjectErr(''); }}>
              Cancelar
            </button>
            <button className="btn-primary text-sm flex-1"
              disabled={!newProjectId || projectMutation.isPending}
              onClick={() => projectMutation.mutate()}>
              {projectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Cambiar proyecto'}
            </button>
          </div>
        </div>
      )}

      {/* Resumen financiero */}
      {summary && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Resumen financiero</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Total cotizado</p>
              <p className="font-bold text-gray-900 text-lg">{fmt(summary.total, quotation.currency)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-500 mb-1">Saldo pendiente</p>
              <p className={`font-bold text-lg ${summary.pendingBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {fmt(summary.pendingBalance, quotation.currency)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500 mb-1">Pagado (anticipos)</p>
              <p className="font-bold text-blue-700">{fmt(summary.totalPaid, quotation.currency)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-500 mb-1">Vinculado (facturas)</p>
              <p className="font-bold text-purple-700">{fmt(summary.totalLinked, quotation.currency)}</p>
            </div>
          </div>
          <PctBar pct={summary.paidPct} />
          <p className="text-xs text-gray-400 text-right">{summary.paidPct.toFixed(1)}% ejecutado</p>
        </div>
      )}

      {/* Datos de la cotización */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Detalles</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Fecha</p>
              <p className="font-medium text-gray-800">{fmtDate(quotation.quotationDate)}</p>
            </div>
          </div>

          {quotation.validUntil && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Válida hasta</p>
                <p className="font-medium text-gray-800">{fmtDate(quotation.validUntil)}</p>
              </div>
            </div>
          )}

          {quotation.supplierRnc && (
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">RNC</p>
                <p className="font-medium text-gray-800 font-mono">{quotation.supplierRnc}</p>
              </div>
            </div>
          )}

          {quotation.advancePct != null && (
            <div className="flex items-start gap-2">
              <Percent className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">% de anticipo</p>
                <p className="font-medium text-gray-800">{quotation.advancePct}%</p>
              </div>
            </div>
          )}

          {quotation.deliveryDays != null && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Días de entrega</p>
                <p className="font-medium text-gray-800">{quotation.deliveryDays} días</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Subtotal / ITBIS / Total</p>
              <p className="font-medium text-gray-800">
                {fmt(quotation.subtotal, quotation.currency)} /
                {fmt(quotation.itbisAmount, quotation.currency)} /
                <strong> {fmt(quotation.total, quotation.currency)}</strong>
              </p>
            </div>
          </div>

        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1">Descripción</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.description}</p>
        </div>

        {quotation.paymentTerms && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Condiciones de pago</p>
            <p className="text-sm text-gray-700">{quotation.paymentTerms}</p>
          </div>
        )}

        {quotation.observations && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Observaciones</p>
            <p className="text-sm text-gray-700">{quotation.observations}</p>
          </div>
        )}

        {quotation.notes && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Notas internas</p>
            <p className="text-sm text-gray-600 italic">{quotation.notes}</p>
          </div>
        )}
      </div>

      {/* Pagos / Anticipos */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            Pagos y anticipos
            {quotation.payments && quotation.payments.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {quotation.payments.length}
              </span>
            )}
          </h2>
          {!isCancelled && !isPaid && (
            <button onClick={() => setShowPaymentForm(s => !s)}
              className="btn-secondary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" /> Registrar pago
            </button>
          )}
        </div>

        {/* Form pago */}
        {showPaymentForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-amber-800 text-sm">Nuevo pago / anticipo</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label text-xs">Monto *</label>
                <input type="number" step="0.01" min="0" className="input-field"
                  placeholder="0.00"
                  value={payForm.amount}
                  onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label text-xs">Fecha del pago *</label>
                <input type="date" className="input-field"
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label text-xs">Método de pago *</label>
                <select className="input-field"
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CHECK">Cheque</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label text-xs">Descripción *</label>
                <input className="input-field" placeholder="Ej: Anticipo 50% según cotización"
                  value={payForm.description}
                  onChange={(e) => setPayForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="createExpense" className="rounded"
                  checked={payForm.createExpense}
                  onChange={(e) => setPayForm(f => ({ ...f, createExpense: e.target.checked }))} />
                <label htmlFor="createExpense" className="text-xs text-gray-600 cursor-pointer">
                  Crear gasto automáticamente en el proyecto
                </label>
              </div>
            </div>
            {payErr && <p className="text-xs text-red-500">{payErr}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary text-sm flex-1"
                onClick={() => { setShowPaymentForm(false); setPayErr(''); }}>
                Cancelar
              </button>
              <button className="btn-primary text-sm flex-1"
                disabled={paymentMutation.isPending}
                onClick={() => {
                  if (!payForm.amount || !payForm.paymentDate || !payForm.description) {
                    setPayErr('Completa los campos requeridos'); return;
                  }
                  paymentMutation.mutate();
                }}>
                {paymentMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : 'Registrar pago'
                }
              </button>
            </div>
          </div>
        )}

        {/* Lista de pagos */}
        {quotation.payments && quotation.payments.length > 0 ? (
          <div className="space-y-2">
            {quotation.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.description}</p>
                  <p className="text-xs text-gray-400">
                    {fmtDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS_Q[p.paymentMethod]}
                    {p.expense && (
                      <Link to={`/expenses/${p.expense.id}`}
                        className="ml-2 text-blue-500 hover:text-blue-700 inline-flex items-center gap-1">
                        <Receipt className="w-3 h-3" /> Gasto
                      </Link>
                    )}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">
                  {fmt(Number(p.amount), quotation.currency)}
                </p>
                {isAdmin && (
                  <button onClick={() => deletePaymentMutation.mutate(p.id)}
                    disabled={deletePaymentMutation.isPending}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No hay pagos registrados
          </p>
        )}
      </div>

      {/* Gastos vinculados */}
      {quotation.expenseLinks && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Facturas / gastos vinculados
            {quotation.expenseLinks.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {quotation.expenseLinks.length}
              </span>
            )}
          </h2>
          {quotation.expenseLinks.length > 0 ? (
            <div className="space-y-2">
              {quotation.expenseLinks.map((lnk) => (
                <div key={lnk.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Receipt className="w-4 h-4 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {lnk.expense.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(lnk.expense.expenseDate)} ·{' '}
                      <span className="text-purple-600">{QUOTATION_LINK_LABELS[lnk.linkType]}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">
                    {fmt(Number(lnk.expense.amount), quotation.currency)}
                  </p>
                  <Link to={`/expenses/${lnk.expenseId}`}
                    className="text-gray-300 hover:text-blue-500 transition-colors shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No hay gastos o facturas vinculadas aún
            </p>
          )}
        </div>
      )}

      {/* Adjuntos */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-400" /> Adjuntos
          </h2>
          <label className="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Subir
            <input type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAttachment(f);
                e.target.value = '';
              }} />
          </label>
        </div>
        {quotation.attachments && quotation.attachments.length > 0 ? (
          <div className="space-y-2">
            {quotation.attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <a href={quotationsApi.attachmentUrl(id!, att.id)} target="_blank" rel="noreferrer"
                  className="text-sm text-gray-700 hover:text-primary-600 flex-1 truncate">
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
          <p className="text-sm text-gray-400 text-center py-4">No hay adjuntos</p>
        )}
      </div>

      {/* Eliminar cotización */}
      {isAdmin && !isPaid && (
        <div className="pb-6">
          {!showDeleteConf ? (
            <button onClick={() => setShowDeleteConf(true)}
              className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-medium
                         hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Eliminar cotización
            </button>
          ) : (
            <div className="card p-5 space-y-4 border-2 border-red-200">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> ¿Eliminar esta cotización?
              </h3>
              <p className="text-sm text-gray-600">
                Se eliminará la cotización de <strong>{quotation.supplierName}</strong> y todos sus
                pagos y vínculos asociados. Esta acción no se puede revertir.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConf(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium
                             transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleteMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Trash2 className="w-4 h-4" /> Eliminar</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
