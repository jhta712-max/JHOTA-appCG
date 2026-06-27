import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Search, ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { SkeletonBlock }        from '../../components/ui/Skeleton';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-800 text-xs px-2 py-0.5',
  PAUSED:    'bg-amber-100 text-amber-800 text-xs px-2 py-0.5',
  COMPLETED: 'bg-blue-100 text-blue-800 text-xs px-2 py-0.5',
  CANCELLED: 'bg-red-100 text-red-800 text-xs px-2 py-0.5',
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
    <div>
      {/* Hero header band */}
      <div
        className="px-4 md:px-6 py-4 md:py-5 flex items-center justify-between"
        style={{ background: '#0D1B48' }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-widest mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", color: '#1D4ED8' }}
          >
            Módulo / Proyectos
          </p>
          <h1
            className="text-3xl md:text-5xl uppercase tracking-widest text-white"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Proyectos
          </h1>
          <p
            className="text-sm mt-1 h-5 flex items-center"
            style={{ fontFamily: "'Space Mono', monospace", color: '#1D4ED8' }}
          >
            {isLoading
              ? <SkeletonBlock className="h-4 w-36 bg-gray-600" />
              : `${data?.pagination?.total ?? 0} proyectos registrados`
            }
          </p>
        </div>
        {canCreateProject && (
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-wide font-bold"
            style={{ background: '#1D4ED8', color: '#ffffff', fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            <Plus className="w-4 h-4" /> Nuevo Proyecto
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap pt-5 pb-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full border border-gray-300 px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            style={{ fontFamily: "'DM Sans', sans-serif", borderRadius: 0 }}
            placeholder="Buscar por nombre, código o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          style={{ fontFamily: "'DM Sans', sans-serif", borderRadius: 0 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="PAUSED">Pausado</option>
          <option value="COMPLETED">Completado</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <ProjectListSkeleton />
      ) : projects.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <div
            className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
            style={{ background: '#0D1B48' }}
          >
            <FolderOpen className="w-7 h-7" style={{ color: '#1D4ED8' }} />
          </div>
          <p
            className="text-xl uppercase tracking-widest text-gray-800 mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            No hay proyectos
          </p>
          {canCreateProject && (
            <Link
              to="/projects/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-wide font-bold"
              style={{ background: '#1D4ED8', color: '#ffffff', fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              <Plus className="w-4 h-4" /> Crear primer proyecto
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="bg-white border border-gray-200 hover:border-[#1D4ED8] transition-colors p-3 md:p-4 flex items-center gap-3 md:gap-4 group cursor-pointer"
            >
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0"
                style={{ background: '#0D1B48' }}
              >
                <FolderOpen className="w-5 h-5" style={{ color: '#1D4ED8' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="font-semibold text-[#0D1B48]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {p.name}
                  </p>
                  <span
                    className={STATUS_BADGE[p.status]}
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
                <p
                  className="text-xs text-gray-500 mt-0.5"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {p.code}{p.client ? ` · ${p.client}` : ''}{p.location ? ` · ${p.location}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p
                  className="text-sm font-bold text-[#0D1B48]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {formatCurrency(Number(p.estimatedBudget))}
                </p>
                <p
                  className="text-xs text-gray-400"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {p._count?.expenses ?? 0} gastos
                </p>
              </div>
              <ArrowRight
                className="w-4 h-4 shrink-0 text-gray-300 group-hover:text-[#1D4ED8] transition-colors"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
