import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Plus, X, Save, Trash2, ChevronDown, ChevronUp,
  Sparkles, AlertCircle, CreditCard, Camera, Loader2, Building2,
} from 'lucide-react';
import {
  officeExpensesApi, cardsApi, ocrApi, suppliersApi,
  OFFICE_EXPENSE_CATEGORY_LABELS,
  type OfficeExpense, type OfficeExpenseCategory,
} from '../../api';
import { fmtDate } from '../../utils/date';
import { useRole } from '../../hooks/useRole';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: string | number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 0,
  }).format(Number(amount));
}

const CATEGORIES = Object.entries(OFFICE_EXPENSE_CATEGORY_LABELS) as [OfficeExpenseCategory, string][];

const PAYMENT_METHODS: Record<string, string> = {
  CASH:     'Efectivo',
  TRANSFER: 'Transferencia',
  CARD:     'Tarjeta',
  CHECK:    'Cheque',
  OTHER:    'Otro',
};

const CATEGORY_COLORS: Record<OfficeExpenseCategory, string> = {
  CLEANING_SUPPLIES: 'bg-blue-100 text-blue-700',
  CONSUMABLES:       'bg-amber-100 text-amber-700',
  OFFICE_SERVICES:   'bg-purple-100 text-purple-700',
  BIDDING:           'bg-orange-100 text-orange-700',
  OTHER:             'bg-gray-100 text-gray-700',
};

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  category:      'CONSUMABLES' as OfficeExpenseCategory,
  description:   '',
  amount:        '',
  expenseDate:   new Date().toISOString().slice(0, 10),
  paymentMethod: 'CASH',
  companyCardId: '',
  supplierId:    '',
  hasFiscalDoc:  false,
  fiscalDocNum:  '',
  notes:         '',
});

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function OfficeExpensesPage() {
  const qc = useQueryClient();
  const { isSupervisor } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm,    setShowForm]    = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [viewingExp,  setViewingExp]  = useState<OfficeExpense | null>(null);
  const [form,        setForm]        = useState(emptyForm());
  const [flash,       setFlash]       = useState('');
  const [catFilter,   setCatFilter]   = useState('');
  const [expandStats, setExpandStats] = useState(true);
  const [ocrLoading,  setOcrLoading]  = useState(false);
  const [ocrError,    setOcrError]    = useState('');
  const [actionError, setActionError] = useState('');

  // queries
  const { data: listData, isLoading } = useQuery({
    queryKey: ['office-expenses', catFilter],
    queryFn:  () => officeExpensesApi.list({ category: catFilter || undefined, limit: 50 }),
    select:   (r) => r.data,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['office-expenses-summary'],
    queryFn:  () => officeExpensesApi.summary(),
    select:   (r) => r.data.data,
  });

  const { data: cardsData } = useQuery({
    queryKey: ['cards-active'],
    queryFn:  () => cardsApi.list(),
    select:   (r) => r.data.data?.filter((c: any) => c.isActive) ?? [],
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn:  () => suppliersApi.list({ onlyActive: true }),
    select:   (r) => r.data.data ?? [],
    enabled:  showForm,
  });

  const expenses  = listData?.data ?? [];
  const suppliers = suppliersData ?? [];

  // mutations
  function invalidate() {
    qc.invalidateQueries({ queryKey: ['office-expenses'] });
    qc.invalidateQueries({ queryKey: ['office-expenses-summary'] });
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  }

  const createMut = useMutation({
    mutationFn: () => officeExpensesApi.create({
      ...form,
      amount:        Number(form.amount),
      companyCardId: form.companyCardId || null,
      supplierId:    form.supplierId    || null,
      fiscalDocNum:  form.fiscalDocNum  || null,
      notes:         form.notes         || null,
    }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm(emptyForm());
      showFlash('✅ Gasto de oficina registrado');
    },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al guardar'),
  });

  const updateMut = useMutation({
    mutationFn: () => officeExpensesApi.update(editingId!, {
      ...form,
      amount:        Number(form.amount),
      companyCardId: form.companyCardId || null,
      supplierId:    form.supplierId    || null,
      fiscalDocNum:  form.fiscalDocNum  || null,
      notes:         form.notes         || null,
    }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditingId(null);
      setViewingExp(null);
      setForm(emptyForm());
      showFlash('✅ Gasto actualizado');
    },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al guardar'),
  });

  const voidMut = useMutation({
    mutationFn: (id: string) => officeExpensesApi.void(id),
    onSuccess: () => {
      invalidate();
      setViewingExp(null);
      showFlash('🗑 Gasto eliminado');
    },
  });

  // handlers
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setActionError('');
    setOcrError('');
    setShowForm(true);
  }

  function openEdit(exp: OfficeExpense) {
    setEditingId(exp.id);
    setForm({
      category:      exp.category,
      description:   exp.description,
      amount:        String(exp.amount),
      expenseDate:   exp.expenseDate.slice(0, 10),
      paymentMethod: exp.paymentMethod,
      companyCardId: exp.companyCardId ?? '',
      supplierId:    exp.supplierId    ?? '',
      hasFiscalDoc:  exp.hasFiscalDoc,
      fiscalDocNum:  exp.fiscalDocNum ?? '',
      notes:         exp.notes ?? '',
    });
    setActionError('');
    setOcrError('');
    setShowForm(true);
    setViewingExp(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActionError('');
    if (editingId) updateMut.mutate();
    else           createMut.mutate();
  }

  async function handleOcrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrError('');
    try {
      const res  = await ocrApi.analyze(file);
      const data = res.data.data;
      setForm((f) => ({
        ...f,
        ...(data.amount      && { amount:      String(data.amount) }),
        ...(data.date        && { expenseDate:  data.date }),
        ...(data.description && { description:  data.description }),
        ...(data.ncf         && { hasFiscalDoc: true, fiscalDocNum: data.ncf }),
        ...((!data.ncf && (data.supplierRnc || data.supplierName)) && { hasFiscalDoc: true }),
      }));
      if (data.supplierName && suppliers.length > 0) {
        const match = suppliers.find((s: any) =>
          s.name.toLowerCase().includes(data.supplierName!.toLowerCase()) ||
          data.supplierName!.toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) setForm((f) => ({ ...f, supplierId: match.id }));
      }
    } catch {
      setOcrError('No se pudo analizar la imagen. Intenta con una foto más clara.');
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Flash */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-green-200 text-green-700 px-4 py-2 rounded-xl shadow-lg text-sm font-medium">
          {flash}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">MÓDULO / GASTOS DE OFICINA</p>
          <h1 className="page-title">Gastos de Oficina</h1>
          <p className="text-sm text-gray-500">
            Insumos de limpieza, material gastable y servicios generales de oficina
          </p>
        </div>
        {isSupervisor && (
          <button onClick={openCreate} className="smi-btn">
            <Plus className="w-4 h-4" /> Nuevo Gasto
          </button>
        )}
      </div>

      {/* Stats */}
      {summaryData && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setExpandStats((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-700">Resumen</span>
            {expandStats ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandStats && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-gray-100 pt-4">
              <div className="bg-purple-50 rounded-xl p-3">
                <p className="text-xs text-purple-600 font-medium">Este mes</p>
                <p className="text-lg font-bold text-purple-900">{fmt(summaryData.currentMonth.total)}</p>
                <p className="text-xs text-purple-500">{summaryData.currentMonth.count} registros</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 font-medium">Total histórico</p>
                <p className="text-lg font-bold text-gray-900">{fmt(summaryData.allTime.total)}</p>
                <p className="text-xs text-gray-500">{summaryData.allTime.count} registros</p>
              </div>
              {summaryData.byCategory.slice(0, 2).map((cat) => (
                <div key={cat.category} className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium truncate">
                    {OFFICE_EXPENSE_CATEGORY_LABELS[cat.category as OfficeExpenseCategory]}
                  </p>
                  <p className="text-lg font-bold text-blue-900">{fmt(cat.total)}</p>
                  <p className="text-xs text-blue-500">{cat.count} registros</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtro categoría */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCatFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            catFilter === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
          }`}
        >
          Todas
        </button>
        {CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCatFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              catFilter === key ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay gastos de oficina registrados</p>
          {isSupervisor && (
            <button onClick={openCreate} className="btn-primary mt-4 inline-flex">
              Registrar primer gasto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <button
              key={exp.id}
              onClick={() => setViewingExp(exp)}
              className="card w-full p-4 flex items-center gap-4 hover:border-purple-200 hover:shadow-md transition-all text-left group"
            >
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors truncate">
                    {exp.description}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[exp.category]}`}>
                    {OFFICE_EXPENSE_CATEGORY_LABELS[exp.category]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {fmtDate(exp.expenseDate)} · {PAYMENT_METHODS[exp.paymentMethod] ?? exp.paymentMethod}
                  {exp.hasFiscalDoc && <span className="ml-2 text-xs text-green-600">· Factura</span>}
                  {exp.supplier && (
                    <span className="ml-2 text-xs text-blue-600 flex-inline items-center gap-1">
                      · <Building2 className="w-3 h-3 inline" /> {exp.supplier.name}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900">{fmt(exp.amount)}</p>
                <p className="text-xs text-gray-400">{exp.createdBy?.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                {editingId ? 'Editar gasto de oficina' : 'Nuevo gasto de oficina'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* OCR button */}
              {!editingId && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleOcrFile}
                  />
                  <button
                    type="button"
                    disabled={ocrLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors text-sm font-medium"
                  >
                    {ocrLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando recibo...</>
                      : <><Camera className="w-4 h-4" /> Escanear recibo con IA</>
                    }
                  </button>
                  {ocrError && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {ocrError}
                    </p>
                  )}
                </div>
              )}

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as OfficeExpenseCategory }))}
                  required
                >
                  {CATEGORIES.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input
                  className="input-field"
                  placeholder="Ej: Compra de papel carta, detergente industrial..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  minLength={3}
                />
              </div>

              {/* Monto y fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto (DOP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-field"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Suplidor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> Suplidor (opcional)
                </label>
                <select
                  className="input-field"
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">Sin suplidor</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.rnc ? ` — RNC ${s.rnc}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago *</label>
                <select
                  className="input-field"
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value, companyCardId: '' }))}
                  required
                >
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Tarjeta (solo si pago con tarjeta) */}
              {form.paymentMethod === 'CARD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" /> Tarjeta corporativa *
                  </label>
                  <select
                    className="input-field"
                    value={form.companyCardId}
                    onChange={(e) => setForm((f) => ({ ...f, companyCardId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar tarjeta...</option>
                    {(cardsData ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.holderName} — ···{c.lastFour} ({c.bank})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Documento fiscal */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasFiscalDoc"
                  checked={form.hasFiscalDoc}
                  onChange={(e) => setForm((f) => ({ ...f, hasFiscalDoc: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="hasFiscalDoc" className="text-sm text-gray-700">Tiene documento fiscal (factura / NCF)</label>
              </div>
              {form.hasFiscalDoc && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de comprobante</label>
                  <input
                    className="input-field"
                    placeholder="Ej: B0100000001"
                    value={form.fiscalDocNum}
                    onChange={(e) => setForm((f) => ({ ...f, fiscalDocNum: e.target.value }))}
                  />
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Observaciones adicionales..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Error */}
              {actionError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary">
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ───────────────────────────────────────── */}
      {viewingExp && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Detalle del gasto</h2>
              <button onClick={() => setViewingExp(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[viewingExp.category]}`}>
                    {OFFICE_EXPENSE_CATEGORY_LABELS[viewingExp.category]}
                  </span>
                  <p className="font-semibold text-gray-900 mt-2">{viewingExp.description}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(viewingExp.amount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Fecha</p>
                  <p className="font-medium">{fmtDate(viewingExp.expenseDate)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Método de pago</p>
                  <p className="font-medium">{PAYMENT_METHODS[viewingExp.paymentMethod] ?? viewingExp.paymentMethod}</p>
                </div>
                {viewingExp.companyCard && (
                  <div>
                    <p className="text-gray-500">Tarjeta</p>
                    <p className="font-medium">{viewingExp.companyCard.holderName} ···{viewingExp.companyCard.lastFour}</p>
                  </div>
                )}
                {viewingExp.supplier && (
                  <div>
                    <p className="text-gray-500">Suplidor</p>
                    <p className="font-medium flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {viewingExp.supplier.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Registrado por</p>
                  <p className="font-medium">{viewingExp.createdBy?.name}</p>
                </div>
              </div>

              {viewingExp.hasFiscalDoc && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <p className="text-green-700 font-medium">Documento fiscal</p>
                  {viewingExp.fiscalDocNum && <p className="text-green-600">{viewingExp.fiscalDocNum}</p>}
                </div>
              )}

              {viewingExp.notes && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-1">Notas</p>
                  {viewingExp.notes}
                </div>
              )}

              {isSupervisor && <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => openEdit(viewingExp)}
                  className="flex-1 btn-secondary text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) {
                      voidMut.mutate(viewingExp.id);
                    }
                  }}
                  disabled={voidMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {voidMut.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
