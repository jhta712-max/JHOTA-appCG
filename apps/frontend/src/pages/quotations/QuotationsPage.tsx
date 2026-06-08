import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Search, Filter, ChevronRight, AlertCircle } from 'lucide-react';
import { quotationsApi, projectsApi } from '../../api';
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_COLORS,
  type QuotationStatus,
} from '../../types/quotation';
import { fmtDate } from '../../utils/date';
import { useRole } from '../../hooks/useRole';

function fmt(n: number, currency = 'DOP') {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(n);
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',                label: 'Todos los estados' },
  { value: 'PENDING',         label: 'Pendiente' },
  { value: 'APPROVED',        label: 'Aprobada' },
  { value: 'ADVANCE_PAID',    label: 'Anticipo pagado' },
  { value: 'IN_PROGRESS',     label: 'En proceso' },
  { value: 'PARTIAL_INVOICED',label: 'Parcialmente facturada' },
  { value: 'INVOICED',        label: 'Facturada' },
  { value: 'PAID',            label: 'Pagada' },
  { value: 'CANCELLED',       label: 'Cancelada' },
];

export default function QuotationsPage() {
  const { canCreateQuotation } = useRole();
  const [search,    setSearch]    = useState('');
  const [projectId, setProjectId] = useState('');
  const [status,    setStatus]    = useState('');
  const [overdue,   setOverdue]   = useState(false);
  const [page,      setPage]      = useState(1);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'select'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => r.data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', search, projectId, status, overdue, page],
    queryFn:  () => quotationsApi.list({
      search:    search    || undefined,
      projectId: projectId || undefined,
      status:    (!overdue && status) ? status : undefined,
      overdue:   overdue   || undefined,
      page,
      limit: 20,
    }),
    select: (r) => r.data,
  });

  const quotations = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">MÓDULO / COTIZACIONES</p>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination?.total ?? 0} cotizaciones registradas</p>
        </div>
        {canCreateQuotation && (
          <Link to="/quotations/new" className="smi-btn text-sm">
            <Plus className="w-4 h-4" /> Nueva
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Filter className="w-4 h-4" /> Filtros
          </div>
          {/* Filtro rápido: vencidas sin respuesta */}
          <button
            onClick={() => { setOverdue(v => !v); setStatus(''); setPage(1); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              overdue
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Vencidas sin respuesta
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar suplidor, número..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input-field" value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setPage(1); }}>
            <option value="">Todos los proyectos</option>
            {(projectsData ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select className="input-field" value={overdue ? '' : status}
            disabled={overdue}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {overdue && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            Mostrando cotizaciones con fecha de validez vencida que aún están en estado abierto.
          </p>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando cotizaciones...</div>
      ) : quotations.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay cotizaciones registradas</p>
          <p className="text-sm text-gray-400 mt-1">Crea la primera cotización para comenzar</p>
          {canCreateQuotation && (
            <Link to="/quotations/new" className="btn-primary mt-4 inline-flex">
              <Plus className="w-4 h-4" /> Nueva cotización
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {quotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}`}
                className="card p-4 flex items-center gap-3 hover:border-primary-200 hover:shadow-sm transition-all group">

                {/* Indicador estado */}
                <div className={`w-2 h-12 rounded-full shrink-0 ${
                  q.status === 'PAID'      ? 'bg-green-400' :
                  q.status === 'CANCELLED' ? 'bg-red-300'   :
                  q.status === 'PENDING'   ? 'bg-gray-300'  :
                  'bg-amber-400'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-700">
                      {q.supplierName}
                    </p>
                    {q.quotationNumber && (
                      <span className="text-xs text-gray-400 font-mono">#{q.quotationNumber}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {q.project.code} · {q.description.slice(0, 60)}{q.description.length > 60 ? '…' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(q.quotationDate)}
                    {q._count && q._count.payments > 0 && (
                      <span className="ml-2 text-amber-600">{q._count.payments} pago(s)</span>
                    )}
                    {q._count && q._count.expenseLinks > 0 && (
                      <span className="ml-2 text-blue-500">{q._count.expenseLinks} factura(s)</span>
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-bold text-gray-900">
                    {fmt(Number(q.total), q.currency)}
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    QUOTATION_STATUS_COLORS[q.status as QuotationStatus]
                  }`}>
                    {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-gray-400" />
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className="btn-secondary text-sm px-3 py-2"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage(p => p - 1)}>Anterior</button>
              <span className="text-sm text-gray-600">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button className="btn-secondary text-sm px-3 py-2"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(p => p + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
