import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { expensesApi, projectsApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../types';
import { fmtDate } from '../../utils/date';
import api from '../../api/client';
import { useRole } from '../../hooks/useRole';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

// ── CSV parser ────────────────────────────────────────────────
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
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('ACTIVE');
  const [page,     setPage]     = useState(1);

  // Import state
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

  // Proyectos para tabs
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  // Gastos filtrados
  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, selectedProjectId, status, page],
    queryFn:  () => expensesApi.list({
      search:    search || undefined,
      projectId: selectedProjectId !== 'all' ? selectedProjectId : undefined,
      status:    status || undefined,
      page,
      limit: 30,
    }),
    select: (r) => r.data,
  });

  const expenses   = data?.data ?? [];
  const pagination = data?.pagination;
  const projects   = projectsData ?? [];

  // Total del proyecto seleccionado (para mostrar en tab)
  const tabTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">MÓDULO / GASTOS</p>
          <h1 className="page-title">Gastos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} gastos registrados</p>
        </div>
        {canCreateExpense && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
            <Link to="/expenses/new" className="smi-btn">
              <Plus className="w-4 h-4" /> Nuevo Gasto
            </Link>
          </div>
        )}
      </div>

      {/* Tabs por proyecto */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        <button
          onClick={() => { setSelectedProjectId('all'); setPage(1); }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            selectedProjectId === 'all'
              ? 'border-primary-600 text-primary-700 bg-primary-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Todos
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedProjectId(p.id); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors max-w-[200px] truncate ${
              selectedProjectId === p.id
                ? 'border-primary-600 text-primary-700 bg-primary-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            title={p.name}
          >
            {p.code}
          </button>
        ))}
      </div>

      {/* Info del proyecto seleccionado */}
      {selectedProjectId !== 'all' && (() => {
        const p = projects.find((x) => x.id === selectedProjectId);
        return p ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">{p.name}</p>
              <p className="text-xs text-blue-600">{p.code} · {p.client ?? 'Sin cliente'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-500">Total en vista</p>
              <p className="text-sm font-bold text-blue-900">{formatCurrency(tabTotal)}</p>
            </div>
          </div>
        ) : null;
      })()}

      {/* Filtros secundarios */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="Buscar descripción..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field w-auto" value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="VOIDED">Anulados</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando gastos...</div>
      ) : expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay gastos registrados</p>
          {canCreateExpense && <Link to="/expenses/new" className="btn-primary mt-4 inline-flex">Registrar primer gasto</Link>}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {expenses.map((e) => (
              <Link key={e.id} to={`/expenses/${e.id}`}
                className="card p-4 flex items-center gap-3 hover:border-primary-200 hover:shadow-sm transition-all group">
                <div className={`w-2 h-10 rounded-full shrink-0 ${e.status === 'VOIDED' ? 'bg-red-300' : 'bg-green-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{e.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedProjectId === 'all' && <span className="font-medium text-gray-500">{e.project.code} · </span>}
                    {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                    {e.hasFiscalDoc && <span className="ml-1 text-blue-500">· NCF</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(e.amount))}</p>
                  <p className="text-xs text-gray-400">{fmtDate(e.expenseDate)}</p>
                </div>
                {e.status === 'VOIDED' && <span className="badge-voided shrink-0">Anulado</span>}
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className="btn-secondary text-sm px-3 py-2" disabled={!pagination.hasPrevPage}
                onClick={() => setPage(p => p - 1)}>Anterior</button>
              <span className="text-sm text-gray-600">Página {pagination.page} de {pagination.totalPages}</span>
              <button className="btn-secondary text-sm px-3 py-2" disabled={!pagination.hasNextPage}
                onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}

      {/* MODAL IMPORTACIÓN CSV */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Importar gastos desde CSV</h2>
                <p className="text-sm text-gray-500">{importRows.length} registros detectados</p>
              </div>
              <button onClick={() => { setImportModal(false); setImportResult(null); }}
                className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            {importResult && (
              <div className={`mx-5 mt-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
                importResult.err === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {importResult.err === 0
                  ? <><CheckCircle className="w-4 h-4 shrink-0" /> {importResult.ok} gastos importados.</>
                  : <><AlertCircle className="w-4 h-4 shrink-0" /> {importResult.ok} importados, {importResult.err} con error.</>
                }
              </div>
            )}
            {!importResult && (
              <div className="overflow-auto flex-1 px-5 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Fecha</th>
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Proveedor</th>
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Descripción</th>
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Categoría</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-700">{r.fecha}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{r.proveedor}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[160px] truncate">{r.descripcion}</td>
                        <td className="px-2 py-1.5"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{r.categoria}</span></td>
                        <td className="px-2 py-1.5 text-right font-medium text-gray-900">
                          {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 20 && (
                  <p className="text-xs text-gray-400 text-center mt-2">Mostrando 20 de {importRows.length} — todos serán importados</p>
                )}
              </div>
            )}
            <div className="p-5 border-t border-gray-100 flex justify-between items-center">
              <p className="text-xs text-gray-400">Las categorías nuevas se crean automáticamente</p>
              <div className="flex gap-3">
                <button onClick={() => { setImportModal(false); setImportResult(null); }} className="btn-secondary">
                  {importResult ? 'Cerrar' : 'Cancelar'}
                </button>
                {!importResult && (
                  <button onClick={() => importMut.mutate(importRows)} disabled={importMut.isPending} className="btn-primary">
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
