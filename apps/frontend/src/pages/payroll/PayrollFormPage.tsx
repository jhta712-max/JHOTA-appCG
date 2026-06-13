import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Wallet, AlertTriangle, X } from 'lucide-react';
import { payrollApi, projectsApi, type Payroll } from '../../api';
import { useRole } from '../../hooks/useRole';
import { ProjectItemSelect } from '../../components/shared/ProjectItemSelect';

interface LineItem {
  id?:          string;
  description:  string;
  quantity:     string;
  unit:         string;
  unitPrice:    string;
  notes:        string;
  supplierName: string;
  bankName:     string;
  bankAccount:  string;
}

const UNITS = ['Días', 'Hrs', 'Sem', 'PA', 'Glb', 'm²', 'm³', 'm', 'Und', 'Viaje', 'Servicio'];
const emptyLine = (): LineItem => ({
  description: '', quantity: '', unit: 'Días', unitPrice: '', notes: '',
  supplierName: '', bankName: '', bankAccount: '',
});

export default function PayrollFormPage() {
  const { id }   = useParams<{ id?: string }>();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { canCreatePayroll, canApprovePayroll } = useRole();

  // ── Todos los hooks ANTES de cualquier return condicional ───
  const [projectId,      setProjectId]      = useState('');
  const [projectItemId,  setProjectItemId]  = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd,   setPeriodEnd]   = useState('');
  const [type,        setType]        = useState<'LABOR' | 'SERVICE'>('LABOR');
  const [description, setDescription] = useState('');
  const [notes,       setNotes]       = useState('');
  const [lines,       setLines]       = useState<LineItem[]>([emptyLine()]);
  const [error,       setError]       = useState('');

  // Proyectos — sin filtro de status para mostrar todos
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects-full-list'],
    queryFn:  () => projectsApi.list({ limit: 100 }),
    select:   (r) => (r.data?.data ?? []) as any[],
    staleTime: 0,
  });

  // Nómina existente (solo en modo edición)
  const { data: existingData } = useQuery({
    queryKey: ['payroll', id],
    queryFn:  () => payrollApi.getById(id!).then((r) => r.data.data),
    enabled:  isEdit,
  });

  const createMut = useMutation({
    mutationFn: (data: unknown) => payrollApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      navigate(`/payrolls/${(res.data as any).data.id}`);
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Error al crear nómina'),
  });

  const updateMut = useMutation({
    mutationFn: (data: unknown) => payrollApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', id] });
      navigate(`/payrolls/${id}`);
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Error al actualizar nómina'),
  });

  // Pre-cargar datos al editar
  useEffect(() => {
    const p = existingData as Payroll | undefined;
    if (!p) return;
    if (p.status !== 'DRAFT') { navigate(`/payrolls/${id}`); return; }
    setProjectId(p.projectId);
    setProjectItemId((p as any).projectItemId ?? '');
    setPeriodStart(p.periodStart.slice(0, 10));
    setPeriodEnd(p.periodEnd.slice(0, 10));
    setType(p.type);
    setDescription(p.description);
    setNotes(p.notes ?? '');
    if (p.lines && p.lines.length > 0) {
      setLines(p.lines.map((l) => ({
        id:           l.id,
        description:  l.description,
        quantity:     String(l.quantity),
        unit:         l.unit,
        unitPrice:    String(l.unitPrice),
        notes:        l.notes ?? '',
        supplierName: l.supplierName ?? '',
        bankName:     l.bankName     ?? '',
        bankAccount:  l.bankAccount  ?? '',
      })));
    }
  }, [existingData]);

  // ── Guard de acceso — DESPUÉS de todos los hooks ────────────
  if (!canCreatePayroll) {
    navigate('/payrolls');
    return null;
  }

  // ── Datos derivados ──────────────────────────────────────────
  const total    = lines.reduce((sum, l) => {
    return sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }, 0);
  const isPending = createMut.isPending || updateMut.isPending;

  // ── Helpers de líneas ────────────────────────────────────────
  function addLine()    { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(idx: number) { setLines((ls) => ls.filter((_, i) => i !== idx)); }
  function updateLine(idx: number, field: keyof LineItem, value: string) {
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  // ── Submit ───────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!projectId)                    { setError('Seleccione un proyecto'); return; }
    if (!periodStart || !periodEnd)    { setError('Seleccione el período'); return; }
    if (periodEnd < periodStart)       { setError('La fecha de fin debe ser posterior al inicio'); return; }
    if (!description.trim())           { setError('Ingrese una descripción'); return; }

    const validLines = lines.filter((l) => l.description.trim() && l.quantity && l.unitPrice);

    if (isEdit) {
      updateMut.mutate({
        periodStart,
        periodEnd,
        type,
        description:   description.trim(),
        notes:         notes.trim() || undefined,
        projectItemId: projectItemId || null,
      });
    } else {
      createMut.mutate({
        projectId,
        projectItemId: projectItemId || undefined,
        periodStart,
        periodEnd,
        type,
        description: description.trim(),
        notes:       notes.trim() || undefined,
        lines: validLines.map((l) => ({
          description:  l.description.trim(),
          quantity:     parseFloat(l.quantity),
          unit:         l.unit,
          unitPrice:    parseFloat(l.unitPrice),
          notes:        l.notes.trim()        || undefined,
          supplierName: l.supplierName.trim() || undefined,
          bankName:     l.bankName.trim()     || undefined,
          bankAccount:  l.bankAccount.trim()  || undefined,
        })),
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#1C1C1C] px-6 py-6">
        <Link
          to={isEdit ? `/payrolls/${id}` : '/payrolls'}
          className="flex items-center gap-1.5 text-[#F5C218] text-xs font-['Barlow_Condensed'] tracking-widest uppercase mb-3 hover:opacity-80"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEdit ? 'Volver al detalle' : 'Volver a nóminas'}
        </Link>
        <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-[#F5C218] uppercase mb-1">
          MÓDULO / NÓMINAS
        </p>
        <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
          {isEdit ? 'Editar Nómina' : 'Nueva Nómina'}
        </h1>
        <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
          {isEdit
            ? 'Modifica los datos generales. Las líneas se gestionan desde el detalle.'
            : 'Crea una nómina borrador con sus líneas de trabajo o servicio.'}
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl space-y-5">
        {error && (
          <div className="bg-[#1C1C1C] border border-red-500/40 text-red-400 text-sm px-4 py-3 flex items-start gap-2 font-['DM_Sans']">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-gray-400 hover:text-[#F5C218]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Datos generales ──────────────────────────────── */}
          <div className="bg-white border border-gray-200 p-5 space-y-4">
            <h2 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase">
              Datos generales
            </h2>

            {/* Proyecto (solo en crear) */}
            {!isEdit && (
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                  Proyecto <span className="text-red-500">*</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]"
                >
                  <option value="">— Seleccione un proyecto —</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
                {loadingProjects && (
                  <p className="text-xs text-amber-600 mt-1 font-['DM_Sans']">Cargando proyectos…</p>
                )}
                {!loadingProjects && projects.length === 0 && (
                  <p className="text-xs text-red-500 mt-1 font-['DM_Sans']">No se encontraron proyectos. Verifique que existan proyectos en el sistema.</p>
                )}
              </div>
            )}

            <ProjectItemSelect
              projectId={projectId || undefined}
              value={projectItemId}
              onChange={setProjectItemId}
            />

            {/* Tipo */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                Tipo
              </label>
              <div className="flex gap-4">
                {(['LABOR', 'SERVICE'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value={t} checked={type === t}
                      onChange={() => setType(t)} className="accent-[#F5C218]" />
                    <span className="text-sm text-gray-700 font-['DM_Sans']">
                      {t === 'LABOR' ? '👷 Mano de obra' : '🔧 Servicios'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                  Período inicio <span className="text-red-500">*</span>
                </label>
                <input type="date" value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)} required
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
              </div>
              <div>
                <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                  Período fin <span className="text-red-500">*</span>
                </label>
                <input type="date" value={periodEnd} min={periodStart}
                  onChange={(e) => setPeriodEnd(e.target.value)} required
                  className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                Descripción <span className="text-red-500">*</span>
              </label>
              <input type="text" value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Pago semana 3 — cuadrilla albañilería" required
                className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
            </div>

            {/* Notas */}
            <div>
              <label className="block font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
                Notas internas
              </label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones opcionales…"
                className="w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] resize-none focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
            </div>
          </div>

          {/* ── Líneas de trabajo (solo al crear) ─────────────── */}
          {!isEdit && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-[#1C1C1C] flex items-center justify-between">
                <h2 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-400 uppercase">
                  Líneas de trabajo
                  <span className="ml-2 text-gray-500">
                    ({lines.length} línea{lines.length !== 1 ? 's' : ''})
                  </span>
                </h2>
                <button type="button" onClick={addLine}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] font-['Barlow_Condensed'] tracking-wide uppercase">
                  <Plus className="w-3.5 h-3.5" /> Agregar línea
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1C1C1C]">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-36">Nombre Suplidor</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Concepto de Servicio</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-20">Unidad</th>
                      <th className="px-3 py-2.5 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-20">Cantidad</th>
                      <th className="px-3 py-2.5 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-24">Precio Unit.</th>
                      <th className="px-3 py-2.5 text-right font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-24">Monto a Pagar</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-32">Banco</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em] w-36">No. Cuenta</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, idx) => {
                      const sub = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-2 py-1.5">
                            <input placeholder="Nombre del suplidor"
                              value={line.supplierName}
                              onChange={(e) => updateLine(idx, 'supplierName', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input placeholder="Concepto o descripción del servicio"
                              value={line.description}
                              onChange={(e) => updateLine(idx, 'description', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.unit}
                              onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                              className="w-full border border-gray-200 px-1 py-1 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]">
                              {UNITS.map((u) => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.001" placeholder="0"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm text-right font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" placeholder="0.00"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm text-right font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-['Space_Mono'] font-semibold text-gray-800 text-xs whitespace-nowrap">
                            {sub > 0 ? `RD$ ${sub.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            <input placeholder="Ej: Banco Popular"
                              value={line.bankName}
                              onChange={(e) => updateLine(idx, 'bankName', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input placeholder="No. de cuenta"
                              value={line.bankAccount}
                              onChange={(e) => updateLine(idx, 'bankAccount', e.target.value)}
                              className="w-full border border-gray-200 px-2 py-1 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]" />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {lines.length > 1 && (
                              <button type="button" onClick={() => removeLine(idx)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#F5C218] bg-[#1C1C1C]">
                      <td colSpan={5} className="px-3 py-3 text-right font-['Barlow_Condensed'] font-bold text-[#F5C218] text-sm uppercase tracking-widest">TOTAL A PAGAR</td>
                      <td className="px-3 py-3 text-right font-['Space_Mono'] font-bold text-[#F5C218] whitespace-nowrap">
                        RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Acciones ──────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold font-['Barlow_Condensed'] uppercase tracking-wide bg-[#F5C218] text-[#1C1C1C] hover:bg-[#e6b400] disabled:opacity-50">
              <Wallet className="w-4 h-4" />
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear Nómina'}
            </button>
            <Link to={isEdit ? `/payrolls/${id}` : '/payrolls'}
              className="px-5 py-2.5 text-sm font-medium font-['DM_Sans'] border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
