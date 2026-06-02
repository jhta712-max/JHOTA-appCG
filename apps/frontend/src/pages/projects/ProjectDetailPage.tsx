import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, FolderOpen, MapPin, User,
  Calendar, TrendingUp, Receipt, Edit, AlertCircle, BarChart2, FileText, ChevronRight, Upload,
} from 'lucide-react';
import { projectsApi, expensesApi, quotationsApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { PAYMENT_METHOD_LABELS, PROJECT_STATUS_LABELS } from '../../types';
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, type QuotationStatus } from '../../types/quotation';
import { fmtDate } from '../../utils/date';

function fmt(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active', PAUSED: 'badge-paused',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

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

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando proyecto...</div>;
  if (!summaryData) return <div className="text-center py-20 text-gray-400">Proyecto no encontrado</div>;

  const { project, summary, byCategory, addendums = [] } = summaryData;
  const expenses   = expensesData?.data ?? [];
  const quotations = quotationsData?.data ?? [];
  const usedPct    = Math.min(summary.budgetUsedPct, 100);
  const barColor = usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/projects')} className="text-gray-400 hover:text-gray-600 p-1 mt-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
            <span className={STATUS_BADGE[project.status]}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{project.code}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <>
              <Link to={`/projects/import-batches`}
                className="btn-secondary text-sm">
                <Upload className="w-4 h-4" /> Importar
              </Link>
              <Link to={`/projects/${id}/financial`}
                className="btn-secondary text-sm">
                <BarChart2 className="w-4 h-4" /> Análisis financiero
              </Link>
              <Link to={`/projects/${id}/edit`} className="btn-secondary text-sm">
                <Edit className="w-4 h-4" /> Editar
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Info del proyecto */}
      {projectData && (
        <div className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {projectData.client && (
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Cliente</p><p className="font-medium text-gray-800">{projectData.client}</p></div>
              </div>
            )}
            {projectData.location && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Ubicación</p><p className="font-medium text-gray-800">{projectData.location}</p></div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Inicio</p><p className="font-medium text-gray-800">{fmtDate(projectData.startDate)}</p></div>
            </div>
            <div className="flex items-start gap-2">
              <Receipt className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Gastos</p>
                {projectData.batchesEnabled ? (
                  <div className="space-y-1 mt-1">
                    {summaryData?.byItem ? (
                      summaryData.byItem.map((item: any) => (
                        <div key={item.itemId} className="text-sm">
                          <p className="font-medium text-gray-800">{item.itemCode}: {fmt(item.totalAmount)}</p>
                          <p className="text-xs text-gray-400">{item.count} registros</p>
                        </div>
                      ))
                    ) : (
                      <p className="font-medium text-gray-800">{summary.expenseCount} registros</p>
                    )}
                  </div>
                ) : (
                  <p className="font-medium text-gray-800">{summary.expenseCount} registros</p>
                )}
              </div>
            </div>
          </div>
          {projectData.notes && (
            <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">{projectData.notes}</p>
          )}
        </div>
      )}

      {/* Resumen financiero */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" /> Resumen financiero
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">
              Presupuesto{addendums.length > 0 ? ' total' : ''}
            </p>
            <p className="text-lg font-bold text-gray-900">
              {fmt(project.totalBudget ?? project.estimatedBudget)}
            </p>
            {addendums.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Base + {addendums.length} adenda{addendums.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Gastado</p>
            <p className="text-lg font-bold text-red-700">{fmt(summary.totalSpent)}</p>
          </div>
          <div className={`text-center p-3 rounded-xl ${summary.budgetRemaining >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-gray-500 mb-1">Disponible</p>
            <p className={`text-lg font-bold ${summary.budgetRemaining >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(Math.abs(summary.budgetRemaining))}
              {summary.budgetRemaining < 0 && <span className="text-xs ml-1">(exceso)</span>}
            </p>
          </div>
        </div>

        {/* Desglose de adendas */}
        {addendums.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-xs">
            <div className="flex justify-between px-3 py-2 text-gray-500">
              <span>Presupuesto base</span>
              <span className="font-medium">{fmt(project.estimatedBudget)}</span>
            </div>
            {addendums.map((a: any) => (
              <div key={a.id} className="flex justify-between px-3 py-2 text-gray-500">
                <span>Adenda #{a.number} — {a.description}</span>
                <span className="font-medium text-green-700">+ {fmt(a.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Presupuesto utilizado</span>
            <span className="font-semibold">{summary.budgetUsedPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${usedPct}%` }} />
          </div>
          {summary.budgetUsedPct >= 90 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              Presupuesto casi agotado ({summary.budgetUsedPct.toFixed(1)}% utilizado)
            </div>
          )}
        </div>

        {/* Por categoría */}
        {byCategory.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Gastos por categoría</p>
            <div className="space-y-2">
              {byCategory.sort((a, b) => b.totalAmount - a.totalAmount).map((bc) => {
                const pct = summary.totalSpent > 0 ? (bc.totalAmount / summary.totalSpent) * 100 : 0;
                return (
                  <div key={bc.category?.id}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="font-medium">{bc.category?.name}</span>
                      <span>{fmt(bc.totalAmount)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cotizaciones del proyecto */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Cotizaciones
            {quotationsData?.pagination?.total != null && quotationsData.pagination.total > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {quotationsData.pagination.total}
              </span>
            )}
          </h2>
          <Link to={`/quotations/new?projectId=${id}`} className="btn-secondary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" /> Nueva cotización
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {quotations.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">No hay cotizaciones en este proyecto</p>
          ) : (
            quotations.map((q) => (
              <Link key={q.id} to={`/quotations/${q.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">
                    {q.supplierName}
                    {q.quotationNumber && (
                      <span className="text-xs text-gray-400 font-mono ml-1">#{q.quotationNumber}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{q.description.slice(0, 60)}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Intl.NumberFormat('es-DO', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(Number(q.total))}
                  </p>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${QUOTATION_STATUS_COLORS[q.status as QuotationStatus]}`}>
                    {QUOTATION_STATUS_LABELS[q.status as QuotationStatus]}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))
          )}
        </div>
        {(quotationsData?.pagination?.total ?? 0) > 5 && (
          <div className="px-5 py-3 border-t border-gray-100">
            <Link to={`/quotations?projectId=${id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Ver todas las cotizaciones →
            </Link>
          </div>
        )}
      </div>

      {/* Gastos del proyecto */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Gastos recientes</h2>
          <Link to={`/expenses/new`} state={{ projectId: id }} className="btn-primary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" /> Nuevo gasto
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {expenses.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No hay gastos registrados</p>
          ) : (
            expenses.map((e) => (
              <Link key={e.id} to={`/expenses/${e.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700">{e.description}</p>
                  <p className="text-xs text-gray-400">
                    {e.category.name} · {PAYMENT_METHOD_LABELS[e.paymentMethod]}
                    {e.hasFiscalDoc && <span className="text-blue-500 ml-1">· NCF</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{fmt(Number(e.amount))}</p>
                  <p className="text-xs text-gray-400">{fmtDate(e.expenseDate)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
        {(expensesData?.pagination?.total ?? 0) > 20 && (
          <div className="px-5 py-3 border-t border-gray-100">
            <Link to={`/expenses?projectId=${id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Ver todos los gastos →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
