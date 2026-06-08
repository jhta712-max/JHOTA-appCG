import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Search, ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import clsx from 'clsx';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'badge-active',
  PAUSED:    'badge-paused',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo', PAUSED: 'Pausado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

export default function ProjectsPage() {
  const { canCreateProject } = useRole();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, status],
    queryFn:  () => projectsApi.list({ search: search || undefined, status: status || undefined, limit: 50 }),
    select:   (r) => r.data,
  });

  const projects = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">MÓDULO / PROYECTOS</p>
          <h1 className="page-title">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total ?? 0} proyectos registrados</p>
        </div>
        {canCreateProject && (
          <Link to="/projects/new" className="smi-btn">
            <Plus className="w-4 h-4" /> Nuevo Proyecto
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nombre, código o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="PAUSED">Pausado</option>
          <option value="COMPLETED">Completado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando proyectos...</div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay proyectos</p>
          {canCreateProject && <Link to="/projects/new" className="btn-primary mt-4 inline-flex">Crear primer proyecto</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}
              className="card p-4 flex items-center gap-4 hover:border-primary-200 hover:shadow-md transition-all group">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">{p.name}</p>
                  <span className={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {p.code} {p.client ? `· ${p.client}` : ''} {p.location ? `· ${p.location}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(p.estimatedBudget))}</p>
                <p className="text-xs text-gray-400">{p._count?.expenses ?? 0} gastos</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
