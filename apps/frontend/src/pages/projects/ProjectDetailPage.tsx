import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, FolderOpen, MapPin, User,
  Calendar, TrendingUp, Receipt, Edit, AlertCircle, BarChart2, FileText, ChevronRight, Upload,
} from 'lucide-react';
import { projectsApi, expensesApi, quotationsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import { PAYMENT_METHOD_LABELS, PROJECT_STATUS_LABELS } from '../../types';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

const CAT_COLORS = ['#F5C218', '#3b82f6', '#10b981', '#e05a4e', '#8b5cf6', '#f97316', '#06b6d4'];

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: 'rgba(245,194,24,0.15)', color: '#b08a00' },
  PAUSED:    { bg: 'rgba(156,163,175,0.2)', color: '#6b7280' },
  COMPLETED: { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)',  color: '#dc2626' },
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isSupervisor: canEdit } = useRole();

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['project-summary', id],
    queryFn:  () => projectsApi.summary(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses', 'project', id],
    queryFn:  () => expensesApi.list({ projectId: id, limit: 20, status: 'ACTIVE', orderBy: 'expenseDate', order: 'desc' }),
    select:   (r) => r.data,
    enabled:  !!id,
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', id],
    queryFn:  () => projectsApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'project', id],
    queryFn:  () => quotationsApi.list({ projectId: id, limit: 5, orderBy: 'quotationDate', order: 'desc' }),
    select:   (r) => r.data,
    enabled:  !!id,
  });

  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: '5rem 0', fontFamily: MONO, fontSize: '0.72rem',
                   color: '#9ca3af', letterSpacing: '0.08em' }}>
      CARGANDO PROYECTO...
    </div>
  );
  if (!summaryData) return (
    <div style={{ textAlign: 'center', padding: '5rem 0', fontFamily: BODY, color: '#9ca3af' }}>
      Proyecto no encontrado
    </div>
  );

  const { project, summary, byCategory, addendums = [] } = summaryData;
  const expenses   = expensesData?.data ?? [];
  const quotations = quotationsData?.data ?? [];
  const usedPct    = Math.min(summary.budgetUsedPct, 100);
  const barColor   = usedPct >= 90 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#22c55e';
  const ss         = STATUS_STYLE[project.status] ?? STATUS_STYLE.PAUSED;

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes pd-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .pd-up   { animation: pd-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .pd-up-1 { animation: pd-up 0.4s 0.07s cubic-bezier(.2,.8,.2,1) both; }
        .pd-up-2 { animation: pd-up 0.4s 0.13s cubic-bezier(.2,.8,.2,1) both; }
        .pd-row:hover { background: #f9fafb; }
        @keyframes pd-bar { from { width: 0; } to { width: var(--bw); } }
        .pd-bar-anim { animation: pd-bar 0.8s 0.3s cubic-bezier(.2,.8,.2,1) both; }
      `}</style>

      {/* Hero */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 2rem' }} className="pd-up">
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <button onClick={() => navigate('/projects')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none',
                       cursor: 'pointer', fontFamily: MONO, fontSize: '0.65rem', color: '#555',
                       letterSpacing: '0.08em', marginBottom: '1rem', padding: 0 }}>
            <ArrowLeft style={{ width: '13px', height: '13px' }} />
            PROYECTOS
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
                              color: '#fff', lineHeight: 1.0, letterSpacing: '-0.01em', margin: 0 }}>
                  {project.name.toUpperCase()}
                </h1>
                <span style={{ fontFamily: BODY, fontSize: '0.72rem', fontWeight: 600,
                                background: ss.bg, color: ss.color, borderRadius: '4px', padding: '3px 9px' }}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: '#666' }}>
                {project.code}
              </p>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link to="/projects/import-batches"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                             border: '1px solid #374151', borderRadius: '7px', background: 'transparent',
                             color: '#9ca3af', fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                             padding: '0.45rem 0.85rem', textDecoration: 'none' }}>
                  <Upload style={{ width: '13px', height: '13px' }} /> Importar
                </Link>
                <Link to={`/projects/${id}/financial`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                             border: '1px solid #374151', borderRadius: '7px', background: 'transparent',
                             color: '#9ca3af', fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                             padding: '0.45rem 0.85rem', textDecoration: 'none' }}>
                  <BarChart2 style={{ width: '13px', height: '13px' }} /> Financiero
                </Link>
                <Link to={`/projects/${id}/edit`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                             background: B.yellow, color: B.dark, borderRadius: '7px', border: 'none',
                             fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.82rem', letterSpacing: '0.04em',
                             padding: '0.45rem 0.9rem', textDecoration: 'none' }}>
                  <Edit style={{ width: '13px', height: '13px' }} /> EDITAR
                </Link>
              </div>
            )}
          </div>

          {/* Budget strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
                          marginTop: '1.5rem', background: '#2c2c2c', borderRadius: '10px', overflow: 'hidden' }}
               className="pd-up-1">
            <div style={{ background: '#1a1a1a', padding: '1rem 1.25rem' }}>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                PRESUPUESTO{addendums.length > 0 ? ' TOTAL' : ''}
              </p>
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.1rem', color: '#fff', margin: 0 }}>
                {fmt(project.totalBudget ?? project.estimatedBudget)}
              </p>
              {addendums.length > 0 && (
                <p style={{ fontFamily: BODY, fontSize: '0.65rem', color: '#555', margin: '2px 0 0' }}>
                  Base + {addendums.length} adenda{addendums.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div style={{ background: '#1a1a1a', padding: '1rem 1.25rem' }}>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                GASTADO
              </p>
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.1rem', color: '#ef4444', margin: 0 }}>
                {fmt(summary.totalSpent)}
              </p>
              <p style={{ fontFamily: BODY, fontSize: '0.65rem', color: '#555', margin: '2px 0 0' }}>
                {summary.budgetUsedPct.toFixed(1)}% utilizado
              </p>
            </div>
            <div style={{ background: '#1a1a1a', padding: '1rem 1.25rem' }}>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#555', letterSpacing: '0.08em', margin: '0 0 4px' }}>
                DISPONIBLE
              </p>
              <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.1rem',
                           color: summary.budgetRemaining >= 0 ? '#22c55e' : '#ef4444', margin: 0 }}>
                {fmt(Math.abs(summary.budgetRemaining))}
                {summary.budgetRemaining < 0 && <span style={{ fontSize: '0.65rem', marginLeft: '4px' }}>(exceso)</span>}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '0.75rem' }} className="pd-up-2">
            <div style={{ height: '4px', background: '#2c2c2c', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="pd-bar-anim"
                style={{ height: '100%', background: barColor, borderRadius: '2px',
                           '--bw': `${usedPct}%` } as any} />
            </div>
            {summary.budgetUsedPct >= 90 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.4rem',
                              fontFamily: BODY, fontSize: '0.72rem', color: '#ef4444' }}>
                <AlertCircle style={{ width: '12px', height: '12px' }} />
                Presupuesto casi agotado ({summary.budgetUsedPct.toFixed(1)}% utilizado)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 2rem',
                     display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Project details */}
        {projectData && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              {projectData.client && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <User style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>CLIENTE</p>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{projectData.client}</p>
                  </div>
                </div>
              )}
              {projectData.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <MapPin style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>UBICACIÓN</p>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{projectData.location}</p>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Calendar style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>INICIO</p>
                  <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{fmtDate(projectData.startDate)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Receipt style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#9ca3af', letterSpacing: '0.06em', margin: '0 0 2px' }}>GASTOS</p>
                  <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark, margin: 0 }}>{summary.expenseCount} registros</p>
                </div>
              </div>
            </div>
            {projectData.notes && (
              <p style={{ fontFamily: BODY, fontSize: '0.8rem', color: '#6b7280', margin: '1rem 0 0',
                           paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                {projectData.notes}
              </p>
            )}
          </div>
        )}

        {/* Addendums breakdown */}
        {addendums.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: B.dark, padding: '0.75rem 1.25rem', borderBottom: `2px solid ${B.yellow}` }}>
              <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.85rem', color: '#fff', letterSpacing: '0.06em', margin: 0 }}>
                DESGLOSE DE PRESUPUESTO
              </p>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1.25rem',
                              borderBottom: '1px solid #f3f4f6', fontFamily: BODY, fontSize: '0.78rem', color: '#6b7280' }}>
                <span>Presupuesto base</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: B.dark }}>{fmt(project.estimatedBudget)}</span>
              </div>
              {addendums.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1.25rem',
                                          borderBottom: '1px solid #f3f4f6', fontFamily: BODY, fontSize: '0.78rem', color: '#6b7280' }}>
                  <span>Adenda #{a.number} — {a.description}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, color: '#16a34a' }}>+ {fmt(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By category */}
        {byCategory.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.25rem 1.5rem' }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', color: B.dark,
                         letterSpacing: '0.05em', margin: '0 0 1rem' }}>
              GASTOS POR CATEGORÍA
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {byCategory.sort((a, b) => b.totalAmount - a.totalAmount).map((bc, i) => {
                const pct = summary.totalSpent > 0 ? (bc.totalAmount / summary.totalSpent) * 100 : 0;
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <div key={bc.category?.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: B.dark,
                                      display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        {bc.category?.name}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: '#6b7280' }}>
                        {fmt(bc.totalAmount)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: color, borderRadius: '3px',
                                     width: `${pct}%`, transition: 'width 0.6s cubic-bezier(.2,.8,.2,1)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quotations */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText style={{ width: '15px', height: '15px', color: '#9ca3af' }} />
              <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', color: B.dark,
                           letterSpacing: '0.05em', margin: 0 }}>
                COTIZACIONES
              </p>
              {(quotationsData?.pagination?.total ?? 0) > 0 && (
                <span style={{ background: 'rgba(245,194,24,0.15)', color: '#92400e',
                                borderRadius: '4px', padding: '1px 7px',
                                fontFamily: MONO, fontSize: '0.65rem' }}>
                  {quotationsData!.pagination!.total}
                </span>
              )}
            </div>
            <Link to={`/quotations/new?projectId=${id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                         background: B.yellow, color: B.dark, borderRadius: '6px',
                         fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.04em',
                         padding: '0.35rem 0.75rem', textDecoration: 'none' }}>
              <Plus style={{ width: '12px', height: '12px' }} /> NUEVA
            </Link>
          </div>
          {quotations.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', fontFamily: BODY, fontSize: '0.8rem', color: '#9ca3af' }}>
              No hay cotizaciones en este proyecto
            </p>
          ) : (
            <div>
              {quotations.map((q) => (
                <Link key={q.id} to={`/quotations/${q.id}`}
                  className="pd-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                             padding: '0.85rem 1.25rem', borderBottom: '1px solid #f9fafb',
                             textDecoration: 'none', transition: 'background 0.12s' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark,
                                 margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.supplierName}
                      {q.quotationNumber && (
                        <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', marginLeft: '6px' }}>
                          #{q.quotationNumber}
                        </span>
                      )}
                    </p>
                    <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#9ca3af', margin: '2px 0 0',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.description.slice(0, 60)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.82rem', color: B.dark, margin: 0 }}>
                      {new Intl.NumberFormat('es-DO', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(Number(q.total))}
                    </p>
                    <span className={QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}
                      style={{ fontSize: '0.68rem', display: 'inline-block', marginTop: '2px',
                                 borderRadius: '3px', padding: '1px 6px' }}>
                      {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                    </span>
                  </div>
                  <ChevronRight style={{ width: '14px', height: '14px', color: '#d1d5db', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
          {(quotationsData?.pagination?.total ?? 0) > 5 && (
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f3f4f6' }}>
              <Link to={`/quotations?projectId=${id}`}
                style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: B.yellow, textDecoration: 'none' }}>
                Ver todas las cotizaciones →
              </Link>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', color: B.dark,
                         letterSpacing: '0.05em', margin: 0 }}>
              GASTOS RECIENTES
            </p>
            <Link to="/expenses/new" state={{ projectId: id }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px',
                         background: B.yellow, color: B.dark, borderRadius: '6px',
                         fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.04em',
                         padding: '0.35rem 0.75rem', textDecoration: 'none' }}>
              <Plus style={{ width: '12px', height: '12px' }} /> NUEVO
            </Link>
          </div>
          {expenses.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', fontFamily: BODY, fontSize: '0.8rem', color: '#9ca3af' }}>
              No hay gastos registrados
            </p>
          ) : (
            <div>
              {expenses.map((e) => (
                <Link key={e.id} to={`/expenses/${e.id}`}
                  className="pd-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                             padding: '0.85rem 1.25rem', borderBottom: '1px solid #f9fafb',
                             textDecoration: 'none', transition: 'background 0.12s',
                             borderLeft: `3px solid ${B.yellow}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.82rem', color: B.dark,
                                 margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af', margin: '2px 0 0' }}>
                      {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                      {e.hasFiscalDoc && <span style={{ color: '#3b82f6', marginLeft: '6px' }}>NCF</span>}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.85rem', color: B.dark, margin: 0 }}>
                      {fmt(Number(e.amount))}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '0.62rem', color: '#9ca3af', margin: '2px 0 0' }}>
                      {fmtDate(e.expenseDate)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {(expensesData?.pagination?.total ?? 0) > 20 && (
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f3f4f6' }}>
              <Link to={`/expenses?projectId=${id}`}
                style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600, color: B.yellow, textDecoration: 'none' }}>
                Ver todos los gastos →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
