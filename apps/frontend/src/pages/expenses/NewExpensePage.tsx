import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Camera, CheckCircle, AlertCircle, ArrowLeft, Receipt,
  Sparkles, Loader2, TriangleAlert, X, Info, FileText, Upload, CreditCard,
} from 'lucide-react';
import { expensesApi, projectsApi, categoriesApi, ocrApi, cardsApi, type OcrResult } from '../../api';
import { useRole } from '../../hooks/useRole';

type FV = { ncf: string; supplierRnc: string; supplierName: string; itbisAmount: number };
type FormData = {
  projectId: string; categoryId: number; expenseDate: string;
  amount: number; description: string; paymentMethod: string;
  companyCardId?: number;
  hasFiscalDoc: boolean; notes: string;
  fiscalVoucher?: FV;
  // Moneda extranjera
  foreignCurrency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
};

const NCF_REGEX   = /^[A-Z]\d{10}$/;
const E_NCF_REGEX = /^E\d{12}$/;
const RNC_REGEX   = /^\d{9}(\d{2})?$/;

const CONFIDENCE_CONFIG = {
  high:   { label: 'Alta confianza',   color: 'text-green-700 bg-green-100',  icon: '✓' },
  medium: { label: 'Confianza media',  color: 'text-yellow-700 bg-yellow-100', icon: '~' },
  low:    { label: 'Baja confianza',   color: 'text-red-700 bg-red-100',      icon: '!' },
};

// Mapeo de categorías sugeridas a IDs — coincide con el seed de la BD
const CATEGORY_NAME_MAP: Record<string, string> = {
  'Materiales':   'Materiales',
  'Servicios':    'Servicios',
  'Mano de obra': 'Mano de obra',
  'Equipos':      'Equipos',
  'Transporte':   'Transporte',
  'Combustible':  'Combustible',
  'Dietas':       'Dietas',
  'Otros':        'Otros',
};

