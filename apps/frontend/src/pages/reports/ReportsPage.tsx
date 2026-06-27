import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileSpreadsheet, FileText, Download,
  Calendar, FolderOpen, Receipt, TrendingUp, Loader2, Zap,
} from 'lucide-react';
import { projectsApi, suppliersApi } from '../../api';
import api from '../../api/client';
import { useRole } from '../../hooks/useRole';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function downloadReport(path: string, filename: string) {
  // api.baseURL = '/api/v1', so path = '/reports/...'
  const response = await api.get(`/reports${path}`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data]);
  const href = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// ─── Componente de tarjeta de reporte ─────────────────────────────────────────

interface ReportCardProps {
  icon:        React.ReactNode;
  title:       string;
  description: string;
  index:       number;
  actions:     { label: string; icon: React.ReactNode; isPrimary?: boolean; onClick: () => Promise<void> }[];
}

function ReportCard({ icon, title, description, index, actions }: ReportCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    try { await fn(); } finally { setLoading(null); }
  };

  return (
    <div className="group relative bg-[#0D1B48] border border-white/10 hover:border-[#1D4ED8] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(245,194,24,0.12)]">
      {/* Index badge */}
      <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 flex items-center justify-center border-l border-b border-white/10">
        <span className="font-['Space_Mono'] text-xs text-white/30">{String(index).padStart(2, '0')}</span>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-[#1D4ED8]/10 border border-[#1D4ED8]/30 flex items-center justify-center shrink-0">
            <div className="text-[#1D4ED8]">{icon}</div>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-['Barlow_Condensed'] text-lg font-semibold text-white uppercase tracking-wide leading-none">
              {title}
            </h3>
            <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleClick(action.label, action.onClick)}
              disabled={loading === action.label}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-['DM_Sans'] font-medium transition-all disabled:opacity-50
                ${action.isPrimary !== false
                  ? 'bg-[#1D4ED8] text-[#0D1B48] hover:bg-[#e6b400]'
                  : 'bg-transparent border border-white/20 text-white hover:border-white/40 hover:bg-white/5'
                }`}
            >
              {loading === action.label
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <span className="opacity-70">{action.icon}</span>
              }
              {loading === action.label ? 'Descargando...' : action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const today     = new Date().toISOString().split('T')[0];
  const firstDay  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [projectId,  setProjectId]  = useState('');
  const [startDate,  setStartDate]  = useState(firstDay);
  const [endDate,    setEndDate]    = useState(today);

  const { isAdmin, isSupervisor } = useRole();

  const { data: projects } = useQuery({
    queryKey: ['projects', 'reports'],
    queryFn:  () => projectsApi.list({ limit: 200 }),
    select:   (r) => r.data.data,
  });

  // helper para construir query string
  function qs(extra: Record<string, string> = {}) {
    const params: Record<string, string> = { startDate, endDate, ...extra };
    if (projectId) params.projectId = projectId;
    return Object.entries(params).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }

  async function handleDownloadCreditReport(status: 'active' | 'all') {
    try {
      const res = await suppliersApi.downloadCreditReport(status);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credito-suplidores-${status}-${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error descargando reporte de crédito', err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div className="bg-[#0D1B48]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-[#1D4ED8] uppercase mb-2">
            MÓDULO / REPORTES
          </p>
          <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight leading-none">
            REPORTES
          </h1>
          <p className="font-['DM_Sans'] text-sm text-gray-400 mt-3">
            Genera reportes en Excel o PDF para análisis y auditoría
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Filtros ───────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-[#1D4ED8]" />
            <h2 className="font-['Barlow_Condensed'] text-sm font-semibold tracking-[0.15em] text-[#0D1B48] uppercase">
              FILTROS
            </h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  className="w-full font-['Space_Mono'] text-sm bg-white border border-gray-200 text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Fecha fin
                </label>
                <input
                  type="date"
                  className="w-full font-['Space_Mono'] text-sm bg-white border border-gray-200 text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Proyecto (opcional)
                </label>
                <select
                  className="w-full font-['DM_Sans'] text-sm bg-white border border-gray-200 text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">— Todos los proyectos —</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="font-['DM_Sans'] text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
              Los reportes de proyecto específico requieren que selecciones un proyecto arriba.
              Los reportes globales usan el rango de fechas.
            </p>
          </div>
        </div>

        {/* ── Reportes disponibles ──────────────────────────────────────── */}
        <div>
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-4">
            REPORTES DISPONIBLES
          </p>
          <div className="space-y-3">

            {/* Resumen global de proyectos */}
            <ReportCard
              index={1}
              icon={<TrendingUp className="w-5 h-5" />}
              title="Resumen de todos los proyectos"
              description="Estado financiero general: presupuesto, gastado, disponible y % de utilización por proyecto. Incluye semáforo de alerta."
              actions={[
                {
                  label: 'Descargar Excel',
                  isPrimary: true,
                  icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                  onClick: () => downloadReport(
                    `/projects/summary.xlsx`,
                    `resumen-proyectos-${today}.xlsx`,
                  ),
                },
              ]}
            />

            {/* Gastos de proyecto */}
            <ReportCard
              index={2}
              icon={<FolderOpen className="w-5 h-5" />}
              title="Gastos por proyecto"
              description="Lista detallada de gastos del proyecto seleccionado con categoría, método de pago, NCF y totales. Incluye resumen financiero."
              actions={[
                {
                  label: 'Descargar Excel',
                  isPrimary: true,
                  icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                  onClick: () => {
                    if (!projectId) { alert('Selecciona un proyecto para este reporte'); return Promise.resolve(); }
                    const q = qs();
                    return downloadReport(
                      `/projects/${projectId}/expenses.xlsx${q ? '?' + q : ''}`,
                      `gastos-proyecto-${today}.xlsx`,
                    );
                  },
                },
                {
                  label: 'Descargar PDF',
                  isPrimary: false,
                  icon: <FileText className="w-3.5 h-3.5" />,
                  onClick: () => {
                    if (!projectId) { alert('Selecciona un proyecto para este reporte'); return Promise.resolve(); }
                    const q = qs();
                    return downloadReport(
                      `/projects/${projectId}/expenses.pdf${q ? '?' + q : ''}`,
                      `reporte-proyecto-${today}.pdf`,
                    );
                  },
                },
              ]}
            />

            {/* Gastos todos los proyectos — directos + pagos de línea de crédito */}
            <ReportCard
              index={3}
              icon={<FolderOpen className="w-5 h-5" />}
              title="Gastos por todos los proyectos"
              description="Gastos directos + pagos de líneas de crédito consolidados. Los gastos vinculados a crédito de suplidor no salen como gasto directo — aparecen como pago de línea. 3 hojas: Gastos directos, Pagos de crédito, Resumen por proyecto."
              actions={[
                {
                  label: 'Descargar Excel',
                  isPrimary: true,
                  icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                  onClick: () => {
                    const q = qs();
                    return downloadReport(
                      `/all-projects-expenses.xlsx${q ? '?' + q : ''}`,
                      `gastos-todos-proyectos-${today}.xlsx`,
                    );
                  },
                },
              ]}
            />

            {/* Reporte fiscal NCF */}
            <ReportCard
              index={4}
              icon={<Receipt className="w-5 h-5" />}
              title="Comprobantes fiscales (NCF)"
              description="Listado de todos los gastos con NCF: número de comprobante, RNC del suplidor, nombre, ITBIS y monto. Formato listo para revisión DGII."
              actions={[
                {
                  label: 'Descargar Excel',
                  isPrimary: true,
                  icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                  onClick: () => {
                    const q = qs();
                    return downloadReport(
                      `/fiscal.xlsx${q ? '?' + q : ''}`,
                      `comprobantes-fiscales-${today}.xlsx`,
                    );
                  },
                },
              ]}
            />

            {/* Estado de crédito por suplidor */}
            {(isAdmin || isSupervisor) && (
              <ReportCard
                index={5}
                icon={<Zap className="w-5 h-5" />}
                title="Estado de Crédito por Suplidor"
                description="Snapshot actual de todas las líneas de crédito con suplidores — límite, consumido, pendiente y disponible."
                actions={[
                  {
                    label: 'Activas',
                    isPrimary: true,
                    icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                    onClick: () => handleDownloadCreditReport('active'),
                  },
                  {
                    label: 'Todas',
                    isPrimary: false,
                    icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                    onClick: () => handleDownloadCreditReport('all'),
                  },
                ]}
              />
            )}

            {/* Varianza presupuesto vs. ejecución */}
            <ReportCard
              index={6}
              icon={<BarChart3 className="w-5 h-5" />}
              title="Varianza Presupuesto vs. Ejecución"
              description="Por proyecto: presupuesto estimado vs. ejecutado (gastos activos) vs. comprometido (órdenes pendientes/en proceso). Semáforo de alerta en >85% y >100%. Exportable por proyecto o para todos."
              actions={[
                {
                  label: projectId ? 'Proyecto seleccionado' : 'Todos los proyectos',
                  isPrimary: true,
                  icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                  onClick: () => {
                    const params = projectId ? `?projectId=${projectId}` : '';
                    return downloadReport(`/variance.xlsx${params}`, `varianza-presupuestal-${today}.xlsx`);
                  },
                },
              ]}
            />
          </div>
        </div>

        {/* ── Nota informativa ─────────────────────────────────────────── */}
        <div className="bg-[#0D1B48] border border-white/10 p-5 flex items-start gap-4">
          <div className="w-8 h-8 bg-[#1D4ED8]/10 border border-[#1D4ED8]/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="font-['DM_Sans'] text-xs text-gray-400 space-y-1.5">
            <p className="font-['Barlow_Condensed'] text-sm font-semibold text-white uppercase tracking-wide">
              Sobre los reportes
            </p>
            <p>Los archivos Excel incluyen formato profesional con colores, totales automáticos y semáforos de alerta por presupuesto.</p>
            <p>Los archivos PDF están optimizados para imprimir en tamaño carta (Letter/A4).</p>
            <p>El reporte de comprobantes fiscales está diseñado para facilitar la revisión de ITBIS ante la DGII.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
