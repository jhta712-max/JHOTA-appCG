import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fmtDate } from '../../utils/date';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRole } from '../../hooks/useRole';
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X,
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  AlertCircle, Activity,
} from 'lucide-react';
import { projectsApi } from '../../api';
import type { Cubicacion } from '../../types';

// ── Utilidades ────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

// fmtDate importado desde utils/date (evita desplazamiento UTC)

type CubForm = { amount: string; progressPct: string; description: string; date: string };

// ── Fila de cubicación con edición inline ─────────────────────
function CubicacionRow({
  cub,
  onSave,
  onDelete,
}: {
  cub: Cubicacion;
  onSave: (id: string, data: CubForm) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState<CubForm>({
    amount:      String(cub.amount),
    progressPct: String(cub.progressPct),
    description: cub.description,
    date:        cub.date?.split('T')[0] ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(cub.id, form); setEditing(false); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <tr className="bg-[#F5C218]/10 border-t border-[#F5C218]/30">
        <td className="px-3 py-2 text-sm font-bold text-[#F5C218]" style={{ fontFamily: "'Space Mono', monospace" }}>#{cub.number}</td>
        <td className="px-2 py-2">
          <input
            type="number" min="0.01" step="0.01"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
            style={{ fontFamily: "'Space Mono', monospace" }}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </td>
        <td className="px-2 py-2 w-24">
          <div className="flex items-center gap-1">
            <input
              type="number" min="0" max="100" step="1"
              className="w-16 px-2 py-1.5 text-sm border border-gray-300 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
              style={{ fontFamily: "'Space Mono', monospace" }}
              value={form.progressPct}
              onChange={(e) => setForm({ ...form, progressPct: e.target.value })}
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
        </td>
        <td className="px-2 py-2">
          <input
            className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </td>
        <td className="px-2 py-2">
          <input
            type="date"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
            style={{ fontFamily: "'Space Mono', monospace" }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </td>
        <td className="px-2 py-2">
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] transition-colors disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-sm font-bold text-gray-400" style={{ fontFamily: "'Space Mono', monospace" }}>#{cub.number}</td>
      <td className="px-3 py-3 text-sm font-bold text-[#1C1C1C]" style={{ fontFamily: "'Space Mono', monospace" }}>{fmt(cub.amount)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${Math.min(cub.progressPct, 100)}%`, background: '#F5C218' }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Space Mono', monospace" }}>{cub.progressPct}%</span>
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-gray-700 max-w-xs truncate" style={{ fontFamily: "'DM Sans', sans-serif" }}>{cub.description}</td>
      <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap" style={{ fontFamily: "'Space Mono', monospace" }}>{fmtDate(cub.date, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-[#F5C218]/20 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(cub.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function ProjectFinancialPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSupervisor: canView } = useRole();

  // Redirigir operadores que intenten acceder directamente por URL
  useEffect(() => {
    if (!canView) navigate(`/projects/${id}`, { replace: true });
  }, [canView, id, navigate]);

  const { data: financial, isLoading, refetch } = useQuery({
    queryKey: ['financial', id],
    queryFn:  () => projectsApi.getFinancial(id!),
    select:   (r) => r.data.data,
    enabled:  !!id,
  });

  // Formulario nueva cubicación
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]   = useState<CubForm>({ amount: '', progressPct: '', description: '', date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.amount || !form.description || !form.date) {
      setError('Monto, descripción y fecha son requeridos');
      return;
    }
    if (Number(form.amount) <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setSaving(true); setError('');
    try {
      await projectsApi.createCubicacion(id!, {
        amount:      Number(form.amount),
        progressPct: Number(form.progressPct || 0),
        description: form.description,
        date:        form.date,
      });
      setForm({ amount: '', progressPct: '', description: '', date: '' });
      setShowForm(false);
      refetch();
      qc.invalidateQueries({ queryKey: ['project-summary', id] });
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (cubId: string, data: CubForm) => {
    await projectsApi.updateCubicacion(id!, cubId, {
      amount:      Number(data.amount),
      progressPct: Number(data.progressPct || 0),
      description: data.description,
      date:        data.date,
    });
    refetch();
    qc.invalidateQueries({ queryKey: ['project-summary', id] });
  };

  const handleDelete = async (cubId: string) => {
    if (!confirm('¿Eliminar esta cubicación?')) return;
    await projectsApi.deleteCubicacion(id!, cubId);
    refetch();
    qc.invalidateQueries({ queryKey: ['project-summary', id] });
  };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <span className="text-gray-400 text-sm">Cargando análisis...</span>
    </div>
  );
  if (!financial) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <span className="text-gray-400 text-sm">Proyecto no encontrado</span>
    </div>
  );

  const { project, financials, cubicaciones } = financial;
  const { totalCubicado, totalGastado, margen, margenPct, lastProgressPct } = financials;

  // Porcentaje de cobertura: cubicado vs presupuesto total
  const coveragePct = project.totalBudget > 0
    ? Math.min((totalCubicado / project.totalBudget) * 100, 100) : 0;

  // Si no hay cubicaciones, el "margen negativo" no significa pérdida real —
  // el proyecto está en fase de ejecución sin medición de avance todavía.
  const sinCubicaciones = cubicaciones.length === 0;
  const margenColor = sinCubicaciones ? 'text-gray-500'
    : margen >= 0 ? 'text-green-700' : 'text-red-600';
  const margenBg = sinCubicaciones ? 'bg-gray-50'
    : margen >= 0 ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero header band */}
      <div className="bg-[#1C1C1C]">
        <div className="max-w-4xl mx-auto px-5 pt-4 pb-5">

          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 text-sm mb-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <button
              onClick={() => navigate(`/projects/${id}`)}
              className="flex items-center gap-1.5 text-[#F5C218] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <Link
                to={`/projects/${id}`}
                className="text-[#F5C218] hover:text-white transition-colors"
              >
                {financial ? project.code : 'Proyecto'}
              </Link>
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Análisis Financiero</span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
                Análisis Financiero
              </h1>
              <p
                className="text-sm text-gray-400 mt-1 truncate"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {project.name}
              </p>
            </div>
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] transition-colors shrink-0"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <Plus className="w-4 h-4" /> Nueva cubicación
            </button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-5 py-5 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ background: '#e5e7eb' }}>

          {/* Presupuesto total */}
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-[#F5C218]" />
              <p
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Presupuesto total
              </p>
            </div>
            <p
              className="text-lg font-bold text-[#1C1C1C]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {fmt(project.totalBudget)}
            </p>
            {project.addendumTotal > 0 && (
              <p
                className="text-xs text-gray-400 mt-0.5"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Base + adendas ({fmt(project.addendumTotal)})
              </p>
            )}
          </div>

          {/* Total cubicado */}
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-[#F5C218]" />
              <p
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Total cubicado
              </p>
            </div>
            <p
              className="text-lg font-bold text-blue-700"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {fmt(totalCubicado)}
            </p>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {coveragePct.toFixed(1)}% del presupuesto
            </p>
          </div>

          {/* Total gastado */}
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Total gastado
              </p>
            </div>
            <p
              className="text-lg font-bold text-red-600"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {fmt(totalGastado)}
            </p>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {financials.expenseCount} registros
            </p>
          </div>

          {/* Margen */}
          <div className={`bg-white p-4 ${margenBg}`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`w-4 h-4 ${sinCubicaciones ? 'text-gray-400' : margen >= 0 ? 'text-green-600' : 'text-red-500'}`} />
              <p
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Margen
              </p>
            </div>
            {sinCubicaciones ? (
              <>
                <p
                  className="text-sm font-semibold text-gray-500"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Sin medición
                </p>
                <p
                  className="text-xs text-gray-400 mt-0.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Gastos en ejecución — sin cubicaciones aún
                </p>
              </>
            ) : (
              <>
                <p
                  className={`text-lg font-bold ${margenColor}`}
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {margen >= 0 ? '' : '- '}{fmt(Math.abs(margen))}
                </p>
                <p
                  className={`text-xs mt-0.5 ${margenColor}`}
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {margenPct >= 0 ? '+' : ''}{margenPct.toFixed(1)}% sobre cubicado
                </p>
              </>
            )}
          </div>
        </div>

        {/* Comparativa financiera */}
        <div className="bg-white border border-gray-200 p-5 space-y-4">
          <h2
            className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-[#1C1C1C] flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-[#F5C218]" />
            Comparativa financiera
          </h2>

          {/* Avance físico */}
          {sinCubicaciones ? (
            <div className="flex items-start gap-3 bg-[#1C1C1C] border border-[#F5C218]/30 px-4 py-3">
              <AlertCircle className="w-4 h-4 text-[#F5C218] shrink-0 mt-0.5" />
              <div>
                <p
                  className="text-sm font-medium text-white"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Proyecto en fase de ejecución inicial
                </p>
                <p
                  className="text-xs text-gray-400 mt-0.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Se están registrando gastos pero aún no hay cubicaciones de avance. El análisis de margen
                  estará disponible cuando registres la primera cubicación.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span
                  className="text-gray-600"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Avance físico (última cubicación)
                </span>
                <span
                  className="font-bold text-[#1C1C1C]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {lastProgressPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 overflow-hidden">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${lastProgressPct}%`, background: '#F5C218' }}
                />
              </div>
            </div>
          )}

          {/* Barra 1: Presupuesto total vs Gastado */}
          {(() => {
            const pct = project.totalBudget > 0
              ? Math.min((totalGastado / project.totalBudget) * 100, 100) : 0;
            const over = totalGastado > project.totalBudget;
            return (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span
                    className="text-gray-600"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Gastado vs Presupuesto total
                  </span>
                  <span
                    className={`font-bold ${over ? 'text-red-600' : 'text-gray-800'}`}
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {fmt(totalGastado)} / {fmt(project.totalBudget)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${over ? 'bg-red-600' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  className="flex justify-between mt-1 text-xs text-gray-400"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  <span>{pct.toFixed(1)}% del presupuesto ejecutado</span>
                  <span>Disponible: {fmt(Math.max(project.totalBudget - totalGastado, 0))}</span>
                </div>
                {over && (
                  <div
                    className="flex items-center gap-1.5 mt-1 text-xs text-red-600"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <AlertCircle className="w-3 h-3" />
                    Los gastos superan el presupuesto total del contrato
                  </div>
                )}
              </div>
            );
          })()}

          {/* Barra 2: Cubicado vs Gastado */}
          {(() => {
            const pct = totalCubicado > 0
              ? Math.min((totalGastado / totalCubicado) * 100, 100) : 0;
            const over = totalCubicado > 0 && totalGastado > totalCubicado;
            return (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span
                    className="text-gray-600"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Gastado vs Cubicado
                  </span>
                  <span
                    className={`font-bold ${over ? 'text-red-600' : 'text-blue-700'}`}
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {fmt(totalGastado)} / {fmt(totalCubicado)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 overflow-hidden">
                  {totalCubicado > 0 ? (
                    <div
                      className={`h-full transition-all duration-700 ${over ? 'bg-red-600' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  ) : (
                    <div className="h-full w-0" />
                  )}
                </div>
                <div
                  className="flex justify-between mt-1 text-xs text-gray-400"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {totalCubicado > 0 ? (
                    <>
                      <span>{pct.toFixed(1)}% del monto cubicado ejecutado</span>
                      <span>Margen: {fmt(Math.max(totalCubicado - totalGastado, 0))}</span>
                    </>
                  ) : (
                    <span
                      className="text-gray-400 italic"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Sin cubicaciones registradas aún
                    </span>
                  )}
                </div>
                {over && (
                  <div
                    className="flex items-center gap-1.5 mt-1 text-xs text-red-600"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <AlertCircle className="w-3 h-3" />
                    Los gastos superan lo cubicado — revisar costos del proyecto
                  </div>
                )}
              </div>
            );
          })()}

          {/* Leyenda */}
          <div
            className="flex flex-wrap gap-4 pt-1 text-xs text-gray-500"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {!sinCubicaciones && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3" style={{ background: '#F5C218' }} />
                Avance físico
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-red-400" />
              Gastado
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-gray-200" />
              Referencia (presupuesto / cubicado)
            </div>
          </div>
        </div>

        {/* Formulario nueva cubicación */}
        {showForm && (
          <div className="bg-white border border-[#F5C218] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2
                className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-[#1C1C1C]"
              >
                Nueva cubicación #{cubicaciones.length + 1}
              </h2>
              <button
                onClick={() => { setShowForm(false); setError(''); }}
                className="text-gray-400 hover:text-[#F5C218] transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-xs uppercase tracking-wide text-gray-500 mb-1"
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  Monto cobrado (RD$) *
                </label>
                <input
                  type="number" min="0.01" step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none text-sm"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                  placeholder="1500000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <label
                  className="block text-xs uppercase tracking-wide text-gray-500 mb-1"
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  % Avance físico
                </label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="1"
                    className="w-full px-3 py-2 pr-8 border border-gray-200 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none text-sm"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                    placeholder="35"
                    value={form.progressPct}
                    onChange={(e) => setForm({ ...form, progressPct: e.target.value })}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    %
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-xs uppercase tracking-wide text-gray-500 mb-1"
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  Descripción / concepto *
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none text-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                  placeholder="Ej. Avance de obra — Mes de mayo"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label
                  className="block text-xs uppercase tracking-wide text-gray-500 mb-1"
                  style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                >
                  Fecha de la cubicación *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-200 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none text-sm"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] transition-colors text-sm font-medium disabled:opacity-60"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#1C1C1C]/40 border-t-[#1C1C1C] rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Registrar cubicación
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tabla de cubicaciones */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-[#1C1C1C]">
            <h2
              className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-white flex items-center gap-2"
            >
              <BarChart2 className="w-4 h-4 text-[#F5C218]" />
              Historial de cubicaciones
              {cubicaciones.length > 0 && (
                <span
                  className="text-xs px-2 py-0.5 font-medium"
                  style={{
                    background: 'rgba(245,194,24,0.15)',
                    color: '#F5C218',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {cubicaciones.length}
                </span>
              )}
            </h2>
            {cubicaciones.length > 0 && (
              <p
                className="text-sm text-gray-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Total:{' '}
                <span
                  className="font-bold text-[#F5C218]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {fmt(totalCubicado)}
                </span>
              </p>
            )}
          </div>

          {cubicaciones.length === 0 ? (
            <div
              className="text-center py-12 text-gray-400"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No hay cubicaciones registradas</p>
              <p className="text-xs mt-1">Registra los cobros al cliente según el avance de la obra</p>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 mx-auto mt-4 px-4 py-2 text-sm font-medium bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Plus className="w-4 h-4" /> Registrar primera cubicación
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1C1C1C] border-t border-[#F5C218]/20">
                  <tr>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em] w-10"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      N°
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em]"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Monto
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em] w-32"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Avance
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em]"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Descripción
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em]"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Fecha
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs text-gray-400 uppercase tracking-[0.15em] w-20"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Acc.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cubicaciones.map((c) => (
                    <CubicacionRow
                      key={c.id}
                      cub={c}
                      onSave={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-[#1C1C1C]">
                  <tr>
                    <td
                      className="px-3 py-3 text-xs text-gray-500 font-semibold uppercase"
                      style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
                    >
                      Total
                    </td>
                    <td
                      className="px-3 py-3 text-sm font-bold text-blue-700"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {fmt(totalCubicado)}
                    </td>
                    <td
                      className="px-3 py-3 text-sm font-semibold text-gray-700"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {lastProgressPct.toFixed(1)}% avance
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Resumen comparativo final */}
        {cubicaciones.length > 0 && (
          <div className="bg-white border border-gray-200 p-5">
            <h2
              className="font-['Barlow_Condensed'] text-base uppercase tracking-widest text-[#1C1C1C] mb-4"
            >
              Resumen de cierre financiero
            </h2>
            <div
              className="space-y-0 text-sm divide-y divide-gray-100"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <div className="flex justify-between py-2.5">
                <span className="text-gray-600">Presupuesto base del contrato</span>
                <span
                  className="font-medium text-gray-800"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {fmt(project.estimatedBudget)}
                </span>
              </div>
              {project.addendumTotal > 0 && (
                <div className="flex justify-between py-2.5">
                  <span className="text-gray-600">Adendas de contrato</span>
                  <span
                    className="font-medium text-green-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    + {fmt(project.addendumTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2.5 font-semibold">
                <span>Presupuesto total del contrato</span>
                <span style={{ fontFamily: "'Space Mono', monospace" }}>{fmt(project.totalBudget)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-gray-600">Total facturado / cubicado al cliente</span>
                <span
                  className="font-medium text-blue-700"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {fmt(totalCubicado)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-gray-600">Total gastos del proyecto</span>
                <span
                  className="font-medium text-red-600"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  - {fmt(totalGastado)}
                </span>
              </div>
              <div className={`flex justify-between py-3 px-3 font-bold text-base ${margenBg}`}>
                <span>Margen del proyecto</span>
                <span
                  className={margenColor}
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {margen >= 0 ? '+' : ''}{fmt(margen)}
                  <span
                    className="text-sm font-normal ml-2"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ({margenPct >= 0 ? '+' : ''}{margenPct.toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
