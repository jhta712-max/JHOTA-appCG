import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet, Download, Calendar, FolderOpen,
  Filter, Loader2, Shield, BarChart3, Tag, CreditCard,
  CheckCircle2, ChevronDown, ChevronUp, FileText, Receipt,
  TrendingUp, ArrowLeft,
} from 'lucide-react';
import { projectsApi, categoriesApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import api from '../../api/client';

// ─── Helper de descarga ───────────────────────────────────────────────────────

async function downloadFile(path: string, filename: string) {
  const response = await api.get(`/reports${path}`, { responseType: 'blob' });
  const blob = new Blob([response.data]);
  const href = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// ─── Componente botón de descarga ─────────────────────────────────────────────

function DownloadButton({
  label, icon, onClick, variant = 'default',
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => Promise<void>;
  variant?: 'default' | 'primary' | 'gold';
}) {
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleClick = async () => {
    setLoading(true); setDone(false);
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally { setLoading(false); }
  };

  const variants = {
    default: 'border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300',
    primary: 'border border-[#1D4ED8]/60 text-[#0D1B48] bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20',
    gold:    'bg-[#1D4ED8] text-[#0D1B48] hover:bg-[#e6b400] border border-[#1D4ED8]',
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2.5 font-['Barlow_Condensed'] font-semibold text-sm uppercase tracking-wide transition-all disabled:opacity-50 ${variants[variant]}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
       done    ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : icon}
      {loading ? 'Descargando...' : done ? '¡Descargado!' : label}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExportPage() {
  const navigate   = useNavigate();
  const { isSupervisor: canAccess } = useRole();

  // Filtros
  const today    = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [startDate,     setStartDate]     = useState(firstDay);
  const [endDate,       setEndDate]       = useState(today);
  const [projectId,     setProjectId]     = useState('');
  const [categoryId,    setCategoryId]    = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status,        setStatus]        = useState('ACTIVE');
  const [showAdvanced,  setShowAdvanced]  = useState(false);

  // Período del formato 606 (por defecto: mes anterior, que es el que se reporta a la DGII)
  const prevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [p606Year,  setP606Year]  = useState(prevMonth.getFullYear());
  const [p606Month, setP606Month] = useState(prevMonth.getMonth() + 1);

  const { data: projects }   = useQuery({
    queryKey: ['projects', 'all'],
    queryFn:  () => projectsApi.list({ limit: 200 }),
    select:   (r) => r.data.data,
    enabled:  canAccess,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list(),
    select:   (r) => r.data.data,
    enabled:  canAccess,
  });

  // Construir query string
  function qs(extra: Record<string, string> = {}) {
    const params: Record<string, string> = { startDate, endDate, ...extra };
    if (projectId)     params.projectId     = projectId;
    if (categoryId)    params.categoryId    = categoryId;
    if (paymentMethod) params.paymentMethod = paymentMethod;
    if (status)        params.status        = status;
    return Object.entries(params).filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }

  // Guard de acceso
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 p-10 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 bg-[#0D1B48] flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-[#1D4ED8]" />
          </div>
          <h2 className="font-['Barlow_Condensed'] text-2xl font-bold text-gray-900 uppercase tracking-tight">Acceso restringido</h2>
          <p className="font-['DM_Sans'] text-gray-500 text-sm">Este módulo es exclusivo para Administradores y Supervisores.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-2.5 bg-[#1D4ED8] text-[#0D1B48] font-['Barlow_Condensed'] font-semibold uppercase tracking-wide text-sm hover:bg-[#e6b400]"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#0D1B48] px-6 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[#1D4ED8] text-xs font-['Barlow_Condensed'] tracking-widest uppercase mb-3 hover:opacity-80"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-[#1D4ED8] uppercase mb-1">
          REPORTES / EXPORTACIÓN
        </p>
        <div className="flex items-center gap-3">
          <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
            Exportación de Datos
          </h1>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#0D1B48] bg-[#1D4ED8] px-2.5 py-1 font-['Barlow_Condensed'] uppercase tracking-wide">
            <Shield className="w-3 h-3" /> Admin
          </span>
        </div>
        <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
          Genera reportes Excel con los gastos de todos los proyectos
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">

        {/* ── Panel de filtros ─────────────────────────────────────── */}
        <div className="bg-white border border-gray-200">
          <div className="px-5 py-3 bg-[#0D1B48] flex items-center justify-between">
            <h2 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-400 uppercase flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Filtros de exportación
            </h2>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-[#1D4ED8] hover:text-white flex items-center gap-1 font-['Barlow_Condensed'] uppercase tracking-wide font-semibold"
            >
              Filtros avanzados {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Filtros básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Fecha inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Fecha fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" /> Proyecto
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                >
                  <option value="">— Todos —</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtros avanzados */}
            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Categoría
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  >
                    <option value="">— Todas —</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Método de pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  >
                    <option value="">— Todos —</option>
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="CHECK">Cheque</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                    Estado del gasto
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  >
                    <option value="ACTIVE">Solo activos</option>
                    <option value="VOIDED">Solo anulados</option>
                    <option value="">Todos (activos + anulados)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Exportación estrella: Excel completo ─────────────────── */}
        <div className="bg-white border-2 border-[#1D4ED8] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 bg-[#0D1B48] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-[#1D4ED8]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-['Barlow_Condensed'] text-lg font-bold text-gray-900 uppercase tracking-tight">
                  Exportación Completa — Excel Multi-Hoja
                </h3>
                <span className="text-xs bg-[#1D4ED8] text-[#0D1B48] px-2 py-0.5 font-['Barlow_Condensed'] font-semibold uppercase tracking-wide">
                  Recomendado
                </span>
              </div>
              <p className="font-['DM_Sans'] text-sm text-gray-600">
                Genera un archivo Excel con 4 hojas integradas: todos los gastos en detalle,
                resumen por proyecto con semáforo presupuestal, distribución por categoría, y listado de comprobantes fiscales NCF.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Hoja 1: Gastos detallados', 'Hoja 2: Por proyecto', 'Hoja 3: Por categoría', 'Hoja 4: NCF / Fiscales'].map((s) => (
                  <span key={s} className="border border-gray-200 px-2 py-0.5 text-xs text-gray-500 font-['DM_Sans']">{s}</span>
                ))}
              </div>
            </div>
          </div>
          <DownloadButton
            variant="gold"
            label="Descargar Excel Completo"
            icon={<Download className="w-4 h-4" />}
            onClick={() => {
              const q = qs();
              return downloadFile(
                `/expenses/complete.xlsx${q ? '?' + q : ''}`,
                `gastos-${startDate}_${endDate}.xlsx`,
              );
            }}
          />
        </div>

        {/* ── Reportes individuales ─────────────────────────────────── */}
        <div>
          <p className="font-['Barlow_Condensed'] text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Reportes individuales
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Resumen de todos los proyectos */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Resumen de Proyectos
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Presupuesto vs. gastado por proyecto</p>
                </div>
              </div>
              <DownloadButton
                label="Excel"
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => downloadFile('/projects/summary.xlsx', `resumen-proyectos-${today}.xlsx`)}
              />
            </div>

            {/* Gastos todos los proyectos (directos + pagos de crédito) */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Gastos por Todos los Proyectos
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">
                    Gastos directos + pagos de línea de crédito. Los ítems vinculados a crédito salen como pago de línea, no como gasto directo.
                  </p>
                </div>
              </div>
              <DownloadButton
                label="Descargar Excel"
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => {
                  const q = qs();
                  return downloadFile(`/all-projects-expenses.xlsx${q ? '?' + q : ''}`, `gastos-todos-proyectos-${today}.xlsx`);
                }}
              />
            </div>

            {/* Gastos de proyecto específico */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Gastos por Proyecto
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Requiere seleccionar un proyecto</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <DownloadButton
                  label="Excel"
                  icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (!projectId) { alert('Selecciona un proyecto en los filtros'); return Promise.resolve(); }
                    const q = qs();
                    return downloadFile(`/projects/${projectId}/expenses.xlsx${q ? '?' + q : ''}`, `gastos-proyecto-${today}.xlsx`);
                  }}
                />
                <DownloadButton
                  label="PDF"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (!projectId) { alert('Selecciona un proyecto en los filtros'); return Promise.resolve(); }
                    const q = qs();
                    return downloadFile(`/projects/${projectId}/expenses.pdf${q ? '?' + q : ''}`, `reporte-proyecto-${today}.pdf`);
                  }}
                />
              </div>
            </div>

            {/* Comprobantes Fiscales */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Comprobantes Fiscales (NCF)
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Para revisión DGII / contabilidad</p>
                </div>
              </div>
              <DownloadButton
                label="Excel NCF"
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => {
                  const q = qs();
                  return downloadFile(`/fiscal.xlsx${q ? '?' + q : ''}`, `comprobantes-ncf-${today}.xlsx`);
                }}
              />
            </div>

            {/* Formato 606 DGII */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Formato 606 (DGII)
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Compras con NCF del período fiscal</p>
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  className="flex-1 border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  value={p606Month} onChange={(e) => setP606Month(Number(e.target.value))}>
                  {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
                    .map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select
                  className="w-24 border border-gray-200 px-2 py-1.5 text-xs font-['Space_Mono'] focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  value={p606Year} onChange={(e) => setP606Year(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
                    .map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <DownloadButton
                label="Excel 606"
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                onClick={() => downloadFile(
                  `/606.xlsx?year=${p606Year}&month=${p606Month}`,
                  `606-${p606Year}${String(p606Month).padStart(2, '0')}.xlsx`,
                )}
              />
            </div>

            {/* Reportes rápidos */}
            <div className="bg-white border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0D1B48] flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div>
                  <h3 className="font-['Barlow_Condensed'] font-bold text-gray-900 text-sm uppercase tracking-tight">
                    Exportación rápida
                  </h3>
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Mes actual, sin filtros adicionales</p>
                </div>
              </div>
              <DownloadButton
                label="Mes actual"
                icon={<Download className="w-3.5 h-3.5" />}
                variant="primary"
                onClick={() => downloadFile(
                  `/expenses/complete.xlsx?startDate=${firstDay}&endDate=${today}&status=ACTIVE`,
                  `mes-actual-${today}.xlsx`,
                )}
              />
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="bg-[#0D1B48] border border-[#1D4ED8]/40 p-4 flex gap-3">
          <Shield className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-['Barlow_Condensed'] font-semibold text-[#1D4ED8] text-xs uppercase tracking-widest">
              Módulo de acceso restringido
            </p>
            <p className="font-['DM_Sans'] text-xs text-gray-400">
              Este módulo solo es visible para Administradores y Supervisores. Los archivos Excel incluyen formato profesional con colores corporativos, semáforos de alerta presupuestal y totales automáticos. Los filtros aplicados arriba se reflejan en todas las exportaciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
