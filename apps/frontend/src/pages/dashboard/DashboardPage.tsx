import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Receipt, Plus, ArrowRight,
  AlertCircle, FileText, Clock, ChevronRight, TrendingUp, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { projectsApi, expensesApi, quotationsApi, paymentOrdersApi } from '../../api';
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

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { canCreateExpense, canViewFinancials, isAuxiliar, isFinanciero, canViewReports } = useRole();

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

  // Stats globales
  const totalBudget        = projects.reduce((s, p) => s + Number(p.estimatedBudget ?? 0), 0);
  const totalExpended      = projects.reduce((s, p) => s + Number((p as any).totalExpenses ?? 0), 0);
  const totalPendingAmount = pendingOrders.reduce((s: number, o: any) => s + Number(o.amount), 0);

  return (
    <div className="space-y-0">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="bg-[#1C1C1C] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-8 pb-6 mb-8 relative overflow-hidden">
        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 8px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 8px)' }} />

        <div className="relative flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-['Barlow_Condensed'] uppercase tracking-[0.3em] text-[#F5C218] text-xs mb-2">
              Panel de Control · SERVINGMI
            </p>
            <h1 className="font-['Barlow_Condensed'] uppercase text-white leading-none" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.01em' }}>
              {greeting()},<br />
              <span style={{ color: '#F5C218' }}>{user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="font-['DM_Sans'] text-gray-400 text-sm mt-2">
              Aquí está el resumen de hoy
            </p>
          </div>
          <div className="flex gap-3">
            {canCreateExpense && (
              <Link to="/expenses/new"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 font-['Barlow_Condensed'] uppercase tracking-wider text-sm font-semibold bg-[#F5C218] text-[#1C1C1C] hover:bg-yellow-300 transition-colors">
                <Plus className="w-4 h-4" /> Nuevo gasto
              </Link>
            )}
            {canViewReports && !canCreateExpense && (
              <Link to="/reports"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 font-['Barlow_Condensed'] uppercase tracking-wider text-sm font-semibold border border-[#F5C218] text-[#F5C218] hover:bg-[#F5C218] hover:text-[#1C1C1C] transition-colors">
                <TrendingUp className="w-4 h-4" /> Ver reportes
              </Link>
            )}
          </div>
        </div>

        {/* Yellow accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#F5C218]" />
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">

        {/* Proyectos activos */}
        <div className="bg-[#1C1C1C] border-l-4 border-[#F5C218] p-4 hover:scale-[1.02] transition-transform">
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-400 text-[10px] mb-2">
            Proyectos activos
          </p>
          <p className="font-['Space_Mono'] text-[#F5C218]" style={{ fontSize: '2rem', lineHeight: 1 }}>
            {projects.length}
          </p>
          <p className="font-['DM_Sans'] text-gray-500 text-[11px] mt-1">en ejecución</p>
        </div>

        {/* Gastos registrados */}
        <div className="bg-[#1C1C1C] border-l-4 border-[#F5C218] p-4 hover:scale-[1.02] transition-transform">
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-400 text-[10px] mb-2">
            Gastos registrados
          </p>
          <p className="font-['Space_Mono'] text-[#F5C218]" style={{ fontSize: '2rem', lineHeight: 1 }}>
            {expensesData?.pagination?.total ?? 0}
          </p>
          <p className="font-['DM_Sans'] text-gray-500 text-[11px] mt-1">total acumulado</p>
        </div>

        {/* Cotizaciones abiertas */}
        <div className="bg-[#1C1C1C] border-l-4 border-[#F5C218] p-4 hover:scale-[1.02] transition-transform">
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-400 text-[10px] mb-2">
            Cotizaciones abiertas
          </p>
          <p className="font-['Space_Mono'] text-[#F5C218]" style={{ fontSize: '2rem', lineHeight: 1 }}>
            {openQuotations.length}
          </p>
          <p className="font-['DM_Sans'] text-gray-500 text-[11px] mt-1 truncate">
            {totalOpenAmount > 0 ? fmt(totalOpenAmount) : 'sin monto'}
          </p>
        </div>

        {/* Presupuesto total */}
        <div className="bg-[#1C1C1C] border-l-4 border-[#F5C218] p-4 hover:scale-[1.02] transition-transform">
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-400 text-[10px] mb-2">
            Presupuesto total
          </p>
          <p className="font-['Space_Mono'] text-[#F5C218] truncate" style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
            {fmt(totalBudget)}
          </p>
          <p className="font-['DM_Sans'] text-gray-500 text-[11px] mt-1">todos los proyectos</p>
        </div>

        {/* Pagos pendientes */}
        <Link to="/pending-orders"
          className="bg-[#1C1C1C] border-l-4 border-[#F5C218] p-4 hover:scale-[1.02] transition-transform col-span-2 md:col-span-1 group block">
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-400 text-[10px] mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#F5C218]" /> Pagos pendientes
          </p>
          <p className={`font-['Space_Mono'] ${pendingOrders.length > 0 ? 'text-[#F5C218]' : 'text-gray-500'}`}
            style={{ fontSize: '2rem', lineHeight: 1 }}>
            {pendingOrders.length}
          </p>
          <p className="font-['DM_Sans'] text-gray-500 text-[11px] mt-1 truncate">
            {totalPendingAmount > 0 ? fmt(totalPendingAmount) : 'ninguno pendiente'}
          </p>
        </Link>

      </div>

      {/* ── Gráficas ─────────────────────────────────────────────── */}
      {canViewFinancials && statsData && (
        <div className="grid md:grid-cols-2 gap-5 mb-8">

          {/* Gastos por mes */}
          <div className="p-5" style={{ background: '#111' }}>
            <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px] mb-1">
              Análisis mensual
            </p>
            <h2 className="font-['Barlow_Condensed'] uppercase text-white text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F5C218]" />
              Gastos por mes
            </h2>
            {statsData.byMonth.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <TrendingUp className="w-8 h-8 text-[#F5C218] opacity-40" />
                <p className="font-['DM_Sans'] text-sm text-gray-600">Sin datos disponibles</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statsData.byMonth} barSize={28} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'Space Mono' }}
                    axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,194,24,0.06)' }}
                    formatter={(v) => [fmt(Number(v)), 'Total']}
                    contentStyle={{ fontSize: 12, borderRadius: 0, border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#fff', fontFamily: 'DM Sans' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                    {statsData.byMonth.map((_, i) => (
                      <Cell key={i} fill={i === statsData.byMonth.length - 1 ? '#F5C218' : '#3a2e06'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gastos por categoría */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px] mb-1">
              Distribución
            </p>
            <h2 className="font-['Barlow_Condensed'] uppercase text-[#1C1C1C] text-lg font-bold mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#F5C218]" />
              Gastos por categoría
            </h2>
            {statsData.byCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Receipt className="w-8 h-8 text-[#F5C218] opacity-40" />
                <p className="font-['DM_Sans'] text-sm text-gray-400">Sin datos disponibles</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statsData.byCategory.map((cat, i) => {
                  const colors = ['#F5C218','#e6b310','#d4a30e','#c2920c','#b0820a','#9e7108','#8c6106'];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-['DM_Sans'] text-xs font-medium text-gray-700 truncate max-w-[55%]">{cat.name}</span>
                        <span className="font-['Space_Mono'] text-[10px] text-gray-500 shrink-0 ml-2">{cat.pct}% · {fmt(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${cat.pct}%`, background: colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Alerta cotizaciones próximas a vencer ─────────────────── */}
      {expiring.length > 0 && (
        <div className="border-l-4 border-orange-500 bg-orange-50 p-4 mb-8 space-y-2">
          <div className="flex items-center gap-2 font-['Barlow_Condensed'] uppercase tracking-wider text-orange-700 text-sm font-bold">
            <Clock className="w-4 h-4 shrink-0" />
            {expiring.length} cotización{expiring.length > 1 ? 'es vencen' : ' vence'} en los próximos 7 días
          </div>
          {expiring.map((q) => (
            <Link key={q.id} to={`/quotations/${q.id}`}
              className="flex items-center justify-between font-['DM_Sans'] text-xs text-orange-600 hover:text-orange-800">
              <span className="truncate">{q.supplierName} — {q.project.code}</span>
              <span className="ml-2 shrink-0 font-['Space_Mono'] text-[10px]">vence {fmtDate(q.validUntil!)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Proyectos activos ─────────────────────────────────────── */}
      {!isAuxiliar && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px]">Obra en curso</p>
              <h2 className="font-['Barlow_Condensed'] uppercase text-[#1C1C1C] text-xl font-bold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#F5C218]" />
                Proyectos activos
              </h2>
            </div>
            <Link to="/projects"
              className="font-['Barlow_Condensed'] uppercase tracking-wider text-xs font-semibold text-[#1C1C1C] border border-[#1C1C1C] px-4 py-2 hover:bg-[#1C1C1C] hover:text-white transition-colors flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="bg-[#1C1C1C] p-12 flex flex-col items-center gap-3">
              <FolderOpen className="w-10 h-10 text-[#F5C218] opacity-40" />
              <p className="font-['DM_Sans'] text-gray-500 text-sm">No hay proyectos activos</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((p) => {
                const budget   = Number(p.estimatedBudget ?? 0);
                const expended = Number((p as any).totalExpenses ?? 0);
                const pct      = budget > 0 ? Math.min(Math.round((expended / budget) * 100), 100) : 0;
                const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#F5C218' : '#22c55e';

                return (
                  <Link key={p.id} to={`/projects/${p.id}`}
                    className="bg-white border border-gray-100 p-5 hover:border-[#F5C218] hover:shadow-lg transition-all group space-y-3 block">

                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-['Barlow_Condensed'] uppercase font-bold text-[#1C1C1C] truncate group-hover:text-[#a07c10] text-base leading-tight">
                          {p.name}
                        </p>
                        <p className="font-['Space_Mono'] text-gray-400 text-[10px] mt-0.5">{p.code} · {p.client ?? 'Sin cliente'}</p>
                      </div>
                      <span className="ml-2 shrink-0 font-['Barlow_Condensed'] uppercase text-[10px] tracking-wider bg-[#F5C218] text-[#1C1C1C] px-2 py-0.5 font-bold">
                        Activo
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-['DM_Sans'] text-[10px] text-gray-400 uppercase tracking-wider">Ejecutado</span>
                        <span className="font-['Space_Mono'] text-xs font-bold" style={{ color: barColor }}>{pct}%</span>
                      </div>
                      <div className="h-1 bg-gray-100 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
                      <div>
                        <p className="font-['DM_Sans'] text-[10px] text-gray-400 uppercase tracking-wider">Presupuesto</p>
                        <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(budget)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-['DM_Sans'] text-[10px] text-gray-400 uppercase tracking-wider">Gastos · {p._count?.expenses ?? 0}</p>
                        <p className={`font-['Space_Mono'] text-sm font-bold ${pct >= 90 ? 'text-red-600' : 'text-[#1C1C1C]'}`}>
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

      {/* ── Órdenes de pago pendientes ────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="bg-white border border-gray-100 mb-8">
          <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#F5C218]">
            <div>
              <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px]">Finanzas</p>
              <h2 className="font-['Barlow_Condensed'] uppercase text-[#1C1C1C] text-lg font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#F5C218]" /> Órdenes de pago pendientes
              </h2>
            </div>
            <Link to="/pending-orders"
              className="font-['Barlow_Condensed'] uppercase tracking-wider text-xs font-semibold text-[#1C1C1C] border border-[#1C1C1C] px-4 py-2 hover:bg-[#1C1C1C] hover:text-white transition-colors flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingOrders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate">{o.supplier?.name}</p>
                  <p className="font-['Space_Mono'] text-[10px] text-gray-400">
                    {o.project?.code} · {o.concept}
                  </p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(o.amount))}</p>
                  <span className="font-['Barlow_Condensed'] uppercase text-[10px] tracking-wider px-2 py-0.5 bg-amber-100 text-amber-700 font-bold">
                    Pendiente
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gastos recientes + Cotizaciones ──────────────────────── */}
      {!isAuxiliar && (
        <div className="grid md:grid-cols-2 gap-6 mb-8">

          {/* Gastos recientes */}
          <div className="bg-white border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#F5C218]">
              <div>
                <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px]">Registro</p>
                <h2 className="font-['Barlow_Condensed'] uppercase text-[#1C1C1C] text-lg font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#F5C218]" /> Gastos recientes
                </h2>
              </div>
              <Link to="/expenses"
                className="font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] font-semibold text-[#1C1C1C] border border-[#1C1C1C] px-3 py-1.5 hover:bg-[#1C1C1C] hover:text-white transition-colors flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Receipt className="w-8 h-8 text-[#F5C218] opacity-40" />
                  <p className="font-['DM_Sans'] text-sm text-gray-400">No hay gastos registrados</p>
                </div>
              ) : expenses.map((e) => (
                <Link key={e.id} to={`/expenses/${e.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0">
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate group-hover:text-[#a07c10]">{e.description}</p>
                    <p className="font-['Space_Mono'] text-[10px] text-gray-400">{e.project.code} · {e.category.name}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(e.amount))}</p>
                    <p className="font-['DM_Sans'] text-[10px] text-gray-400">{fmtDate(e.expenseDate)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Cotizaciones recientes */}
          <div className="bg-white border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#F5C218]">
              <div>
                <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-gray-500 text-[10px]">Compras</p>
                <h2 className="font-['Barlow_Condensed'] uppercase text-[#1C1C1C] text-lg font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#F5C218]" /> Cotizaciones
                </h2>
              </div>
              <Link to="/quotations"
                className="font-['Barlow_Condensed'] uppercase tracking-wider text-[10px] font-semibold text-[#1C1C1C] border border-[#1C1C1C] px-3 py-1.5 hover:bg-[#1C1C1C] hover:text-white transition-colors flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentQuotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <FileText className="w-8 h-8 text-[#F5C218] opacity-40" />
                  <p className="font-['DM_Sans'] text-sm text-gray-400">No hay cotizaciones</p>
                </div>
              ) : recentQuotations.map((q) => (
                <Link key={q.id} to={`/quotations/${q.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#1C1C1C] truncate group-hover:text-[#a07c10]">
                      {q.supplierName}
                      {q.quotationNumber && <span className="font-['Space_Mono'] text-[10px] text-gray-400 ml-1">#{q.quotationNumber}</span>}
                    </p>
                    <p className="font-['Space_Mono'] text-[10px] text-gray-400">{q.project.code} · {fmtDate(q.quotationDate)}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-['Space_Mono'] text-sm font-bold text-[#1C1C1C]">{fmt(Number(q.total), q.currency)}</p>
                    <span className={`inline-flex font-['Barlow_Condensed'] uppercase text-[10px] tracking-wider px-2 py-0.5 font-bold ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
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

      {/* Mobile CTA */}
      {canCreateExpense && (
        <Link to="/expenses/new"
          className="flex items-center justify-center gap-2 w-full sm:hidden py-4 bg-[#F5C218] text-[#1C1C1C] font-['Barlow_Condensed'] uppercase tracking-wider text-base font-bold hover:bg-yellow-300 transition-colors mb-4">
          <Plus className="w-5 h-5" /> Registrar nuevo gasto
        </Link>
      )}

      {/* DGII reminder */}
      {canCreateExpense && (
        <div className="flex items-start gap-3 border-l-4 border-[#F5C218] bg-amber-50 p-4 mb-8">
          <AlertCircle className="w-4 h-4 text-[#a07c10] shrink-0 mt-0.5" />
          <p className="font-['DM_Sans'] text-xs text-amber-800">
            <strong className="font-['Barlow_Condensed'] uppercase tracking-wide">Recuerda:</strong>{' '}
            Todo gasto con comprobante fiscal debe incluir NCF y RNC del suplidor para cumplimiento con la DGII.
          </p>
        </div>
      )}

    </div>
  );
}
