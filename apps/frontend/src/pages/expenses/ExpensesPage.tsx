import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Upload, Download, X, CheckCircle, AlertCircle, ArrowUpDown, Filter, Layers, Check, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { expensesApi, projectsApi, categoriesApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../types';
import { ExpenseListSkeleton } from '../../components/ui/ExpenseListSkeleton';
import { SkeletonBlock }       from '../../components/ui/Skeleton';
import { SavedFiltersBar }     from '../../components/ui/SavedFiltersBar';
import { fmtDate } from '../../utils/date';
import api from '../../api/client';
import { useRole } from '../../hooks/useRole';
import { BatchItemSelect } from '../../components/shared/BatchItemSelect';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

function downloadCsvTemplate() {
  const header = 'fecha,descripcion,proveedor,categoria,monto,metodo_pago,proyecto,notas';
  const example = '2026-06-16,Compra de materiales,Ferretería XYZ,Materiales,15000,TRANSFER,PROJ-001,Factura #123';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'plantilla-importacion-gastos.csv'; a.click();
  URL.revokeObjectURL(url);
}

function normalizeFecha(raw: string): string {
  const s = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, ''); });
    if (obj.fecha) obj.fecha = normalizeFecha(obj.fecha);
    return obj;
  }).filter((r) => r.fecha && r.monto);
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { canCreateExpense, isAdmin, isSupervisor } = useRole();
  const canApprove = isAdmin || isSupervisor;
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('ACTIVE');
  const [page,        setPage]        = useState(1);
  const [orderBy,     setOrderBy]     = useState<'expenseDate' | 'amount' | 'createdAt'>('expenseDate');
  const [order,       setOrder]       = useState<'asc' | 'desc'>('desc');
  const [categoryId,  setCategoryId]  = useState('');
  const [hasFiscalDoc, setHasFiscalDoc] = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk item assignment mode
  const [bulkMode,    setBulkMode]    = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkItemId,  setBulkItemId]  = useState('');
  const [bulkDone,    setBulkDone]    = useState(0);
  const [bulkApplying, setBulkApplying] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  interface EditRow {
    _id:         string;
    fecha:       string;
    descripcion: string;
    proveedor:   string;
    categoria:   string;
    monto:       string; // keep as string while editing
    metodo_pago: string;
    proyecto:    string;
    notas:       string;
  }

  const [editRows,     setEditRows]     = useState<EditRow[]>([]);
  const [importModal,  setImportModal]  = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; err: number; results: any[] } | null>(null);

  function updateEditRow(id: string, field: keyof EditRow, value: string) {
    setEditRows((rows) => rows.map((r) => r._id === id ? { ...r, [field]: value } : r));
  }
  function deleteEditRow(id: string) {
    setEditRows((rows) => rows.filter((r) => r._id !== id));
  }
  function isRowValid(r: EditRow) {
    return r.fecha.trim() && r.proyecto.trim() && parseFloat(r.monto) > 0;
  }

  const importMut = useMutation({
    mutationFn: (rows: any[]) => api.post('/expenses/bulk-import', { rows }).then((r) => r.data.data),
    onSuccess: (data) => { setImportResult(data); qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => expensesApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setRejectTarget(null); setRejectReason(''); },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text).map((r, i): EditRow => ({
        _id:         String(i),
        fecha:       r.fecha        || '',
        descripcion: r.descripcion  || '',
        proveedor:   r.proveedor    || '',
        categoria:   r.categoria    || '',
        monto:       r.monto        || '',
        metodo_pago: r.metodo_pago  || 'TRANSFER',
        proyecto:    r.proyecto     || '',
        notas:       r.notas        || '',
      }));
      setEditRows(rows); setImportResult(null); setImportModal(true);
    };
    reader.readAsText(file, 'windows-1252');
    e.target.value = '';
  }

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list(),
    select:   (r) => r.data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, selectedProjectId, status, page, orderBy, order, categoryId, hasFiscalDoc, dateFrom, dateTo],
    queryFn:  () => expensesApi.list({
      search:      search || undefined,
      projectId:   selectedProjectId !== 'all' ? selectedProjectId : undefined,
      status:      status || undefined,
      categoryId:  categoryId ? Number(categoryId) : undefined,
      hasFiscalDoc: hasFiscalDoc !== '' ? hasFiscalDoc === 'true' : undefined,
      dateFrom:    dateFrom || undefined,
      dateTo:      dateTo   || undefined,
      orderBy,
      order,
      page,
      limit: 30,
    }),
    select: (r) => r.data,
  });

  const activeFilterCount = [categoryId, hasFiscalDoc, dateFrom, dateTo].filter(Boolean).length;

  function resetFilters() {
    setCategoryId(''); setHasFiscalDoc(''); setDateFrom(''); setDateTo(''); setPage(1);
  }

  function exitBulkMode() {
    setBulkMode(false); setSelectedIds(new Set()); setBulkItemId(''); setBulkDone(0);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function applyBulkItem() {
    if (!bulkItemId || selectedIds.size === 0) return;
    setBulkApplying(true);
    let done = 0;
    await Promise.all([...selectedIds].map(async (id) => {
      await expensesApi.update(id, { batchItemId: bulkItemId } as any);
      done++;
      setBulkDone(done);
    }));
    setBulkApplying(false);
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['project-summary'] });
    exitBulkMode();
  }

  const expenses   = data?.data ?? [];
  const pagination = data?.pagination;
  const projects   = projectsData ?? [];

  const tabTotal = expenses
    .filter((e) => e.status !== 'REJECTED' && e.status !== 'VOIDED')
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
    <div className="space-y-0">

      {/* Hero header band */}
      <div
        className="flex items-center justify-between px-6 py-5"
        style={{ background: '#1C1C1C' }}
      >
        <div>
          <p
            className="text-xs tracking-widest uppercase mb-1"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}
          >
            MÓDULO / GASTOS
          </p>
          <h1
            className="text-3xl uppercase tracking-widest text-white leading-none"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Gastos
          </h1>
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-32 bg-gray-600" />
              : `${pagination?.total ?? 0} gastos registrados`
            }
          </p>
        </div>
        {canCreateExpense && (
          <div className="flex gap-2 items-center">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <button
              onClick={downloadCsvTemplate}
              title="Descargar plantilla CSV de ejemplo"
              className="flex items-center gap-2 px-3 py-2 border transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif', borderColor: '#4b5563', color: '#d1d5db', fontSize: '0.875rem' }}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#F5C218'; (ev.currentTarget as HTMLButtonElement).style.color = '#F5C218'; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563'; (ev.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
            >
              <Download className="w-4 h-4" /> Plantilla
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif', borderColor: '#4b5563', color: '#d1d5db', fontSize: '0.875rem' }}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#F5C218'; (ev.currentTarget as HTMLButtonElement).style.color = '#F5C218'; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563'; (ev.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
            >
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
            {selectedProjectId !== 'all' && !bulkMode && (
              <button
                onClick={() => setBulkMode(true)}
                className="flex items-center gap-2 px-3 py-2 border transition-colors"
                style={{ fontFamily: 'DM Sans, sans-serif', borderColor: '#4b5563', color: '#d1d5db', fontSize: '0.875rem' }}
                onMouseEnter={(ev) => { ev.currentTarget.style.borderColor = '#F5C218'; ev.currentTarget.style.color = '#F5C218'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = '#4b5563'; ev.currentTarget.style.color = '#d1d5db'; }}
              >
                <Layers className="w-4 h-4" /> Asignar Item
              </button>
            )}
            <Link
              to="/expenses/new"
              className="flex items-center gap-2 px-4 py-2 font-bold uppercase tracking-wide transition-opacity hover:opacity-90"
              style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.875rem' }}
            >
              <Plus className="w-4 h-4" /> Nuevo Gasto
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-4 mt-5 px-0">

        {/* Tabs por proyecto */}
        <div className="flex gap-0 flex-wrap border-b border-gray-200">
          <button
            onClick={() => { setSelectedProjectId('all'); setPage(1); }}
            className="px-4 py-2 border-b-2 transition-colors"
            style={
              selectedProjectId === 'all'
                ? { borderColor: '#F5C218', color: '#1C1C1C', fontWeight: 600, fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }
                : { borderColor: 'transparent', color: '#6b7280', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }
            }
          >
            TODOS
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProjectId(p.id); setPage(1); }}
              className="px-4 py-2 border-b-2 transition-colors max-w-[200px] truncate"
              title={p.name}
              style={
                selectedProjectId === p.id
                  ? { borderColor: '#F5C218', color: '#1C1C1C', fontWeight: 600, fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }
                  : { borderColor: 'transparent', color: '#6b7280', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }
              }
            >
              {p.code}
            </button>
          ))}
        </div>

        {/* Info proyecto seleccionado */}
        {selectedProjectId !== 'all' && (() => {
          const p = projects.find((x) => x.id === selectedProjectId);
          return p ? (
            <div
              className="border-l-4 bg-amber-50 px-4 py-3 flex items-center justify-between"
              style={{ borderLeftColor: '#F5C218' }}
            >
              <div>
                <p
                  className="font-semibold text-sm"
                  style={{ fontFamily: 'DM Sans, sans-serif', color: '#1C1C1C' }}
                >
                  {p.name}
                </p>
                <p
                  className="text-xs text-gray-500 mt-0.5"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                >
                  {p.code} · {p.client ?? 'Sin cliente'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Total en vista</p>
                <p
                  className="font-bold text-sm"
                  style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
                >
                  {formatCurrency(tabTotal)}
                </p>
              </div>
            </div>
          ) : null;
        })()}

        {/* Filtros principales */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full border border-gray-300 rounded-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218] focus:border-[#F5C218]"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
              placeholder="Buscar descripción..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <select
            className="border border-gray-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218] focus:border-[#F5C218] w-auto"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="PENDING_APPROVAL">Pendientes de aprobación</option>
            <option value="VOIDED">Anulados</option>
          </select>

          <div
            className="flex items-center gap-1.5 border border-gray-300 px-3 py-2"
            title="Ordenar por campo y dirección"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select
              className="text-sm bg-transparent border-none outline-none cursor-pointer"
              style={{ fontFamily: 'DM Sans, sans-serif', color: '#374151' }}
              value={orderBy}
              onChange={(e) => { setOrderBy(e.target.value as any); setPage(1); }}
            >
              <option value="expenseDate">Fecha de factura</option>
              <option value="createdAt">Fecha de ingreso al sistema</option>
              <option value="amount">Monto</option>
            </select>
            <select
              className="text-sm bg-transparent border-none outline-none cursor-pointer"
              style={{ fontFamily: 'DM Sans, sans-serif', color: '#374151' }}
              value={order}
              onChange={(e) => { setOrder(e.target.value as any); setPage(1); }}
            >
              <option value="desc">↓ Más recientes primero</option>
              <option value="asc">↑ Más antiguos primero</option>
            </select>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-2 border text-sm font-medium transition-colors"
            style={
              showFilters || activeFilterCount > 0
                ? { background: '#F5C218', color: '#1C1C1C', borderColor: '#F5C218', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }
                : { background: 'white', color: '#4b5563', borderColor: '#d1d5db', fontFamily: 'DM Sans, sans-serif' }
            }
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span
                className="text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
                style={{ background: '#1C1C1C', color: 'white' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filtros avanzados */}
        {showFilters && (
          <div className="bg-white border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}
              >
                Filtros avanzados
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Categoría
                </label>
                <select
                  className="w-full border border-gray-300 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
                >
                  <option value="">Todas</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  Comprobante (NCF)
                </label>
                <select
                  className="w-full border border-gray-300 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  value={hasFiscalDoc}
                  onChange={(e) => { setHasFiscalDoc(e.target.value); setPage(1); }}
                >
                  <option value="">Todos</option>
                  <option value="true">Con NCF</option>
                  <option value="false">Sin NCF</option>
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-medium text-gray-600 mb-1"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  title="Filtro por fecha de factura (no de ingreso)"
                >
                  Desde (factura)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218]"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium text-gray-600 mb-1"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  title="Filtro por fecha de factura (no de ingreso)"
                >
                  Hasta (factura)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-none px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#F5C218]"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Vistas guardadas */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <SavedFiltersBar
            namespace="expenses"
            currentFilters={{ selectedProjectId, search, status, categoryId, hasFiscalDoc, dateFrom, dateTo, orderBy, order }}
            onApply={(f: any) => {
              if (f.selectedProjectId !== undefined) setSelectedProjectId(f.selectedProjectId);
              if (f.search      !== undefined) setSearch(f.search);
              if (f.status      !== undefined) setStatus(f.status);
              if (f.categoryId  !== undefined) setCategoryId(f.categoryId);
              if (f.hasFiscalDoc !== undefined) setHasFiscalDoc(f.hasFiscalDoc);
              if (f.dateFrom    !== undefined) setDateFrom(f.dateFrom);
              if (f.dateTo      !== undefined) setDateTo(f.dateTo);
              if (f.orderBy     !== undefined) setOrderBy(f.orderBy);
              if (f.order       !== undefined) setOrder(f.order);
              setPage(1);
            }}
          />
        </div>

        {/* Lista */}
        {isLoading ? (
          <ExpenseListSkeleton />
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center border border-gray-100">
            <div
              className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
              style={{ background: '#1C1C1C' }}
            >
              <Receipt className="w-7 h-7" style={{ color: '#F5C218' }} />
            </div>
            <p
              className="text-xl uppercase tracking-widest mb-1"
              style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#1C1C1C' }}
            >
              Sin gastos registrados
            </p>
            <p className="text-sm text-gray-400 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              No hay resultados para los filtros actuales
            </p>
            {canCreateExpense && (
              <Link
                to="/expenses/new"
                className="inline-flex items-center gap-2 px-4 py-2 font-bold uppercase tracking-wide text-sm"
                style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                <Plus className="w-4 h-4" /> Registrar primer gasto
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {expenses.map((e) => {
                const isSelected = selectedIds.has(e.id);
                const isVoided   = e.status === 'VOIDED';
                const CardEl = bulkMode ? 'div' : Link;
                const cardProps = bulkMode
                  ? { onClick: isVoided ? undefined : () => toggleSelect(e.id), style: { cursor: isVoided ? 'not-allowed' : 'pointer' } }
                  : { to: `/expenses/${e.id}` };
                return (
                <CardEl
                  key={e.id}
                  {...(cardProps as any)}
                  className={`bg-white border p-4 flex items-center gap-3 group transition-colors ${
                    bulkMode
                      ? isSelected ? 'border-[#F5C218] bg-yellow-50' : isVoided ? 'border-gray-100 opacity-50' : 'border-gray-100 hover:border-[#F5C218]'
                      : 'border-gray-100 hover:border-[#F5C218]'
                  }`}
                >
                  {bulkMode && (
                    <div
                      className="w-5 h-5 shrink-0 border-2 flex items-center justify-center"
                      style={{ borderColor: isSelected ? '#F5C218' : '#d1d5db', background: isSelected ? '#F5C218' : 'white' }}
                    >
                      {isSelected && <Check className="w-3 h-3" style={{ color: '#1C1C1C' }} />}
                    </div>
                  )}
                  <div
                    className="w-1 self-stretch shrink-0"
                    style={{ background: isVoided ? '#ef4444' : '#22c55e' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ fontFamily: 'DM Sans, sans-serif', color: '#1C1C1C' }}
                    >
                      {e.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                      {selectedProjectId === 'all' && (
                        <span
                          className="font-medium mr-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}
                        >
                          {e.project.code} ·
                        </span>
                      )}
                      {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                      {e.projectItem && (
                        <span
                          className="ml-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C', fontSize: '0.75rem', background: '#F5C218', padding: '0 4px' }}
                        >
                          #{e.projectItem.number} {e.projectItem.name}
                        </span>
                      )}
                      {e.hasFiscalDoc && e.fiscalVoucher && (
                        <span
                          className="ml-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#2563eb', fontSize: '0.75rem' }}
                        >
                          · {e.fiscalVoucher.ncf}
                        </span>
                      )}
                      {e.hasFiscalDoc && !e.fiscalVoucher && (
                        <span
                          className="ml-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#3b82f6', fontSize: '0.75rem' }}
                        >
                          · NCF
                        </span>
                      )}
                      {e.paymentOrder?.paymentBank && (
                        <span
                          className="ml-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#6b7280', fontSize: '0.75rem' }}
                        >
                          · {e.paymentOrder.paymentBank}
                        </span>
                      )}
                      {e.paymentOrder?.paymentReference && (
                        <span
                          className="ml-1"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#9ca3af', fontSize: '0.75rem' }}
                        >
                          #{e.paymentOrder.paymentReference}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className="font-bold text-sm"
                      style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}
                    >
                      {formatCurrency(Number(e.amount))}
                    </p>
                    <p
                      className="text-xs text-gray-400 mt-0.5"
                      style={{ fontFamily: 'Space Mono, monospace' }}
                    >
                      {fmtDate(e.expenseDate)}
                    </p>
                  </div>
                  {e.status === 'VOIDED' && (
                    <span
                      className="shrink-0 px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
                      style={{ background: '#fee2e2', color: '#dc2626', fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Anulado
                    </span>
                  )}
                  {e.status === 'PENDING_APPROVAL' && (
                    <div className="shrink-0 flex items-center gap-1" onClick={ev => ev.preventDefault()}>
                      <span
                        className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
                        style={{ background: '#fef9c3', color: '#854d0e', fontFamily: 'Barlow Condensed, sans-serif' }}
                      >
                        Pendiente
                      </span>
                      {canApprove && !bulkMode && (
                        <>
                          <button
                            title="Aprobar"
                            disabled={approveMut.isPending}
                            onClick={() => approveMut.mutate(e.id)}
                            className="p-1.5 hover:bg-green-50 text-green-600 disabled:opacity-40"
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            title="Rechazar"
                            disabled={rejectMut.isPending}
                            onClick={() => { setRejectTarget(e.id); setRejectReason(''); }}
                            className="p-1.5 hover:bg-red-50 text-red-500 disabled:opacity-40"
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {e.status === 'REJECTED' && (
                    <span
                      className="shrink-0 px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
                      style={{ background: '#fee2e2', color: '#dc2626', fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Rechazado
                    </span>
                  )}
                </CardEl>
                );
              })}
            </div>

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  className="border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 transition-colors hover:border-[#F5C218]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </button>
                <span
                  className="px-3 py-1.5 text-sm font-bold"
                  style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Space Mono, monospace' }}
                >
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  className="border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 transition-colors hover:border-[#F5C218]"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating bulk assignment bar */}
      {bulkMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-4 px-6 py-4 shadow-2xl border-t border-[#F5C218]/30"
          style={{ background: '#1C1C1C' }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-['Space_Mono'] text-[#F5C218] text-sm">{selectedIds.size}</span>
            <span className="font-['DM_Sans'] text-gray-400 text-sm">gastos seleccionados</span>
          </div>
          <div className="flex-1 max-w-xs">
            <BatchItemSelect
              projectId={
                selectedProjectId !== 'all' &&
                projects.find((p) => p.id === selectedProjectId)?.batchesEnabled
                  ? selectedProjectId
                  : undefined
              }
              value={bulkItemId}
              onChange={setBulkItemId}
              required={false}
            />
          </div>
          <button
            onClick={applyBulkItem}
            disabled={bulkApplying || selectedIds.size === 0 || !bulkItemId}
            className="flex items-center gap-2 px-4 py-2 font-bold uppercase tracking-wide disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.875rem' }}
          >
            {bulkApplying
              ? <><span className="font-['Space_Mono'] text-xs">{bulkDone}/{selectedIds.size}</span> Aplicando…</>
              : <><Check className="w-4 h-4" /> Aplicar a {selectedIds.size}</>
            }
          </button>
          <button
            onClick={exitBulkMode}
            className="flex items-center gap-2 px-3 py-2 border border-gray-600 text-gray-400 hover:border-gray-400 transition-colors"
            style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem' }}
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
        </div>
      )}


      {/* MODAL PRE-IMPORTACIÓN EDITABLE */}
      {importModal && (() => {
        const invalidCount = editRows.filter((r) => !isRowValid(r)).length;
        const canConfirm   = editRows.length > 0 && invalidCount === 0;
        const iCls = 'w-full border border-gray-200 px-1.5 py-1 text-xs focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]';
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2">
            <div className="bg-white shadow-2xl w-full max-w-[96vw] max-h-[96vh] flex flex-col">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: '#1C1C1C' }}>
                <div>
                  <h2 className="text-lg uppercase tracking-widest text-white" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    Validar gastos antes de importar
                  </h2>
                  <p className="text-xs mt-0.5" style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}>
                    {editRows.length} filas · edita o elimina antes de confirmar
                    {invalidCount > 0 && <span className="text-red-400 ml-2">— {invalidCount} con errores</span>}
                  </p>
                </div>
                <button onClick={() => { setImportModal(false); setImportResult(null); }} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Result after import */}
              {importResult && (
                <div className="shrink-0">
                  <div className={`mx-5 mt-4 p-3 text-sm flex items-start gap-2 ${importResult.err === 0 ? 'bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218]' : 'bg-amber-50 text-amber-700'}`} style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    {importResult.err === 0
                      ? <><CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> {importResult.ok} gastos importados correctamente.</>
                      : <><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {importResult.ok} importados, {importResult.err} con error.</>
                    }
                  </div>
                  {importResult.err > 0 && (
                    <div className="mx-5 mt-2 max-h-32 overflow-y-auto border border-red-200 bg-red-50 text-xs p-2" style={{ fontFamily: 'Space Mono, monospace' }}>
                      {importResult.results.filter((r: any) => r.status === 'error').slice(0, 15).map((r: any) => (
                        <div key={r.index} className="text-red-700 py-0.5">Fila {r.index + 2}: {r.error}</div>
                      ))}
                      {importResult.results.filter((r: any) => r.status === 'error').length > 15 && (
                        <div className="text-red-400 pt-1">...y {importResult.results.filter((r: any) => r.status === 'error').length - 15} más</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Validation legend */}
              {!importResult && invalidCount > 0 && (
                <div className="shrink-0 mx-5 mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Las filas en rojo tienen fecha, proyecto o monto inválido. Corrígelas o elimínalas para poder importar.
                </div>
              )}

              {/* Editable table */}
              {!importResult && (
                <div className="overflow-auto flex-1 mt-3 px-5">
                  <table className="w-full text-xs border-collapse" style={{ minWidth: '900px' }}>
                    <thead className="sticky top-0 z-10">
                      <tr style={{ background: '#1C1C1C' }}>
                        {['FECHA', 'DESCRIPCIÓN', 'PROVEEDOR', 'CATEGORÍA', 'MONTO (RD$)', 'MÉTODO', 'PROYECTO', 'NOTAS', ''].map((h) => (
                          <th key={h} className="text-left px-2 py-2 font-semibold whitespace-nowrap" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#9ca3af', letterSpacing: '0.08em', fontSize: '10px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editRows.map((r) => {
                        const valid = isRowValid(r);
                        return (
                          <tr key={r._id} className={`border-b border-gray-100 ${valid ? 'bg-white hover:bg-gray-50' : 'bg-red-50'}`}>
                            <td className="px-1 py-1 w-28">
                              <input
                                type="date"
                                value={r.fecha}
                                onChange={(e) => updateEditRow(r._id, 'fecha', e.target.value)}
                                className={iCls + (r.fecha ? '' : ' border-red-400')}
                                style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px' }}
                              />
                            </td>
                            <td className="px-1 py-1 min-w-[160px]">
                              <input
                                type="text"
                                value={r.descripcion}
                                onChange={(e) => updateEditRow(r._id, 'descripcion', e.target.value)}
                                className={iCls}
                                style={{ fontFamily: 'DM Sans, sans-serif' }}
                              />
                            </td>
                            <td className="px-1 py-1 min-w-[110px]">
                              <input
                                type="text"
                                value={r.proveedor}
                                onChange={(e) => updateEditRow(r._id, 'proveedor', e.target.value)}
                                className={iCls}
                                style={{ fontFamily: 'DM Sans, sans-serif' }}
                              />
                            </td>
                            <td className="px-1 py-1 min-w-[110px]">
                              <input
                                type="text"
                                value={r.categoria}
                                onChange={(e) => updateEditRow(r._id, 'categoria', e.target.value)}
                                className={iCls}
                                style={{ fontFamily: 'DM Sans, sans-serif' }}
                              />
                            </td>
                            <td className="px-1 py-1 w-28">
                              <input
                                type="number"
                                value={r.monto}
                                onChange={(e) => updateEditRow(r._id, 'monto', e.target.value)}
                                className={iCls + (parseFloat(r.monto) > 0 ? '' : ' border-red-400')}
                                style={{ fontFamily: 'Space Mono, monospace', textAlign: 'right' }}
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-1 py-1 w-24">
                              <select
                                value={r.metodo_pago}
                                onChange={(e) => updateEditRow(r._id, 'metodo_pago', e.target.value)}
                                className={iCls}
                                style={{ fontFamily: 'DM Sans, sans-serif' }}
                              >
                                <option value="TRANSFER">Transfer.</option>
                                <option value="CASH">Efectivo</option>
                                <option value="CARD">Tarjeta</option>
                                <option value="CHECK">Cheque</option>
                                <option value="OTHER">Otro</option>
                              </select>
                            </td>
                            <td className="px-1 py-1 min-w-[130px]">
                              <input
                                type="text"
                                value={r.proyecto}
                                onChange={(e) => updateEditRow(r._id, 'proyecto', e.target.value)}
                                className={iCls + (r.proyecto.trim() ? '' : ' border-red-400')}
                                style={{ fontFamily: 'Space Mono, monospace', fontSize: '10px' }}
                              />
                            </td>
                            <td className="px-1 py-1 min-w-[100px]">
                              <input
                                type="text"
                                value={r.notas}
                                onChange={(e) => updateEditRow(r._id, 'notas', e.target.value)}
                                className={iCls}
                                style={{ fontFamily: 'DM Sans, sans-serif' }}
                                placeholder="opcional"
                              />
                            </td>
                            <td className="px-1 py-1 w-8 text-center">
                              <button
                                onClick={() => deleteEditRow(r._id)}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Eliminar fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {editRows.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                      No quedan filas. Cancela e importa un CSV con datos.
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex justify-between items-center shrink-0">
                <p className="text-xs text-gray-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {!importResult && `${editRows.length} fila${editRows.length !== 1 ? 's' : ''} · Las categorías nuevas se crean automáticamente`}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setImportModal(false); setImportResult(null); setEditRows([]); }}
                    className="border border-gray-200 px-4 py-2 text-sm hover:border-gray-400 transition-colors"
                    style={{ fontFamily: 'DM Sans, sans-serif', color: '#374151' }}
                  >
                    {importResult ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!importResult && (
                    <button
                      onClick={() => importMut.mutate(editRows.map((r) => ({
                        fecha:       r.fecha,
                        descripcion: r.descripcion,
                        proveedor:   r.proveedor   || undefined,
                        categoria:   r.categoria,
                        monto:       parseFloat(r.monto),
                        metodo_pago: r.metodo_pago,
                        proyecto:    r.proyecto,
                        notas:       r.notas       || undefined,
                      })))}
                      disabled={importMut.isPending || !canConfirm}
                      title={!canConfirm ? 'Corrige o elimina las filas con errores primero' : ''}
                      className="px-4 py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-40 transition-opacity hover:opacity-90"
                      style={{ background: canConfirm ? '#F5C218' : '#d1d5db', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif', cursor: canConfirm ? 'pointer' : 'not-allowed' }}
                    >
                      {importMut.isPending ? 'Importando...' : `Confirmar e importar ${editRows.length} gastos`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>

    {/* Reject reason modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-full max-w-md shadow-2xl">
            <div className="bg-[#1C1C1C] px-5 py-4 flex items-center justify-between">
              <h2 className="font-['Barlow_Condensed'] text-lg font-bold uppercase tracking-wide text-white">Motivo de rechazo</h2>
              <button onClick={() => setRejectTarget(null)} className="text-gray-400 hover:text-[#F5C218] text-xl leading-none">✕</button>
            </div>
            <div className="p-5">
              <textarea
                autoFocus
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Describe el motivo del rechazo..."
                className="w-full border border-gray-200 px-3 py-2 font-['DM_Sans'] text-sm focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setRejectTarget(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 font-['DM_Sans'] text-sm hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  disabled={!rejectReason.trim() || rejectMut.isPending}
                  onClick={() => rejectMut.mutate({ id: rejectTarget, reason: rejectReason.trim() })}
                  className="flex-1 bg-red-600 text-white py-2 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide hover:bg-red-700 disabled:opacity-40"
                >
                  {rejectMut.isPending ? 'Rechazando...' : 'Rechazar gasto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
