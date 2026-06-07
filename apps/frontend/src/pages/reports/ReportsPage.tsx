import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileSpreadsheet, FileText, Download,
  Calendar, FolderOpen, Receipt, TrendingUp, Loader2,
} from 'lucide-react';
import { projectsApi } from '../../api';
import api from '../../api/client';

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

async function downloadReport(path: string, filename: string) {
  const response = await api.get(`/reports${path}`, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = filename; a.click();
  URL.revokeObjectURL(href);
}

interface ReportCardProps {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  accentColor: string;
  actions:     { label: string; icon: React.ReactNode; ext: 'xlsx' | 'pdf'; onClick: () => Promise<void> }[];
}

function ReportCard({ icon, title, description, accentColor, actions }: ReportCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    try { await fn(); } finally { setLoading(null); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
                   borderLeft: `4px solid ${accentColor}`, padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px',
                       background: `${accentColor}18`, flexShrink: 0,
                       display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '1rem', color: B.dark,
                       letterSpacing: '0.04em', margin: '0 0 4px' }}>
            {title.toUpperCase()}
          </p>
          <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
        {actions.map((action) => (
          <button key={action.label}
            onClick={() => handleClick(action.label, action.onClick)}
            disabled={loading === action.label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
                       background: loading === action.label ? '#f9fafb' : (action.ext === 'xlsx' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'),
                       border: `1px solid ${action.ext === 'xlsx' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                       color: action.ext === 'xlsx' ? '#16a34a' : '#dc2626',
                       borderRadius: '7px', padding: '0.45rem 0.9rem',
                       fontFamily: BODY, fontSize: '0.78rem', fontWeight: 600,
                       cursor: loading === action.label ? 'not-allowed' : 'pointer',
                       opacity: loading === action.label ? 0.6 : 1,
                       transition: 'all 0.15s' }}>
            {loading === action.label
              ? <Loader2 style={{ width: '13px', height: '13px' }} className="animate-spin" />
              : action.icon}
            {loading === action.label ? 'Descargando...' : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const today    = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [projectId,  setProjectId]  = useState('');
  const [startDate,  setStartDate]  = useState(firstDay);
  const [endDate,    setEndDate]    = useState(today);

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

  const { data: projects } = useQuery({
    queryKey: ['projects', 'reports'],
    queryFn:  () => projectsApi.list({ limit: 200 }),
    select:   (r) => r.data.data,
  });

  function qs(extra: Record<string, string> = {}) {
    const params: Record<string, string> = { startDate, endDate, ...extra };
    if (projectId) params.projectId = projectId;
    return Object.entries(params).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }

  return (
    <div style={{ fontFamily: BODY }} className="-mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <style>{`
        @keyframes rep-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .rep-up   { animation: rep-up 0.4s cubic-bezier(.2,.8,.2,1) both; }
        .rep-up-1 { animation: rep-up 0.4s 0.07s cubic-bezier(.2,.8,.2,1) both; }
        .rep-date {
          border: 1px solid #374151; border-radius: 7px; background: transparent;
          padding: 0.45rem 0.85rem; font-size: 0.78rem; font-family: ${BODY}; color: #d1d5db; outline: none;
          color-scheme: dark;
        }
        .rep-date:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
        .rep-select-dark {
          border: 1px solid #374151; border-radius: 7px; background: transparent;
          padding: 0.45rem 0.85rem; font-size: 0.78rem; font-family: ${BODY}; color: #d1d5db; outline: none;
        }
        .rep-select-dark option { background: #1C1C1C; color: #fff; }
        .rep-select-dark:focus { border-color: #F5C218; box-shadow: 0 0 0 3px rgba(245,194,24,0.12); }
      `}</style>

      {/* Hero band */}
      <div style={{ background: B.dark, padding: '2.5rem 2rem 2rem' }} className="rep-up">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ fontFamily: MONO, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
            MÓDULO / REPORTES
          </p>
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)',
                        color: '#fff', lineHeight: 1.0, letterSpacing: '-0.01em', margin: '0 0 0.4rem' }}>
            REPORTES
            <span style={{ color: B.yellow }}> &amp; EXPORTACIÓN</span>
          </h1>
          <p style={{ fontFamily: BODY, fontSize: '0.82rem', color: '#666', marginBottom: '1.5rem' }}>
            Genera reportes en Excel o PDF para análisis y auditoría DGII
          </p>

          {/* Filter controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}
               className="rep-up-1">
            <div>
              <label style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#555', letterSpacing: '0.08em',
                               display: 'block', marginBottom: '5px' }}>
                FECHA INICIO
              </label>
              <input type="date" className="rep-date" style={{ width: '100%', boxSizing: 'border-box' }}
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#555', letterSpacing: '0.08em',
                               display: 'block', marginBottom: '5px' }}>
                FECHA FIN
              </label>
              <input type="date" className="rep-date" style={{ width: '100%', boxSizing: 'border-box' }}
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#555', letterSpacing: '0.08em',
                               display: 'block', marginBottom: '5px' }}>
                PROYECTO (OPCIONAL)
              </label>
              <select className="rep-select-dark" style={{ width: '100%', boxSizing: 'border-box' }}
                value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— Todos los proyectos —</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Report cards */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        <p style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#9ca3af', letterSpacing: '0.1em',
                     marginBottom: '0.875rem' }}>
          REPORTES DISPONIBLES
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ReportCard
            icon={<TrendingUp style={{ width: '18px', height: '18px', color: '#3b82f6' }} />}
            accentColor="#3b82f6"
            title="Resumen de todos los proyectos"
            description="Estado financiero general: presupuesto, gastado, disponible y % de utilización por proyecto. Incluye semáforo de alerta."
            actions={[
              {
                label: 'Descargar Excel',
                icon: <FileSpreadsheet style={{ width: '13px', height: '13px' }} />,
                ext: 'xlsx',
                onClick: () => downloadReport(`/projects/summary.xlsx`, `resumen-proyectos-${today}.xlsx`),
              },
            ]}
          />

          <ReportCard
            icon={<FolderOpen style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />}
            accentColor="#8b5cf6"
            title="Gastos por proyecto"
            description="Lista detallada de gastos del proyecto seleccionado con categoría, método de pago, NCF y totales. Incluye resumen financiero."
            actions={[
              {
                label: 'Descargar Excel',
                icon: <FileSpreadsheet style={{ width: '13px', height: '13px' }} />,
                ext: 'xlsx',
                onClick: () => {
                  if (!projectId) { alert('Selecciona un proyecto para este reporte'); return Promise.resolve(); }
                  const q = qs();
                  return downloadReport(`/projects/${projectId}/expenses.xlsx${q ? '?' + q : ''}`, `gastos-proyecto-${today}.xlsx`);
                },
              },
              {
                label: 'Descargar PDF',
                icon: <FileText style={{ width: '13px', height: '13px' }} />,
                ext: 'pdf',
                onClick: () => {
                  if (!projectId) { alert('Selecciona un proyecto para este reporte'); return Promise.resolve(); }
                  const q = qs();
                  return downloadReport(`/projects/${projectId}/expenses.pdf${q ? '?' + q : ''}`, `reporte-proyecto-${today}.pdf`);
                },
              },
            ]}
          />

          <ReportCard
            icon={<Receipt style={{ width: '18px', height: '18px', color: '#f59e0b' }} />}
            accentColor="#f59e0b"
            title="Comprobantes fiscales (NCF)"
            description="Listado de todos los gastos con NCF: número de comprobante, RNC del suplidor, nombre, ITBIS y monto. Formato listo para revisión DGII."
            actions={[
              {
                label: 'Descargar Excel',
                icon: <FileSpreadsheet style={{ width: '13px', height: '13px' }} />,
                ext: 'xlsx',
                onClick: () => {
                  const q = qs();
                  return downloadReport(`/fiscal.xlsx${q ? '?' + q : ''}`, `comprobantes-fiscales-${today}.xlsx`);
                },
              },
            ]}
          />
        </div>

        {/* Info note */}
        <div style={{ marginTop: '1.25rem', background: 'rgba(245,194,24,0.05)',
                       border: '1px solid rgba(245,194,24,0.15)', borderRadius: '10px',
                       padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
          <Download style={{ width: '15px', height: '15px', color: B.yellow, flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.82rem', color: B.dark,
                         letterSpacing: '0.04em', margin: '0 0 6px' }}>
              SOBRE LOS REPORTES
            </p>
            <div style={{ fontFamily: BODY, fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <p style={{ margin: 0 }}>Los archivos Excel incluyen formato profesional con colores, totales automáticos y semáforos de alerta por presupuesto.</p>
              <p style={{ margin: 0 }}>Los archivos PDF están optimizados para imprimir en tamaño carta (Letter/A4).</p>
              <p style={{ margin: 0 }}>El reporte de comprobantes fiscales está diseñado para facilitar la revisión de ITBIS ante la DGII.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
