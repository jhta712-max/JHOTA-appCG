import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Sparkles, X,
} from 'lucide-react';
import { quotationsApi, projectsApi, categoriesApi, ocrApi } from '../../api';

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

  // OCR
  const [ocrFile,     setOcrFile]     = useState<File | null>(null);
  const [ocrLoading,  setOcrLoading]  = useState(false);
  const [ocrMsg,      setOcrMsg]      = useState('');

  // Datos del formulario
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

  // Cargar datos en modo edición
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

  // Auto-calcular total cuando cambian subtotal e ITBIS
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

  // OCR — analizar imagen de cotización
  const handleOcr = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    setOcrMsg('');
    try {
      const res = await ocrApi.analyze(ocrFile);
      const d   = res.data.data as any;
      setOcrMsg(`Documento detectado: ${d.documentTypeLabel ?? d.documentType ?? 'desconocido'}`);

      // Rellenar campos con los datos extraídos
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
    } catch {
      setOcrMsg('No se pudo analizar el documento. Verifica el archivo.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Validación
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

  // Mutación
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
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="module-label">MÓDULO / COTIZACIONES</p>
          <h1 className="page-title">
            {isEdit ? 'Editar Cotización' : 'Nueva Cotización'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEdit ? 'Actualiza los datos de la cotización' : 'Registra una cotización o propuesta comercial'}
          </p>
        </div>
      </div>

      {/* OCR — escanear documento */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Extraer datos con IA
        </div>
        <p className="text-xs text-gray-400">
          Sube una foto o PDF de la cotización y Claude extraerá los datos automáticamente.
        </p>
        <div className="flex gap-2">
          <input type="file" accept="image/*,application/pdf"
            className="input-field text-sm flex-1"
            onChange={(e) => setOcrFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={handleOcr}
            disabled={!ocrFile || ocrLoading}
            className="btn-secondary text-sm shrink-0 disabled:opacity-50">
            {ocrLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
              : <><Sparkles className="w-4 h-4" /> Analizar</>
            }
          </button>
        </div>
        {ocrMsg && (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg p-2">
            <span>✓</span> {ocrMsg} — Revisa y ajusta los campos antes de guardar.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Proyecto y categoría */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Proyecto</h2>
          <div>
            <label className="label">Proyecto *</label>
            <select className={`input-field ${errors.projectId ? 'border-red-400' : ''}`}
              value={form.projectId} onChange={(e) => set('projectId', e.target.value)}
              disabled={isEdit}>
              <option value="">Seleccionar proyecto...</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId}</p>}
          </div>
          <div>
            <label className="label">Categoría (opcional)</label>
            <select className="input-field" value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Sin categoría</option>
              {(categories ?? []).filter(c => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Suplidor */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Suplidor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre del suplidor *</label>
              <input className={`input-field ${errors.supplierName ? 'border-red-400' : ''}`}
                placeholder="Nombre de la empresa o persona"
                value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} />
              {errors.supplierName && <p className="text-xs text-red-500 mt-1">{errors.supplierName}</p>}
            </div>
            <div>
              <label className="label">RNC (opcional)</label>
              <input className="input-field" placeholder="000-00000-0"
                value={form.supplierRnc} onChange={(e) => set('supplierRnc', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Documento */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Documento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Número de cotización</label>
              <input className="input-field" placeholder="COT-2024-001"
                value={form.quotationNumber} onChange={(e) => set('quotationNumber', e.target.value)} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <select className="input-field" value={form.currency}
                onChange={(e) => set('currency', e.target.value)}>
                <option value="DOP">DOP — Peso Dominicano</option>
                <option value="USD">USD — Dólar Americano</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha de cotización *</label>
              <input type="date" className={`input-field ${errors.quotationDate ? 'border-red-400' : ''}`}
                value={form.quotationDate} onChange={(e) => set('quotationDate', e.target.value)} />
              {errors.quotationDate && <p className="text-xs text-red-500 mt-1">{errors.quotationDate}</p>}
            </div>
            <div>
              <label className="label">Válida hasta</label>
              <input type="date" className="input-field"
                value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Montos */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Montos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Subtotal *</label>
              <input type="number" step="0.01" min="0"
                className={`input-field ${errors.subtotal ? 'border-red-400' : ''}`}
                placeholder="0.00"
                value={form.subtotal} onChange={(e) => set('subtotal', e.target.value)} />
              {errors.subtotal && <p className="text-xs text-red-500 mt-1">{errors.subtotal}</p>}
            </div>
            <div>
              <label className="label">ITBIS (18%)</label>
              <input type="number" step="0.01" min="0"
                className="input-field" placeholder="0.00"
                value={form.itbisAmount} onChange={(e) => set('itbisAmount', e.target.value)} />
            </div>
            <div>
              <label className="label">Total *</label>
              <input type="number" step="0.01" min="0"
                className={`input-field font-semibold ${errors.total ? 'border-red-400' : 'bg-gray-50'}`}
                placeholder="0.00"
                value={form.total} onChange={(e) => set('total', e.target.value)} />
              {errors.total && <p className="text-xs text-red-500 mt-1">{errors.total}</p>}
            </div>
          </div>
        </div>

        {/* Condiciones */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Condiciones</h2>
          <div>
            <label className="label">Descripción del trabajo / servicio *</label>
            <textarea rows={3} className={`input-field resize-none ${errors.description ? 'border-red-400' : ''}`}
              placeholder="Describe el trabajo, materiales o servicio cotizado..."
              value={form.description} onChange={(e) => set('description', e.target.value)} />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Condiciones de pago</label>
              <input className="input-field" placeholder="50% anticipo, 50% al finalizar"
                value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} />
            </div>
            <div>
              <label className="label">% de anticipo requerido</label>
              <input type="number" min="0" max="100" step="1"
                className="input-field" placeholder="50"
                value={form.advancePct} onChange={(e) => set('advancePct', e.target.value)} />
            </div>
            <div>
              <label className="label">Días de entrega</label>
              <input type="number" min="1" step="1"
                className="input-field" placeholder="15"
                value={form.deliveryDays} onChange={(e) => set('deliveryDays', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Observaciones</label>
            <textarea rows={2} className="input-field resize-none"
              placeholder="Observaciones adicionales..."
              value={form.observations} onChange={(e) => set('observations', e.target.value)} />
          </div>

          <div>
            <label className="label">Notas internas</label>
            <textarea rows={2} className="input-field resize-none"
              placeholder="Notas visibles solo para el equipo..."
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        {/* Error API */}
        {apiErr && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {apiErr}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
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
