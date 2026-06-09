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
    <div className="space-y-6">

      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.6rem' }}>
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Aquí está el resumen de hoy</p>
        </div>
        {canCreateExpense && (
          <Link to="/expenses/new" className="btn-primary text-sm hidden sm:flex">
            <Plus className="w-4 h-4" /> Nuevo gasto
          </Link>
        )}
        {canViewReports && !canCreateExpense && (
          <Link to="/reports" className="btn-secondary text-sm hidden sm:flex">
            <TrendingUp className="w-4 h-4" /> Ver reportes
          </Link>
        )}
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Proyectos activos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">en ejecución</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Gastos registrados</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{expensesData?.pagination?.total ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">total acumulado</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Cotizaciones abiertas</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{openQuotations.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{totalOpenAmount > 0 ? fmt(totalOpenAmount) : 'sin monto'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Presupuesto total</p>
          <p className="text-sm font-bold text-gray-900 mt-1 truncate">{fmt(totalBudget)}</p>
          <p className="text-xs text-gray-400 mt-0.5">todos los proyectos</p>
        </div>
        <Link to="/pending-orders" className="card p-4 hover:border-amber-300 hover:shadow-sm transition-all group col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" /> Pagos pendientes
          </p>
          <p className={`text-2xl font-bold mt-1 ${pendingOrders.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {pendingOrders.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {totalPendingAmount > 0 ? fmt(totalPendingAmount) : 'ninguno pendiente'}
          </p>
        </Link>
      </div>

      {/* ── Gráficas ─────────────────────────────────────────── */}
      {canViewFinancials && statsData && (
        <div className="grid md:grid-cols-2 gap-5">

          {/* Gastos por mes */}
          <div className="rounded-xl p-5" style={{ background: '#1C1C1C' }}>
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: '#F5C218' }}>
              <TrendingUp className="w-4 h-4" />
              Gastos por mes
            </h2>
            {statsData.byMonth.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: '#555' }}>Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statsData.byMonth} barSize={28} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d2d2d" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,194,24,0.08)' }}
                    formatter={(v) => [fmt(Number(v)), 'Total']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #333', background: '#252525', color: '#fff' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {statsData.byMonth.map((_, i) => (
                      <Cell key={i} fill={i === statsData.byMonth.length - 1 ? '#F5C218' : '#a07c10'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gastos por categoría */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-500" />
              Gastos por categoría
            </h2>
            {statsData.byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Sin datos</p>
            ) : (
              <div className="space-y-2.5">
                {statsData.byCategory.map((cat, i) => {
                  const colors = ['#F5C218','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f'];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate max-w-[60%]">{cat.name}</span>
                        <span className="text-gray-500 shrink-0 ml-2">{cat.pct}% · {fmt(cat.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.pct}%`, background: colors[i] }} />
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
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-orange-700 font-medium text-sm">
            <Clock className="w-4 h-4 shrink-0" />
            {expiring.length} cotización{expiring.length > 1 ? 'es vencen' : ' vence'} en los próximos 7 días
          </div>
          {expiring.map((q) => (
            <Link key={q.id} to={`/quotations/${q.id}`}
              className="flex items-center justify-between text-xs text-orange-600 hover:text-orange-800">
              <span className="truncate">{q.supplierName} — {q.project.code}</span>
              <span className="ml-2 shrink-0 font-medium">vence {fmtDate(q.validUntil!)}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── TARJETAS POR PROYECTO ─────────────────────────────── */}
      {!isAuxiliar && <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-500" />
            Proyectos activos
          </h2>
          <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">No hay proyectos activos</div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p) => {
              const budget   = Number(p.estimatedBudget ?? 0);
              const expended = Number((p as any).totalExpenses ?? 0);
              const pct      = budget > 0 ? Math.min(Math.round((expended / budget) * 100), 100) : 0;
              const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';

              return (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="card p-5 hover:border-primary-200 hover:shadow-md transition-all group space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate group-hover:text-primary-700 text-sm leading-tight">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.code} · {p.client ?? 'Sin cliente'}</p>
                    </div>
                    <span className="ml-2 shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Activo
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Ejecutado</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
                    <div>
                      <p className="text-xs text-gray-400">Presupuesto</p>
                      <p className="text-sm font-semibold text-gray-900">{fmt(budget)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Gastos · {p._count?.expenses ?? 0}</p>
                      <p className={`text-sm font-semibold ${pct >= 90 ? 'text-red-600' : 'text-gray-900'}`}>
                        {fmt(expended)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>}

      {/* Órdenes de pago pendientes */}
      {pendingOrders.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" /> Órdenes de pago pendientes
            </h2>
            <Link to="/pending-orders" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingOrders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{o.supplier?.name}</p>
                  <p className="text-xs text-gray-400">
                    {o.project?.code} · {o.concept}
                  </p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{fmt(Number(o.amount))}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    Pendiente
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAuxiliar && <div className="grid md:grid-cols-2 gap-6">

        {/* Gastos recientes */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-500" /> Gastos recientes
            </h2>
            <Link to="/expenses" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay gastos</p>
            ) : expenses.map((e) => (
              <Link key={e.id} to={`/expenses/${e.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{e.description}</p>
                  <p className="text-xs text-gray-400">{e.project.code} · {e.category.name}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{fmt(Number(e.amount))}</p>
                  <p className="text-xs text-gray-400">{fmtDate(e.expenseDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Cotizaciones recientes */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> Cotizaciones
            </h2>
            <Link to="/quotations" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentQuotations.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay cotizaciones</p>
            ) : recentQuotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">
                    {q.supplierName}
                    {q.quotationNumber && <span className="text-xs text-gray-400 font-mono ml-1">#{q.quotationNumber}</span>}
                  </p>
                  <p className="text-xs text-gray-400">{q.project.code} · {fmtDate(q.quotationDate)}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{fmt(Number(q.total), q.currency)}</p>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
                    {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

      </div>}

      {canCreateExpense && (
        <Link to="/expenses/new" className="btn-primary w-full sm:hidden py-4 text-base">
          <Plus className="w-5 h-5" /> Registrar nuevo gasto
        </Link>
      )}

      {canCreateExpense && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Recuerda:</strong> Todo gasto con comprobante fiscal debe incluir NCF y RNC del suplidor para cumplimiento con la DGII.
          </p>
        </div>
      )}

    </div>
  );
}