export default function NewExpensePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { canCreateExpense } = useRole();

  useEffect(() => {
    if (!canCreateExpense) navigate('/dashboard', { replace: true });
  }, [canCreateExpense, navigate]);
  const fileRef       = useRef<HTMLInputElement>(null);
  const cameraRef     = useRef<HTMLInputElement>(null);

  const [hasFiscal,      setHasFiscal]      = useState(false);
  const [useForeign,     setUseForeign]     = useState(false);
  const [foreignCurrency, setForeignCurrency] = useState('USD');
  const [photo,       setPhoto]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [success,     setSuccess]     = useState('');
  const [apiError,    setApiError]    = useState('');

  // OCR state
  const [ocrLoading,    setOcrLoading]    = useState(false);
  const [ocrResult,     setOcrResult]     = useState<OcrResult | null>(null);
  const [ocrError,      setOcrError]      = useState('');
  const [ocrValidated,  setOcrValidated]  = useState(false); // Usuario debe validar datos OCR
  const [aiFields,      setAiFields]      = useState<Set<string>>(new Set()); // campos llenados por IA

  const { register, handleSubmit, watch, formState: { errors }, reset, setValue, getValues } =
    useForm<FormData>({
      defaultValues: { expenseDate: new Date().toISOString().split('T')[0], hasFiscalDoc: false },
    });

  // Pre-seleccionar proyecto desde state (botón del proyecto) o query param
  useEffect(() => {
    const stateProjectId = (location.state as any)?.projectId;
    const queryProjectId = new URLSearchParams(location.search).get('projectId');
    const pid = stateProjectId ?? queryProjectId;
    if (pid) setValue('projectId', pid);
  }, [location, setValue]);

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

  const { data: cards } = useQuery({
    queryKey: ['cards', 'active'],
    queryFn:  () => cardsApi.list(true),
    select:   (r) => r.data.data,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess:  async (res) => {
      if (photo) {
        try { await expensesApi.uploadAttachment(res.data.data.id, photo); } catch { /* continuar */ }
      }
      setSuccess('Gasto registrado exitosamente');
      reset();
      setHasFiscal(false);
      setPhoto(null);
      setPhotoPreview(null);
      setOcrResult(null);
      setAiFields(new Set());
      setTimeout(() => navigate('/expenses'), 1500);
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.error || 'Error al registrar el gasto');
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
    if (data.paymentMethod === 'CARD' && data.companyCardId) {
      payload.companyCardId = Number(data.companyCardId);
    }
    if (useForeign && data.foreignAmount && data.exchangeRate) {
      payload.foreignAmount   = Number(data.foreignAmount);
      payload.foreignCurrency = foreignCurrency;
      payload.exchangeRate    = Number(data.exchangeRate);
      // El monto en DOP se calcula automáticamente si el usuario no lo ingresó
      if (!data.amount || data.amount <= 0) {
        payload.amount = Number(data.foreignAmount) * Number(data.exchangeRate);
      }
    }
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

  // ── Seleccionar foto ───────────────────────────────────────
  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    setOcrResult(null);
    setOcrError('');
    setOcrValidated(false); // Reset validación cuando se carga nueva foto
    setAiFields(new Set());
    setPhotoPreview(null);
    if (file && file.type !== 'application/pdf') {
      // Solo mostrar preview para imágenes, no PDFs
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ── Analizar con IA ─────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!photo) return;
    setOcrLoading(true);
    setOcrError('');
    setOcrResult(null);
    setOcrValidated(false); // Reset validación cuando se analiza nueva foto
    setAiFields(new Set());

    try {
      const res  = await ocrApi.analyze(photo);
      const data = res.data.data;
      setOcrResult(data);

      const filled = new Set<string>();

      // Auto-llenar campos con los datos extraídos
      if (data.date) {
        setValue('expenseDate', data.date);
        filled.add('expenseDate');
      }
      if (data.amount !== null) {
        setValue('amount', data.amount);
        filled.add('amount');
      }
      if (data.description) {
        setValue('description', data.description);
        filled.add('description');
      }
      if (data.paymentMethod) {
        setValue('paymentMethod', data.paymentMethod);
        filled.add('paymentMethod');
      }

      // Categoría sugerida
      if (data.suggestedCategory && categories) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === data.suggestedCategory!.toLowerCase()
        );
        if (match) {
          setValue('categoryId', match.id);
          filled.add('categoryId');
        }
      }

      // Comprobante fiscal
      if (data.ncf || data.supplierName || data.supplierRnc || data.itbisAmount !== null) {
        setHasFiscal(true);
        if (data.ncf) {
          setValue('fiscalVoucher.ncf', data.ncf);
          filled.add('ncf');
        }
        if (data.supplierName) {
          setValue('fiscalVoucher.supplierName', data.supplierName);
          filled.add('supplierName');
        }
        if (data.supplierRnc) {
          setValue('fiscalVoucher.supplierRnc', data.supplierRnc);
          filled.add('supplierRnc');
        }
        if (data.itbisAmount !== null) {
          setValue('fiscalVoucher.itbisAmount', data.itbisAmount);
          filled.add('itbisAmount');
        }
      }

      setAiFields(filled);
    } catch (err: any) {
      setOcrError(err.response?.data?.error ?? 'Error al procesar la imagen con IA');
    } finally {
      setOcrLoading(false);
    }
  };

  const clearAiField = (field: string) => {
    setAiFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
  };

  const confidenceCfg = ocrResult ? CONFIDENCE_CONFIG[ocrResult.confidence] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="module-label">MÓDULO / GASTOS</p>
          <h1 className="page-title">Nuevo Gasto</h1>
          <p className="text-sm text-gray-500">Completa los campos o usa IA para autocompletar desde una foto</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      {apiError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── SECCIÓN 1: Foto + IA ─────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Foto de factura
            </h2>
            <span className="text-xs text-gray-400">Recomendado — activa el autocompletado IA</span>
          </div>

          {/* Zona de upload — previsualización */}
          {(photoPreview || photo) && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center gap-2">
              {photoPreview ? (
                <img src={photoPreview} alt="Factura" className="max-h-48 rounded-lg object-contain shadow" />
              ) : photo && photo.type === 'application/pdf' ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <FileText className="w-10 h-10 text-red-400" />
                  <p className="text-sm font-medium text-gray-700">{photo.name}</p>
                  <p className="text-xs text-gray-400">PDF listo para analizar</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Botones de carga */}
          {!photo && (
            <div className="grid grid-cols-2 gap-3">
              {/* Opción 1: Tomar foto con cámara */}
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 transition-all"
              >
                <Camera className="w-7 h-7 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Tomar foto</p>
                  <p className="text-xs text-gray-400 mt-0.5">Usar cámara</p>
                </div>
              </button>

              {/* Opción 2: Subir archivo desde el dispositivo */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 transition-all"
              >
                <Upload className="w-7 h-7 text-gray-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Subir archivo</p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, PDF</p>
                </div>
              </button>
            </div>
          )}

          {/* Input cámara (fuerza cámara en móvil) */}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            ref={cameraRef}
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />
          {/* Input archivo (galería, archivos, escaneados, PDF) */}
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            ref={fileRef}
            onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
          />

          {photo && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-green-600 flex items-center gap-1 flex-1">
                <CheckCircle className="w-3 h-3" /> {photo.name} ({(photo.size / 1024 / 1024).toFixed(2)} MB)
              </p>
              <button
                type="button"
                onClick={() => handlePhotoChange(null)}
                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Quitar
              </button>
            </div>
          )}

          {/* Botón Analizar con IA */}
          {photo && !ocrLoading && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                         bg-gradient-to-r from-violet-600 to-indigo-600 text-white
                         hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              Analizar con IA — autocompletar formulario
            </button>
          )}

          {ocrLoading && (
            <div className="flex items-center justify-center gap-3 py-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-indigo-700">Analizando factura con IA...</p>
                <p className="text-xs text-indigo-500">Extrayendo NCF, montos y datos fiscales</p>
              </div>
            </div>
          )}

          {ocrError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{ocrError}</p>
            </div>
          )}

          {/* Resultado OCR */}
          {ocrResult && !ocrLoading && (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-indigo-800">
                      IA detectó {ocrResult.fieldsDetected} campo{ocrResult.fieldsDetected !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {confidenceCfg && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceCfg.color}`}>
                      {confidenceCfg.icon} {confidenceCfg.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-600 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Los campos marcados en violeta fueron completados automáticamente. Verifica y corrige si es necesario.
                </p>
                {ocrResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {ocrResult.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                        <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ⚠️ VALIDACIÓN OBLIGATORIA DE OCR */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ocrValidated}
                    onChange={(e) => setOcrValidated(e.target.checked)}
                    className="mt-1 rounded border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900">
                      ✓ He revisado y validado los datos del OCR
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Confirma que comparaste los datos extraídos (especialmente montos, NCF y fechas) con la factura original y que son correctos. Esta validación es obligatoria para registrar el gasto.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN 2: Información del gasto ─────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">2</span>
            Información del gasto
          </h2>

          <div>
            <label className="label">Proyecto *</label>
            <select
              className={`input-field ${errors.projectId ? 'input-error' : ''}`}
              {...register('projectId', { required: 'Selecciona un proyecto' })}
            >
              <option value="">— Selecciona un proyecto —</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AiField label="Fecha *" aiActive={aiFields.has('expenseDate')} onClear={() => clearAiField('expenseDate')}>
              <input
                type="date"
                className={`input-field ${errors.expenseDate ? 'input-error' : ''} ${aiFields.has('expenseDate') ? 'ring-2 ring-violet-400' : ''}`}
                {...register('expenseDate', { required: 'La fecha es requerida' })}
              />
            </AiField>
            <AiField label="Monto (RD$) *" aiActive={aiFields.has('amount')} onClear={() => clearAiField('amount')}>
              <input
                type="number" step="0.01" min="0.01" placeholder="0.00"
                className={`input-field ${errors.amount ? 'input-error' : ''} ${aiFields.has('amount') ? 'ring-2 ring-violet-400' : ''}`}
                {...register('amount', { required: !useForeign ? 'El monto es requerido' : false, min: { value: 0.01, message: 'Debe ser mayor a 0' } })}
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </AiField>
          </div>

          {/* Sección de moneda extranjera */}
          <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useForeign} onChange={(e) => setUseForeign(e.target.checked)}
                className="rounded border-gray-300" />
              <span className="text-sm font-medium text-blue-800">💱 Pago realizado en moneda extranjera</span>
            </label>
            {useForeign && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Moneda</label>
                  <select value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value)}
                    className="input-field text-sm">
                    <option value="USD">USD — Dólar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — Libra</option>
                    <option value="CAD">CAD — Dólar canadiense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monto en {foreignCurrency} *</label>
                  <input type="number" step="0.01" min="0.01" placeholder="0.00"
                    className="input-field text-sm"
                    {...register('foreignAmount', { required: useForeign })}
                    onChange={(e) => {
                      const fa = parseFloat(e.target.value);
                      const er = parseFloat((document.querySelector('[name="exchangeRate"]') as HTMLInputElement)?.value ?? '0');
                      if (fa > 0 && er > 0) setValue('amount', parseFloat((fa * er).toFixed(2)));
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tasa de cambio (1 {foreignCurrency} = X DOP)</label>
                  <input type="number" step="0.01" min="0.01" placeholder="ej: 60.50"
                    className="input-field text-sm"
                    {...register('exchangeRate', { required: useForeign })}
                    onChange={(e) => {
                      const er = parseFloat(e.target.value);
                      const fa = parseFloat((document.querySelector('[name="foreignAmount"]') as HTMLInputElement)?.value ?? '0');
                      if (fa > 0 && er > 0) setValue('amount', parseFloat((fa * er).toFixed(2)));
                    }}
                  />
                </div>
              </div>
            )}
            {useForeign && (
              <p className="text-xs text-blue-600">
                El campo <strong>Monto (RD$)</strong> se calcula automáticamente. Puedes ajustarlo si la tasa real fue diferente.
              </p>
            )}
          </div>

          <AiField label="Descripción *" aiActive={aiFields.has('description')} onClear={() => clearAiField('description')}>
            <input
              type="text" placeholder="¿En qué se gastó?"
              className={`input-field ${errors.description ? 'input-error' : ''} ${aiFields.has('description') ? 'ring-2 ring-violet-400' : ''}`}
              {...register('description', { required: 'La descripción es requerida', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </AiField>

          <div className="grid grid-cols-2 gap-4">
            <AiField label="Categoría *" aiActive={aiFields.has('categoryId')} onClear={() => clearAiField('categoryId')}>
              <select
                className={`input-field ${errors.categoryId ? 'input-error' : ''} ${aiFields.has('categoryId') ? 'ring-2 ring-violet-400' : ''}`}
                {...register('categoryId', { required: 'Selecciona una categoría' })}
              >
                <option value="">— Categoría —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </AiField>
            <AiField label="Método de pago *" aiActive={aiFields.has('paymentMethod')} onClear={() => clearAiField('paymentMethod')}>
              <select
                className={`input-field ${errors.paymentMethod ? 'input-error' : ''} ${aiFields.has('paymentMethod') ? 'ring-2 ring-violet-400' : ''}`}
                {...register('paymentMethod', { required: 'Selecciona método' })}
              >
                <option value="">— Método —</option>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro</option>
              </select>
            </AiField>
          </div>

          {/* Selector de tarjeta — solo cuando paymentMethod = CARD */}
          {watch('paymentMethod') === 'CARD' && (
            <div>
              <label className="label flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-gray-500" />
                Tarjeta utilizada *
              </label>
              <select
                className={`input-field ${errors.companyCardId ? 'input-error' : ''}`}
                {...register('companyCardId', {
                  required: 'Selecciona la tarjeta utilizada',
                  validate: (v) => (v && Number(v) > 0) ? true : 'Selecciona la tarjeta utilizada',
                })}
              >
                <option value="">— Selecciona una tarjeta —</option>
                {(cards ?? []).map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.holderName} — **** {card.lastFour} ({card.cardType} · {card.bank})
                  </option>
                ))}
              </select>
              {errors.companyCardId && (
                <p className="text-red-500 text-xs mt-1">{errors.companyCardId.message}</p>
              )}
              {(cards ?? []).length === 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  No hay tarjetas registradas. Contacta al administrador.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea rows={2} placeholder="Información adicional..."
              className="input-field resize-none" {...register('notes')} />
          </div>
        </div>

        {/* ── SECCIÓN 3: Comprobante fiscal ─────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs flex items-center justify-center font-bold">3</span>
            Comprobante fiscal
            {(aiFields.has('ncf') || aiFields.has('supplierName') || aiFields.has('supplierRnc')) && (
              <span className="text-xs font-normal text-violet-600 flex items-center gap-1 ml-1">
                <Sparkles className="w-3 h-3" /> datos detectados por IA
              </span>
            )}
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
              <AiField label="NCF *" aiActive={aiFields.has('ncf')} onClear={() => clearAiField('ncf')}>
                <input type="text" placeholder="B0100000001" maxLength={13}
                  className={`input-field uppercase ${aiFields.has('ncf') ? 'ring-2 ring-violet-400' : ''}`}
                  {...register('fiscalVoucher.ncf', {
                    required: 'El NCF es requerido',
                    validate: (v) =>
                      NCF_REGEX.test(v?.toUpperCase() ?? '') || E_NCF_REGEX.test(v?.toUpperCase() ?? '')
                        ? true : 'NCF inválido (B0100000001 o E310000000001)',
                  })}
                />
                {(errors as any).fiscalVoucher?.ncf && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.ncf.message}</p>
                )}
              </AiField>
              <div className="grid grid-cols-2 gap-3">
                <AiField label="RNC Suplidor *" aiActive={aiFields.has('supplierRnc')} onClear={() => clearAiField('supplierRnc')}>
                  <input type="text" placeholder="101234567" maxLength={11}
                    className={`input-field ${aiFields.has('supplierRnc') ? 'ring-2 ring-violet-400' : ''}`}
                    {...register('fiscalVoucher.supplierRnc', {
                      required: 'RNC requerido',
                      validate: (v) => RNC_REGEX.test(v ?? '') ? true : 'RNC inválido (9 u 11 dígitos)',
                    })}
                  />
                  {(errors as any).fiscalVoucher?.supplierRnc && (
                    <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierRnc.message}</p>
                  )}
                </AiField>
                <AiField label="ITBIS (RD$)" aiActive={aiFields.has('itbisAmount')} onClear={() => clearAiField('itbisAmount')}>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className={`input-field ${aiFields.has('itbisAmount') ? 'ring-2 ring-violet-400' : ''}`}
                    {...register('fiscalVoucher.itbisAmount')}
                  />
                </AiField>
              </div>
              <AiField label="Nombre del suplidor *" aiActive={aiFields.has('supplierName')} onClear={() => clearAiField('supplierName')}>
                <input type="text" placeholder="Empresa o persona que emitió la factura"
                  className={`input-field ${aiFields.has('supplierName') ? 'ring-2 ring-violet-400' : ''}`}
                  {...register('fiscalVoucher.supplierName', { required: 'Nombre requerido' })}
                />
                {(errors as any).fiscalVoucher?.supplierName && (
                  <p className="text-red-500 text-xs mt-1">{(errors as any).fiscalVoucher.supplierName.message}</p>
                )}
              </AiField>
            </div>
          )}
        </div>

        {/* Alerta si OCR no está validado */}
        {ocrResult && !ocrValidated && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-semibold">No puedes registrar el gasto sin validar el OCR</p>
              <p className="text-xs mt-1">Marca el checkbox de validación arriba para confirmar que revisaste los datos</p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="submit"
            disabled={mutation.isPending || (ocrResult !== null && !ocrValidated)}
            title={ocrResult && !ocrValidated ? 'Debes validar los datos del OCR antes de guardar' : ''}
            className="btn-primary flex-1 py-3"
          >
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : <><CheckCircle className="w-4 h-4" /> Guardar gasto</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Componente helper: envuelve un campo con indicador IA ───────
function AiField({
  label,
  aiActive,
  onClear,
  children,
}: {
  label: string;
  aiActive: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label !mb-0">{label}</label>
        {aiActive && (
          <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
            <Sparkles className="w-3 h-3" />
            IA
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
