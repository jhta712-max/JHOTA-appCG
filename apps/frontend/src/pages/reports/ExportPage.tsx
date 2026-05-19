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
import { useAuthStore } from '../../stores/authStore';
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

  const base = 'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 border';
  const variants = {
    default: 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300',
    primary: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100',
    gold:    'border-yellow-400 text-yellow-900 bg-yellow-50 hover:bg-yellow-100 shadow-sm',
  };

  return (
    <button onClick={handleClick} disabled={loading} className={`${base} ${variants[variant]}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
       done    ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : icon}
      {loading ? 'Descargando...' : done ? '¡Descargado!' : label}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ExportPage() {
  const navigate   = useNavigate();
  const user       = useAuthStore((s) => s.user);
  const canAccess  = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

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
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Acceso restringido</h2>
        <p className="text-gray-500 text-sm">Este módulo es exclusivo para Administradores y Supervisores.</p>
        <button onClick={() => navigate('/')} className="btn-primary px-6 py-2">Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Exportación de Datos</h1>
            <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <Shield className="w-3 h-3" /> Admin
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Genera reportes Excel con los gastos de todos los proyectos</p>
        </div>
      </div>

      {/* ── Panel de filtros ─────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-gray-500" /> Filtros de exportación
          </h2>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Filtros avanzados {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Filtros básicos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Fecha inicio</label>
            <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Fecha fin</label>
            <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> Proyecto</label>
            <select className="input-field" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Todos —</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros avanzados */}
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="label flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Categoría</label>
              <select className="input-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Todas —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Método de pago</label>
              <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">— Todos —</option>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Estado del gasto</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">Solo activos</option>
                <option value="VOIDED">Solo anulados</option>
                <option value="">Todos (activos + anulados)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Exportación estrella: Excel completo ─────────────────── */}
      <div className="card p-5 border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-white space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-yellow-700" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Exportación Completa — Excel Multi-Hoja</h3>
              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">Recomendado</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Genera un archivo Excel con 4 hojas integradas: todos los gastos en detalle,
              resumen por proyecto con semáforo presupuestal, distribución por categoría, y listado de comprobantes fiscales NCF.
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
              <span className="bg-gray-100 rounded-full px-2 py-0.5">📋 Hoja 1: Gastos detallados</span>
              <span className="bg-gray-100 rounded-full px-2 py-0.5">🏗 Hoja 2: Por proyecto</span>
              <span className="bg-gray-100 rounded-full px-2 py-0.5">🏷 Hoja 3: Por categoría</span>
              <span className="bg-gray-100 rounded-full px-2 py-0.5">🧾 Hoja 4: NCF / Fiscales</span>
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
              `SERVINGMI-gastos-${startDate}_${endDate}.xlsx`,
            );
          }}
        />
      </div>

      {/* ── Reportes individuales ─────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Reportes individuales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Resumen de todos los proyectos */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Resumen de Proyectos</h3>
                <p className="text-xs text-gray-500">Presupuesto vs. gastado por proyecto</p>
              </div>
            </div>
            <DownloadButton
              label="Excel"
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />}
              onClick={() => downloadFile('/projects/summary.xlsx', `resumen-proyectos-${today}.xlsx`)}
            />
          </div>

          {/* Gastos de proyecto específico */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Gastos por Proyecto</h3>
                <p className="text-xs text-gray-500">Requiere seleccionar un proyecto</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <DownloadButton
                label="Excel"
                icon={<FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />}
                onClick={() => {
                  if (!projectId) { alert('Selecciona un proyecto en los filtros'); return Promise.resolve(); }
                  const q = qs();
                  return downloadFile(`/projects/${projectId}/expenses.xlsx${q ? '?' + q : ''}`, `gastos-proyecto-${today}.xlsx`);
                }}
              />
              <DownloadButton
                label="PDF"
                icon={<FileText className="w-3.5 h-3.5 text-red-500" />}
                onClick={() => {
                  if (!projectId) { alert('Selecciona un proyecto en los filtros'); return Promise.resolve(); }
                  const q = qs();
                  return downloadFile(`/projects/${projectId}/expenses.pdf${q ? '?' + q : ''}`, `reporte-proyecto-${today}.pdf`);
                }}
              />
            </div>
          </div>

          {/* Comprobantes Fiscales */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Comprobantes Fiscales (NCF)</h3>
                <p className="text-xs text-gray-500">Para revisión DGII / contabilidad</p>
              </div>
            </div>
            <DownloadButton
              label="Excel NCF"
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />}
              onClick={() => {
                const q = qs();
                return downloadFile(`/fiscal.xlsx${q ? '?' + q : ''}`, `comprobantes-ncf-${today}.xlsx`);
              }}
            />
          </div>

          {/* Reportes rápidos */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Exportación rápida</h3>
                <p className="text-xs text-gray-500">Mes actual, sin filtros adicionales</p>
              </div>
            </div>
            <DownloadButton
              label="Mes actual"
              icon={<Download className="w-3.5 h-3.5 text-indigo-500" />}
              variant="primary"
              onClick={() => downloadFile(
                `/expenses/complete.xlsx?startDate=${firstDay}&endDate=${today}&status=ACTIVE`,
                `SERVINGMI-mes-actual-${today}.xlsx`,
              )}
            />
          </div>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500 flex gap-3">
        <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-gray-600">Módulo de acceso restringido</p>
          <p>Este módulo solo es visible para Administradores y Supervisores. Los archivos Excel incluyen formato profesional con colores SERVINGMI, semáforos de alerta presupuestal y totales automáticos. Los filtros aplicados arriba se reflejan en todas las exportaciones.</p>
        </div>
      </div>
    </div>
  );
}
