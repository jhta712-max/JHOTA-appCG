import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Sparkles, X,
} from 'lucide-react';
import { quotationsApi, projectsApi, categoriesApi } from '../../api';
import { useOcrPolling } from '../../hooks/useOcrPolling';
import { OcrEnrichmentAlerts } from '../../components/OcrEnrichmentAlerts';

interface FormData {
  projectId:       string;
  categoryId:      string;
  supplierName:    string;
  supplierRnc:     string;
  quotationNumber: string;
  quotationDate:   string;
  validUntil:      string;
  currency:        string;
  subtotal:        string;
  itbisAmount:     string;
  total:           string;
  description:     string;
  paymentTerms:    string;
  advancePct:      string;
  deliveryDays:    string;
  observations:    string;
  notes:           string;
}

const EMPTY: FormData = {
  projectId: '', categoryId: '', supplierName: '', supplierRnc: '',
  quotationNumber: '', quotationDate: '', validUntil: '',
  currency: 'DOP', subtotal: '', itbisAmount: '0', total: '',
  description: '', paymentTerms: '', advancePct: '', deliveryDays: '',
  observations: '', notes: '',
};

const inputCls = "w-full border border-gray-300 rounded-none px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 font-['Barlow_Condensed'] mb-1";

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3" style={{ background: '#1C1C1C' }}>
      <span
        className="w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Space Mono, monospace' }}
      >
        {num}
      </span>
      <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-white text-sm">
        {title}
      </span>
    </div>
  );
}

