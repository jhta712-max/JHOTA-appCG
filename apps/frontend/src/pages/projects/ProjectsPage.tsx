import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Search, ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api';
import { useRole } from '../../hooks/useRole';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo', PAUSED: 'Pausado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: 'rgba(245,194,24,0.15)', color: '#b08a00' },
  PAUSED:    { bg: 'rgba(156,163,175,0.2)', color: '#6b7280' },
  COMPLETED: { bg: 'rgba(34,197,94,0.15)',  color: '#16a34a' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)',  color: '#dc2626' },
};
const PROJECT_ACCENT = ['#F5C218', '#e05a4e', '#3b82f6', '#10b981', '#8b5cf6', '#f97316'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);
}

export default function ProjectsPage() {
  const { canCreateProject } = useRole();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search, status],
    queryFn:  () => projectsApi.list({ search: search || undefined, status: status || undefined, limit: 50 }),
    select:   (r) => r.data,
  });

  const projects = data?.data ?? [];

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes proj-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .proj-up   { animation: proj-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .proj-up-1 { animation: proj-up 0.4s 0.06s cubic-bezier(.2,.8,.2,1) both; }
        .proj-card { transition: transform 0.15s, box-shadow 0.15s; }
        .proj-card:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.10); }
        .proj-filter {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.55rem 0.9rem;
          font-size: 0.82rem;
          font-family: ${BODY};
          color: #374151;
          outline: none;
          transition: border-color 0.15s;
        }
        .proj-filter:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
      `}</style>

      {/* Hero band */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 2rem' }} className="proj-up">
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                MÓDULO / PROYECTOS
              </p>
              <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)',
                            color: '#fff', lineHeight: 1.0, letterSpacing: '-0.01em', margin: 0 }}>
                PROYECTOS
              </h1>
              <p style={{ fontFamily: BODY, fontSize: '0.82rem', color: '#666', marginTop: '0.4rem' }}>
                {data?.pagination?.total ?? 0} proyectos registrados
              </p>
            </div>
            {canCreateProject && (
              <Link to="/projects/new"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px',
                           background: B.yellow, color: B.dark,
                           fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em',
                           padding: '0.65rem 1.25rem', borderRadius: '8px', textDecoration: 'none',
                           transition: 'opacity 0.15s' }}
                className="hover:opacity-90">
                <Plus style={{ width: '16px', height: '16px' }} />
                NUEVO PROYECTO
              </Link>
            )}
          </div>

          {/* Filters inside hero */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }} className="proj-up-1">
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                width: '15px', height: '15px', color: '#9ca3af' }} />
              <input
                className="proj-filter"
                style={{ width: '100%', paddingLeft: '2rem', boxSizing: 'border-box' }}
                placeholder="Buscar por nombre, código o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="proj-filter" value={status} onChange={(e) => setStatus(e.target.value)}
                    style={{ minWidth: '160px' }}>
              <option value="">Todos los estados</option>
              <option value="ACTIVE">Activo</option>
              <option value="PAUSED">Pausado</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', fontFamily: MONO, fontSize: '0.75rem', color: '#9ca3af', letterSpacing: '0.08em' }}>
            CARGANDO...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <FolderOpen style={{ width: '40px', height: '40px', color: '#d1d5db', margin: '0 auto 1rem' }} />
            <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '1.1rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
              NO HAY PROYECTOS
            </p>
            {canCreateProject && (
              <Link to="/projects/new"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '1.25rem',
                           background: B.yellow, color: B.dark, fontFamily: DISPLAY, fontWeight: 800,
                           fontSize: '0.85rem', letterSpacing: '0.06em',
                           padding: '0.65rem 1.25rem', borderRadius: '8px', textDecoration: 'none' }}>
                Crear primer proyecto
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {projects.map((p, i) => {
              const accent = PROJECT_ACCENT[i % PROJECT_ACCENT.length];
              const ss = STATUS_STYLE[p.status] ?? STATUS_STYLE.PAUSED;
              const budget = Number(p.estimatedBudget);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div className="proj-card"
                    style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb',
                               borderLeft: `4px solid ${accent}`,
                               display: 'flex', alignItems: 'center', gap: '1rem',
                               padding: '1rem 1.25rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '1.05rem',
                                     color: B.dark, letterSpacing: '0.02em', margin: 0 }}>
                          {p.name}
                        </p>
                        <span style={{ fontFamily: BODY, fontSize: '0.7rem', fontWeight: 600,
                                         background: ss.bg, color: ss.color,
                                         borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.04em' }}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </div>
                      <p style={{ fontFamily: MONO, fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                        {p.code}{p.client ? ` · ${p.client}` : ''}{p.location ? ` · ${p.location}` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'none' }} className="sm:block"
                         style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.85rem', color: B.dark, margin: 0 }}>
                        {formatCurrency(budget)}
                      </p>
                      <p style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#9ca3af', marginTop: '1px' }}>
                        {p._count?.expenses ?? 0} gastos
                      </p>
                    </div>
                    <ArrowRight style={{ width: '16px', height: '16px', color: '#d1d5db', flexShrink: 0 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
