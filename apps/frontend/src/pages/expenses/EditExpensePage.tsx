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

const inputCls = "w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-transparent bg-white";
const labelCls = "block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

export default function EditExpensePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [hasFiscal,       setHasFiscal]       = useState(false);
  const [useForeign,      setUseForeign]      = useState(false);
  const [foreignCurrency, setForeignCurrency] = useState('USD');
  const [apiError,        setApiError]        = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

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

  useEffect(() => {
    if (!expense) return;
    const hasFV = !!expense.fiscalVoucher;
    setHasFiscal(hasFV);
    if ((expense as any).foreignAmount) {
      setUseForeign(true);
      setForeignCurrency((expense as any).foreignCurrency ?? 'USD');
    }
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
      foreignAmount:   useForeign ? Number((data as any).foreignAmount) || null : null,
      foreignCurrency: useForeign ? foreignCurrency : null,
      exchangeRate:    useForeign ? Number((data as any).exchangeRate) || null : null,
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

  if (loadingExpense) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F5C218' }} />
        <span className="font-['DM_Sans'] text-sm text-gray-500">Cargando gasto...</span>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="font-['DM_Sans']">Gasto no encontrado.</p>
        <button
          onClick={() => navigate('/expenses')}
          className="font-['Barlow_Condensed'] uppercase text-sm font-bold px-4 py-2 mt-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Volver
        </button>
      </div>
    );
  }

  if (expense.status === 'VOIDED') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-['DM_Sans'] text-gray-700 font-medium">Este gasto ha sido anulado y no puede editarse.</p>
        <button
          onClick={() => navigate(`/expenses/${id}`)}
          className="font-['Barlow_Condensed'] uppercase text-sm font-bold px-4 py-2 mt-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Ver detalle
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-0 pb-10">

      {/* Hero header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 mb-6" style={{ background: '#1C1C1C' }}>
        <div className="max-w-lg flex items-center gap-3">
          <button
            onClick={() => navigate(`/expenses/${id}`)}
            className="p-2 text-gray-400 hover:text-[#F5C218] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="font-['Barlow_Condensed'] text-xs tracking-[0.2em] uppercase mb-1" style={{ color: '#F5C218' }}>
              MÓDULO / GASTOS
            </p>
            <h1 className="font-['Barlow_Condensed'] text-3xl font-bold tracking-tight text-white uppercase">
              Editar Gasto
            </h1>
            <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">Modifica los datos del gasto</p>
          </div>
        </div>
      </div>

      {/* Error global */}
      {apiError && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-800 text-red-400 p-3 text-sm font-['DM_Sans'] mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Sección 1 — Datos del gasto */}
        <div className="bg-white border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <span
              className="w-6 h-6 text-xs font-bold flex items-center justify-center"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >1</span>
            <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">
              Datos del gasto
            </h2>
          </div>

          <div>
            <label className={labelCls}>Proyecto *</label>
            <select className={`${inputCls} ${errors.projectId ? 'border-red-400' : ''}`}
              {...register('projectId', { required: 'Selecciona un proyecto' })}>
              <option value="">— Selecciona un proyecto —</option>
              {(projects ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {errors.projectId && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.projectId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" className={`${inputCls} ${errors.expenseDate ? 'border-red-400' : ''}`}
                {...register('expenseDate', { required: 'La fecha es requerida' })} />
            </div>
            <div>
              <label className={labelCls}>Monto (RD$) *</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00"
                className={`${inputCls} font-['Space_Mono'] ${errors.amount ? 'border-red-400' : ''}`}
                {...register('amount', {
                  required: 'El monto es requerido',
                  min: { value: 0.01, message: 'Debe ser mayor a 0' },
                })} />
              {errors.amount && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
          </div>

          {/* Moneda extranjera */}
          <div className="border border-dashed border-blue-300 bg-blue-50 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useForeign} onChange={(e) => setUseForeign(e.target.checked)} className="border-gray-300" />
              <span className="font-['DM_Sans'] text-sm font-medium text-blue-800">Pago realizado en moneda extranjera</span>
            </label>
            {useForeign && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Moneda</label>
                  <select value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value)} className={inputCls + ' text-sm'}>
                    <option value="USD">USD — Dólar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — Libra</option>
                    <option value="CAD">CAD — Dólar canadiense</option>
                  </select>
                </div>
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Monto en {foreignCurrency}</label>
                  <input type="number" step="0.01" min="0.01" placeholder="0.00"
                    defaultValue={(expense as any)?.foreignAmount ?? ''}
                    className={inputCls + ' text-sm font-[\'Space_Mono\']'}
                    {...(register as any)('foreignAmount')} />
                </div>
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Tasa (1 {foreignCurrency} = X DOP)</label>
                  <input type="number" step="0.01" min="0.01" placeholder="ej: 60.50"
                    defaultValue={(expense as any)?.exchangeRate ?? ''}
                    className={inputCls + ' text-sm font-[\'Space_Mono\']'}
                    {...(register as any)('exchangeRate')} />
                </div>
              </div>
            )}
            {useForeign && (
              <p className="font-['DM_Sans'] text-xs text-blue-600">
                El campo <strong>Monto (RD$)</strong> es el valor final que se registra en el proyecto.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Descripción *</label>
            <input type="text" placeholder="¿En qué se gastó?"
              className={`${inputCls} ${errors.description ? 'border-red-400' : ''}`}
              {...register('description', {
                required: 'La descripción es requerida',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
              })} />
            {errors.description && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoría *</label>
              <select className={`${inputCls} ${errors.categoryId ? 'border-red-400' : ''}`}
                {...register('categoryId', { required: 'Selecciona una categoría' })}>
                <option value="">— Categoría —</option>
                {(categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Método de pago *</label>
              <select className={`${inputCls} ${errors.paymentMethod ? 'border-red-400' : ''}`}
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
            <label className={labelCls}>Notas (opcional)</label>
            <textarea rows={2} placeholder="Información adicional..."
              className={inputCls + ' resize-none'} {...register('notes')} />
          </div>
        </div>

        {/* Sección 2 — Comprobante fiscal */}
        <div className="bg-white border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <span
              className="w-6 h-6 text-xs font-bold flex items-center justify-center"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >2</span>
            <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">
              Comprobante fiscal
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setHasFiscal(true)}
              className={`p-4 border-2 text-center transition-all ${hasFiscal ? 'border-[#F5C218] bg-[#F5C218]/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <Receipt className={`w-6 h-6 mx-auto mb-1 ${hasFiscal ? 'text-[#1C1C1C]' : 'text-gray-400'}`} />
              <p className={`font-['Barlow_Condensed'] text-sm font-bold uppercase ${hasFiscal ? 'text-[#1C1C1C]' : 'text-gray-600'}`}>Tiene NCF</p>
            </button>
            <button type="button" onClick={() => setHasFiscal(false)}
              className={`p-4 border-2 text-center transition-all ${!hasFiscal ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <span className="font-['Space_Mono'] text-2xl block mb-1 text-gray-500">—</span>
              <p className={`font-['Barlow_Condensed'] text-sm font-bold uppercase ${!hasFiscal ? 'text-gray-700' : 'text-gray-400'}`}>No aplica</p>
            </button>
          </div>

          {hasFiscal && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className={labelCls}>
                  NCF * <span className="text-gray-400 font-normal normal-case tracking-normal"> — B0100000001 o E310000000001</span>
                </label>
                <input type="text" placeholder="B0100000001" maxLength={13}
                  className={`${inputCls} font-['Space_Mono'] uppercase`}
                  {...register('fiscalVoucher.ncf', {
                    required: 'El NCF es requerido',
                    validate: (v) =>
                      NCF_REGEX.test(v?.toUpperCase() ?? '') || E_NCF_REGEX.test(v?.toUpperCase() ?? '')
                        ? true : 'NCF inválido (11 chars tradicional o 13 chars e-NCF)',
                  })} />
                {(errors as any).fiscalVoucher?.ncf && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.ncf.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>RNC Suplidor *</label>
                  <input type="text" placeholder="101234567" maxLength={11}
                    className={`${inputCls} font-['Space_Mono']`}
                    {...register('fiscalVoucher.supplierRnc', {
                      required: 'RNC requerido',
                      validate: (v) => RNC_REGEX.test(v ?? '') ? true : 'RNC inválido (9 u 11 dígitos)',
                    })} />
                  {(errors as any).fiscalVoucher?.supplierRnc && (
                    <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierRnc.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>ITBIS (RD$)</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className={`${inputCls} font-['Space_Mono']`} {...register('fiscalVoucher.itbisAmount')} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Nombre del suplidor *</label>
                <input type="text" placeholder="Empresa o persona que emitió la factura"
                  className={inputCls}
                  {...register('fiscalVoucher.supplierName', { required: 'Nombre requerido' })} />
                {(errors as any).fiscalVoucher?.supplierName && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierName.message}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate(`/expenses/${id}`)}
            className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-2.5 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-2.5 flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#F5C218', color: '#1C1C1C' }}
          >
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : <><CheckCircle className="w-4 h-4" /> Guardar cambios</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
