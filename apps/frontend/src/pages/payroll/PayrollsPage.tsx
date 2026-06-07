import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet, Plus, Search, ChevronLeft, ChevronRight,
  CheckCircle, Clock, Ban, DollarSign, Filter,
} from 'lucide-react';
import { payrollApi, projectsApi, type Payroll } from '../../api';
import { useRole } from '../../hooks/useRole';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
};
const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  DRAFT:    { bg: 'rgba(156,163,175,0.15)', color: '#6b7280',  dot: '#9ca3af' },
  APPROVED: { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb',  dot: '#3b82f6' },
  PAID:     { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a',  dot: '#22c55e' },
  VOIDED:   { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626',  dot: '#ef4444' },
};
const TYPE_LABEL: Record<string, string> = { LABOR: 'Mano de obra', SERVICE: 'Servicios' };

function StatusBadge({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    DRAFT:    <Clock style={{ width: '11px', height: '11px' }} />,
    APPROVED: <CheckCircle style={{ width: '11px', height: '11px' }} />,
    PAID:     <DollarSign style={{ width: '11px', height: '11px' }} />,
    VOIDED:   <Ban style={{ width: '11px', height: '11px' }} />,
  };
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: s.bg, color: s.color,
                    fontFamily: BODY, fontSize: '0.72rem', fontWeight: 600,
                    borderRadius: '4px', padding: '2px 8px' }}>
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

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

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

  const filtered = search
    ? payrolls.filter((p) =>
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.project.name.toLowerCase().includes(search.toLowerCase()) ||
        `NOM-${String(p.number).padStart(3, '0')}`.includes(search.toUpperCase()),
      )
    : payrolls;

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes nom-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .nom-up   { animation: nom-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .nom-up-1 { animation: nom-up 0.4s 0.07s cubic-bezier(.2,.8,.2,1) both; }
        .nom-row { transition: background 0.12s; }
        .nom-row:hover { background: #f9fafb; }
        .nom-ctrl {
          border: 1px solid #374151;
          border-radius: 7px;
          background: transparent;
          padding: 0.45rem 0.85rem;
          font-size: 0.78rem;
          font-family: ${BODY};
          color: #d1d5db;
          outline: none;
          transition: border-color 0.15s;
        }
        .nom-ctrl:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
        .nom-ctrl option { background: #1C1C1C; color: #fff; }
        .nom-ctrl-white {
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          background: #fff;
          padding: 0.45rem 0.85rem;
          font-size: 0.78rem;
          font-family: ${BODY};
          color: #374151;
          outline: none;
          transition: border-color 0.15s;
        }
        .nom-ctrl-white:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
      `}</style>

      {/* Hero band */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 2rem' }} className="nom-up">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                MÓDULO / NÓMINAS
              </p>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)',
                            color: '#fff', lineHeight: 1.0, letterSpacing: '-0.01em', margin: 0 }}>
                NÓMINAS
              </h1>
              <p style={{ fontFamily: BODY, fontSize: '0.82rem', color: '#666', marginTop: '0.4rem' }}>
                {total} nómina{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
              </p>
            </div>
            {canCreatePayroll && (
              <Link to="/payrolls/new"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px',
                           background: B.yellow, color: B.dark,
                           fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em',
                           padding: '0.65rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}
                className="hover:opacity-90 transition-opacity">
                <Plus style={{ width: '16px', height: '16px' }} />
                NUEVA NÓMINA
              </Link>
            )}
          </div>

          {/* Search + filter toggle */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }} className="nom-up-1">
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                width: '14px', height: '14px', color: '#6b7280' }} />
              <input
                className="nom-ctrl"
                style={{ width: '100%', paddingLeft: '2rem', boxSizing: 'border-box' }}
                placeholder="Buscar por descripción, proyecto o número..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px',
                         background: showFilters ? B.yellow : 'transparent',
                         color: showFilters ? B.dark : '#9ca3af',
                         border: `1px solid ${showFilters ? B.yellow : '#374151'}`,
                         borderRadius: '7px', padding: '0.45rem 1rem',
                         fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
              <Filter style={{ width: '13px', height: '13px' }} />
              Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontFamily: BODY, fontSize: '0.7rem', fontWeight: 600, color: '#6b7280',
                               textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Proyecto</label>
              <select className="nom-ctrl-white" style={{ width: '100%' }}
                value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(1); }}>
                <option value="">Todos los proyectos</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontFamily: BODY, fontSize: '0.7rem', fontWeight: 600, color: '#6b7280',
                               textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Estado</label>
              <select className="nom-ctrl-white" style={{ width: '100%' }}
                value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="APPROVED">Aprobada</option>
                <option value="PAID">Pagada</option>
                <option value="VOIDED">Anulada</option>
              </select>
            </div>
            <div>
              <label style={{ fontFamily: BODY, fontSize: '0.7rem', fontWeight: 600, color: '#6b7280',
                               textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Tipo</label>
              <select className="nom-ctrl-white" style={{ width: '100%' }}
                value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="">Todos los tipos</option>
                <option value="LABOR">Mano de obra</option>
                <option value="SERVICE">Servicios</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: MONO, fontSize: '0.72rem', color: '#9ca3af', letterSpacing: '0.08em' }}>
              CARGANDO…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Wallet style={{ width: '32px', height: '32px', color: '#d1d5db', margin: '0 auto 0.75rem' }} />
              <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '1rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
                NO HAY NÓMINAS
              </p>
              {canCreatePayroll && (
                <Link to="/payrolls/new"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '1rem',
                             background: B.yellow, color: B.dark, fontFamily: DISPLAY, fontWeight: 800,
                             fontSize: '0.82rem', letterSpacing: '0.05em',
                             padding: '0.55rem 1rem', borderRadius: '7px', textDecoration: 'none' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Crear primera nómina
                </Link>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: B.dark, borderBottom: `2px solid ${B.yellow}` }}>
                      {['Número', 'Proyecto', 'Período', 'Tipo', 'Total', 'Estado', ''].map((h, i) => (
                        <th key={i} style={{ padding: '0.75rem 1rem',
                                              textAlign: i >= 4 ? (i === 4 ? 'right' : i === 5 ? 'center' : 'right') : 'left',
                                              fontFamily: MONO, fontSize: '0.62rem', color: '#888',
                                              fontWeight: 400, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="nom-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark }}>
                            NOM-{String(p.number).padStart(3, '0')}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark,
                                       margin: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.project.name}
                          </p>
                          <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', margin: 0 }}>
                            {p.project.code}
                          </p>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontFamily: MONO, fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {p.periodStart.slice(0, 10)}
                          <span style={{ color: '#d1d5db', margin: '0 4px' }}>→</span>
                          {p.periodEnd.slice(0, 10)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#6b7280',
                                          background: '#f3f4f6', borderRadius: '4px', padding: '2px 8px' }}>
                            {TYPE_LABEL[p.type]}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark }}>
                            RD$ {Number(p.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <StatusBadge status={p.status} />
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <Link to={`/payrolls/${p.id}`}
                            style={{ fontFamily: BODY, fontSize: '0.75rem', fontWeight: 600,
                                       color: B.dark, background: B.yellow,
                                       padding: '0.4rem 0.9rem', borderRadius: '6px',
                                       textDecoration: 'none', whiteSpace: 'nowrap',
                                       transition: 'opacity 0.15s' }}
                            className="hover:opacity-80">
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f3f4f6',
                               display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af' }}>
                    PÁGINA {page} / {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
                                 padding: '0.35rem 0.6rem', cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                 opacity: page <= 1 ? 0.4 : 1 }}>
                      <ChevronLeft style={{ width: '15px', height: '15px', color: '#6b7280' }} />
                    </button>
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px',
                                 padding: '0.35rem 0.6rem', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                                 opacity: page >= totalPages ? 0.4 : 1 }}>
                      <ChevronRight style={{ width: '15px', height: '15px', color: '#6b7280' }} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
