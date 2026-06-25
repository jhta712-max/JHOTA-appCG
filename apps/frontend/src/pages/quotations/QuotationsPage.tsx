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
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { SkeletonBlock }        from '../../components/ui/Skeleton';

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

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'PAID':      return 'bg-green-900 text-green-300 border border-green-700';
    case 'APPROVED':  return 'bg-green-900 text-green-300 border border-green-700';
    case 'CANCELLED': return 'bg-red-900 text-red-300 border border-red-700';
    case 'PENDING':   return 'bg-[#F5C218]/20 text-[#F5C218] border border-[#F5C218]/40';
    default:          return 'bg-zinc-700 text-zinc-200 border border-zinc-600';
  }
}

function statusBarClass(status: string): string {
  switch (status) {
    case 'PAID':      return 'bg-green-400';
    case 'APPROVED':  return 'bg-green-400';
    case 'CANCELLED': return 'bg-red-400';
    case 'PENDING':   return 'bg-[#F5C218]';
    default:          return 'bg-amber-400';
  }
}

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
    <div className="space-y-0 font-['DM_Sans']">

      {/* Hero Header */}
      <div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5 -mx-4 sm:-mx-6 lg:-mx-8 mb-6">
        <div className="max-w-full">
          <p className="font-['Barlow_Condensed'] text-[#F5C218] text-xs font-semibold tracking-[0.2em] uppercase mb-1">
            MÓDULO / COTIZACIONES
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-['Barlow_Condensed'] text-white text-3xl md:text-5xl font-bold tracking-tight leading-none uppercase">
                COTIZACIONES
              </h1>
              <p className="text-zinc-400 text-sm mt-2 font-['DM_Sans'] h-5 flex items-center">
                {isLoading
                  ? <SkeletonBlock className="h-4 w-32 bg-gray-600" />
                  : <><span className="font-['Space_Mono'] text-[#F5C218]">{pagination?.total ?? 0}</span>{' '}cotizaciones registradas</>
                }
              </p>
            </div>
            {canCreateQuotation && (
              <Link
                to="/quotations/new"
                className="inline-flex items-center gap-2 bg-[#F5C218] hover:bg-yellow-400 text-[#1C1C1C] font-['Barlow_Condensed'] font-bold text-sm tracking-wider uppercase px-5 py-2.5 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                NUEVA COTIZACIÓN
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-zinc-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
              FILTROS
            </span>
          </div>
          <button
            onClick={() => { setOverdue(v => !v); setStatus(''); setPage(1); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-colors font-['DM_Sans'] ${
              overdue
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-white border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Vencidas sin respuesta
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              className="w-full border border-zinc-200 pl-9 pr-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-[#F5C218] font-['DM_Sans'] transition-colors"
              placeholder="Buscar suplidor, número..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="w-full border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-[#F5C218] font-['DM_Sans'] bg-white transition-colors"
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
          >
            <option value="">Todos los proyectos</option>
            {(projectsData ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <select
            className="w-full border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-[#F5C218] font-['DM_Sans'] bg-white transition-colors disabled:opacity-50"
            value={overdue ? '' : status}
            disabled={overdue}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {overdue && (
          <p className="text-xs text-red-600 flex items-center gap-1 mt-3 font-['DM_Sans']">
            <AlertCircle className="w-3 h-3 shrink-0" />
            Mostrando cotizaciones con fecha de validez vencida que aún están en estado abierto.
          </p>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <ProjectListSkeleton />
      ) : quotations.length === 0 ? (
        <div className="bg-white border border-zinc-200 py-16 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#F5C218]/10 border border-[#F5C218]/30 mb-4">
            <FileText className="w-7 h-7 text-[#F5C218]" />
          </div>
          <p className="font-['Barlow_Condensed'] text-zinc-800 text-xl font-bold uppercase tracking-wide mb-1">
            Sin cotizaciones
          </p>
          <p className="text-zinc-400 text-sm font-['DM_Sans']">
            {overdue ? 'No hay cotizaciones vencidas sin respuesta.' : 'Crea la primera cotización para comenzar.'}
          </p>
          {canCreateQuotation && !overdue && (
            <Link
              to="/quotations/new"
              className="inline-flex items-center gap-2 mt-5 bg-[#F5C218] hover:bg-yellow-400 text-[#1C1C1C] font-['Barlow_Condensed'] font-bold text-sm tracking-wider uppercase px-5 py-2.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              NUEVA COTIZACIÓN
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {quotations.map((q) => (
              <Link
                key={q.id}
                to={`/quotations/${q.id}`}
                className="bg-white border border-zinc-200 hover:border-[#F5C218]/60 hover:shadow-sm flex items-center gap-0 transition-all group block"
              >
                {/* Status bar */}
                <div className={`w-1 self-stretch shrink-0 ${statusBarClass(q.status)}`} />

                <div className="flex items-center gap-4 flex-1 min-w-0 px-5 py-4">
                  {/* Quotation number badge */}
                  <div className="shrink-0">
                    {q.quotationNumber ? (
                      <span className="inline-flex items-center bg-[#1C1C1C] px-2.5 py-1 font-['Space_Mono'] text-[#F5C218] text-xs tracking-wider">
                        #{q.quotationNumber}
                      </span>
                    ) : (
                      <span className="inline-flex items-center bg-zinc-100 px-2.5 py-1 font-['Space_Mono'] text-zinc-400 text-xs">
                        —
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-['Barlow_Condensed'] text-lg font-bold text-zinc-900 leading-tight group-hover:text-[#1C1C1C] truncate tracking-wide">
                      {q.supplierName}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate font-['DM_Sans']">
                      <span className="font-['Space_Mono'] text-zinc-500">{q.project.code}</span>
                      {' · '}
                      {q.description.slice(0, 60)}{q.description.length > 60 ? '…' : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-400 font-['DM_Sans']">{fmtDate(q.quotationDate)}</span>
                      {q._count && q._count.payments > 0 && (
                        <span className="text-xs text-amber-600 font-['DM_Sans']">
                          {q._count.payments} pago(s)
                        </span>
                      )}
                      {q._count && q._count.expenseLinks > 0 && (
                        <span className="text-xs text-blue-500 font-['DM_Sans']">
                          {q._count.expenseLinks} factura(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount + status */}
                <div className="shrink-0 text-right px-5 py-4 border-l border-zinc-100">
                  <p className="font-['Space_Mono'] text-base font-bold text-zinc-900 leading-tight">
                    {fmt(Number(q.total), q.currency)}
                  </p>
                  <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 text-xs font-['Barlow_Condensed'] font-semibold tracking-wide uppercase ${statusBadgeClass(q.status)}`}>
                    {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                  </span>
                </div>

                <div className="px-3 shrink-0">
                  <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-[#F5C218] transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                className="font-['Barlow_Condensed'] text-sm font-bold tracking-wider uppercase px-5 py-2 border border-zinc-300 text-zinc-600 hover:border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage(p => p - 1)}
              >
                ← ANTERIOR
              </button>
              <span className="font-['Space_Mono'] text-sm text-zinc-500">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className="font-['Barlow_Condensed'] text-sm font-bold tracking-wider uppercase px-5 py-2 border border-zinc-300 text-zinc-600 hover:border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(p => p + 1)}
              >
                SIGUIENTE →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
