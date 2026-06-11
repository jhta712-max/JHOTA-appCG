import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Plus, X, Save, Trash2, ChevronDown, ChevronUp,
  Sparkles, AlertCircle, CreditCard, Camera, Loader2, Building2,
  ArrowUpDown, Filter,
} from 'lucide-react';
import {
  officeExpensesApi, cardsApi, suppliersApi,
  OFFICE_EXPENSE_CATEGORY_LABELS,
  type OfficeExpense, type OfficeExpenseCategory,
} from '../../api';
import { useOcrPolling } from '../../hooks/useOcrPolling';
import { OcrEnrichmentAlerts } from '../../components/OcrEnrichmentAlerts';
import { fmtDate } from '../../utils/date';
import { useRole } from '../../hooks/useRole';

function fmt(amount: string | number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 0,
  }).format(Number(amount));
}

const CATEGORIES = Object.entries(OFFICE_EXPENSE_CATEGORY_LABELS) as [OfficeExpenseCategory, string][];

const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Efectivo', TRANSFER: 'Transferencia', CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro',
};

const CATEGORY_COLORS: Record<OfficeExpenseCategory, string> = {
  CLEANING_SUPPLIES: 'bg-blue-100 text-blue-700',
  CONSUMABLES:       'bg-amber-100 text-amber-700',
  OFFICE_SERVICES:   'bg-purple-100 text-purple-700',
  BIDDING:           'bg-orange-100 text-orange-700',
  OTHER:             'bg-gray-100 text-gray-700',
};

const CATEGORY_DOT: Record<OfficeExpenseCategory, string> = {
  CLEANING_SUPPLIES: 'bg-blue-500',
  CONSUMABLES:       'bg-amber-500',
  OFFICE_SERVICES:   'bg-purple-500',
  BIDDING:           'bg-orange-500',
  OTHER:             'bg-gray-400',
};

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

