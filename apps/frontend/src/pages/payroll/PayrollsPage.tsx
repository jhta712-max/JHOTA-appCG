import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet, Plus, Search, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Ban, DollarSign, Filter,
} from 'lucide-react';
import { payrollApi, projectsApi, type Payroll } from '../../api';
import { useRole } from '../../hooks/useRole';
import { PAYROLL_LIST_STATUS_LABEL as STATUS_LABEL, PAYROLL_LIST_STATUS_COLOR as STATUS_COLOR } from '../../utils/statusLabels';
import { ListTableSkeleton } from '../../components/ui/ListTableSkeleton';
import { SkeletonBlock }     from '../../components/ui/Skeleton';

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
  const { canCreatePayroll } = useRole();

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
    <div className="space-y-0">

      {/* Hero Header */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-4 md:py-5"
        style={{ background: '#1C1C1C' }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-widest mb-1"
            style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}
          >
            MÓDULO / NÓMINAS
          </p>
          <h1
            className="text-3xl md:text-5xl uppercase tracking-widest text-white leading-none"
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
          >
            Nóminas
          </h1>
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: 'Space Mono, monospace', color: '#F5C218' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-28 bg-gray-600" />
              : `${total} nómina${total !== 1 ? 's' : ''} registrada${total !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        {canCreatePayroll && (
          <Link
            to="/payrolls/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
            style={{
              background: '#F5C218',
              color: '#1C1C1C',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            <Plus className="w-4 h-4" />
            Nueva Nómina
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por descripción, proyecto o número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              style={{ borderRadius: 0, fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 border text-sm font-medium transition-colors"
            style={
              showFilters
                ? { background: '#1C1C1C', color: '#F5C218', borderColor: '#1C1C1C', fontFamily: 'DM Sans, sans-serif', borderRadius: 0 }
                : { background: 'white', color: '#374151', borderColor: '#D1D5DB', fontFamily: 'DM Sans, sans-serif', borderRadius: 0 }
            }
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label
                className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                Proyecto
              </label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                style={{ borderRadius: 0, fontFamily: 'DM Sans, sans-serif' }}
              >
                <option value="">Todos los proyectos</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                style={{ borderRadius: 0, fontFamily: 'DM Sans, sans-serif' }}
              >
                <option value="">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="APPROVED">Aprobada</option>
                <option value="PAID">Pagada</option>
                <option value="VOIDED">Anulada</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
              >
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                style={{ borderRadius: 0, fontFamily: 'DM Sans, sans-serif' }}
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
      <div className="bg-white border border-gray-200 border-t-0 overflow-hidden">
        {isLoading ? (
          <ListTableSkeleton cols={7} rows={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
              style={{ background: '#1C1C1C' }}
            >
              <Wallet className="w-7 h-7" style={{ color: '#F5C218' }} />
            </div>
            <p
              className="text-xl uppercase tracking-widest text-gray-800 mb-1"
              style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
            >
              No hay nóminas registradas
            </p>
            {canCreatePayroll && (
              <Link
                to="/payrolls/new"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: '#F5C218', fontFamily: 'DM Sans, sans-serif' }}
              >
                <Plus className="w-4 h-4" /> Crear primera nómina
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((p) => (
                <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="font-bold text-sm" style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}>
                        NOM-{String(p.number).padStart(3, '0')}
                      </span>
                      {p.status === 'APPROVED' && (
                        <span className="ml-2 text-xs" style={{ color: '#F5C218', fontFamily: 'DM Sans, sans-serif' }}>
                          → Crear orden de pago
                        </span>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="font-medium text-gray-900 text-sm mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>{p.project.name}</p>
                  <p className="text-xs text-gray-400 mb-1" style={{ fontFamily: 'Space Mono, monospace' }}>{p.project.code}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-xs text-gray-500 mr-2" style={{ fontFamily: 'Space Mono, monospace' }}>
                        {p.periodStart.slice(0, 10)} → {p.periodEnd.slice(0, 10)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                        {TYPE_LABEL[p.type]}
                      </span>
                    </div>
                    <span className="font-bold text-sm" style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}>
                      RD$ {Number(p.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Link
                      to={`/payrolls/${p.id}`}
                      className="text-xs px-3 py-1.5 border border-gray-200 text-gray-700 transition-colors hover:border-yellow-400 hover:text-gray-900"
                      style={{ fontFamily: 'DM Sans, sans-serif', borderRadius: 0 }}
                    >
                      Ver detalle
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#1C1C1C' }}>
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Número
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Proyecto
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Período
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Tipo
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Total
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Estado
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-300"
                      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}
                    >
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className="font-bold text-sm"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}
                        >
                          NOM-{String(p.number).padStart(3, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          className="font-medium text-gray-900 truncate max-w-[160px]"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {p.project.name}
                        </p>
                        <p
                          className="text-xs text-gray-400"
                          style={{ fontFamily: 'Space Mono, monospace' }}
                        >
                          {p.project.code}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="text-xs text-gray-600"
                          style={{ fontFamily: 'Space Mono, monospace' }}
                        >
                          {p.periodStart.slice(0, 10)}
                          <span className="text-gray-400 mx-1">→</span>
                          {p.periodEnd.slice(0, 10)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {TYPE_LABEL[p.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className="font-bold text-sm"
                          style={{ fontFamily: 'Space Mono, monospace', color: '#1C1C1C' }}
                        >
                          RD$ {Number(p.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {p.status === 'APPROVED' && (
                            <span
                              className="text-xs hidden sm:inline"
                              style={{ color: '#F5C218', fontFamily: 'DM Sans, sans-serif' }}
                            >
                              → Crear orden de pago
                            </span>
                          )}
                          <Link
                            to={`/payrolls/${p.id}`}
                            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-700 transition-colors hover:border-yellow-400 hover:text-gray-900"
                            style={{ fontFamily: 'DM Sans, sans-serif', borderRadius: 0 }}
                          >
                            Ver detalle
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <span
                  className="text-sm text-gray-500"
                  style={{ fontFamily: 'Space Mono, monospace' }}
                >
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1.5 border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ borderRadius: 0 }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ borderRadius: 0 }}
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
