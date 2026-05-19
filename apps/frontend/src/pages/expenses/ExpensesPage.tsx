import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Plus, Search, Filter } from 'lucide-react';
import { expensesApi, projectsApi } from '../../api';
import { PAYMENT_METHOD_LABELS } from '../../types';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

export default function ExpensesPage() {
  const [search,    setSearch]    = useState('');
  const [projectId, setProjectId] = useState('');
  const [status,    setStatus]    = useState('ACTIVE');
  const [page,      setPage]      = useState(1);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, projectId, status, page],
    queryFn:  () => expensesApi.list({
      search: search || undefined,
      projectId: projectId || undefined,
      status: status || undefined,
      page,
      limit: 20,
    }),
    select: (r) => r.data,
  });

  const expenses = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500">{pagination?.total ?? 0} gastos registrados</p>
        </div>
        <Link to="/expenses/new" className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Nuevo
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input-field" value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setPage(1); }}>
            <option value="">Todos los proyectos</option>
            {(projectsData ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select className="input-field" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="VOIDED">Anulados</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando gastos...</div>
      ) : expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay gastos registrados</p>
          <Link to="/expenses/new" className="btn-primary mt-4 inline-flex">Registrar primer gasto</Link>
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
                    {e.project.code} · {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                    {e.hasFiscalDoc && <span className="ml-1 text-blue-500">· NCF</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(Number(e.amount))}</p>
                  <p className="text-xs text-gray-400">{new Date(e.expenseDate).toLocaleDateString('es-DO')}</p>
                </div>
                {e.status === 'VOIDED' && (
                  <span className="badge-voided shrink-0">Anulado</span>
                )}
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
    </div>
  );
}
