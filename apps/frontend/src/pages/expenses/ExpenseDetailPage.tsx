import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Receipt, Calendar, User, MapPin,
  CreditCard, FileText, AlertCircle, CheckCircle, XCircle,
  Paperclip, Trash2, ExternalLink, Clock, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { expensesApi, quotationsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import { useAuthStore } from '../../stores/authStore';
import { PAYMENT_METHOD_LABELS } from '../../types';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

export default function ExpenseDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const { isAdmin, isSupervisor, isOperator, canApproveExpense } = useRole();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [showVoid,       setShowVoid]       = useState(false);
  const [voidReason,     setVoidReason]     = useState('');
  const [voidError,      setVoidError]      = useState('');
  const [showReject,     setShowReject]     = useState(false);
  const [rejectReason,   setRejectReason]   = useState('');
  const [rejectError,    setRejectError]    = useState('');

  const canVoid = isSupervisor;

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expense', id],
    queryFn:  () => expensesApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  // Cotización vinculada a este gasto (si existe)
  const { data: linkedQuotations } = useQuery({
    queryKey: ['quotations', 'suggest', expense?.project?.id, expense?.fiscalVoucher?.supplierName],
    queryFn:  () => quotationsApi.suggest({
      projectId:    expense!.project.id,
      supplierName: expense!.fiscalVoucher?.supplierName ?? undefined,
      amount:       Number(expense!.amount),
    }),
    select:   (r) => r.data.data,
    enabled:  !!expense,
    staleTime: 60_000,
  });

  const hardDeleteMut = useMutation({
    mutationFn: () => expensesApi.hardDelete(id!),
    onSuccess: () => navigate('/expenses', { replace: true }),
  });

  const voidMutation = useMutation({
    mutationFn: () => expensesApi.void(id!, voidReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['project-summary'] });
      setShowVoid(false);
    },
    onError: (err: any) => setVoidError(err.response?.data?.error || 'Error al anular el gasto'),
  });

  const approveMutation = useMutation({
    mutationFn: () => expensesApi.approve(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['project-summary'] });
    },
    onError: (err: any) => alert(err.response?.data?.error || 'Error al aprobar'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => expensesApi.reject(id!, rejectReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowReject(false);
      setRejectReason('');
    },
    onError: (err: any) => setRejectError(err.response?.data?.error || 'Error al rechazar'),
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando gasto...</div>;
  if (error || !expense) return (
    <div className="text-center py-20 text-gray-400">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p>No se encontró el gasto</p>
      <button onClick={() => navigate('/expenses')} className="btn-secondary mt-4">Volver a gastos</button>
    </div>
  );

  const isVoided          = expense.status === 'VOIDED';
  const isPending         = expense.status === 'PENDING_APPROVAL';
  const isRejected        = expense.status === 'REJECTED';
  const isActive          = expense.status === 'ACTIVE';
  const isOwnExpense      = expense.registeredBy?.id === currentUserId;
  const within24h         = (Date.now() - new Date(expense.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  const canEdit = (
    (isSupervisor && isActive) ||                                    // supervisor edita activos
    (isOwnExpense && isPending && (isSupervisor || (isOperator && within24h))) ||  // dueño edita pendientes
    (isOwnExpense && isRejected && (isSupervisor || isOperator))     // dueño edita rechazados (siempre)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{expense.description}</h1>
            {isVoided   && <span className="badge-voided">Anulado</span>}
            {isActive   && <span className="badge-active">Activo</span>}
            {isPending  && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />Pendiente aprobación</span>}
            {isRejected && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1"><XCircle className="w-3 h-3" />Rechazado</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {expense.project?.code} — {expense.category?.name}
          </p>
        </div>
        {canEdit && (
          <Link to={`/expenses/${id}/edit`} className="btn-secondary text-sm shrink-0">
            <Edit className="w-4 h-4" /> Editar
          </Link>
        )}
      </div>

      {/* Monto destacado */}
      <div className={`card p-5 text-center ${isVoided ? 'opacity-60' : ''}`}>
        <p className="text-xs text-gray-500 mb-1">Monto del gasto</p>
        <p className={`text-4xl font-bold ${isVoided ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {fmt(Number(expense.amount))}
        </p>
        {expense.fiscalVoucher && (
          <p className="text-xs text-blue-500 mt-1">
            ITBIS incluido: {fmt(Number(expense.fiscalVoucher.itbisAmount ?? 0))}
          </p>
        )}
      </div>

      {/* Detalles generales */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Detalles del gasto</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Fecha</p>
              <p className="font-medium text-gray-800">{fmtDate(expense.expenseDate, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Método de pago</p>
              <p className="font-medium text-gray-800">{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</p>
              {expense.companyCard && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {expense.companyCard.holderName} — **** {expense.companyCard.lastFour}
                  <span className="ml-1 text-gray-400">({expense.companyCard.cardType} · {expense.companyCard.bank})</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Proyecto</p>
              <Link to={`/projects/${expense.project?.id}`}
                className="font-medium text-primary-600 hover:text-primary-700">
                {expense.project?.code}
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Categoría</p>
              <p className="font-medium text-gray-800">{expense.category?.name}</p>
            </div>
          </div>

          {expense.registeredBy && (
            <div className="flex items-start gap-2 col-span-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Registrado por</p>
                <p className="font-medium text-gray-800">{expense.registeredBy.name}</p>
              </div>
            </div>
          )}
        </div>

        {expense.notes && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Notas</p>
            <p className="text-sm text-gray-700">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Comprobante fiscal */}
      {expense.hasFiscalDoc && expense.fiscalVoucher && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary-600" /> Comprobante Fiscal
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-500 mb-0.5">NCF</p>
              <p className="font-mono font-bold text-blue-800 text-lg">{expense.fiscalVoucher.ncf}</p>
              <p className="text-xs text-blue-400 mt-0.5">
                {expense.fiscalVoucher.isElectronic ? 'e-NCF Electrónico (Ley 32-23)' : 'NCF Tradicional'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">RNC Suplidor</p>
              <p className="font-medium text-gray-800 font-mono">{expense.fiscalVoucher.supplierRnc}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">ITBIS</p>
              <p className="font-medium text-gray-800">{fmt(Number(expense.fiscalVoucher.itbisAmount ?? 0))}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400">Nombre del Suplidor</p>
              <p className="font-medium text-gray-800">{expense.fiscalVoucher.supplierName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sin comprobante fiscal */}
      {!expense.hasFiscalDoc && (
        <div className="card p-4 flex items-center gap-3 text-sm text-gray-500">
          <Receipt className="w-4 h-4 text-gray-300 shrink-0" />
          <span>Este gasto no tiene comprobante fiscal</span>
        </div>
      )}

      {/* Cotizaciones relacionadas */}
      {linkedQuotations && linkedQuotations.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Cotizaciones relacionadas
          </h2>
          <p className="text-xs text-gray-400">
            Estas cotizaciones del mismo proyecto y suplidor podrían estar relacionadas con este gasto.
          </p>
          <div className="space-y-2">
            {linkedQuotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}`}
                className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors">
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{q.supplierName}</p>
                  <p className="text-xs text-gray-500 truncate">{q.description.slice(0, 60)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-gray-700">
                    {new Intl.NumberFormat('es-DO', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(Number(q.total))}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
                    {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Adjuntos */}
      {expense.attachments && expense.attachments.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-500" /> Adjuntos
          </h2>
          <div className="space-y-2">
            {expense.attachments.map((att: any) => (
              <a key={att.id} href={`/api/v1/expenses/${id}/attachments/${att.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">{att.fileName}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Panel de aprobación — visible para financiero/admin cuando el gasto está pendiente */}
      {isPending && canApproveExpense && (
        <div className="card p-5 border-2 border-amber-200 space-y-4">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Gasto pendiente de aprobación
          </h3>
          <p className="text-sm text-gray-600">
            Registrado por <strong>{expense.registeredBy?.name}</strong> el {fmtDate(expense.createdAt)}.
            Revisa los detalles y aprueba o rechaza este gasto.
          </p>

          {!showReject ? (
            <div className="flex gap-3">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium
                           transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {approveMutation.isPending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ThumbsUp className="w-4 h-4" />}
                Aprobar gasto
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-medium
                           hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                <ThumbsDown className="w-4 h-4" /> Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Motivo de rechazo *</label>
                <textarea rows={2} className="input-field resize-none"
                  placeholder="Explica por qué se rechaza este gasto..."
                  value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              {rejectError && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{rejectError}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowReject(false); setRejectReason(''); setRejectError(''); }}
                  className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) { setRejectError('El motivo es requerido'); return; }
                    setRejectError('');
                    rejectMutation.mutate();
                  }}
                  disabled={rejectMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium
                             transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {rejectMutation.isPending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <XCircle className="w-4 h-4" />}
                  Confirmar rechazo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Motivo de rechazo — visible para el creador */}
      {isRejected && expense.rejectionReason && (
        <div className="card p-4 bg-red-50 border border-red-200 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
            <XCircle className="w-4 h-4" /> Gasto rechazado
          </div>
          {expense.rejectedAt && <p className="text-xs text-red-400">{fmtDate(expense.rejectedAt)} · por {expense.rejectedBy?.name}</p>}
          <p className="text-sm text-red-600 mt-1">Motivo: {expense.rejectionReason}</p>
          {(isOwnExpense && (isSupervisor || isOperator)) && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <Edit className="w-3 h-3" /> Puedes editar este gasto y volver a enviarlo para aprobación.
            </p>
          )}
        </div>
      )}

      {/* Aprobado por */}
      {isActive && expense.approvedBy && (
        <div className="card p-4 bg-green-50 border border-green-100 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-sm text-green-700">
            Aprobado por <strong>{expense.approvedBy.name}</strong>
            {expense.approvedAt && <> el {fmtDate(expense.approvedAt)}</>}
          </p>
        </div>
      )}

      {/* Anulación */}
      {isVoided && expense.voidedAt && (
        <div className="card p-4 bg-red-50 border border-red-200 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
            <XCircle className="w-4 h-4" /> Gasto anulado
          </div>
          <p className="text-xs text-red-500">{fmtDate(expense.voidedAt)}</p>
          {expense.voidReason && (
            <p className="text-sm text-red-600 mt-1">Motivo: {expense.voidReason}</p>
          )}
        </div>
      )}

      {/* Eliminar permanentemente — solo admin */}
      {isAdmin && (
        <div className="pb-2">
          <button
            onClick={() => { if (window.confirm('⚠️ ¿Eliminar este gasto PERMANENTEMENTE? Esta acción no se puede deshacer.')) hardDeleteMut.mutate(); }}
            disabled={hardDeleteMut.isPending}
            className="w-full py-2 rounded-xl border-2 border-red-400 bg-red-50 text-red-700 text-sm font-bold
                       hover:bg-red-100 transition-all flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> {hardDeleteMut.isPending ? 'Eliminando...' : '🗑 Eliminar permanentemente (Admin)'}
          </button>
        </div>
      )}

      {/* Botón anular */}
      {canVoid && !isVoided && (
        <div className="pb-6">
          {!showVoid ? (
            <button onClick={() => setShowVoid(true)}
              className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-medium
                         hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Anular gasto
            </button>
          ) : (
            <div className="card p-5 space-y-4 border-2 border-red-200">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Confirmar anulación
              </h3>
              <p className="text-sm text-gray-600">
                Esta acción anulará el gasto de <strong>{fmt(Number(expense.amount))}</strong>.
                El monto será descontado del resumen del proyecto. Esta acción no se puede revertir.
              </p>
              <div>
                <label className="label">Motivo de anulación *</label>
                <textarea rows={2} className="input-field resize-none"
                  placeholder="Explica el motivo de la anulación..."
                  value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </div>
              {voidError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {voidError}
                </p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowVoid(false); setVoidReason(''); setVoidError(''); }}
                  className="btn-secondary flex-1">Cancelar</button>
                <button type="button"
                  onClick={() => {
                    if (!voidReason.trim()) { setVoidError('El motivo es requerido'); return; }
                    setVoidError('');
                    voidMutation.mutate();
                  }}
                  disabled={voidMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium
                             transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {voidMutation.isPending
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Anulando...</>
                    : <><XCircle className="w-4 h-4" /> Confirmar anulación</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nota operador — sin anulación */}
      {isOperator && !isVoided && (
        <div className="pb-6">
          <div className="card p-4 flex items-center gap-3 text-sm text-gray-500 bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Solo administradores y supervisores pueden anular gastos.</span>
          </div>
        </div>
      )}
    </div>
  );
}
