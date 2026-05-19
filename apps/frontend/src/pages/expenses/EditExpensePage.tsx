import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle, AlertCircle, ArrowLeft, Receipt, Loader2 } from 'lucide-react';
import { expensesApi, projectsApi, categoriesApi } from '../../api';

type FV = { ncf: string; supplierRnc: string; supplierName: string; itbisAmount: number };
type FormData = {
  projectId:     string;
  categoryId:    number;
  expenseDate:   string;
  amount:        number;
  description:   string;
  paymentMethod: string;
  hasFiscalDoc:  boolean;
  notes:         string;
  fiscalVoucher?: FV;
};

const NCF_REGEX   = /^[A-Z]\d{10}$/;
const E_NCF_REGEX = /^E\d{12}$/;
const RNC_REGEX   = /^\d{9}(\d{2})?$/;

export default function EditExpensePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hasFiscal, setHasFiscal] = useState(false);
  const [apiError,  setApiError]  = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  // ── Cargar el gasto existente ──────────────────────────────────────────────
  const { data: expense, isLoading: loadingExpense } = useQuery({
    queryKey: ['expense', id],
    queryFn:  () => expensesApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn:  () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list(),
    select:   (r) => r.data.data,
  });

  // Pre-cargar formulario cuando llegan los datos del gasto
  useEffect(() => {
    if (!expense) return;
    const hasFV = !!expense.fiscalVoucher;
    setHasFiscal(hasFV);
    reset({
      projectId:     expense.project?.id ?? expense.projectId,
      categoryId:    expense.category.id,
      expenseDate:   expense.expenseDate.split('T')[0],
      amount:        expense.amount,
      description:   expense.description,
      paymentMethod: expense.paymentMethod,
      notes:         expense.notes ?? '',
      fiscalVoucher: hasFV ? {
        ncf:          expense.fiscalVoucher!.ncf,
        supplierRnc:  expense.fiscalVoucher!.supplierRnc,
        supplierName: expense.fiscalVoucher!.supplierName,
        itbisAmount:  expense.fiscalVoucher!.itbisAmount,
      } : undefined,
    });
  }, [expense, reset]);

  // ── Mutación de actualización ─────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: any) => expensesApi.update(id!, data),
    onSuccess: () => {
      navigate(`/expenses/${id}`, { replace: true });
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.error || 'Error al actualizar el gasto');
    },
  });

  const onSubmit = (data: FormData) => {
    setApiError('');
    const payload: any = {
      projectId:     data.projectId,
      categoryId:    Number(data.categoryId),
      expenseDate:   data.expenseDate,
      amount:        Number(data.amount),
      description:   data.description,
      paymentMethod: data.paymentMethod,
      hasFiscalDoc:  hasFiscal,
      notes:         data.notes || undefined,
    };
    if (hasFiscal) {
      payload.fiscalVoucher = {
        ncf:          data.fiscalVoucher?.ncf?.toUpperCase(),
        supplierRnc:  data.fiscalVoucher?.supplierRnc,
        supplierName: data.fiscalVoucher?.supplierName,
        itbisAmount:  Number(data.fiscalVoucher?.itbisAmount ?? 0),
      };
    }
    mutation.mutate(payload);
  };

  // ── Loading inicial ───────────────────────────────────────────────────────
  if (loadingExpense) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-500">Cargando gasto...</span>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Gasto no encontrado.</p>
        <button onClick={() => navigate('/expenses')} className="btn-secondary mt-4">Volver</button>
      </div>
    );
  }

  // ── No se puede editar un gasto anulado ──────────────────────────────────
  if (expense.status === 'VOIDED') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Este gasto ha sido anulado y no puede editarse.</p>
        <button onClick={() => navigate(`/expenses/${id}`)} className="btn-secondary mt-4">
          Ver detalle
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/expenses/${id}`)}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Editar gasto</h1>
          <p className="text-sm text-gray-500">Modifica los datos del gasto</p>
        </div>
      </div>

      {/* Error global */}
      {apiError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Sección 1 — Datos del gasto */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">1</span>
            Datos del gasto
          </h2>

          <div>
            <label className="label">Proyecto *</label>
            <select className={`input-field ${errors.projectId ? 'input-error' : ''}`}
              {...register('projectId', { required: 'Selecciona un proyecto' })}>
              <option value="">— Selecciona un proyecto —</option>
              {(projects ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha *</label>
              <input type="date" className={`input-field ${errors.expenseDate ? 'input-error' : ''}`}
                {...register('expenseDate', { required: 'La fecha es requerida' })} />
            </div>
            <div>
              <label className="label">Monto (RD$) *</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00"
                className={`input-field ${errors.amount ? 'input-error' : ''}`}
                {...register('amount', {
                  required: 'El monto es requerido',
                  min: { value: 0.01, message: 'Debe ser mayor a 0' },
                })} />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Descripción *</label>
            <input type="text" placeholder="¿En qué se gastó?"
              className={`input-field ${errors.description ? 'input-error' : ''}`}
              {...register('description', {
                required: 'La descripción es requerida',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
              })} />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoría *</label>
              <select className={`input-field ${errors.categoryId ? 'input-error' : ''}`}
                {...register('categoryId', { required: 'Selecciona una categoría' })}>
                <option value="">— Categoría —</option>
                {(categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Método de pago *</label>
              <select className={`input-field ${errors.paymentMethod ? 'input-error' : ''}`}
                {...register('paymentMethod', { required: 'Selecciona método' })}>
                <option value="">— Método —</option>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea rows={2} placeholder="Información adicional..."
              className="input-field resize-none" {...register('notes')} />
          </div>
        </div>

        {/* Sección 2 — Comprobante fiscal */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">2</span>
            Comprobante fiscal
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setHasFiscal(true)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${hasFiscal ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Receipt className={`w-6 h-6 mx-auto mb-1 ${hasFiscal ? 'text-primary-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-medium ${hasFiscal ? 'text-primary-700' : 'text-gray-600'}`}>Tiene NCF</p>
            </button>
            <button type="button" onClick={() => setHasFiscal(false)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${!hasFiscal ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <span className="text-2xl block mb-1">—</span>
              <p className={`text-sm font-medium ${!hasFiscal ? 'text-gray-700' : 'text-gray-400'}`}>No aplica</p>
            </button>
          </div>

          {hasFiscal && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="label">NCF *
                  <span className="text-gray-400 font-normal"> — B0100000001 o E310000000001</span>
                </label>
                <input type="text" placeholder="B0100000001" maxLength={13}
                  className="input-field uppercase"
                  {...register('fiscalVoucher.ncf', {
                    required: 'El NCF es requerido',
                    validate: (v) =>
                      NCF_REGEX.test(v?.toUpperCase() ?? '') || E_NCF_REGEX.test(v?.toUpperCase() ?? '')
                        ? true : 'NCF inválido (11 chars tradicional o 13 chars e-NCF)',
                  })} />
                {(errors as any).fiscalVoucher?.ncf && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.ncf.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">RNC Suplidor *</label>
                  <input type="text" placeholder="101234567" maxLength={11}
                    className="input-field"
                    {...register('fiscalVoucher.supplierRnc', {
                      required: 'RNC requerido',
                      validate: (v) => RNC_REGEX.test(v ?? '') ? true : 'RNC inválido (9 u 11 dígitos)',
                    })} />
                  {(errors as any).fiscalVoucher?.supplierRnc && (
                    <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierRnc.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">ITBIS (RD$)</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="input-field" {...register('fiscalVoucher.itbisAmount')} />
                </div>
              </div>
              <div>
                <label className="label">Nombre del suplidor *</label>
                <input type="text" placeholder="Empresa o persona que emitió la factura"
                  className="input-field"
                  {...register('fiscalVoucher.supplierName', { required: 'Nombre requerido' })} />
                {(errors as any).fiscalVoucher?.supplierName && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierName.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(`/expenses/${id}`)} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 py-3">
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : <><CheckCircle className="w-4 h-4" /> Guardar cambios</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
