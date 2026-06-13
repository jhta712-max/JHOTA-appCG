import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Receipt, Calendar, User, MapPin,
  CreditCard, FileText, AlertCircle, CheckCircle, XCircle,
  Paperclip, Trash2, ExternalLink, Clock, ThumbsUp, ThumbsDown, Layers,
} from 'lucide-react';
import { expensesApi, quotationsApi } from '../../api';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';
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

  if (isLoading) {
    const meta = PAGE_META['/expenses'];
    return (
      <div>
        <div className="flex items-center justify-between px-6 py-5" style={{ background: '#1C1C1C' }}>
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
  if (error || !expense) return (
    <div className="text-center py-20 text-gray-400">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="font-['DM_Sans']">No se encontró el gasto</p>
      <button
        onClick={() => navigate('/expenses')}
        className="font-['Barlow_Condensed'] uppercase text-sm font-bold px-4 py-2 mt-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Volver a gastos
      </button>
    </div>
  );

  const isVoided          = expense.status === 'VOIDED';
  const isPending         = expense.status === 'PENDING_APPROVAL';
  const isRejected        = expense.status === 'REJECTED';
  const isActive          = expense.status === 'ACTIVE';
  const isOwnExpense      = expense.registeredBy?.id === currentUserId;
  const within24h         = (Date.now() - new Date(expense.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  const canEdit = (
    (isSupervisor && isActive) ||
    (isOwnExpense && isPending && (isSupervisor || (isOperator && within24h))) ||
    (isOwnExpense && isRejected && (isSupervisor || isOperator))
  );

  const inputCls = "w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white resize-none";

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Hero header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-2" style={{ background: '#1C1C1C' }}>
        <div className="max-w-2xl flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-[#F5C218] p-1 mt-1 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-['Barlow_Condensed'] text-xs tracking-[0.2em] uppercase mb-1" style={{ color: '#F5C218' }}>
              MÓDULO / GASTOS
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-['Barlow_Condensed'] text-3xl font-bold tracking-tight text-white uppercase truncate">
                {expense.description}
              </h1>
              {isVoided   && <span className="font-['DM_Sans'] text-xs px-2 py-0.5 bg-red-900 text-red-300 font-medium">Anulado</span>}
              {isActive   && <span className="font-['DM_Sans'] text-xs px-2 py-0.5" style={{ background: '#F5C218', color: '#1C1C1C' }}>Activo</span>}
              {isPending  && <span className="font-['DM_Sans'] text-xs px-2 py-0.5 bg-amber-900/50 text-amber-300 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />Pendiente</span>}
              {isRejected && <span className="font-['DM_Sans'] text-xs px-2 py-0.5 bg-red-900/50 text-red-300 font-medium flex items-center gap-1"><XCircle className="w-3 h-3" />Rechazado</span>}
            </div>
            <p className="font-['Space_Mono'] text-xs text-gray-400 mt-1">
              {expense.project?.code} — {expense.category?.name}
            </p>
          </div>
          {canEdit && (
            <Link
              to={`/expenses/${id}/edit`}
              className="font-['Barlow_Condensed'] uppercase text-xs font-bold px-3 py-2 flex items-center gap-1.5 transition-colors shrink-0"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >
              <Edit className="w-4 h-4" /> Editar
            </Link>
          )}
        </div>
      </div>

      {/* Monto destacado */}
      <div className={`bg-white border border-gray-100 p-5 text-center ${isVoided ? 'opacity-60' : ''}`}>
        <p className="font-['DM_Sans'] text-xs text-gray-500 mb-1">Monto del gasto</p>
        <p className={`font-['Space_Mono'] text-4xl font-bold ${isVoided ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {fmt(Number(expense.amount))}
        </p>
        {expense.fiscalVoucher && (
          <p className="font-['DM_Sans'] text-xs text-blue-500 mt-1">
            ITBIS incluido: {fmt(Number(expense.fiscalVoucher.itbisAmount ?? 0))}
          </p>
        )}
      </div>

      {/* Detalles generales */}
      <div className="bg-white border border-gray-100 p-5 space-y-4">
        <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">Detalles del gasto</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">

          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">Fecha</p>
              <p className="font-['DM_Sans'] font-medium text-gray-800">{fmtDate(expense.expenseDate, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">Método de pago</p>
              <p className="font-['DM_Sans'] font-medium text-gray-800">{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</p>
              {expense.companyCard && (
                <p className="font-['Space_Mono'] text-xs text-gray-500 mt-0.5">
                  {expense.companyCard.holderName} — **** {expense.companyCard.lastFour}
                  <span className="ml-1 text-gray-400">({expense.companyCard.cardType} · {expense.companyCard.bank})</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">Proyecto</p>
              <Link to={`/projects/${expense.project?.id}`}
                className="font-['DM_Sans'] font-medium text-[#1C1C1C] hover:text-[#F5C218] transition-colors">
                {expense.project?.code}
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">Categoría</p>
              <p className="font-['DM_Sans'] font-medium text-gray-800">{expense.category?.name}</p>
            </div>
          </div>

          {expense.projectItem && (
            <div className="flex items-start gap-2">
              <Layers className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-['DM_Sans'] text-xs text-gray-400">Item del proyecto</p>
                <p className="font-['DM_Sans'] font-medium text-gray-800">
                  <span className="font-['Space_Mono'] text-[#1C1C1C]">#{expense.projectItem.number}</span>{' '}
                  {expense.projectItem.name}
                </p>
              </div>
            </div>
          )}

          {expense.registeredBy && (
            <div className="flex items-start gap-2 col-span-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-['DM_Sans'] text-xs text-gray-400">Registrado por</p>
                <p className="font-['DM_Sans'] font-medium text-gray-800">{expense.registeredBy.name}</p>
              </div>
            </div>
          )}
        </div>

        {expense.notes && (
          <div className="pt-3 border-t border-gray-100">
            <p className="font-['DM_Sans'] text-xs text-gray-400 mb-1">Notas</p>
            <p className="font-['DM_Sans'] text-sm text-gray-700">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Comprobante fiscal */}
      {expense.hasFiscalDoc && expense.fiscalVoucher && (
        <div className="bg-white border border-gray-100 p-5 space-y-3">
          <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
            <Receipt className="w-4 h-4" style={{ color: '#F5C218' }} /> Comprobante Fiscal
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 bg-[#1C1C1C] p-3">
              <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-400 mb-0.5">NCF</p>
              <p className="font-['Space_Mono'] font-bold text-lg" style={{ color: '#F5C218' }}>{expense.fiscalVoucher.ncf}</p>
              <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">
                {expense.fiscalVoucher.isElectronic ? 'e-NCF Electrónico (Ley 32-23)' : 'NCF Tradicional'}
              </p>
            </div>
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">RNC Suplidor</p>
              <p className="font-['Space_Mono'] font-medium text-gray-800">{expense.fiscalVoucher.supplierRnc}</p>
            </div>
            <div>
              <p className="font-['DM_Sans'] text-xs text-gray-400">ITBIS</p>
              <p className="font-['Space_Mono'] font-medium text-gray-800">{fmt(Number(expense.fiscalVoucher.itbisAmount ?? 0))}</p>
            </div>
            <div className="col-span-2">
              <p className="font-['DM_Sans'] text-xs text-gray-400">Nombre del Suplidor</p>
              <p className="font-['DM_Sans'] font-medium text-gray-800">{expense.fiscalVoucher.supplierName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sin comprobante fiscal */}
      {!expense.hasFiscalDoc && (
        <div className="bg-white border border-gray-100 p-4 flex items-center gap-3 text-sm text-gray-500">
          <Receipt className="w-4 h-4 text-gray-300 shrink-0" />
          <span className="font-['DM_Sans']">Este gasto no tiene comprobante fiscal</span>
        </div>
      )}

      {/* Cotizaciones relacionadas */}
      {linkedQuotations && linkedQuotations.length > 0 && (
        <div className="bg-white border border-gray-100 p-5 space-y-3">
          <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Cotizaciones relacionadas
          </h2>
          <p className="font-['DM_Sans'] text-xs text-gray-400">
            Estas cotizaciones del mismo proyecto y suplidor podrían estar relacionadas con este gasto.
          </p>
          <div className="space-y-2">
            {linkedQuotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}`}
                className="flex items-center gap-3 p-3 border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors">
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-['DM_Sans'] text-sm font-medium text-gray-800">{q.supplierName}</p>
                  <p className="font-['DM_Sans'] text-xs text-gray-500 truncate">{q.description.slice(0, 60)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-['Space_Mono'] text-xs font-semibold text-gray-700">
                    {new Intl.NumberFormat('es-DO', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(Number(q.total))}
                  </p>
                  <span className={`font-['Barlow_Condensed'] text-xs px-1.5 py-0.5 font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
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
        <div className="bg-white border border-gray-100 p-5 space-y-3">
          <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-500" /> Adjuntos
          </h2>
          <div className="space-y-2">
            {expense.attachments.map((att: any) => (
              <a key={att.id} href={`/api/v1/expenses/${id}/attachments/${att.id}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-['DM_Sans'] text-sm text-gray-700 flex-1 truncate">{att.fileName}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Panel de aprobación */}
      {isPending && canApproveExpense && (
        <div className="bg-white border-2 border-amber-200 p-5 space-y-4">
          <h3 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-amber-800 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Gasto pendiente de aprobación
          </h3>
          <p className="font-['DM_Sans'] text-sm text-gray-600">
            Registrado por <strong>{expense.registeredBy?.name}</strong> el {fmtDate(expense.createdAt)}.
            Revisa los detalles y aprueba o rechaza este gasto.
          </p>

          {!showReject ? (
            <div className="flex gap-3">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-['Barlow_Condensed'] text-sm font-bold uppercase
                           transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {approveMutation.isPending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ThumbsUp className="w-4 h-4" />}
                Aprobar gasto
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 py-2.5 border-2 border-red-200 text-red-600 font-['Barlow_Condensed'] text-sm font-bold uppercase
                           hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                <ThumbsDown className="w-4 h-4" /> Rechazar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Motivo de rechazo *</label>
                <textarea rows={2} className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white resize-none"
                  placeholder="Explica por qué se rechaza este gasto..."
                  value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              {rejectError && <p className="font-['DM_Sans'] text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{rejectError}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowReject(false); setRejectReason(''); setRejectError(''); }}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-700 font-['Barlow_Condensed'] text-sm font-bold uppercase hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) { setRejectError('El motivo es requerido'); return; }
                    setRejectError('');
                    rejectMutation.mutate();
                  }}
                  disabled={rejectMutation.isPending}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-['Barlow_Condensed'] text-sm font-bold uppercase
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

      {/* Motivo de rechazo */}
      {isRejected && expense.rejectionReason && (
        <div className="bg-white border border-red-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-['Barlow_Condensed'] font-bold text-sm uppercase">
            <XCircle className="w-4 h-4" /> Gasto rechazado
          </div>
          {expense.rejectedAt && <p className="font-['Space_Mono'] text-xs text-red-400">{fmtDate(expense.rejectedAt)} · por {expense.rejectedBy?.name}</p>}
          <p className="font-['DM_Sans'] text-sm text-red-600 mt-1">Motivo: {expense.rejectionReason}</p>
          {(isOwnExpense && (isSupervisor || isOperator)) && (
            <p className="font-['DM_Sans'] text-xs text-red-500 mt-2 flex items-center gap-1">
              <Edit className="w-3 h-3" /> Puedes editar este gasto y volver a enviarlo para aprobación.
            </p>
          )}
        </div>
      )}

      {/* Aprobado por */}
      {isActive && expense.approvedBy && (
        <div className="bg-[#1C1C1C] border border-[#F5C218]/40 p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#F5C218' }} />
          <p className="font-['DM_Sans'] text-sm" style={{ color: '#F5C218' }}>
            Aprobado por <strong>{expense.approvedBy.name}</strong>
            {expense.approvedAt && <> el {fmtDate(expense.approvedAt)}</>}
          </p>
        </div>
      )}

      {/* Anulación */}
      {isVoided && expense.voidedAt && (
        <div className="bg-white border border-red-200 p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-['Barlow_Condensed'] font-bold text-sm uppercase">
            <XCircle className="w-4 h-4" /> Gasto anulado
          </div>
          <p className="font-['Space_Mono'] text-xs text-red-500">{fmtDate(expense.voidedAt)}</p>
          {expense.voidReason && (
            <p className="font-['DM_Sans'] text-sm text-red-600 mt-1">Motivo: {expense.voidReason}</p>
          )}
        </div>
      )}

      {/* Eliminar permanentemente — solo admin */}
      {isAdmin && (
        <div className="pb-2">
          <button
            onClick={() => { if (window.confirm('Eliminar este gasto PERMANENTEMENTE? Esta acción no se puede deshacer.')) hardDeleteMut.mutate(); }}
            disabled={hardDeleteMut.isPending}
            className="w-full py-2 border-2 border-red-400 bg-red-50 text-red-700 font-['Barlow_Condensed'] text-sm font-bold uppercase
                       hover:bg-red-100 transition-all flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> {hardDeleteMut.isPending ? 'Eliminando...' : 'Eliminar permanentemente (Admin)'}
          </button>
        </div>
      )}

      {/* Botón anular */}
      {canVoid && !isVoided && (
        <div className="pb-6">
          {!showVoid ? (
            <button onClick={() => setShowVoid(true)}
              className="w-full py-2.5 border-2 border-red-200 text-red-500 font-['Barlow_Condensed'] text-sm font-bold uppercase
                         hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Anular gasto
            </button>
          ) : (
            <div className="bg-white border-2 border-red-200 p-5 space-y-4">
              <h3 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Confirmar anulación
              </h3>
              <p className="font-['DM_Sans'] text-sm text-gray-600">
                Esta acción anulará el gasto de <strong>{fmt(Number(expense.amount))}</strong>.
                El monto será descontado del resumen del proyecto. Esta acción no se puede revertir.
              </p>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Motivo de anulación *</label>
                <textarea rows={2} className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white resize-none"
                  placeholder="Explica el motivo de la anulación..."
                  value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </div>
              {voidError && (
                <p className="font-['DM_Sans'] text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {voidError}
                </p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowVoid(false); setVoidReason(''); setVoidError(''); }}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-700 font-['Barlow_Condensed'] text-sm font-bold uppercase hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="button"
                  onClick={() => {
                    if (!voidReason.trim()) { setVoidError('El motivo es requerido'); return; }
                    setVoidError('');
                    voidMutation.mutate();
                  }}
                  disabled={voidMutation.isPending}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-['Barlow_Condensed'] text-sm font-bold uppercase
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

      {/* Nota operador */}
      {isOperator && !isVoided && (
        <div className="pb-6">
          <div className="bg-amber-50 border border-amber-200 p-4 flex items-center gap-3 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="font-['DM_Sans']">Solo administradores y supervisores pueden anular gastos.</span>
          </div>
        </div>
      )}
    </div>
  );
}
