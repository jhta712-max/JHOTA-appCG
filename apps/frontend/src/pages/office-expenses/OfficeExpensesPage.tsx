import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Plus, X, Save, Trash2, ChevronDown, ChevronUp,
  Sparkles, AlertCircle, CreditCard, Camera, Loader2, Building2,
  ArrowUpDown, Filter,
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

  const [showForm,      setShowForm]      = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [viewingExp,    setViewingExp]    = useState<OfficeExpense | null>(null);
  const [form,          setForm]          = useState(emptyForm());
  const [flash,         setFlash]         = useState('');
  const [catFilter,     setCatFilter]     = useState('');
  const [expandStats,   setExpandStats]   = useState(true);
  const [ocrLoading,    setOcrLoading]    = useState(false);
  const [ocrError,      setOcrError]      = useState('');
  const [ocrValidated,  setOcrValidated]  = useState(false); // Usuario debe validar datos OCR
  const [actionError,   setActionError]   = useState('');
  const [orderBy,       setOrderBy]       = useState<'expenseDate' | 'amount' | 'createdAt'>('expenseDate');
  const [order,         setOrder]         = useState<'asc' | 'desc'>('desc');
  const [hasFiscalDoc,  setHasFiscalDoc]  = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [showFilters,   setShowFilters]   = useState(false);

  const activeFilterCount = [hasFiscalDoc, dateFrom, dateTo].filter(Boolean).length;

  function resetFilters() {
    setHasFiscalDoc(''); setDateFrom(''); setDateTo('');
  }

  // queries
  const { data: listData, isLoading } = useQuery({
    queryKey: ['office-expenses', catFilter, orderBy, order, hasFiscalDoc, dateFrom, dateTo],
    queryFn:  () => officeExpensesApi.list({
      category:     catFilter     || undefined,
      hasFiscalDoc: hasFiscalDoc !== '' ? hasFiscalDoc === 'true' : undefined,
      from:         dateFrom      || undefined,
      to:           dateTo        || undefined,
      orderBy,
      order,
      limit: 50,
    }),
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
      setOcrValidated(false);
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
      setOcrValidated(false);
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
    setOcrValidated(false); // Reset validación OCR al abrir nuevo formulario
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
    setOcrValidated(false); // Reset validación OCR al abrir edición
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
        <div className="fixed top-4 right-4 z-50 bg-white border border-green-200 text-green-700 px-4 py-2 shadow-lg text-sm font-['DM_Sans']">
          {flash}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#1C1C1C' }} className="px-6 py-5 flex items-center justify-between">
        <div>
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-1">
            MÓDULO / GASTOS DE OFICINA
          </p>
          <h1 className="font-['Barlow_Condensed'] uppercase tracking-widest text-2xl font-bold text-white">
            Gastos de Oficina
          </h1>
          <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
            Insumos de limpieza, material gastable y servicios generales de oficina
          </p>
        </div>
        {isSupervisor && (
          <button
            onClick={openCreate}
            style={{ background: '#F5C218', color: '#1C1C1C' }}
            className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo Gasto
          </button>
        )}
      </div>

      {/* Stats */}
      {summaryData && (
        <div className="border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setExpandStats((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-200"
          >
            <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-semibold text-gray-700">Resumen</span>
            {expandStats ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {expandStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200">
              <div className="bg-white p-4 flex gap-3 items-stretch">
                <div className="w-1 bg-[#F5C218] shrink-0" />
                <div>
                  <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Este mes</p>
                  <p className="font-['Space_Mono'] text-lg font-bold text-gray-900">{fmt(summaryData.currentMonth.total)}</p>
                  <p className="font-['DM_Sans'] text-xs text-gray-400">{summaryData.currentMonth.count} registros</p>
                </div>
              </div>
              <div className="bg-white p-4 flex gap-3 items-stretch">
                <div className="w-1 bg-gray-300 shrink-0" />
                <div>
                  <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Total histórico</p>
                  <p className="font-['Space_Mono'] text-lg font-bold text-gray-900">{fmt(summaryData.allTime.total)}</p>
                  <p className="font-['DM_Sans'] text-xs text-gray-400">{summaryData.allTime.count} registros</p>
                </div>
              </div>
              {summaryData.byCategory.slice(0, 2).map((cat) => (
                <div key={cat.category} className="bg-white p-4 flex gap-3 items-stretch">
                  <div className="w-1 bg-[#F5C218] shrink-0" />
                  <div>
                    <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500 truncate">
                      {OFFICE_EXPENSE_CATEGORY_LABELS[cat.category as OfficeExpenseCategory]}
                    </p>
                    <p className="font-['Space_Mono'] text-lg font-bold text-gray-900">{fmt(cat.total)}</p>
                    <p className="font-['DM_Sans'] text-xs text-gray-400">{cat.count} registros</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtros: categoría + orden + avanzados */}
      <div className="space-y-3">
        {/* Fila 1: tabs de categoría */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase tracking-widest border transition-colors ${
              catFilter === ''
                ? 'text-white border-[#1C1C1C]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
            style={catFilter === '' ? { background: '#1C1C1C' } : {}}
          >
            Todas
          </button>
          {CATEGORIES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCatFilter(key)}
              className={`px-3 py-1.5 text-xs font-['Barlow_Condensed'] uppercase tracking-widest border transition-colors ${
                catFilter === key
                  ? 'text-white border-[#1C1C1C]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
              style={catFilter === key ? { background: '#1C1C1C' } : {}}
            >
              {label}
            </button>
          ))}

          {/* Separador */}
          <div className="flex-1" />

          {/* Orden */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-2" title="Ordenar por campo y dirección">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              className="text-xs font-['DM_Sans'] text-gray-700 bg-transparent border-none outline-none cursor-pointer"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
              title="Seleccionar campo para ordenar"
            >
              <option value="expenseDate">Fecha de factura</option>
              <option value="createdAt">Fecha de ingreso al sistema</option>
              <option value="amount">Monto</option>
            </select>
            <select
              className="text-xs font-['DM_Sans'] text-gray-700 bg-transparent border-none outline-none cursor-pointer"
              value={order}
              onChange={(e) => setOrder(e.target.value as any)}
              title="Seleccionar sentido de ordenamiento"
            >
              <option value="desc">↓ Más recientes primero</option>
              <option value="asc">↑ Más antiguos primero</option>
            </select>
          </div>

          {/* Botón filtros avanzados */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-['Barlow_Condensed'] uppercase tracking-widest transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#F5C218] text-[#1C1C1C]'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={showFilters || activeFilterCount > 0 ? { background: 'rgba(245,194,24,0.1)' } : {}}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span style={{ background: '#1C1C1C' }} className="text-white text-xs w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Fila 2: filtros avanzados (expandibles) */}
        {showFilters && (
          <div className="border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-semibold text-gray-500">Filtros avanzados</p>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="font-['DM_Sans'] text-xs text-red-500 hover:text-red-700 font-medium">
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">
                  Comprobante (NCF / Factura)
                </label>
                <select
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
                  value={hasFiscalDoc}
                  onChange={(e) => setHasFiscalDoc(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="true">Con factura</option>
                  <option value="false">Sin factura</option>
                </select>
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1" title="Filtro por fecha de factura (no de ingreso)">
                  Desde (factura)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['Space_Mono']"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="Fecha de factura desde"
                />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1" title="Filtro por fecha de factura (no de ingreso)">
                  Hasta (factura)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['Space_Mono']"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="Fecha de factura hasta"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 font-['DM_Sans'] text-gray-400">Cargando...</div>
      ) : expenses.length === 0 ? (
        <div className="border border-gray-200 bg-white p-12 text-center">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-['DM_Sans'] text-gray-500 font-medium">No hay gastos de oficina registrados</p>
          {isSupervisor && (
            <button
              onClick={openCreate}
              style={{ background: '#F5C218', color: '#1C1C1C' }}
              className="font-['Barlow_Condensed'] uppercase font-bold tracking-widest mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              Registrar primer gasto
            </button>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 bg-white overflow-hidden">
          {/* Table header */}
          <div style={{ background: '#1C1C1C' }} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2">
            <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white">Descripción / Categoría</span>
            <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white text-right">Fecha</span>
            <span className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-white text-right">Monto</span>
          </div>
          <div className="divide-y divide-gray-100">
            {expenses.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setViewingExp(exp)}
                className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-['DM_Sans'] font-semibold text-gray-900 group-hover:text-[#1C1C1C] transition-colors truncate text-sm">
                      {exp.description}
                    </p>
                    <span className={`text-xs px-2 py-0.5 font-['Barlow_Condensed'] uppercase tracking-widest ${CATEGORY_COLORS[exp.category]}`}>
                      {OFFICE_EXPENSE_CATEGORY_LABELS[exp.category]}
                    </span>
                  </div>
                  <p className="font-['DM_Sans'] text-xs text-gray-500 mt-0.5">
                    {PAYMENT_METHODS[exp.paymentMethod] ?? exp.paymentMethod}
                    {exp.hasFiscalDoc && <span className="ml-2 text-green-600">· Factura</span>}
                    {exp.supplier && (
                      <span className="ml-2 text-blue-600">
                        · <Building2 className="w-3 h-3 inline" /> {exp.supplier.name}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-['Space_Mono'] text-xs text-gray-400">{fmtDate(exp.expenseDate)}</p>
                </div>
                <div className="text-right shrink-0 min-w-[100px]">
                  <p className="font-['Space_Mono'] font-bold text-gray-900 text-sm">{fmt(exp.amount)}</p>
                  <p className="font-['DM_Sans'] text-xs text-gray-400">{exp.createdBy?.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div style={{ background: '#1C1C1C' }} className="flex items-center justify-between px-5 py-4">
              <h2 className="font-['Barlow_Condensed'] uppercase tracking-widest font-bold text-white text-lg">
                {editingId ? 'Editar gasto de oficina' : 'Nuevo gasto de oficina'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* OCR button */}
              {!editingId && (
                <div className="space-y-3">
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 text-gray-600 hover:border-[#F5C218] hover:text-[#1C1C1C] transition-colors text-sm font-['Barlow_Condensed'] uppercase tracking-widest"
                  >
                    {ocrLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando recibo...</>
                      : <><Camera className="w-4 h-4" /> Escanear recibo con IA</>
                    }
                  </button>
                  {ocrError && (
                    <p className="font-['DM_Sans'] text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {ocrError}
                    </p>
                  )}

                  {/* VALIDACIÓN OBLIGATORIA DE OCR */}
                  {form.hasFiscalDoc && !ocrValidated && (
                    <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ocrValidated}
                          onChange={(e) => setOcrValidated(e.target.checked)}
                          className="mt-1 rounded border-gray-300 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-sm font-semibold text-amber-900">
                            He revisado y validado los datos del OCR
                          </p>
                          <p className="font-['DM_Sans'] text-xs text-amber-700 mt-1">
                            Confirma que comparaste los datos extraídos (especialmente montos, NCF y fechas) con el comprobante original y que son correctos. Esta validación es obligatoria para registrar el gasto.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Categoría */}
              <div>
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">Categoría *</label>
                <select
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
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
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">Descripción *</label>
                <input
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
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
                  <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">Monto (DOP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['Space_Mono']"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">Fecha *</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['Space_Mono']"
                    value={form.expenseDate}
                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Suplidor */}
              <div>
                <label className="flex items-center gap-1 font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">
                  <Building2 className="w-3.5 h-3.5" /> Suplidor (opcional)
                </label>
                <select
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
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
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">Método de pago *</label>
                <select
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
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
                  <label className="flex items-center gap-1 font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">
                    <CreditCard className="w-3.5 h-3.5" /> Tarjeta corporativa *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
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
                <label htmlFor="hasFiscalDoc" className="font-['DM_Sans'] text-sm text-gray-700">
                  Tiene documento fiscal (factura / NCF)
                </label>
              </div>
              {form.hasFiscalDoc && (
                <div>
                  <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">
                    Número de comprobante
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['Space_Mono']"
                    placeholder="Ej: B0100000001"
                    value={form.fiscalDocNum}
                    onChange={(e) => setForm((f) => ({ ...f, fiscalDocNum: e.target.value }))}
                  />
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="block font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-600 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F5C218] text-sm font-['DM_Sans']"
                  rows={2}
                  placeholder="Observaciones adicionales..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Error */}
              {actionError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 p-3 font-['DM_Sans']">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-['Barlow_Condensed'] uppercase tracking-widest px-4 py-2 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (form.hasFiscalDoc && !ocrValidated && !editingId)}
                  title={form.hasFiscalDoc && !ocrValidated && !editingId ? 'Debes validar los datos del OCR antes de guardar' : ''}
                  style={{ background: '#F5C218', color: '#1C1C1C' }}
                  className="flex-1 font-['Barlow_Condensed'] uppercase font-bold tracking-widest flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-50 transition-opacity"
                >
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
          <div className="bg-white shadow-xl w-full max-w-md">
            <div style={{ background: '#1C1C1C' }} className="flex items-center justify-between px-5 py-4">
              <h2 className="font-['Barlow_Condensed'] uppercase tracking-widest font-bold text-white text-lg">
                Detalle del gasto
              </h2>
              <button onClick={() => setViewingExp(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`text-xs px-2 py-0.5 font-['Barlow_Condensed'] uppercase tracking-widest ${CATEGORY_COLORS[viewingExp.category]}`}>
                    {OFFICE_EXPENSE_CATEGORY_LABELS[viewingExp.category]}
                  </span>
                  <p className="font-['DM_Sans'] font-semibold text-gray-900 mt-2">{viewingExp.description}</p>
                </div>
                <p className="font-['Space_Mono'] text-xl font-bold text-gray-900 shrink-0">{fmt(viewingExp.amount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-gray-200">
                <div className="bg-white p-3 flex gap-2 items-stretch">
                  <div className="w-1 bg-[#F5C218] shrink-0" />
                  <div>
                    <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Fecha</p>
                    <p className="font-['Space_Mono'] text-sm font-medium text-gray-900">{fmtDate(viewingExp.expenseDate)}</p>
                  </div>
                </div>
                <div className="bg-white p-3 flex gap-2 items-stretch">
                  <div className="w-1 bg-gray-300 shrink-0" />
                  <div>
                    <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Método de pago</p>
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-900">{PAYMENT_METHODS[viewingExp.paymentMethod] ?? viewingExp.paymentMethod}</p>
                  </div>
                </div>
                {viewingExp.companyCard && (
                  <div className="bg-white p-3 flex gap-2 items-stretch">
                    <div className="w-1 bg-gray-300 shrink-0" />
                    <div>
                      <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Tarjeta</p>
                      <p className="font-['Space_Mono'] text-sm font-medium text-gray-900">{viewingExp.companyCard.holderName} ···{viewingExp.companyCard.lastFour}</p>
                    </div>
                  </div>
                )}
                {viewingExp.supplier && (
                  <div className="bg-white p-3 flex gap-2 items-stretch">
                    <div className="w-1 bg-gray-300 shrink-0" />
                    <div>
                      <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Suplidor</p>
                      <p className="font-['DM_Sans'] text-sm font-medium text-gray-900 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {viewingExp.supplier.name}
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-white p-3 flex gap-2 items-stretch">
                  <div className="w-1 bg-gray-300 shrink-0" />
                  <div>
                    <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500">Registrado por</p>
                    <p className="font-['DM_Sans'] text-sm font-medium text-gray-900">{viewingExp.createdBy?.name}</p>
                  </div>
                </div>
              </div>

              {viewingExp.hasFiscalDoc && (
                <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4">
                  <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-semibold text-amber-900 mb-1">
                    Documento fiscal
                  </p>
                  {viewingExp.fiscalDocNum && (
                    <p className="font-['Space_Mono'] text-sm text-amber-700">{viewingExp.fiscalDocNum}</p>
                  )}
                </div>
              )}

              {viewingExp.notes && (
                <div className="border border-gray-200 bg-gray-50 p-3">
                  <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs font-medium text-gray-600 mb-1">Notas</p>
                  <p className="font-['DM_Sans'] text-sm text-gray-600">{viewingExp.notes}</p>
                </div>
              )}

              {isSupervisor && (
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openEdit(viewingExp)}
                    className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-['Barlow_Condensed'] uppercase tracking-widest px-4 py-2 text-sm transition-colors"
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
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-['Barlow_Condensed'] uppercase tracking-widest text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {voidMut.isPending ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
