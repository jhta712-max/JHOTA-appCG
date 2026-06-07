import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus, ArrowRight, Clock, TrendingUp, Receipt, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { projectsApi, expensesApi, quotationsApi, paymentOrdersApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { useRole } from '../../hooks/useRole';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';

const B = { dark: '#1C1C1C', yellow: '#F5C218' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

function fmt(amount: number, currency = 'DOP') {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const OPEN_STATUSES = new Set(['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED']);

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { canCreateExpense, canViewFinancials, isAuxiliar, canViewReports } = useRole();

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'dashboard-all'],
    queryFn:  () => projectsApi.list({ limit: 50, status: 'ACTIVE', orderBy: 'createdAt', order: 'desc' }),
    select:   (r) => r.data,
  });
  const { data: expensesData } = useQuery({
    queryKey: ['expenses', 'recent'],
    queryFn:  () => expensesApi.list({ limit: 6, status: 'ACTIVE', orderBy: 'createdAt', order: 'desc' }),
    select:   (r) => r.data,
  });
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations', 'dashboard'],
    queryFn:  () => quotationsApi.list({ limit: 50, orderBy: 'quotationDate', order: 'desc' }),
    select:   (r) => r.data,
  });
  const { data: statsData } = useQuery({
    queryKey: ['expenses', 'stats'],
    queryFn:  () => expensesApi.getStats(),
    select:   (r) => r.data.data,
    enabled:  canViewFinancials,
  });
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['payment-orders', 'dashboard-pending'],
    queryFn:  () => paymentOrdersApi.list({ status: 'PENDING', limit: 6 }),
    select:   (r) => (r.data as any).data,
  });

  const projects            = projectsData?.data ?? [];
  const expenses            = expensesData?.data ?? [];
  const allQuotations       = quotationsData?.data ?? [];
  const openQuotations      = allQuotations.filter((q) => OPEN_STATUSES.has(q.status));
  const recentQuotations    = allQuotations.slice(0, 4);
  const totalOpenAmount     = openQuotations.reduce((s, q) => s + Number(q.total), 0);
  const totalBudget         = projects.reduce((s, p) => s + Number(p.estimatedBudget ?? 0), 0);
  const totalExpended       = projects.reduce((s, p) => s + Number((p as any).totalExpenses ?? 0), 0);
  const totalPendingAmount  = (pendingOrders as any[]).reduce((s, o) => s + Number(o.amount), 0);
  const overBudgetCount     = projects.filter((p) => {
    const b = Number(p.estimatedBudget ?? 0);
    return b > 0 && Number((p as any).totalExpenses ?? 0) > b;
  }).length;

  const today   = new Date();
  const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiring = openQuotations.filter((q) => {
    if (!q.validUntil) return false;
    const d = new Date(q.validUntil);
    return d >= today && d <= in7days;
  });

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.name?.split(' ')[0] ?? '';
  const dateLabel = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const budgetPct = totalBudget > 0 ? Math.min(Math.round((totalExpended / totalBudget) * 100), 100) : 0;

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes dsh-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes dsh-bar { from { width:0; } to { width:var(--bw,0%); } }
        .dsh-up { animation: dsh-up 0.45s cubic-bezier(.2,.8,.2,1) both; }
        .dsh-up-1 { animation: dsh-up 0.45s 0.05s cubic-bezier(.2,.8,.2,1) both; }
        .dsh-up-2 { animation: dsh-up 0.45s 0.10s cubic-bezier(.2,.8,.2,1) both; }
        .dsh-up-3 { animation: dsh-up 0.45s 0.15s cubic-bezier(.2,.8,.2,1) both; }
        .dsh-bar-fill { animation: dsh-bar 0.9s 0.3s cubic-bezier(.2,.8,.2,1) both; }
        .dsh-proj:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.09); }
        .dsh-proj { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .dsh-stat:hover { transform: translateY(-1px); }
        .dsh-stat { transition: transform 0.15s ease; }
        .dsh-row:hover { background: #f9fafb !important; }
        .dsh-row { transition: background 0.12s; }
      `}</style>

      {/* ═══════════════ HERO BAND ══════════════════════════ */}
      <div className="dsh-up" style={{ background: B.dark }}>
        <div className="px-5 md:px-8 pt-8 pb-0">

          {/* Top row: greeting + CTA */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p style={{ fontFamily: BODY, fontSize: '0.65rem', letterSpacing: '0.12em', color: '#555',
                           textTransform: 'uppercase', marginBottom: '4px' }}>
                {dateLabel}
              </p>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, lineHeight: 1.0,
                            fontSize: 'clamp(2.8rem, 6vw, 4.5rem)', color: '#fff', letterSpacing: '-0.01em' }}>
                {greeting},<br />
                <span style={{ color: B.yellow }}>{firstName}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              {canCreateExpense && (
                <Link to="/expenses/new"
                  style={{ background: B.yellow, fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                             color: B.dark, borderRadius: '8px', padding: '0.6rem 1.2rem', fontSize: '0.9rem',
                             textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  className="hover:brightness-105 transition-all">
                  <Plus className="w-4 h-4" /> NUEVO GASTO
                </Link>
              )}
              {canViewReports && !canCreateExpense && (
                <Link to="/reports"
                  style={{ border: `1px solid #333`, fontFamily: DISPLAY, fontWeight: 700, letterSpacing: '0.05em',
                             color: '#aaa', borderRadius: '8px', padding: '0.6rem 1.2rem', fontSize: '0.9rem',
                             textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  className="hover:border-gray-500 hover:text-white transition-all">
                  <TrendingUp className="w-4 h-4" /> REPORTES
                </Link>
              )}
            </div>
          </div>

          {/* Budget progress bar + macro numbers */}
          {canViewFinancials && totalBudget > 0 && (
            <div className="dsh-up-1">
              <div className="flex items-end justify-between mb-2 gap-4">
                <div>
                  <p style={{ fontFamily: BODY, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Ejecución presupuestaria — {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
                  </p>
                  <p style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: '1.7rem', color: '#fff', lineHeight: 1.1, marginTop: '2px' }}>
                    <span style={{ fontFamily: MONO, fontSize: '1.4rem' }}>{fmt(totalExpended)}</span>
                    <span style={{ color: '#444', fontSize: '1rem', marginLeft: '8px' }}>/ {fmt(totalBudget)}</span>
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: '2.8rem', lineHeight: 1,
                               color: budgetPct >= 90 ? '#ef4444' : B.yellow }}>
                    {budgetPct}<span style={{ fontSize: '1.4rem', color: '#444' }}>%</span>
                  </p>
                </div>
              </div>
              {/* Wide progress track */}
              <div style={{ height: '6px', background: '#2a2a2a', borderRadius: '3px', overflow: 'hidden', marginBottom: '0' }}>
                <div className="dsh-bar-fill h-full"
                     style={{ ['--bw' as any]: `${budgetPct}%`, borderRadius: '3px',
                               background: budgetPct >= 90 ? '#ef4444' : budgetPct >= 70 ? '#f59e0b' : B.yellow }} />
              </div>
            </div>
          )}

        </div>

        {/* ── Stat strip — flush to bottom of hero ── */}
        <div className="dsh-up-2 grid grid-cols-3 md:grid-cols-5 mt-6"
             style={{ borderTop: '1px solid #2a2a2a' }}>
          {([
            {
              label: 'Proyectos',
              value: projects.length,
              sub: 'activos',
              dark: true,
              accent: false,
              link: '/projects',
            },
            {
              label: 'Gastos',
              value: expensesData?.pagination?.total ?? 0,
              sub: 'registrados',
              dark: true,
              accent: false,
              link: '/expenses',
            },
            {
              label: 'Cotizaciones',
              value: openQuotations.length,
              sub: totalOpenAmount > 0 ? fmt(totalOpenAmount) : 'abiertas',
              dark: true,
              accent: openQuotations.length > 0,
              link: '/quotations',
            },
            {
              label: 'Sobre ppto.',
              value: overBudgetCount,
              sub: overBudgetCount > 0 ? 'requieren atención' : 'todo en rango',
              dark: true,
              danger: overBudgetCount > 0,
              link: '/projects',
            },
            {
              label: 'Pagos pend.',
              value: pendingOrders.length,
              sub: totalPendingAmount > 0 ? fmt(totalPendingAmount) : 'ninguno',
              dark: true,
              warn: (pendingOrders as any[]).length > 0,
              link: '/pending-orders',
            },
          ] as any[]).map((s, i) => (
            <Link key={i} to={s.link} className="dsh-stat block"
                  style={{ padding: '1rem 1.25rem', textDecoration: 'none',
                             borderRight: i < 4 ? '1px solid #2a2a2a' : 'none' }}>
              <p style={{ fontFamily: BODY, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                           color: '#555', fontWeight: 600, marginBottom: '4px' }}>{s.label}</p>
              <p style={{ fontFamily: DISPLAY, fontWeight: 900, lineHeight: 1,
                           fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                           color: s.danger ? '#ef4444' : s.warn ? B.yellow : s.accent ? '#fbbf24' : '#fff' }}>
                {s.value}
              </p>
              <p style={{ fontFamily: MONO, fontSize: '0.58rem', color: '#444', marginTop: '3px',
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.sub}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════════════ CONTENT ═══════════════════════════ */}
      <div className="px-5 md:px-8 py-6 space-y-6 dsh-up-3">

        {/* ── Expiring quotations alert ────────────────── */}
        {expiring.length > 0 && (
          <div style={{ background: '#fffbeb', borderLeft: `4px solid ${B.yellow}`,
                         borderRadius: '10px', padding: '1rem 1.25rem' }}
               className="flex gap-3 items-start">
            <Clock style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.04em',
                           color: '#92400e', fontSize: '0.9rem', marginBottom: '6px' }}>
                {expiring.length} COTIZACIÓN{expiring.length > 1 ? 'ES VENCEN' : ' VENCE'} EN LOS PRÓXIMOS 7 DÍAS
              </p>
              <div className="space-y-1">
                {expiring.map((q) => (
                  <Link key={q.id} to={`/quotations/${q.id}`}
                        style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#b45309',
                                  display: 'flex', justifyContent: 'space-between', textDecoration: 'none' }}
                        className="hover:text-amber-900">
                    <span className="truncate">{q.supplierName} — {q.project.code}</span>
                    <span style={{ flexShrink: 0, marginLeft: '12px', fontFamily: MONO, fontSize: '0.7rem' }}>
                      {fmtDate(q.validUntil!)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Charts ──────────────────────────────────── */}
        {canViewFinancials && statsData && (
          <div className="grid md:grid-cols-2 gap-4">

            {/* Monthly spend */}
            <div style={{ background: B.dark, borderRadius: '12px', padding: '1.5rem' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                              color: '#fff', fontSize: '1rem' }}>GASTOS POR MES</h2>
                <TrendingUp style={{ color: B.yellow }} className="w-4 h-4" />
              </div>
              {statsData.byMonth.length === 0 ? (
                <p style={{ color: '#444', fontFamily: BODY }} className="text-sm text-center py-10">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={statsData.byMonth} barSize={26} margin={{ top: 0, right: 0, left: -8, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#555', fontFamily: BODY }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#444', fontFamily: MONO }} axisLine={false} tickLine={false} width={50}
                      tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v} />
                    <Tooltip cursor={{ fill: 'rgba(245,194,24,0.07)' }}
                      formatter={(v) => [fmt(Number(v)), 'Total']}
                      contentStyle={{ background: '#222', border: '1px solid #333', borderRadius: '8px',
                                      fontSize: 12, fontFamily: BODY, color: '#fff' }}
                      labelStyle={{ color: '#777' }} />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                      {statsData.byMonth.map((_: any, i: number) => (
                        <Cell key={i} fill={i === statsData.byMonth.length - 1 ? B.yellow : '#2c2c2c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By category */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                              color: B.dark, fontSize: '1rem' }}>POR CATEGORÍA</h2>
                <Receipt style={{ color: B.yellow }} className="w-4 h-4" />
              </div>
              {statsData.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Sin datos</p>
              ) : (
                <div className="space-y-3.5">
                  {statsData.byCategory.map((cat: any, i: number) => {
                    const pal = [B.yellow, '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span style={{ fontFamily: BODY, fontSize: '0.78rem', fontWeight: 500, color: '#374151' }}
                                className="truncate max-w-[55%]">{cat.name}</span>
                          <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#9ca3af' }} className="shrink-0 ml-2">
                            {cat.pct}% · {fmt(cat.total)}
                          </span>
                        </div>
                        <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                          <div className="dsh-bar-fill h-full"
                               style={{ ['--bw' as any]: `${cat.pct}%`, background: pal[i] ?? pal[6], borderRadius: '3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Projects ────────────────────────────────── */}
        {!isAuxiliar && projects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: '1.4rem',
                            letterSpacing: '0.04em', color: B.dark }}>
                PROYECTOS ACTIVOS
              </h2>
              <Link to="/projects"
                    style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#9ca3af', textDecoration: 'none' }}
                    className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {projects.slice(0, 6).map((p) => {
                const budget   = Number(p.estimatedBudget ?? 0);
                const expended = Number((p as any).totalExpenses ?? 0);
                const pct      = budget > 0 ? Math.min(Math.round((expended / budget) * 100), 100) : 0;
                const isOver   = budget > 0 && expended > budget;
                const isWarn   = pct >= 75 && !isOver;
                const barColor = isOver ? '#ef4444' : isWarn ? '#f59e0b' : B.yellow;
                const accentColor = isOver ? '#ef4444' : isWarn ? '#f59e0b' : B.yellow;

                return (
                  <Link key={p.id} to={`/projects/${p.id}`} className="dsh-proj block"
                        style={{ background: '#fff',
                                  border: `1px solid ${isOver ? '#fee2e2' : '#e5e7eb'}`,
                                  borderTopWidth: '3px', borderTopColor: accentColor,
                                  borderRadius: '10px', padding: '1.25rem', textDecoration: 'none' }}>

                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span style={{ fontFamily: MONO, fontSize: '0.62rem', background: B.dark, color: B.yellow,
                                          padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.06em' }}>
                            {p.code}
                          </span>
                          {isOver && (
                            <span style={{ fontFamily: MONO, fontSize: '0.58rem', background: '#fee2e2',
                                            color: '#dc2626', padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.04em' }}>
                              SOBRE PPTO
                            </span>
                          )}
                        </div>
                        <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: '0.85rem', color: '#111', lineHeight: 1.3 }}
                           className="truncate">{p.name}</p>
                        {p.client && (
                          <p style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#9ca3af' }} className="truncate mt-0.5">{p.client}</p>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <span style={{ fontFamily: BODY, fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          ejecutado
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: isOver ? '#ef4444' : isWarn ? '#d97706' : B.dark }}>
                          {pct}%
                        </span>
                      </div>
                      <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                        <div className="dsh-bar-fill h-full"
                             style={{ ['--bw' as any]: `${pct}%`, background: barColor, borderRadius: '3px' }} />
                      </div>
                    </div>

                    {/* Amounts */}
                    <div className="flex justify-between pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
                      <div>
                        <p style={{ fontFamily: BODY, fontSize: '0.6rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Presupuesto</p>
                        <p style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginTop: '2px' }}>
                          {budget > 0 ? fmt(budget) : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p style={{ fontFamily: BODY, fontSize: '0.6rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                          gastos · {p._count?.expenses ?? 0}
                        </p>
                        <p style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, marginTop: '2px',
                                     color: isOver ? '#ef4444' : '#374151' }}>
                          {fmt(expended)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Feed: Pending orders + Recent ────────────── */}
        {!isAuxiliar && (
          <div className="grid md:grid-cols-2 gap-4">

            {/* Gastos recientes */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '1rem 1.25rem' }}
                   className="flex items-center justify-between">
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                              color: B.dark, fontSize: '0.95rem' }}>GASTOS RECIENTES</h2>
                <Link to="/expenses" style={{ fontFamily: BODY, color: '#9ca3af', fontSize: '0.75rem', textDecoration: 'none' }}
                      className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {expenses.length === 0 ? (
                <p style={{ fontFamily: BODY, color: '#9ca3af' }} className="text-center py-10 text-sm">Sin gastos recientes</p>
              ) : expenses.map((e, i) => (
                <Link key={e.id} to={`/expenses/${e.id}`} className="dsh-row"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                 padding: '0.75rem 1.25rem', textDecoration: 'none',
                                 borderBottom: i < expenses.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: '0.8rem', color: '#111' }} className="truncate">
                      {e.description}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '0.63rem', color: '#9ca3af', marginTop: '1px' }}>
                      {e.project.code} · {e.category.name}
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p style={{ fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>
                      {fmt(Number(e.amount))}
                    </p>
                    <p style={{ fontFamily: BODY, fontSize: '0.63rem', color: '#9ca3af' }}>{fmtDate(e.expenseDate)}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Cotizaciones */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', padding: '1rem 1.25rem' }}
                   className="flex items-center justify-between">
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                              color: B.dark, fontSize: '0.95rem' }}>COTIZACIONES</h2>
                <Link to="/quotations" style={{ fontFamily: BODY, color: '#9ca3af', fontSize: '0.75rem', textDecoration: 'none' }}
                      className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                  Ver todas <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {recentQuotations.length === 0 ? (
                <p style={{ fontFamily: BODY, color: '#9ca3af' }} className="text-center py-10 text-sm">Sin cotizaciones</p>
              ) : recentQuotations.map((q, i) => (
                <Link key={q.id} to={`/quotations/${q.id}`} className="dsh-row"
                      style={{ display: 'flex', alignItems: 'center', gap: '12px',
                                 padding: '0.75rem 1.25rem', textDecoration: 'none',
                                 borderBottom: i < recentQuotations.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: '0.8rem', color: '#111' }} className="truncate">
                      {q.supplierName}
                      {q.quotationNumber && (
                        <span style={{ fontFamily: MONO, color: '#9ca3af', fontSize: '0.68rem', marginLeft: '5px' }}>
                          #{q.quotationNumber}
                        </span>
                      )}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '0.63rem', color: '#9ca3af' }}>
                      {q.project.code} · {fmtDate(q.quotationDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{ fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700, color: '#111' }}>
                      {fmt(Number(q.total), q.currency)}
                    </p>
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}
                          style={{ fontFamily: BODY, fontSize: '0.62rem' }}>
                      {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending payments ────────────────────────── */}
        {(pendingOrders as any[]).length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ borderBottom: '1px solid #f3f4f6', padding: '1rem 1.25rem' }}
                 className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                              color: B.dark, fontSize: '0.95rem' }}>PAGOS PENDIENTES</h2>
                <span style={{ background: B.yellow, color: B.dark, fontFamily: MONO, fontSize: '0.65rem',
                                fontWeight: 700, padding: '1px 8px', borderRadius: '99px' }}>
                  {pendingOrders.length}
                </span>
              </div>
              <Link to="/pending-orders" style={{ fontFamily: BODY, color: '#9ca3af', fontSize: '0.75rem', textDecoration: 'none' }}
                    className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {(pendingOrders as any[]).map((o, i) => (
              <div key={o.id} className="dsh-row"
                   style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.75rem 1.25rem',
                              borderBottom: i < pendingOrders.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: B.yellow, flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p style={{ fontFamily: BODY, fontWeight: 500, fontSize: '0.8rem', color: '#111' }} className="truncate">
                      {o.supplier?.name}
                    </p>
                    <p style={{ fontFamily: MONO, fontSize: '0.63rem', color: '#9ca3af' }}>
                      {o.project?.code} · {o.concept}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p style={{ fontFamily: MONO, fontSize: '0.85rem', fontWeight: 700, color: '#111' }}>
                    {fmt(Number(o.amount))}
                  </p>
                  <span style={{ fontFamily: BODY, fontSize: '0.62rem', background: '#fef3c7',
                                   color: '#92400e', padding: '1px 8px', borderRadius: '99px', fontWeight: 600 }}>
                    pendiente
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DGII reminder ───────────────────────────── */}
        {canCreateExpense && (
          <div style={{ borderLeft: `3px solid ${B.yellow}`, paddingLeft: '1rem' }}>
            <p style={{ fontFamily: BODY, fontSize: '0.73rem', color: '#9ca3af', lineHeight: 1.6 }}>
              <strong style={{ color: '#6b7280' }}>DGII:</strong> Todo gasto con comprobante fiscal debe incluir NCF y RNC del suplidor para cumplimiento tributario.
            </p>
          </div>
        )}

        {/* Mobile: Add expense CTA */}
        {canCreateExpense && (
          <Link to="/expenses/new"
                style={{ background: B.yellow, fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '0.06em',
                           color: B.dark, borderRadius: '10px', padding: '1rem', fontSize: '1rem',
                           textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                className="sm:hidden">
            <Plus className="w-5 h-5" /> REGISTRAR GASTO
          </Link>
        )}

        <div style={{ height: '1rem' }} />
      </div>
    </div>
  );
}