export default function OfficeExpensesPage() {
  const qc = useQueryClient();
  const { isSupervisor } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [viewingExp,   setViewingExp]   = useState<OfficeExpense | null>(null);
  const [form,         setForm]         = useState(emptyForm());
  const [flash,        setFlash]        = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [expandStats,  setExpandStats]  = useState(true);
  const { loading: ocrLoading, error: ocrError, enrichment: ocrEnrichment, analyze: runOcr, reset: resetOcr } = useOcrPolling();
  const [ocrValidated, setOcrValidated] = useState(false);
  const [actionError,  setActionError]  = useState('');
  const [orderBy,      setOrderBy]      = useState<'expenseDate' | 'amount' | 'createdAt'>('expenseDate');
  const [order,        setOrder]        = useState<'asc' | 'desc'>('desc');
  const [hasFiscalDoc, setHasFiscalDoc] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);

  const activeFilterCount = [hasFiscalDoc, dateFrom, dateTo].filter(Boolean).length;

  function resetFilters() { setHasFiscalDoc(''); setDateFrom(''); setDateTo(''); }

  const { data: listData, isLoading } = useQuery({
    queryKey: ['office-expenses', catFilter, orderBy, order, hasFiscalDoc, dateFrom, dateTo],
    queryFn:  () => officeExpensesApi.list({
      category:     catFilter     || undefined,
      hasFiscalDoc: hasFiscalDoc !== '' ? hasFiscalDoc === 'true' : undefined,
      from:         dateFrom      || undefined,
      to:           dateTo        || undefined,
      orderBy, order, limit: 50,
    }),
    select: (r) => r.data,
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

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['office-expenses'] });
    qc.invalidateQueries({ queryKey: ['office-expenses-summary'] });
  }

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 3000); }

  const createMut = useMutation({
    mutationFn: () => officeExpensesApi.create({
      ...form, amount: Number(form.amount),
      companyCardId: form.companyCardId || null,
      supplierId:    form.supplierId    || null,
      fiscalDocNum:  form.fiscalDocNum  || null,
      notes:         form.notes         || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm()); setOcrValidated(false); showFlash('✅ Gasto registrado'); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al guardar'),
  });

  const updateMut = useMutation({
    mutationFn: () => officeExpensesApi.update(editingId!, {
      ...form, amount: Number(form.amount),
      companyCardId: form.companyCardId || null,
      supplierId:    form.supplierId    || null,
      fiscalDocNum:  form.fiscalDocNum  || null,
      notes:         form.notes         || null,
    }),
    onSuccess: () => { invalidate(); setShowForm(false); setEditingId(null); setViewingExp(null); setForm(emptyForm()); setOcrValidated(false); showFlash('✅ Gasto actualizado'); },
    onError: (e: any) => setActionError(e.response?.data?.error ?? 'Error al guardar'),
  });

  const voidMut = useMutation({
    mutationFn: (id: string) => officeExpensesApi.void(id),
    onSuccess: () => { invalidate(); setViewingExp(null); showFlash('🗑 Gasto eliminado'); },
  });

  function openCreate() {
    setEditingId(null); setForm(emptyForm()); setActionError(''); resetOcr(); setOcrValidated(false); setShowForm(true);
  }

  function openEdit(exp: OfficeExpense) {
    setEditingId(exp.id);
    setForm({
      category: exp.category, description: exp.description, amount: String(exp.amount),
      expenseDate: exp.expenseDate.slice(0, 10), paymentMethod: exp.paymentMethod,
      companyCardId: exp.companyCardId ?? '', supplierId: exp.supplierId ?? '',
      hasFiscalDoc: exp.hasFiscalDoc, fiscalDocNum: exp.fiscalDocNum ?? '', notes: exp.notes ?? '',
    });
    setActionError(''); resetOcr(); setOcrValidated(false); setShowForm(true); setViewingExp(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setActionError('');
    if (editingId) updateMut.mutate(); else createMut.mutate();
  }

  async function handleOcrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await runOcr(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!data) return;
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
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="min-h-screen bg-gray-50 font-['DM_Sans']">

      {/* Flash */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 bg-[#1C1C1C] text-[#F5C218] px-4 py-2.5 rounded-none shadow-2xl text-sm font-bold tracking-wide border-l-4 border-[#F5C218]">
          {flash}
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-[#1C1C1C] px-6 py-8 mb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[#F5C218] text-xs font-bold tracking-[0.2em] uppercase font-['Space_Mono'] mb-2">
              MÓDULO / GASTOS DE OFICINA
            </p>
            <h1 className="text-4xl font-black text-white font-['Barlow_Condensed'] uppercase tracking-tight leading-none">
              GASTOS DE OFICINA
            </h1>
            <p className="text-gray-400 text-sm mt-2 font-['DM_Sans']">
              Insumos de limpieza, material gastable y servicios generales
            </p>
          </div>
          <div className="flex items-center gap-4">
            {summaryData && (
              <div className="text-right">
                <p className="text-gray-500 text-xs font-['Space_Mono'] uppercase tracking-wide">Este mes</p>
                <p className="text-[#F5C218] text-2xl font-black font-['Space_Mono']">
                  {fmt(summaryData.currentMonth.total)}
                </p>
              </div>
            )}
            {isSupervisor && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-5 py-3 font-bold text-sm uppercase tracking-wide hover:bg-yellow-300 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo Gasto
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5">

        {/* Stats */}
        {summaryData && (
          <div className="border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setExpandStats((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <span className="text-xs font-bold text-gray-500 uppercase tracking-[0.15em] font-['Space_Mono']">Resumen Financiero</span>
              {expandStats ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {expandStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                <div className="p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono'] mb-1">Este Mes</p>
                  <p className="text-xl font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(summaryData.currentMonth.total)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{summaryData.currentMonth.count} registros</p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono'] mb-1">Total Histórico</p>
                  <p className="text-xl font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(summaryData.allTime.total)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{summaryData.allTime.count} registros</p>
                </div>
                {summaryData.byCategory.slice(0, 2).map((cat) => (
                  <div key={cat.category} className="p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono'] mb-1 truncate">
                      {OFFICE_EXPENSE_CATEGORY_LABELS[cat.category as OfficeExpenseCategory]}
                    </p>
                    <p className="text-xl font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(cat.total)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cat.count} registros</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setCatFilter('')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors border ${
                catFilter === '' ? 'bg-[#1C1C1C] text-[#F5C218] border-[#1C1C1C]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              Todas
            </button>
            {CATEGORIES.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCatFilter(key)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors border ${
                  catFilter === key ? 'bg-[#1C1C1C] text-[#F5C218] border-[#1C1C1C]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}

            <div className="flex-1" />

            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <select className="text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer font-['Space_Mono']"
                value={orderBy} onChange={(e) => setOrderBy(e.target.value as any)}>
                <option value="expenseDate">Fecha factura</option>
                <option value="createdAt">Fecha ingreso</option>
                <option value="amount">Monto</option>
              </select>
              <select className="text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer"
                value={order} onChange={(e) => setOrder(e.target.value as any)}>
                <option value="desc">↓ Recientes</option>
                <option value="asc">↑ Antiguos</option>
              </select>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-bold uppercase tracking-wide transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-[#F5C218] border-[#F5C218] text-[#1C1C1C]'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-[#1C1C1C] text-[#F5C218] text-xs w-4 h-4 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.15em] font-['Space_Mono']">Filtros Avanzados</p>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wide">
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Comprobante</label>
                  <select className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" value={hasFiscalDoc} onChange={(e) => setHasFiscalDoc(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="true">Con factura</option>
                    <option value="false">Sin factura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Desde</label>
                  <input type="date" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Hasta</label>
                  <input type="date" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-['Space_Mono'] text-sm">Cargando...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-[#1C1C1C] p-16 text-center">
            <Sparkles className="w-10 h-10 text-[#F5C218] mx-auto mb-4" />
            <p className="text-white font-bold font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Sin gastos registrados</p>
            <p className="text-gray-400 text-sm mt-2">
              {catFilter ? 'Prueba con otra categoría' : 'Registra el primer gasto de oficina'}
            </p>
            {isSupervisor && (
              <button onClick={openCreate} className="mt-5 bg-[#F5C218] text-[#1C1C1C] px-5 py-2.5 font-bold text-sm uppercase tracking-wide hover:bg-yellow-300 transition-colors inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Registrar gasto
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-px">
            {expenses.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setViewingExp(exp)}
                className="w-full bg-white border border-gray-200 hover:border-[#1C1C1C] hover:shadow-md transition-all text-left group flex items-center gap-0"
              >
                {/* Category dot bar */}
                <div className={`w-1 self-stretch ${CATEGORY_DOT[exp.category]}`} />
                <div className="flex items-center gap-4 px-5 py-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-[#1C1C1C] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-[#F5C218]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1C1C1C] group-hover:text-[#1C1C1C] transition-colors truncate font-['Barlow_Condensed'] text-lg uppercase tracking-wide">
                        {exp.description}
                      </p>
                      <span className={`text-xs px-2 py-0.5 font-bold uppercase tracking-wide ${CATEGORY_COLORS[exp.category]}`}>
                        {OFFICE_EXPENSE_CATEGORY_LABELS[exp.category]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 font-['Space_Mono'] text-xs">
                      {fmtDate(exp.expenseDate)} · {PAYMENT_METHODS[exp.paymentMethod] ?? exp.paymentMethod}
                      {exp.hasFiscalDoc && <span className="ml-2 text-green-600 font-bold">· FACTURA</span>}
                      {exp.supplier && (
                        <span className="ml-2 text-blue-600">
                          · {exp.supplier.name}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-[#1C1C1C] font-['Space_Mono'] text-lg">{fmt(exp.amount)}</p>
                    <p className="text-xs text-gray-400 font-['DM_Sans']">{exp.createdBy?.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── FORM MODAL ─────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
              <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">
                {editingId ? 'Editar Gasto' : 'Nuevo Gasto de Oficina'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* OCR button */}
              {!editingId && (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleOcrFile} />
                  <button
                    type="button"
                    disabled={ocrLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#F5C218] text-[#1C1C1C] bg-yellow-50 hover:bg-yellow-100 transition-colors text-sm font-bold uppercase tracking-wide"
                  >
                    {ocrLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando recibo...</>
                      : <><Camera className="w-4 h-4" /> Escanear recibo con IA</>
                    }
                  </button>
                  {ocrError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {ocrError}
                    </p>
                  )}
                  <OcrEnrichmentAlerts enrichment={ocrEnrichment} />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Categoría *</label>
                <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                  value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as OfficeExpenseCategory }))} required>
                  {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descripción *</label>
                <input className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                  placeholder="Ej: Compra de papel carta, detergente industrial..."
                  value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required minLength={3} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Monto (DOP) *</label>
                  <input type="number" step="0.01" min="0.01" className="w-full border border-gray-200 px-3 py-2.5 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                    placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fecha *</label>
                  <input type="date" className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                    value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Suplidor (opcional)</label>
                <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                  value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">Sin suplidor</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` — RNC ${s.rnc}` : ''}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Método de pago *</label>
                <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                  value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value, companyCardId: '' }))} required>
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {form.paymentMethod === 'CARD' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tarjeta corporativa *</label>
                  <select className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                    value={form.companyCardId} onChange={(e) => setForm((f) => ({ ...f, companyCardId: e.target.value }))} required>
                    <option value="">Seleccionar tarjeta...</option>
                    {(cardsData ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.holderName} — ···{c.lastFour} ({c.bank})</option>)}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="hasFiscalDoc" checked={form.hasFiscalDoc}
                  onChange={(e) => setForm((f) => ({ ...f, hasFiscalDoc: e.target.checked }))}
                  className="w-4 h-4 border-gray-300 accent-[#F5C218]" />
                <label htmlFor="hasFiscalDoc" className="text-sm text-gray-700">Tiene documento fiscal (factura / NCF)</label>
              </div>
              {form.hasFiscalDoc && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Número de comprobante</label>
                  <input className="w-full border border-gray-200 px-3 py-2.5 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                    placeholder="Ej: B0100000001" value={form.fiscalDocNum} onChange={(e) => setForm((f) => ({ ...f, fiscalDocNum: e.target.value }))} />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notas (opcional)</label>
                <textarea className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] resize-none"
                  rows={2} placeholder="Observaciones adicionales..."
                  value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              {actionError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border-l-4 border-red-500 p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {form.hasFiscalDoc && (
                <div className={`border-l-4 p-3 ${ocrValidated ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={ocrValidated} onChange={(e) => setOcrValidated(e.target.checked)} className="mt-1" />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${ocrValidated ? 'text-green-800' : 'text-amber-900'}`}>
                        {ocrValidated ? '✓ Datos del OCR validados' : 'Confirmar datos extraídos por IA'}
                      </p>
                      <p className={`text-xs mt-1 ${ocrValidated ? 'text-green-700' : 'text-amber-700'}`}>
                        {ocrValidated
                          ? 'Has confirmado que los datos coinciden con el comprobante original.'
                          : 'Compara los campos completados automáticamente con el comprobante original antes de guardar.'}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wide">
                  Cancelar
                </button>
                <button type="submit"
                  disabled={isSubmitting || (form.hasFiscalDoc && !ocrValidated && !editingId)}
                  className="flex-1 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ──────────────────────────────── */}
      {viewingExp && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md shadow-2xl">
            <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 ${CATEGORY_DOT[viewingExp.category]}`} />
                <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Detalle del Gasto</h2>
              </div>
              <button onClick={() => setViewingExp(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-xs px-2 py-0.5 font-bold uppercase tracking-wide ${CATEGORY_COLORS[viewingExp.category]}`}>
                    {OFFICE_EXPENSE_CATEGORY_LABELS[viewingExp.category]}
                  </span>
                  <p className="font-bold text-[#1C1C1C] mt-2 font-['Barlow_Condensed'] text-xl uppercase tracking-wide">{viewingExp.description}</p>
                </div>
                <p className="text-2xl font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(viewingExp.amount)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Fecha</p>
                  <p className="font-medium">{fmtDate(viewingExp.expenseDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Método de pago</p>
                  <p className="font-medium">{PAYMENT_METHODS[viewingExp.paymentMethod] ?? viewingExp.paymentMethod}</p>
                </div>
                {viewingExp.companyCard && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Tarjeta</p>
                    <p className="font-medium font-['Space_Mono'] text-xs">{viewingExp.companyCard.holderName} ···{viewingExp.companyCard.lastFour}</p>
                  </div>
                )}
                {viewingExp.supplier && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Suplidor</p>
                    <p className="font-medium flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {viewingExp.supplier.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Registrado por</p>
                  <p className="font-medium">{viewingExp.createdBy?.name}</p>
                </div>
              </div>

              {viewingExp.hasFiscalDoc && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 text-sm">
                  <p className="text-green-700 font-bold uppercase tracking-wide text-xs">Documento Fiscal</p>
                  {viewingExp.fiscalDocNum && <p className="text-green-600 font-['Space_Mono'] text-sm mt-1">{viewingExp.fiscalDocNum}</p>}
                </div>
              )}

              {viewingExp.notes && (
                <div className="bg-gray-50 border-l-4 border-gray-300 p-3 text-sm text-gray-600">
                  <p className="font-bold text-gray-700 uppercase tracking-wide text-xs mb-1">Notas</p>
                  {viewingExp.notes}
                </div>
              )}

              {isSupervisor && (
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(viewingExp)}
                    className="flex-1 border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors uppercase tracking-wide">
                    Editar
                  </button>
                  <button
                    onClick={() => { if (confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) voidMut.mutate(viewingExp.id); }}
                    disabled={voidMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors uppercase tracking-wide">
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
