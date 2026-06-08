import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, FileSpreadsheet, FileText, Download,
  Calendar, FolderOpen, Receipt, TrendingUp, Loader2,
} from 'lucide-react';
import { projectsApi } from '../../api';
import api from '../../api/client';

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
  color:       string;
  actions:     { label: string; icon: React.ReactNode; onClick: () => Promise<void> }[];
}

function ReportCard({ icon, title, description, color, actions }: ReportCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    try { await fn(); } finally { setLoading(null); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleClick(action.label, action.onClick)}
            disabled={loading === action.label}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200
                       text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300
                       transition-all disabled:opacity-50"
          >
            {loading === action.label
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : action.icon
            }
            {loading === action.label ? 'Descargando...' : action.label}
          </button>
        ))}
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <p className="module-label">MÓDULO / REPORTES</p>
        <h1 className="page-title">Reportes y Exportación</h1>
        <p className="text-sm text-gray-500 mt-0.5">Genera reportes en Excel o PDF para análisis y auditoría</p>
      </div>

      {/* Panel de filtros */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-500" /> Filtros aplicables a los reportes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" className="input-field"
              value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha fin</label>
            <input type="date" className="input-field"
              value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Proyecto (opcional)</label>
            <select className="input-field" value={projectId}
              onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Todos los proyectos —</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Los reportes de proyecto específico requieren que selecciones un proyecto arriba.
          Los reportes globales usan el rango de fechas.
        </p>
      </div>

      {/* Reportes disponibles */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reportes disponibles</p>

        {/* Resumen global de proyectos */}
        <ReportCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          color="bg-blue-100"
          title="Resumen de todos los proyectos"
          description="Estado financiero general: presupuesto, gastado, disponible y % de utilización por proyecto. Incluye semáforo de alerta."
          actions={[
            {
              label: 'Descargar Excel',
              icon: <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />,
              onClick: () => downloadReport(
                `/projects/summary.xlsx`,
                `resumen-proyectos-${today}.xlsx`,
              ),
            },
          ]}
        />

        {/* Gastos de proyecto */}
        <ReportCard
          icon={<FolderOpen className="w-5 h-5 text-purple-600" />}
          color="bg-purple-100"
          title="Gastos por proyecto"
          description="Lista detallada de gastos del proyecto seleccionado con categoría, método de pago, NCF y totales. Incluye resumen financiero."
          actions={[
            {
              label: 'Descargar Excel',
              icon: <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />,
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
              icon: <FileText className="w-3.5 h-3.5 text-red-500" />,
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

        {/* Reporte fiscal NCF */}
        <ReportCard
          icon={<Receipt className="w-5 h-5 text-amber-600" />}
          color="bg-amber-100"
          title="Comprobantes fiscales (NCF)"
          description="Listado de todos los gastos con NCF: número de comprobante, RNC del suplidor, nombre, ITBIS y monto. Formato listo para revisión DGII."
          actions={[
            {
              label: 'Descargar Excel',
              icon: <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />,
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
      </div>

      {/* Nota informativa */}
      <div className="card p-4 bg-blue-50 border border-blue-100">
        <div className="flex items-start gap-3">
          <Download className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Sobre los reportes</p>
            <p>Los archivos Excel incluyen formato profesional con colores, totales automáticos y semáforos de alerta por presupuesto.</p>
            <p>Los archivos PDF están optimizados para imprimir en tamaño carta (Letter/A4).</p>
            <p>El reporte de comprobantes fiscales está diseñado para facilitar la revisión de ITBIS ante la DGII.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
