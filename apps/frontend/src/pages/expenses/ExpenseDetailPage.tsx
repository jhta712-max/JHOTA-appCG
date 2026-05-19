import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Receipt, Calendar, User, MapPin,
  CreditCard, FileText, AlertCircle, CheckCircle, XCircle,
  Paperclip, Trash2, ExternalLink,
} from 'lucide-react';
import { expensesApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { PAYMENT_METHOD_LABELS } from '../../types';

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ExpenseDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const user       = useAuthStore((s) => s.user);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  const canEdit   = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';
  const canVoid   = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';
  const isOperator = user?.role?.name === 'operator';

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expense', id],
    queryFn:  () => expensesApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const voidMutation = useMutation({
    mutationFn: () => expensesApi.void(id!, voidReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['project-summary'] });
      setShowVoid(false);
    },
    onError: (err: any) => {
      setVoidError(err.response?.data?.error || 'Error al anular el gasto');
    },
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando gasto...</div>;
  if (error || !expense) return (
    <div className="text-center py-20 text-gray-400">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p>No se encontró el gasto</p>
      <button onClick={() => navigate('/expenses')} className="btn-secondary mt-4">Volver a gastos</button>
    </div>
  );

  const isVoided   = expense.status === 'VOIDED';
  const isEditable = !isVoided && (
    canEdit ||
    (isOperator && (() => {
      const created = new Date(expense.createdAt);
      return (Date.now() - created.getTime()) < 24 * 60 * 60 * 1000;
    })())
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
            {isVoided
              ? <span className="badge-voided">Anulado</span>
              : <span className="badge-active">Activo</span>
            }
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {expense.project?.code} — {expense.category?.name}
          </p>
        </div>
        {isEditable && (
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
              <p className="font-medium text-gray-800">{fmtDate(expense.expenseDate)}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Método de pago</p>
              <p className="font-medium text-gray-800">{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</p>
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
