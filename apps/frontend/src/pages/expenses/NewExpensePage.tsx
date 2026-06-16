import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Camera, CheckCircle, AlertCircle, ArrowLeft,
  Sparkles, Loader2, TriangleAlert, X, Info, FileText, Upload, CreditCard,
} from 'lucide-react';
import { FiscalVoucherForm, type FiscalVoucherValue } from '../../components/shared/FiscalVoucherForm';
import { ForeignCurrencyInput, type ForeignCurrencyValue } from '../../components/shared/ForeignCurrencyInput';
import { BatchItemSelect } from '../../components/shared/BatchItemSelect';
import { expensesApi, projectsApi, categoriesApi, cardsApi, suppliersApi, type OcrResult } from '../../api';
import { OcrEnrichmentAlerts } from '../../components/OcrEnrichmentAlerts';
import { useRole } from '../../hooks/useRole';
import { useOcrPolling } from '../../hooks/useOcrPolling';

type FV = { ncf: string; supplierRnc: string; supplierName: string; itbisAmount: number };
type FormData = {
  projectId: string; categoryId: number; expenseDate: string;
  amount: number; description: string; paymentMethod: string;
  companyCardId?: number;
  hasFiscalDoc: boolean; notes: string;
  fiscalVoucher?: FV;
  batchItemId?: string;
};

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
  const { canCreateExpense, isAdmin } = useRole();

  useEffect(() => {
    if (!canCreateExpense) navigate('/dashboard', { replace: true });
  }, [canCreateExpense, navigate]);
  const fileRef       = useRef<HTMLInputElement>(null);
  const cameraRef     = useRef<HTMLInputElement>(null);

  const [hasFiscal,      setHasFiscal]      = useState(false);
  const [fiscalValues,   setFiscalValues]   = useState<FiscalVoucherValue>({
    hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '',
  });
  const [foreignCurrency, setForeignCurrency] = useState<ForeignCurrencyValue>({
    enabled: false,
    currency: 'USD',
    foreignAmount: '',
    exchangeRate: '',
  });
  const [photo,       setPhoto]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [success,     setSuccess]     = useState('');
  const [apiError,    setApiError]    = useState('');
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [duplicates,  setDuplicates]  = useState<any[]>([]);

  const [useCreditLine,    setUseCreditLine]    = useState(false);
  const [creditSupplierId, setCreditSupplierId] = useState('');
  const [creditLineId,     setCreditLineId]     = useState('');

  const { register, handleSubmit, watch, formState: { errors }, reset, setValue, getValues } =
    useForm<FormData>({
      defaultValues: { expenseDate: new Date().toISOString().split('T')[0], hasFiscalDoc: false },
    });

  // OCR state — pasamos projectId para que el agente cruce con cotizaciones
  const watchedProjectId = watch('projectId');
  const { loading: ocrLoading, result: ocrResult, enrichment: ocrEnrichment, error: ocrError, analyze: runOcr, reset: resetOcr } = useOcrPolling(watchedProjectId);
  const [ocrValidated,  setOcrValidated]  = useState(false);
  const [aiFields,      setAiFields]      = useState<Set<string>>(new Set());

  // Sugerencia de categoría automática
  const [catSuggestion, setCatSuggestion] = useState<{ categoryName: string; confidence: 'high' | 'medium' | 'low' } | null>(null);
  const [catSuggestLoading, setCatSuggestLoading] = useState(false);
  const catDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const selectedProjectBatchesEnabled = projects?.find((p) => p.id === watchedProjectId)?.batchesEnabled ?? false;

  // Budget info for admin only — fetch on project selection
  const { data: projectBudget } = useQuery({
    queryKey: ['project-budget', watchedProjectId],
    queryFn:  () => projectsApi.summary(watchedProjectId).then(r => r.data.data),
    enabled:  isAdmin && !!watchedProjectId,
    staleTime: 30_000,
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

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'select'],
    queryFn:  () => suppliersApi.list(),
    select:   (r) => r.data.data,
  });

  const { data: creditLinesForExpense } = useQuery({
    queryKey: ['supplier-credit-lines-exp', creditSupplierId],
    queryFn:  () => suppliersApi.getCreditLines(creditSupplierId).then(r => r.data.data.filter((l: any) => l.isActive)),
    enabled:  !!creditSupplierId && useCreditLine,
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
      setFiscalValues({ hasFiscal: false, ncf: '', supplierRnc: '', supplierName: '', itbisAmount: '' });
      setPhoto(null);
      setPhotoPreview(null);
      resetOcr();
      setAiFields(new Set());
      setUseCreditLine(false);
      setCreditLineId('');
      setCreditSupplierId('');
      setTimeout(() => navigate('/expenses'), 1500);
    },
    onError: (err: any) => {
      setApiError(err.response?.data?.error || 'Error al registrar el gasto');
    },
  });

  const onSubmit = async (data: FormData) => {
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
    if (foreignCurrency.enabled && foreignCurrency.foreignAmount && foreignCurrency.exchangeRate) {
      payload.foreignAmount   = Number(foreignCurrency.foreignAmount);
      payload.foreignCurrency = foreignCurrency.currency;
      payload.exchangeRate    = Number(foreignCurrency.exchangeRate);
      // El monto en DOP se calcula automáticamente si el usuario no lo ingresó
      if (!data.amount || data.amount <= 0) {
        payload.amount = Number(foreignCurrency.foreignAmount) * Number(foreignCurrency.exchangeRate);
      }
    }
    if (fiscalValues.hasFiscal) {
      payload.hasFiscalDoc = true;
      payload.fiscalVoucher = {
        ncf:          fiscalValues.ncf.toUpperCase(),
        supplierRnc:  fiscalValues.supplierRnc,
        supplierName: fiscalValues.supplierName,
        itbisAmount:  Number(fiscalValues.itbisAmount ?? 0),
      };
    }
    if (data.batchItemId) payload.batchItemId = data.batchItemId;
    if (useCreditLine && creditLineId) payload.creditLineId = creditLineId;

    // Check for potential duplicates before submitting
    try {
      const res = await expensesApi.checkDuplicate({
        projectId: data.projectId,
        amount: payload.amount,
        expenseDate: data.expenseDate,
      });
      const found = res.data.data.duplicates;
      if (found.length > 0) {
        setPendingPayload(payload);
        setDuplicates(found);
        return;
      }
    } catch {
      // If check fails, proceed anyway
    }
    mutation.mutate(payload);  // falls through if not admin or no duplicates
  };

  // ── Seleccionar foto ───────────────────────────────────────
  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    resetOcr();
    setOcrValidated(false);
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
    setOcrValidated(false);
    setAiFields(new Set());

    const data = await runOcr(photo);
    if (!data) return;

    const filled = new Set<string>();

    if (data.date) { setValue('expenseDate', data.date); filled.add('expenseDate'); }
    if (data.amount !== null) { setValue('amount', data.amount); filled.add('amount'); }
    if (data.description) { setValue('description', data.description); filled.add('description'); }
    if (data.paymentMethod) { setValue('paymentMethod', data.paymentMethod); filled.add('paymentMethod'); }

    if (data.suggestedCategory && categories) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === data.suggestedCategory!.toLowerCase()
      );
      if (match) { setValue('categoryId', match.id); filled.add('categoryId'); }
    }

    if (data.ncf || data.supplierName || data.supplierRnc || data.itbisAmount !== null) {
      setFiscalValues((v) => ({
        hasFiscal:    true,
        ncf:          data.ncf          ?? v.ncf,
        supplierRnc:  data.supplierRnc  ?? v.supplierRnc,
        supplierName: data.supplierName ?? v.supplierName,
        itbisAmount:  data.itbisAmount != null ? String(data.itbisAmount) : v.itbisAmount,
      }));
      if (data.ncf)          filled.add('ncf');
      if (data.supplierName) filled.add('supplierName');
      if (data.supplierRnc)  filled.add('supplierRnc');
      if (data.itbisAmount != null) filled.add('itbisAmount');
    }

    setAiFields(filled);
    if (filled.has('categoryId')) setCatSuggestion(null);
  };

  const clearAiField = (field: string) => {
    setAiFields((prev) => { const next = new Set(prev); next.delete(field); return next; });
  };

  const handleDescriptionChange = useCallback((value: string) => {
    // Si ya hay categoría seleccionada por el usuario, no sugerir
    if (aiFields.has('categoryId')) return;
    setCatSuggestion(null);
    if (catDebounceRef.current) clearTimeout(catDebounceRef.current);
    if (value.trim().length < 5) return;
    catDebounceRef.current = setTimeout(async () => {
      setCatSuggestLoading(true);
      try {
        const res = await expensesApi.suggestCategory(value.trim());
        const { categoryName, confidence } = res.data.data;
        if (categoryName) setCatSuggestion({ categoryName, confidence });
      } catch { /* silencioso */ } finally {
        setCatSuggestLoading(false);
      }
    }, 700);
  }, [aiFields]);

  const acceptCatSuggestion = () => {
    if (!catSuggestion || !categories) return;
    const match = categories.find((c) => c.name.toLowerCase() === catSuggestion.categoryName.toLowerCase());
    if (match) {
      setValue('categoryId', match.id);
      setAiFields((prev) => new Set([...prev, 'categoryId']));
    }
    setCatSuggestion(null);
  };

  const confidenceCfg = ocrResult ? CONFIDENCE_CONFIG[ocrResult.confidence] : null;

  /* ── input / select shared class ── */
  const inputCls = (hasError?: boolean, isAi?: boolean) =>
    [
      'border border-gray-300 rounded-none px-3 py-2 text-sm font-[\'DM_Sans\'] w-full',
      'focus:ring-2 focus:ring-[#F5C218] focus:outline-none',
      hasError ? 'border-red-400' : '',
      isAi     ? 'ring-2 ring-violet-400' : '',
    ].filter(Boolean).join(' ');

  const fmtAmt = (n: number | string) =>
    'RD$ ' + parseFloat(String(n)).toLocaleString('es-DO', { minimumFractionDigits: 2 });

  return (
    <>
    {/* Duplicate confirmation modal */}
    {duplicates.length > 0 && pendingPayload && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white w-full max-w-lg shadow-2xl">
          <div className="bg-[#1C1C1C] px-5 py-4 flex items-center justify-between">
            <h2 className="font-['Barlow_Condensed'] text-lg font-bold uppercase tracking-wide text-white">
              ⚠ Posible Gasto Duplicado
            </h2>
            <button onClick={() => { setDuplicates([]); setPendingPayload(null); }}
              className="text-gray-400 hover:text-[#F5C218] text-xl leading-none">✕</button>
          </div>
          <div className="p-5">
            <p className="font-['DM_Sans'] text-sm text-gray-700 mb-4">
              Se encontraron <strong>{duplicates.length}</strong> gasto(s) con monto similar registrado(s) dentro de los últimos 3 días en este proyecto:
            </p>
            <div className="space-y-2 mb-5">
              {duplicates.map((d: any) => (
                <div key={d.id} className="border border-gray-200 px-3 py-2.5 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <span className="font-['DM_Sans'] text-sm text-gray-800 flex-1 pr-2">{d.description}</span>
                    <span className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C] shrink-0">{fmtAmt(d.amount)}</span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="font-['DM_Sans'] text-xs text-gray-500">{new Date(d.expenseDate).toLocaleDateString('es-DO')}</span>
                    <span className="font-['DM_Sans'] text-xs text-gray-500">{d.category?.name}</span>
                    <span className="font-['DM_Sans'] text-xs text-gray-500">Por: {d.registeredBy?.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDuplicates([]); setPendingPayload(null); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2 font-['DM_Sans'] text-sm hover:bg-gray-50"
              >
                Cancelar — revisar
              </button>
              <button
                onClick={() => { const p = pendingPayload; setDuplicates([]); setPendingPayload(null); mutation.mutate(p); }}
                className="flex-1 bg-[#F5C218] text-[#1C1C1C] py-2 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide hover:bg-[#e6b400]"
              >
                Registrar de todas formas
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    <div className="min-h-screen bg-gray-50">

      {/* ── Top header band ── */}
      <div style={{ background: '#1C1C1C' }} className="px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-[#F5C218] transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-widest text-gray-500">
              MÓDULO / GASTOS
            </p>
            <h1 className="font-['Barlow_Condensed'] text-3xl uppercase tracking-widest text-white leading-none">
              Nuevo Gasto
            </h1>
            <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">
              Completa los campos o usa IA para autocompletar desde una foto
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Success banner ── */}
        {success && (
          <div className="bg-[#1C1C1C] border border-[#F5C218]/40 px-4 py-3 flex items-center gap-2" style={{ color: '#F5C218' }}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <p className="font-['DM_Sans'] text-sm font-medium">{success}</p>
          </div>
        )}

        {/* ── Error banner ── */}
        {apiError && (
          <div className="bg-red-950/40 border border-red-800 text-red-400 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-['DM_Sans'] text-sm">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* ── SECCIÓN 1: Foto de factura ── */}
          <div className="bg-white border border-gray-200 p-5 space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 text-xs font-bold flex items-center justify-center"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                >
                  1
                </span>
                <h2 className="font-['Barlow_Condensed'] uppercase tracking-wide text-[#1C1C1C] text-lg">
                  Foto de factura
                </h2>
              </div>
              <span className="font-['DM_Sans'] text-xs text-gray-400">Activa el autocompletado IA</span>
            </div>

            {/* Preview zone */}
            {(photoPreview || photo) && (
              <div className="border-2 border-dashed border-gray-300 p-4 flex flex-col items-center gap-2">
                {photoPreview ? (
                  <img src={photoPreview} alt="Factura" className="max-h-48 object-contain" />
                ) : photo && photo.type === 'application/pdf' ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <FileText className="w-10 h-10 text-red-400" />
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-700">{photo.name}</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-400">PDF listo para analizar</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Upload buttons */}
            {!photo && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 hover:border-[#F5C218] hover:bg-yellow-50 p-4 cursor-pointer transition-colors"
                >
                  <Camera className="w-7 h-7 text-gray-400" />
                  <div className="text-center">
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-700">Tomar foto</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">Usar cámara</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 hover:border-[#F5C218] hover:bg-yellow-50 p-4 cursor-pointer transition-colors"
                >
                  <Upload className="w-7 h-7 text-gray-400" />
                  <div className="text-center">
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-700">Subir archivo</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">JPG, PNG, PDF</p>
                  </div>
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              ref={cameraRef}
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            />
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              ref={fileRef}
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            />

            {/* File info row */}
            {photo && (
              <div className="flex items-center gap-2">
                <p className="font-['DM_Sans'] text-xs text-green-600 flex items-center gap-1 flex-1">
                  <CheckCircle className="w-3 h-3" />
                  {photo.name} ({(photo.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                <button
                  type="button"
                  onClick={() => handlePhotoChange(null)}
                  className="font-['DM_Sans'] text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Quitar
                </button>
              </div>
            )}

            {/* Analizar con IA — keep violet gradient (AI-specific branding) */}
            {photo && !ocrLoading && (
              <button
                type="button"
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 py-3 font-semibold text-sm
                           bg-gradient-to-r from-violet-600 to-indigo-600 text-white
                           hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Analizar con IA — autocompletar formulario
              </button>
            )}

            {/* OCR loading */}
            {ocrLoading && (
              <div className="flex items-center justify-center gap-3 py-4 bg-indigo-50 border border-indigo-200">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                <div>
                  <p className="font-['DM_Sans'] text-sm font-medium text-indigo-700">Procesando con IA...</p>
                  <p className="font-['DM_Sans'] text-xs text-indigo-500">Extrayendo NCF, montos y datos fiscales (10-15 seg)</p>
                </div>
              </div>
            )}

            {/* OCR error */}
            {ocrError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 p-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="font-['DM_Sans'] text-sm text-red-600">{ocrError}</p>
              </div>
            )}

            {/* OCR result panel — keep AI indigo theme */}
            {ocrResult && !ocrLoading && (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <p className="font-['DM_Sans'] text-sm font-semibold text-indigo-800">
                        IA detectó {ocrResult.fieldsDetected} campo{ocrResult.fieldsDetected !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {confidenceCfg && (
                      <span className={`font-['DM_Sans'] text-xs font-medium px-2 py-0.5 ${confidenceCfg.color}`}>
                        {confidenceCfg.icon} {confidenceCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="font-['DM_Sans'] text-xs text-indigo-600 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    Los campos marcados en violeta fueron completados automáticamente. Verifica y corrige si es necesario.
                  </p>
                  {ocrResult.warnings.length > 0 && (
                    <div className="space-y-1">
                      {ocrResult.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-1.5 font-['DM_Sans'] text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5">
                          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agente Post-OCR: validaciones de BD */}
                <OcrEnrichmentAlerts enrichment={ocrEnrichment} />
              </div>
            )}
          </div>

          {/* ── SECCIÓN 2: Información del gasto ── */}
          <div className="bg-white border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 text-xs font-bold flex items-center justify-center"
                style={{ background: '#F5C218', color: '#1C1C1C' }}
              >
                2
              </span>
              <h2 className="font-['Barlow_Condensed'] uppercase tracking-wide text-[#1C1C1C] text-lg">
                Información del gasto
              </h2>
            </div>

            {/* Proyecto */}
            <div>
              <label className="font-['DM_Sans'] text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                Proyecto *
              </label>
              <select
                className={inputCls(!!errors.projectId)}
                {...register('projectId', { required: 'Selecciona un proyecto' })}
              >
                <option value="">— Selecciona un proyecto —</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
              {errors.projectId && (
                <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.projectId.message}</p>
              )}
            </div>

            <BatchItemSelect
              projectId={selectedProjectBatchesEnabled ? watchedProjectId : undefined}
              value={watch('batchItemId') ?? ''}
              onChange={(v) => setValue('batchItemId', v)}
              className="mb-4"
            />

            {/* Fecha + Monto */}
            <div className="grid grid-cols-2 gap-4">
              <AiField label="Fecha *" aiActive={aiFields.has('expenseDate')} onClear={() => clearAiField('expenseDate')}>
                <input
                  type="date"
                  className={inputCls(!!errors.expenseDate, aiFields.has('expenseDate'))}
                  {...register('expenseDate', { required: 'La fecha es requerida' })}
                />
                {(() => {
                  const val = watch('expenseDate');
                  if (!val) return null;
                  const days = Math.floor((Date.now() - new Date(val + 'T12:00:00').getTime()) / 86400000);
                  if (days < 7) return null;
                  const isOld = days >= 30;
                  return (
                    <div className={`mt-1 px-2 py-1.5 border-l-2 ${isOld ? 'border-red-500 bg-red-50' : 'border-[#F5C218] bg-[#F5C218]/10'}`}>
                      <p className={`font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wide ${isOld ? 'text-red-700' : 'text-[#1C1C1C]'}`}>
                        {isOld ? '⚠ Fecha muy antigua' : '⚠ Fecha inusual'}
                      </p>
                      <p className="font-['DM_Sans'] text-xs text-gray-600 mt-0.5">
                        Esta fecha es de hace <span className="font-semibold">{days} días</span>. ¿Es correcta?
                      </p>
                    </div>
                  );
                })()}
              </AiField>
              <AiField label="Monto (RD$) *" aiActive={aiFields.has('amount')} onClear={() => clearAiField('amount')}>
                <input
                  type="number" step="0.01" min="0.01" placeholder="0.00"
                  className={inputCls(!!errors.amount, aiFields.has('amount'))}
                  {...register('amount', {
                    required: !foreignCurrency.enabled ? 'El monto es requerido' : false,
                    min: { value: 0.01, message: 'Debe ser mayor a 0' },
                  })}
                />
                {errors.amount && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.amount.message}</p>
                )}
                {isAdmin && projectBudget && (() => {
                  const enteredAmt = parseFloat(String(watch('amount'))) || 0;
                  const remaining  = projectBudget.summary.budgetRemaining;
                  const afterThis  = remaining - enteredAmt;
                  const totalBudget = projectBudget.project.totalBudget;
                  if (totalBudget <= 0) return null;
                  const overBudget = afterThis < 0;
                  return (
                    <div className={`mt-1 px-2 py-1.5 border-l-2 ${overBudget ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-['DM_Sans'] text-xs text-gray-500">Disponible en proyecto</span>
                        <span className={`font-['Space_Mono'] text-xs font-bold ${overBudget ? 'text-red-600' : 'text-gray-700'}`}>
                          RD$ {remaining.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {enteredAmt > 0 && (
                        <div className="flex justify-between items-center mt-0.5">
                          <span className="font-['DM_Sans'] text-xs text-gray-500">Después de este gasto</span>
                          <span className={`font-['Space_Mono'] text-xs font-bold ${overBudget ? 'text-red-600' : 'text-green-700'}`}>
                            {overBudget ? '−' : ''}RD$ {Math.abs(afterThis).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            {overBudget && <span className="font-['DM_Sans'] font-normal ml-1">(sobregiro)</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </AiField>
            </div>

            {/* Moneda extranjera */}
            <div className="border border-dashed border-blue-300 bg-blue-50 p-4">
              <ForeignCurrencyInput
                value={foreignCurrency}
                onChange={(next) => {
                  setForeignCurrency(next);
                  const fa = parseFloat(next.foreignAmount);
                  const er = parseFloat(next.exchangeRate);
                  if (next.enabled && fa > 0 && er > 0) {
                    setValue('amount', parseFloat((fa * er).toFixed(2)));
                  }
                }}
                rdAmount={
                  foreignCurrency.enabled && foreignCurrency.foreignAmount && foreignCurrency.exchangeRate
                    ? Number(foreignCurrency.foreignAmount) * Number(foreignCurrency.exchangeRate)
                    : null
                }
              />
            </div>

            {/* Descripción */}
            <AiField label="Descripción *" aiActive={aiFields.has('description')} onClear={() => clearAiField('description')}>
              <input
                type="text" placeholder="¿En qué se gastó?"
                className={inputCls(!!errors.description, aiFields.has('description'))}
                {...register('description', {
                  required: 'La descripción es requerida',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                  onChange: (e) => handleDescriptionChange(e.target.value),
                })}
              />
              {errors.description && (
                <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.description.message}</p>
              )}
              {catSuggestLoading && !aiFields.has('categoryId') && (
                <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analizando categoría...
                </p>
              )}
              {/* AI category suggestion chip — keep violet (AI) */}
              {catSuggestion && !aiFields.has('categoryId') && (
                <button
                  type="button"
                  onClick={acceptCatSuggestion}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors font-medium font-['DM_Sans']"
                >
                  <Sparkles className="w-3 h-3" />
                  Categoría sugerida: <strong>{catSuggestion.categoryName}</strong>
                  {catSuggestion.confidence === 'high' && <span className="text-green-600">✓</span>}
                  — Clic para aceptar
                </button>
              )}
            </AiField>

            {/* Categoría + Método de pago */}
            <div className="grid grid-cols-2 gap-4">
              <AiField label="Categoría *" aiActive={aiFields.has('categoryId')} onClear={() => clearAiField('categoryId')}>
                <select
                  className={inputCls(!!errors.categoryId, aiFields.has('categoryId'))}
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
                  className={inputCls(!!errors.paymentMethod, aiFields.has('paymentMethod'))}
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

            {/* Crédito de proveedor */}
            <div className="border border-gray-100 p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useCreditLine} onChange={(e) => {
                  setUseCreditLine(e.target.checked);
                  if (!e.target.checked) { setCreditLineId(''); setCreditSupplierId(''); }
                }} className="accent-[#F5C218]" />
                <span className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700">
                  Recibido a crédito de proveedor
                </span>
              </label>
              {useCreditLine && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Proveedor</label>
                    <select
                      className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
                      value={creditSupplierId}
                      onChange={(e) => { setCreditSupplierId(e.target.value); setCreditLineId(''); }}>
                      <option value="">— Selecciona proveedor —</option>
                      {(suppliers as any[])?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Línea de crédito</label>
                    <select
                      className="w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218]"
                      value={creditLineId}
                      onChange={(e) => setCreditLineId(e.target.value)}
                      disabled={!creditSupplierId}>
                      <option value="">— Selecciona línea —</option>
                      {(creditLinesForExpense as any[])?.map((l: any) => (
                        <option
                          key={l.id}
                          value={l.id}
                          disabled={l.balance?.available !== undefined && l.balance.available <= 0}
                        >
                          Límite RD${Number(l.creditLimit).toLocaleString('es-DO')} · {
                            l.balance?.available !== undefined && l.balance.available <= 0
                              ? '(Sin disponible)'
                              : `Disp. RD${Number(l.balance?.available ?? l.creditLimit).toLocaleString('es-DO')}`
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Card selector — only when paymentMethod = CARD */}
            {watch('paymentMethod') === 'CARD' && (
              <div>
                <label className="font-['DM_Sans'] text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  Tarjeta utilizada *
                </label>
                <select
                  className={inputCls(!!errors.companyCardId)}
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
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.companyCardId.message}</p>
                )}
                {(cards ?? []).length === 0 && (
                  <p className="font-['DM_Sans'] text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No hay tarjetas registradas. Contacta al administrador.
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="font-['DM_Sans'] text-xs font-semibold uppercase tracking-wide text-gray-600 block mb-1">
                Notas (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Información adicional..."
                className={inputCls() + ' resize-none'}
                {...register('notes')}
              />
            </div>
          </div>

          {/* ── SECCIÓN 3: Comprobante fiscal ── */}
          <div className="bg-white border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 text-xs font-bold flex items-center justify-center"
                style={{ background: '#F5C218', color: '#1C1C1C' }}
              >
                3
              </span>
              <h2 className="font-['Barlow_Condensed'] uppercase tracking-wide text-[#1C1C1C] text-lg">
                Comprobante fiscal
              </h2>
              {(aiFields.has('ncf') || aiFields.has('supplierName') || aiFields.has('supplierRnc')) && (
                <span className="font-['DM_Sans'] text-xs text-violet-600 flex items-center gap-1 ml-1">
                  <Sparkles className="w-3 h-3" /> datos detectados por IA
                </span>
              )}
            </div>

            <FiscalVoucherForm
              value={fiscalValues}
              onChange={(next) => {
                setFiscalValues(next);
                setHasFiscal(next.hasFiscal);
                if (next.ncf)          setValue('fiscalVoucher.ncf',          next.ncf);
                if (next.supplierRnc)  setValue('fiscalVoucher.supplierRnc',  next.supplierRnc);
                if (next.supplierName) setValue('fiscalVoucher.supplierName', next.supplierName);
                if (next.itbisAmount)  setValue('fiscalVoucher.itbisAmount',  Number(next.itbisAmount));
              }}
              aiFields={aiFields}
            />
          </div>

          {/* OCR validation checkbox — shown at bottom so user confirms after reviewing all fields */}
          {ocrResult && (
            <div className={`border-l-4 p-4 ${ocrValidated ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ocrValidated}
                  onChange={(e) => setOcrValidated(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <div className="flex-1">
                  <p className={`font-['DM_Sans'] text-sm font-semibold ${ocrValidated ? 'text-green-800' : 'text-amber-900'}`}>
                    {ocrValidated ? '✓ Datos del OCR validados' : 'Confirmar datos extraídos por IA'}
                  </p>
                  <p className={`font-['DM_Sans'] text-xs mt-1 ${ocrValidated ? 'text-green-700' : 'text-amber-700'}`}>
                    {ocrValidated
                      ? 'Has confirmado que los datos (montos, NCF, fechas) coinciden con la factura original.'
                      : 'Compara los campos completados automáticamente con la factura original antes de guardar.'}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* ── Footer buttons ── */}
          <div className="flex gap-3 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="border border-gray-300 text-gray-600 font-['DM_Sans'] text-sm px-4 py-2 flex-1 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || (ocrResult !== null && !ocrValidated)}
              title={ocrResult && !ocrValidated ? 'Marca el checkbox de validación para confirmar los datos del OCR' : ''}
              style={{ background: '#F5C218', color: '#1C1C1C' }}
              className={[
                'font-[\'Barlow_Condensed\'] uppercase tracking-widest font-bold flex-1 py-3',
                'flex items-center justify-center gap-2 transition-opacity',
                mutation.isPending || (ocrResult !== null && !ocrValidated) ? 'opacity-50' : '',
              ].join(' ')}
            >
              {mutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Guardar gasto
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
    </>
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
        <label className="font-['DM_Sans'] text-xs font-semibold uppercase tracking-wide text-gray-600">
          {label}
        </label>
        {aiActive && (
          <span className="font-['DM_Sans'] flex items-center gap-1 text-xs text-violet-600">
            <Sparkles className="w-3 h-3" />
            IA
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
