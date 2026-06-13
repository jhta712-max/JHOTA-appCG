import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Upload, X, CheckCircle, AlertCircle, ArrowUpDown, Filter } from 'lucide-react';
import { expensesApi, projectsApi, categoriesApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../types';
import { ExpenseListSkeleton } from '../../components/ui/ExpenseListSkeleton';
import { SkeletonBlock }       from '../../components/ui/Skeleton';
import { fmtDate } from '../../utils/date';
import api from '../../api/client';
import { useRole } from '../../hooks/useRole';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return obj;
  }).filter((r) => r.fecha && r.monto);
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { canCreateExpense } = useRole();
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

  const fileRef = useRef<HTMLInputElement>(null);
  const [importRows,   setImportRows]   = useState<any[]>([]);
  const [importModal,  setImportModal]  = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; err: number; results: any[] } | null>(null);

  const importMut = useMutation({
    mutationFn: (rows: any[]) => api.post('/expenses/bulk-import', { rows }).then((r) => r.data.data),
    onSuccess: (data) => { setImportResult(data); qc.invalidateQueries({ queryKey: ['expenses'] }); },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text).map((r) => ({
        fecha: r.fecha, descripcion: r.descripcion, proveedor: r.proveedor || undefined,
        categoria: r.categoria, monto: parseFloat(r.monto), metodo_pago: r.metodo_pago || 'CASH',
        proyecto: r.proyecto, notas: r.notas || undefined,
      }));
      setImportRows(rows); setImportResult(null); setImportModal(true);
    };
    reader.readAsText(file, 'utf-8');
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

  const expenses   = data?.data ?? [];
  const pagination = data?.pagination;
  const projects   = projectsData ?? [];

  const tabTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
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
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border transition-colors"
              style={{ fontFamily: 'DM Sans, sans-serif', borderColor: '#4b5563', color: '#d1d5db', fontSize: '0.875rem' }}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#F5C218'; (ev.currentTarget as HTMLButtonElement).style.color = '#F5C218'; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.borderColor = '#4b5563'; (ev.currentTarget as HTMLButtonElement).style.color = '#d1d5db'; }}
            >
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
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
              {expenses.map((e) => (
                <Link
                  key={e.id}
                  to={`/expenses/${e.id}`}
                  className="bg-white border border-gray-100 hover:border-[#F5C218] p-4 flex items-center gap-3 group transition-colors"
                >
                  <div
                    className="w-1 self-stretch shrink-0"
                    style={{ background: e.status === 'VOIDED' ? '#ef4444' : '#22c55e' }}
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
                </Link>
              ))}
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

      {/* MODAL IMPORTACIÓN CSV */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ background: '#1C1C1C' }}
            >
              <div>
                <h2
                  className="text-lg uppercase tracking-widest text-white"
                  style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                >
                  Importar gastos desde CSV
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
                >
                  {importRows.length} registros detectados
                </p>
              </div>
              <button
                onClick={() => { setImportModal(false); setImportResult(null); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importResult && (
              <div
                className={`mx-5 mt-4 p-3 text-sm flex items-center gap-2 ${
                  importResult.err === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {importResult.err === 0
                  ? <><CheckCircle className="w-4 h-4 shrink-0" /> {importResult.ok} gastos importados correctamente.</>
                  : <><AlertCircle className="w-4 h-4 shrink-0" /> {importResult.ok} importados, {importResult.err} con error.</>
                }
              </div>
            )}

            {!importResult && (
              <div className="overflow-auto flex-1 px-5 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: '#1C1C1C' }}>
                      <th
                        className="text-left px-3 py-2 font-semibold"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#d1d5db', letterSpacing: '0.05em' }}
                      >
                        FECHA
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#d1d5db', letterSpacing: '0.05em' }}
                      >
                        PROVEEDOR
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#d1d5db', letterSpacing: '0.05em' }}
                      >
                        DESCRIPCIÓN
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#d1d5db', letterSpacing: '0.05em' }}
                      >
                        CATEGORÍA
                      </th>
                      <th
                        className="text-right px-3 py-2 font-semibold"
                        style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#d1d5db', letterSpacing: '0.05em' }}
                      >
                        MONTO
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td
                          className="px-3 py-1.5 text-gray-700"
                          style={{ fontFamily: 'Space Mono, monospace' }}
                        >
                          {r.fecha}
                        </td>
                        <td
                          className="px-3 py-1.5 text-gray-700 max-w-[120px] truncate"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {r.proveedor}
                        </td>
                        <td
                          className="px-3 py-1.5 text-gray-700 max-w-[160px] truncate"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {r.descripcion}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className="px-1.5 py-0.5 text-xs font-medium"
                            style={{ background: '#eff6ff', color: '#1d4ed8', fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {r.categoria}
                          </span>
                        </td>
                        <td
                          className="px-3 py-1.5 text-right font-bold"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}
                        >
                          {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 20 && (
                  <p
                    className="text-xs text-gray-400 text-center mt-3"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Mostrando 20 de {importRows.length} — todos serán importados
                  </p>
                )}
              </div>
            )}

            <div className="p-5 border-t border-gray-100 flex justify-between items-center">
              <p
                className="text-xs text-gray-400"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                Las categorías nuevas se crean automáticamente
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setImportModal(false); setImportResult(null); }}
                  className="border border-gray-300 px-4 py-2 text-sm transition-colors hover:border-gray-400"
                  style={{ fontFamily: 'DM Sans, sans-serif', color: '#374151' }}
                >
                  {importResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!importResult && (
                  <button
                    onClick={() => importMut.mutate(importRows)}
                    disabled={importMut.isPending}
                    className="px-4 py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-60 transition-opacity hover:opacity-90"
                    style={{ background: '#F5C218', color: '#1C1C1C', fontFamily: 'Barlow Condensed, sans-serif' }}
                  >
                    {importMut.isPending ? 'Importando...' : `Importar ${importRows.length} gastos`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
