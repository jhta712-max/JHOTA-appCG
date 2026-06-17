import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fmtDate } from '../../utils/date';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '../../hooks/useRole';
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X,
  TrendingUp, TrendingDown, DollarSign, BarChart2,
  AlertCircle, Activity, Zap,
} from 'lucide-react';
import { projectsApi } from '../../api';
import { DetailPageSkeleton } from '../../components/ui/DetailPageSkeleton';
import { PAGE_META }           from '../../utils/routeMeta';
import FormModal               from '../../components/ui/FormModal';
import type { Cubicacion, Anticipo, ExtraordinaryExpense } from '../../types';

// ── Utilidades ────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

// fmtDate importado desde utils/date (evita desplazamiento UTC)

type CubForm = { amount: string; progressPct: string; description: string; date: string; ncf: string };

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
    ncf:         cub.ncf ?? '',
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
          <input
            type="text"
            maxLength={19}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none bg-white"
            style={{ fontFamily: "'Space Mono', monospace" }}
            value={form.ncf ?? ''}
            onChange={(e) => setForm({ ...form, ncf: e.target.value })}
            placeholder="NCF"
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
      <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">{cub.ncf ?? '—'}</td>
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
  const { isSupervisor: canView, isAdmin } = useRole();
  const canEdit = isAdmin;

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
  const [form, setForm]   = useState<CubForm>({ amount: '', progressPct: '', description: '', date: '', ncf: '' });
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
        ncf:         form.ncf?.trim() || null,
      });
      setForm({ amount: '', progressPct: '', description: '', date: '', ncf: '' });
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
      ncf:         data.ncf?.trim() || null,
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

  // Anticipos state
  const [anticipoForm, setAnticipoForm] = useState({
    amount: '', date: '', ncf: '', description: '',
  });
  const [editingAnticipoId, setEditingAnticipoId] = useState<string | null>(null);
  const [showAnticipoForm, setShowAnticipoForm] = useState(false);

  const createAnticipoMutation = useMutation({
    mutationFn: (data: unknown) => projectsApi.createAnticipo(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial', id] });
      setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
      setShowAnticipoForm(false);
    },
  });

  const updateAnticipoMutation = useMutation({
    mutationFn: ({ aid, data }: { aid: string; data: unknown }) =>
      projectsApi.updateAnticipo(id!, aid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial', id] });
      setEditingAnticipoId(null);
      setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
    },
  });

  const deleteAnticipoMutation = useMutation({
    mutationFn: (aid: string) => projectsApi.deleteAnticipo(id!, aid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial', id] }),
  });

  const handleSaveAnticipo = () => {
    const payload = {
      amount:      parseFloat(anticipoForm.amount),
      date:        anticipoForm.date,
      ncf:         anticipoForm.ncf.trim() || null,
      description: anticipoForm.description.trim() || null,
    };
    if (editingAnticipoId) {
      updateAnticipoMutation.mutate({ aid: editingAnticipoId, data: payload });
    } else {
      createAnticipoMutation.mutate(payload);
    }
  };

  const handleEditAnticipo = (anticipo: Anticipo) => {
    setEditingAnticipoId(anticipo.id);
    setAnticipoForm({
      amount:      String(anticipo.amount),
      date:        anticipo.date ? anticipo.date.split('T')[0] : '',
      ncf:         anticipo.ncf ?? '',
      description: anticipo.description ?? '',
    });
    setShowAnticipoForm(true);
  };

  // ── Gastos Extraordinarios ────────────────────────────────────
  const CATEGORY_LABELS: Record<string, string> = {
    COMISION: 'Comisión',
    PRESTAMO: 'Préstamo',
    IMPUESTO: 'Impuesto',
    MULTA:    'Multa',
    OTRO:     'Otro',
  };

  const CATEGORY_COLORS: Record<string, string> = {
    COMISION: 'bg-blue-100 text-blue-700',
    PRESTAMO: 'bg-orange-100 text-orange-700',
    IMPUESTO: 'bg-red-100 text-red-700',
    MULTA:    'bg-yellow-100 text-yellow-800',
    OTRO:     'bg-gray-100 text-gray-600',
  };

  const [extraModal, setExtraModal] = useState<{
    open: boolean;
    editing: ExtraordinaryExpense | null;
  }>({ open: false, editing: null });

  const [extraForm, setExtraForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    category: 'COMISION' as string,
    notes: '',
  });

  const createExtraMut = useMutation({
    mutationFn: (data: unknown) =>
      projectsApi.createExtraordinaryExpense(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial', id] });
      setExtraModal({ open: false, editing: null });
    },
  });

  const updateExtraMut = useMutation({
    mutationFn: ({ expId, data }: { expId: string; data: unknown }) =>
      projectsApi.updateExtraordinaryExpense(id!, expId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial', id] });
      setExtraModal({ open: false, editing: null });
    },
  });

  const deleteExtraMut = useMutation({
    mutationFn: (expId: string) =>
      projectsApi.deleteExtraordinaryExpense(id!, expId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial', id] });
    },
  });

  function openExtraModal(editing: ExtraordinaryExpense | null) {
    setExtraForm(editing ? {
      description: editing.description,
      amount:      String(editing.amount),
      date:        editing.date.slice(0, 10),
      category:    editing.category,
      notes:       editing.notes ?? '',
    } : {
      description: '',
      amount:      '',
      date:        new Date().toISOString().slice(0, 10),
      category:    'COMISION',
      notes:       '',
    });
    setExtraModal({ open: true, editing });
  }

  function submitExtraForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      description: extraForm.description,
      amount:      parseFloat(extraForm.amount),
      date:        extraForm.date,
      category:    extraForm.category,
      notes:       extraForm.notes || undefined,
    };
    if (extraModal.editing) {
      updateExtraMut.mutate({ expId: extraModal.editing.id, data: payload });
    } else {
      createExtraMut.mutate(payload);
    }
  }

  if (isLoading) {
    const meta = PAGE_META['/projects'];
    return (
      <div>
        <div className="flex items-center justify-between px-6 py-5" style={{ background: '#1C1C1C' }}>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C218' }}>
              {meta.module}
            </p>
            <h1 className="text-3xl uppercase tracking-widest text-white leading-none" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {meta.title}
            </h1>
          </div>
        </div>
        <div className="p-6"><DetailPageSkeleton sections={4} /></div>
      </div>
    );
  }
  if (!financial) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <span className="text-gray-400 text-sm">Proyecto no encontrado</span>
    </div>
  );

  const { project, financials, cubicaciones } = financial;
  const { totalCubicado, totalGastado, margen, margenPct, lastProgressPct, totalExtraordinario, margenNeto, margenNetoPct } = financials;

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px" style={{ background: '#e5e7eb' }}>

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

          {/* Total Cobrado */}
          <div className="bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <p
                className="text-xs text-gray-500 uppercase tracking-wide"
                style={{ fontFamily: "'Barlow_Condensed', sans-serif" }}
              >
                Total cobrado
              </p>
            </div>
            <p
              className="text-lg font-bold text-green-700"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              {fmt(financials.totalCobrado ?? 0)}
            </p>
            <p
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Ant. {fmt(financials.totalAnticipos ?? 0)} + Cub. {fmt(totalCubicado)}
            </p>
          </div>

          {/* Gastos Extraordinarios */}
          <div className="bg-white border border-gray-200 p-4">
            <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider mb-1">
              Gastos Extrd.
            </p>
            <p className="font-['Space_Mono'] text-xl font-bold text-red-600">
              -{(totalExtraordinario ?? 0).toLocaleString('es-DO', {
                style: 'currency', currency: 'DOP', maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {(financial.extraordinaryExpenses ?? []).length} registro{(financial.extraordinaryExpenses ?? []).length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Margen Neto */}
          <div className={`border p-4 ${(margenNeto ?? 0) >= 0 ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
            <p className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider mb-1">
              Margen Neto
            </p>
            <p className={`font-['Space_Mono'] text-xl font-bold ${(margenNeto ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(margenNeto ?? 0).toLocaleString('es-DO', {
                style: 'currency', currency: 'DOP', maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {(margenNetoPct ?? 0).toFixed(1)}% sobre cubicado
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

        {/* ── Anticipos recibidos ─────────────────────────────── */}
        <div className="bg-white border border-gray-200">
          {/* Header */}
          <div className="bg-[#1C1C1C] px-6 py-4 flex items-center justify-between">
            <h2 className="font-['Barlow_Condensed'] text-lg font-bold text-white uppercase tracking-wide">
              Anticipos recibidos
            </h2>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingAnticipoId(null);
                  setAnticipoForm({ amount: '', date: '', ncf: '', description: '' });
                  setShowAnticipoForm(v => !v);
                }}
                className="bg-[#F5C218] text-[#1C1C1C] px-3 py-1.5 text-xs font-['Barlow_Condensed'] font-bold uppercase tracking-wide hover:bg-yellow-400 transition-colors"
              >
                + Agregar anticipo
              </button>
            )}
          </div>

          {/* Form */}
          {showAnticipoForm && canEdit && (
            <div className="border-b border-gray-200 p-6 bg-gray-50">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    Monto *
                  </label>
                  <input
                    type="number"
                    value={anticipoForm.amount}
                    onChange={e => setAnticipoForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={anticipoForm.date}
                    onChange={e => setAnticipoForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                  />
                </div>
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    NCF
                  </label>
                  <input
                    type="text"
                    value={anticipoForm.ncf}
                    onChange={e => setAnticipoForm(f => ({ ...f, ncf: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                    placeholder="B0100000001 o E310000000001"
                    maxLength={19}
                  />
                </div>
                <div>
                  <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    Descripción
                  </label>
                  <input
                    type="text"
                    value={anticipoForm.description}
                    onChange={e => setAnticipoForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                    placeholder="Anticipo contractual 20% según contrato"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowAnticipoForm(false); setEditingAnticipoId(null); }}
                  className="px-4 py-2 text-sm border border-gray-200 text-gray-600 font-['DM_Sans'] hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAnticipo}
                  disabled={!anticipoForm.amount || !anticipoForm.date || createAnticipoMutation.isPending || updateAnticipoMutation.isPending}
                  className="px-4 py-2 text-sm bg-[#F5C218] text-[#1C1C1C] font-['Barlow_Condensed'] font-bold uppercase tracking-wide hover:bg-yellow-400 disabled:opacity-50 transition-colors"
                >
                  {editingAnticipoId ? 'Guardar cambios' : 'Registrar anticipo'}
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {(!financial.anticipos || financial.anticipos.length === 0) ? (
            <div className="p-8 text-center text-gray-400 font-['DM_Sans'] text-sm">
              No hay anticipos registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1C1C1C]">
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">N°</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Fecha</th>
                    <th className="px-4 py-3 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Monto</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">NCF</th>
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Descripción</th>
                    {canEdit && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {financial.anticipos.map((anticipo, idx) => (
                    <tr key={anticipo.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-['Space_Mono'] text-sm text-gray-500">#{anticipo.number}</td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-sm text-gray-700">
                        {fmtDate(anticipo.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-sm font-bold text-[#1C1C1C] text-right">
                        {fmt(anticipo.amount)}
                      </td>
                      <td className="px-4 py-3 font-['Space_Mono'] text-xs text-gray-500">
                        {anticipo.ncf ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-['DM_Sans'] text-sm text-gray-600">
                        {anticipo.description ?? '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEditAnticipo(anticipo)}
                              className="text-gray-400 hover:text-[#F5C218] transition-colors text-xs p-1"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm('¿Eliminar este anticipo?')) deleteAnticipoMutation.mutate(anticipo.id); }}
                              className="text-gray-400 hover:text-red-500 transition-colors text-xs p-1"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="px-4 py-3 font-['Barlow_Condensed'] text-xs uppercase tracking-wide text-gray-500">Total anticipos</td>
                    <td className="px-4 py-3 font-['Space_Mono'] text-sm font-bold text-[#1C1C1C] text-right">
                      {fmt(financials.totalAnticipos ?? 0)}
                    </td>
                    <td colSpan={canEdit ? 3 : 2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Gastos Extraordinarios ─────────────────────────────── */}
        <div>
          <div className="bg-[#1C1C1C] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#F5C218]" />
              <span className="font-['Barlow_Condensed'] text-sm text-white uppercase tracking-widest">
                Gastos Extraordinarios
              </span>
            </div>
            {canEdit && (
              <button
                onClick={() => openExtraModal(null)}
                className="flex items-center gap-1 bg-[#F5C218] text-[#1C1C1C] px-3 py-1 text-xs font-bold font-['Barlow_Condensed'] uppercase hover:bg-yellow-400 transition-colors"
              >
                + Agregar
              </button>
            )}
          </div>

          {(!financial.extraordinaryExpenses || financial.extraordinaryExpenses.length === 0) ? (
            <div className="border border-t-0 border-gray-200 p-6 text-center text-sm text-gray-400">
              No hay gastos extraordinarios registrados
            </div>
          ) : (
            <table className="w-full text-sm border border-t-0 border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Descripción', 'Categoría', 'Fecha', 'Monto', 'Notas', ''].map(h => (
                    <th key={h} className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wider px-4 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {financial.extraordinaryExpenses.map(e => (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-['DM_Sans']">{e.description}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 font-['Barlow_Condensed'] uppercase font-bold ${CATEGORY_COLORS[e.category]}`}>
                        {CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-['Space_Mono'] text-xs text-gray-500">
                      {new Date(e.date).toLocaleDateString('es-DO')}
                    </td>
                    <td className="px-4 py-2 font-['Space_Mono'] text-red-600 font-bold">
                      -{Number(e.amount).toLocaleString('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs max-w-[180px] truncate">
                      {e.notes ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      {canEdit && (
                        <div className="flex gap-2">
                          <button onClick={() => openExtraModal(e)} className="text-gray-400 hover:text-[#F5C218]">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { if (confirm('¿Eliminar este gasto extraordinario?')) deleteExtraMut.mutate(e.id); }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-['Barlow_Condensed'] text-xs text-gray-500 uppercase tracking-wide block mb-1">
                  NCF
                </label>
                <input
                  type="text"
                  value={form.ncf ?? ''}
                  onChange={e => setForm(f => ({ ...f, ncf: e.target.value }))}
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] outline-none"
                  placeholder="B0100000001 o E310000000001"
                  maxLength={19}
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
                    <th className="px-4 py-3 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">NCF</th>
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
                    <td colSpan={4} />
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
              {(financials.totalAnticipos ?? 0) > 0 && (
                <div className="flex justify-between py-2.5">
                  <span className="text-gray-600">Anticipos recibidos</span>
                  <span
                    className="font-medium text-blue-700"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {fmt(financials.totalAnticipos ?? 0)}
                  </span>
                </div>
              )}
              {(financials.totalAnticipos ?? 0) > 0 && (
                <div className="flex justify-between py-2.5 font-semibold">
                  <span>Total cobrado del cliente</span>
                  <span
                    className="text-blue-800"
                    style={{ fontFamily: "'Space Mono', monospace" }}
                  >
                    {fmt(financials.totalCobrado ?? totalCubicado)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2.5">
                <span className="text-gray-600">Total gastos del proyecto</span>
                <span
                  className="font-medium text-red-600"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  - {fmt(totalGastado)}
                </span>
              </div>
              {(() => {
                const totalCobrado = financials.totalCobrado ?? totalCubicado;
                const margenReal = totalCobrado - totalGastado;
                const margenRealPct = totalCobrado > 0 ? (margenReal / totalCobrado) * 100 : 0;
                const colorReal = sinCubicaciones ? 'text-gray-500' : margenReal >= 0 ? 'text-green-700' : 'text-red-600';
                const bgReal = sinCubicaciones ? 'bg-gray-50' : margenReal >= 0 ? 'bg-green-50' : 'bg-red-50';
                return (
                  <div className={`flex justify-between py-3 px-3 font-bold text-base ${bgReal}`}>
                    <span>Margen del proyecto</span>
                    <span className={colorReal} style={{ fontFamily: "'Space Mono', monospace" }}>
                      {margenReal >= 0 ? '+' : ''}{fmt(margenReal)}
                      <span className="text-sm font-normal ml-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        ({margenRealPct >= 0 ? '+' : ''}{margenRealPct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      {/* Modal Gasto Extraordinario */}
      {extraModal.open && <FormModal
        onClose={() => setExtraModal({ open: false, editing: null })}
        title={extraModal.editing ? 'EDITAR GASTO EXTRAORDINARIO' : 'NUEVO GASTO EXTRAORDINARIO'}
      >
        <form onSubmit={submitExtraForm} className="p-5 space-y-4">
          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
              Descripción *
            </label>
            <input
              type="text"
              value={extraForm.description}
              onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
              placeholder="Ej: Comisión bancaria enero"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
                Categoría *
              </label>
              <select
                value={extraForm.category}
                onChange={e => setExtraForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={extraForm.date}
                onChange={e => setExtraForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
              Monto (DOP) *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={extraForm.amount}
              onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block font-['Barlow_Condensed'] text-xs uppercase tracking-wider text-gray-600 mb-1">
              Notas <span className="text-gray-400 normal-case">(opcional)</span>
            </label>
            <textarea
              value={extraForm.notes}
              onChange={e => setExtraForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] resize-none"
              placeholder="Detalles adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setExtraModal({ open: false, editing: null })}
              className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] border border-gray-200 text-gray-600 hover:border-gray-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createExtraMut.isPending || updateExtraMut.isPending}
              className="px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed'] bg-[#F5C218] text-[#1C1C1C] disabled:opacity-50"
            >
              {createExtraMut.isPending || updateExtraMut.isPending ? 'Guardando…' : (extraModal.editing ? 'Guardar cambios' : 'Registrar')}
            </button>
          </div>
        </form>
      </FormModal>}
    </div>
  );
}
