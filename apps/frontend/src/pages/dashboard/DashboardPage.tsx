import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Receipt, Plus, ArrowRight,
  AlertCircle, FileText, Clock, ChevronRight, TrendingUp, Wallet,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { projectsApi, expensesApi, quotationsApi, paymentOrdersApi, suppliersApi, dashboardApi } from '../../api';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useRole } from '../../hooks/useRole';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';

function fmt(amount: number, currency = 'DOP') {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(amount);
}

const OPEN_STATUSES = new Set(['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED']);

// Section header — Barlow Condensed uppercase with yellow left rule
function SectionHeader({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-0.5 h-5 shrink-0" style={{ background: '#F5C218' }} />
        <Icon className="w-4 h-4 text-gray-400 shrink-0" />
        <h2 className="font-bold uppercase tracking-wide text-[#1C1C1C] text-sm font-['Barlow_Condensed']">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ViewAllLink({ to, label = 'Ver todos' }: { to: string; label?: string }) {
  return (
    <Link to={to}
      className="text-xs font-bold uppercase tracking-wide text-gray-400 hover:text-[#1C1C1C] flex items-center gap-1 transition-colors font-['Barlow_Condensed']">
      {label} <ArrowRight className="w-3 h-3" />
    </Link>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { canCreateExpense, canViewFinancials, isAuxiliar, canViewReports, isAdmin, isSupervisor } = useRole();

  // Credit summary query — only for admin/supervisor
  const { data: creditSummaryData } = useQuery({
    queryKey: ['creditSummary'],
    queryFn: () => suppliersApi.getCreditSummary('active'),
    enabled: isAdmin || isSupervisor,
    select: (res) => res.data.data,
  });
  const hasCriticalCreditLine = creditSummaryData?.lines?.some(
    (l) => l.pending > 0 && l.creditLimit > 0 && l.available / l.creditLimit < 0.10
  ) ?? false;

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

  const { data: dashboardAlerts } = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn:  dashboardApi.getAlerts,
    staleTime: 60_000,
  });

  const { data: portfolio = [] } = useQuery({
    queryKey: ['projects', 'portfolio'],
    queryFn:  () => projectsApi.portfolio(),
    select:   (r) => r.data.data,
    enabled:  isAdmin || isSupervisor,
    staleTime: 60_000,
  });

  const projects         = projectsData?.data ?? [];
  const expenses         = expensesData?.data ?? [];
  const allQuotations    = quotationsData?.data ?? [];
  const openQuotations   = allQuotations.filter((q) => OPEN_STATUSES.has(q.status));
  const recentQuotations = allQuotations.slice(0, 4);
  const totalOpenAmount  = openQuotations.reduce((s, q) => s + Number(q.total), 0);

  const today   = new Date();
  const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiring = openQuotations.filter((q) => {
    if (!q.validUntil) return false;
    const d = new Date(q.validUntil);
    return d >= today && d <= in7days;
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const totalBudget        = projects.reduce((s, p) => s + Number(p.estimatedBudget ?? 0), 0);
  const totalPendingAmount = pendingOrders.reduce((s: number, o: any) => s + Number(o.amount), 0);

  return (
    <div className="space-y-6">

      {/* ── Saludo ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-4 md:px-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 font-['Barlow_Condensed'] mb-1">
            {new Date().toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] leading-none text-3xl md:text-5xl">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="font-['DM_Sans'] text-gray-400 text-sm mt-1">Aquí está el resumen de hoy</p>
        </div>
        {canCreateExpense && (
          <Link to="/expenses/new"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wide font-['Barlow_Condensed'] transition-colors"
            style={{ background: '#F5C218', color: '#1C1C1C' }}>
            <Plus className="w-4 h-4" /> Nuevo gasto
          </Link>
        )}
        {canViewReports && !canCreateExpense && (
          <Link to="/reports"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wide font-['Barlow_Condensed'] border border-[#1C1C1C] text-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-white transition-colors">
            <TrendingUp className="w-4 h-4" /> Ver reportes
          </Link>
        )}
      </div>

      {/* ── Alertas del dashboard ───────────────────────────── */}
      {dashboardAlerts && (
        dashboardAlerts.pendingOrders.length > 0 ||
        dashboardAlerts.budgetAlerts.length > 0 ||
        dashboardAlerts.expiringQuotations.length > 0 ||
        dashboardAlerts.creditAlerts.length > 0 ||
        dashboardAlerts.expiringSubscriptions.length > 0
      ) && (
        <div className="border border-[#F5C218]/40 bg-[#1C1C1C]/[0.02] p-4 space-y-2">
          <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-[0.15em] text-[#1C1C1C] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F5C218]" />
            ATENCIÓN REQUERIDA
          </h2>

          {/* Budget alerts */}
          {dashboardAlerts!.budgetAlerts.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="flex items-start gap-2 p-2 border-l-2 border-[#F5C218] bg-[#F5C218]/5 mb-2 hover:bg-[#F5C218]/10 transition-colors block">
              <AlertTriangle className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-['DM_Sans'] text-sm text-gray-800">
                  Proyecto <strong>{p.code}</strong> — presupuesto al{' '}
                  <span className="font-['Space_Mono'] font-bold" style={{ color: p.pct >= 95 ? '#ef4444' : '#f59e0b' }}>{p.pct}%</span>
                </span>
                <div className="mt-1 h-1.5 bg-gray-200 overflow-hidden w-full max-w-[200px]">
                  <div className="h-full" style={{ width: `${Math.min(p.pct, 100)}%`, background: p.pct >= 95 ? '#ef4444' : '#f59e0b' }} />
                </div>
              </div>
              <span className="font-['Space_Mono'] text-xs text-gray-500 shrink-0">{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(p.spent)} / {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(p.budget)}</span>
            </Link>
          ))}

          {/* Credit alerts */}
          {dashboardAlerts!.creditAlerts.map((cl) => (
            <Link key={cl.id} to={`/suppliers/${cl.supplierId}`}
              className="flex items-start gap-2 p-2 border-l-2 border-[#F5C218] bg-[#F5C218]/5 mb-2 hover:bg-[#F5C218]/10 transition-colors block">
              <AlertTriangle className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-['DM_Sans'] text-sm text-gray-800">
                  Crédito <strong>{cl.supplierName}</strong> — {cl.pct}% consumido
                </span>
                <p className="font-['Space_Mono'] text-xs text-gray-500">Disponible: RD$ {cl.available.toLocaleString()} de RD$ {cl.limit.toLocaleString()}</p>
              </div>
              <span className="font-['Barlow_Condensed'] text-xs font-bold px-1.5 py-0.5 shrink-0" style={{ background: cl.pct >= 95 ? '#ef4444' : '#F5C218', color: cl.pct >= 95 ? '#fff' : '#1C1C1C' }}>{cl.pct}%</span>
            </Link>
          ))}

          {/* Expiring quotations */}
          {dashboardAlerts!.expiringQuotations.map((q) => (
            <Link key={q.id} to={`/quotations/${q.id}`}
              className="flex items-start gap-2 p-2 border-l-2 border-[#F5C218] bg-[#F5C218]/5 mb-2 hover:bg-[#F5C218]/10 transition-colors block">
              <Clock className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-['DM_Sans'] text-sm text-gray-800">
                  Cotización <strong>{q.supplierName}</strong>{q.projectCode ? ` — ${q.projectCode}` : ''} vence en <strong>{q.daysLeft}d</strong>
                </span>
              </div>
            </Link>
          ))}

          {/* Expiring subscriptions */}
          {dashboardAlerts!.expiringSubscriptions.map((s) => (
            <div key={s.id} className="flex items-start gap-2 p-2 border-l-2 border-[#F5C218] bg-[#F5C218]/5 mb-2">
              <Clock className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-['DM_Sans'] text-sm text-gray-800">
                  Suscripción <strong>{s.serviceName}</strong> — pago en <strong>{s.daysLeft}d</strong>
                </span>
                <p className="font-['Space_Mono'] text-xs text-gray-500">{s.currency} {s.amount.toLocaleString()}/mes</p>
              </div>
            </div>
          ))}

          {/* Pending orders summary (only if there are many) */}
          {dashboardAlerts!.pendingOrders.length > 0 && (
            <Link to="/pending-orders"
              className="flex items-start gap-2 p-2 border-l-2 border-[#F5C218] bg-[#F5C218]/5 mb-2 hover:bg-[#F5C218]/10 transition-colors block">
              <FileText className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <span className="font-['DM_Sans'] text-sm text-gray-800 flex-1">
                <span className="font-['Barlow_Condensed'] text-xs font-bold bg-[#F5C218] text-[#1C1C1C] px-1.5 py-0.5 mr-2">{dashboardAlerts!.pendingOrders.length}</span>
                órdenes de pago pendientes de autorización
              </span>
            </Link>
          )}
        </div>
      )}

      {/* ── Stats KPI cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">

        {/* Proyectos activos */}
        <div className="border border-gray-200 bg-white p-4" style={{ borderTop: '3px solid #1C1C1C' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed']">Proyectos activos</p>
          <p className="font-['Space_Mono'] text-3xl font-bold text-[#1C1C1C] mt-1 leading-none">{projects.length}</p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">en ejecución</p>
        </div>

        {/* Gastos registrados */}
        <div className="border border-gray-200 bg-white p-4" style={{ borderTop: '3px solid #1C1C1C' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed']">Gastos registrados</p>
          <p className="font-['Space_Mono'] text-3xl font-bold text-[#1C1C1C] mt-1 leading-none">{expensesData?.pagination?.total ?? 0}</p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">total acumulado</p>
        </div>

        {/* Cotizaciones abiertas */}
        <div className="border border-gray-200 bg-white p-4" style={{ borderTop: '3px solid #F5C218' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed']">Cotizaciones abiertas</p>
          <p className="font-['Space_Mono'] text-3xl font-bold mt-1 leading-none" style={{ color: '#F5C218' }}>{openQuotations.length}</p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1 truncate">{totalOpenAmount > 0 ? fmt(totalOpenAmount) : 'sin monto'}</p>
        </div>

        {/* Presupuesto total */}
        <div className="border border-gray-200 bg-white p-4" style={{ borderTop: '3px solid #1C1C1C' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed']">Presupuesto total</p>
          <p className="font-['Space_Mono'] text-base font-bold text-[#1C1C1C] mt-1 leading-tight truncate">{fmt(totalBudget)}</p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">todos los proyectos</p>
        </div>

        {/* Pagos pendientes */}
        <Link to="/pending-orders"
          className="border bg-white p-4 transition-colors col-span-2 md:col-span-1 group hover:border-[#F5C218]"
          style={{ borderTop: '3px solid #F5C218' }}>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-['Barlow_Condensed'] flex items-center gap-1">
            <Clock className="w-3 h-3" style={{ color: '#F5C218' }} /> Pagos pendientes
          </p>
          <p className="font-['Space_Mono'] text-3xl font-bold mt-1 leading-none"
             style={{ color: pendingOrders.length > 0 ? '#F5C218' : '#1C1C1C' }}>
            {pendingOrders.length}
          </p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1 truncate">
            {totalPendingAmount > 0 ? fmt(totalPendingAmount) : 'ninguno pendiente'}
          </p>
        </Link>

        {/* Deuda con suplidores */}
        {(isAdmin || isSupervisor) && creditSummaryData && (
          <div
            className={`bg-white border p-5 cursor-pointer col-span-2 md:col-span-1 ${hasCriticalCreditLine ? 'border-[#F5C218]' : 'border-gray-200'}`}
            onClick={() => {
              document.getElementById('credit-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <div className="text-xs font-['Barlow_Condensed'] tracking-[0.15em] text-gray-400 uppercase mb-1">
              DEUDA CON SUPLIDORES
            </div>
            <div className="text-2xl font-['Space_Mono'] font-bold text-[#1C1C1C]">
              RD$ {creditSummaryData.totalPending.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1 font-['DM_Sans']">
              {creditSummaryData.activeLines} líneas activas · RD$ {creditSummaryData.totalAvailable.toLocaleString()} disponible
            </div>
            {hasCriticalCreditLine && (
              <div className="text-xs text-[#F5C218] mt-1 font-['DM_Sans']">⚠ Línea(s) en estado crítico</div>
            )}
          </div>
        )}
      </div>

      {/* ── Gráficas ─────────────────────────────────────────── */}
      {canViewFinancials && statsData && (
        <div className="grid md:grid-cols-2 gap-5">

          {/* Gastos por mes */}
          <div className="p-5" style={{ background: '#1C1C1C' }}>
            <h2 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-sm mb-4 flex items-center gap-2"
                style={{ color: '#F5C218' }}>
              <TrendingUp className="w-4 h-4" />
              Gastos por mes
            </h2>
            {statsData.byMonth.length === 0 ? (
              <p className="font-['DM_Sans'] text-sm text-center py-10" style={{ color: '#555' }}>Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={statsData.byMonth} barSize={28} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d2d2d" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'Space Mono' }}
                    axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,194,24,0.08)' }}
                    formatter={(v) => [fmt(Number(v)), 'Total']}
                    contentStyle={{ fontSize: 12, border: '1px solid #333', background: '#252525', color: '#fff', borderRadius: 0, fontFamily: 'DM Sans' }}
                    labelStyle={{ color: '#9ca3af', fontFamily: 'Barlow Condensed' }}
                  />
                  <Bar dataKey="total" radius={[0, 0, 0, 0]}>
                    {statsData.byMonth.map((_, i) => (
                      <Cell key={i} fill={i === statsData.byMonth.length - 1 ? '#F5C218' : '#D4A017'} fillOpacity={i === statsData.byMonth.length - 1 ? 1 : 0.75} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#F5C218"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#F5C218', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#F5C218' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gastos por categoría */}
          <div className="border border-gray-200 bg-white p-5">
            <h2 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] text-sm mb-4 flex items-center gap-2">
              <span className="w-0.5 h-4 shrink-0" style={{ background: '#F5C218' }} />
              <Receipt className="w-4 h-4 text-gray-400" />
              Gastos por categoría
            </h2>
            {statsData.byCategory.length === 0 ? (
              <p className="font-['DM_Sans'] text-sm text-gray-400 text-center py-10">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {statsData.byCategory.map((cat, i) => {
                  const fills = ['#F5C218','#D4A017','#B8880E','#9C720B','#805C08','#644606','#483004'];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-['DM_Sans'] font-semibold text-[#1C1C1C] uppercase tracking-wide truncate max-w-[55%]">{cat.name}</span>
                        <span className="font-['Space_Mono'] text-gray-500 shrink-0 ml-2">{cat.pct}% · {fmt(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${cat.pct}%`, background: fills[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Alerta cotizaciones próximas a vencer */}
      {expiring.length > 0 && (
        <div className="border-l-4 p-4 space-y-2" style={{ borderColor: '#F5C218', background: '#FFFBEB' }}>
          <div className="flex items-center gap-2 font-bold text-sm font-['Barlow_Condensed'] uppercase tracking-wide text-amber-800">
            <Clock className="w-4 h-4 shrink-0" />
            {expiring.length} cotización{expiring.length > 1 ? 'es vencen' : ' vence'} en los próximos 7 días
          </div>
          {expiring.map((q) => (
            <Link key={q.id} to={`/quotations/${q.id}`}
              className="flex items-center justify-between text-xs text-amber-700 hover:text-amber-900 font-['DM_Sans']">
              <span className="truncate">{q.supplierName} — {q.project.code}</span>
              <span className="ml-2 shrink-0 font-semibold font-['Space_Mono']">vence {fmtDate(q.validUntil!)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Proyectos activos ────────────────────────────────── */}
      {!isAuxiliar && (
        <div className="px-4 md:px-6">
          <SectionHeader icon={FolderOpen} title="Proyectos activos" action={<ViewAllLink to="/projects" />} />
          {projects.length === 0 ? (
            <div className="border border-gray-200 p-8 text-center font-['DM_Sans'] text-gray-400 text-sm">No hay proyectos activos</div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((p) => {
                const budget   = Number(p.estimatedBudget ?? 0);
                const expended = Number((p as any).totalExpenses ?? 0);
                const pct      = budget > 0 ? Math.min(Math.round((expended / budget) * 100), 100) : 0;
                const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';

                return (
                  <Link key={p.id} to={`/projects/${p.id}`}
                    className="border border-gray-200 bg-white p-5 hover:border-[#1C1C1C] transition-all group space-y-3 block"
                    style={{ borderTop: '3px solid #1C1C1C' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] truncate text-sm leading-tight">
                          {p.name}
                        </p>
                        <p className="font-['Space_Mono'] text-[10px] text-gray-400 mt-0.5">{p.code} · {p.client ?? 'Sin cliente'}</p>
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 font-['Barlow_Condensed']"
                            style={{ background: '#F5C218', color: '#1C1C1C' }}>
                        Activo
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between font-['Space_Mono'] text-[10px] text-gray-400 mb-1">
                        <span>Ejecutado</span>
                        <span className="font-bold text-[#1C1C1C]">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <div>
                        <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wide text-gray-400">Presupuesto</p>
                        <p className="font-['Space_Mono'] text-xs font-bold text-[#1C1C1C]">{fmt(budget)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wide text-gray-400">Gastos · {p._count?.expenses ?? 0}</p>
                        <p className="font-['Space_Mono'] text-xs font-bold" style={{ color: pct >= 90 ? '#ef4444' : '#1C1C1C' }}>
                          {fmt(expended)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Crédito de suplidores ────────────────────────────── */}
      {(isAdmin || isSupervisor) && creditSummaryData && creditSummaryData.lines.length > 0 && (
        <div id="credit-section" className="mt-8">
          <h2 className="font-['Barlow_Condensed'] text-2xl font-bold text-[#1C1C1C] uppercase tracking-tight mb-4">
            CRÉDITO DE SUPLIDORES
          </h2>
          <div className="bg-white border border-gray-200 overflow-hidden">
            {/* Tabla créditos — solo desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1C1C1C]">
                    {['SUPLIDOR', 'LÍMITE', 'CONSUMIDO', 'PENDIENTE', 'DISPONIBLE', 'ESTADO'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creditSummaryData.lines.slice(0, 10).map((line) => {
                    const ratio = line.creditLimit > 0 ? line.available / line.creditLimit : 1;
                    const status =
                      line.pending === 0 ? { label: 'SIN DEUDA', cls: 'bg-gray-100 text-gray-600' }
                      : ratio >= 0.20 ? { label: 'EN ORDEN', cls: 'bg-green-100 text-green-700' }
                      : ratio >= 0.10 ? { label: 'BAJO', cls: 'bg-yellow-100 text-yellow-700' }
                      : { label: 'CRÍTICO', cls: 'bg-red-100 text-red-700' };
                    return (
                      <tr key={line.creditLineId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-['DM_Sans'] font-medium text-[#1C1C1C]">{line.supplierName}</td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">RD$ {line.creditLimit.toLocaleString()}</td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">RD$ {line.consumed.toLocaleString()}</td>
                        <td className="px-4 py-3 font-['Space_Mono'] font-bold text-[#1C1C1C]">RD$ {line.pending.toLocaleString()}</td>
                        <td className="px-4 py-3 font-['Space_Mono'] text-gray-700">RD$ {line.available.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-['Barlow_Condensed'] font-bold uppercase tracking-wide ${status.cls}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Tarjetas créditos — solo móvil */}
            <div className="md:hidden divide-y divide-gray-100">
              {creditSummaryData.lines.slice(0, 10).map((line) => {
                const ratio = line.creditLimit > 0 ? line.available / line.creditLimit : 1;
                const status =
                  line.pending === 0 ? { label: 'SIN DEUDA', cls: 'bg-gray-100 text-gray-600' }
                  : ratio >= 0.20 ? { label: 'EN ORDEN', cls: 'bg-green-100 text-green-700' }
                  : ratio >= 0.10 ? { label: 'BAJO', cls: 'bg-yellow-100 text-yellow-700' }
                  : { label: 'CRÍTICO', cls: 'bg-red-100 text-red-700' };
                return (
                  <div key={line.creditLineId} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-['Barlow_Condensed'] font-bold text-base uppercase text-[#1C1C1C]">{line.supplierName}</p>
                      <span className={`text-xs px-2 py-0.5 font-['Barlow_Condensed'] font-bold uppercase ${status.cls}`}>{status.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Límite</p>
                        <p className="font-['Space_Mono'] text-xs">RD$ {line.creditLimit.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Disponible</p>
                        <p className="font-['Space_Mono'] text-xs text-green-600">RD$ {line.available.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Consumido</p>
                        <p className="font-['Space_Mono'] text-xs">RD$ {line.consumed.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-['Barlow_Condensed'] uppercase">Pendiente</p>
                        <p className="font-['Space_Mono'] text-xs text-red-600">RD$ {line.pending.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-right">
              <a href="/suppliers" className="text-xs font-['DM_Sans'] text-[#1C1C1C] hover:text-[#F5C218] underline">
                Ver todos en Suplidores →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Órdenes de pago pendientes ───────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="border border-gray-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
               style={{ borderLeft: '3px solid #F5C218' }}>
            <h2 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" /> Órdenes de pago pendientes
            </h2>
            <ViewAllLink to="/pending-orders" label="Ver todas" />
          </div>
          <div className="divide-y divide-gray-50">
            {pendingOrders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate">{o.supplier?.name}</p>
                  <p className="font-['Space_Mono'] text-[10px] text-gray-400">
                    {o.project?.code} · {o.concept}
                  </p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(o.amount))}</p>
                  <span className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wide px-2 py-0.5 font-bold"
                        style={{ background: '#F5C218', color: '#1C1C1C' }}>
                    Pendiente
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gastos recientes + Cotizaciones ─────────────────── */}
      {!isAuxiliar && (
        <div className="grid md:grid-cols-2 gap-6">

          <div className="border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] text-sm flex items-center gap-2">
                <span className="w-0.5 h-4 shrink-0" style={{ background: '#F5C218' }} />
                <Receipt className="w-4 h-4 text-gray-400" /> Gastos recientes
              </h2>
              <ViewAllLink to="/expenses" />
            </div>
            <div className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <p className="font-['DM_Sans'] text-center text-gray-400 py-8 text-sm">No hay gastos</p>
              ) : expenses.map((e) => (
                <Link key={e.id} to={`/expenses/${e.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0">
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate">{e.description}</p>
                    <p className="font-['Space_Mono'] text-[10px] text-gray-400">{e.project.code} · {e.category.name}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(e.amount))}</p>
                    <p className="font-['Space_Mono'] text-[10px] text-gray-400">{fmtDate(e.expenseDate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-['Barlow_Condensed'] font-bold uppercase tracking-wide text-[#1C1C1C] text-sm flex items-center gap-2">
                <span className="w-0.5 h-4 shrink-0" style={{ background: '#F5C218' }} />
                <FileText className="w-4 h-4 text-gray-400" /> Cotizaciones
              </h2>
              <ViewAllLink to="/quotations" label="Ver todas" />
            </div>
            <div className="divide-y divide-gray-50">
              {recentQuotations.length === 0 ? (
                <p className="font-['DM_Sans'] text-center text-gray-400 py-8 text-sm">No hay cotizaciones</p>
              ) : recentQuotations.map((q) => (
                <Link key={q.id} to={`/quotations/${q.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate">
                      {q.supplierName}
                      {q.quotationNumber && <span className="font-['Space_Mono'] text-[10px] text-gray-400 ml-1">#{q.quotationNumber}</span>}
                    </p>
                    <p className="font-['Space_Mono'] text-[10px] text-gray-400">{q.project.code} · {fmtDate(q.quotationDate)}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(q.total), q.currency)}</p>
                    <span className={`inline-flex text-[10px] px-2 py-0.5 font-bold font-['Barlow_Condensed'] uppercase tracking-wide ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
                      {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* CTA móvil */}
      {canCreateExpense && (
        <Link to="/expenses/new"
          className="flex items-center justify-center gap-2 w-full sm:hidden py-4 text-base font-bold uppercase tracking-wide font-['Barlow_Condensed']"
          style={{ background: '#F5C218', color: '#1C1C1C' }}>
          <Plus className="w-5 h-5" /> Registrar nuevo gasto
        </Link>
      )}

      {/* Dashboard ejecutivo multi-proyecto — admin/supervisor only */}
      {(isAdmin || isSupervisor) && portfolio.length > 0 && (
        <div className="px-4 md:px-6 py-4 md:py-5 space-y-3">
          <SectionHeader
            icon={TrendingUp}
            title="Portafolio de Proyectos"
            action={
              <Link to="/reports" className="text-xs font-bold uppercase tracking-wide text-gray-400 hover:text-[#1C1C1C] flex items-center gap-1 transition-colors font-['Barlow_Condensed']">
                Reporte varianza <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          {/* Tabla portfolio — solo desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  {['Código', 'Proyecto', 'Estado', 'Presupuesto', 'Ejecutado', 'Comprometido', 'Disponible', '%'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-gray-400 uppercase tracking-[0.1em] text-xs whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.map((p, idx) => {
                  const pct      = p.pctUsed;
                  const semaforo = pct >= 1 ? 'bg-red-500' : pct >= 0.9 ? 'bg-orange-400' : pct >= 0.7 ? 'bg-yellow-400' : 'bg-green-500';
                  const rowCls   = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  const fmtP     = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
                  const STATUS_LABEL: Record<string, string> = {
                    ACTIVE: 'Activo', COMPLETED: 'Completado', ON_HOLD: 'En pausa', CANCELLED: 'Cancelado',
                  };
                  return (
                    <tr key={p.id} className={`${rowCls} hover:bg-[#F5C218]/5 transition-colors`}>
                      <td className="px-3 py-2 font-['Space_Mono'] text-gray-500 whitespace-nowrap">{p.code}</td>
                      <td className="px-3 py-2 font-['DM_Sans'] text-gray-800 max-w-[200px] truncate">
                        <Link to={`/projects/${p.id}`} className="hover:text-[#1C1C1C] hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase font-['Barlow_Condensed'] bg-gray-100 text-gray-600">
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-['Space_Mono'] text-right whitespace-nowrap">{fmtP(p.totalBudget)}</td>
                      <td className="px-3 py-2 font-['Space_Mono'] text-right whitespace-nowrap">{fmtP(p.spent)}</td>
                      <td className="px-3 py-2 font-['Space_Mono'] text-right whitespace-nowrap text-blue-600">{fmtP(p.committed)}</td>
                      <td className={`px-3 py-2 font-['Space_Mono'] text-right whitespace-nowrap font-bold ${p.available < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                        {fmtP(p.available)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 shrink-0 ${semaforo}`} />
                          <span className={`font-['Space_Mono'] font-bold text-[11px] ${pct >= 1 ? 'text-red-600' : pct >= 0.9 ? 'text-orange-500' : pct >= 0.7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {(pct * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Tarjetas portfolio — solo móvil */}
          <div className="md:hidden bg-white border border-gray-200 divide-y divide-gray-100">
            {portfolio.map((p) => {
              const pct      = p.pctUsed;
              const fmtP     = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
              const STATUS_LABEL: Record<string, string> = {
                ACTIVE: 'Activo', COMPLETED: 'Completado', ON_HOLD: 'En pausa', CANCELLED: 'Cancelado',
              };
              const semaforo = pct >= 1 ? 'bg-red-500' : pct >= 0.9 ? 'bg-orange-400' : pct >= 0.7 ? 'bg-yellow-400' : 'bg-green-500';
              return (
                <div key={p.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 mr-2">
                      <Link to={`/projects/${p.id}`} className="font-['Barlow_Condensed'] font-bold text-base uppercase text-[#1C1C1C] hover:underline block truncate">
                        {p.name}
                      </Link>
                      <span className="font-['Space_Mono'] text-[10px] text-gray-400">{p.code}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 font-bold uppercase font-['Barlow_Condensed'] bg-gray-100 text-gray-600 shrink-0">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Presupuesto</p>
                      <p className="font-['Space_Mono'] text-xs">{fmtP(p.totalBudget)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Ejecutado</p>
                      <p className="font-['Space_Mono'] text-xs">{fmtP(p.spent)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Comprometido</p>
                      <p className="font-['Space_Mono'] text-xs text-blue-600">{fmtP(p.committed)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-['Barlow_Condensed']">Disponible</p>
                      <p className={`font-['Space_Mono'] text-xs font-bold ${p.available < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtP(p.available)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100">
                      <div className={`h-1.5 ${semaforo}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                    </div>
                    <span className={`font-['Space_Mono'] font-bold text-[11px] ${pct >= 1 ? 'text-red-600' : pct >= 0.9 ? 'text-orange-500' : pct >= 0.7 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {(pct * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 pt-1">
            {[
              { color: 'bg-green-500', label: '< 70%' },
              { color: 'bg-yellow-400', label: '70–90%' },
              { color: 'bg-orange-400', label: '90–100%' },
              { color: 'bg-red-500',   label: '> 100%' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-2 h-2 ${color}`} />
                <span className="text-[10px] text-gray-400 font-['DM_Sans']">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aviso DGII */}
      {canCreateExpense && (
        <div className="border-l-4 p-4 flex items-start gap-3" style={{ borderColor: '#F5C218', background: '#FFFBEB' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#F5C218' }} />
          <p className="font-['DM_Sans'] text-xs text-amber-800">
            <strong className="font-['Barlow_Condensed'] uppercase tracking-wide">Recuerda:</strong>{' '}
            Todo gasto con comprobante fiscal debe incluir NCF y RNC del suplidor para cumplimiento con la DGII.
          </p>
        </div>
      )}

    </div>
  );
}