export default function QuotationFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit   = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const qc       = useQueryClient();

  const [form,    setForm]    = useState<FormData>(() => {
    const queryProjectId = new URLSearchParams(location.search).get('projectId');
    return { ...EMPTY, projectId: queryProjectId ?? '' };
  });
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [apiErr,  setApiErr]  = useState('');

  const [ocrFile,     setOcrFile]     = useState<File | null>(null);
  const { loading: ocrLoading, enrichment: ocrEnrichment, analyze: runOcr } = useOcrPolling();
  const [ocrMsg,         setOcrMsg]         = useState('');
  const [ocrValidated,   setOcrValidated]   = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list(),
    select:   (r) => r.data.data,
  });

  const { data: existing } = useQuery({
    queryKey: ['quotation', id],
    queryFn:  () => quotationsApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        projectId:       existing.projectId,
        categoryId:      existing.categoryId?.toString() ?? '',
        supplierName:    existing.supplierName,
        supplierRnc:     existing.supplierRnc ?? '',
        quotationNumber: existing.quotationNumber ?? '',
        quotationDate:   existing.quotationDate.slice(0, 10),
        validUntil:      existing.validUntil?.slice(0, 10) ?? '',
        currency:        existing.currency,
        subtotal:        existing.subtotal.toString(),
        itbisAmount:     existing.itbisAmount.toString(),
        total:           existing.total.toString(),
        description:     existing.description,
        paymentTerms:    existing.paymentTerms ?? '',
        advancePct:      existing.advancePct?.toString() ?? '',
        deliveryDays:    existing.deliveryDays?.toString() ?? '',
        observations:    existing.observations ?? '',
        notes:           existing.notes ?? '',
      });
    }
  }, [existing]);

  useEffect(() => {
    const sub  = parseFloat(form.subtotal)  || 0;
    const itb  = parseFloat(form.itbisAmount) || 0;
    if (sub > 0) {
      setForm(f => ({ ...f, total: (sub + itb).toFixed(2) }));
    }
  }, [form.subtotal, form.itbisAmount]);

  const set = (k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
    setApiErr('');
  };

  const handleOcr = async () => {
    if (!ocrFile) return;
    setOcrMsg('');
    setOcrValidated(false);
    const d = await runOcr(ocrFile) as any;
    if (!d) return;
    setOcrMsg(`Documento detectado: ${d.documentTypeLabel ?? d.documentType ?? 'desconocido'}`);
    setForm(f => ({
      ...f,
      supplierName:    d.supplierName    ?? f.supplierName,
      supplierRnc:     d.supplierRnc     ?? f.supplierRnc,
      quotationNumber: d.quotationNumber ?? f.quotationNumber,
      quotationDate:   d.date            ? d.date.slice(0, 10) : f.quotationDate,
      validUntil:      d.validUntil      ? d.validUntil.slice(0, 10) : f.validUntil,
      currency:        d.currency        ?? f.currency,
      subtotal:        d.subtotal        ? d.subtotal.toString() : f.subtotal,
      itbisAmount:     d.itbisAmount     != null ? d.itbisAmount.toString() : f.itbisAmount,
      total:           d.amount          ? d.amount.toString() : f.total,
      description:     d.description     ?? f.description,
      paymentTerms:    d.paymentTerms    ?? f.paymentTerms,
      advancePct:      d.advancePct      != null ? d.advancePct.toString() : f.advancePct,
      deliveryDays:    d.deliveryDays    != null ? d.deliveryDays.toString() : f.deliveryDays,
      observations:    d.observations    ?? f.observations,
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.projectId)    e.projectId    = 'El proyecto es requerido';
    if (!form.supplierName) e.supplierName = 'El nombre del suplidor es requerido';
    if (!form.quotationDate)e.quotationDate= 'La fecha es requerida';
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) e.subtotal = 'El subtotal debe ser mayor a 0';
    if (!form.total    || parseFloat(form.total)    <= 0) e.total    = 'El total debe ser mayor a 0';
    if (!form.description) e.description = 'La descripción es requerida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        projectId:       form.projectId,
        categoryId:      form.categoryId ? parseInt(form.categoryId) : undefined,
        supplierName:    form.supplierName,
        supplierRnc:     form.supplierRnc  || undefined,
        quotationNumber: form.quotationNumber || undefined,
        quotationDate:   form.quotationDate,
        validUntil:      form.validUntil   || undefined,
        currency:        form.currency,
        subtotal:        parseFloat(form.subtotal),
        itbisAmount:     parseFloat(form.itbisAmount) || 0,
        total:           parseFloat(form.total),
        description:     form.description,
        paymentTerms:    form.paymentTerms   || undefined,
        advancePct:      form.advancePct     ? parseFloat(form.advancePct)     : undefined,
        deliveryDays:    form.deliveryDays   ? parseInt(form.deliveryDays)     : undefined,
        observations:    form.observations   || undefined,
        notes:           form.notes          || undefined,
      };
      return isEdit
        ? quotationsApi.update(id!, payload)
        : quotationsApi.create(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['quotation', id] });
      navigate(`/quotations/${res.data.data.id}`);
    },
    onError: (err: any) => {
      setApiErr(err.response?.data?.error ?? 'Error al guardar la cotización');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto">

      {/* Hero header */}
      <div className="px-5 py-6 mb-6" style={{ background: '#1C1C1C' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-['DM_Sans'] text-sm">Volver</span>
        </button>
        <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-1">
          MÓDULO / COTIZACIONES
        </p>
        <h1 className="font-['Barlow_Condensed'] uppercase tracking-wide text-3xl text-white">
          {isEdit ? 'Editar Cotización' : 'Nueva Cotización'}
        </h1>
        <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
          {isEdit ? 'Actualiza los datos de la cotización' : 'Registra una cotización o propuesta comercial'}
        </p>
      </div>

      {/* OCR section */}
      <div className="mb-5 border border-gray-200">
        <div className="flex items-center gap-2 px-5 py-3" style={{ background: '#1C1C1C' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#F5C218' }} />
          <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm text-white">
            Extraer con IA
          </span>
        </div>
        <div className="p-5 space-y-3 bg-white">
          <p className="font-['DM_Sans'] text-xs text-gray-500">
            Sube una foto o PDF de la cotización y Claude extraerá los datos automáticamente.
          </p>
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="flex-1 text-sm font-['DM_Sans'] bg-gray-100 px-3 py-2 text-gray-600 file:mr-3 file:py-1 file:px-2 file:border-0 file:text-xs file:font-semibold file:bg-gray-200 file:text-gray-700 focus:outline-none"
              onChange={(e) => setOcrFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={handleOcr}
              disabled={!ocrFile || ocrLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-['Barlow_Condensed'] uppercase tracking-wide font-bold disabled:opacity-50 shrink-0 transition-opacity"
              style={{ background: '#1C1C1C', color: '#F5C218' }}
            >
              {ocrLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                : <><Sparkles className="w-4 h-4" /> Analizar</>
              }
            </button>
          </div>
          {ocrMsg && (
            <div className="border-l-4 border-[#F5C218] bg-amber-50 px-4 py-2 text-xs font-['DM_Sans'] text-amber-800">
              ✓ {ocrMsg} — Revisa y ajusta los campos antes de guardar.
            </div>
          )}
          <OcrEnrichmentAlerts enrichment={ocrEnrichment} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 01 Proyecto */}
        <div className="border border-gray-200">
          <SectionHeader num="01" title="Proyecto" />
          <div className="p-5 space-y-4 bg-white">
            <div>
              <label className={labelCls}>Proyecto *</label>
              <select
                className={`${inputCls} ${errors.projectId ? 'border-red-400' : ''}`}
                value={form.projectId} onChange={(e) => set('projectId', e.target.value)}
                disabled={isEdit}
              >
                <option value="">Seleccionar proyecto...</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
              {errors.projectId && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.projectId}</p>}
            </div>
            <div>
              <label className={labelCls}>Categoría (opcional)</label>
              <select className={inputCls} value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Sin categoría</option>
                {(categories ?? []).filter(c => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 02 Suplidor */}
        <div className="border border-gray-200">
          <SectionHeader num="02" title="Suplidor" />
          <div className="p-5 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombre del suplidor *</label>
                <input
                  className={`${inputCls} ${errors.supplierName ? 'border-red-400' : ''}`}
                  placeholder="Nombre de la empresa o persona"
                  value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)}
                />
                {errors.supplierName && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.supplierName}</p>}
              </div>
              <div>
                <label className={labelCls}>RNC (opcional)</label>
                <input className={inputCls} placeholder="000-00000-0"
                  value={form.supplierRnc} onChange={(e) => set('supplierRnc', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* 03 Documento */}
        <div className="border border-gray-200">
          <SectionHeader num="03" title="Documento" />
          <div className="p-5 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Número de cotización</label>
                <input className={inputCls} placeholder="COT-2024-001"
                  value={form.quotationNumber} onChange={(e) => set('quotationNumber', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Moneda</label>
                <select className={inputCls} value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}>
                  <option value="DOP">DOP — Peso Dominicano</option>
                  <option value="USD">USD — Dólar Americano</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha de cotización *</label>
                <input
                  type="date"
                  className={`${inputCls} ${errors.quotationDate ? 'border-red-400' : ''}`}
                  value={form.quotationDate} onChange={(e) => set('quotationDate', e.target.value)}
                />
                {errors.quotationDate && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.quotationDate}</p>}
              </div>
              <div>
                <label className={labelCls}>Válida hasta</label>
                <input type="date" className={inputCls}
                  value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* 04 Montos */}
        <div className="border border-gray-200">
          <SectionHeader num="04" title="Montos" />
          <div className="p-5 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Subtotal *</label>
                <input
                  type="number" step="0.01" min="0"
                  className={`${inputCls} font-['Space_Mono'] ${errors.subtotal ? 'border-red-400' : ''}`}
                  placeholder="0.00"
                  value={form.subtotal} onChange={(e) => set('subtotal', e.target.value)}
                />
                {errors.subtotal && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.subtotal}</p>}
              </div>
              <div>
                <label className={labelCls}>ITBIS (18%)</label>
                <input
                  type="number" step="0.01" min="0"
                  className={`${inputCls} font-['Space_Mono']`}
                  placeholder="0.00"
                  value={form.itbisAmount} onChange={(e) => set('itbisAmount', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Total *</label>
                <input
                  type="number" step="0.01" min="0"
                  className={`w-full border rounded-none px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#F5C218] ${errors.total ? 'border-red-400 bg-white text-gray-900' : 'border-[#F5C218]'}`}
                  style={errors.total ? {} : { background: '#F5C218', color: '#1C1C1C', fontFamily: 'Space Mono, monospace' }}
                  placeholder="0.00"
                  value={form.total} onChange={(e) => set('total', e.target.value)}
                />
                {errors.total && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.total}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 05 Condiciones */}
        <div className="border border-gray-200">
          <SectionHeader num="05" title="Condiciones" />
          <div className="p-5 space-y-4 bg-white">
            <div>
              <label className={labelCls}>Descripción del trabajo / servicio *</label>
              <textarea
                rows={3}
                className={`${inputCls} resize-none ${errors.description ? 'border-red-400' : ''}`}
                placeholder="Describe el trabajo, materiales o servicio cotizado..."
                value={form.description} onChange={(e) => set('description', e.target.value)}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Condiciones de pago</label>
                <input className={inputCls} placeholder="50% anticipo, 50% al finalizar"
                  value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>% de anticipo requerido</label>
                <input type="number" min="0" max="100" step="1"
                  className={`${inputCls} font-['Space_Mono']`} placeholder="50"
                  value={form.advancePct} onChange={(e) => set('advancePct', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Días de entrega</label>
                <input type="number" min="1" step="1"
                  className={`${inputCls} font-['Space_Mono']`} placeholder="15"
                  value={form.deliveryDays} onChange={(e) => set('deliveryDays', e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Observaciones</label>
              <textarea rows={2} className={`${inputCls} resize-none`}
                placeholder="Observaciones adicionales..."
                value={form.observations} onChange={(e) => set('observations', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Notas internas</label>
              <textarea rows={2} className={`${inputCls} resize-none`}
                placeholder="Notas visibles solo para el equipo..."
                value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* API Error */}
        {apiErr && (
          <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-['DM_Sans'] text-sm text-red-700">{apiErr}</span>
          </div>
        )}

        {/* OCR validation checkbox */}
        {ocrMsg && (
          <div className={`border-l-4 p-4 ${ocrValidated ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={ocrValidated} onChange={(e) => setOcrValidated(e.target.checked)} className="mt-1" />
              <div className="flex-1">
                <p className={`font-['DM_Sans'] text-sm font-semibold ${ocrValidated ? 'text-green-800' : 'text-amber-900'}`}>
                  {ocrValidated ? '✓ Datos del OCR validados' : 'Confirmar datos extraídos por IA'}
                </p>
                <p className={`font-['DM_Sans'] text-xs mt-1 ${ocrValidated ? 'text-green-700' : 'text-amber-700'}`}>
                  {ocrValidated
                    ? 'Has confirmado que los datos coinciden con el documento original.'
                    : 'Compara los campos completados automáticamente con la cotización original antes de guardar.'}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-300 font-['Barlow_Condensed'] uppercase tracking-wide text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || (!!ocrMsg && !ocrValidated)}
            className="flex-1 flex items-center justify-center gap-2 py-3 font-['Barlow_Condensed'] uppercase tracking-wide text-sm font-bold disabled:opacity-50 transition-opacity"
            style={{ background: '#F5C218', color: '#1C1C1C' }}
          >
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              : <><Save className="w-4 h-4" /> {isEdit ? 'Actualizar' : 'Crear cotización'}</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}
