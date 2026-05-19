import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FolderOpen, Receipt, TrendingUp, Plus, ArrowRight, AlertCircle } from 'lucide-react';
import { projectsApi, expensesApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { PAYMENT_METHOD_LABELS } from '../../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(amount);
}

function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'dashboard'],
    queryFn:  () => projectsApi.list({ limit: 5, status: 'ACTIVE', orderBy: 'createdAt', order: 'desc' }),
    select:   (r) => r.data,
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses', 'recent'],
    queryFn:  () => expensesApi.list({ limit: 6, status: 'ACTIVE', orderBy: 'createdAt', order: 'desc' }),
    select:   (r) => r.data,
  });

  const { data: allProjectsData } = useQuery({
    queryKey: ['projects', 'all-count'],
    queryFn:  () => projectsApi.list({ limit: 1 }),
    select:   (r) => r.data,
  });

  const projects       = projectsData?.data ?? [];
  const expenses       = expensesData?.data ?? [];
  const totalProjects  = allProjectsData?.pagination?.total ?? 0;
  const totalExpenses  = expensesData?.pagination?.total ?? 0;
  const monthTotal     = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {greeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Aquí está el resumen de hoy</p>
        </div>
        <Link to="/expenses/new" className="btn-primary text-sm hidden sm:flex">
          <Plus className="w-4 h-4" />
          Nuevo gasto
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={FolderOpen}  label="Proyectos activos" value={projects.length}  color="bg-blue-50 text-blue-600"   sub={`${totalProjects} en total`} />
        <StatCard icon={Receipt}     label="Gastos recientes"  value={totalExpenses}    color="bg-green-50 text-green-600" sub="últimos registrados" />
        <StatCard icon={TrendingUp}  label="Total gastos"      value={formatCurrency(monthTotal)} color="bg-purple-50 text-purple-600" sub="en esta vista" />
      </div>

      {/* Botón móvil rápido */}
      <Link to="/expenses/new" className="btn-primary w-full sm:hidden py-4 text-base">
        <Plus className="w-5 h-5" />
        Registrar nuevo gasto
      </Link>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Proyectos activos */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Proyectos activos</h2>
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {projects.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay proyectos activos</p>
            ) : (
              projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.code} · {p.client ?? 'Sin cliente'}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-xs font-medium text-gray-700">{formatCurrency(Number(p.estimatedBudget))}</p>
                    <p className="text-xs text-gray-400">{p._count?.expenses ?? 0} gastos</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Gastos recientes */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Gastos recientes</h2>
            <Link to="/expenses" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No hay gastos registrados</p>
            ) : (
              expenses.map((e) => (
                <Link key={e.id} to={`/expenses/${e.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{e.description}</p>
                    <p className="text-xs text-gray-400">
                      {e.project.code} · {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                    </p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(e.amount))}</p>
                    <p className="text-xs text-gray-400">{new Date(e.expenseDate).toLocaleDateString('es-DO')}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Aviso fiscal */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Recuerda:</strong> Todo gasto con comprobante fiscal debe incluir NCF y RNC del suplidor para cumplimiento con la DGII.
          El sistema acepta NCF tradicional (11 chars) y e-NCF electrónico (13 chars).
        </p>
      </div>
    </div>
  );
}
