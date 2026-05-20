import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fmtDate } from '../../utils/date';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
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
      <tr className="bg-yellow-50">
        <td className="px-3 py-2 text-sm font-semibold text-gray-500 w-10">#{cub.number}</td>
        <td className="px-2 py-2">
          <input type="number" min="0.01" step="0.01" className="input-field text-sm py-1.5"
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </td>
        <td className="px-2 py-2 w-24">
          <div className="flex items-center gap-1">
            <input type="number" min="0" max="100" step="1" className="input-field text-sm py-1.5 w-16"
              value={form.progressPct} onChange={(e) => setForm({ ...form, progressPct: e.target.value })} />
            <span className="text-sm text-gray-400">%</span>
          </div>
        </td>
        <td className="px-2 py-2">
          <input className="input-field text-sm py-1.5"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </td>
        <td className="px-2 py-2">
          <input type="date" className="input-field text-sm py-1.5"
            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </td>
        <td className="px-2 py-2">
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving}
              className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditing(false)}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-sm font-bold text-gray-400">#{cub.number}</td>
      <td className="px-3 py-3 text-sm font-semibold text-gray-900">{fmt(cub.amount)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary-500"
              style={{ width: `${Math.min(cub.progressPct, 100)}%` }} />
          </div>
          <span className="text-sm font-medium text-gray-700">{cub.progressPct}%</span>
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-gray-700 max-w-xs truncate">{cub.description}</td>
      <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap">{fmtDate(cub.date, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(cub.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
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
  const user = useAuthStore((s) => s.user);
  const canView = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

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

  if (isLoading) return <div className="text-center py-20 text-gray-400">Cargando análisis...</div>;
  if (!financial) return <div className="text-center py-20 text-gray-400">Proyecto no encontrado</div>;

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
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Encabezado ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/projects/${id}`)}
          className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/projects/${id}`}
              className="text-sm text-gray-500 hover:text-primary-600 font-medium truncate">
              {project.code}
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">Análisis Financiero</h1>
          </div>
          <p className="text-sm text-gray-500 truncate">{project.name}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); }}
          className="btn-primary py-2 px-4 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Nueva cubicación
        </button>
      </div>

      {/* ── Tarjetas de resumen ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* Presupuesto total */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Presupuesto total</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmt(project.totalBudget)}</p>
          {project.addendumTotal > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Base + adendas ({fmt(project.addendumTotal)})
            </p>
          )}
        </div>

        {/* Total cubicado */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Total cubicado</p>
          </div>
          <p className="text-lg font-bold text-blue-700">{fmt(totalCubicado)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{coveragePct.toFixed(1)}% del presupuesto</p>
        </div>

        {/* Total gastado */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xs text-gray-500 font-medium">Total gastado</p>
          </div>
          <p className="text-lg font-bold text-red-600">{fmt(totalGastado)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{financials.expenseCount} registros</p>
        </div>

        {/* Margen */}
        <div className={`card p-4 ${margenBg}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg ${sinCubicaciones ? 'bg-gray-100' : margen >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
              <TrendingUp className={`w-4 h-4 ${sinCubicaciones ? 'text-gray-400' : margen >= 0 ? 'text-green-600' : 'text-red-500'}`} />
            </div>
            <p className="text-xs text-gray-500 font-medium">Margen</p>
          </div>
          {sinCubicaciones ? (
            <>
              <p className="text-sm font-semibold text-gray-500">Sin medición</p>
              <p className="text-xs text-gray-400 mt-0.5">Gastos en ejecución — sin cubicaciones aún</p>
            </>
          ) : (
            <>
              <p className={`text-lg font-bold ${margenColor}`}>
                {margen >= 0 ? '' : '- '}{fmt(Math.abs(margen))}
              </p>
              <p className={`text-xs mt-0.5 ${margenColor}`}>
                {margenPct >= 0 ? '+' : ''}{margenPct.toFixed(1)}% sobre cubicado
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Barra comparativa Cubicado vs Gastado ──────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Comparativa financiera</h2>
        </div>

        {/* Avance físico */}
        {sinCubicaciones ? (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Proyecto en fase de ejecución inicial</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Se están registrando gastos pero aún no hay cubicaciones de avance. El análisis de margen
                estará disponible cuando registres la primera cubicación.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 font-medium">Avance físico (última cubicación)</span>
              <span className="font-bold text-gray-900">{lastProgressPct.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${lastProgressPct}%`, background: '#F5C218' }} />
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
                <span className="text-gray-600 font-medium">Gastado vs Presupuesto total</span>
                <span className={`font-bold ${over ? 'text-red-600' : 'text-gray-800'}`}>
                  {fmt(totalGastado)} / {fmt(project.totalBudget)}
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-600' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>{pct.toFixed(1)}% del presupuesto ejecutado</span>
                <span>Disponible: {fmt(Math.max(project.totalBudget - totalGastado, 0))}</span>
              </div>
              {over && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-red-600">
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
                <span className="text-gray-600 font-medium">Gastado vs Cubicado</span>
                <span className={`font-bold ${over ? 'text-red-600' : 'text-blue-700'}`}>
                  {fmt(totalGastado)} / {fmt(totalCubicado)}
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                {totalCubicado > 0 ? (
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-red-600' : 'bg-red-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                ) : (
                  <div className="h-full w-0" />
                )}
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                {totalCubicado > 0 ? (
                  <>
                    <span>{pct.toFixed(1)}% del monto cubicado ejecutado</span>
                    <span>Margen: {fmt(Math.max(totalCubicado - totalGastado, 0))}</span>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Sin cubicaciones registradas aún</span>
                )}
              </div>
              {over && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-red-600">
                  <AlertCircle className="w-3 h-3" />
                  Los gastos superan lo cubicado — revisar costos del proyecto
                </div>
              )}
            </div>
          );
        })()}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 pt-1 text-xs text-gray-500">
          {!sinCubicaciones && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: '#F5C218' }} />
              Avance físico
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            Gastado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            Referencia (presupuesto / cubicado)
          </div>
        </div>
      </div>

      {/* ── Formulario nueva cubicación ─────────────────────── */}
      {showForm && (
        <div className="card p-5 border-2 border-yellow-300 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Nueva cubicación #{cubicaciones.length + 1}
            </h2>
            <button onClick={() => { setShowForm(false); setError(''); }}
              className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monto cobrado (RD$) *</label>
              <input type="number" min="0.01" step="0.01" className="input-field"
                placeholder="1500000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">% Avance físico</label>
              <div className="relative">
                <input type="number" min="0" max="100" step="1" className="input-field pr-8"
                  placeholder="35"
                  value={form.progressPct}
                  onChange={(e) => setForm({ ...form, progressPct: e.target.value })} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Descripción / concepto *</label>
              <input className="input-field"
                placeholder="Ej. Avance de obra — Mes de mayo"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Fecha de la cubicación *</label>
              <input type="date" className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }}
              className="btn-secondary flex-1 py-2.5">
              Cancelar
            </button>
            <button type="button" onClick={handleCreate} disabled={saving}
              className="btn-primary flex-1 py-2.5">
              {saving
                ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" /> Guardando...</>
                : <><Check className="w-4 h-4" /> Registrar cubicación</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Tabla de cubicaciones ────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            Historial de cubicaciones
            {cubicaciones.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                {cubicaciones.length}
              </span>
            )}
          </h2>
          {cubicaciones.length > 0 && (
            <p className="text-sm text-gray-500">
              Total: <span className="font-semibold text-blue-700">{fmt(totalCubicado)}</span>
            </p>
          )}
        </div>

        {cubicaciones.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No hay cubicaciones registradas</p>
            <p className="text-xs mt-1">Registra los cobros al cliente según el avance de la obra</p>
            <button onClick={() => setShowForm(true)}
              className="btn-primary mt-4 text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> Registrar primera cubicación
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-3 text-left w-10">N°</th>
                  <th className="px-3 py-3 text-left">Monto</th>
                  <th className="px-3 py-3 text-left w-32">Avance</th>
                  <th className="px-3 py-3 text-left">Descripción</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left w-20">Acc.</th>
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
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-3 py-3 text-xs text-gray-500 font-semibold uppercase">Total</td>
                  <td className="px-3 py-3 text-sm font-bold text-blue-700">{fmt(totalCubicado)}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-700">
                    {lastProgressPct.toFixed(1)}% avance
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Resumen comparativo final ────────────────────────── */}
      {cubicaciones.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Resumen de cierre financiero</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Presupuesto base del contrato</span>
              <span className="font-medium">{fmt(project.estimatedBudget)}</span>
            </div>
            {project.addendumTotal > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Adendas de contrato</span>
                <span className="font-medium text-green-700">+ {fmt(project.addendumTotal)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100 font-semibold">
              <span>Presupuesto total del contrato</span>
              <span>{fmt(project.totalBudget)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Total facturado / cubicado al cliente</span>
              <span className="font-medium text-blue-700">{fmt(totalCubicado)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Total gastos del proyecto</span>
              <span className="font-medium text-red-600">- {fmt(totalGastado)}</span>
            </div>
            <div className={`flex justify-between py-3 rounded-lg px-3 font-bold text-base ${margenBg}`}>
              <span>Margen del proyecto</span>
              <span className={margenColor}>
                {margen >= 0 ? '+' : ''}{fmt(margen)}
                <span className="text-sm font-normal ml-2">({margenPct >= 0 ? '+' : ''}{margenPct.toFixed(1)}%)</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
