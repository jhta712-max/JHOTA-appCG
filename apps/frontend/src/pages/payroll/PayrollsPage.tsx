import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet, Plus, Search, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Ban, DollarSign, Filter,
} from 'lucide-react';
import { payrollApi, projectsApi, type Payroll } from '../../api';
import { useAuthStore } from '../../stores/authStore';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAID:     'bg-green-100 text-green-700',
  VOIDED:   'bg-red-100 text-red-700',
};
const TYPE_LABEL: Record<string, string> = { LABOR: 'Mano de obra', SERVICE: 'Servicios' };

function StatusBadge({ status }: { status: string }) {
  const icons: Record<string, JSX.Element> = {
    DRAFT:    <Clock className="w-3 h-3" />,
    APPROVED: <CheckCircle className="w-3 h-3" />,
    PAID:     <DollarSign className="w-3 h-3" />,
    VOIDED:   <Ban className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {icons[status]}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function PayrollsPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus]       = useState('');
  const [type, setType]           = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const params: Record<string, unknown> = { page, limit: 20 };
  if (projectId) params.projectId = projectId;
  if (status)    params.status    = status;
  if (type)      params.type      = type;

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['payrolls', params],
    queryFn:  () => payrollApi.list(params),
    select:   (r) => r.data,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-full-list'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => (r.data?.data ?? []) as any[],
    staleTime: 0,
  });

  const payrolls: Payroll[] = payrollData?.data ?? [];
  const total      = payrollData?.pagination?.total ?? 0;
  const totalPages = payrollData?.pagination?.totalPages ?? 1;

  // Client-side name search
  const filtered = search
    ? payrolls.filter((p) =>
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.project.name.toLowerCase().includes(search.toLowerCase()) ||
        `NOM-${String(p.number).padStart(3, '0')}`.includes(search.toUpperCase()),
      )
    : payrolls;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: '#F5C218' }} />
            Nóminas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} nómina{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/payrolls/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 transition-colors hover:opacity-90"
            style={{ background: '#F5C218' }}
          >
            <Plus className="w-4 h-4" />
            Nueva Nómina
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por descripción, proyecto o número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proyecto</label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Todos los proyectos</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="APPROVED">Aprobada</option>
                <option value="PAID">Pagada</option>
                <option value="VOIDED">Anulada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Todos los tipos</option>
                <option value="LABOR">Mano de obra</option>
                <option value="SERVICE">Servicios</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando nóminas…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay nóminas registradas</p>
            {isAdmin && (
              <Link to="/payrolls/new" className="mt-3 inline-flex items-center gap-1 text-sm font-medium" style={{ color: '#F5C218' }}>
                <Plus className="w-4 h-4" /> Crear primera nómina
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Período</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-gray-800">
                          NOM-{String(p.number).padStart(3, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">{p.project.name}</p>
                        <p className="text-xs text-gray-400">{p.project.code}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {p.periodStart.slice(0, 10)}
                        <span className="text-gray-400 mx-1">→</span>
                        {p.periodEnd.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {TYPE_LABEL[p.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        RD$ {Number(p.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/payrolls/${p.id}`}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>Página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
